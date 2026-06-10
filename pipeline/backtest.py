"""BT-02: leakage-free full-season backtest harness.

Offline lab over the SA-01 season archive. For each target GW, every model
input is reconstructed strictly from rounds BEFORE that GW — unlike
accuracy.py's backtest, which feeds the target GW's own xG and minutes into
its "prediction" (contemporaneous leakage).

Modes:
  deploy      — minutes predicted from prior rounds (deadline-day reality)
  conditional — target GW's actual minutes (isolates rate-model quality;
                per-90s remain strictly prior)

Usage:
  python backtest.py [--mode deploy|conditional] [--first-gw 7] [--last-gw 38]
                     [--set key=value ...] [--json out.json]

Public API:
  run_backtest(archive=None, params=None, mode='deploy',
               first_gw=7, last_gw=38) -> dict
  build_asof_signals(history, gw, params) -> dict | None
  compute_metrics(rows) -> (metrics: dict, per_gw: list)

Does NOT modify the live pipeline (accuracy.py / tune.py / run.py / merge.py).
"""
import argparse
import json
import math
import sys
from collections import defaultdict

DEFAULT_PARAMS = {
    # Mirrors live-model deployed behaviour (form gate OFF -> blend_alpha 0).
    'blend_alpha': 0.0,
    'form_window_gws': 5,
    'cs_prob_base': 0.40,
    'cs_prob_slope': 0.30,
    'cs_team_form_slope': 0.0,
    'cs_def_form_window_gws': 6,
    'atf_slope': 0.0,
    'atf_window_gws': 6,
    # BT-02-local
    'min_prior_minutes': 270,
    'xmins_window': 5,
    'defcon_scale': 0.0,        # 0.0 = off (backward compat); 1.0 = full 2-pt EV
    'fixture_attack_slope': 0.0,  # BT-02: opponent difficulty scaling of attacking EV
    'use_xgc_def_form': 0.0,    # BT-02: use xGC-based team defence instead of goals-conceded
    'xmins_halflife': 0.0,      # 0.0 = off; > 0 = exponential weighting halflife (GWs)
    'gk_saves_scale': 0.0,      # 0.0 = off; > 0 = GKP save-point EV scaling
}

HAUL_THRESHOLD = 10
TOP_N = 10
TOP_N_CAPTURE = 20
MID_TOP_N = 30
MIN_FORM_MINUTES = 90


def build_team_xgc_lookup(archive: dict, window_gws: int = 6) -> dict:
    """(gw, team_id) -> normalised prior rolling team xGC (0=best defence, 1=worst).

    Team-match xGC = max expected_goals_conceded across that team's players'
    entries for each (gw, fixture) — the max is carried by a full-match player.
    Strictly prior (g < gw), min-max normalised per GW, 0.5 cold-start —
    same conventions as accuracy.build_team_def_form_lookup.
    """
    fixtures = archive['fixtures']
    fixtures_by_id = {f['id']: f for f in fixtures}

    # First pass: collect team_match_xgc[(team_id, gw, fixture_id)] = max xgc
    team_match_xgc: dict = {}
    for pid, summary in archive['summaries'].items():
        for entry in summary.get('history', []):
            fix_id = entry.get('fixture')
            fix = fixtures_by_id.get(fix_id)
            if fix is None:
                continue
            gw = entry.get('round')
            if gw is None:
                continue
            was_home = bool(entry.get('was_home'))
            team_id = fix['team_h'] if was_home else fix['team_a']
            xgc_val = float(entry.get('expected_goals_conceded') or 0)
            key = (team_id, gw, fix_id)
            if key not in team_match_xgc or xgc_val > team_match_xgc[key]:
                team_match_xgc[key] = xgc_val

    # Build per-team chronological list of (gw, xgc)
    team_history: dict = defaultdict(list)
    for (team_id, gw, _fix_id), xgc_val in team_match_xgc.items():
        team_history[team_id].append((gw, xgc_val))
    # Sort each team's history by gw
    for team_id in team_history:
        team_history[team_id].sort(key=lambda x: x[0])

    # Identify every (gw, team_id) pair from fixtures
    gw_team_pairs = set()
    for fix in fixtures:
        gw = fix.get('event')
        if gw is None:
            continue
        gw_team_pairs.add((gw, fix['team_h']))
        gw_team_pairs.add((gw, fix['team_a']))

    # Compute raw rolling mean xGC strictly prior to each GW
    raw_by_gw: dict = defaultdict(dict)
    for gw, team_id in gw_team_pairs:
        history = team_history.get(team_id, [])
        prior = [(g, xgc) for g, xgc in history if g < gw]
        last_n = prior[-window_gws:]
        if not last_n:
            raw_by_gw[gw][team_id] = None  # cold start sentinel
        else:
            raw_by_gw[gw][team_id] = sum(xgc for _, xgc in last_n) / len(last_n)

    # Min-max normalise per GW; 0.5 for cold-start and all-equal
    lookup: dict = {}
    for gw, team_rates in raw_by_gw.items():
        known = {t: r for t, r in team_rates.items() if r is not None}
        if not known:
            for t in team_rates:
                lookup[(gw, t)] = 0.5
            continue
        min_xgc = min(known.values())
        max_xgc = max(known.values())
        denom = max_xgc - min_xgc
        for t, rate in team_rates.items():
            if rate is None:
                lookup[(gw, t)] = 0.5
            elif denom > 1e-6:
                lookup[(gw, t)] = (rate - min_xgc) / denom
            else:
                lookup[(gw, t)] = 0.5
    return lookup


def build_asof_signals(history: list, gw: int, params: dict):
    """Point-in-time signals for one player at target GW `gw`.

    Uses ONLY history entries with round < gw. Returns None when there are no
    prior entries. Eligibility (min_prior_minutes) is enforced by the caller
    so tests and experiments can inspect sub-threshold signals.

    Ordering assumption: `history` is expected to be in ascending round order.
    The FPL element-summary endpoint serves entries chronologically, and this
    has been verified across the real season archive. The xmins-window and
    form-window logic both rely on `prior[-n:]` selecting the most recent n
    entries, so out-of-order input would silently produce wrong signals.
    """
    prior = [e for e in history if e.get('round', 0) < gw]
    if not prior:
        return None

    cum_minutes = sum(e.get('minutes', 0) or 0 for e in prior)
    cum_xg = sum(float(e.get('expected_goals', 0) or 0) for e in prior)
    cum_xa = sum(float(e.get('expected_assists', 0) or 0) for e in prior)

    if cum_minutes > 0:
        season_xg90 = cum_xg / cum_minutes * 90.0
        season_xa90 = cum_xa / cum_minutes * 90.0
    else:
        season_xg90 = season_xa90 = 0.0

    # Form: last form_window_gws prior entries actually played
    alpha = params['blend_alpha']
    xg_per90, xa_per90 = season_xg90, season_xa90
    if alpha > 0:
        played = [e for e in prior if (e.get('minutes', 0) or 0) > 0]
        window = played[-params['form_window_gws']:]
        form_min = sum(e.get('minutes', 0) or 0 for e in window)
        if form_min >= MIN_FORM_MINUTES:
            form_xg90 = sum(float(e.get('expected_goals', 0) or 0)
                            for e in window) / form_min * 90.0
            form_xa90 = sum(float(e.get('expected_assists', 0) or 0)
                            for e in window) / form_min * 90.0
            xg_per90 = (1 - alpha) * season_xg90 + alpha * form_xg90
            xa_per90 = (1 - alpha) * season_xa90 + alpha * form_xa90

    # Minutes model (deploy mode): last xmins_window prior entries
    last = prior[-params['xmins_window']:]
    n = len(last)
    halflife = params.get('xmins_halflife', 0.0) or 0.0
    if halflife > 0.0:
        # Exponential weights: age=0 is most recent (last element of `last`)
        weights = [0.5 ** ((n - 1 - i) / halflife) for i in range(n)]
        sum_w = sum(weights)
        xmins = sum((e.get('minutes', 0) or 0) * w
                    for e, w in zip(last, weights)) / sum_w
        start_prob = sum(w for e, w in zip(last, weights)
                         if (e.get('starts', 0) or 0) >= 1) / sum_w
        mins_60_prob = sum(w for e, w in zip(last, weights)
                           if (e.get('minutes', 0) or 0) >= 60) / sum_w
        sub_appear_prob = sum(w for e, w in zip(last, weights)
                              if 0 < (e.get('minutes', 0) or 0) < 45) / sum_w
    else:
        xmins = sum(e.get('minutes', 0) or 0 for e in last) / n
        start_prob = sum(1 for e in last if (e.get('starts', 0) or 0) >= 1) / n
        mins_60_prob = sum(1 for e in last
                           if (e.get('minutes', 0) or 0) >= 60) / n
        sub_appear_prob = sum(1 for e in last
                              if 0 < (e.get('minutes', 0) or 0) < 45) / n

    # DefCon rates: fraction of prior 60+-minute games where dc >= threshold.
    # Computed without position knowledge; caller selects dc_rate_10 (DEF) or
    # dc_rate_12 (MID/FWD) based on element_type.
    prior_60 = [e for e in prior if (e.get('minutes', 0) or 0) >= 60]
    if prior_60:
        dc_rate_10 = sum(
            1 for e in prior_60
            if (e.get('defensive_contribution', 0) or 0) >= 10
        ) / len(prior_60)
        dc_rate_12 = sum(
            1 for e in prior_60
            if (e.get('defensive_contribution', 0) or 0) >= 12
        ) / len(prior_60)
    else:
        dc_rate_10 = dc_rate_12 = 0.0

    # saves_per90: cumulative prior saves / cumulative prior minutes * 90
    # over all prior entries with minutes > 0; 0.0 when no prior minutes.
    prior_played = [e for e in prior if (e.get('minutes', 0) or 0) > 0]
    if prior_played:
        cum_saves = sum(int(e.get('saves', 0) or 0) for e in prior_played)
        cum_min_played = sum(e.get('minutes', 0) or 0 for e in prior_played)
        saves_per90 = cum_saves / cum_min_played * 90.0
    else:
        saves_per90 = 0.0

    return {
        'xg_per90': xg_per90,
        'xa_per90': xa_per90,
        'season_xg90': season_xg90,
        'season_xa90': season_xa90,
        'cum_minutes': cum_minutes,
        'xmins': xmins,
        'start_prob': start_prob,
        'mins_60_prob': mins_60_prob,
        'sub_appear_prob': sub_appear_prob,
        'dc_rate_10': dc_rate_10,
        'dc_rate_12': dc_rate_12,
        'saves_per90': saves_per90,
    }


def _spearman(xs: list, ys: list) -> float:
    """Spearman rank correlation with average ranks for ties. Stdlib only."""
    def _rank(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        ranks = [0.0] * len(v)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]:
                j += 1
            avg = (i + j) / 2.0 + 1.0
            for k in range(i, j + 1):
                ranks[order[k]] = avg
            i = j + 1
        return ranks

    if len(xs) < 2:
        return 0.0
    rx, ry = _rank(xs), _rank(ys)
    n = len(xs)
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx)
                    * sum((b - my) ** 2 for b in ry))
    return num / den if den > 0 else 0.0


def compute_metrics(rows: list):
    """Aggregate picks-focused metrics. Returns (metrics, per_gw)."""
    by_gw = defaultdict(list)
    for r in rows:
        by_gw[r['gw']].append(r)

    per_gw = []
    total_haulers = total_haul_hits = total_haul_hits20 = 0
    total_mid = total_mid_hits = 0
    captain_hits = captain_returns = 0
    spearmans = []
    top10_means = []

    for gw in sorted(by_gw):
        rws = sorted(by_gw[gw], key=lambda r: -r['xpts_pred'])
        top10_ids = {r['player_id'] for r in rws[:TOP_N]}
        top20_ids = {r['player_id'] for r in rws[:TOP_N_CAPTURE]}
        top30_ids = {r['player_id'] for r in rws[:MID_TOP_N]}

        haulers = [r for r in rws if r['actual_pts'] >= HAUL_THRESHOLD]
        hits = sum(1 for r in haulers if r['player_id'] in top10_ids)
        hits20 = sum(1 for r in haulers if r['player_id'] in top20_ids)
        mid = [r for r in rws if 6 <= r['actual_pts'] <= 9]
        mid_hits = sum(1 for r in mid if r['player_id'] in top30_ids)

        max_actual = max(r['actual_pts'] for r in rws)
        cap = rws[0]
        cap_hit = 1 if cap['actual_pts'] == max_actual else 0
        cap_ret = 1 if cap['actual_pts'] >= 6 else 0

        sp = _spearman([r['xpts_pred'] for r in rws],
                       [r['actual_pts'] for r in rws])
        t10_mean = (sum(r['actual_pts'] for r in rws[:TOP_N])
                    / min(TOP_N, len(rws)))

        total_haulers += len(haulers)
        total_haul_hits += hits
        total_haul_hits20 += hits20
        total_mid += len(mid)
        total_mid_hits += mid_hits
        captain_hits += cap_hit
        captain_returns += cap_ret
        spearmans.append(sp)
        top10_means.append(t10_mean)

        per_gw.append({
            'gw': gw, 'n_rows': len(rws), 'n_haulers': len(haulers),
            'haul_hits': hits, 'haul_hit_rate':
                hits / len(haulers) if haulers else None,
            'captain_actual': cap['actual_pts'], 'captain_name':
                cap.get('web_name', ''),
            'spearman': round(sp, 4), 'top10_mean_pts': round(t10_mean, 2),
        })

    n_gws = len(per_gw)
    sq_err = [(r['xpts_pred'] - r['actual_pts']) ** 2 for r in rows]
    abs_err = [abs(r['xpts_pred'] - r['actual_pts']) for r in rows]

    by_pos = {}
    for et, name in [(1, 'GKP'), (2, 'DEF'), (3, 'MID'), (4, 'FWD')]:
        pr = [r for r in rows if r['element_type'] == et]
        if not pr:
            continue
        pe = [(r['xpts_pred'] - r['actual_pts']) ** 2 for r in pr]
        by_pos[name] = {
            'n': len(pr),
            'rmse': round(math.sqrt(sum(pe) / len(pe)), 4),
            'n_haulers': sum(1 for r in pr
                             if r['actual_pts'] >= HAUL_THRESHOLD),
        }

    metrics = {
        'n_rows': len(rows),
        'n_gws': n_gws,
        'haul_hit_rate': (total_haul_hits / total_haulers
                          if total_haulers else None),
        'haul_capture_20': (total_haul_hits20 / total_haulers
                            if total_haulers else None),
        'mid_tier_hit_rate': (total_mid_hits / total_mid
                              if total_mid else None),
        'captain_hit_rate': captain_hits / n_gws if n_gws else None,
        'captain_return_rate': captain_returns / n_gws if n_gws else None,
        'top10_mean_pts': (sum(top10_means) / n_gws if n_gws else None),
        'rmse': (round(math.sqrt(sum(sq_err) / len(sq_err)), 4)
                 if rows else None),
        'mae': (round(sum(abs_err) / len(abs_err), 4) if rows else None),
        'spearman': (round(sum(spearmans) / n_gws, 4) if n_gws else None),
        'by_position': by_pos,
        'n_haulers_total': total_haulers,
    }
    return metrics, per_gw


def run_backtest(archive: dict | None = None, params: dict | None = None,
                 mode: str = 'deploy', first_gw: int = 7,
                 last_gw: int = 38) -> dict:
    """Leakage-free backtest over the season archive. See module docstring."""
    from accuracy import build_team_def_form_lookup, build_team_atf_lookup
    from merge import _compute_xpts_fixture

    if archive is None:
        from capture_season import load_season_archive
        archive = load_season_archive()
    p = dict(DEFAULT_PARAMS)
    p.update(params or {})

    fixtures = archive['fixtures']
    fixtures_by_id = {f['id']: f for f in fixtures}
    def_form = build_team_def_form_lookup(fixtures, p['cs_def_form_window_gws'])
    atf_form = build_team_atf_lookup(fixtures, p['atf_window_gws'])
    elements_by_id = {e['id']: e for e in archive['bootstrap']['elements']}

    # BT-02: xGC-based defence form (use instead of def_form when truthy)
    if p['use_xgc_def_form']:
        xgc_form = build_team_xgc_lookup(archive, window_gws=int(p['cs_def_form_window_gws']))
    else:
        xgc_form = None

    rows = []
    for pid, summary in archive['summaries'].items():
        el = elements_by_id.get(pid)
        if el is None:
            continue
        et = el['element_type']
        history = summary.get('history', [])
        by_gw = defaultdict(list)
        for e in history:
            by_gw[e.get('round')].append(e)

        for gw in range(first_gw, last_gw + 1):
            entries = by_gw.get(gw)
            if not entries:
                continue  # blank GW or not registered
            sig = build_asof_signals(history, gw, p)
            if sig is None or sig['cum_minutes'] < p['min_prior_minutes']:
                continue

            actual_pts = sum(e.get('total_points', 0) or 0 for e in entries)
            actual_minutes = sum(e.get('minutes', 0) or 0 for e in entries)

            if mode == 'deploy':
                if sig['xmins'] <= 0:
                    continue
            else:
                if actual_minutes < 10:
                    continue

            pred = 0.0
            for e in entries:
                fix = fixtures_by_id.get(e.get('fixture'))
                if fix is None:
                    continue
                was_home = bool(e.get('was_home'))
                team_id = fix['team_h'] if was_home else fix['team_a']
                diff_raw = (fix.get('team_h_difficulty', 3) if was_home
                            else fix.get('team_a_difficulty', 3))
                difficulty = (diff_raw - 1) / 4.0
                # BT-02: use xGC-based defence form when enabled
                if xgc_form is not None:
                    ncr = xgc_form.get((gw, team_id), 0.5)
                else:
                    ncr = def_form.get((gw, team_id), 0.5)
                nar = atf_form.get((gw, team_id), 0.5)

                # BT-02: fixture_attack_slope — scale attacking EV by opponent difficulty
                if p['fixture_attack_slope'] > 0.0:
                    atk_scale = max(0.0, 1.0 + (0.5 - difficulty) * p['fixture_attack_slope'])
                    xg_used = sig['xg_per90'] * atk_scale
                    xa_used = sig['xa_per90'] * atk_scale
                else:
                    xg_used = sig['xg_per90']
                    xa_used = sig['xa_per90']

                if mode == 'deploy':
                    # DGW note: same predicted xmins per fixture — a player
                    # genuinely can play full minutes twice in a DGW; refining
                    # per-fixture minutes is future work.
                    xm, sp_ = sig['xmins'], sig['start_prob']
                else:
                    m = e.get('minutes', 0) or 0
                    if m < 45:
                        # Sub cameo (0 < m < 45) or DNP (m == 0).
                        # Intentional simplification: credit appearance EV only
                        # (sub_appear_prob, derived from prior rounds). Goal/
                        # assist/CS EV are omitted — the live model scales
                        # attacking EV by xmins/90 even for short outings, but
                        # cameo attacking EV is negligible and sub_appear_prob
                        # is the honest pre-GW estimate for a cameo player.
                        pred += sig['sub_appear_prob'] if m > 0 else 0.0
                        continue
                    xm, sp_ = float(m), 1.0

                result = _compute_xpts_fixture(
                    xg_per90=xg_used,
                    xa_per90=xa_used,
                    start_prob=sp_,
                    xmins=xm,
                    element_type=et,
                    defensive_difficulty=difficulty,
                    mins_60_prob=sig['mins_60_prob'],
                    sub_appear_prob=sig['sub_appear_prob'],
                    cs_prob_base=p['cs_prob_base'],
                    cs_prob_slope=p['cs_prob_slope'],
                    norm_concede_rate=ncr,
                    cs_team_form_slope=p['cs_team_form_slope'],
                    norm_attack_rate=nar,
                    atf_slope=p['atf_slope'],
                )
                pred += result['total']

                if p['defcon_scale'] > 0:
                    if et == 1:
                        threshold_rate = 0.0
                    elif et == 2:
                        threshold_rate = sig['dc_rate_10']
                    else:
                        threshold_rate = sig['dc_rate_12']
                    mins_factor = min(1.0, xm / 90.0)
                    dc_ev = 2.0 * threshold_rate * p['defcon_scale'] * mins_factor
                    pred += dc_ev

                if p['gk_saves_scale'] > 0 and et == 1:
                    opp_team_id = fix['team_a'] if was_home else fix['team_h']
                    opp_attack = atf_form.get((gw, opp_team_id), 0.5)
                    save_ev = (sig['saves_per90'] / 3.0) * (xm / 90.0) * (0.5 + opp_attack) * p['gk_saves_scale']
                    pred += save_ev

            rows.append({
                'player_id': pid,
                'web_name': el.get('web_name', str(pid)),
                'element_type': et,
                'gw': gw,
                'xpts_pred': round(pred, 3),
                'actual_pts': actual_pts,
                'actual_minutes': actual_minutes,
                'xmins_used': round(sig['xmins'], 1),
                'xg_per90': round(sig['xg_per90'], 3),
                'xa_per90': round(sig['xa_per90'], 3),
                'n_fixtures': len(entries),
            })

    metrics, per_gw = compute_metrics(rows)
    return {
        'metrics': metrics,
        'per_gw': per_gw,
        'rows': rows,
        'config': {'mode': mode, 'first_gw': first_gw, 'last_gw': last_gw,
                   'params': p},
    }


def _parse_args(argv):
    ap = argparse.ArgumentParser(description='BT-02 leakage-free backtest')
    ap.add_argument('--mode', choices=['deploy', 'conditional'],
                    default='deploy')
    ap.add_argument('--first-gw', type=int, default=7)
    ap.add_argument('--last-gw', type=int, default=38)
    ap.add_argument('--set', action='append', default=[],
                    metavar='KEY=VALUE', help='override a param (repeatable)')
    ap.add_argument('--json', default=None,
                    help='write full result (metrics+per_gw+rows) to file')
    return ap.parse_args(argv)


def _parse_overrides(pairs: list) -> dict:
    out = {}
    for pair in pairs:
        key, _, val = pair.partition('=')
        if not _:
            raise SystemExit(f'bad --set (expected KEY=VALUE): {pair}')
        default = DEFAULT_PARAMS.get(key)
        if isinstance(default, int) and not isinstance(default, bool):
            out[key] = int(val)
        else:
            out[key] = float(val)
    return out


def main(argv=None):
    args = _parse_args(argv if argv is not None else sys.argv[1:])
    overrides = _parse_overrides(args.set)
    result = run_backtest(params=overrides, mode=args.mode,
                          first_gw=args.first_gw, last_gw=args.last_gw)
    m = result['metrics']
    print(f"BT-02 backtest  mode={args.mode}  GW{args.first_gw}-{args.last_gw}"
          f"  rows={m['n_rows']}  haulers={m['n_haulers_total']}")
    if overrides:
        print(f"overrides: {overrides}")
    for k in ['haul_hit_rate', 'haul_capture_20', 'mid_tier_hit_rate',
              'captain_hit_rate', 'captain_return_rate', 'top10_mean_pts',
              'rmse', 'mae', 'spearman']:
        v = m[k]
        print(f"  {k:22s} {v:.4f}" if isinstance(v, float)
              else f"  {k:22s} {v}")
    for pos, d in m['by_position'].items():
        print(f"  {pos}: n={d['n']} rmse={d['rmse']} haulers={d['n_haulers']}")
    if args.json:
        with open(args.json, 'w', encoding='utf-8') as f:
            json.dump(result, f)
        print(f"written: {args.json}")


if __name__ == '__main__':
    main()
