---
phase: 24-squad-snapshot
plan: 01
subsystem: planning-engine
tags: [typescript, vitest, tdd, squad-snapshot, planning-engine]

# Dependency graph
requires:
  - phase: 22-planning-engine
    provides: generatePlan function and positionMap internal tracking
  - phase: 23-transfer-output-table
    provides: PlanStep interface and TransferPlanTable consuming PlanStep
provides:
  - positionsAfter: Record<number, number> on PlanStep interface
  - positionMap snapshot logic in generatePlan (after transfer application)
  - 3 unit tests covering full squad mapping, transfer inheritance, hold steps
affects:
  - 24-squad-snapshot (plan 02 — squad accordion needs positionsAfter to render starting XI vs bench)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "positionMap snapshotted to positionsAfter Record after transfer block, before PlanStep construction"
    - "TDD: RED commit with failing type + test, GREEN commit with implementation"

key-files:
  created: []
  modified:
    - src/lib/types.ts
    - src/lib/planning-engine.ts
    - tests/lib/planning-engine.test.ts

key-decisions:
  - "positionsAfter snapshot taken AFTER positionMap.delete/set block so bought player position is correct"
  - "positionsAfter uses Record<number, number> (plain object, not Map) to keep PlanStep JSON-serializable"

patterns-established:
  - "positionsAfter: Record<number, number> maps player ID to FPL squad position (1-11 starting, 12-15 bench)"

requirements-completed: [PLAN-06]

# Metrics
duration: 8min
completed: 2026-04-02
---

# Phase 24 Plan 01: Squad Snapshot - positionsAfter on PlanStep Summary

**positionsAfter: Record<number, number> added to PlanStep interface and populated from positionMap in generatePlan, enabling squad accordion to know starting XI vs bench for each GW step**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-02T23:00:00Z
- **Completed:** 2026-04-02T23:08:00Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments

- Extended `PlanStep` interface with `positionsAfter: Record<number, number>` and JSDoc comment
- Populated `positionsAfter` from `positionMap` in `generatePlan` after transfer application block
- Added 3 new unit tests (full squad mapping, transfer position inheritance, hold step)
- Full test suite passes: 235 tests, 0 regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add positionsAfter to PlanStep type and write failing tests** - `6b50635` (test)
2. **Task 2: Populate positionsAfter in generatePlan (GREEN + REFACTOR)** - `964e0c9` (feat)

_Note: TDD tasks have two commits (test RED → feat GREEN)_

## Files Created/Modified

- `src/lib/types.ts` - Added `positionsAfter: Record<number, number>` field with JSDoc to PlanStep interface
- `src/lib/planning-engine.ts` - Added positionMap snapshot logic and positionsAfter to PlanStep construction
- `tests/lib/planning-engine.test.ts` - Added `describe('generatePlan - positionsAfter')` with 3 tests

## Decisions Made

- positionsAfter snapshot taken AFTER the `positionMap.delete/set` block so the bought player's position is correctly captured (not the sold player's)
- Used `Record<number, number>` (plain object) over `Map<number, number>` to keep PlanStep JSON-serializable for any future persistence or serialization needs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `positionsAfter` is populated on every `PlanStep` from `generatePlan`
- Plan 02 can now build the squad snapshot accordion, reading `positionsAfter` to determine which players are in starting XI (positions 1-11) vs bench (12-15)
- No blockers

---
*Phase: 24-squad-snapshot*
*Completed: 2026-04-02*
