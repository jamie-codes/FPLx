"""Exp05: final validation — promoted model vs old model + DGW handling check.

1. Old defaults vs promoted defaults (FAS-01 + DC-01 + honest-tuned form) over
   the full season and the validation window, in the BT-02 lab.
2. DGW validation (DGW-02 follow-up): in DGW gameweeks (26/33/36), are
   double-fixture players' predictions ~2x and is haul capture sane?
3. Retro picks table: the promoted model's weekly top-5 (deploy mode) with
   actual returns — the "would it have picked winners?" artifact.

Run from pipeline/:  python experiments/exp05_final_validation.py
"""
import json
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, '.')
from backtest import run_backtest
from capture_season import load_season_archive

OLD = {'blend_alpha': 0.0, 'form_window_gws': 5, 'min_prior_minutes': 270,
       'fixture_attack_slope': 0.0, 'defcon_scale': 0.0}
NEW = {'blend_alpha': 0.2, 'form_window_gws': 4, 'min_prior_minutes': 180,
       'fixture_attack_slope': 0.4, 'defcon_scale': 0.0}
DGW_GWS = [26, 33, 36]


def metrics_line(label, m):
    return (f"{label:18s} haul@10={m['haul_hit_rate']:.4f} "
            f"haul@20={m['haul_capture_20']:.4f} "
            f"top10pts={m['top10_mean_pts']:.3f} "
            f"capret={m['captain_return_rate']:.2f} "
            f"rmse={m['rmse']:.4f} spear={m['spearman']:.4f}")


def main():
    archive = load_season_archive()

    print('=== 1. OLD vs PROMOTED model (BT-02 lab) ===')
    results = {}
    for label, p in [('old', OLD), ('promoted', NEW)]:
        full = run_backtest(archive=archive, params=p, first_gw=7, last_gw=38)
        val = run_backtest(archive=archive, params=p, first_gw=29, last_gw=38)
        results[label] = {'full': full, 'val': val}
        print(metrics_line(f'{label} full GW7-38', full['metrics']))
        print(metrics_line(f'{label} val GW29-38', val['metrics']))

    print('\n=== 2. DGW validation (GW26/33/36) ===')
    new_full = results['promoted']['full']
    rows_by_gw = defaultdict(list)
    for r in new_full['rows']:
        rows_by_gw[r['gw']].append(r)
    for gw in DGW_GWS:
        rws = rows_by_gw.get(gw, [])
        if not rws:
            print(f'GW{gw}: no rows (outside eval range?)')
            continue
        dgw_rows = [r for r in rws if r['n_fixtures'] >= 2]
        sgw_rows = [r for r in rws if r['n_fixtures'] == 1]
        mean2 = (sum(r['xpts_pred'] for r in dgw_rows) / len(dgw_rows)
                 if dgw_rows else 0)
        mean1 = (sum(r['xpts_pred'] for r in sgw_rows) / len(sgw_rows)
                 if sgw_rows else 0)
        per_gw = [g for g in new_full['per_gw'] if g['gw'] == gw][0]
        print(f"GW{gw}: {len(dgw_rows)} double-fixture rows "
              f"(mean pred {mean2:.2f}) vs {len(sgw_rows)} single "
              f"(mean pred {mean1:.2f}) ratio={mean2/mean1 if mean1 else 0:.2f} | "
              f"haulers={per_gw['n_haulers']} hits={per_gw['haul_hits']} "
              f"top10pts={per_gw['top10_mean_pts']}")

    print('\n=== 3. Retro weekly top-5 picks (promoted model, deploy) ===')
    print(f"{'GW':>3s}  top-5 picks (pred -> actual)")
    season_top5_total = 0
    n_gw = 0
    for gw in sorted(rows_by_gw):
        rws = sorted(rows_by_gw[gw], key=lambda r: -r['xpts_pred'])[:5]
        season_top5_total += sum(r['actual_pts'] for r in rws)
        n_gw += 1
        picks = ', '.join(f"{r['web_name']}({r['xpts_pred']:.1f}->{r['actual_pts']})"
                          for r in rws)
        print(f'{gw:3d}  {picks}')
    print(f'\nmean actual pts of weekly top-5: '
          f'{season_top5_total / (5 * n_gw):.2f} per pick per GW')

    json.dump({
        'old_full': results['old']['full']['metrics'],
        'old_val': results['old']['val']['metrics'],
        'promoted_full': results['promoted']['full']['metrics'],
        'promoted_val': results['promoted']['val']['metrics'],
    }, open('experiments/exp05_final_validation.json', 'w'), indent=1)
    print('saved experiments/exp05_final_validation.json')


if __name__ == '__main__':
    main()
