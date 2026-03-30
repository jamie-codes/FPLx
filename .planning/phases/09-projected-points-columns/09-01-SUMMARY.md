---
phase: 09-projected-points-columns
plan: "01"
subsystem: gem-table
tags: [ui, tanstack-table, column-visibility, projected-points, toggle]
dependency_graph:
  requires:
    - "Phase 07: proj_pts_1gw/3gw/5gw fields non-nullable on ScoredPlayer"
    - "Phase 08: MinsRiskBadge in columns.tsx (positioning anchor)"
  provides:
    - "GwToggle component with getColumnVisibility helper"
    - "Three proj_pts accessor columns in GemTable (sortable)"
    - "columnVisibility wiring in GemTable via gwHorizon state"
  affects:
    - "src/components/gem-table/GemTable.tsx"
    - "src/components/gem-table/columns.tsx"
    - "src/components/gem-table/PositionFilter.tsx"
tech_stack:
  added: []
  patterns:
    - "TanStack Table v8 columnVisibility state (derived, no onColumnVisibilityChange)"
    - "Joined button group (flex overflow-hidden border) for toggle controls"
key_files:
  created:
    - src/components/gem-table/GwToggle.tsx
    - src/components/gem-table/GwToggle.test.ts
  modified:
    - src/components/gem-table/columns.tsx
    - src/components/gem-table/GemTable.tsx
    - src/components/gem-table/PositionFilter.tsx
decisions:
  - "columnVisibility is fully derived from gwHorizon state — no onColumnVisibilityChange handler needed"
  - "PositionFilter mb-4 removed in favour of wrapper div mb-2 to prevent double vertical margin"
metrics:
  duration_seconds: 147
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_changed: 5
---

# Phase 09 Plan 01: GwToggle and Projected Points Columns Summary

GW horizon toggle with three sortable projected-points columns in GemTable, column visibility fully derived from toggle state via TanStack Table v8 columnVisibility.

## What Was Built

### Task 1: GwToggle component with getColumnVisibility helper and unit tests

Created `src/components/gem-table/GwToggle.tsx`:
- `getColumnVisibility(horizon: 1 | 3 | 5)` pure function returning 3-key boolean object
- `GwToggle` React component rendering a joined 3-button group (1 GW / 3 GW / 5 GW)
- Accessibility: `role="group"`, `aria-label="Projected points horizon"`, `aria-pressed` on each button
- Styling: `bg-zinc-900 text-white` active, `bg-white text-zinc-700 hover:bg-zinc-50` inactive

Created `src/components/gem-table/GwToggle.test.ts`:
- 3 test cases covering all three horizons — all passing

### Task 2: Projected points columns + GemTable wiring

Modified `src/components/gem-table/columns.tsx`:
- Added `proj_pts_1gw`, `proj_pts_3gw`, `proj_pts_5gw` accessor columns after `mins_risk`, before `trend`
- Each column uses `.toFixed(1)` display, `enableSorting: true`
- Headers: "Proj Pts", "Proj Pts (3)", "Proj Pts (5)"

Modified `src/components/gem-table/GemTable.tsx`:
- Imported `GwToggle`, `getColumnVisibility`, `VisibilityState`
- Added `gwHorizon` state (`useState<1 | 3 | 5>(1)`)
- Derived `columnVisibility` from `getColumnVisibility(gwHorizon)`
- Added `columnVisibility` to `useReactTable` state object (no `onColumnVisibilityChange`)
- Replaced standalone `<PositionFilter>` with flex wrapper containing both `PositionFilter` and `GwToggle`

Modified `src/components/gem-table/PositionFilter.tsx`:
- Removed `mb-4` from root div className (now `"flex gap-2"`)

## Verification Results

- `npx vitest run`: 11 test files, 104 tests passed, 8 skipped — all green
- `npx tsc --noEmit`: zero type errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All three proj_pts fields are non-nullable numbers populated by the Phase 07 pipeline. Column values display live data from `/api/players`.

## Self-Check: PASSED

Files confirmed to exist:
- src/components/gem-table/GwToggle.tsx — FOUND
- src/components/gem-table/GwToggle.test.ts — FOUND
- src/components/gem-table/columns.tsx — modified, FOUND
- src/components/gem-table/GemTable.tsx — modified, FOUND
- src/components/gem-table/PositionFilter.tsx — modified, FOUND

Commits confirmed:
- 73c600c — feat(09-01): add GwToggle component with getColumnVisibility helper and unit tests
- 56caee0 — feat(09-01): add proj_pts columns to GemTable with GwToggle and columnVisibility wiring
