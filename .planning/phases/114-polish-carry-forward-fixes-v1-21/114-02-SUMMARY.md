---
phase: 114
plan: "02"
subsystem: gem-table
tags: [sparkline, column, rank_trajectory, GemTable, mobile-hidden, preset]
dependency_graph:
  requires:
    - src/lib/types.ts (rank_trajectory?: number[] field — already present, no changes needed)
  provides:
    - rank_trajectory sparkline column in GemTable (SPARK-01)
  affects:
    - src/components/gem-table/columns.tsx
    - src/components/gem-table/GwToggle.tsx
tech_stack:
  added: []
  patterns:
    - inline SVG polyline (no Recharts) for micro-chart sparkline
    - TanStack Table col.accessor with inline cell renderer
    - MOBILE_HIDDEN_COLUMNS + PRESET_COLUMN_VISIBILITY.compact visibility pattern
key_files:
  created: []
  modified:
    - src/components/gem-table/columns.tsx
    - src/components/gem-table/GwToggle.tsx
decisions:
  - "Inline SVG polyline (no Recharts import) — 5-point sparkline needs no charting library"
  - "trajectory.length < 2 guard covers both absent and single-point edge cases"
  - "enableSorting: false — sparkline is visual-only, not sortable"
  - "rank_trajectory hidden in compact preset and on mobile; visible in default and analysis"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-16"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 114 Plan 02: GemTable rank_trajectory Sparkline Summary

**One-liner:** Inline SVG polyline sparkline column (rank_trajectory) in GemTable after xPts_5gw, with trend-colour logic (green/red/zinc) and mobile+compact preset hiding.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add rank_trajectory sparkline column to columns.tsx | 4a880da | src/components/gem-table/columns.tsx |
| 2 | Add rank_trajectory to mobile-hidden and compact preset in GwToggle.tsx | 05ecea3 | src/components/gem-table/GwToggle.tsx |

## What Was Built

### Task 1 — rank_trajectory column in columns.tsx

A new `col.accessor('rank_trajectory', { ... })` column was inserted into the `createColumns` return array immediately after the `xPts_5gw` column and before `regression_signal`.

Key properties:
- **Header:** `H('Trend', 'Rank trajectory over last 5 gameweeks. Green = rank improving (lower percentile). Red = rank declining.')`
- **enableSorting: false** — visual-only column
- **Cell renderer:** Inline SVG polyline (40x20px, `viewBox="0 0 40 20"`, `aria-hidden="true"`)
  - Maps 5 trajectory values (0=best rank, 1=worst) to (x, y) where x = 2 + i*9 and y = 1 + v*18
  - Trend colour: `trend < -0.05` → `var(--color-positive)` (green, improving); `trend > 0.05` → `var(--color-negative)` (red, declining); else `#a1a1aa` (zinc-400, flat/noise)
  - Guard: `!trajectory || trajectory.length < 2` → `<span className="text-zinc-400">—</span>`
- No Recharts import added

### Task 2 — visibility in GwToggle.tsx

Two entries added:
1. `MOBILE_HIDDEN_COLUMNS`: `rank_trajectory: false` — hidden on all mobile views
2. `PRESET_COLUMN_VISIBILITY.compact`: `rank_trajectory: false` — hidden in Compact preset

Column is visible by default on desktop in `default` and `analysis` presets (no entry required — absence = visible).

## Verification Results

| Check | Result |
|-------|--------|
| `grep rank_trajectory columns.tsx` | 2 matches (comment + accessor) |
| `grep rank_trajectory GwToggle.tsx` | 2 matches (MOBILE_HIDDEN_COLUMNS + compact) |
| `grep -c recharts columns.tsx` | 0 |
| xPts_5gw before rank_trajectory (column order) | PASS — line 322 before line 337 |
| TypeScript compilation (our files) | PASS — no errors in columns.tsx or GwToggle.tsx |
| Pre-existing TSC error in decision-history/route.test.ts | Pre-existing, unrelated to this plan |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — rank_trajectory field is live in MergedPlayer (populated by pipeline/simulate.py when mc_enabled=true). Players without trajectory data show an em-dash, which is correct absent-data behavior, not a stub.

## Threat Flags

None — rank_trajectory values are already exposed in the player JSON API. The SVG renders derived colour only, no raw values displayed. No new trust boundaries introduced.

## Self-Check: PASSED

- `src/components/gem-table/columns.tsx` — modified, rank_trajectory accessor present
- `src/components/gem-table/GwToggle.tsx` — modified, rank_trajectory in MOBILE_HIDDEN_COLUMNS and compact preset
- Task 1 commit 4a880da — verified present
- Task 2 commit 05ecea3 — verified present
