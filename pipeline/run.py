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
from accuracy import compute_accuracy_backtest, build_predictions_snapshot
from data_health import _sanitize_error


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

        # Count finished gameweeks for xmins start_rate fallback
        finished_gws = sum(1 for e in bootstrap.get('events', []) if e.get('finished'))

        # Compute xmins stats (Phase 7 — MINS-01)
        print("Computing xmins stats...")
        xmins_stats = compute_xmins_stats(bootstrap, summaries, finished_gws)
        print(f"xmins stats: {len(xmins_stats)} players")

        # Compute bonus EV stats (Phase 53 BPS-01) — same shared summaries cache, no new HTTP calls
        print("Computing bonus EV stats...")
        bonus_stats = compute_bonus_predictions(bootstrap, summaries, finished_gws)
        print(f"bonus stats: {len(bonus_stats)} players")

        # Merge FPL + Understat data (per-90 normalisation, custom FDR, fixtures)
        # Phase 31: merge_players now returns a tuple — (player list, captain picks dict).

        # Phase 42 ACC-03: read form-signal gate from previous run's accuracy_backtest.json.
        # Default (False, 0.4) on cold start (file absent) or corrupt JSON — preserves baseline.
        form_signal_enabled = False
        blend_alpha_used = 0.4
        xmins_v2_enabled = False  # Phase 52 D-02 — default OFF; flips ON after non-regression shadow run
        bonus_predictor_enabled = False  # Phase 53 BPS-01 — default OFF; flips ON after non-regression shadow run
        save_predictor_enabled = False  # Phase 83 GK-03 — default OFF; flips ON after >=5-GW non-regression shadow run
        backtest_path = os.path.join(cache_dir, 'accuracy_backtest.json')
        try:
            with open(backtest_path, 'r', encoding='utf-8') as f:
                prev_backtest = json.load(f)
            form_signal_enabled = prev_backtest.get('summary', {}).get('form_signal_enabled', False)
            blend_alpha_used = prev_backtest.get('summary', {}).get('blend_alpha_used', 0.4)
            xmins_v2_enabled = prev_backtest.get('summary', {}).get('xmins_v2_enabled', False)
            bonus_predictor_enabled = prev_backtest.get('summary', {}).get('bonus_predictor_enabled', False)
            save_predictor_enabled = prev_backtest.get('summary', {}).get('save_predictor_enabled', False)
        except (FileNotFoundError, json.JSONDecodeError):
            pass

        print(f"Form signal blend: {'ENABLED' if form_signal_enabled else 'DISABLED'} (alpha={blend_alpha_used})")
        print(f"xMins v2 (mins_60_prob in _cs_prob): {'ENABLED' if xmins_v2_enabled else 'DISABLED'}")
        print(f"Bonus predictor (per-player EV): {'ENABLED' if bonus_predictor_enabled else 'DISABLED'}")
        print(f"Save predictor (GK Poisson-floor): {'ENABLED' if save_predictor_enabled else 'DISABLED'}")

        merged, captain_picks = merge_players(
            bootstrap, fixtures, understat, id_map,
            xmins_stats=xmins_stats, summaries=summaries,
            form_signal_enabled=form_signal_enabled,
            blend_alpha=blend_alpha_used,
            xmins_v2_enabled=xmins_v2_enabled,
            bonus_stats=bonus_stats,
            bonus_predictor_enabled=bonus_predictor_enabled,
            save_predictor_enabled=save_predictor_enabled,   # Phase 83 GK-01 / GK-03
        )
        merged = compute_simulations(merged, xmins_v2_enabled)
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
        sp_unmatched_count = None
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
            merged, bootstrap, fixtures, summaries, finished_gws, EUROPEAN_CUP_DATES
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

        # PRC-01: Price-change snapshot and predictions
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
        backtest_data = compute_accuracy_backtest(summaries, finished_gws, bootstrap, fixtures, cache_dir=cache_dir)
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

        # Phase 67 NLP-01/NLP-02 — LLM prose summary (Claude call; guardrail-protected).
        # Pitfall 8: a Claude failure must NOT poison the rest of the pipeline.
        print("Generating weekly prose summary...")
        try:
            from prose_summary import generate_weekly_summary
            # Top-3 captains: highest xPts_1gw excluding GKs (element_type==1)
            captains_top3 = sorted(
                [p for p in merged if p.get('xPts_1gw') is not None and p.get('xPts_1gw') > 0 and p.get('element_type') != 1],
                key=lambda p: p.get('xPts_1gw') if p.get('xPts_1gw') is not None else 0,
                reverse=True,
            )[:3]
            cap_payload = [
                {'name': p.get('web_name'), 'team': p.get('team_short_name', ''), 'xPts_1gw': p.get('xPts_1gw')}
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
                {'name': p.get('web_name'), 'team': p.get('team_short_name', ''), 'xPts_1gw': p.get('xPts_1gw')}
                for p in gems_top3
            ]
            corpus = [p.get('web_name') for p in merged if p.get('web_name')]
            summary = generate_weekly_summary(
                captains=cap_payload,
                gems=gem_payload,
                player_corpus=corpus,
                gameweek=current_gw,
            )
            if summary is not None:
                save('weekly_summary.json', summary)
                print(f"Weekly summary written: GW {summary.get('gw')}")
            else:
                print("Weekly summary skipped (missing key or guardrail rejection)")
        except Exception as exc:
            import sys
            print(f"[prose_summary] non-fatal error: {exc}", file=sys.stderr)

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
