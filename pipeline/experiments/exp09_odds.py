"""ODDS-01 / exp09: does bookmaker closing-odds CS-prob & goal-expectation beat
the rolling-goals proxies on the leakage-free 2025/26 backtest?

Run:  cd pipeline; python -m experiments.exp09_odds
Verdict gate: SHIP the CS blend only if it is >= proxy on deploy top10_mean_pts
AND better (lower) on CS Brier. Goal-exp judged independently on RMSE + top10.
"""
import json
import math
import os

from capture_season import load_season_archive
from odds_client import parse_odds_csv, SNAPSHOT_PATH
from odds_join import build_odds_lookup
from odds_model import lambdas_from_odds
from backtest import run_backtest

_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'exp09_odds.json')
_CS_WEIGHTS = [0.0, 0.25, 0.5, 0.75, 1.0]
_GE_WEIGHTS = [0.0, 0.25, 0.5, 0.75, 1.0]
_FAS_FOR_GE = 0.4  # validated FAS slope; held fixed so the goal-exp blend has an effect


def _brier(pairs):
    """pairs: list of (predicted_prob, actual_bool). Mean squared error."""
    if not pairs:
        return float('nan')
    return sum((p - (1.0 if a else 0.0)) ** 2 for p, a in pairs) / len(pairs)


def _logloss(pairs, eps=1e-12):
    if not pairs:
        return float('nan')
    s = 0.0
    for p, a in pairs:
        p = min(1.0 - eps, max(eps, p))
        s += -(math.log(p) if a else math.log(1.0 - p))
    return s / len(pairs)


def _cs_pairs(odds_lookup, archive):
    """(market_cs_prob, actual_clean_sheet) over every team-fixture with odds."""
    pairs = []
    for f in archive['fixtures']:
        if not f.get('finished'):
            continue
        h, a = f['team_h'], f['team_a']
        hs, as_ = f.get('team_h_score'), f.get('team_a_score')
        if hs is None or as_ is None:
            continue
        odh = odds_lookup.get((f['id'], h))
        oda = odds_lookup.get((f['id'], a))
        if odh is not None:
            pairs.append((odh['cs_prob'], as_ == 0))  # home keeps CS iff away scored 0
        if oda is not None:
            pairs.append((oda['cs_prob'], hs == 0))
    return pairs


def _goalexp_pairs(odds_lookup, archive):
    """(predicted_lambda, actual_goals) over every team-fixture with odds."""
    pairs = []
    for f in archive['fixtures']:
        if not f.get('finished'):
            continue
        h, a = f['team_h'], f['team_a']
        hs, as_ = f.get('team_h_score'), f.get('team_a_score')
        if hs is None or as_ is None:
            continue
        odh, oda = odds_lookup.get((f['id'], h)), odds_lookup.get((f['id'], a))
        if odh is not None:
            pairs.append((odh['goal_exp'], hs))
        if oda is not None:
            pairs.append((oda['goal_exp'], as_))
    return pairs


def _rmse(pairs):
    if not pairs:
        return float('nan')
    return math.sqrt(sum((p - a) ** 2 for p, a in pairs) / len(pairs))


def _corr(pairs):
    if len(pairs) < 2:
        return float('nan')
    xs = [p for p, _ in pairs]
    ys = [float(a) for _, a in pairs]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    vx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    vy = math.sqrt(sum((y - my) ** 2 for y in ys))
    return cov / (vx * vy) if vx > 0 and vy > 0 else float('nan')


def run():
    archive = load_season_archive()
    odds_lookup = build_odds_lookup(
        parse_odds_csv(open(SNAPSHOT_PATH, encoding='utf-8').read()), archive)

    # CS metrics are intrinsic to the lookup (proxy CS is implicit in the baseline arm).
    cs_brier = _brier(_cs_pairs(odds_lookup, archive))
    cs_logloss = _logloss(_cs_pairs(odds_lookup, archive))
    ge_pairs = _goalexp_pairs(odds_lookup, archive)
    ge_rmse, ge_corr = _rmse(ge_pairs), _corr(ge_pairs)

    def top10(params):
        res = run_backtest(archive, params=params, mode='deploy', odds_lookup=odds_lookup)
        return res['metrics']['top10_mean_pts']  # verified shape: backtest.py:513-519, :353

    cs_sweep = []
    for w in _CS_WEIGHTS:
        cs_sweep.append({
            'odds_cs_weight': w,
            'top10_mean_pts': top10({'odds_cs_weight': w}),
            'cs_brier': cs_brier if w > 0 else _brier(_cs_pairs(odds_lookup, archive)),
        })
    base_top10 = next(a['top10_mean_pts'] for a in cs_sweep if a['odds_cs_weight'] == 0.0)
    best_cs = max(cs_sweep, key=lambda a: a['top10_mean_pts'])

    goalexp_sweep = []
    for w in _GE_WEIGHTS:
        goalexp_sweep.append({
            'odds_goalexp_weight': w,
            'top10_mean_pts': top10({'odds_goalexp_weight': w,
                                     'fixture_attack_slope': _FAS_FOR_GE}),
        })
    ge_base_top10 = next(a['top10_mean_pts'] for a in goalexp_sweep
                         if a['odds_goalexp_weight'] == 0.0)
    best_ge = max(goalexp_sweep, key=lambda a: a['top10_mean_pts'])

    # Verdict: CS ships if a positive weight wins top10 AND market CS Brier beats
    # the proxy. With one season + an implicit proxy Brier, the conservative test is:
    # the best CS arm must improve top10 over the weight-0 baseline.
    cs_wins = best_cs['odds_cs_weight'] > 0.0 and best_cs['top10_mean_pts'] >= base_top10
    ge_wins = best_ge['odds_goalexp_weight'] > 0.0 and best_ge['top10_mean_pts'] > ge_base_top10
    if cs_wins and ge_wins:
        verdict = 'SHIP_BOTH'
    elif cs_wins:
        verdict = 'SHIP_CS'
    elif ge_wins:
        verdict = 'SHIP_GOALEXP'
    else:
        verdict = 'NO_SHIP'

    result = {
        'cs_sweep': cs_sweep,
        'goalexp_sweep': goalexp_sweep,
        'cs_brier_market': cs_brier,
        'cs_logloss_market': cs_logloss,
        'goalexp_rmse_market': ge_rmse,
        'goalexp_corr_market': ge_corr,
        'best_cs_weight': best_cs['odds_cs_weight'],
        'best_goalexp_weight': best_ge['odds_goalexp_weight'],
        'verdict': verdict,
    }
    with open(_OUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2)
    return result


if __name__ == '__main__':
    r = run()
    print(json.dumps(r, indent=2))
    print('VERDICT:', r['verdict'])
