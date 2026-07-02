"""DEC-01 / exp13: season decision autopsy — score DECISIONS, not predictions.

The accuracy stack measures prediction error (RMSE, haul hit rate) but never
what a manager following the model would have SCORED. This experiment replays
2025/26 with the leakage-free backtest and scores the decisions themselves:

  A. CAPTAIN POLICIES  five armband rules scored per GW against hindsight —
     which policy captures the most of the best-available captain's points?
  B. XI EFFICIENCY     the model's best formation-legal XI (with captain)
     vs the hindsight-optimal XI, a form-chaser baseline and the field mean.
  C. CHIP CALENDAR     hindsight value of Triple Captain / Bench Boost /
     Free Hit per GW — when SHOULD each chip have been played?
  D. TRANSFER POLICIES weekly squad simulation from GW8: hold-forever vs
     1-free-transfer vs transfers-with-hits — does weekly churn add points?

All signals are as-of (strictly prior rounds); per-GW prices come from each
player's history `value`, so squads are budget-legal at that GW's prices.
Descriptive experiment: emits findings + policy deltas, no SHIP gate.

Run:  cd pipeline; python -m experiments.exp13_decision_autopsy
"""
import json
import os
from collections import defaultdict

from backtest import run_backtest
from capture_season import load_season_archive

_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                    'exp13_decision_autopsy.json')

FIRST_GW = 7           # backtest default: needs prior rounds for signals
LAST_GW = 38
FORMATIONS = [(3, 4, 3), (3, 5, 2), (4, 3, 3), (4, 4, 2), (4, 5, 1),
              (5, 3, 2), (5, 4, 1)]
PREMIUM_VALUE = 85     # £8.5m in FPL tenths
CAPTAIN_POOL_N = 20    # "realistic" hindsight captain pool = top-20 by xPts
SQUAD_BUDGET = 1000    # £100.0m
MAX_PER_TEAM = 3
HIT_COST = 4
TRANSFER_GAIN_MIN = 1.0   # predicted xPts gain needed to move at all
HIT_GAIN_MIN = 6.0        # predicted gain needed to justify a -4


# ---------------------------------------------------------------- helpers

def _value_lookup(archive):
    """(pid, gw) -> price in tenths at that GW (last entry wins on DGWs)."""
    out = {}
    for pid, summary in archive['summaries'].items():
        for e in summary.get('history', []):
            gw, val = e.get('round'), e.get('value')
            if gw is not None and val is not None:
                out[(pid, gw)] = int(val)
    return out


def _team_lookup(archive):
    return {e['id']: e['team'] for e in archive['bootstrap']['elements']}


def _best_xi(rows, key):
    """Exact best formation-legal XI (1 GK + d/m/f) by `key`. rows = one GW."""
    by_pos = {1: [], 2: [], 3: [], 4: []}
    for r in rows:
        by_pos[r['element_type']].append(r)
    for et in by_pos:
        by_pos[et].sort(key=lambda r: -key(r))
    best, best_val = None, -1.0
    for d, m, f in FORMATIONS:
        if (not by_pos[1] or len(by_pos[2]) < d or len(by_pos[3]) < m
                or len(by_pos[4]) < f):
            continue
        xi = by_pos[1][:1] + by_pos[2][:d] + by_pos[3][:m] + by_pos[4][:f]
        val = sum(key(r) for r in xi)
        if val > best_val:
            best, best_val = xi, val
    return best or []


# ---------------------------------------------------------------- captains

def captain_policies(rows_by_gw, values):
    """Score 5 armband policies per GW. Returns (per_policy, per_gw_detail)."""
    policies = ['top_xpts', 'top_attacker', 'premium_only', 'dgw_first',
                'haul_shape']
    tally = {p: {'total': 0.0, 'returns': 0, 'hits': 0, 'captured': []}
             for p in policies}
    detail = []

    for gw in sorted(rows_by_gw):
        rows = sorted(rows_by_gw[gw], key=lambda r: -r['xpts_pred'])
        if len(rows) < CAPTAIN_POOL_N:
            continue
        pool = rows[:CAPTAIN_POOL_N]
        hindsight_pool = max(pool, key=lambda r: r['actual_pts'])
        hindsight_all = max(rows, key=lambda r: r['actual_pts'])

        def pick(policy):
            if policy == 'top_xpts':
                return rows[0]
            if policy == 'top_attacker':
                return next((r for r in rows if r['element_type'] in (3, 4)),
                            rows[0])
            if policy == 'premium_only':
                return next((r for r in rows
                             if values.get((r['player_id'], gw), 0)
                             >= PREMIUM_VALUE), rows[0])
            if policy == 'dgw_first':
                return next((r for r in rows if r['n_fixtures'] >= 2), rows[0])
            if policy == 'haul_shape':   # of the top 3 xPts, best xG90 shape
                top3 = rows[:3]
                return max(top3, key=lambda r: r['xg_per90'])
            return rows[0]

        gw_row = {'gw': gw,
                  'hindsight_pool_best': {'name': hindsight_pool['web_name'],
                                          'pts': hindsight_pool['actual_pts']},
                  'hindsight_overall': {'name': hindsight_all['web_name'],
                                        'pts': hindsight_all['actual_pts']}}
        for p in policies:
            c = pick(p)
            a = c['actual_pts']
            tally[p]['total'] += a
            tally[p]['returns'] += 1 if a >= 6 else 0
            tally[p]['hits'] += 1 if a == hindsight_all['actual_pts'] else 0
            denom = max(hindsight_pool['actual_pts'], 1)
            tally[p]['captured'].append(a / denom)
            gw_row[p] = {'name': c['web_name'], 'pts': a}
        detail.append(gw_row)

    n = len(detail)
    summary = {}
    for p, t in tally.items():
        summary[p] = {
            'mean_captain_pts': round(t['total'] / n, 2),
            'season_doubled_pts': round(t['total'], 0),  # extra pts from the (C)
            'return_rate': round(t['returns'] / n, 3),
            'hindsight_hit_rate': round(t['hits'] / n, 3),
            'mean_captured_vs_pool_best': round(
                sum(t['captured']) / n, 3),
        }
    return summary, detail


# ---------------------------------------------------------------- XI

def xi_efficiency(rows_by_gw, archive):
    """Model XI (+top-xPts captain) vs hindsight XI vs form-chaser vs field."""
    cum_actual = defaultdict(float)   # form-chaser memory (points so far)
    out = []
    for gw in sorted(rows_by_gw):
        rows = rows_by_gw[gw]
        model_xi = _best_xi(rows, key=lambda r: r['xpts_pred'])
        hind_xi = _best_xi(rows, key=lambda r: r['actual_pts'])
        form_xi = _best_xi(rows, key=lambda r: cum_actual[r['player_id']])
        if not (model_xi and hind_xi):
            continue

        def score(xi):
            pts = sum(r['actual_pts'] for r in xi)
            cap = max(xi, key=lambda r: r['xpts_pred'])
            return pts + cap['actual_pts']   # captain doubled

        field_mean = (sum(r['actual_pts'] for r in rows) / len(rows)) * 12
        out.append({'gw': gw,
                    'model_xi': round(score(model_xi), 1),
                    'hindsight_xi': round(score(hind_xi), 1),
                    'form_chaser_xi': round(score(form_xi), 1),
                    'field_mean_xi': round(field_mean, 1)})
        for r in rows:
            cum_actual[r['player_id']] += r['actual_pts']

    n = len(out)
    agg = {k: round(sum(g[k] for g in out) / n, 1)
           for k in ('model_xi', 'hindsight_xi', 'form_chaser_xi',
                     'field_mean_xi')}
    agg['efficiency_vs_hindsight'] = round(
        sum(g['model_xi'] for g in out) / max(sum(g['hindsight_xi']
                                                  for g in out), 1), 3)
    return agg, out


# ---------------------------------------------------------------- chips

def chip_calendar(rows_by_gw):
    """Hindsight per-GW chip values (proxies; no squad trajectory needed)."""
    cal = []
    for gw in sorted(rows_by_gw):
        rows = sorted(rows_by_gw[gw], key=lambda r: -r['xpts_pred'])
        if len(rows) < 30:
            continue
        model_xi = _best_xi(rows, key=lambda r: r['xpts_pred'])
        xi_ids = {r['player_id'] for r in model_xi}
        cap = max(model_xi, key=lambda r: r['xpts_pred']) if model_xi else None
        # TC = one extra captain multiple beyond the normal double.
        tc_value = cap['actual_pts'] if cap else 0
        # BB proxy: the next-best 4 by xPts outside the XI (incl. a 2nd GK slot).
        bench = [r for r in rows if r['player_id'] not in xi_ids][:4]
        bb_value = sum(r['actual_pts'] for r in bench)
        # FH/DGW leverage: predicted XI total + how many doubles in the XI.
        xi_xpts = sum(r['xpts_pred'] for r in model_xi)
        dgw_players = sum(1 for r in model_xi if r['n_fixtures'] >= 2)
        cal.append({'gw': gw, 'tc_value': tc_value,
                    'bb_value': round(bb_value, 1),
                    'xi_xpts': round(xi_xpts, 1),
                    'dgw_players_in_xi': dgw_players})

    def top5(key):
        return sorted(cal, key=lambda c: -c[key])[:5]

    return {
        'best_tc_gws': [{'gw': c['gw'], 'value': c['tc_value']}
                        for c in top5('tc_value')],
        'best_bb_gws': [{'gw': c['gw'], 'value': c['bb_value']}
                        for c in top5('bb_value')],
        'best_fh_gws': [{'gw': c['gw'], 'xi_xpts': c['xi_xpts'],
                         'dgw_players': c['dgw_players_in_xi']}
                        for c in top5('xi_xpts')],
        'per_gw': cal,
    }


# ---------------------------------------------------------------- transfers

def _legal_squad_ilp(rows, values, teams, gw):
    """Budget-legal 15 (2/5/5/3, <=3 per club, <=£100m) maximising xPts."""
    import pulp
    cand = [r for r in rows
            if values.get((r['player_id'], gw)) is not None]
    prob = pulp.LpProblem('squad', pulp.LpMaximize)
    x = {r['player_id']: pulp.LpVariable(f"x{r['player_id']}", cat='Binary')
         for r in cand}
    prob += pulp.lpSum(x[r['player_id']] * r['xpts_pred'] for r in cand)
    prob += pulp.lpSum(x.values()) == 15
    for et, need in ((1, 2), (2, 5), (3, 5), (4, 3)):
        prob += pulp.lpSum(x[r['player_id']] for r in cand
                           if r['element_type'] == et) == need
    prob += pulp.lpSum(x[r['player_id']]
                       * values[(r['player_id'], gw)] for r in cand) <= SQUAD_BUDGET
    for t in {teams[r['player_id']] for r in cand}:
        prob += pulp.lpSum(x[r['player_id']] for r in cand
                           if teams[r['player_id']] == t) <= MAX_PER_TEAM
    prob.solve(pulp.PULP_CBC_CMD(msg=0))
    return {pid for pid, var in x.items() if var.value() == 1}


def transfer_policies(rows_by_gw, values, teams):
    """Weekly squad sim from FIRST_GW+1: hold vs 1FT vs hits. Myopic (this-GW
    xPts) swap valuation — deliberately simple; it answers 'does weekly churn
    add points at all', not 'what is the best possible transfer engine'."""
    gws = sorted(rows_by_gw)
    start_gw = gws[0]
    initial = _legal_squad_ilp(rows_by_gw[start_gw], values, teams, start_gw)

    def week_score(squad_ids, gw):
        rows = [r for r in rows_by_gw[gw] if r['player_id'] in squad_ids]
        xi = _best_xi(rows, key=lambda r: r['xpts_pred'])
        if not xi:
            return 0.0
        cap = max(xi, key=lambda r: r['xpts_pred'])
        return sum(r['actual_pts'] for r in xi) + cap['actual_pts']

    def best_swaps(squad_ids, gw, max_swaps):
        """Greedy best same-position swaps by predicted gain, budget+club legal."""
        rows = {r['player_id']: r for r in rows_by_gw[gw]}
        squad = set(squad_ids)
        swaps = []
        for _ in range(max_swaps):
            best = None
            bank = SQUAD_BUDGET - sum(values.get((p, gw), 0) for p in squad)
            club_count = defaultdict(int)
            for p in squad:
                club_count[teams[p]] += 1
            for out_id in list(squad):
                out_r = rows.get(out_id)
                out_x = out_r['xpts_pred'] if out_r else 0.0   # blanked/gone = 0
                out_et = out_r['element_type'] if out_r else None
                out_val = values.get((out_id, gw), 0)
                for r in rows_by_gw[gw]:
                    pid = r['player_id']
                    if pid in squad or (out_et and r['element_type'] != out_et):
                        continue
                    if out_et is None:
                        continue
                    cost = values.get((pid, gw))
                    if cost is None or cost > out_val + bank:
                        continue
                    if club_count[teams[pid]] >= MAX_PER_TEAM and teams[pid] != teams[out_id]:
                        continue
                    gain = r['xpts_pred'] - out_x
                    if best is None or gain > best[0]:
                        best = (gain, out_id, pid)
            if best is None or best[0] < TRANSFER_GAIN_MIN:
                break
            swaps.append(best)
            squad.discard(best[1])
            squad.add(best[2])
        return squad, swaps

    results = {}
    for policy in ('hold', 'one_ft', 'hits'):
        squad = set(initial)
        total, hits_paid, n_transfers = 0.0, 0, 0
        for gw in gws[1:]:
            if policy != 'hold':
                max_swaps = 1 if policy == 'one_ft' else 3
                new_squad, swaps = best_swaps(squad, gw, max_swaps)
                if policy == 'hits' and len(swaps) > 1:
                    # extra swaps must clear the hit bar
                    kept = swaps[:1] + [s for s in swaps[1:]
                                        if s[0] >= HIT_GAIN_MIN]
                    extra = len(kept) - 1
                    hits_paid += extra * HIT_COST
                    squad_ids = set(squad)
                    for _, out_id, in_id in kept:
                        squad_ids.discard(out_id)
                        squad_ids.add(in_id)
                    squad = squad_ids
                    n_transfers += len(kept)
                else:
                    squad = new_squad
                    n_transfers += len(swaps)
            total += week_score(squad, gw)
        results[policy] = {
            'season_points': round(total - (hits_paid if policy == 'hits' else 0), 0),
            'transfers_made': n_transfers,
            'hit_points_paid': hits_paid if policy == 'hits' else 0,
        }
    return results


# ---------------------------------------------------------------- main

def run():
    archive = load_season_archive()
    bt = run_backtest(archive, mode='deploy', first_gw=FIRST_GW,
                      last_gw=LAST_GW)
    values = _value_lookup(archive)
    teams = _team_lookup(archive)

    rows_by_gw = defaultdict(list)
    for r in bt['rows']:
        rows_by_gw[r['gw']].append(r)

    cap_summary, cap_detail = captain_policies(rows_by_gw, values)
    xi_agg, xi_detail = xi_efficiency(rows_by_gw, archive)
    chips = chip_calendar(rows_by_gw)
    transfers = transfer_policies(rows_by_gw, values, teams)

    result = {
        'experiment': 'exp13_decision_autopsy',
        'config': {'first_gw': FIRST_GW, 'last_gw': LAST_GW,
                   'mode': 'deploy', 'params': bt['config']['params']},
        'captain_policies': cap_summary,
        'captain_per_gw': cap_detail,
        'xi_efficiency': xi_agg,
        'xi_per_gw': xi_detail,
        'chip_calendar': chips,
        'transfer_policies': transfers,
        'prediction_metrics': bt['metrics'],
    }
    with open(_OUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=1)

    print(f"exp13 decision autopsy  GW{FIRST_GW}-{LAST_GW}")
    print("\nCaptain policies (per-GW mean / return rate / % of pool-best captured):")
    for p, s in cap_summary.items():
        print(f"  {p:14s} {s['mean_captain_pts']:>5} pts  ret {s['return_rate']:.0%}"
              f"  captured {s['mean_captured_vs_pool_best']:.0%}"
              f"  season extra {s['season_doubled_pts']:.0f}")
    print("\nXI efficiency (mean per GW):")
    for k, v in xi_agg.items():
        print(f"  {k:24s} {v}")
    print("\nTransfer policies (season XI points):")
    for p, s in transfers.items():
        print(f"  {p:8s} {s['season_points']:.0f} pts  ({s['transfers_made']}"
              f" transfers, -{s['hit_points_paid']} hits)")
    print("\nBest chip GWs (hindsight):")
    print(f"  TC: {chips['best_tc_gws']}")
    print(f"  BB: {chips['best_bb_gws']}")
    print(f"  written: {_OUT}")
    return result


if __name__ == '__main__':
    run()
