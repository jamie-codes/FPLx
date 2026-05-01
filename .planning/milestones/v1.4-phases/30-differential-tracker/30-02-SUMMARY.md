---
phase: 30-differential-tracker
plan: "02"
subsystem: ui + components + gem-table
tags:
  - ui
  - react
  - tanstack-table
  - differential
  - badge
dependency_graph:
  requires:
    - "30-01: differential_flag field on MergedPlayer + pipeline computation"
    - "29-01: RegressionSignalBadge pattern (analog for DifferentialBadge)"
  provides:
    - "DifferentialBadge.tsx: DIFF green pill / TRAP amber pill / em-dash fallback with D-10 tooltips"
    - "col.accessor(differential_flag) in GemTable between Signal and Trend"
    - "MOBILE_HIDDEN_COLUMNS entry: differential_flag: false (portrait mobile hidden)"
    - "HIDDEN_COLUMN_LABELS entry: differential_flag: 'Diff' (mobile tap-to-expand)"
  affects:
    - "GemTable render: Diff column visible on landscape/desktop, hidden on portrait mobile"
    - "tests/lib/differential-flag.test.ts: 6 it.todo() stubs replaced with passing tests"
tech_stack:
  added: []
  patterns:
    - "Badge component pattern: 'use client' + single named export + native HTML title attribute (no Radix)"
    - "TDD RED/GREEN: tests written first (import error = RED), component created (GREEN)"
    - "render(Component({ ... })) function-call form for badge tests (matches Phase 29 convention)"
    - "sortingFn order map: { diff: 0, trap: 2 } with ?? 1 fallback (matches Signal column Phase 29)"
key_files:
  created:
    - "src/components/gem-table/DifferentialBadge.tsx"
  modified:
    - "tests/lib/differential-flag.test.ts — 6 it.todo() replaced with component tests + render/DifferentialBadge imports"
    - "src/components/gem-table/columns.tsx — DifferentialBadge import + differential_flag col.accessor"
    - "src/components/gem-table/GwToggle.tsx — differential_flag: false in MOBILE_HIDDEN_COLUMNS"
    - "src/components/gem-table/GemTable.tsx — differential_flag: 'Diff' in HIDDEN_COLUMN_LABELS"
decisions:
  - "Literal U+2014 em-dash character in DifferentialBadge (matches RegressionSignalBadge line 15, not HTML entity)"
  - "parseFloat(selected_by_percent ?? '0') in cell renderer: defensive guard against cache corruption, not expected in practice"
  - "sortingFn: { diff: 0, trap: 2 } with ?? 1 fallback — ascending = DIFF first, descending = TRAP first, null middle"
  - "Column position: after Signal (regression_signal accessor), before Trend (col.display trend block)"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-28T11:56:40Z"
  tasks_completed: 2
  files_created: 1
  files_modified: 4
status: "checkpoint — awaiting human verify (Task 3)"
---

# Phase 30 Plan 02: Differential Badge UI + Diff Column Summary

**One-liner:** `DifferentialBadge` component (DIFF green / TRAP amber / em-dash) wired as sortable `Diff` GemTable column after `Signal`, hidden portrait mobile, with D-10 quantitative tooltips and 6 passing component tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | DifferentialBadge.tsx + 6 component tests (TDD RED/GREEN) | f77cb5e | src/components/gem-table/DifferentialBadge.tsx, tests/lib/differential-flag.test.ts |
| 2 | Wire Diff column — columns.tsx accessor + visibility maps | 784bb7d | src/components/gem-table/columns.tsx, src/components/gem-table/GwToggle.tsx, src/components/gem-table/GemTable.tsx |

## Status

**CHECKPOINT REACHED — awaiting human verify (Task 3)**

Tasks 1 and 2 are complete and committed. Task 3 is a `checkpoint:human-verify` gate requiring visual inspection of the Diff column in the running app. Execution paused here per plan instructions (`autonomous: false`).

## Implementation Details

### DifferentialBadge.tsx

38-line component mirroring `RegressionSignalBadge.tsx` structure exactly:
- `'use client'` directive (line 1)
- Props: `{ flag: 'diff' | 'trap' | null | undefined, ownership: number | null | undefined }`
- Null/undefined flag: `<span className="text-zinc-400">—</span>` (literal U+2014)
- DIFF: green pill `bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200`, tooltip: `Differential: ${pct}% owned, above-average xPts for position. Low ownership = rank gain potential.`
- TRAP: amber pill `bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200`, tooltip: `Template trap: ${pct}% owned, below-average xPts for position. High ownership with weak projections.`

### columns.tsx

- Import added after `RegressionSignalBadge` import
- `col.accessor('differential_flag', {...})` inserted at line 176 (after Signal `}),` and before `col.display({ id: 'trend' })`)
- sortingFn: `{ diff: 0, trap: 2 }` — ascending sorts DIFF first (0), then null (1), then TRAP (2)
- `parseFloat(info.row.original.selected_by_percent ?? '0')` for ownership prop

### GwToggle.tsx + GemTable.tsx

- `differential_flag: false` appended as last entry in `MOBILE_HIDDEN_COLUMNS`
- `differential_flag: 'Diff'` appended as last entry in `HIDDEN_COLUMN_LABELS`

## Verification Results

| Check | Result |
|-------|--------|
| `grep -c "export function DifferentialBadge"` DifferentialBadge.tsx | 1 |
| `grep -c "bg-green-100 dark:bg-green-900"` DifferentialBadge.tsx | 1 |
| `grep -c "bg-amber-100 dark:bg-amber-900"` DifferentialBadge.tsx | 1 |
| `grep -c "above-average xPts for position"` DifferentialBadge.tsx | 1 |
| `grep -c "below-average xPts for position"` DifferentialBadge.tsx | 1 |
| `grep -c "rank gain potential"` DifferentialBadge.tsx | 1 |
| `grep -c "weak projections"` DifferentialBadge.tsx | 1 |
| `grep -c "it.todo("` tests/lib/differential-flag.test.ts | 0 |
| `grep -c "DifferentialBadge"` tests/lib/differential-flag.test.ts | 8 |
| `grep -c "import { DifferentialBadge }"` columns.tsx | 1 |
| `grep -c "differential_flag"` columns.tsx | 3 |
| `grep -c "{ diff: 0, trap: 2 }"` columns.tsx | 1 |
| `grep -c "parseFloat(info.row.original.selected_by_percent"` columns.tsx | 1 |
| `grep -c "differential_flag: false"` GwToggle.tsx | 1 |
| `grep -c "differential_flag: 'Diff'"` GemTable.tsx | 1 |
| Column ordering (Signal < Diff < Trend) | 1 (awk verified) |
| `npx tsc --noEmit` | PASSED (0 errors) |
| `npx vitest run` | PASSED (278 passed, 26 skipped, 0 failed) |
| Human checkpoint | PENDING |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is wired. The `DifferentialBadge` renders live `differential_flag` values from `MergedPlayer` (computed by Wave 1 pipeline). An em-dash appears for players without a flag, which is correct fallback behaviour per D-05.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. T-30-06 through T-30-10 mitigations applied as specified:
- `pct = ownership.toFixed(1)` in DifferentialBadge forces numeric coercion (T-30-06)
- `?? ''` and `?? 1` guards in sortingFn prevent throw on null/undefined (T-30-08)
- `parseFloat(selected_by_percent ?? '0')` returns 0 on malformed input (T-30-09)

## Self-Check: PASSED

- `src/components/gem-table/DifferentialBadge.tsx` — confirmed on disk
- `tests/lib/differential-flag.test.ts` — confirmed updated (0 it.todo)
- `src/components/gem-table/columns.tsx` — confirmed updated
- `src/components/gem-table/GwToggle.tsx` — confirmed updated
- `src/components/gem-table/GemTable.tsx` — confirmed updated
- Commit f77cb5e — confirmed in git log
- Commit 784bb7d — confirmed in git log
