"""ML-01 / exp11: ML shadow model vs the formula model on the 2025/26 archive.

Run:  cd pipeline; python -m experiments.exp11_ml_shadow

GROUNDWORK ONLY — in-sample, one season. Train/test share players across halves,
so the model memorizes player-level scoring and the numbers OVERSTATE true edge.
This is a harness sanity check, NOT a promotion signal. No SHIP/NO_SHIP verdict.
Real validation is gated on a cold 2026/27 cross-season test.
"""
import json
import os

from capture_season import load_season_archive
from backtest import run_backtest, compute_metrics, DEFAULT_PARAMS
from ml.features import build_dataset, FEATURE_NAMES
from ml.model import train_position_models, predict

_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'exp11_ml_shadow.json')
_TRAIN_LAST = 28   # train GW7-28
_TEST_FIRST = 29   # test GW29-38

CAVEAT = ("IN-SAMPLE shadow over one season — train/test share players across halves, "
          "so the model memorizes player-level scoring and these numbers OVERSTATE true "
          "edge. Harness sanity check, NOT a promotion signal. Promotion is gated on a "
          "cold 2026/27 cross-season test (train 2025/26 -> predict 2026/27 unseen).")


def run():
    archive = load_season_archive()
    params = dict(DEFAULT_PARAMS)
    rows, names = build_dataset(archive, params, first_gw=7, last_gw=38)

    train = [r for r in rows if r['gw'] <= _TRAIN_LAST]
    test = [r for r in rows if r['gw'] >= _TEST_FIRST]
    models = train_position_models(train, names, seed=42)
    preds = predict(models, test, names)

    # assemble ML rows in the run_backtest schema, score with the shared yardstick
    ml_rows = []
    for r, p in zip(test, preds):
        ml_rows.append({
            'player_id': r['player_id'], 'web_name': r['web_name'],
            'element_type': r['element_type'], 'gw': r['gw'],
            'xpts_pred': round(p, 3), 'actual_pts': r['label'],
            'actual_minutes': r['actual_minutes'],
            'xmins_used': 0.0, 'xg_per90': 0.0, 'xa_per90': 0.0,
            'n_fixtures': r['n_fixtures'], 'congestion_clash': False,
        })
    ml_metrics, _ = compute_metrics(ml_rows)

    # formula model on the same GW29-38 window
    formula = run_backtest(archive, mode='deploy', first_gw=_TEST_FIRST, last_gw=38)
    formula_metrics = formula['metrics']

    importances = {}
    for et, model in sorted(models.items()):
        imp = model.feature_importances_
        importances[et] = {names[i]: round(float(imp[i]), 4) for i in range(len(names))}

    result = {
        'ml_metrics': ml_metrics,
        'formula_metrics': formula_metrics,
        'feature_importances': importances,
        'caveat': CAVEAT,
        'config': {'train_gw': [7, _TRAIN_LAST], 'test_gw': [_TEST_FIRST, 38],
                   'n_train': len(train), 'n_test': len(test), 'seed': 42},
    }
    with open(_OUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2)
    return result


def _print(result):
    keys = ['top10_mean_pts', 'haul_hit_rate', 'haul_capture_20', 'captain_return_rate',
            'rmse', 'mae', 'spearman']
    print('=== ML shadow vs formula (GW29-38, IN-SAMPLE) ===')
    print(f"{'metric':22} {'ML':>10} {'formula':>10}")
    for k in keys:
        ml = result['ml_metrics'].get(k)
        fo = result['formula_metrics'].get(k)
        print(f"{k:22} {ml!s:>10} {fo!s:>10}")
    print('\n!!! CAVEAT:', result['caveat'])


if __name__ == '__main__':
    r = run()
    _print(r)
