---
phase: 14-gemtable-mobile
plan: 01
subsystem: ui
tags: [tanstack-table, react, tailwind, mobile, responsive, sticky-column, expandable-rows]

# Dependency graph
requires:
  - phase: 13-navigation-layout-foundations
    provides: mobile viewport contract and overflow containment at html/body level
provides:
  - GemTable mobile column hiding (5 priority columns on <640px, all columns on desktop)
  - Sticky Player column (web_name fixed left with z-30/z-10 layering)
  - Tap-to-expand inline detail panel with all hidden column data as key-value pairs
  - MOBILE_HIDDEN_COLUMNS export from GwToggle for shared column set
affects:
  - 15-squadview-mobile
  - any phase that imports GwToggle or GemTable

# Tech tracking
tech-stack:
  added: []
  patterns:
    - isMobile via useEffect window.innerWidth < 640 (not useMediaQuery — avoids hydration mismatch)
    - getExpandedRowModel from @tanstack/react-table for inline expansion
    - MOBILE_HIDDEN_COLUMNS constant exported for reuse across phases
    - Sticky column z-index layering: z-30 (header corner), z-20 (other headers), z-10 (body cells)
    - Fragment wrapping tbody rows for adjacent sibling expansion rows

key-files:
  created: []
  modified:
    - src/components/gem-table/GwToggle.tsx
    - src/components/gem-table/GwToggle.test.ts
    - src/components/gem-table/GemTable.tsx

key-decisions:
  - "isMobile via window.innerWidth useEffect — consistent with Phase 13 CSS-only approach, avoids hydration mismatch"
  - "getColumnVisibility spread order: MOBILE_HIDDEN_COLUMNS first, gwVisibility second — active proj_pts column overrides false"
  - "HIDDEN_COLUMN_LABELS is a module-level constant in GemTable.tsx — labels are GemTable-specific presentation concern, not exported"
  - "row.getAllCells() (not getVisibleCells()) in expansion panel — must access hidden column data"

patterns-established:
  - "Mobile detection: useEffect + window.innerWidth < 640 with resize listener (sm breakpoint = 640px)"
  - "Sticky column: sticky left-0 z-30 bg-white on th, sticky left-0 z-10 bg-white on td"
  - "TanStack expand: getExpandedRowModel + getRowCanExpand + ExpandedState + onExpandedChange wired together"
  - "Expansion row: sm:hidden class ensures detail panel only visible on mobile"

requirements-completed: [MOB-TBL-01, MOB-TBL-05, MOB-TBL-06]

# Metrics
duration: 15min
completed: 2026-04-01
---

# Phase 14 Plan 01: GemTable Mobile Summary

**GemTable mobile-responsive: 5-column view on phones with sticky Player column and tap-to-expand row detail panel showing all 15 hidden columns as labelled key-value pairs**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-01T08:50:00Z
- **Completed:** 2026-04-01T08:52:30Z
- **Tasks:** 2 of 3 (Task 3 is human-verify checkpoint — awaiting visual verification)
- **Files modified:** 3

## Accomplishments
- Extended `getColumnVisibility` with `isMobile` parameter and `MOBILE_HIDDEN_COLUMNS` export (15 non-priority columns hidden on mobile; active proj_pts always visible via spread order)
- Added 3 new mobile visibility tests to GwToggle.test.ts; all 6 tests (3 existing + 3 new) pass
- Added `isMobile` state to GemTable via `useEffect` + `window.innerWidth < 640` with resize listener
- Sticky Player column with proper z-index layering (z-30 header, z-10 body cells, opaque bg-white backgrounds)
- Tap-to-expand rows on mobile using `getExpandedRowModel` + `ExpandedState`; detail panel renders all 15 hidden columns as labelled key-value grid
- Desktop GemTable completely unchanged — only `isMobile=false` path changes nothing

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend getColumnVisibility for mobile and add tests** - `8cae53d` (feat)
2. **Task 2: Add isMobile state, sticky Player column, and expandable rows to GemTable** - `57cfef6` (feat)
3. **Task 3: Visual verification** - pending checkpoint

## Files Created/Modified
- `src/components/gem-table/GwToggle.tsx` - Added MOBILE_HIDDEN_COLUMNS export, isMobile parameter to getColumnVisibility
- `src/components/gem-table/GwToggle.test.ts` - Added 3 new mobile visibility tests
- `src/components/gem-table/GemTable.tsx` - isMobile state, sticky Player column, expandable rows with HIDDEN_COLUMN_LABELS detail panel

## Decisions Made
- `isMobile` via `useEffect` + `window.innerWidth` (not `useMediaQuery`) — consistent with Phase 13 decision to avoid hydration mismatch
- Spread order `{ ...MOBILE_HIDDEN_COLUMNS, ...gwVisibility }` ensures active proj_pts column overrides the `false` in MOBILE_HIDDEN_COLUMNS
- `HIDDEN_COLUMN_LABELS` defined locally in GemTable.tsx (not exported from GwToggle) — label presentation is GemTable-specific, not a shared concern
- `row.getAllCells()` in expansion panel to access hidden column data (not `getVisibleCells()` which would miss the hidden columns)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all data is wired from live player data. The expansion panel renders real cell values via `flexRender`.

## Next Phase Readiness
- GemTable mobile features complete and awaiting visual verification (Task 3 checkpoint)
- After checkpoint approval, Phase 14 is complete
- Phase 15 (SquadView mobile) can reuse the `isMobile` pattern established here
- MOBILE_HIDDEN_COLUMNS export available for any future table needing the same column set

---
*Phase: 14-gemtable-mobile*
*Completed: 2026-04-01*
