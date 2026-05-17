---
phase: 116
plan: "01"
subsystem: ui
tags:
  - prose-summary
  - staleness
  - relative-time
  - amber-indicator
dependency_graph:
  requires:
    - src/lib/formatRelativeTime.ts
    - src/lib/types.ts (ProseSummary.generated_at)
  provides:
    - Conditional amber staleness footer in ProseSummaryBlock
  affects:
    - src/components/squad/ProseSummaryBlock.tsx
    - src/components/squad/ProseSummaryBlock.test.tsx
tech_stack:
  added: []
  patterns:
    - "useMemo with react-hooks/purity suppression for Date.now() in render"
    - "vi.spyOn(Date, 'now') for deterministic time in vitest"
    - "formatRelativeTime import reuse (existing utility)"
key_files:
  created: []
  modified:
    - src/components/squad/ProseSummaryBlock.tsx
    - src/components/squad/ProseSummaryBlock.test.tsx
decisions:
  - "useMemo before early return to avoid hooks-rules-of-hooks violation"
  - "eslint-disable-next-line react-hooks/purity on Date.now() per D-04 (D-04 mandates direct call; vi.spyOn in tests)"
  - "Two <p> branches (hasValidGenAt ternary) rather than string concatenation for clean JSX"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-17"
  tasks_completed: 2
  files_modified: 2
---

# Phase 116 Plan 01: ProseSummaryBlock Staleness Footer Summary

Amber staleness footer added to ProseSummaryBlock using formatRelativeTime utility and useMemo-gated Date.now() invocation, switching to text-amber-600 when generated_at is >= 20 hours old.

## What Was Built

- `ProseSummaryBlock.tsx`: footer now shows `Updated {relTime} · GW{N}` when `generated_at` is a valid ISO 8601 string; renders amber (`text-amber-600 dark:text-amber-400`) when age >= 20 hours, zinc (`text-zinc-400 dark:text-zinc-500`) when fresh; falls back to static `Updated GW{N}` in zinc when `generated_at` is absent or unparseable
- `ProseSummaryBlock.test.tsx`: extended with 4 new staleness test cases (fresh, stale, boundary at 19h59m, fallback), frozen time via `vi.spyOn(Date, 'now')`, `afterEach(() => vi.restoreAllMocks())`; updated existing test regex from `/Updated GW35/` to `/Updated .+ ago · GW35/`

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing staleness tests | 6d5d3dc | ProseSummaryBlock.test.tsx |
| 1 (GREEN) | Staleness component implementation | aef888c | ProseSummaryBlock.tsx |

## Test Results

- 9/9 tests green in `ProseSummaryBlock.test.tsx`
- 0 lint errors for `src/components/squad/ProseSummaryBlock.tsx`
- 4 new test cases added (fresh, stale, boundary, fallback)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] react-hooks/rules-of-hooks violation from useMemo after early return**
- **Found during:** Task 1 implementation
- **Issue:** Placing `useMemo` after the `if (!displayed) return null` early return caused the `react-hooks/rules-of-hooks` lint error (hooks must be called in the same order on every render)
- **Fix:** Moved `useMemo` to before the early return, using `displayed?.generated_at` with optional chaining to handle the null case safely
- **Files modified:** `src/components/squad/ProseSummaryBlock.tsx`
- **Commit:** aef888c

**2. [Rule 2 - Missing critical functionality] react-hooks/purity suppression needed for Date.now()**
- **Found during:** Task 1 lint check
- **Issue:** The `react-hooks/purity` eslint rule from `eslint-config-next` flags `Date.now()` as an impure function call in render/useMemo. D-04 explicitly requires direct `Date.now()` invocation (no injectable prop). `TransferPanel.tsx` has the identical pre-existing pattern.
- **Fix:** Added `// eslint-disable-next-line react-hooks/purity` on the `Date.now()` line inside `useMemo`. This is the minimal suppresssion — the rule comment is on the specific line only.
- **Files modified:** `src/components/squad/ProseSummaryBlock.tsx`
- **Commit:** aef888c

## Known Stubs

None — all staleness logic is fully wired. `formatRelativeTime` uses real `Date.now()` in production, `vi.spyOn` in tests.

## Threat Flags

No new trust boundaries introduced. `generated_at` is validated via `Number.isFinite(new Date(...).getTime())` before use (mitigates T-116-01-01 as specified). React's default escaping handles T-116-01-04.

## Self-Check

- [x] `src/components/squad/ProseSummaryBlock.tsx` exists and contains all required substrings
- [x] `src/components/squad/ProseSummaryBlock.test.tsx` exists with 4 new test cases
- [x] Commits 6d5d3dc (RED) and aef888c (GREEN) confirmed in git log
- [x] 9/9 tests pass
- [x] 0 lint errors for modified file

## Self-Check: PASSED
