"""Exp04: alternative RANKING functions over identical BT-02 predictions.

Insight from DefCon calibration: well-calibrated flat EV (DefCon) improves the
mean but not haul-ranking — top-N hit metrics reward CEILING. So compare
ranking keys computed from each row's own signals (no new predictions):

  A. xpts_pred                      (baseline — mean)
  B. xpts_pred + DefCon EV          (defcon_scale=0.5 run)
  C. ceiling = pred + 1.28 * sigma  (Poisson variance proxy from lam_g/lam_a)
  D. attacking-only EV              (goal+assist EV, ignores CS/appearance)

Metric: haul capture in top-10/top-20, top10_mean_pts, on validation GW29-38
and train GW7-28 separately.

Run from pipeline/:  python experiments/exp04_ranking_functions.py
"""
import json
import math
import sys
from collections import defaultdict

sys.path.insert(0, '.')
from backtest import run_backtest
from capture_season import load_season_archive

GOAL_PTS = {1: 6, 2: 6, 3: 5, 4: 4}
ASSIST_PTS = 3
TUNED = {'blend_alpha': 0.2, 'form_window_gws': 4, 'min_prior_minutes': 180}


def keys_for(row):
    et = row['element_type']
    xm = row['xmins_used']
    lam_g = row['xg_per90'] * xm / 90.0
    lam_a = row['xa_per90'] * xm / 90.0
    var = lam_g * GOAL_PTS[et] ** 2 + lam_a * ASSIST_PTS ** 2
    sigma = math.sqrt(var)
    attacking = lam_g * GOAL_PTS[et] + lam_a * ASSIST_PTS
    return {
        'A_mean': row['xpts_pred'],
        'C_ceiling': row['xpts_pred'] + 1.28 * sigma,
        'D_attacking': attacking,
    }


def evaluate(rows, key_name, key_fn):
    by_gw = defaultdict(list)
    for r in rows:
        by_gw[r['gw']].append(r)
    h = h10 = h20 = 0
    t10 = []
    for gw, rws in by_gw.items():
        rws.sort(key=key_fn, reverse=True)
        top10 = rws[:10]
        top20 = rws[:20]
        haulers = [r for r in rws if r['actual_pts'] >= 10]
        h += len(haulers)
        ids10 = {r['player_id'] for r in top10}
        ids20 = {r['player_id'] for r in top20}
        h10 += sum(1 for r in haulers if r['player_id'] in ids10)
        h20 += sum(1 for r in haulers if r['player_id'] in ids20)
        t10.append(sum(r['actual_pts'] for r in top10) / len(top10))
    return {'key': key_name, 'haul_top10': h10 / h, 'haul_top20': h20 / h,
            'top10_mean_pts': sum(t10) / len(t10), 'n_haulers': h}


def main():
    archive = load_season_archive()
    out = {}
    for label, gws in [('train_GW7-28', (7, 28)), ('val_GW29-38', (29, 38))]:
        base = run_backtest(archive=archive, params=TUNED,
                            first_gw=gws[0], last_gw=gws[1])
        dc = run_backtest(archive=archive,
                          params=dict(TUNED, defcon_scale=0.5),
                          first_gw=gws[0], last_gw=gws[1])
        rows = base['rows']
        results = [
            evaluate(rows, 'A_mean', lambda r: r['xpts_pred']),
            evaluate(dc['rows'], 'B_mean+defcon0.5',
                     lambda r: r['xpts_pred']),
            evaluate(rows, 'C_ceiling',
                     lambda r: keys_for(r)['C_ceiling']),
            evaluate(rows, 'D_attacking',
                     lambda r: keys_for(r)['D_attacking']),
        ]
        out[label] = results
        print(f'\n=== {label} ===')
        print(f"{'key':20s} {'haul@10':>8s} {'haul@20':>8s} {'top10pts':>9s}")
        for r in results:
            print(f"{r['key']:20s} {r['haul_top10']:8.4f} "
                  f"{r['haul_top20']:8.4f} {r['top10_mean_pts']:9.4f}")

    json.dump(out, open('experiments/exp04_ranking.json', 'w'), indent=1)
    print('\nsaved experiments/exp04_ranking.json')


if __name__ == '__main__':
    main()
