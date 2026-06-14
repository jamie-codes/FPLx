"""Exp07 (VAR-01): does ranking CAPTAINCY by ceiling / attacking-EV beat mean-xPts?

Captaincy ≠ picks. exp04 showed mean-xPts wins for the picks LIST, but captaincy
doubles ONE player, so upside/variance should matter more — an unresolved question.

Method (offline re-ranking of run_backtest rows, NO re-prediction; mirrors exp04):
  - run_backtest(deploy, GW7-38) once → rows {player_id, gw, element_type, xpts_pred,
    xg_per90, xa_per90, xmins_used, n_fixtures, actual_pts}.
  - Captaincy pool = outfield only (element_type != 1; you don't captain keepers,
    matching the live captaincy engine).
  - Per GW, rank the pool by each KEY, take rank-1 = the captain, record actual_pts.
  - Keys:
      A_mean       = xpts_pred                              (current captain logic)
      C_ceiling    = xpts_pred + 1.28*sqrt(Poisson var)     (exp04 ceiling proxy)
      D_attacking  = lam_g*GOAL_PTS[et] + lam_a*ASSIST_PTS   (pure attacking EV)
  - Metrics per key: mean actual captain pts, return-rate (>=6), haul-rate (>=10),
    hit-rate (== GW max in pool).
  - Report on TRAIN GW7-28 (select), VALIDATION GW29-38 (judge), and the DGW subset
    GW26/33/36 (n_fixtures>=2 captains) where ceiling should matter most.

Promotion bar: a key must beat A_mean on VALIDATION mean-captain-pts (the points you'd
actually have banked) AND not regress haul-rate, with the DGW subset directionally
consistent. Else → rejected/inconclusive table (honest discipline).

Run from pipeline/:  python experiments/exp07_captaincy_ranking.py
"""
import json
import math
import sys
from collections import defaultdict

sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')
from backtest import run_backtest
from capture_season import load_season_archive

GOAL_PTS = {1: 6, 2: 6, 3: 5, 4: 4}
ASSIST_PTS = 3
PROMOTED = {'blend_alpha': 0.2, 'form_window_gws': 4, 'min_prior_minutes': 180,
            'fixture_attack_slope': 0.4}
TRAIN, VAL = (7, 28), (29, 38)
DGW_GWS = {26, 33, 36}


def ceiling_key(r):
    xm = r['xmins_used']
    lam_g = r['xg_per90'] * xm / 90.0
    lam_a = r['xa_per90'] * xm / 90.0
    sigma = math.sqrt(lam_g * GOAL_PTS[r['element_type']] ** 2 + lam_a * ASSIST_PTS ** 2)
    return r['xpts_pred'] + 1.28 * sigma


def attacking_key(r):
    xm = r['xmins_used']
    lam_g = r['xg_per90'] * xm / 90.0
    lam_a = r['xa_per90'] * xm / 90.0
    return lam_g * GOAL_PTS[r['element_type']] + lam_a * ASSIST_PTS


KEYS = {'A_mean': lambda r: r['xpts_pred'],
        'C_ceiling': ceiling_key,
        'D_attacking': attacking_key}


def captain_metrics(rows, gw_filter, dgw_only=False):
    """Per GW: pick rank-1 outfield by each key; aggregate the chosen captain's outcome."""
    by_gw = defaultdict(list)
    for r in rows:
        if r['element_type'] == 1:           # no GK captains
            continue
        if not gw_filter(r['gw']):
            continue
        if dgw_only and r['n_fixtures'] < 2:  # captaincy pool restricted to DGW players
            continue
        by_gw[r['gw']].append(r)

    out = {}
    for key_name, key_fn in KEYS.items():
        caps = []      # chosen captain's actual_pts per GW
        hits = 0       # chose the GW's max scorer (within pool)
        n = 0
        for gw, pool in by_gw.items():
            if not pool:
                continue
            cap = max(pool, key=key_fn)
            caps.append(cap['actual_pts'])
            if cap['actual_pts'] == max(p['actual_pts'] for p in pool):
                hits += 1
            n += 1
        if not caps:
            out[key_name] = None
            continue
        out[key_name] = {
            'n_gws': n,
            'mean_capt_pts': round(sum(caps) / len(caps), 3),
            'return_rate': round(sum(1 for c in caps if c >= 6) / len(caps), 3),
            'haul_rate': round(sum(1 for c in caps if c >= 10) / len(caps), 3),
            'hit_rate': round(hits / n, 3),
        }
    return out


def _print(label, m):
    print(f'\n=== {label} ===')
    print(f"{'key':13s} {'n':>3s} {'meanPts':>8s} {'ret>=6':>7s} {'haul>=10':>9s} {'hit=max':>8s}")
    for k in KEYS:
        v = m.get(k)
        if v is None:
            print(f'{k:13s}  (no data)')
            continue
        print(f"{k:13s} {v['n_gws']:3d} {v['mean_capt_pts']:8.2f} "
              f"{v['return_rate']:7.2f} {v['haul_rate']:9.2f} {v['hit_rate']:8.2f}")


def main():
    archive = load_season_archive()
    rows = run_backtest(archive=archive, params=PROMOTED,
                        first_gw=7, last_gw=38)['rows']
    print(f'rows: {len(rows)} (GW7-38, deploy)')

    full = captain_metrics(rows, lambda g: True)
    train = captain_metrics(rows, lambda g: TRAIN[0] <= g <= TRAIN[1])
    val = captain_metrics(rows, lambda g: VAL[0] <= g <= VAL[1])
    dgw = captain_metrics(rows, lambda g: g in DGW_GWS, dgw_only=True)

    _print('FULL GW7-38', full)
    _print('TRAIN GW7-28 (select)', train)
    _print('VALIDATION GW29-38 (judge)', val)
    _print('DGW captains (GW26/33/36, n_fixtures>=2)', dgw)

    base = val['A_mean']['mean_capt_pts'] if val['A_mean'] else 0
    print('\n=== verdict (validation mean-captain-pts vs A_mean) ===')
    for k in ('C_ceiling', 'D_attacking'):
        if val.get(k):
            delta = val[k]['mean_capt_pts'] - base
            print(f"  {k}: {val[k]['mean_capt_pts']:.2f} vs {base:.2f}  ({delta:+.2f})")

    json.dump({'full': full, 'train': train, 'val': val, 'dgw': dgw},
              open('experiments/exp07_captaincy_ranking.json', 'w'), indent=1)
    print('\nsaved experiments/exp07_captaincy_ranking.json')


if __name__ == '__main__':
    main()
