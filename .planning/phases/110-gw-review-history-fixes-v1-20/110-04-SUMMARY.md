---
phase: 110
plan: 04
subsystem: api/gw-review
tags: [bugfix, api, gap-closure, fpl-live-endpoint, gw-review, captain-delta, tdd, cr-01]
dependency_graph:
  requires: [110-02]
  provides: [captain_delta_liveMap_fix]
  affects: [src/app/api/gw-review/route.ts, src/app/api/gw-review/route.test.ts]
tech_stack:
  added: []
  patterns: [liveMap.get(element) ?? fallback, TDD RED/GREEN]
key_files:
  modified:
    - src/app/api/gw-review/route.ts
    - src/app/api/gw-review/route.test.ts
decisions:
  - "Used `?? total_points` (not `?? 0`) as fallback in captainDeltaRaw — preserves SC-5 graceful-degradation contract when live endpoint is unavailable; pick.total_points=0 for settled GWs anyway so the degradation is acceptable"
  - "Triple Captain multiplier (yourCaptain.multiplier) preserved unchanged — only the total_points operands changed, not the multiplier structure"
metrics:
  duration: ~5 min
  completed: 2026-05-14
  tasks_completed: 2
  files_changed: 2
---

# Phase 110 Plan 04: captainDeltaRaw liveMap Gap Closure (CR-01) Summary

Gap CR-01 from 110-VERIFICATION.md closed: `captainDeltaRaw` in `/api/gw-review` now reads live points from `liveMap` for both captain operands, fixing `captain_delta=0` for all settled GWs where the user's captain differed from the optimal captain.

## What Was Done

### Task 1: RED — Failing captain_delta liveMap test added

A new test was appended to the existing `describe('Phase 110 FIX-03/04: /api/gw-review live endpoint for settled GW points', ...)` block in `src/app/api/gw-review/route.test.ts`.

**Test name:** `'captain_delta reflects liveMap point difference when yourCaptain != optimalCaptain in a settled GW (CR-01)'`

**Fixture construction:**
- `makeStarters()` called, then all `starters[i].total_points = 0` (settled-GW model)
- element=1: captain (multiplier=2, is_captain=true), pick.total_points=0
- element=2: vice-captain (multiplier=1), pick.total_points=0
- `liveData`: element=1 → 14 pts, element=2 → 20 pts, elements 3-11 → 4 pts, bench → 0 pts
- `mockUpstream(allPicks, elements, null, false, liveData, true)` (dreamTeamOk=false, liveOk=true)

**Critical assertion:** `expect(body.captain_delta).toBe(12)` — derives from `Math.max(0, 20*2 - 14*2) = 12`

**RED state confirmed:** 1 failing test (captain_delta=0 vs expected 12), 10 passing.

**Commit:** `5403a96` — `test(110-04): add failing captain_delta liveMap test (CR-01 RED)`

### Task 2: GREEN — captainDeltaRaw rewired to use liveMap

**Lines modified in `src/app/api/gw-review/route.ts` (Step 5 captainDeltaRaw region, ~lines 218-229):**

Comment block updated from:
```
// D-06: captain delta uses pick.multiplier (Pitfall 3 — handles Triple Captain where multiplier=3)
// Clamp to 0 if your captain WAS the optimal captain (or if Triple Captain on optimal makes
// the formula go negative — defence in depth)
```

To:
```
// D-06: captain delta uses pick.multiplier (Pitfall 3 — handles Triple Captain where multiplier=3).
// CR-01 (Phase 110 gap closure): both total_points operands now read from liveMap with
// `?? total_points` fallback. pick.total_points is 0 for settled GWs (same root cause as
// FIX-03/04); without the liveMap lookup, captain_delta would always be 0 when user
// captain != optimal captain. The `?? total_points` fallback (not `?? 0`) preserves SC-5
// behaviour when the live endpoint is unavailable.
// Clamp to 0 if your captain WAS the optimal captain (or if Triple Captain on optimal
// makes the formula go negative — defence in depth).
```

Formula changed from (BROKEN):
```typescript
const captainDeltaRaw =
  optimalCaptain.total_points * 2 - yourCaptain.total_points * yourCaptain.multiplier
```

To (FIXED):
```typescript
const captainDeltaRaw =
  (liveMap.get(optimalCaptain.element) ?? optimalCaptain.total_points) * 2 -
  (liveMap.get(yourCaptain.element) ?? yourCaptain.total_points) * yourCaptain.multiplier
```

**Commit:** `17c42e7` — `fix(110-04): rewire captainDeltaRaw to use liveMap with ?? total_points fallback (CR-01)`

## Vitest Results

**`npx vitest run src/app/api/gw-review/route.test.ts`:** 11 passed, 0 failed

**`npx vitest run` (full suite):** 4 test files failed | 102 passed (106 total) — all 4 failing files are pre-existing failures unrelated to this plan:
- `tests/lib/captain-picks.test.ts` — 5 pre-existing failures (STATE.md deferred item TEST-57)
- `tests/lib/club-form.test.ts` — 1 pre-existing failure
- `src/components/nav/MobileNav.test.tsx` — 9 pre-existing failures
- `src/lib/hooks/useRivals.test.ts` — 9 pre-existing failures

Baseline before this plan (stashed state): 5 failed files, 26 failed tests. After this plan: 4 failed files, 25 failed tests. Zero regressions introduced.

## Preservation Verification

- `yourCaptain.multiplier` still present in formula: YES (Triple Captain semantics intact)
- Fallback is `?? total_points` (not `?? 0`): YES (SC-5 graceful-degradation preserved)
- `Math.max(0, captainDeltaRaw)` clamp preserved: YES (D-06 defence in depth)
- `top_scorer_pts: liveMap.get(topScorer.element) ?? 0` unchanged: YES (FIX-03 untouched)
- `best_bench_player_pts: bestBench != null ? (liveMap.get(bestBench.element) ?? 0) : 0` unchanged: YES (FIX-04 untouched)
- Step 4b liveMap construction unchanged: YES

## Gap Closure Confirmation

CR-01 from `110-REVIEW.md` and the gap from `110-VERIFICATION.md` are now closed. The `captain_delta` field on `/api/gw-review` will reflect the live-point difference for settled GWs when the user's captain differs from the optimal captain, instead of always returning 0.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

No new security surface introduced. The two new `liveMap.get(element) ?? total_points` consumers inherit the existing standalone try/catch from Step 4b (Plan 02). T-110-04-01 and T-110-04-02 mitigations confirmed present via the `?? total_points` fallback and the unchanged Step 4b error handler.

## Self-Check: PASSED
- `src/app/api/gw-review/route.ts` — modified (exists, contains liveMap.get(optimalCaptain.element))
- `src/app/api/gw-review/route.test.ts` — modified (exists, contains CR-01 test)
- Commit `5403a96` — found in git log
- Commit `17c42e7` — found in git log
