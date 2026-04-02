---
phase: 23-transfer-output-table
plan: 01
subsystem: planner-ui
tags: [components, transfer-table, chip-toggle, pure-helpers, tdd]
dependency_graph:
  requires: []
  provides: [TransferPlanTable, ChipToggle, plan-helpers]
  affects: [src/components/planner/PlannerTab.tsx]
tech_stack:
  added: []
  patterns: [useMemo for playerMap, semantic HTML table, aria-live for plan value, aria-pressed for chip toggles]
key_files:
  created:
    - src/components/planner/plan-helpers.ts
    - src/components/planner/ChipToggle.tsx
    - src/components/planner/TransferPlanTable.tsx
    - tests/components/planner/plan-helpers.test.ts
  modified: []
decisions:
  - formatGain uses U+2212 (minus sign) not ASCII hyphen for negative values — spec requirement for typographic correctness
  - TransferPlanTable uses React fragment key pattern for paired main/mobile-chip rows
  - Hold row spans Out+In columns (colSpan=2) to avoid empty cell layout issues
metrics:
  duration: ~10min
  completed: 2026-04-02
  tasks: 2
  files: 4
---

# Phase 23 Plan 01: Transfer Output Table — Pure Helpers + Display Components Summary

**One-liner:** Semantic transfer table with chip toggles, DGW/BGW badges, hold rows, and typed pure helpers (computePlanValue, CHIP_LABELS, formatGain) — all tested and building clean.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Pure helper functions with tests (TDD) | 5ed4a3e | plan-helpers.ts, plan-helpers.test.ts |
| 2 | TransferPlanTable and ChipToggle components | 77ddbd1 | TransferPlanTable.tsx, ChipToggle.tsx |

## What Was Built

**plan-helpers.ts** — Three pure exports:
- `computePlanValue(steps)` — sums `scoredTransfers[0].netGain` across steps; hold steps (empty array) contribute 0
- `CHIP_LABELS` — maps chip codes to human-readable names (Wildcard, Free Hit, Bench Boost, Triple Captain)
- `formatGain(value)` — signed 1-decimal string with U+2212 minus sign for negatives

**ChipToggle.tsx** — 4-button chip selector per GW row:
- `role="group"` with `aria-label="Chip for GW {N}"`
- `aria-pressed` on each button reflecting active chip state
- `min-h-[44px]` touch targets matching project 44px standard
- Active/inactive styles copied from HorizonSelector pattern

**TransferPlanTable.tsx** — Semantic HTML table with full feature set:
- Plan value headline with `aria-live="polite"`
- Per-GW rows: GW cell with DGW (violet) or BGW (amber) badge, Chip cell (desktop), Out, In, Hit, Gain
- Hold rows: `colSpan=2` spanning Out+In with explanatory text
- Hit cost negative: `text-red-700 dark:text-red-300`
- Unconfirmed fixtures: italic gain with `<abbr>` asterisk
- Mobile chip row: `sm:hidden` tr spanning all 6 columns below main row
- `playerMap` via `useMemo` for O(1) player lookups

## Verification Results

- `npx vitest run tests/components/planner/plan-helpers.test.ts` — 10/10 tests pass
- `npx vitest run` — 232 tests pass, 8 skipped
- `npx next build` — exits 0, no type errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. Components accept props; wiring into PlannerTab is Phase 23 Plan 02.

## Self-Check: PASSED

- src/components/planner/plan-helpers.ts — FOUND
- src/components/planner/ChipToggle.tsx — FOUND
- src/components/planner/TransferPlanTable.tsx — FOUND
- tests/components/planner/plan-helpers.test.ts — FOUND
- Commit 5ed4a3e — FOUND
- Commit 77ddbd1 — FOUND
