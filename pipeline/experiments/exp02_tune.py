"""Exp02: honest coordinate-descent re-tune over the season archive.

Train: GW7-28 (22 GWs). Validate: GW29-38 (10 GWs, untouched during selection).
Selection metric (train): top10_mean_pts (what following the picks earns),
tie-break haul_hit_rate. Two full passes of coordinate descent.

Run from pipeline/:  python experiments/exp02_tune.py
"""
import json
import sys
import time

sys.path.insert(0, '.')
from backtest import run_backtest, DEFAULT_PARAMS
from capture_season import load_season_archive

TRAIN = (7, 28)
VAL = (29, 38)

GRID = [
    ('blend_alpha',            [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]),
    ('form_window_gws',        [3, 4, 5, 6, 8]),
    ('cs_prob_base',           [0.30, 0.35, 0.40, 0.45, 0.50]),
    ('cs_prob_slope',          [0.15, 0.20, 0.25, 0.30, 0.35, 0.40]),
    ('cs_team_form_slope',     [0.0, 0.05, 0.10, 0.15, 0.20]),
    ('cs_def_form_window_gws', [3, 5, 6, 8, 10]),
    ('atf_slope',              [0.0, 0.10, 0.20, 0.30, 0.40]),
    ('atf_window_gws',         [3, 5, 6, 8, 10]),
    ('xmins_window',           [3, 4, 5, 6, 8]),
    ('min_prior_minutes',      [180, 270, 360]),
]


def score(metrics):
    return (round(metrics['top10_mean_pts'], 4),
            round(metrics['haul_hit_rate'] or 0.0, 4))


def evaluate(archive, params, gws):
    r = run_backtest(archive=archive, params=params,
                     first_gw=gws[0], last_gw=gws[1])
    return r['metrics']


def main():
    archive = load_season_archive()
    params = dict(DEFAULT_PARAMS)
    t0 = time.time()
    base_train = evaluate(archive, params, TRAIN)
    base_val = evaluate(archive, params, VAL)
    print(f'baseline train: top10={base_train["top10_mean_pts"]:.3f} '
          f'haul={base_train["haul_hit_rate"]:.4f}')
    print(f'baseline val:   top10={base_val["top10_mean_pts"]:.3f} '
          f'haul={base_val["haul_hit_rate"]:.4f}')

    history = []
    for pass_n in (1, 2):
        for name, candidates in GRID:
            best_val_for_param = params[name]
            best_score = score(evaluate(archive, params, TRAIN))
            for cand in candidates:
                if cand == params[name]:
                    continue
                trial = dict(params)
                trial[name] = cand
                s = score(evaluate(archive, trial, TRAIN))
                if s > best_score:
                    best_score = s
                    best_val_for_param = cand
            if best_val_for_param != params[name]:
                print(f'pass{pass_n} {name}: {params[name]} -> '
                      f'{best_val_for_param}  (train score {best_score})')
                params[name] = best_val_for_param
            history.append({'pass': pass_n, 'param': name,
                            'chosen': params[name],
                            'train_score': list(best_score)})

    tuned_train = evaluate(archive, params, TRAIN)
    tuned_val = evaluate(archive, params, VAL)
    print(f'\nelapsed {time.time() - t0:.0f}s')
    print('\n=== TUNED PARAMS ===')
    for k, v in params.items():
        marker = ' *' if v != DEFAULT_PARAMS[k] else ''
        print(f'  {k:24s} {v}{marker}')
    print('\n=== VALIDATION (GW29-38, untouched) ===')
    for k in ['haul_hit_rate', 'haul_capture_20', 'mid_tier_hit_rate',
              'captain_return_rate', 'top10_mean_pts', 'rmse', 'spearman']:
        print(f'  {k:22s} base={base_val[k]:.4f}  tuned={tuned_val[k]:.4f}')

    json.dump({'params': params, 'baseline_train': base_train,
               'baseline_val': base_val, 'tuned_train': tuned_train,
               'tuned_val': tuned_val, 'history': history},
              open('experiments/exp02_tune.json', 'w'), indent=1)
    print('\nsaved experiments/exp02_tune.json')


if __name__ == '__main__':
    main()
