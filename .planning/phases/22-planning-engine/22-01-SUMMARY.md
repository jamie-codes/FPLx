---
phase: 22-planning-engine
plan: 01
subsystem: planning
tags: [vitest, tdd, pure-function, transfer-engine, dgw, bgw, look-ahead]

# Dependency graph
requires:
  - phase: 21-planner-tab-shell-and-state-model
    provides: "FTState, GWStep, PlannerHorizon, PlannerChip, free-transfer-engine functions"
provides:
  - "generatePlan() pure function — multi-GW greedy + look-ahead transfer planner"
  - "fixtureCountForGw() — DGW(2)/normal(1)/BGW(0) fixture counting"
  - "ScoredTransfer, PlanStep, PlanResult types in src/lib/types.ts"
  - "17-test Vitest suite covering all PLAN-02/PLAN-03 behaviors"
affects: [23-planner-output-table, 24-squad-snapshot, 25-manual-edit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure function planning engine: no hooks, no side effects, fully testable"
    - "TDD RED/GREEN: failing tests first, then minimal implementation to pass"
    - "Greedy + 1-level look-ahead: LOOK_AHEAD_DISCOUNT=0.8 for GW+1 evaluation"
    - "Fixture-count scoring: proj_pts_1gw * fixtureCountForGw (D-02)"
    - "Hit threshold guard: hit only suggested when netGain > 0 after -4 (D-03)"

key-files:
  created:
    - src/lib/planning-engine.ts
    - tests/lib/planning-engine.test.ts
  modified:
    - src/lib/types.ts

key-decisions:
  - "LOOK_AHEAD_DISCOUNT=0.8 per D-01; single GW+1 look-ahead depth, no deeper recursion"
  - "CANDIDATES_PER_POSITION=20 pre-filter by gem_score to bound the candidate search space"
  - "Starting XI only (positions 1-11) are sell candidates; bench (12-15) excluded per plan spec"
  - "All prices remain in tenths throughout; no float division before budget comparisons"
  - "snapshotSquad used at squad initialization to ensure originals are never mutated"

patterns-established:
  - "Plan 22: scoring uses proj_pts_1gw * fixtureCountForGw — never proj_pts_3gw/5gw"
  - "Plan 22: per D-03, hit suggested only when netGain > 0 after -4 deduction"
  - "Plan 22: sellPrices optional param — falls back to player.now_cost (D-04)"

requirements-completed: [PLAN-02, PLAN-03]

# Metrics
duration: 8min
completed: 2026-04-02
---

# Phase 22 Plan 01: Planning Engine Summary

**Pure TypeScript planning engine with greedy + 1-level look-ahead, DGW/BGW-aware scoring, hit cost threshold, and 17-test TDD suite covering all PLAN-02/PLAN-03 behaviors**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-02T15:23:00Z
- **Completed:** 2026-04-02T15:26:00Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 3

## Accomplishments

- Added `ScoredTransfer`, `PlanStep`, and `PlanResult` types to `src/lib/types.ts`
- Created 17-test Vitest suite covering all PLAN-02/PLAN-03 scenarios (basic shape, DGW/BGW, hit costs, FT chaining, look-ahead, budget, unconfirmed fixtures)
- Implemented `generatePlan()` pure function with greedy algorithm: per-GW sell/buy scoring, look-ahead discount, budget guard, FT state chaining, unconfirmed fixture detection
- Full test suite passes — 19 files, 222 tests, 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PlanResult types and write failing test suite (RED)** - `d0bcbc9` (test)
2. **Task 2: Implement generatePlan to pass all tests (GREEN)** - `da04298` (feat)

**Plan metadata:** (docs commit follows)

_Note: TDD tasks committed as test → feat per TDD execution flow_

## Files Created/Modified

- `src/lib/types.ts` — Added `ScoredTransfer`, `PlanStep extends GWStep`, `PlanResult` interfaces
- `src/lib/planning-engine.ts` — New: `generatePlan()` and `fixtureCountForGw()` pure functions
- `tests/lib/planning-engine.test.ts` — New: 17-test TDD suite with helper factories

## Decisions Made

- `LOOK_AHEAD_DISCOUNT = 0.8` — single GW+1 look-ahead per D-01; no deeper recursion needed for greedy approach
- `CANDIDATES_PER_POSITION = 20` — pre-filters candidate pool by gem_score to keep search bounded
- Starting XI only (positions 1-11) used as sell candidates; bench excluded per plan specification
- All price arithmetic in tenths throughout; never divide before comparing to avoid floating point issues
- `snapshotSquad` used at squad ID initialization to guarantee input array immutability

## Deviations from Plan

None — plan executed exactly as written. The import of `snapshotSquad` from `free-transfer-engine.ts` was correctly included per acceptance criteria; it wraps the initial squad copy at engine startup.

## Issues Encountered

None.

## Known Stubs

None — `generatePlan` is a pure function returning a complete `PlanResult`. No UI wiring occurs in this plan; that is the responsibility of Phase 23 (output table) and Phase 24 (squad snapshot).

## Next Phase Readiness

- `generatePlan` and `fixtureCountForGw` are fully tested and exported, ready for Phase 23 to wire into the Planner UI
- `PlanResult`/`PlanStep`/`ScoredTransfer` types are stable and ready for use in output table (Phase 23) and squad snapshot (Phase 24)
- No blockers

---
*Phase: 22-planning-engine*
*Completed: 2026-04-02*
