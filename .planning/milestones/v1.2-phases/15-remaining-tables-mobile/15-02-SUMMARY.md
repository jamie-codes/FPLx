---
phase: 15-remaining-tables-mobile
plan: 02
subsystem: ui
tags: [tanstack-table, mobile, responsive, column-visibility]

# Dependency graph
requires:
  - phase: 14-gemtable-mobile
    provides: isMobile + VisibilityState pattern established in GemTable.tsx

provides:
  - Mobile column hiding (isMobile + VisibilityState) in DefConTables.tsx
  - Mobile column hiding (isMobile + VisibilityState) in ClubFormTable.tsx
  - Mobile column hiding (isMobile + VisibilityState) in ValueGemsTable.tsx

affects: [15-remaining-tables-mobile, v1.2-mobile-milestone]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isMobile via window.innerWidth useEffect resize listener (consistent with Phase 14)"
    - "TanStack VisibilityState for declarative column hiding, wired to useReactTable state"

key-files:
  created: []
  modified:
    - src/components/defcon/DefConTables.tsx
    - src/components/club-form/ClubFormTable.tsx
    - src/components/value-gems/ValueGemsTable.tsx

key-decisions:
  - "Used window.innerWidth resize listener (not useMediaQuery) consistent with Phase 13/14 pattern to avoid hydration mismatch"
  - "DefConTables shares columnVisibility across both defTable and midFwdTable instances — single source of truth"

patterns-established:
  - "isMobile pattern: useState(false) + useEffect with window.innerWidth < 640 check and resize listener cleanup"
  - "VisibilityState: object with false-valued column IDs on mobile, empty object on desktop"

requirements-completed:
  - MOB-TBL-03
  - MOB-TBL-04

# Metrics
duration: 8min
completed: 2026-04-01
---

# Phase 15 Plan 02: Remaining Tables Mobile Summary

**DefConTables, ClubFormTable, and ValueGemsTable reduced to 4-5 priority columns on mobile via TanStack VisibilityState, matching the GemTable pattern from Phase 14**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-01T10:24:00Z
- **Completed:** 2026-04-01T10:32:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- DefConTables: hides hits, distance_to_threshold, fixture_correlation on mobile; shows Player, Team, Hit Rate, Avg DC/90 (4 columns); columnVisibility shared across both defTable and midFwdTable instances
- ClubFormTable: hides goals_scored, goals_conceded, upcoming on mobile; shows Team, W, D, L, GD (5 columns)
- ValueGemsTable: hides element_type, team_short_name, selected_by_percent, trend, fixtures on mobile; shows Player, Price, Gem, Pts (4 columns)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add mobile column hiding to DefConTables** - `43e502a` (feat)
2. **Task 2: Add mobile column hiding to ClubFormTable and ValueGemsTable** - `653b1fe` (feat)

**Plan metadata:** (final docs commit)

## Files Created/Modified
- `src/components/defcon/DefConTables.tsx` - Added isMobile state, VisibilityState hiding hits/distance/fixture_correlation, wired into both table instances
- `src/components/club-form/ClubFormTable.tsx` - Added isMobile state, VisibilityState hiding goals_scored/goals_conceded/upcoming
- `src/components/value-gems/ValueGemsTable.tsx` - Added isMobile state, VisibilityState hiding element_type/team_short_name/selected_by_percent/trend/fixtures

## Decisions Made
- Used window.innerWidth resize listener (not useMediaQuery) consistent with Phase 13/14 pattern — avoids hydration mismatch
- DefConTables shares a single `columnVisibility` constant wired to both table instances — simpler than duplicating state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three tables now fit within 375px on mobile
- Desktop layouts unchanged — all columns visible at >= 640px
- MOB-TBL-03 and MOB-TBL-04 requirements satisfied
- Phase 15 plan 01 (SquadView mobile) is the remaining task in this phase

---
*Phase: 15-remaining-tables-mobile*
*Completed: 2026-04-01*
