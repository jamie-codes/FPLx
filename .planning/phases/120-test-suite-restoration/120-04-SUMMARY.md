---
phase: "120"
plan: "04"
subsystem: "test-suite"
tags: [bug-fix, test-fixtures, club-form, boundary-assertion]
dependency_graph:
  requires: []
  provides: [club-form-tests-passing]
  affects: [tests/lib/club-form.test.ts]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - tests/lib/club-form.test.ts
decisions:
  - "Fix test fixture only (not source), per plan directive D-10"
  - "Change team_h_difficulty from 3 to 2 for event 32 so fplToAttDiff yields 0.25 < 0.5"
metrics:
  duration: "2m"
  completed: "2026-05-18T12:07:56Z"
---

# Phase 120 Plan 04: Club-Form Test Fixture Fix Summary

Fix the pre-existing boundary assertion failure in `tests/lib/club-form.test.ts` by adjusting the event 32 fixture `team_h_difficulty` from 3 to 2, so `fplToAttDiff(2) = 0.25` satisfies the `toBeLessThan(0.5)` assertion that was failing at the boundary (`fplToAttDiff(3) = 0.5` is not strictly less than 0.5).

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Update event 32 fixture to team_h_difficulty 2 | be32506 | tests/lib/club-form.test.ts |

## Root Cause

`src/lib/club-form.ts` uses `fplToAttDiff = (fpl - 1) / 4` (FPL official difficulty, not xGA). All `makeFixtures()` entries hardcoded `team_h_difficulty: 3`, yielding `difficulty_score = 0.5` for every upcoming fixture. The test assertion `expect(vsBur!.difficulty_score).toBeLessThan(0.5)` failed because 0.5 is not strictly less than 0.5.

## Fix Applied

In `makeFixtures()` inside `tests/lib/club-form.test.ts`, line 24:

- Before: `team_h_difficulty: 3` (yields difficulty_score = 0.5)
- After: `team_h_difficulty: 2` (yields difficulty_score = 0.25)

`src/lib/club-form.ts` was NOT modified, per plan instructions.

## Verification

- `npx vitest run tests/lib/club-form.test.ts` exits 0
- All 13 tests in `describe('computeClubForm', ...)` pass
- `grep -n "team_h_difficulty: 2" tests/lib/club-form.test.ts` returns line 24 containing `event: 32`
- `git diff --stat src/lib/club-form.ts` shows no changes

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] `tests/lib/club-form.test.ts` modified (line 24)
- [x] `src/lib/club-form.ts` NOT modified
- [x] All 13 club-form tests pass
- [x] Commit be32506 exists with correct message
- [x] SUMMARY.md created
