"""TRF-01 / exp14: does the transfer advisor beat holding — and a placebo?

Validates the EXACT shipped function (transfer_advisor.suggest_transfers) on
the 2025/26 archive with the leakage-free backtest. Three season simulations
from the same ILP starting squad:

  hold      never transfer
  advisor   suggest_transfers each GW (1 FT, hits allowed past the gain bar)
  placebo   one RANDOM legal same-position swap each GW (seed 42)

Weekly score = best formation-legal XI by as-of xPts, captain doubled,
actual points. SHIP iff advisor beats BOTH hold and placebo on season points.

Run:  cd pipeline; python -m experiments.exp14_transfer_advisor
"""
import json
import os
import random
from collections import defaultdict

from backtest import run_backtest
from capture_season import load_season_archive
from transfer_advisor import suggest_transfers
from experiments.exp13_decision_autopsy import (_best_xi, _legal_squad_ilp,
                                                _team_lookup, _value_lookup)

_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                    'exp14_transfer_advisor.json')
FIRST_GW = 7
LAST_GW = 38
BUDGET = 1000
SEED = 42


def _price(values, pid, gw):
    """Price at gw, falling back to the most recent known price."""
    for g in range(gw, 0, -1):
        v = values.get((pid, g))
        if v is not None:
            return v
    return 0


def _candidates(rows, values, teams, gw, squad_ids):
    """Advisor candidates for one GW. Squad members without a row this GW
    (blank/injured/unregistered) become forced sells: available=False, value 0."""
    by_id = {r['player_id']: r for r in rows}
    pool = []
    for r in rows:
        pool.append({'id': r['player_id'], 'name': r['web_name'],
                     'element_type': r['element_type'],
                     'team': teams[r['player_id']],
                     'cost': _price(values, r['player_id'], gw),
                     'value': r['xpts_pred'], 'available': True})
    squad = []
    for pid in squad_ids:
        r = by_id.get(pid)
        if r is not None:
            squad.append(next(c for c in pool if c['id'] == pid))
        else:
            squad.append({'id': pid, 'name': str(pid),
                          'element_type': _ET.get(pid, 3),
                          'team': teams.get(pid, 0),
                          'cost': _price(values, pid, gw),
                          'value': 0.0, 'available': False})
    return squad, pool


_ET = {}


def run():
    archive = load_season_archive()
    global _ET
    _ET = {e['id']: e['element_type'] for e in archive['bootstrap']['elements']}
    bt = run_backtest(archive, mode='deploy', first_gw=FIRST_GW, last_gw=LAST_GW)
    values = _value_lookup(archive)
    teams = _team_lookup(archive)

    rows_by_gw = defaultdict(list)
    for r in bt['rows']:
        rows_by_gw[r['gw']].append(r)
    gws = sorted(rows_by_gw)
    initial = _legal_squad_ilp(rows_by_gw[gws[0]], values, teams, gws[0])

    def week_score(squad_ids, gw):
        rows = [r for r in rows_by_gw[gw] if r['player_id'] in squad_ids]
        xi = _best_xi(rows, key=lambda r: r['xpts_pred'])
        if not xi:
            return 0.0
        cap = max(xi, key=lambda r: r['xpts_pred'])
        return sum(r['actual_pts'] for r in xi) + cap['actual_pts']

    rng = random.Random(SEED)
    results = {}
    per_gw = defaultdict(dict)
    for policy in ('hold', 'advisor', 'placebo'):
        squad_ids = set(initial)
        total, hits, n_moves = 0.0, 0, 0
        for gw in gws[1:]:
            if policy == 'advisor':
                squad, pool = _candidates(rows_by_gw[gw], values, teams, gw,
                                          squad_ids)
                res = suggest_transfers(squad, pool, free_transfers=1,
                                        budget=BUDGET, max_extra=2)
                squad_ids = set(res['new_squad_ids'])
                hits += res['n_hits']
                n_moves += len(res['moves'])
            elif policy == 'placebo':
                squad, pool = _candidates(rows_by_gw[gw], values, teams, gw,
                                          squad_ids)
                club = defaultdict(int)
                for p in squad:
                    club[p['team']] += 1
                bank = BUDGET - sum(p['cost'] for p in squad)
                out_p = rng.choice(squad)
                legal = [c for c in pool
                         if c['element_type'] == out_p['element_type']
                         and c['id'] not in squad_ids
                         and c['cost'] <= out_p['cost'] + bank
                         and (club[c['team']] < 3 or c['team'] == out_p['team'])]
                if legal:
                    in_p = rng.choice(legal)
                    squad_ids.discard(out_p['id'])
                    squad_ids.add(in_p['id'])
                    n_moves += 1
            wk = week_score(squad_ids, gw)
            total += wk
            per_gw[gw][policy] = round(wk, 1)
        results[policy] = {
            'season_points': round(total - hits * 4, 0),
            'transfers_made': n_moves,
            'hit_points_paid': hits * 4,
        }

    adv, hold, plc = (results['advisor']['season_points'],
                      results['hold']['season_points'],
                      results['placebo']['season_points'])
    verdict = 'SHIP' if (adv > hold and adv > plc) else 'NO_SHIP'

    out = {'experiment': 'exp14_transfer_advisor', 'verdict': verdict,
           'results': results,
           'margins': {'vs_hold': round(adv - hold, 0),
                       'vs_placebo': round(adv - plc, 0)},
           'per_gw': [{'gw': g, **per_gw[g]} for g in sorted(per_gw)],
           'config': {'first_gw': FIRST_GW, 'last_gw': LAST_GW,
                      'seed': SEED, 'budget': BUDGET}}
    with open(_OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)

    print(f"exp14 transfer advisor  GW{FIRST_GW}-{LAST_GW}  verdict: {verdict}")
    for p, r in results.items():
        print(f"  {p:8s} {r['season_points']:.0f} pts "
              f"({r['transfers_made']} moves, -{r['hit_points_paid']} hits)")
    print(f"  margins: +{out['margins']['vs_hold']:.0f} vs hold, "
          f"+{out['margins']['vs_placebo']:.0f} vs placebo")
    print(f"  written: {_OUT}")
    return out


if __name__ == '__main__':
    run()
