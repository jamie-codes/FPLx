---
phase: 075-fixture-heat-map-v2
plan: "01"
subsystem: fixture-heat-map
tags: [fixture-heat-map, lookahead, pipeline, infrastructure, tdd]
dependency_graph:
  requires: []
  provides: [FIXTURE_LOOKAHEAD=32 in pipeline, LOOKAHEAD=32 in client, tier() named export]
  affects: [pipeline/merge.py, src/lib/club-form.ts, src/lib/types.ts, plan-02 unblocked]
tech_stack:
  added: []
  patterns: [TDD red-green, named export lift, coordinated constant bump]
key_files:
  created:
    - src/lib/__tests__/club-form-lookahead.test.ts
  modified:
    - pipeline/merge.py
    - pipeline/tests/test_merge.py
    - src/lib/club-form.ts
    - src/lib/types.ts
decisions:
  - "Used 'fixtures' key (not 'upcoming_fixtures') to read per-player fixture list from merge_players() return dict — discovered during RED phase"
  - "tier() lifted as top-level export above computeClubForm; inner-scope const block fully removed"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-06"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 75 Plan 01: LOOKAHEAD 16→32 Infrastructure Summary

Both the Python pipeline and TypeScript client now emit up to 32 upcoming fixtures per team (was 16), ensuring 16-GW horizon DGW teams never run out of fixture entries. `tier()` is exported from `src/lib/club-form.ts` so Plan 02's `FixtureHeatMap.tsx` can compute DEF tiers without duplicating thresholds.

## Final Values

| Constant | File | Old | New |
|----------|------|-----|-----|
| `FIXTURE_LOOKAHEAD` | `pipeline/merge.py:775` | `16` | `32` |
| `LOOKAHEAD` | `src/lib/club-form.ts:47` | `16` | `32` |
| `ClubForm.upcoming_fixtures` comment | `src/lib/types.ts:433` | `// next 16` | `// next 32` |
| `tier()` | `src/lib/club-form.ts:6` | inner-scope const | `export function` |

## Test Counts

| Test file | New tests | All tests | Result |
|-----------|-----------|-----------|--------|
| `pipeline/tests/test_merge.py` | 2 (`test_fixture_lookahead_caps_at_32`, `test_fixture_lookahead_no_padding_below_32`) | 5 | PASS |
| `src/lib/__tests__/club-form-lookahead.test.ts` | 5 (2 LOOKAHEAD + 3 tier()) | 5 | PASS |
| `src/lib/__tests__/club-form-swing.test.ts` | 0 (regression) | 6 | PASS |

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Pipeline bump + pytest | `b5d539f` | `pipeline/merge.py`, `pipeline/tests/test_merge.py` |
| Task 2: Client bump + tier() + types + vitest | `41dc80a` | `src/lib/club-form.ts`, `src/lib/types.ts`, `src/lib/__tests__/club-form-lookahead.test.ts` |

## tier() Lift

The lift required no unexpected refactoring. The inner-scope `const tier = (attDiff: number): DifficultyTier => { ... }` block was removed entirely; the top-level `export function tier(diff: number): DifficultyTier` is hoisted by TypeScript and visible to all call sites in `computeClubForm` (lines 108, 122 via `tier(attDiff)`). Behavioural identity verified by the 3 boundary tests (0.4 inclusive = easy, 0.6 inclusive = hard, 0.5 = medium).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test used wrong player dict key for upcoming fixtures**
- **Found during:** Task 1, RED phase — `KeyError: 'upcoming_fixtures'`
- **Issue:** The `merge_players()` return dict uses `'fixtures'` as the key for the per-player upcoming fixture list, not `'upcoming_fixtures'`
- **Fix:** Updated both new pytest functions to use `p['fixtures']` instead of `p['upcoming_fixtures']`
- **Files modified:** `pipeline/tests/test_merge.py`
- **Commit:** `b5d539f` (included in Task 1 commit after fix)

## Plan 02 Unblocked

- `tier()` is now importable: `import { tier } from '@/lib/club-form'`
- Both LOOKAHEAD constants are 32 — pipeline emits up to 32 fixtures, client reads up to 32
- `types.ts` comment reflects the new horizon
- Plan 02 (`FixtureHeatMap.tsx` extension) can proceed immediately

## Known Stubs

None — both constants are wired end-to-end. No placeholder data or stub return values.

## Threat Flags

None — constant bump introduces no new trust boundaries. T-075-01 through T-075-03 all accepted per plan threat model.

## Self-Check: PASSED

- `pipeline/merge.py` — FIXTURE_LOOKAHEAD = 32: FOUND
- `src/lib/club-form.ts` — LOOKAHEAD = 32: FOUND (line 47)
- `src/lib/club-form.ts` — export function tier: FOUND (line 6)
- `src/lib/types.ts` — // next 32: FOUND (line 433)
- `src/lib/__tests__/club-form-lookahead.test.ts` — exists: FOUND
- `pipeline/tests/test_merge.py` — test_fixture_lookahead_caps_at_32: FOUND
- commit `b5d539f`: FOUND
- commit `41dc80a`: FOUND
- `pytest pipeline/tests/test_merge.py`: 5 passed
- `vitest club-form-lookahead + club-form-swing`: 11 passed
