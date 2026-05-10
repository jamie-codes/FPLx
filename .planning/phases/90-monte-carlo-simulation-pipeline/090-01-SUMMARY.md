---
phase: 90-monte-carlo-simulation-pipeline
plan: 01
subsystem: testing
tags: [monte-carlo, pytest, typescript, tdd, red-phase, pipeline, types]

# Dependency graph
requires:
  - phase: 61-mc-simulation-core
    provides: simulate.py baseline — compute_simulations, _simulate_player, _cs_prob_sim, 5 existing tests
provides:
  - 6 RED pytest test cases for 5-GW MC simulation (Wave 0 test contract)
  - _five_gw_fixtures helper for multi-GW fixture construction in tests
  - MergedPlayer extended with xPts_5gw_p10, xPts_5gw_p50, xPts_5gw_p90, rank_trajectory optional fields
affects:
  - 90-02 (Wave 1 Plan A — simulate.py + run.py implementation must turn these 6 tests GREEN)
  - 90-03 (Wave 1 Plan B — accuracy.py gate plumbing; test_mc_enabled_off_skip passes when run.py gate text added)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED phase — 6 failing tests lock spec before implementation (Wave 0 → Wave 1 pattern)
    - importlib.reload pattern for env-var-driven module constant testing (MC_ITERATIONS, MC_SEED)
    - run.py source-grep pattern in test to assert gate text contract before code ships

key-files:
  created: []
  modified:
    - pipeline/tests/test_simulate.py
    - src/lib/types.ts

key-decisions:
  - "All 4 new MergedPlayer fields use ?: optional syntax — D-05 ensures graceful degrade when mc_enabled=OFF"
  - "test_mc_enabled_off_skip uses source-grep against run.py to lock the gate contract in plan 01 without importing run.py (avoids env side-effects)"
  - "6 new tests positioned after existing 5 tests — no modification to existing tests per TDD RED rule"
  - "_five_gw_fixtures helper uses keyword arg gws=(38,39,40,41,42) to allow custom event_id sequences in DGW/BGW tests"

patterns-established:
  - "importlib.reload(simulate) after monkeypatch.setenv — standard pattern for testing module-level env-var constants"
  - "Phase 90 comment block format: phase, gate condition, D-0x reference, absent-when semantics"

requirements-completed: [MC-01]

# Metrics
duration: 12min
completed: 2026-05-10
---

# Phase 90 Plan 01: Monte Carlo 5-GW Extension — Wave 0 RED Gate

**6 failing pytest tests lock the 5-GW MC simulation spec; MergedPlayer extended with 4 optional uncertainty-band fields gated by mc_enabled**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-10T11:20:00Z
- **Completed:** 2026-05-10T11:32:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `_five_gw_fixtures` helper and 6 new RED pytest cases to `pipeline/tests/test_simulate.py` — all failing for the right reasons (missing 5-GW fields, missing N_SIMS env-var handling, missing `mc_enabled` gate text in `run.py`)
- Extended `MergedPlayer` in `src/lib/types.ts` with 4 optional Phase 90 fields (`xPts_5gw_p10?`, `xPts_5gw_p50?`, `xPts_5gw_p90?`, `rank_trajectory?`) with full comment block documenting gate condition and D-03 semantics
- All 5 Phase 61 existing tests still passing; `npx tsc --noEmit` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 6 RED test cases to pipeline/tests/test_simulate.py** - `00f0817` (test)
2. **Task 2: Add 4 new optional MC fields to MergedPlayer in src/lib/types.ts** - `a2e2dab` (feat)

## Files Created/Modified

- `pipeline/tests/test_simulate.py` — appended `_five_gw_fixtures` helper + 6 new RED test functions; added `importlib` and `unittest.mock` imports
- `src/lib/types.ts` — inserted 4 optional fields + comment block after `p90_pts` (line 190); no existing fields modified

## Decisions Made

- test_mc_enabled_off_skip uses a source-grep approach against `run.py` rather than mocking `run.compute_simulations` — this avoids importing `run.py` at test collection time (which would trigger FPL API calls and environment loading). The test asserts the gate text contract exists as a file-level assertion; the behavioral mock is deferred to plan 02.
- `_five_gw_fixtures` uses a `gws` tuple parameter (default `(38,39,40,41,42)`) so DGW tests can construct custom event_id sequences without duplicating the helper.

## Deviations from Plan

None — plan executed exactly as written. The source-grep approach for `test_mc_enabled_off_skip` matches the plan specification (asserting `mc_enabled gate text exists in run.py`). All 6 tests fail for the specified reasons.

## Issues Encountered

None. The test failures are all precisely the expected RED failures:
- Tests 1, 2, 3, 5: `KeyError: 'xPts_5gw_p10'` / `AssertionError: 'xPts_5gw_p10' in r` — 5-GW fields don't exist yet
- Test 4: `AssertionError: floor not enforced: N_SIMS=10000` — `MC_ITERATIONS` env var not yet read from env (hardcoded `N_SIMS=10_000`)
- Test 6: `AssertionError: run.py is missing mc_enabled gate read` — gate text not yet added to run.py

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Wave 1 Plan 02 (`pipeline/simulate.py` + `pipeline/run.py` implementation) can now proceed:
- The 6 RED tests define the exact contracts that must be satisfied
- `_simulate_player` must return `xPts_5gw_p10/p50/p90` and `_p50_by_horizon` scratch field
- `compute_simulations` must compute `rank_trajectory` cross-player and strip scratch fields
- `N_SIMS = max(1000, int(os.environ.get('MC_ITERATIONS', 1000)))` must replace hardcoded 10,000
- `MC_SEED = int(os.environ.get('MC_SEED', 42))` must seed the RNG
- `run.py` must add `mc_enabled` gate read + `if mc_enabled:` guard

---
*Phase: 90-monte-carlo-simulation-pipeline*
*Completed: 2026-05-10*
