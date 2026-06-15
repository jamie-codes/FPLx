"""EUR-01 / exp10: does penalising xmins on midweek-congestion clashes beat the
baseline on the leakage-free 2025/26 backtest?

Run:  cd pipeline; python -m experiments.exp10_congestion
Verdict: SHIP only if a positive penalty beats penalty=0 on deploy top10_mean_pts
AND lowers clash-subset points RMSE. Else NO_SHIP (record in the rejected table).
"""
import json
import math
import os

from capture_season import load_season_archive
from congestion_dates import MIDWEEK_FIXTURE_DATES
from congestion_join import build_congestion_lookup
from backtest import run_backtest

_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'exp10_congestion.json')
_PENALTIES = [0.0, 0.05, 0.10, 0.15, 0.20, 0.25]


def _rmse(pairs):
    if not pairs:
        return float('nan')
    return math.sqrt(sum((p - a) ** 2 for p, a in pairs) / len(pairs))


def _clash_rmse(res):
    """Points RMSE (predicted xPts vs actual) over clash-flagged rows only."""
    pairs = [(r['xpts_pred'], r['actual_pts']) for r in res['rows']
             if r.get('congestion_clash')]
    return _rmse(pairs)


def run():
    archive = load_season_archive()
    clashes = build_congestion_lookup(MIDWEEK_FIXTURE_DATES, archive['fixtures'])

    sweep = []
    for pen in _PENALTIES:
        res = run_backtest(archive, params={'congestion_penalty': pen},
                           mode='deploy', congestion_clashes=clashes)
        sweep.append({
            'congestion_penalty': pen,
            'top10_mean_pts': res['metrics']['top10_mean_pts'],
            'clash_rmse': _clash_rmse(res),
        })

    base = next(a for a in sweep if a['congestion_penalty'] == 0.0)
    # best positive-penalty arm by top10
    positives = [a for a in sweep if a['congestion_penalty'] > 0.0]
    best = max(positives, key=lambda a: a['top10_mean_pts'])

    ships = (best['top10_mean_pts'] >= base['top10_mean_pts']
             and best['clash_rmse'] < base['clash_rmse'])
    verdict = 'SHIP' if ships else 'NO_SHIP'

    result = {
        'sweep': sweep,
        'clash_count': len(clashes),
        'baseline_top10': base['top10_mean_pts'],
        'baseline_clash_rmse': base['clash_rmse'],
        'best_penalty': best['congestion_penalty'],
        'best_top10': best['top10_mean_pts'],
        'best_clash_rmse': best['clash_rmse'],
        'verdict': verdict,
    }
    with open(_OUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2)
    return result


if __name__ == '__main__':
    r = run()
    print(json.dumps(r, indent=2))
    print('VERDICT:', r['verdict'])
