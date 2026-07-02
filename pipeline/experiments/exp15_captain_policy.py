"""CAP-05 / exp15: gate the attacker-first captain policy (exp13 shadow).

exp13 showed attacker-first (best MID/FWD by mean xPts) out-captained the
all-position rule 6.50 vs 6.19 pts/GW over 32 GWs — but with no controls.
This experiment adds them:

  placebo      random pick from the GW's top-5 xPts (100 seeds, mean of means)
  bootstrap    paired resample of per-GW (attacker - top_xpts) differences,
               10k iterations — P(mean diff > 0)

SHIP iff P(attacker beats top_xpts) >= 0.80 AND attacker's per-GW mean beats
the placebo mean. SHIP promotes the shadow to a first-class captain_picks key
(display remains a product decision).

Run:  cd pipeline; python -m experiments.exp15_captain_policy
"""
import json
import os
import random
from collections import defaultdict

from backtest import run_backtest
from capture_season import load_season_archive
from experiments.exp13_decision_autopsy import captain_policies, _value_lookup

_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                    'exp15_captain_policy.json')
FIRST_GW = 7
LAST_GW = 38
BOOTSTRAP_N = 10_000
PLACEBO_SEEDS = 100
SHIP_PROB = 0.80


def run():
    archive = load_season_archive()
    bt = run_backtest(archive, mode='deploy', first_gw=FIRST_GW, last_gw=LAST_GW)
    values = _value_lookup(archive)
    rows_by_gw = defaultdict(list)
    for r in bt['rows']:
        rows_by_gw[r['gw']].append(r)

    summary, detail = captain_policies(rows_by_gw, values)

    # Paired per-GW differences: attacker-first minus current rule.
    diffs = [g['top_attacker']['pts'] - g['top_xpts']['pts'] for g in detail]
    n = len(diffs)

    rng = random.Random(42)
    boot_means = []
    for _ in range(BOOTSTRAP_N):
        sample = [diffs[rng.randrange(n)] for _ in range(n)]
        boot_means.append(sum(sample) / n)
    boot_means.sort()
    p_better = sum(1 for m in boot_means if m > 0) / BOOTSTRAP_N
    ci_lo = boot_means[int(0.025 * BOOTSTRAP_N)]
    ci_hi = boot_means[int(0.975 * BOOTSTRAP_N)]

    # Placebo: random top-5-xPts captain, averaged over many seeds.
    placebo_means = []
    for seed in range(PLACEBO_SEEDS):
        prng = random.Random(seed)
        total = 0.0
        for gw in sorted(rows_by_gw):
            rws = sorted(rows_by_gw[gw], key=lambda r: -r['xpts_pred'])[:5]
            total += prng.choice(rws)['actual_pts']
        placebo_means.append(total / n)
    placebo_mean = sum(placebo_means) / len(placebo_means)

    attacker_mean = summary['top_attacker']['mean_captain_pts']
    verdict = ('SHIP' if (p_better >= SHIP_PROB
                          and attacker_mean > placebo_mean) else 'NO_SHIP')

    out = {'experiment': 'exp15_captain_policy', 'verdict': verdict,
           'n_gws': n,
           'top_xpts_mean': summary['top_xpts']['mean_captain_pts'],
           'top_attacker_mean': attacker_mean,
           'placebo_top5_mean': round(placebo_mean, 2),
           'mean_diff': round(sum(diffs) / n, 3),
           'p_attacker_better': round(p_better, 3),
           'diff_ci95': [round(ci_lo, 2), round(ci_hi, 2)],
           'ship_rule': f'P(diff>0) >= {SHIP_PROB} AND beats placebo mean',
           'config': {'first_gw': FIRST_GW, 'last_gw': LAST_GW,
                      'bootstrap_n': BOOTSTRAP_N,
                      'placebo_seeds': PLACEBO_SEEDS}}
    with open(_OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)

    print(f"exp15 captain policy gate  GW{FIRST_GW}-{LAST_GW}  verdict: {verdict}")
    print(f"  top_xpts {out['top_xpts_mean']}  attacker {attacker_mean}  "
          f"placebo(top5 random) {placebo_mean:.2f}")
    print(f"  mean diff {out['mean_diff']:+.3f}/GW  "
          f"P(better) {p_better:.2f}  CI95 [{ci_lo:.2f}, {ci_hi:.2f}]")
    print(f"  written: {_OUT}")
    return out


if __name__ == '__main__':
    run()
