---
phase: 03-gem-rating-table
plan: 02
subsystem: ui
tags: [tanstack-table, react, nextjs, tailwind, gem-score, position-filter]

# Dependency graph
requires:
  - phase: 03-01
    provides: computeAllGemScores function and ScoredPlayer type
  - phase: 02-understat-pipeline-merged-data-api
    provides: usePlayers hook returning MergedPlayer[]
provides:
  - GemTable component with TanStack Table v8 sortable columns at /
  - PositionFilter component with numeric position code filtering
  - columns.tsx with createColumnHelper for all ScoredPlayer fields
  - Default route page.tsx rendering GemTable as server component
affects: [04-form-fixture-analysis, 05-team-input, 06-transfer-suggestions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "'use client' on interactive table component, server component page.tsx stays clean"
    - "column filterFn 'equals' on numeric element_type for position filtering"
    - "useMemo wrapping computeAllGemScores to avoid recomputing on every render"

key-files:
  created:
    - src/components/gem-table/columns.tsx
    - src/components/gem-table/PositionFilter.tsx
    - src/components/gem-table/GemTable.tsx
  modified:
    - src/app/page.tsx

key-decisions:
  - "page.tsx stays server component — GemTable carries all interactivity as 'use client'"
  - "Position filter passes numeric PositionCode (1/2/3/4), never string labels, to column filter"
  - "Null xG/xA scores display em-dash (\\u2014), not zero or empty string"
  - "gem_score displayed as 0-100 integer (multiplied by 100) for readability"

patterns-established:
  - "Pattern 1: TanStack Table v8 column filter on numeric element_type with filterFn 'equals'"
  - "Pattern 2: SortingState default [ { id: 'gem_score', desc: true } ] for best gems at top"
  - "Pattern 3: PositionFilter drives setColumnFilters — null position clears to empty array"

requirements-completed: [GEM-02, UIX-01, UIX-02]

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 3 Plan 02: GemTable UI Component Summary

**TanStack Table v8 GemTable at / with sortable columns, numeric position filter, em-dash null rendering, and default gem_score desc sort**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T17:57:00Z
- **Completed:** 2026-03-28T18:00:44Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- GemTable.tsx: 'use client' component consuming usePlayers + computeAllGemScores with full sort/filter interactivity
- columns.tsx: createColumnHelper column defs with null-safe renderers, filterFn 'equals' on element_type, em-dash for null xG/xA
- PositionFilter.tsx: All/GK/DEF/MID/FWD buttons passing numeric PositionCode (not string labels)
- page.tsx: clean server component at / importing and rendering GemTable

## Task Commits

Each task was committed atomically:

1. **Task 1: Create column definitions and PositionFilter component** - `c7cacc4` (feat)
2. **Task 2: Create GemTable component and wire to page.tsx** - `d946a65` (feat)

## Files Created/Modified
- `src/components/gem-table/columns.tsx` - TanStack column defs for ScoredPlayer, null-safe formatters, filterFn equals
- `src/components/gem-table/PositionFilter.tsx` - Position filter buttons with PositionCode | null state
- `src/components/gem-table/GemTable.tsx` - Main 'use client' table component with useReactTable, usePlayers, computeAllGemScores
- `src/app/page.tsx` - Default route server component rendering GemTable

## Decisions Made
- page.tsx stays server component (no 'use client') — GemTable carries all interactivity per Next.js App Router best practice
- Position filter uses numeric PositionCode (1=GK, 2=DEF, 3=MID, 4=FWD) to match element_type in MergedPlayer
- Null xG/xA display em-dash (\u2014) per Research Pitfall 6 — not zero, not empty

## Deviations from Plan

None - plan executed exactly as written. Task 1 files (columns.tsx, PositionFilter.tsx) were already committed from a prior agent run; Task 2 (GemTable.tsx, page.tsx) created fresh.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GemTable renders at / with full sort/filter capability
- All 7 component scores visible per row alongside composite Gem score
- Ready for Phase 4 form/fixture analysis views or Phase 3 checkpoint visual verification
- No blockers

---
*Phase: 03-gem-rating-table*
*Completed: 2026-03-28*

## Self-Check: PASSED

- FOUND: src/components/gem-table/columns.tsx
- FOUND: src/components/gem-table/PositionFilter.tsx
- FOUND: src/components/gem-table/GemTable.tsx
- FOUND: src/app/page.tsx
- FOUND: .planning/phases/03-gem-rating-table/03-02-SUMMARY.md
- FOUND commit: c7cacc4
- FOUND commit: d946a65
