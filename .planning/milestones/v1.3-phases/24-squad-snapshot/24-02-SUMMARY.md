---
phase: 24-squad-snapshot
plan: "02"
subsystem: planner-ui
tags: [accordion, squad-snapshot, chevron, bench-dimming, transfer-highlight]
dependency_graph:
  requires: [24-01]
  provides: [squad-snapshot-accordion]
  affects: [TransferPlanTable, SquadSnapshotRow]
tech_stack:
  added: []
  patterns: [React-useState-Set-toggle, colSpan-accordion-row, position-grouping-by-element_type]
key_files:
  created:
    - src/components/planner/SquadSnapshotRow.tsx
  modified:
    - src/components/planner/TransferPlanTable.tsx
    - tests/components/planner/plan-helpers.test.ts
decisions:
  - "colSpan=6 on accordion td — matches exact column count (GW|Chip|Out|In|Hit|Gain); must not change if columns are added"
  - "bench divider rendered only when benchItems.length > 0 to avoid spurious hr on empty squads"
  - "positionsAfter test fixtures updated to satisfy updated PlanStep type shape"
metrics:
  duration: 90s
  completed: "2026-04-02"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 24 Plan 02: Squad Snapshot Accordion Summary

**One-liner:** Expandable per-GW squad accordion using chevron toggle, position grouping, bench dimming at opacity-50, green IN badge for transferred-in players, and Bench Boost full-opacity override.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create SquadSnapshotRow and wire accordion into TransferPlanTable | b0512e4 | SquadSnapshotRow.tsx (new), TransferPlanTable.tsx, plan-helpers.test.ts |
| 2 | Verify squad snapshot accordion in browser | — (human-verify) | — |

## What Was Built

### SquadSnapshotRow (new component)

`src/components/planner/SquadSnapshotRow.tsx` renders the 15-player squad state for a given GW step:

- Groups `squadAfter` IDs by `element_type` (1=GK, 2=DEF, 3=MID, 4=FWD)
- Sorts each group by `positionsAfter[id]` ascending
- Separates starters (pos 1-11) from bench (pos 12-15)
- Renders starters grouped under position headers (GK/DEF/MID/FWD)
- Renders a "-- bench --" divider then bench players
- Bench players use `opacity-50` unless `chip === 'bboost'` (Bench Boost shows all at full opacity)
- Transferred-in players (from `transfersIn`) get a green "IN" badge
- Each player row: `web_name` + optional IN badge + `team_short_name` + optional "bench" label
- Background: `bg-zinc-50 dark:bg-zinc-800/50` — distinct from table rows

### TransferPlanTable (updated)

- Added `useState<Set<number>>` for `openSteps` — tracks which step indices are expanded
- Added `toggleStep(i)` — immutable Set toggle function
- GW cell replaced with a `<button>` with `aria-expanded`, `aria-label`, and chevron (`\u25B6`/`\u25BC`)
- DGW/BGW badges remain outside the button (sibling spans in the same `<td>`)
- Accordion row added as the last child of each `<Fragment>` — `<tr><td colSpan={6}>` containing `<SquadSnapshotRow>`
- Accordions collapsed by default (empty `Set` initial state)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing `positionsAfter` field in test fixtures**
- **Found during:** Task 1 TypeScript verification
- **Issue:** `plan-helpers.test.ts` mock factory functions (`makePlanStep`, `makeHoldStep`) were missing the `positionsAfter: Record<number, number>` field added to `PlanStep` in Plan 01. TypeScript flagged TS2741.
- **Fix:** Added `positionsAfter: {}` to both mock factory return objects
- **Files modified:** `tests/components/planner/plan-helpers.test.ts`
- **Commit:** b0512e4 (included in Task 1 commit)

## Verification Results

- `npx tsc --noEmit`: PASSED — no errors
- `npx vitest run`: PASSED — 235 tests passed, 8 skipped (20 test files)

## Known Stubs

None — `SquadSnapshotRow` reads live data from `playerMap` and `positionsAfter` which are populated by the planning engine from Phase 22/24-01. No hardcoded or placeholder data.

## Human Verification (Task 2)

Task 2 was a `checkpoint:human-verify`. User reviewed the accordion in the browser and approved all success criteria:

- Accordions collapsed by default on page load — PASSED
- Chevron click expands to show 15 players grouped by GK/DEF/MID/FWD — PASSED
- Transferred-in player has green IN badge — PASSED
- Bench players dimmed with bench label — PASSED
- Bench Boost GW shows all 15 at full opacity — PASSED
- Dark mode accordion background distinct from table rows — PASSED

## Self-Check: PASSED

- `src/components/planner/SquadSnapshotRow.tsx`: FOUND
- `src/components/planner/TransferPlanTable.tsx`: FOUND (modified)
- Commit b0512e4: FOUND
