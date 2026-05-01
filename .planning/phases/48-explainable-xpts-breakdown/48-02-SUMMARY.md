---
phase: 48-explainable-xpts-breakdown
plan: "02"
subsystem: ui
tags: [typescript, types, vitest, xpts, testing]

# Dependency graph
requires:
  - phase: 48-explainable-xpts-breakdown-plan-01
    provides: pipeline appearance_pts field in merged_players.json
provides:
  - xPts_components_1gw TypeScript type extended with appearance_pts: number field
  - PlayerComparisonModal test mocks updated to satisfy new type contract
affects:
  - 48-03 (XPtsCell hover card — reads appearance_pts from components prop)
  - any future plan consuming xPts_components_1gw type

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Type extension pattern: add new required field to existing optional object type, update all downstream mocks in same phase"

key-files:
  created: []
  modified:
    - src/lib/types.ts
    - src/components/gem-table/PlayerComparisonModal.test.tsx

key-decisions:
  - "appearance_pts placed last in field order (goal_pts, assist_pts, cs_pts, bonus_pts, appearance_pts) to match pipeline dict order per D-01"
  - "Comment updated from 'tooltip data' to 'hover card data' to reflect Phase 48 D-03 interaction design change"

patterns-established:
  - "When extending a shared type, grep for all mock usages and update them atomically in the same plan to prevent TS compile failures downstream"

requirements-completed:
  - XPT-01
  - XPT-02
  - XPT-03
  - XPT-04

# Metrics
duration: 2min
completed: 2026-05-01
---

# Phase 48 Plan 02: Explainable xPts Breakdown — Type Contract Extension Summary

**TypeScript xPts_components_1gw type extended with `appearance_pts: number` and both PlayerComparisonModal mock objects updated to satisfy the new type contract**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-01T17:19:09Z
- **Completed:** 2026-05-01T17:20:41Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `appearance_pts: number` as fifth field in `xPts_components_1gw` type (Plan 03 XPtsCell hover card can now render all 5 components)
- Updated inline type comment from "tooltip data" to "hover card data" matching D-03 interaction design
- Added comment `// Phase 48 XPT-01/XPT-02: start_prob × 2 per fixture` for formula traceability
- Both PLAYER_A (1.96) and PLAYER_B (1.94) mocks in PlayerComparisonModal.test.tsx updated — 6/6 modal tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend MergedPlayer.xPts_components_1gw type in types.ts** - `310c6b2` (feat)
2. **Task 2: Add appearance_pts to PlayerComparisonModal.test.tsx mock objects** - `b197496` (test)

## Files Created/Modified

- `src/lib/types.ts` — xPts_components_1gw type block: added `appearance_pts: number` field, updated comment to "hover card data"
- `src/components/gem-table/PlayerComparisonModal.test.tsx` — PLAYER_A mock: `appearance_pts: 1.96`; PLAYER_B mock: `appearance_pts: 1.94`

## Decisions Made

- Field order `appearance_pts` placed last (after `bonus_pts`) to match pipeline dict order as specified in plan action
- Mock values chosen as `start_prob × 2` for realistic near-certain starters (0.98 → 1.96, 0.97 → 1.94)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

A pre-existing test failure in `tests/lib/club-form.test.ts` was present before and after this plan's changes (1 test failing in `computeClubForm > assigns difficulty tier correctly`). This is out of scope — not caused by changes in this plan and logged as a pre-existing issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 (XPtsCell hover card) can now import `xPts_components_1gw` with `appearance_pts` in the `components` prop type without TypeScript errors
- The `XPtsCell` component in `columns.tsx` needs updating to add `appearance_pts` to its inline prop type — Plan 03 covers this
- Full vitest suite: 45 test files pass, 1 pre-existing failure in club-form unrelated to Phase 48

---
*Phase: 48-explainable-xpts-breakdown*
*Completed: 2026-05-01*
