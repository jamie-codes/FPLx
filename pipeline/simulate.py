"""Run Monte Carlo simulations per player per upcoming GW (Phase 61 / Phase 90 MC-01).

Mirrors pipeline/bonus.py shape: post-merge module called from pipeline/run.py
between merge_players() and save('merged_players.json', merged). Reads no JSON
files; receives the merged list and the xmins_v2_enabled gate flag as params.

Algorithm (per active player, per fixture, per GW group up to 5):
  - lam_g = xg_per90 * xmins/90      (Poisson goal lambda)
  - lam_a = xa_per90 * xmins/90      (Poisson assist lambda)
  - cs_prob via _cs_prob_sim         (Bernoulli CS probability)
  - bonus_det = BONUS_RATE[et] * xmins/90   (deterministic per iteration)
  - appear_det = start_prob * 2              (deterministic per iteration)
  - gw_pts = goals*GOAL_PTS[et] + assists*ASSIST_PTS + cs*CS_PTS[et]
              + bonus_det + appear_det
  - DGW: sum gw_pts across both fixtures sharing the same event_id (D-09).
  - Cumulative across up to 5 GW groups: np.cumsum on column-stacked per-GW arrays.

Phase 61 fields (GW 1 only):
  blank_prob = mean(gw1_pts <= 2), haul_prob = mean(gw1_pts >= 10)
  p10_pts = percentile(gw1_pts, 10), p90_pts = percentile(gw1_pts, 90)

Phase 90 fields (cumulative 5-GW):
  xPts_5gw_p10/p50/p90 = percentiles of cumulative[:, -1] (5-GW total per iteration)
  rank_trajectory = length-5 position-relative percentile rank [0,1] per GW horizon (D-03)

BGW guard (D-08): xmins <= 0 OR start_prob <= 0 -> all MC fields zero.
BGW gap (Pitfall 1): fewer than 5 fixture groups -> missing GWs padded with np.zeros(N_SIMS).

D-05 invariant: p90_pts overwrites the analytical xPts_90th_1gw (sigma-derived) field
written by merge.py at line 1122.

D-02: N_SIMS = max(1000, int(os.environ.get('MC_ITERATIONS', 10_000)))  # 2026-07 audit: default matches the documented 10k — env-var configurable
      with hardcoded 1000-iteration floor; MC_SEED = int(os.environ.get('MC_SEED', 42))
      seeded for reproducible CI runs.
D-04: _cs_prob is re-implemented inline as _cs_prob_sim — no import from merge.py.
"""

import os
from collections import defaultdict
from itertools import groupby

import numpy as np

# Phase 90 MC-01 — env-var configurable simulation budget; minimum 1000 enforced (D-02)
# Replaces the Phase 61 hardcoded N_SIMS = 10_000.
N_SIMS = max(1000, int(os.environ.get('MC_ITERATIONS', 10_000)))  # 2026-07 audit: default matches the documented 10k
# Phase 90 MC-01 — seeded for reproducible CI runs (D-02)
MC_SEED = int(os.environ.get('MC_SEED', 42))

# Per-position scoring constants (mirror pipeline/merge.py constants verbatim)
# Position code: 1=GK, 2=DEF, 3=MID, 4=FWD
GOAL_PTS = {1: 6, 2: 6, 3: 5, 4: 4}
ASSIST_PTS = 3
CS_PTS = {1: 6, 2: 6, 3: 1, 4: 0}
BONUS_RATE = {1: 0.30, 2: 0.40, 3: 0.60, 4: 0.70}


def _cs_prob_sim(dd: float, xmins: float, mins_60_prob: float | None,
                 cs_prob_base: float = 0.40, cs_prob_slope: float = 0.30) -> float:
    """Bernoulli CS probability per fixture (mirrors merge.py:_cs_prob lines 141-146).

    D-02: inline re-implementation, no import from merge.py.
    D-03: xmins_v2_enabled gate handled by caller (passes mins_60_prob or None).
    """
    cs_prob_raw = max(0.10, min(0.65, cs_prob_base - dd * cs_prob_slope))
    mins_factor = mins_60_prob if mins_60_prob is not None else min(1.0, xmins / 60.0)
    return cs_prob_raw * mins_factor


def _simulate_player(p: dict, xmins_v2_enabled: bool, rng,
                     cs_prob_base: float = 0.40, cs_prob_slope: float = 0.30) -> dict:
    """Run N_SIMS Monte Carlo iterations for a single player over up to 5 GWs.

    Phase 61: returns 4 GW-1-only fields (`blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`).
    Phase 90: ALSO returns 4 cumulative 5-GW fields:
      - xPts_5gw_p10/p50/p90: percentiles of cumulative xPts over up to 5 GW groups.
      - _p50_by_horizon: length-5 list of cumulative p50 at each GW horizon (1..5).
        Stripped from the player dict in compute_simulations after rank_trajectory built.

    BGW short-circuit (D-08): xmins <= 0 OR start_prob <= 0 -> 100% blank, all MC fields zero.
    BGW gap (Pitfall 1): when fewer than 5 fixture groups exist, missing GWs contribute zero
      (np.zeros(N_SIMS) padded to length 5 before cumulative sum).
    DGW (D-09): groupby event_id; multiple fixtures sharing an event_id all sum into that GW's array.
    D-04 isolation: no import from merge.py; _cs_prob_sim is inline.
    """
    xmins = p.get('xmins', 0.0) or 0.0
    start_prob = p.get('start_prob', 0.0) or 0.0

    # BGW short-circuit (D-08): all 8 fields zero
    if xmins <= 0 or start_prob <= 0:
        return {
            'blank_prob': 1.0,
            'haul_prob': 0.0,
            'p10_pts': 0.0,
            'p90_pts': 0.0,
            'xPts_5gw_p10': 0.0,
            'xPts_5gw_p50': 0.0,
            'xPts_5gw_p90': 0.0,
            '_p50_by_horizon': [0.0, 0.0, 0.0, 0.0, 0.0],
        }

    xg = p.get('xg_per90') or 0.0
    xa = p.get('xa_per90') or 0.0
    et = p.get('element_type', 3) or 3
    if et not in GOAL_PTS:
        et = 3
    m60 = p.get('mins_60_prob') if xmins_v2_enabled else None
    fixtures = p.get('fixtures', []) or []

    # Collect up to 5 GW groups from fixtures (BGW gaps produce fewer groups; pad later).
    groups = []
    for _eid, group in groupby(fixtures, key=lambda f: f.get('event_id')):
        groups.append(list(group))
        if len(groups) >= 5:
            break

    # No fixtures at all: degrade to BGW shape
    if not groups:
        return {
            'blank_prob': 1.0,
            'haul_prob': 0.0,
            'p10_pts': 0.0,
            'p90_pts': 0.0,
            'xPts_5gw_p10': 0.0,
            'xPts_5gw_p50': 0.0,
            'xPts_5gw_p90': 0.0,
            '_p50_by_horizon': [0.0, 0.0, 0.0, 0.0, 0.0],
        }

    lam_g = xg * (xmins / 90.0)
    lam_a = xa * (xmins / 90.0)
    bonus_det = BONUS_RATE[et] * (xmins / 90.0)   # deterministic per iteration (Pitfall 1)
    appear_det = start_prob * 2                    # deterministic per iteration (Pitfall 1)

    # Per-GW points arrays — one np.array(N_SIMS) per GW, summed across all fixtures in that GW (DGW).
    total_pts_by_gw = []
    for gw_fixtures in groups:
        gw_pts = np.zeros(N_SIMS)
        for fix in gw_fixtures:
            dd = fix.get('defensive_difficulty', 0.5)
            cs_prob = _cs_prob_sim(dd, xmins, m60, cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope)
            goals = rng.poisson(lam_g, size=N_SIMS)
            assists = rng.poisson(lam_a, size=N_SIMS)
            cs = rng.binomial(1, cs_prob, size=N_SIMS)
            gw_pts += (
                goals * GOAL_PTS[et]
                + assists * ASSIST_PTS
                + cs * CS_PTS[et]
                + bonus_det
                + appear_det
            )
        total_pts_by_gw.append(gw_pts)

    # Pad BGW gaps with zeros up to length 5 (Pitfall 1)
    while len(total_pts_by_gw) < 5:
        total_pts_by_gw.append(np.zeros(N_SIMS))

    # cumulative shape: (N_SIMS, 5) — column h = cumulative xPts through GW h+1
    cumulative = np.cumsum(np.column_stack(total_pts_by_gw), axis=1)

    # Phase 61 GW-1 fields preserved verbatim (computed from total_pts_by_gw[0]).
    gw1_pts = total_pts_by_gw[0]

    return {
        # Phase 61 fields (GW 1 only — unchanged contract)
        'blank_prob': round(float(np.mean(gw1_pts <= 2)), 3),
        'haul_prob':  round(float(np.mean(gw1_pts >= 10)), 3),
        'p10_pts':    round(float(np.percentile(gw1_pts, 10)), 3),
        'p90_pts':    round(float(np.percentile(gw1_pts, 90)), 3),
        # Phase 90 fields (cumulative 5-GW)
        'xPts_5gw_p10': round(float(np.percentile(cumulative[:, -1], 10)), 3),
        'xPts_5gw_p50': round(float(np.percentile(cumulative[:, -1], 50)), 3),
        'xPts_5gw_p90': round(float(np.percentile(cumulative[:, -1], 90)), 3),
        '_p50_by_horizon': [
            round(float(np.percentile(cumulative[:, h], 50)), 3) for h in range(5)
        ],
    }


def compute_simulations(merged: list, xmins_v2_enabled: bool,
                        cs_prob_base: float = 0.40, cs_prob_slope: float = 0.30) -> list:
    """Run Monte Carlo simulations over the merged player list (Phase 61 / Phase 90 MC-01).

    Args:
        merged: List of merged player dicts (output of merge.merge_players).
        xmins_v2_enabled: Gate flag (loaded by run.py from accuracy_backtest.json
                          summary at line 199). When True, _cs_prob_sim uses
                          mins_60_prob as the cs_prob mins_factor; when False,
                          falls back to xmins/60 ratio.
        cs_prob_base: Intercept of the CS probability model (TUNE-01 tuned param; default 0.40).
        cs_prob_slope: Slope of the CS probability model (TUNE-01 tuned param; default 0.30).

    Returns:
        Enriched copy of `merged`. Each player dict gains:
          Phase 61 (GW 1):
            - blank_prob, haul_prob, p10_pts, p90_pts (xPts_90th_1gw overwritten with p90_pts)
          Phase 90 (5-GW cumulative):
            - xPts_5gw_p10, xPts_5gw_p50, xPts_5gw_p90
            - rank_trajectory: length-5 list of position-relative percentile ranks [0,1] (D-03)

    D-02: rng seeded from module-level MC_SEED (default 42); same instance used for all players.
    D-03: rank_trajectory[h] = percentile rank of player's cumulative p50 xPts at horizon h+1
          within the same-position pool (element_type 1=GK / 2=DEF / 3=MID / 4=FWD).
    """
    rng = np.random.default_rng(seed=MC_SEED)
    result = []
    active_count = 0
    for player in merged:
        p = dict(player)
        sim = _simulate_player(p, xmins_v2_enabled, rng, cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope)
        p.update(sim)
        # D-05: overwrite analytical sigma-derived ceiling with MC-derived p90
        p['xPts_90th_1gw'] = sim['p90_pts']
        if sim['blank_prob'] != 1.0:
            active_count += 1
        result.append(p)

    # rank_trajectory: cross-player ranking within each position pool, at each of 5 horizons (D-03).
    # Cannot be done inside _simulate_player — requires the full cohort. (Pitfall 6: degenerate pool of 1.)
    for h in range(5):
        pools = defaultdict(list)
        for p in result:
            pos = p.get('element_type')
            if pos not in (1, 2, 3, 4):
                continue
            val = p.get('_p50_by_horizon', [0.0] * 5)[h]
            pools[pos].append((val, p))
        for pos, pool in pools.items():
            pool.sort(key=lambda pair: pair[0])
            n = len(pool)
            denom = max(n - 1, 1)
            for rank_idx, (_val, p) in enumerate(pool):
                if 'rank_trajectory' not in p:
                    p['rank_trajectory'] = [0.0, 0.0, 0.0, 0.0, 0.0]
                p['rank_trajectory'][h] = round(rank_idx / denom, 4)

    # Strip scratch field before final return (Pitfall 2).
    for p in result:
        p.pop('_p50_by_horizon', None)

    print(f"MC simulations: {active_count} active players ({N_SIMS:,} sims each, seed={MC_SEED})")
    return result
