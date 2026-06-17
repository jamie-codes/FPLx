"""AVAIL-01 / exp12: does injury gating improve the leakage-free backtest?

Baseline (no injury) vs treatment (injury-gated, avail_out_factor=0) vs a random
same-size placebo. SHIP only if treatment beats baseline on top-N / captaincy,
does not worsen RMSE, AND beats placebo on top-N. Injury flags are pre-deadline
information, so using the GW-N flag to predict GW-N is leakage-free.

Run:  cd pipeline; python -m experiments.exp12_avail
"""
import json
import os
import random

from capture_season import load_season_archive
from backtest import run_backtest
from injury_client import load_snapshot
from injury_join import build_backtest_injury_lookup, coverage_report

_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'exp12_avail.json')
_DOUBT_FACTOR = 0.5


def make_placebo_lookup(eligible_keys: list, n: int, seed: int = 42) -> dict:
    """Random same-size set of (gw, pid) 'out' flags drawn from eligible keys."""
    rng = random.Random(seed)
    n = min(n, len(eligible_keys))
    chosen = rng.sample(list(eligible_keys), n)
    return {k: 'out' for k in chosen}


def decide_verdict(base: dict, treat: dict, placebo: dict) -> str:
    """SHIP iff treatment improves top-N + captaincy vs baseline, does not worsen
    RMSE, and beats the placebo on top-N. Else NO_SHIP."""
    better_than_base = (treat['top10_mean_pts'] >= base['top10_mean_pts']
                        and treat['captain_return_rate'] >= base['captain_return_rate']
                        and treat['rmse'] <= base['rmse'])
    beats_placebo = treat['top10_mean_pts'] > placebo['top10_mean_pts']
    return 'SHIP' if (better_than_base and beats_placebo) else 'NO_SHIP'


def run():
    archive = load_season_archive()
    recs = load_snapshot()
    cov = coverage_report(recs, archive['bootstrap'])
    injury_lookup = build_backtest_injury_lookup(recs, archive)

    base = run_backtest(archive, mode='deploy')
    treat = run_backtest(archive, mode='deploy',
                         params={'avail_out_factor': 0.0, 'avail_doubt_factor': _DOUBT_FACTOR},
                         injury_lookup=injury_lookup)

    # eligible (gw, pid) keys = those the baseline actually scored, so the placebo
    # flags real predicted rows (same opportunity to change rankings as the real signal).
    eligible = [(r['gw'], r['player_id']) for r in base['rows']]
    placebo_lookup = make_placebo_lookup(eligible, n=len(injury_lookup))
    placebo = run_backtest(archive, mode='deploy',
                           params={'avail_out_factor': 0.0, 'avail_doubt_factor': _DOUBT_FACTOR},
                           injury_lookup=placebo_lookup)

    verdict = decide_verdict(base['metrics'], treat['metrics'], placebo['metrics'])
    result = {
        'baseline_metrics': base['metrics'],
        'treatment_metrics': treat['metrics'],
        'placebo_metrics': placebo['metrics'],
        'n_flagged': len(injury_lookup),
        'coverage': cov,
        'verdict': verdict,
        'config': {'avail_out_factor': 0.0, 'avail_doubt_factor': _DOUBT_FACTOR,
                   'placebo_seed': 42},
    }
    with open(_OUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2)
    return result


def _print(r):
    keys = ['top10_mean_pts', 'captain_return_rate', 'haul_capture_20', 'rmse', 'spearman']
    print('=== AVAIL-01 injury gating: baseline vs treatment vs placebo ===')
    print(f"{'metric':22} {'baseline':>10} {'treatment':>10} {'placebo':>10}")
    for k in keys:
        b = r['baseline_metrics'].get(k)
        t = r['treatment_metrics'].get(k)
        p = r['placebo_metrics'].get(k)
        print(f"{k:22} {b!s:>10} {t!s:>10} {p!s:>10}")
    print(f"\nflagged (gw,pid): {r['n_flagged']} | join coverage: "
          f"{r['coverage']['matched']} matched / {r['coverage']['unmatched']} unmatched")
    print('VERDICT:', r['verdict'])


if __name__ == '__main__':
    _print(run())
