---
phase: 29-regression-detector
plan: "02"
subsystem: gem-table UI
tags: [regression-signal, badge, column, gem-table, wave-2]
dependency_graph:
  requires: [29-01]
  provides: [RegressionSignalBadge, Signal-column, mobile-visibility]
  affects:
    - src/components/gem-table/RegressionSignalBadge.tsx
    - src/components/gem-table/columns.tsx
    - src/components/gem-table/GwToggle.tsx
    - src/components/gem-table/GemTable.tsx
    - tests/lib/regression-signal.test.ts
tech_stack:
  added: []
  patterns: [native-title-tooltip, tailwind-pill-badge, tanstack-sortingFn, two-map-visibility]
key_files:
  created:
    - src/components/gem-table/RegressionSignalBadge.tsx
  modified:
    - tests/lib/regression-signal.test.ts
    - src/components/gem-table/columns.tsx
    - src/components/gem-table/GwToggle.tsx
    - src/components/gem-table/GemTable.tsx
decisions:
  - "Literal em-dash character (—) used directly in JSX rather than HTML entity &#8212; — matches VarianceBadge.tsx trend column dash pattern"
  - "sortingFn order map: sell=2, null=1 (default), buy=0 — ascending surfaces BUY candidates at top"
  - "Native HTML title attribute used for tooltips (no Radix) — consistent with VarianceBadge.tsx project pattern"
metrics:
  duration: "~2m"
  completed: "2026-04-28"
  tasks_completed: 2
  files_modified: 5
---

# Phase 29 Plan 02: Regression Signal UI Summary

**One-liner:** RegressionSignalBadge (BUY green pill / SELL amber pill / em-dash fallback) wired into GemTable Signal column with custom ascending-BUY sort, mobile hidden via two-map pattern, and 6 component tests passing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RegressionSignalBadge component + component tests | a7a3cd9 | src/components/gem-table/RegressionSignalBadge.tsx, tests/lib/regression-signal.test.ts |
| 2 | Signal column in columns.tsx + column visibility | fe688d4 | src/components/gem-table/columns.tsx, src/components/gem-table/GwToggle.tsx, src/components/gem-table/GemTable.tsx |
| 3 | Human verify checkpoint | pending | — |

## What Was Built

### src/components/gem-table/RegressionSignalBadge.tsx (new)
- Accepts `{ signal: 'buy' | 'sell' | null | undefined, delta: number | null | undefined }` props
- `signal=null/undefined`: renders `<span className="text-zinc-400">—</span>` (em-dash)
- `signal='buy'`: green pill `bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200` with tooltip "...xG+xA over last 5 GW...Consider buying."
- `signal='sell'`: amber pill `bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200` with tooltip "...xG+xA over last 5 GW...Consider selling."
- Visual envelope matches VarianceBadge.tsx (text-xs font-normal rounded px-2 py-1)

### tests/lib/regression-signal.test.ts (modified)
- Added jsdom environment annotation and testing-library imports
- Replaced 6 `it.todo()` stubs with real render tests:
  - BUY pill: textContent='BUY', className has bg-green-100, text-xs
  - SELL pill: textContent='SELL', className has bg-amber-100
  - null signal: textContent='—', className has text-zinc-400
  - undefined signal: textContent='—', className has text-zinc-400
  - BUY title: matches /xG+xA/ and /Consider buying/
  - SELL title: matches /xG+xA/ and /Consider selling/
- Full test file: 7 passed, 5 skipped (pipeline integration tests)

### src/components/gem-table/columns.tsx (modified)
- Added `import { RegressionSignalBadge } from '@/components/gem-table/RegressionSignalBadge'`
- Inserted `col.accessor('regression_signal', ...)` between xPts_5gw and trend columns
- Cell renderer: `<RegressionSignalBadge signal={info.getValue()} delta={info.row.original.actual_vs_xg_delta} />`
- Custom `sortingFn`: `sell=2, null=1 (default), buy=0` — ascending sort surfaces BUY candidates at top

### src/components/gem-table/GwToggle.tsx (modified)
- Appended `signal: false` as last entry in `MOBILE_HIDDEN_COLUMNS`
- Signal column hidden on portrait mobile per D-06

### src/components/gem-table/GemTable.tsx (modified)
- Appended `signal: 'Signal'` as last entry in `HIDDEN_COLUMN_LABELS`
- Signal label appears in tap-to-expand detail panel on mobile

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Coverage

| Threat | Status |
|--------|--------|
| T-29-05 Tampering: tooltip text | Accepted — hardcoded template strings, delta from trusted pipeline float |
| T-29-06 Info Disclosure: Signal column | Accepted — public FPL data, mobile hidden is UX not security |
| T-29-07 DoS: sortingFn | Mitigated — `?? ''` and `?? 1` guards prevent throws on null/undefined regression_signal |
| T-29-08 Tampering: MOBILE_HIDDEN_COLUMNS | Accepted — UI state only, no security impact |

## Known Stubs

None — all data paths are wired. Signal column renders RegressionSignalBadge with live data from `info.getValue()` and `info.row.original.actual_vs_xg_delta`. Players without pipeline-computed signals will show the em-dash fallback (correct behavior).

## Human Checkpoint Pending

Task 3 is a `checkpoint:human-verify` gate. Automated work (Tasks 1 and 2) is complete. Human verification needed:
- Signal column visible in GemTable after xPts columns and before Trend
- BUY green pill / SELL amber pill / em-dash fallback rendering
- Sort behavior: ascending = BUY first, descending = SELL first
- Mobile portrait: Signal column hidden
- Tooltips: mention xG+xA, last 5 GW, Consider buying/selling

## Self-Check: PASSED

- [x] `src/components/gem-table/RegressionSignalBadge.tsx` exists
- [x] `grep -n "export function RegressionSignalBadge"` returns line 6
- [x] `bg-green-100` present (BUY badge)
- [x] `bg-amber-100` present (SELL badge)
- [x] `Consider buying` present in title
- [x] `Consider selling` present in title
- [x] `grep -n "RegressionSignalBadge" columns.tsx` returns 2 lines (import + JSX usage)
- [x] `grep -n "regression_signal" columns.tsx` returns 3 lines (col.accessor + sortingFn x2)
- [x] `grep -n "actual_vs_xg_delta" columns.tsx` returns 1 line
- [x] `grep -n "sell: 2" columns.tsx` returns 1 line
- [x] `grep -n "signal: false" GwToggle.tsx` returns 1 line
- [x] `grep -n "signal: 'Signal'" GemTable.tsx` returns 1 line
- [x] `npx vitest run tests/lib/regression-signal.test.ts` exits 0 (7 passed, 5 skipped)
- [x] `npx tsc --noEmit` exits 0
- [x] `npx vitest run` exits 0 (271 passed, 21 skipped, 25 test files)
- [x] Commits a7a3cd9 and fe688d4 both exist
