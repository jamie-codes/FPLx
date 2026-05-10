---
phase: 90-monte-carlo-simulation-pipeline
plan: 02
subsystem: pipeline
tags: [monte-carlo, simulate, run, python, numpy, env-var, gate, rank-trajectory]

# Dependency graph
requires:
  - phase: 90-monte-carlo-simulation-pipeline-plan-01
    provides: 6 RED pytest test cases locking 5-GW MC spec; test_simulate.py with _five_gw_fixtures helper
  - phase: 61-mc-simulation-core
    provides: simulate.py baseline — compute_simulations, _simulate_player, _cs_prob_sim, 5 existing tests
provides:
  - simulate.py extended with 5-GW cumulative MC: xPts_5gw_p10/p50/p90, rank_trajectory per position pool
  - MC_ITERATIONS / MC_SEED env-var-configurable constants with 1000-iteration floor and seeded RNG
  - run.py mc_enabled gate: reads flag from accuracy_backtest.json, guards compute_simulations call
  - D-04 isolation preserved: no import from merge.py in simulate.py
affects:
  - 90-03 (accuracy.py mc_enabled gate plumbing — cold-start fallback)
  - downstream UI phases consuming xPts_5gw_p10/p50/p90 and rank_trajectory fields

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Phase 90 5-GW cumulative MC pattern: groupby all GW groups, np.cumsum on column-stacked arrays, BGW pad with zeros
    - rank_trajectory cross-player computation: defaultdict position pools per horizon, sort+normalize to [0,1]
    - mc_enabled gate pattern: initialize False, read from accuracy_backtest.json summary, guard call with if mc_enabled
    - Seeded RNG pattern: np.random.default_rng(seed=MC_SEED) — same instance for all players per run

key-files:
  created: []
  modified:
    - pipeline/simulate.py
    - pipeline/run.py

key-decisions:
  - "BGW short-circuit returns all 8 fields zero (including 5-GW fields) when xmins <= 0 or start_prob <= 0 — degenerate pool guard uses max(n-1, 1) for pools of size 1"
  - "rank_trajectory built after full per-player loop — cross-player ranking requires full cohort; _p50_by_horizon scratch field stripped before return"
  - "mc_enabled gate follows exact xmins_v2_enabled / bonus_predictor_enabled / save_predictor_enabled pattern in run.py — four surgical edits; initializer, try-block read, print, conditional call"

patterns-established:
  - "5-GW MC pattern: groups=[] + groupby[:5] + while pad to 5 + np.cumsum(np.column_stack(...))"
  - "Scratch field cleanup: p.pop('_p50_by_horizon', None) after rank_trajectory build"
  - "Gate guard: if mc_enabled: merged = compute_simulations(...) — exactly 8 leading spaces matching surrounding try block"

requirements-completed: [MC-01]

# Metrics
duration: ~20min
completed: 2026-05-10
---

# Phase 90 Plan 02: Monte Carlo 5-GW Extension — GREEN Phase A

**5-GW cumulative MC simulation in simulate.py with env-var N_SIMS/MC_SEED, rank_trajectory per position pool, and mc_enabled gate in run.py guarding compute_simulations call**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-10T11:32:00Z
- **Completed:** 2026-05-10T11:54:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended `pipeline/simulate.py` with 5-GW cumulative simulation: groupby all GW groups (up to 5), `np.cumsum` on column-stacked per-GW arrays, BGW pad with `np.zeros(N_SIMS)`, returns `xPts_5gw_p10/p50/p90` and `_p50_by_horizon` scratch field
- Added `rank_trajectory` cross-player computation in `compute_simulations`: `defaultdict` position pools per horizon, sort-and-normalize to [0,1], strip `_p50_by_horizon` scratch before return
- Replaced hardcoded `N_SIMS=10_000` with env-var form `max(1000, int(os.environ.get('MC_ITERATIONS', 1000)))` and added `MC_SEED = int(os.environ.get('MC_SEED', 42))`; seeded RNG via `np.random.default_rng(seed=MC_SEED)`
- Wired `mc_enabled` gate in `pipeline/run.py`: 4 surgical edits — initializer, try-block read from `accuracy_backtest.json`, print line, `if mc_enabled:` guard wrapping `compute_simulations` call
- All 11 `test_simulate.py` tests pass (5 Phase 61 + 6 Phase 90); all 187 pipeline tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend simulate.py — 5-GW cumulative MC, env-var N_SIMS/MC_SEED, rank_trajectory** - `bca0016` (feat)
2. **Task 2: Wire mc_enabled gate into run.py** - `e98e00b` (feat)

## Files Created/Modified

- `pipeline/simulate.py` — Extended with 5-GW cumulative `_simulate_player`, seeded RNG in `compute_simulations`, cross-player `rank_trajectory` computation block, `_p50_by_horizon` scratch strip; module docstring updated for Phase 90
- `pipeline/run.py` — Added `mc_enabled` gate initialization, read from backtest JSON, print statement, and `if mc_enabled:` guard around `compute_simulations` call

## Decisions Made

- BGW short-circuit returns all 8 fields zeroed (including Phase 90 fields) when `xmins <= 0` or `start_prob <= 0` — consistent with Phase 61 contract and D-08
- `rank_trajectory` cross-player computation uses `defaultdict` per horizon (not a list-of-dicts per PATTERNS.md alternative) — cleaner loop over 5 horizons with one `pools` dict per iteration
- Degenerate pool guard `max(n - 1, 1)` prevents division-by-zero when only 1 player in a position pool — required by Pitfall 6 from RESEARCH.md

## Deviations from Plan

None — plan executed exactly as written. All 4 surgical run.py edits applied precisely as specified. simulate.py implementation follows the PATTERNS.md code exactly.

## Issues Encountered

None. Tests passed on first implementation attempt — the RED tests from Plan 01 locked the spec precisely and the PATTERNS.md provided exact code to apply.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Wave 1 Plan B (Plan 03: `pipeline/accuracy.py` mc_enabled gate plumbing) can now proceed:
- `run.py` gate text is in place — `test_mc_enabled_off_skip` passes (it greps run.py source)
- `simulate.py` returns `xPts_5gw_p10/p50/p90` and `rank_trajectory` when `mc_enabled=True`
- Plan 03 needs to add `mc_enabled` to `accuracy_backtest.json` summary dict and cold-start fallback

---
*Phase: 90-monte-carlo-simulation-pipeline*
*Completed: 2026-05-10*
