---
phase: 57
plan: 01
subsystem: lib
tags: [eo, captaincy, pure-typescript, tdd]
dependency_graph:
  requires: []
  provides: [computeEOCandidates, EOMode]
  affects: [src/lib/eo-candidates.ts, src/lib/eo-candidates.test.ts]
tech_stack:
  added: []
  patterns: [pure-function-transform, tdd-red-green, named-export-only]
key_files:
  created:
    - src/lib/eo-candidates.ts
    - src/lib/eo-candidates.test.ts
  modified: []
decisions:
  - "[57-01] Removed duplicate element_type default from makePlayer factory (line 55) to fix TS2783; overrides always supplies element_type so the explicit default was dead code"
metrics:
  duration: "~5 min"
  completed: "2026-05-03"
  tasks: 2
  files: 2
---

# Phase 57 Plan 01: computeEOCandidates Pure Ranker Summary

**One-liner:** Pure TypeScript EO candidate engine implementing 4 sort modes (Max xPts, Protect Rank, Chase Rank, Differential Aggressive) with status/GK/xPts eligibility filter and Pitfall-2-safe median computation.

## Tests Written and Final Pass Count

- **Test file:** `src/lib/eo-candidates.test.ts`
- **Tests written:** 14
- **Final result:** 14/14 passed (GREEN)

Test coverage:
- `max_xpts` mode: 3 tests (sort order, default topN=5, custom topN)
- `protect_rank` mode: 2 tests (sort order, numeric vs lexicographic)
- `chase_rank` mode: 1 test (sort by xPts_90th_1gw descending)
- `differential_aggressive` mode: 3 tests (filter + sort, Pitfall 2 median regression, boundary inclusivity)
- Eligibility filter: 4 tests (GK exclusion, status !== 'a', null xPts, xPts <= 0)
- Defensive: 1 test (empty input)

## Implementation File Size and Exported Symbols

- **File:** `src/lib/eo-candidates.ts`
- **LoC:** 69
- **Exported symbols:** 2
  - `export type EOMode` — `'max_xpts' | 'protect_rank' | 'chase_rank' | 'differential_aggressive'`
  - `export function computeEOCandidates(players: MergedPlayer[], mode: EOMode, topN = 5): MergedPlayer[]`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed duplicate element_type default in makePlayer factory**
- **Found during:** Task 2 (GREEN) — tsc --noEmit produced TS2783 error
- **Issue:** The `makePlayer` factory had `element_type: 3` in the default object literal AND `...overrides` spread at the end. Since `element_type` is required in `PlayerOverrides`, the spread always overwrites the default, producing a TS2783 "specified more than once" error in the test file.
- **Fix:** Removed the `element_type: 3` line from the defaults (line 55). The spread of `overrides` always provides `element_type`.
- **Files modified:** `src/lib/eo-candidates.test.ts`
- **Commit:** 3162c8e (bundled with GREEN implementation commit)
- **Tests:** 14/14 still passing after fix

## Self-Check

Checking created files exist:

- `src/lib/eo-candidates.ts` — FOUND
- `src/lib/eo-candidates.test.ts` — FOUND

Checking commits exist:

- `e079ed5` — test(57-01): add failing tests for computeEOCandidates — FOUND
- `3162c8e` — feat(57-01): implement computeEOCandidates pure ranker (D-02/D-03/D-07) — FOUND

## Self-Check: PASSED

## Commits Produced

| Commit | Type | Message |
|--------|------|---------|
| e079ed5 | test | test(57-01): add failing tests for computeEOCandidates |
| 3162c8e | feat | feat(57-01): implement computeEOCandidates pure ranker (D-02/D-03/D-07) |
