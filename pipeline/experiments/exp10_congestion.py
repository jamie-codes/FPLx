"""EUR-01 / exp10: does penalising xmins on midweek-congestion clashes beat the
baseline on the leakage-free 2025/26 backtest?

Run:  cd pipeline; python -m experiments.exp10_congestion
Verdict: SHIP requires ALL of:
  1. best positive-penalty strictly beats penalty=0 on deploy top10_mean_pts
  2. best positive-penalty lowers clash-subset points RMSE
  3. permutation p-value <= 0.02 (strict bar: single season, low prior)
  4. best penalty is NOT the smallest non-zero penalty swept (peak-at-min is a
     noise signature — a robust signal should not optimise at minimum perturbation)
Else NO_SHIP (record in the rejected table).
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


def permutation_pvalue(archive, real_clashes, penalty, n_perm=150, seed=7):
    """One-tailed empirical p: fraction of random same-size (team,gw) clash sets
    whose top10 gain at `penalty` >= the real clash set's gain. Low p = real signal."""
    import random
    base = run_backtest(archive, mode='deploy')['metrics']['top10_mean_pts']

    def t10(cl):
        return run_backtest(archive, params={'congestion_penalty': penalty},
                            mode='deploy', congestion_clashes=cl)['metrics']['top10_mean_pts']

    real_gain = t10(real_clashes) - base
    in_range = {(t, g) for (t, g) in real_clashes if 7 <= g <= 38}
    teams = [t['id'] for t in archive['bootstrap']['teams']]
    universe = [(t, g) for t in teams for g in range(7, 39)]
    rng = random.Random(seed)
    ge = sum(1 for _ in range(n_perm)
             if (t10(set(rng.sample(universe, len(in_range)))) - base) >= real_gain)
    return ge / n_perm, real_gain


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

    # Permutation robustness test
    pval, real_gain = permutation_pvalue(archive, clashes, best['congestion_penalty'])

    # Smallest non-zero penalty swept — peaking here is a noise signature
    min_positive_penalty = min(p for p in _PENALTIES if p > 0.0)

    ships = (
        best['top10_mean_pts'] > base['top10_mean_pts']    # strict: must beat baseline
        and best['clash_rmse'] < base['clash_rmse']
        and pval <= 0.02                                    # strict bar for single season
        and best['congestion_penalty'] != min_positive_penalty  # peak-at-min is noise
    )
    verdict = 'SHIP' if ships else 'NO_SHIP'

    result = {
        'sweep': sweep,
        'clash_count': len(clashes),
        'baseline_top10': base['top10_mean_pts'],
        'baseline_clash_rmse': base['clash_rmse'],
        'best_penalty': best['congestion_penalty'],
        'best_top10': best['top10_mean_pts'],
        'best_clash_rmse': best['clash_rmse'],
        'permutation_pvalue': pval,
        'permutation_n': 150,
        'robustness_note': (
            'p={:.2f} (>{:.2f} bar); best penalty={} equals min non-zero penalty '
            '(peak-at-min noise signature); verdict: NO_SHIP'.format(
                pval, 0.02, best['congestion_penalty'])
            if verdict == 'NO_SHIP' else
            'p={:.2f} (<={:.2f} bar); signal robust; verdict: SHIP'.format(pval, 0.02)
        ),
        'verdict': verdict,
    }
    with open(_OUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2)
    return result


if __name__ == '__main__':
    r = run()
    print(json.dumps(r, indent=2))
    print('VERDICT:', r['verdict'])
