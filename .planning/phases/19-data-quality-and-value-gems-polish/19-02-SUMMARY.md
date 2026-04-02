---
phase: 19-data-quality-and-value-gems-polish
plan: "02"
subsystem: value-gems-ui
tags: [value-gems, table-columns, mobile-ux, points-history]
dependency_graph:
  requires: [19-01]
  provides: [VG-02]
  affects: [src/components/value-gems]
tech_stack:
  added: []
  patterns: [tanstack-table-column-visibility, partial-window-asterisk]
key_files:
  created: []
  modified:
    - src/components/value-gems/columns.tsx
    - src/components/value-gems/ValueGemsTable.tsx
decisions:
  - "Use pts_gw_count threshold comparison (< 5 / < 3) to determine partial window for asterisk display, matching D-11 spec"
  - "pipeline/merge.py already had goals_scored and assists from Plan 01 — no-op confirmation"
metrics:
  duration: "~4 min"
  completed: "2026-04-02"
  tasks_completed: 2
  files_modified: 2
---

# Phase 19 Plan 02: Value Gems Points Columns Summary

Three points columns (Total Pts, Pts L5, Pts L3) replace the single Pts column in the Value Gems table, all sortable, with asterisk notation for partial gameweek windows on mobile-hidden L5/L3 columns.

## Tasks Completed

### Task 1: Replace Pts column with three points columns
**Commit:** eef6f7e

Replaced `col.accessor('total_points', { header: 'Pts' })` in `src/components/value-gems/columns.tsx` with three separate column definitions:
- `total_points` — header "Total Pts", sortable
- `pts_last5gw` — header "Pts L5", sortable, shows `N*` with tooltip when `pts_gw_count < 5`
- `pts_last3gw` — header "Pts L3", sortable, shows `N*` with tooltip when `pts_gw_count < 3`

All three columns have explicit `id` fields matching their accessor names (required for TanStack Table columnVisibility to work by key).

### Task 2: Hide Pts L5 and Pts L3 on mobile
**Commit:** 89f53ff

Updated mobile `columnVisibility` in `src/components/value-gems/ValueGemsTable.tsx` to include `pts_last5gw: false` and `pts_last3gw: false`. The column IDs match the `id` fields from Task 1.

Confirmed `goals_scored` and `assists` were already present in `pipeline/merge.py` player dict from Plan 01 — no changes needed.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all three columns access live data from `pts_last3gw`, `pts_last5gw`, `pts_gw_count` fields set by pipeline Plan 01.

## Self-Check: PASSED

- src/components/value-gems/columns.tsx — modified, contains Total Pts / Pts L5 / Pts L3
- src/components/value-gems/ValueGemsTable.tsx — modified, contains pts_last5gw: false / pts_last3gw: false
- Commit eef6f7e — exists
- Commit 89f53ff — exists
- `npx tsc --noEmit` — passes (0 errors)
