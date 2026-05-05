"""Run Monte Carlo simulations per player per upcoming GW (Phase 61 MC-01).

Mirrors pipeline/bonus.py shape: post-merge module called from pipeline/run.py
between merge_players() and save('merged_players.json', merged). Reads no JSON
files; receives the merged list and the xmins_v2_enabled gate flag as params.

Algorithm (per active player, per fixture):
  - lam_g = xg_per90 * xmins/90      (Poisson goal lambda)
  - lam_a = xa_per90 * xmins/90      (Poisson assist lambda)
  - cs_prob via _cs_prob_sim         (Bernoulli CS probability)
  - bonus_det = BONUS_RATE[et] * xmins/90   (deterministic per iteration)
  - appear_det = start_prob * 2              (deterministic per iteration)
  - total_pts = goals*GOAL_PTS[et] + assists*ASSIST_PTS + cs*CS_PTS[et]
              + bonus_det + appear_det
  - DGW: sum total_pts across both fixtures per iteration (D-09)
  - blank_prob = mean(total_pts <= 2), haul_prob = mean(total_pts >= 10)
  - p10_pts = percentile(total_pts, 10), p90_pts = percentile(total_pts, 90)

BGW guard (D-08): xmins <= 0 OR start_prob <= 0 -> blank_prob=1.0, others 0.0.

D-05 invariant: p90_pts overwrites the analytical xPts_90th_1gw (sigma-derived)
field written by merge.py at line 1122.

D-02: _cs_prob is re-implemented inline as _cs_prob_sim — no import from merge.py.
D-03: xmins_v2_enabled comes from run.py (line 190); when True, mins_60_prob is
the cs_prob mins_factor; when False, fall back to xmins/60 ratio (matches merge.py).
D-04: N_SIMS=10_000 fixed, NumPy vectorized via rng.poisson/binomial size=N_SIMS.
"""

from itertools import groupby

import numpy as np

# Phase 61 MC-01 — fixed simulation budget (D-04)
N_SIMS = 10_000

# Per-position scoring constants (mirror pipeline/merge.py constants verbatim)
# Position code: 1=GK, 2=DEF, 3=MID, 4=FWD
GOAL_PTS = {1: 6, 2: 6, 3: 5, 4: 4}
ASSIST_PTS = 3
CS_PTS = {1: 6, 2: 6, 3: 1, 4: 0}
BONUS_RATE = {1: 0.30, 2: 0.40, 3: 0.60, 4: 0.70}


def _cs_prob_sim(dd: float, xmins: float, mins_60_prob: float | None) -> float:
    """Bernoulli CS probability per fixture (mirrors merge.py:_cs_prob lines 141-146).

    D-02: inline re-implementation, no import from merge.py.
    D-03: xmins_v2_enabled gate handled by caller (passes mins_60_prob or None).
    """
    cs_prob_raw = max(0.10, min(0.65, 0.40 - dd * 0.30))
    mins_factor = mins_60_prob if mins_60_prob is not None else min(1.0, xmins / 60.0)
    return cs_prob_raw * mins_factor


def _simulate_player(p: dict, xmins_v2_enabled: bool, rng) -> dict:
    """Run N_SIMS Monte Carlo iterations for a single player. Returns 4 stats dict.

    BGW short-circuit (D-08): xmins <= 0 OR start_prob <= 0 -> 100% blank.
    DGW handling (D-09): groupby event_id, take first GW's fixtures, sum per-iteration.
    Returns rounded floats (3dp) matching existing xPts_* precision.
    """
    xmins = p.get('xmins', 0.0) or 0.0
    start_prob = p.get('start_prob', 0.0) or 0.0

    # BGW short-circuit (D-08)
    if xmins <= 0 or start_prob <= 0:
        return {'blank_prob': 1.0, 'haul_prob': 0.0, 'p10_pts': 0.0, 'p90_pts': 0.0}

    xg = p.get('xg_per90') or 0.0
    xa = p.get('xa_per90') or 0.0
    et = p.get('element_type', 3) or 3
    if et not in GOAL_PTS:
        et = 3
    m60 = p.get('mins_60_prob') if xmins_v2_enabled else None
    fixtures = p.get('fixtures', []) or []

    # First GW group only (D-09; matches merge.py _xpts_ngw groupby semantics)
    first_gw = []
    for _eid, group in groupby(fixtures, key=lambda f: f.get('event_id')):
        first_gw = list(group)
        break

    if not first_gw:
        return {'blank_prob': 1.0, 'haul_prob': 0.0, 'p10_pts': 0.0, 'p90_pts': 0.0}

    lam_g = xg * (xmins / 90.0)
    lam_a = xa * (xmins / 90.0)
    bonus_det = BONUS_RATE[et] * (xmins / 90.0)   # deterministic per iteration (Pitfall 1)
    appear_det = start_prob * 2                    # deterministic per iteration (Pitfall 1)

    total_pts = np.zeros(N_SIMS)
    for fix in first_gw:
        dd = fix.get('defensive_difficulty', 0.5)
        cs_prob = _cs_prob_sim(dd, xmins, m60)
        goals = rng.poisson(lam_g, size=N_SIMS)
        assists = rng.poisson(lam_a, size=N_SIMS)
        cs = rng.binomial(1, cs_prob, size=N_SIMS)
        total_pts += (
            goals * GOAL_PTS[et]
            + assists * ASSIST_PTS
            + cs * CS_PTS[et]
            + bonus_det
            + appear_det
        )

    return {
        'blank_prob': round(float(np.mean(total_pts <= 2)), 3),
        'haul_prob':  round(float(np.mean(total_pts >= 10)), 3),
        'p10_pts':    round(float(np.percentile(total_pts, 10)), 3),
        'p90_pts':    round(float(np.percentile(total_pts, 90)), 3),
    }


def compute_simulations(merged: list, xmins_v2_enabled: bool) -> list:
    """Run Monte Carlo simulations over the merged player list (Phase 61 MC-01).

    Args:
        merged: List of merged player dicts (output of merge.merge_players).
        xmins_v2_enabled: Gate flag (loaded by run.py from accuracy_backtest.json
                          summary at line 190). When True, _cs_prob_sim uses
                          mins_60_prob as the cs_prob mins_factor; when False,
                          falls back to xmins/60 ratio.

    Returns:
        Enriched copy of `merged`. Each player dict gains four new fields:
          - blank_prob: P(total_pts <= 2) across N_SIMS iterations
          - haul_prob: P(total_pts >= 10) across N_SIMS iterations
          - p10_pts: 10th percentile simulated points (floor)
          - p90_pts: 90th percentile simulated points (ceiling)
        And `xPts_90th_1gw` is overwritten with `p90_pts` (D-05 invariant).
    """
    rng = np.random.default_rng()
    result = []
    active_count = 0
    for player in merged:
        p = dict(player)
        sim = _simulate_player(p, xmins_v2_enabled, rng)
        p.update(sim)
        # D-05: overwrite analytical sigma-derived ceiling with MC-derived p90
        p['xPts_90th_1gw'] = sim['p90_pts']
        if sim['blank_prob'] != 1.0:
            active_count += 1
        result.append(p)
    print(f"MC simulations: {active_count} active players ({N_SIMS:,} sims each)")
    return result
