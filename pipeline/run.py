"""Pipeline entry point: fetches FPL data and writes to cache or Blob."""

import os
import sys
import json

# Allow running from project root: python pipeline/run.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from fpl_client import get_bootstrap_static, get_fixtures, get_element_summary
from upload import save
from understat_client import get_understat_players
from merge import merge_players
from defcon import compute_defcon_stats
from xmins import compute_xmins_stats
from bonus import compute_bonus_predictions
from simulate import compute_simulations
from price_changes import compute_price_change_predictions
from insights import compute_insights
from gw_intel import compute_gw_intel, _apply_rotation_risk
from european_cup_dates import EUROPEAN_CUP_DATES
import accuracy  # bare module name: main()'s tuner-default block dereferences accuracy.BLEND_ALPHA etc.
from accuracy import compute_accuracy_backtest, build_predictions_snapshot
from data_health import _sanitize_error


# AVAIL-01: live injury availability gate. exp12 verdict SHIP (spearman 0.33->0.44,
# RMSE 2.994->2.896, beats placebo); promoted default-ON at the 2026-07 system audit.
# AVAIL_ENABLED=false remains the kill-switch.
def _avail_enabled() -> bool:
    return os.environ.get('AVAIL_ENABLED', 'true').lower() in ('1', 'true', 'yes')


AVAIL_ENABLED = _avail_enabled()  # AVAIL-01 shadow-first


def _get_cache_dir() -> str:
    """Return the local cache directory path (mirroring save_local logic)."""
    return 'pipeline/cache'


def _get_source() -> str:
    """Return 'blob' or 'local' based on USE_BLOB env var."""
    return 'blob' if os.getenv('USE_BLOB', '').lower() == 'true' else 'local'


def _extract_sp_snapshot(merged: list) -> dict:
    """Extract primary set-piece taker IDs per team from merged players.

    Prefers available players (status 'a') ahead of injured/doubtful players.
    Falls back to the lowest-order player of any status if no one is available.
    This prevents injured first-choice takers from appearing as the active taker.
    """
    AVAILABLE = ('a',)  # only fully-available players preferred

    # Collect ordered candidates per team per role
    team_candidates: dict = {}
    for player in merged:
        team = str(player['team'])
        if team not in team_candidates:
            team_candidates[team] = {'penalty': [], 'fk': [], 'corner': []}
        for role, key in [
            ('penalty', 'penalties_order'),
            ('fk', 'direct_freekicks_order'),
            ('corner', 'corners_and_indirect_freekicks_order'),
        ]:
            order = player.get(key)
            if order is not None:
                team_candidates[team][role].append((order, player.get('status', ''), player['id']))

    snapshot = {}
    for team, roles in team_candidates.items():
        snapshot[team] = {'penalty': None, 'fk': None, 'corner': None}
        for role, candidates in roles.items():
            candidates.sort(key=lambda x: x[0])  # sort by order ascending
            # Prefer first available player; fall back to first in order
            available = [c for c in candidates if c[1] in AVAILABLE]
            chosen = available[0] if available else (candidates[0] if candidates else None)
            if chosen:
                snapshot[team][role] = chosen[2]
    return snapshot


def _diff_sp_snapshots(prev: dict, curr: dict, bootstrap: dict) -> dict:
    """Diff two snapshots and produce set_piece_changes.json content.

    Returns dict matching the SetPieceChanges TypeScript interface:
    { has_changes, change_count, teams: [{ team_id, team_short_name, penalty_taker, fk_taker, corner_taker }] }
    """
    # Build lookup maps
    teams_by_id = {str(t['id']): t for t in bootstrap.get('teams', [])}
    players_by_id = {p['id']: p for p in bootstrap.get('elements', [])}

    changes_count = 0
    teams_list = []
    is_first_run = not bool(prev)

    for team_id_str, curr_roles in sorted(curr.items(), key=lambda x: int(x[0])):
        prev_roles = prev.get(team_id_str, {})
        team_info = teams_by_id.get(team_id_str, {})

        def _taker_entry(curr_id, prev_id):
            nonlocal changes_count
            changed = (not is_first_run) and curr_id != prev_id and not (curr_id is None and prev_id is None)
            if changed:
                changes_count += 1
            player = players_by_id.get(curr_id, {}) if curr_id else {}
            return {
                'id': curr_id,
                'name': player.get('web_name', '\u2014'),
                'changed': changed,
            }

        teams_list.append({
            'team_id': int(team_id_str),
            'team_short_name': team_info.get('short_name', f'T{team_id_str}'),
            'penalty_taker': _taker_entry(curr_roles.get('penalty'), prev_roles.get('penalty')),
            'fk_taker':      _taker_entry(curr_roles.get('fk'),      prev_roles.get('fk')),
            'corner_taker':  _taker_entry(curr_roles.get('corner'),  prev_roles.get('corner')),
        })

    return {
        'has_changes': changes_count > 0,
        'change_count': changes_count,
        'teams': teams_list,
    }


CALIB_BINS = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 8), (8, 99)]


def _honest_calibration(rows: list) -> list:
    """ACC-06: bucket rows by xpts_pred into fixed bins and return per-bucket aggregates.

    Empty bins are dropped. Last bin label is [8,99) to represent '8+'.
    """
    out = []
    for lo, hi in CALIB_BINS:
        b = [r for r in rows if lo <= r['xpts_pred'] < hi]
        if not b:
            continue
        out.append({
            'bin_lo': lo, 'bin_hi': hi, 'n': len(b),
            'mean_pred':   round(sum(r['xpts_pred'] for r in b) / len(b), 2),
            'mean_actual': round(sum(r['actual_pts'] for r in b) / len(b), 2),
        })
    return out


def _run_backtest_for_picks(archive: dict, params: dict, first_gw: int, last_gw: int) -> dict:
    """Seam for tests. Runs the BT-02 honest backtest and returns the full result dict
    (keys: 'metrics', 'per_gw', 'rows')."""
    from backtest import run_backtest
    return run_backtest(archive=archive, params=params, mode='deploy',
                        first_gw=first_gw, last_gw=last_gw)


def _slim_per_gw(per_gw: list) -> list:
    """Keep only display fields per GW for honest_metrics persistence."""
    keep = {'gw', 'n_haulers', 'haul_hits', 'haul_hit_rate',
            'top10_mean_pts', 'spearman', 'captain_actual', 'captain_name'}
    return [{k: row[k] for k in keep if k in row} for row in per_gw]


def compute_honest_metrics(bootstrap: dict, fixtures: list, summaries: dict,
                           tune_params: dict) -> dict | None:
    """PICK-01: honest pick-quality metrics for the Weekly Picks confidence strip.

    Returns None until >= 8 finished GWs (UI falls back to last-season constants).
    """
    finished = sorted(e['id'] for e in bootstrap.get('events', []) if e.get('finished'))
    if len(finished) < 8:
        return None
    from tune import _map_tune_to_bt_params
    bt_params = _map_tune_to_bt_params(tune_params)
    archive = {'bootstrap': bootstrap, 'fixtures': fixtures, 'understat': {},
               'summaries': summaries, 'manifest': {'season': 'live'}}
    result = _run_backtest_for_picks(archive, bt_params, max(5, finished[0]), finished[-1])
    m = result['metrics']
    raw_per_gw = result.get('per_gw', [])
    raw_rows = result.get('rows', [])

    def _r(key, nd):
        v = m.get(key)
        return round(v, nd) if v is not None else None

    return {
        'top10_mean_pts':      _r('top10_mean_pts', 2),
        'haul_capture_20':     _r('haul_capture_20', 4),
        'captain_return_rate': _r('captain_return_rate', 4),
        'haul_hit_rate':       _r('haul_hit_rate', 4),
        'mid_tier_hit_rate':   _r('mid_tier_hit_rate', 4),
        'captain_hit_rate':    _r('captain_hit_rate', 4),
        'rmse':                _r('rmse', 4),
        'mae':                 _r('mae', 4),
        'spearman':            _r('spearman', 4),
        'by_position':         m.get('by_position'),
        'per_gw':              _slim_per_gw(raw_per_gw),
        'n_gws':               m.get('n_gws'),
        'mode':                'deploy',
        'calibration':         _honest_calibration(raw_rows),
    }


def _build_cold_start_prior():
    """COLD-01: build the cold-start prior from the latest completed-season archive.

    Returns (prior_lookup, bucket_priors, start_seed). Non-fatal — returns empty dicts
    if the archive is absent or unreadable.
    """
    from capture_season import load_season_archive
    from season_prior import build_prior_lookup, build_bucket_priors
    prior_lookup: dict = {}
    bucket_priors: dict = {}
    start_seed: dict = {}
    try:
        _archive = load_season_archive()
        prior_lookup = build_prior_lookup(_archive)
        bucket_priors = build_bucket_priors(_archive)
        # start_seed: code → {start_rate, mins_per_start} for players in prior lookup
        start_seed = {
            code: {'start_rate': p['start_rate'], 'mins_per_start': p['mins_per_start']}
            for code, p in prior_lookup.items()
        }
        print(f"COLD-01 prior: {len(prior_lookup)} players, {len(bucket_priors)} buckets")
    except FileNotFoundError:
        print("COLD-01 prior: no season archive — cold-start blend disabled (no-op)")
    except Exception as e:
        print(f"COLD-01 prior: skipped ({e})")
    return prior_lookup, bucket_priors, start_seed


def _offseason_merge(bootstrap, fixtures, id_map, prior_lookup, bucket_priors, start_seed):
    """OFFSEASON-01: run xmins + merge in off_season mode with validated default params.

    Returns (merged_players, captain_picks). Pre-season backtest is stale, so we use
    the accuracy.* defaults exactly as run.py's stale-summary fallback does.
    """
    import accuracy
    events = bootstrap.get('events', [])
    next_gw_id = next((e['id'] for e in events if e.get('is_next')), None)

    # OFFSEASON-01: guard against FPL code recycling. A code whose archive identity
    # differs from its live identity has been reassigned to a different player, so its
    # last-season prior is contaminating. Detect by web_name mismatch (state-independent:
    # works both when the live bootstrap still holds last-season stats and after the
    # pre-season reset). Do NOT key on live minutes — every player reads 0 minutes after
    # the reset, which would drop the entire prior.
    #
    # web_name is display text, not a stable key: FPL re-derives it every season (adds/drops
    # a disambiguating "X." initial as other same-surname players arrive/leave the league,
    # and diacritics are inconsistently stripped between seasons/providers -- e.g. archive
    # "Dúbravka"/live "Dubravka", archive "J.Gomes"/live "Gomes"). Comparing raw strings
    # would misfire "recycled" on those real, continuing players. Normalize (strip
    # diacritics, casefold) and treat a match if either normalized name contains the other,
    # so disambiguation-prefix churn doesn't trip the guard.
    import unicodedata

    def _norm_name(n):
        if not n:
            return ''
        n = unicodedata.normalize('NFKD', n)
        n = ''.join(ch for ch in n if not unicodedata.combining(ch))
        return n.casefold().strip()

    def _same_identity(archive_name, live_name):
        a, l = _norm_name(archive_name), _norm_name(live_name)
        if not a or not l:
            return False
        return a == l or a in l or l in a

    from capture_season import load_season_archive
    try:
        _arch_elems = load_season_archive().get('bootstrap', {}).get('elements', [])
        archive_names = {e['code']: e.get('web_name') for e in _arch_elems}
    except Exception:
        archive_names = {}
    live_names = {e['code']: e.get('web_name') for e in bootstrap.get('elements', [])}
    recycled = {
        c for c in prior_lookup
        if archive_names.get(c) is not None and live_names.get(c) is not None
        and not _same_identity(archive_names[c], live_names[c])
    }
    prior_lookup = {c: v for c, v in prior_lookup.items() if c not in recycled}
    start_seed = {c: v for c, v in start_seed.items() if c not in recycled}

    xmins_stats = compute_xmins_stats(
        bootstrap, {}, 0, fixtures=fixtures, next_gw_id=next_gw_id,
        sub_appear_window_gws=accuracy.SUB_APPEAR_WINDOW_GWS,
        start_seed=start_seed, injury_lookup=None, off_season=True,
    )
    merged, captain_picks = merge_players(
        bootstrap, fixtures, {}, id_map,
        xmins_stats=xmins_stats, summaries=None,
        form_signal_enabled=False, blend_alpha=accuracy.BLEND_ALPHA,
        cs_prob_base=0.40, cs_prob_slope=0.30,
        form_window_gws=accuracy.FORM_WINDOW_GWS,
        form_actual_beta=accuracy.FORM_ACTUAL_BETA,
        form_difficulty_gamma=accuracy.FORM_DIFFICULTY_GAMMA,
        sub_appear_window_gws=accuracy.SUB_APPEAR_WINDOW_GWS,
        cs_team_form_slope=accuracy.CS_TEAM_FORM_SLOPE,
        cs_def_form_window_gws=accuracy.CS_DEF_FORM_WINDOW_GWS,
        atf_slope=accuracy.ATF_SLOPE, atf_window_gws=accuracy.ATF_WINDOW_GWS,
        fas_slope=accuracy.FAS_SLOPE, defcon_scale=accuracy.DEFCON_SCALE,
        prior_lookup=prior_lookup, bucket_priors=bucket_priors,
        odds_lookup=None, odds_cs_weight=0.0, off_season=True,
    )
    return merged, captain_picks


def _offseason_projection_enabled() -> bool:
    """OFFSEASON-01 kill switch. Default ON; set OFFSEASON_PROJECTION_ENABLED=false to skip."""
    import os
    return os.getenv('OFFSEASON_PROJECTION_ENABLED', 'true').lower() in ('1', 'true', 'yes')


def run(dry_run: bool = False):
    """Fetch FPL data and write to cache. On failure, write stale last_updated.json."""
    if dry_run:
        source = _get_source()
        print(f"Dry run complete — USE_BLOB={os.getenv('USE_BLOB', 'false')}, source={source}")
        return

    cache_dir = _get_cache_dir()
    source = _get_source()

    try:
        # DH-01 (D-12): timestamps accumulator — recorded at write-time after each tracked save().
        from datetime import datetime as _dt_dh, timezone as _tz_dh
        timestamps: dict[str, str] = {}

        # Test hook: simulate failure before fetching (for testing stale-cache path)
        if os.getenv('MOCK_FAIL_VALIDATION', '').lower() == 'true':
            raise RuntimeError("Mock validation failure for testing")

        # Fetch and save bootstrap-static (players, teams, events)
        bootstrap = get_bootstrap_static()
        save('fpl_bootstrap.json', bootstrap)

        # Phase 133 PRST-01: price baseline capture — write-once idempotent (D-01).
        # No GW gate, no IS_OFF_SEASON gate — runs every pipeline run, guarded by _blob_exists.
        try:
            from price_baseline import capture_price_baseline
            capture_price_baseline(bootstrap)
            print("Price baseline step complete.")
        except Exception as pb_exc:
            print(f"[price_baseline] non-fatal error: {pb_exc}", file=sys.stderr)

        # Phase 123 WIN-03: IS_OFF_SEASON gate (D-05, D-06).
        # Detects end-of-season (no event with is_current=True); wraps GW-dependent
        # pipeline steps so they skip gracefully rather than KeyError on missing current GW.
        events = bootstrap.get('events', [])
        IS_OFF_SEASON = not any(e.get('is_current') for e in events)
        if IS_OFF_SEASON:
            print("[pipeline] IS_OFF_SEASON detected — no current GW in events[]; GW-dependent steps will skip.")

        # Phase 117 SCRP-01..SCRP-06: lineup_news.json artifact with per-player availability and news headlines.
        try:
            from lineup_news import compute_lineup_news
            compute_lineup_news(bootstrap)
            print("Lineup news written.")
        except Exception as ln_exc:
            print(f"[lineup_news] non-fatal error: {ln_exc}", file=sys.stderr)

        # Phase 123 SCR-01 / SCR-05: transfer_news.json artifact (Sky Sports + BBC RSS, classified).
        # D-05: runs YEAR-ROUND — outside IS_OFF_SEASON because most valuable in off-season.
        # D-06 / Pattern 1: per-source isolation inside scrape(); outer try/except is defensive.
        try:
            from transfer_news import scrape as scrape_transfer_news
            scrape_transfer_news(bootstrap)
            print("Transfer news written.")
        except Exception as tn_exc:
            print(f"[transfer_news] non-fatal error: {tn_exc}", file=sys.stderr)

        # TFR-01: confirmed transfers ledger — year-round, env-gated, non-fatal.
        try:
            from confirmed_transfers import compute_confirmed_transfers
            compute_confirmed_transfers(bootstrap)
        except Exception as ct_exc:
            print(f"[confirmed_transfers] non-fatal error: {ct_exc}", file=sys.stderr)

        # Fetch and save fixtures
        fixtures = get_fixtures()
        save('fpl_fixtures.json', fixtures)

        # Fetch Understat data (uses 24h cache per D-07)
        understat = get_understat_players()

        # Load player ID map for FPL<->Understat join
        id_map_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'player_id_map.json')
        with open(id_map_path, 'r', encoding='utf-8') as f:
            id_map = json.load(f)

        # Shared element-summary cache (Phase 7) — fetched once, used by defcon + xmins
        print("Fetching element summaries...")
        import time as _time
        summaries: dict[int, dict] = {}
        for element in bootstrap['elements']:
            if element.get('starts', 0) == 0:
                continue
            try:
                summaries[element['id']] = get_element_summary(element['id'])
            except Exception as exc:
                print(f"  Warning: skipping id={element['id']}: {exc}")
            _time.sleep(0.1)
        print(f"Element summaries fetched: {len(summaries)} players")

        # SA-02: in-season snapshot (non-fatal — never break the pipeline)
        try:
            from capture_season import snapshot_season
            snapshot_season(bootstrap, fixtures, understat, summaries)
        except Exception as exc:
            print(f"[pipeline] season snapshot failed (non-fatal): {exc}", file=sys.stderr)

        # Phase 126 NSP-01: GW38 gate — archive_season.py and suggest_squad.py.
        # CRITICAL (Pitfall 1 in RESEARCH.md): this block MUST be BEFORE the IS_OFF_SEASON
        # guard below. During GW38, is_current IS set (IS_OFF_SEASON=False). After rollover,
        # is_current is unset and the opportunity to archive the season is gone.
        current_event_entry = next((e for e in events if e.get('is_current')), None)
        last_event_id = max((e['id'] for e in events), default=0)
        CURRENT_GW = current_event_entry['id'] if current_event_entry else 0
        IS_GW38 = (CURRENT_GW > 0) and (CURRENT_GW == last_event_id)

        if IS_GW38:
            try:
                from archive_season import archive_season
                archive_season(bootstrap)
                print("Season archive step complete.")
            except Exception as arc_exc:
                print(f"[archive_season] non-fatal error: {arc_exc}", file=sys.stderr)

            try:
                from suggest_squad import suggest_squad
                archive_path = os.path.join(cache_dir, 'season_archive_gw38.json')
                _archive = None
                if os.path.exists(archive_path):
                    with open(archive_path, 'r', encoding='utf-8') as _f:
                        _archive = json.load(_f)
                elif os.getenv('USE_BLOB', '').lower() == 'true':
                    # Production (Blob) path: read back the archive that was just written.
                    import vercel_blob
                    import requests as _requests
                    _blob_list = vercel_blob.list({'prefix': 'season_archive_gw38.json', 'limit': 1})
                    _blobs = _blob_list.get('blobs', [])
                    if _blobs:
                        _url = _blobs[0].get('url', '')
                        if _url:
                            _archive = _requests.get(_url, timeout=30).json()
                if _archive is not None:
                    suggest_squad(bootstrap, _archive)
                    print("Pre-season squad written.")
                else:
                    print("[suggest_squad] archive not available — skipping ILP.", file=sys.stderr)
            except Exception as sq_exc:
                print(f"[suggest_squad] non-fatal error: {sq_exc}", file=sys.stderr)

            # Phase 127 GREEDY-01: squad health sweep (budget £80m–£120m, 81 greedy builds).
            # Runs after suggest_squad so health data exists alongside the ILP squad.
            try:
                from squad_health import compute_squad_health
                compute_squad_health(bootstrap)
                print("Squad health written.")
            except Exception as sh_exc:
                print(f"[squad_health] non-fatal error: {sh_exc}", file=sys.stderr)

        # Phase 128 AUTO-01/02: Pre-season auto-activation.
        # Nested inside IS_OFF_SEASON context (D-01): evaluates the tri-state predicate and,
        # on first detection of next-season bootstrap, writes pre_season_active.json and
        # calls suggest_squad (force-bypass) to re-run ILP against fresh next-season prices.
        if IS_OFF_SEASON:
            _pre_season_predicate = (
                len(events) >= 38
                and not any(e.get('finished') for e in events)
                and bool(events[0].get('deadline_time') if events else None)
            )
            if _pre_season_predicate:
                try:
                    # Check artifact existence (same dual-path pattern as IS_GW38 idempotency)
                    _active_key = 'pre_season_active.json'
                    _active_exists = False
                    if os.getenv('USE_BLOB', '').lower() == 'true':
                        import vercel_blob as _vb
                        _result = _vb.list({'prefix': _active_key, 'limit': 1})
                        _active_exists = len(_result.get('blobs', [])) > 0
                    else:
                        _active_exists = os.path.exists(os.path.join(cache_dir, _active_key))

                    if not _active_exists:
                        # First activation: write artifact and force-recompute squad
                        from datetime import datetime as _dt, timezone as _tz
                        _dt_str = events[0].get('deadline_time', '')
                        if not _dt_str or len(_dt_str) < 4 or not _dt_str[:4].isdigit():
                            print(f"[pipeline] Pre-season activation: malformed deadline_time {_dt_str!r} — skipping.", file=sys.stderr)
                        else:
                            _year = int(_dt_str[:4])
                            _season_id = f"{str(_year - 1)[-2:]}{str(_year)[-2:]}"
                            save(_active_key, {
                                'activated_at': _dt.now(_tz.utc).isoformat(),
                                'season_id': _season_id,
                            })
                            print(f"[pipeline] Pre-season activation written: season_id={_season_id}")
                            # Force-recompute squad against fresh bootstrap prices.
                            # Archive may be absent on first-ever run; guard accordingly.
                            archive_path = os.path.join(cache_dir, 'season_archive_gw38.json')
                            _arch = None
                            if os.path.exists(archive_path):
                                with open(archive_path, 'r', encoding='utf-8') as _f:
                                    _arch = json.load(_f)
                            elif os.getenv('USE_BLOB', '').lower() == 'true':
                                import vercel_blob as _vb2
                                import requests as _req
                                _blist = _vb2.list({'prefix': 'season_archive_gw38.json', 'limit': 1})
                                _bs = _blist.get('blobs', [])
                                if _bs:
                                    _arch = _req.get(_bs[0].get('url', ''), timeout=30).json()
                            if _arch is not None:
                                from suggest_squad import suggest_squad
                                suggest_squad(bootstrap, _arch, force=True)
                                print("[pipeline] Pre-season squad force-recomputed.")
                            else:
                                print("[pipeline] Pre-season activation: archive not available — squad recompute skipped.", file=sys.stderr)
                    else:
                        print("[pipeline] Pre-season already activated — skipping.")
                except Exception as _pa_exc:
                    print(f"[pipeline] Pre-season activation non-fatal error: {_pa_exc}", file=sys.stderr)

        # Phase 123 WIN-03: IS_OFF_SEASON gate wraps all GW-dependent pipeline steps.
        # Year-round steps (fixtures, understat, id_map, element summaries, price_changes,
        # transfer_news) remain OUTSIDE this block (D-05).
        # merged defaults to [] so downstream references (last_updated, data_health) are safe.
        merged: list = []
        sp_unmatched_count = None
        if not IS_OFF_SEASON:
            # Count finished gameweeks for xmins start_rate fallback
            finished_gws = sum(1 for e in bootstrap.get('events', []) if e.get('finished'))

            # Merge FPL + Understat data (per-90 normalisation, custom FDR, fixtures)
            # Phase 31: merge_players now returns a tuple — (player list, captain picks dict).

            # Phase 42 ACC-03: read form-signal gate from previous run's accuracy_backtest.json.
            # Default (False, 0.4) on cold start (file absent) or corrupt JSON — preserves baseline.
            # BT-02/exp05 SHIP: blend validated at alpha=0.2/window=4 (val top10
            # 5.18->5.45, captain 50->60%) — cold-start default is now ON at the
            # validated alpha (2026-07 system audit). A FRESH in-season summary
            # can still disable it if live evidence degrades.
            form_signal_enabled = True
            blend_alpha_used = accuracy.BLEND_ALPHA
            xmins_v2_enabled = False  # Phase 52 D-02 — default OFF; flips ON after non-regression shadow run
            bonus_predictor_enabled = True   # Phase 53 BPS-01 — permanently ON (BPS-01 hard-enable; override block removed; accuracy.py still writes flag for telemetry)
            save_predictor_enabled = False  # Phase 83 GK-03 — default OFF; flips ON after >=5-GW non-regression shadow run
            MC_ENABLED = True  # Phase 102 MC-01 — permanent ON; surfaces 10k-sim MC fields in merged_players.json
            mc_enabled = MC_ENABLED  # Phase 109 CR-02: set before try so corrupt cache never silently disables MC
            form_window_gws_used = accuracy.FORM_WINDOW_GWS  # TUNE-01: default
            cs_prob_base_used    = 0.40    # TUNE-01: default
            cs_prob_slope_used   = 0.30    # TUNE-01: default
            form_actual_beta_used = accuracy.FORM_ACTUAL_BETA  # FRM-01: default
            form_difficulty_gamma_used = accuracy.FORM_DIFFICULTY_GAMMA  # FRM-02: default
            sub_appear_window_gws_used = accuracy.SUB_APPEAR_WINDOW_GWS  # APM-01: default
            cs_team_form_slope_used    = accuracy.CS_TEAM_FORM_SLOPE      # CSF-01: default
            cs_def_form_window_gws_used = accuracy.CS_DEF_FORM_WINDOW_GWS  # CSF-01: default
            atf_slope_used      = accuracy.ATF_SLOPE       # ATF-01: default
            atf_window_gws_used = accuracy.ATF_WINDOW_GWS  # ATF-01: default
            fas_slope_used      = accuracy.FAS_SLOPE       # FAS-01: default
            defcon_scale_used   = accuracy.DEFCON_SCALE    # DC-01: default
            backtest_path = os.path.join(cache_dir, 'accuracy_backtest.json')
            try:
                with open(backtest_path, 'r', encoding='utf-8') as f:
                    prev_backtest = json.load(f)
                # Season-staleness guard (2026-07 audit): a summary whose covered
                # GWs exceed the CURRENT season's finished count is from a previous
                # season (the May-2026 cache was silently forcing form OFF at
                # alpha 0.4 all through the BT-02 era). Stale -> keep validated
                # defaults instead of consuming it.
                _summary_gws = [g.get('gw', 0) for g in
                                prev_backtest.get('summary', {}).get('gws', [])]
                if _summary_gws and min(_summary_gws) > finished_gws:
                    print(f"accuracy_backtest.json summary covers GW{min(_summary_gws)}-"
                          f"{max(_summary_gws)} but only {finished_gws} GWs are finished "
                          f"this season — stale (previous season); using validated defaults.")
                    raise FileNotFoundError('stale prior-season summary')
                form_signal_enabled = prev_backtest.get('summary', {}).get('form_signal_enabled', True)
                blend_alpha_used = prev_backtest.get('summary', {}).get('blend_alpha_used', accuracy.BLEND_ALPHA)
                xmins_v2_enabled = prev_backtest.get('summary', {}).get('xmins_v2_enabled', False)
                save_predictor_enabled = prev_backtest.get('summary', {}).get('save_predictor_enabled', False)
                form_window_gws_used = int(prev_backtest.get('summary', {}).get('form_window_gws_used', accuracy.FORM_WINDOW_GWS))
                cs_prob_base_used    = float(prev_backtest.get('summary', {}).get('cs_prob_base_used', 0.40))
                cs_prob_slope_used   = float(prev_backtest.get('summary', {}).get('cs_prob_slope_used', 0.30))
                form_actual_beta_used = float(prev_backtest.get('summary', {}).get('form_actual_beta_used', accuracy.FORM_ACTUAL_BETA))
                form_difficulty_gamma_used = float(prev_backtest.get('summary', {}).get('form_difficulty_gamma_used', accuracy.FORM_DIFFICULTY_GAMMA))  # FRM-02
                sub_appear_window_gws_used = int(prev_backtest.get('summary', {}).get('sub_appear_window_gws_used', accuracy.SUB_APPEAR_WINDOW_GWS))  # APM-01
                cs_team_form_slope_used    = float(prev_backtest.get('summary', {}).get(
                    'cs_team_form_slope_used', accuracy.CS_TEAM_FORM_SLOPE))     # CSF-01
                cs_def_form_window_gws_used = int(prev_backtest.get('summary', {}).get(
                    'cs_def_form_window_gws_used', accuracy.CS_DEF_FORM_WINDOW_GWS))  # CSF-01
                atf_slope_used      = float(prev_backtest.get('summary', {}).get(
                    'atf_slope_used', accuracy.ATF_SLOPE))         # ATF-01
                atf_window_gws_used = int(prev_backtest.get('summary', {}).get(
                    'atf_window_gws_used', accuracy.ATF_WINDOW_GWS))  # ATF-01
                fas_slope_used      = float(prev_backtest.get('summary', {}).get(
                    'fas_slope_used', accuracy.FAS_SLOPE))          # FAS-01
                defcon_scale_used   = float(prev_backtest.get('summary', {}).get(
                    'defcon_scale_used', accuracy.DEFCON_SCALE))    # DC-01
            except (FileNotFoundError, json.JSONDecodeError):
                pass

            print(f"Form signal blend: {'ENABLED' if form_signal_enabled else 'DISABLED'} (alpha={blend_alpha_used})")
            print(f"xMins v2 (mins_60_prob in _cs_prob): {'ENABLED' if xmins_v2_enabled else 'DISABLED'}")
            print(f"Bonus predictor (per-player EV): {'ENABLED' if bonus_predictor_enabled else 'DISABLED'}")
            print(f"Save predictor (GK Poisson-floor): {'ENABLED' if save_predictor_enabled else 'DISABLED'}")
            print(f"MC simulation (5-GW uncertainty bands): {'ENABLED' if mc_enabled else 'DISABLED'}")
            print(f"TUNE-01 params: form_window={form_window_gws_used}, cs_prob_base={cs_prob_base_used}, cs_prob_slope={cs_prob_slope_used}, form_actual_beta={form_actual_beta_used}, form_difficulty_gamma={form_difficulty_gamma_used}, sub_appear_window_gws={sub_appear_window_gws_used}, cs_team_form_slope={cs_team_form_slope_used}, cs_def_form_window_gws={cs_def_form_window_gws_used}, atf_slope={atf_slope_used}, atf_window_gws={atf_window_gws_used}, fas_slope={fas_slope_used}, defcon_scale={defcon_scale_used}")

            # COLD-01: build the cold-start prior once from the latest completed-season archive.
            # Non-fatal if the archive is absent → empty lookups → pure no-op.
            prior_lookup, bucket_priors, start_seed = _build_cold_start_prior()

            # Compute xmins stats (Phase 7 — MINS-01)
            print("Computing xmins stats...")
            # MIN-02: pass fixtures and next GW id for fixture-aware rotation risk.
            _next_gw_id = next(
                (e['id'] for e in bootstrap.get('events', []) if e.get('is_next')),
                None,
            )

            # AVAIL-01: structured injury availability (gap-fill). Shadow-first: when the flag
            # is off, attach info for inspection but DON'T let it change xmins.
            injury_lookup = None
            try:
                from injury_client import get_live_injuries
                from injury_join import build_injury_lookup, coverage_report
                # Season sweep, reduced to each team's latest matchday (2026-08-30):
                # FPL fixture ids are a foreign namespace to api-football, and
                # upcoming-date queries return empty until kickoff nears — both
                # produced a silent 0-record fetch every run.
                _injury_season = int((bootstrap.get('events') or [{}])[0]
                                     .get('deadline_time', '2026')[:4])
                _injury_records = get_live_injuries(season=_injury_season)
                _built = build_injury_lookup(_injury_records, bootstrap)
                for _el in bootstrap['elements']:
                    _info = _built.get(_el['id'])
                    if _info:
                        _el['apifootball_injury'] = _info   # attach for inspection regardless of flag
                # Observability (2026-08-28): a definitive per-run line — success
                # was previously silent and indistinguishable from a dead key.
                print(f"AVAIL-01: {len(_injury_records)} injury records -> "
                      f"{len(_built)} FPL players mapped (gate {'ON' if AVAIL_ENABLED else 'OFF'})")
                # Coverage report (2026-08-30): most unmatched records are players
                # outside FPL squads (youth/departed) and are correctly ignored,
                # but a real regular appearing here needs an
                # apifootball_id_map.json override — so name them in the log.
                _cov = coverage_report(_injury_records, bootstrap)
                if _cov['unmatched']:
                    print(f"AVAIL-01 coverage: {_cov['matched']} matched / "
                          f"{_cov['unmatched']} unmatched records; unmatched names: "
                          f"{', '.join(_cov['unmatched_names'][:40])}")
                if AVAIL_ENABLED:
                    injury_lookup = _built                  # active: feeds xmins
            except Exception as exc:
                print(f'AVAIL-01: injury layer unavailable this run ({exc}); continuing')
                injury_lookup = None

            xmins_stats = compute_xmins_stats(
                bootstrap, summaries, finished_gws,
                fixtures=fixtures,
                next_gw_id=_next_gw_id,
                sub_appear_window_gws=sub_appear_window_gws_used,   # APM-01
                start_seed=start_seed,                               # COLD-01
                injury_lookup=injury_lookup,                         # AVAIL-01
            )
            print(f"xmins stats: {len(xmins_stats)} players")

            # Compute bonus EV stats (Phase 53 BPS-01) — same shared summaries cache, no new HTTP calls
            print("Computing bonus EV stats...")
            bonus_stats = compute_bonus_predictions(bootstrap, summaries, finished_gws)
            print(f"bonus stats: {len(bonus_stats)} players")

            # ODDS-02: live pre-match odds -> ODDS-01 blend (exp09 SHIP, cs
            # weight 1.0). Non-fatal: no key / API down / no odds published yet
            # -> None and the model CS-prob runs unblended, exactly as before.
            odds_lookup = None
            if os.environ.get('ODDS_ENABLED', 'true').lower() in ('1', 'true', 'yes'):
                try:
                    from odds_live import get_live_odds_lookup
                    _season = int((bootstrap.get('events') or [{}])[0]
                                  .get('deadline_time', '2026')[:4])
                    odds_lookup = get_live_odds_lookup(bootstrap, fixtures, season=_season)
                    print(f"Live odds: {len(odds_lookup) // 2} fixture(s) priced.")
                except Exception as odds_exc:
                    print(f"[odds_live] non-fatal: {odds_exc}")

            merged, captain_picks = merge_players(
                bootstrap, fixtures, understat, id_map,
                xmins_stats=xmins_stats, summaries=summaries,
                form_signal_enabled=form_signal_enabled,
                blend_alpha=blend_alpha_used,
                xmins_v2_enabled=xmins_v2_enabled,
                bonus_stats=bonus_stats,
                bonus_predictor_enabled=bonus_predictor_enabled,
                save_predictor_enabled=save_predictor_enabled,   # Phase 83 GK-01 / GK-03
                cs_prob_base=cs_prob_base_used,        # TUNE-01
                cs_prob_slope=cs_prob_slope_used,      # TUNE-01
                form_window_gws=form_window_gws_used,  # TUNE-01
                form_actual_beta=form_actual_beta_used,  # FRM-01
                form_difficulty_gamma=form_difficulty_gamma_used, # FRM-02
                sub_appear_window_gws=sub_appear_window_gws_used,  # APM-01
                cs_team_form_slope=cs_team_form_slope_used,        # CSF-01
                cs_def_form_window_gws=cs_def_form_window_gws_used, # CSF-01
                atf_slope=atf_slope_used,       # ATF-01
                atf_window_gws=atf_window_gws_used,  # ATF-01
                fas_slope=fas_slope_used,       # FAS-01
                defcon_scale=defcon_scale_used, # DC-01
                prior_lookup=prior_lookup,      # COLD-01
                bucket_priors=bucket_priors,    # COLD-01
                odds_lookup=odds_lookup,        # ODDS-02 (live pre-match)
                odds_cs_weight=1.0 if odds_lookup else 0.0,  # exp09 SHIP weight
            )
            if mc_enabled:
                merged = compute_simulations(merged, xmins_v2_enabled,
                                             cs_prob_base=cs_prob_base_used,
                                             cs_prob_slope=cs_prob_slope_used)
            save('merged_players.json', merged)
            timestamps['merged_players.json'] = _dt_dh.now(_tz_dh.utc).isoformat()
            save('captain_picks.json', captain_picks)  # Phase 31 CAP-03/CAP-04

            # Phase 80 GWI-01 (D-02/D-03): rotation_risk flag per player from cup-fixture clash.
            merged = _apply_rotation_risk(merged, fixtures, EUROPEAN_CUP_DATES)
            save('merged_players.json', merged)  # re-save to persist rotation_risk field
            timestamps['merged_players.json'] = _dt_dh.now(_tz_dh.utc).isoformat()

            # Phase 84 SPQ-01 / SPQ-02: set-piece delivery quality.
            # Wrapped in try/except (mirrors prose_summary at line 325-367) so a 403
            # bot-protection or network failure cannot poison merged_players.json.
            # Initialise sp_unmatched_count BEFORE try (CONTEXT.md D-05 / Pitfall 2)
            # so the failure case never reaches compute_data_health() with a false 0.
            # Plan 02 (Phase 84) will extend the compute_data_health() call site below
            # to pass sp_unmatched_count once data_health.py adds the matching kwarg.
            try:
                from set_piece_quality import run_sp_quality
                sp_unmatched_count = run_sp_quality(understat, id_map, cache_dir)
                if sp_unmatched_count is not None:
                    print(f"SP quality written: {sp_unmatched_count} unmatched Understat IDs")
                else:
                    print("SP quality: returned None (scrape failed, stale sp_quality.json preserved)")
            except Exception as sp_exc:
                print(f"[set_piece_quality] non-fatal error: {sp_exc}", file=sys.stderr)

            # Phase 33 INS-02/03/04 — pattern statements with confidence weights
            insights = compute_insights(merged, bootstrap, fixtures, summaries, finished_gws)
            save('insights.json', insights)
            timestamps['insights.json'] = _dt_dh.now(_tz_dh.utc).isoformat()
            print(f"Insights computed: {len(insights)} pattern(s) emitted")

            # Phase 80 GWI-02/GWI-03/GWI-04 (D-05): GW-specific intelligence cards
            gw_intel = compute_gw_intel(
                merged, bootstrap, fixtures, summaries, finished_gws, EUROPEAN_CUP_DATES,
                cs_prob_base=cs_prob_base_used,
                cs_prob_slope=cs_prob_slope_used,
            )
            save('gw_intel.json', gw_intel)
            timestamps['gw_intel.json'] = _dt_dh.now(_tz_dh.utc).isoformat()
            print(f"GW intel computed: {len(gw_intel.get('cards', []))} card(s) emitted")

            # SP-02: Set-piece snapshot diff
            print("Computing set-piece snapshot diff...")
            curr_snapshot = _extract_sp_snapshot(merged)

            # Read previous snapshot (first run: empty dict)
            sp_snapshot_path = os.path.join(cache_dir, 'set_pieces_snapshot.json')
            prev_snapshot = {}
            try:
                with open(sp_snapshot_path, 'r', encoding='utf-8') as f:
                    prev_snapshot = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                pass

            sp_changes = _diff_sp_snapshots(prev_snapshot, curr_snapshot, bootstrap)
            save('set_piece_changes.json', sp_changes)
            save('set_pieces_snapshot.json', curr_snapshot)
            print(f"Set-piece changes: {sp_changes['change_count']} change(s)")

            # PGW-02: GW review writer (Phase 73 D-01, D-10)
            # Sliding window of last 3 finished GWs; overwritten each daily run.
            # Writes global data only (gw, average_score) — team-specific data is
            # computed on-demand by /api/gw-review.
            print("Computing GW review files...")
            finished_events = [e for e in bootstrap.get('events', []) if e.get('finished')]
            last_3_gws = sorted(finished_events, key=lambda e: e['id'])[-3:]
            for event in last_3_gws:
                gw_data = {
                    'gw': event['id'],
                    'average_score': event.get('average_entry_score') or 0,
                }
                save(f'gw_review_gw{event["id"]}.json', gw_data)
            print(f"GW review files written: {[e['id'] for e in last_3_gws]}")

            # Compute DefCon stats from element-summary history (Phase 4)
            print("Computing DefCon stats...")
            from merge import _compute_difficulty_scores
            difficulty_scores = _compute_difficulty_scores(bootstrap, fixtures)
            defcon_stats = compute_defcon_stats(bootstrap, difficulty_scores, summaries)
            save('defcon_stats.json', defcon_stats)
            print(f"DefCon stats: {len(defcon_stats)} players analysed")

            # Phase 40 / ACC-01: Accuracy backtest + predictions snapshot
            print("Computing accuracy backtest...")
            # Phase 109 MC-CAL-01 / D-01: build haul_prob lookup from current merged list.
            # merged already has haul_prob populated (MC_ENABLED=True since Phase 102).
            haul_lookup = {p['id']: p['haul_prob'] for p in merged if p.get('haul_prob') is not None}
            print(f"MC haul_prob coverage: {len(haul_lookup)}/{len(merged)} players ({100*len(haul_lookup)//max(len(merged),1)}%)")
            backtest_data = compute_accuracy_backtest(
                summaries, finished_gws, bootstrap, fixtures,
                cache_dir=cache_dir,
                merged_haul_lookup=haul_lookup,
                blend_alpha=blend_alpha_used,
                form_window_gws=form_window_gws_used,  # TUNE-01
                cs_prob_base=cs_prob_base_used,        # TUNE-01
                cs_prob_slope=cs_prob_slope_used,      # TUNE-01
            )
            # TUNE-01: run coordinate descent tuner and merge result into backtest
            try:
                from tune import run_tuner
                tuner_result = run_tuner(
                    summaries, finished_gws, bootstrap, fixtures, cache_dir=cache_dir
                )
                backtest_data['tuner'] = tuner_result
                # Promote any improved parameters into summary for next run
                if not tuner_result.get('skipped') and 'promoted_params' in tuner_result:
                    pp = tuner_result['promoted_params']
                    backtest_data['summary']['blend_alpha_used']     = pp['blend_alpha']
                    backtest_data['summary']['form_window_gws_used'] = pp['form_window_gws']
                    backtest_data['summary']['cs_prob_base_used']    = pp['cs_prob_base']
                    backtest_data['summary']['cs_prob_slope_used']   = pp['cs_prob_slope']
                    backtest_data['summary']['form_actual_beta_used'] = pp['form_actual_beta']
                    backtest_data['summary']['form_difficulty_gamma_used'] = pp['form_difficulty_gamma']  # FRM-02
                    backtest_data['summary']['sub_appear_window_gws_used'] = pp['sub_appear_window_gws']  # APM-01
                    backtest_data['summary']['cs_team_form_slope_used']    = pp['cs_team_form_slope']     # CSF-01
                    backtest_data['summary']['cs_def_form_window_gws_used'] = pp['cs_def_form_window_gws'] # CSF-01
                    backtest_data['summary']['atf_slope_used']      = pp['atf_slope']      # ATF-01
                    backtest_data['summary']['atf_window_gws_used'] = pp['atf_window_gws'] # ATF-01
                    backtest_data['summary']['fas_slope_used']      = pp['fas_slope']      # FAS-01
                    backtest_data['summary']['defcon_scale_used']   = pp['defcon_scale']   # DC-01
                    print(f"[tune] params: blend_alpha={pp['blend_alpha']}, "
                          f"form_window={pp['form_window_gws']}, "
                          f"cs_prob_base={pp['cs_prob_base']}, "
                          f"cs_prob_slope={pp['cs_prob_slope']}, "
                          f"form_actual_beta={pp['form_actual_beta']}, "
                          f"form_difficulty_gamma={pp['form_difficulty_gamma']}, "
                          f"sub_appear_window_gws={pp['sub_appear_window_gws']}, "
                          f"cs_team_form_slope={pp['cs_team_form_slope']}, "
                          f"cs_def_form_window_gws={pp['cs_def_form_window_gws']}, "
                          f"atf_slope={pp['atf_slope']}, atf_window_gws={pp['atf_window_gws']}, "
                          f"fas_slope={pp['fas_slope']}, defcon_scale={pp['defcon_scale']}")
            except Exception as tune_exc:
                print(f'[tune] non-fatal error: {tune_exc}', file=sys.stderr)
            # PICK-01: honest pick-quality metrics (non-fatal)
            try:
                _tune_params_for_picks = {
                    'blend_alpha': blend_alpha_used,
                    'form_window_gws': form_window_gws_used,
                    'cs_prob_base': cs_prob_base_used,
                    'cs_prob_slope': cs_prob_slope_used,
                    'cs_team_form_slope': cs_team_form_slope_used,
                    'cs_def_form_window_gws': cs_def_form_window_gws_used,
                    'atf_slope': atf_slope_used,
                    'atf_window_gws': atf_window_gws_used,
                    'fas_slope': fas_slope_used,
                    'defcon_scale': defcon_scale_used,
                }
                _hm = compute_honest_metrics(bootstrap, fixtures, summaries, _tune_params_for_picks)
                if _hm is not None:
                    backtest_data['summary']['honest_metrics'] = _hm
                    print(f"[picks] honest metrics over {_hm['n_gws']} GWs: top10={_hm['top10_mean_pts']}")
            except Exception as exc:
                print(f"[pipeline] honest metrics failed (non-fatal): {exc}", file=sys.stderr)
            save('accuracy_backtest.json', backtest_data)
            timestamps['accuracy_backtest.json'] = _dt_dh.now(_tz_dh.utc).isoformat()
            print(f"Accuracy backtest: {len(backtest_data.get('gws_covered', []))} GWs covered, "
                  f"{len(backtest_data.get('haulters', []))} haulter entries")

            # D-11/D-12: Predictions snapshot for the current GW
            # current_gw = next GW (i.e., finished_gws + 1) so the snapshot represents
            # the predictions made BEFORE that GW is played
            current_gw = finished_gws + 1
            print(f"Writing predictions snapshot for GW {current_gw}...")
            snapshot_data = build_predictions_snapshot(merged, current_gw)
            save('predictions_snapshot.json', snapshot_data)

            # Blob accumulation (D-12): per-GW named copy so multiple snapshots survive
            if os.getenv('USE_BLOB', '').lower() == 'true':
                from upload import upload_json
                upload_json(f'predictions_snapshot_gw{current_gw}.json', snapshot_data)
                print(f"Predictions snapshot uploaded to Blob: predictions_snapshot_gw{current_gw}.json")

            # Phase 96 BACK-01: per-GW captain snapshot side-write — decision evidence
            # that cannot drift retrospectively. captain_picks is in scope from merge above.
            from captain_snapshots import write_captain_snapshot
            write_captain_snapshot(captain_picks, current_gw)

            # Phase 113 BACK-02: per-GW slim player snapshot side-write.
            # merged is in scope from merge_players() above. current_gw is set at pipeline start.
            from transfer_snapshots import write_transfer_slim_snapshot
            write_transfer_slim_snapshot(merged, current_gw)

            # DEC-02: per-GW decision ledger — freezes the model's XI, bench,
            # captain policy variants and chip signals at decision time, so
            # next season's DECISIONS (not just predictions) are backtestable.
            from decision_ledger import build_decision_ledger, write_decision_ledger
            ledger = build_decision_ledger(merged, captain_picks, current_gw)
            save('decision_ledger.json', ledger)
            write_decision_ledger(ledger, current_gw)

            # CHP-01: chip advisor — is this the GW to play BB/TC/FH? Values
            # come from the just-written decision ledger; DGW/BGW from fixtures.
            try:
                from chip_advisor import build_chip_advice
                chip_advice = build_chip_advice(merged, ledger, current_gw)
                save('chip_advice.json', chip_advice)
                if os.getenv('USE_BLOB', '').lower() == 'true':
                    from upload import upload_json
                    upload_json(f'chip_advice_gw{current_gw}.json', chip_advice)
                print("Chip advice written.")
            except Exception as chip_exc:
                print(f"[chip_advisor] non-fatal error: {chip_exc}", file=sys.stderr)

            # TRF-01: transfer advisor — model-squad trajectory + this GW's best
            # swaps (exp14: +136 pts vs hold, +197 vs placebo on 2025/26).
            # Non-fatal by design: an advisor failure must not poison the run.
            try:
                from datetime import datetime as _dt, timezone as _tz
                from transfer_advisor import (advance_and_advise,
                                              load_advisor_state,
                                              merged_to_candidates)
                adv_state = load_advisor_state(cache_dir)
                adv_state, advice = advance_and_advise(
                    adv_state, merged_to_candidates(merged), current_gw)
                advice_doc = {
                    'gw': current_gw,
                    'generated_at': _dt.now(_tz.utc).isoformat(timespec='seconds'),
                    **advice,
                }
                save('transfer_advisor_state.json', adv_state)
                save('transfer_advice.json', advice_doc)
                if os.getenv('USE_BLOB', '').lower() == 'true':
                    from upload import upload_json
                    upload_json(f'transfer_advice_gw{current_gw}.json', advice_doc)
                print(f"Transfer advice written: {len(advice['moves'])} move(s), "
                      f"net {advice['net_gain']:+.1f}.")
            except Exception as adv_exc:
                print(f"[transfer_advisor] non-fatal error: {adv_exc}", file=sys.stderr)

            # Phase 67 NLP-01/NLP-02 — LLM prose summary (Claude call; guardrail-protected).
            # Pitfall 8: a Claude failure must NOT poison the rest of the pipeline.
            print("Generating weekly prose summary...")
            try:
                from prose_summary import generate_weekly_summary
                from gw_intel import _detect_dgw_bgw
                # Top-3 captains: highest xPts_1gw excluding GKs (element_type==1)
                captains_top3 = sorted(
                    [p for p in merged if p.get('xPts_1gw') is not None and p.get('xPts_1gw') > 0 and p.get('element_type') != 1],
                    key=lambda p: p.get('xPts_1gw') if p.get('xPts_1gw') is not None else 0,
                    reverse=True,
                )[:3]
                cap_payload = [
                    {
                        'name': p.get('web_name'),
                        'team': p.get('team_short_name', ''),
                        'xPts_1gw': p.get('xPts_1gw'),
                        'chance_of_playing_next_round': p.get('chance_of_playing_next_round'),
                        'news': p.get('news', ''),
                    }
                    for p in captains_top3
                ]
                cap_ids = {p['id'] for p in captains_top3}
                # Top-3 differential gems: ownership < 15.0, xPts_1gw > 0, exclude already-picked captains
                gems_top3 = sorted(
                    [
                        p for p in merged
                        if p.get('xPts_1gw') is not None and p.get('xPts_1gw') > 0
                        and float(p.get('selected_by_percent') or 0) < 15.0
                        and p.get('id') not in cap_ids
                    ],
                    key=lambda p: p.get('xPts_1gw') if p.get('xPts_1gw') is not None else 0,
                    reverse=True,
                )[:3]
                gem_payload = [
                    {
                        'name': p.get('web_name'),
                        'team': p.get('team_short_name', ''),
                        'xPts_1gw': p.get('xPts_1gw'),
                        'chance_of_playing_next_round': p.get('chance_of_playing_next_round'),
                        'news': p.get('news', ''),
                    }
                    for p in gems_top3
                ]
                dgw_bgw_map = _detect_dgw_bgw(merged, current_gw)
                team_short_by_id = {}
                for p in merged:
                    tid = p.get('team')
                    if tid is not None and tid not in team_short_by_id:
                        team_short_by_id[tid] = p.get('team_short_name', '')
                dgw_team_names = [
                    team_short_by_id[tid]
                    for tid, kind in dgw_bgw_map.items()
                    if kind == 'dgw' and team_short_by_id.get(tid)
                ]
                corpus = [p.get('web_name') for p in merged if p.get('web_name')]
                summary = generate_weekly_summary(
                    captains=cap_payload,
                    gems=gem_payload,
                    player_corpus=corpus,
                    gameweek=current_gw,
                    dgw_teams=dgw_team_names,
                )
                if summary is not None:
                    save('weekly_summary.json', summary)
                    print(f"Weekly summary written: GW {summary.get('gw')}")
                else:
                    print("Weekly summary skipped (missing key or guardrail rejection)")
            except Exception as exc:
                print(f"[prose_summary] non-fatal error: {exc}", file=sys.stderr)

            # Phase 108 NLP-BATCH-01/02/03 — batch pre-generation of player insights.
            # Non-fatal: a batch failure must never block last_updated.json or data_health writes.
            # Batch gate defaults to off; production must explicitly set env var to 'true'
            # after first verified local run (see plan 108-02 user_setup for details).
            if os.getenv('INSIGHT_BATCH_ENABLED', '').lower() == 'true':
                try:
                    from batch_insights import generate_batch_insights
                    BATCH_TOP_N = 20
                    eligible = [p for p in merged if p.get('status') == 'a' and p.get('xPts_1gw') is not None]
                    top20 = sorted(
                        eligible,
                        key=lambda p: (p.get('xPts_1gw') or 0, float(p.get('selected_by_percent') or 0)),
                        reverse=True,
                    )[:BATCH_TOP_N]
                    corpus = [p.get('web_name') for p in merged if p.get('web_name')]
                    result = generate_batch_insights(top20, corpus, current_gw)
                    print(f"Batch insights: {result['written']} written, {result['skipped']} skipped (GW {current_gw})")
                except Exception as exc:
                    print(f"[batch_insights] non-fatal error: {exc}", file=sys.stderr)

        else:
            # IS_OFF_SEASON=True — no current GW; skip all GW-dependent pipeline steps.
            # D-06: exactly one print per skipped step, verbatim format.
            _off_enabled = _offseason_projection_enabled()
            _pl, _bp, _ss = _build_cold_start_prior()
            if _off_enabled and _pl:
                print("[pipeline] IS_OFF_SEASON: cold-start projection ENABLED")
                merged, captain_picks = _offseason_merge(bootstrap, fixtures, id_map, _pl, _bp, _ss)
                save('merged_players.json', merged)
                timestamps['merged_players.json'] = _dt_dh.now(_tz_dh.utc).isoformat()
                save('captain_picks.json', captain_picks)
                print(f"[pipeline] off-season projection: {len(merged)} players merged")
            else:
                print("[pipeline] IS_OFF_SEASON: skipping merge (cold-start disabled or no archive)")
            print("[pipeline] IS_OFF_SEASON: skipping bonus")
            print("[pipeline] IS_OFF_SEASON: skipping mc_simulations")
            print("[pipeline] IS_OFF_SEASON: skipping rotation_risk")
            print("[pipeline] IS_OFF_SEASON: skipping set_piece_quality")
            print("[pipeline] IS_OFF_SEASON: skipping insights")
            print("[pipeline] IS_OFF_SEASON: skipping gw_intel")
            print("[pipeline] IS_OFF_SEASON: skipping gw_review")
            print("[pipeline] IS_OFF_SEASON: skipping defcon")
            print("[pipeline] IS_OFF_SEASON: skipping captain_snapshots")
            print("[pipeline] IS_OFF_SEASON: skipping dgw_bgw")

        # PRC-01: Price-change snapshot and predictions — year-round (off-season pre-prep).
        print("Computing price change predictions...")
        pc_snapshot_path = os.path.join(cache_dir, 'price_changes_snapshot.json')
        prev_pc_snapshot = {}
        try:
            with open(pc_snapshot_path, 'r', encoding='utf-8') as f:
                prev_pc_snapshot = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            pass

        pc_predictions, curr_pc_snapshot = compute_price_change_predictions(bootstrap, prev_pc_snapshot)
        save('price_changes.json', pc_predictions)
        save('price_changes_snapshot.json', curr_pc_snapshot)
        print(f"Price change predictions: {len(pc_predictions.get('predictions', []))} player(s) with direction signal")

        # Write last_updated.json with success metadata
        from datetime import datetime, timezone
        timestamp = datetime.now(timezone.utc).isoformat()

        player_count = len(bootstrap.get('elements', []))
        team_count = len(bootstrap.get('teams', []))
        fixture_count = len(fixtures)

        last_updated = {
            'last_updated': timestamp,
            'stale': False,
            'source': source,
            'player_count': player_count,
            'team_count': team_count,
            'fixture_count': fixture_count,
            'merged_count': len(merged),
        }
        save('last_updated.json', last_updated)
        timestamps['last_updated.json'] = _dt_dh.now(_tz_dh.utc).isoformat()

        print(f"Pipeline complete: {player_count} players, {team_count} teams, {fixture_count} fixtures, {len(merged)} merged")

        # DH-01: data_health.json is the LAST artifact written (after every other save()).
        # Wrapped in nested try/except (mirrors prose_summary at line 351) so a compute
        # error cannot poison run.py and falsely mark last_updated.json as stale (Pitfall 1).
        try:
            from data_health import compute_data_health
            compute_data_health(merged, timestamps, cache_dir, pipeline_stale=False,
                                sp_unmatched_count=sp_unmatched_count)
            print("Data health written.")
        except Exception as dh_exc:
            print(f"[data_health] non-fatal error: {dh_exc}", file=sys.stderr)

        # Phase 135: push notifications (non-fatal — never break the pipeline)
        try:
            from notify import run_notify  # noqa: PLC0415
            run_notify(cache_dir=cache_dir)
        except Exception as _notify_exc:
            print(f'[notify] non-fatal error: {_notify_exc}', file=sys.stderr)

    except Exception as exc:
        # Stale-cache fallback (per D-06): preserve prior cache, mark as stale
        print(f"Pipeline error: {exc}", file=sys.stderr)

        from datetime import datetime, timezone
        timestamp = datetime.now(timezone.utc).isoformat()

        last_updated_path = os.path.join(cache_dir, 'last_updated.json')

        if os.path.exists(last_updated_path):
            # Read existing last_updated.json and overwrite stale fields
            try:
                with open(last_updated_path, 'r', encoding='utf-8') as f:
                    last_updated = json.load(f)
            except Exception as read_exc:
                print(f"[run] warning: could not read prior last_updated.json: {read_exc}", file=sys.stderr)
                last_updated = {'last_updated': timestamp, 'source': source}

            last_updated['stale'] = True
            last_updated['error_message'] = _sanitize_error(exc)
        else:
            # First-ever run failed — write minimal stale record
            last_updated = {
                'last_updated': timestamp,
                'stale': True,
                'source': source,
                'error_message': _sanitize_error(exc),
            }

        # Always write stale record locally (Blob may be unavailable)
        os.makedirs(cache_dir, exist_ok=True)
        with open(last_updated_path, 'w', encoding='utf-8') as f:
            json.dump(last_updated, f, indent=2, ensure_ascii=False)

        sys.exit(1)


if __name__ == '__main__':
    dry_run = '--dry-run' in sys.argv
    run(dry_run=dry_run)
