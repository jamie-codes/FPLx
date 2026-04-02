---
phase: 21-planner-tab-shell-and-state-model
plan: "01"
subsystem: planner
tags: [tdd, types, free-transfer, pure-functions]
dependency_graph:
  requires: []
  provides: [planner-types, free-transfer-engine]
  affects: [phases/22, phases/23, phases/24, phases/25]
tech_stack:
  added: []
  patterns: [tdd-red-green, pure-functions, structuredClone]
key_files:
  created:
    - src/lib/free-transfer-engine.ts
    - tests/lib/free-transfer-engine.test.ts
  modified:
    - src/lib/types.ts
decisions:
  - "computeHitCost returns explicit 0 (not hits * -4 when hits===0) to avoid -0 IEEE754 artifact"
  - "snapshotSquad uses structuredClone for deep copy — chosen over JSON round-trip (no serialization edge cases) and spread (shallow only)"
metrics:
  duration: "~2 min"
  completed: "2026-04-02"
  tasks: 2
  files: 3
---

# Phase 21 Plan 01: Planner Types and Free Transfer Engine Summary

**One-liner:** Foundational planner type system and pure-function FT accumulation engine with TDD: 31 tests covering banking, wildcard reset, free hit pass-through, hit costs, and deep-copy squad snapshots.

## What Was Built

### `src/lib/types.ts` (modified)

Appended 5 planner type definitions after the existing `ClubForm` interface:

- `PlannerHorizon` — union type `1 | 2 | 3 | 4 | 5`
- `PlannerChip` — `'wildcard' | 'freehit' | 'bboost' | '3xc' | null`
- `FTState` — `{ available: number, banked: number }`
- `GWStep` — one gameweek step in the multi-GW plan
- `PlannerState` — top-level planner state (Phase 22+ will populate `planSteps`)

### `src/lib/free-transfer-engine.ts` (created)

Three pure exported functions implementing FPL free transfer rules:

- `computeNextFTState(currentAvailable, transfersUsed, chip)` — returns `FTState` for next GW
- `computeHitCost(available, transfersUsed, chip)` — returns 0 or negative multiple of 4
- `snapshotSquad<T>(squad)` — deep-copies an array via `structuredClone`

### `tests/lib/free-transfer-engine.test.ts` (created)

31 tests organised in 4 describe blocks:
- `computeNextFTState` — 9 tests (normal, wildcard, free hit, bboost, 3xc)
- `computeHitCost` — 8 tests (no hits, hits, chip exemptions)
- `full example sequence` — 7 tests (6-GW chain from CONTEXT.md + end-to-end)
- `snapshotSquad` — 5 tests (deep copy isolation, reference separation, empty array)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed -0 vs +0 in computeHitCost**
- **Found during:** Task 2 GREEN verification
- **Issue:** `0 * -4` produces `-0` in IEEE 754 arithmetic. Vitest's `Object.is` equality distinguishes `-0` from `+0`, causing 3 tests to fail on cases where transfersUsed <= available.
- **Fix:** Added `if (hits === 0) return 0` guard before `hits * -4` computation.
- **Files modified:** `src/lib/free-transfer-engine.ts`
- **Commit:** a51e177

## Test Results

```
Test Files  18 passed (18)
Tests       205 passed | 8 skipped (213)
```

No regressions. All 31 new FT engine tests pass.

## Known Stubs

None. This plan delivers pure-function logic with complete test coverage. No UI components or data wiring in this plan.

## Self-Check: PASSED
