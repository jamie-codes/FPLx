---
phase: 04-defcon-analysis
plan: 02
subsystem: lib
tags: [defcon, utility, tdd, pure-functions, typescript]
dependency_graph:
  requires: []
  provides: [src/lib/defcon.ts]
  affects: [src/components/defcon/DefConTables.tsx, src/lib/hooks/useDefCon.ts]
tech_stack:
  added: []
  patterns: [TDD red-green, pure functions, per-position threshold constants]
key_files:
  created:
    - src/lib/defcon.ts
    - tests/lib/defcon.test.ts
  modified: []
decisions:
  - DefConPlayer interface defined locally in defcon.ts (not imported from types.ts) because Plan 01 is Wave 1 parallel; once Plan 01 adds DefConPlayer to types.ts, the import can be updated
  - formatCorrelation uses optional chaining with ?? 0 fallback for easy_n/hard_n to handle undefined gracefully
metrics:
  duration: 3
  completed_date: "2026-03-28"
  tasks_completed: 1
  files_created: 2
  files_modified: 0
---

# Phase 04 Plan 02: DefCon Utility Functions Summary

**One-liner:** Pure TypeScript DefCon utility module with TDD — DEFCON_THRESHOLD constants, splitByPosition, formatHitRate, getDefConStatus, and formatCorrelation covering DEF-01 through DEF-04.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | TDD — DefCon utility functions | 3598273 | Done |

## What Was Built

`src/lib/defcon.ts` exports five pure functions that encapsulate all DefCon display computation logic:

- **`DEFCON_THRESHOLD`** — Record mapping position codes to thresholds: DEF (2) = 10, MID (3) = 12, FWD (4) = 12
- **`splitByPosition(players)`** — Splits a `DefConPlayer[]` into `{ def, midFwd }` by element_type
- **`formatHitRate(rate)`** — Formats a 0.0–1.0 rate as a percentage string (e.g. `0.516` → `"51.6%"`)
- **`getDefConStatus(player)`** — Returns `'above' | 'at' | 'below'` based on `distance_to_threshold`
- **`formatCorrelation(fc)`** — Returns display object with `label` (insufficient data) or `easy`/`hard` percentage strings

`DefConPlayer` interface is defined locally in `defcon.ts` because this plan runs in Wave 1 alongside Plan 01 (which adds `DefConPlayer` to `types.ts`). Once Plan 01 lands, the import source can be updated.

`tests/lib/defcon.test.ts` covers all 19 test cases — 3 threshold constants, 5 position split cases, 4 formatHitRate cases, 3 getDefConStatus cases, and 4 formatCorrelation cases.

## Test Results

- `npx vitest run tests/lib/defcon.test.ts`: 19/19 passed
- `npx vitest run` (full suite): 42/42 passed across 3 test files — no regressions

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Note on parallel Wave 1:** Plan 01 may add `DefConPlayer` to `types.ts` at the same time. If it does, a future task (or Plan 03) should update the import in `defcon.ts` from the local interface to `import type { DefConPlayer } from '@/lib/types'`. This is not a deviation — the plan explicitly instructed defining locally if Plan 01 was not yet complete.

## Known Stubs

None — all functions are fully implemented with correct logic. No placeholder values or TODO comments.

## Self-Check: PASSED

- `src/lib/defcon.ts` exists: FOUND
- `tests/lib/defcon.test.ts` exists: FOUND
- Commit `3598273` exists: FOUND
- All tests pass: 19/19 in defcon suite, 42/42 full suite
