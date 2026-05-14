---
phase: 110-gw-review-history-fixes-v1-20
verified: 2026-05-14T22:49:30Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "captainDeltaRaw not using liveMap for either operand (CR-01) — both operands now use liveMap.get(element) ?? total_points; companion test added; 11/11 route tests pass"
  gaps_remaining: []
  regressions: []
---

# Phase 110: GW Review & History Fixes — Re-Verification Report

**Phase Goal:** User trusts the post-gameweek summary because the top scorer, bench points, dream-team comparison and decision-history captain analytics all display correct numbers — eliminating four data-accuracy bugs that currently undermine the review/history surfaces.
**Verified:** 2026-05-14T22:49:30Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Plan 04 closed CR-01)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GW Review top scorer card displays the player's actual points (FIX-03) | VERIFIED | `route.ts` Step 4b fetches `event/${gw}/live/` into `liveMap`; output field `top_scorer_pts: liveMap.get(topScorer.element) ?? 0` (line 261). Test asserts `body.top_scorer_pts === 14` (live value, not `pick.total_points=5`). SC-5 test confirms HTTP 200 on liveMap failure. |
| 2 | GW Review best bench card displays actual bench points (FIX-04) | VERIFIED | Same `liveMap` from Step 4b; output field `best_bench_player_pts: bestBench != null ? (liveMap.get(bestBench.element) ?? 0) : 0` (line 267). Test asserts `body.best_bench_player_pts === 9`. |
| 3 | GW Review dream-team delta shows correct sign — positive when dream team outscored user (FIX-05) | VERIFIED | `GwReviewTab.tsx` line 172: `benchmarkDiff = review.benchmark_score - review.your_score`. 3 TDD tests pass: your_score=72/benchmark=122 → `+50 vs you` amber; your_score=95/benchmark=80 → `−15 vs you` green (U+2212); equal → `on par` green. |
| 4 | GW Review captain analytics display correct numbers — captain_delta reflects liveMap point difference (CR-01) | VERIFIED | `gw-review/route.ts` lines 226-228: `captainDeltaRaw = (liveMap.get(optimalCaptain.element) ?? optimalCaptain.total_points) * 2 - (liveMap.get(yourCaptain.element) ?? yourCaptain.total_points) * yourCaptain.multiplier`. `yourCaptain.multiplier` preserved. Companion test (CR-01) asserts `body.captain_delta === 12` with all `pick.total_points=0` and `liveData` returning element2=20pts (optimal), element1=14pts (captain). All 11 route tests pass. |
| 5 | Decision History captain delta column displays actual points difference — not dashes (FIX-06) | VERIFIED | `decision-history/route.ts` Step 2b (lines 124-158): `uniqueCeilingIds` Set, `Promise.allSettled` fan-out over `element-summary/${id}/`, builds `actualPtsMap: Map<number, Map<number, number>>`. Line 174-175: `modelCeilingPts = modelCeilingId !== null ? (actualPtsMap.get(modelCeilingId)?.get(gw) ?? null) : null`. CR-01 hardcode from Phase 96 removed. 4 tests pass: happy path (regret=16), SC-5 503 fallback (null), dedup (1 call for 2 GWs), ENOENT skip. |

**Score:** 4/4 truths verified (+ decision-history truth #5 also verified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/squad/GwReviewTab.tsx` | Corrected benchmarkDiff sign; swapped sentiment classes | VERIFIED | Line 172: `benchmark_score - your_score`. `benchmarkDiff > 0` → amber; `< 0` → green. |
| `src/components/squad/GwReviewTab.test.tsx` | FIX-05 TDD coverage + updated PGW-03 assertions | VERIFIED | Contains `Phase 110 FIX-05` describe block. 17/17 tests pass. |
| `src/app/api/gw-review/route.ts` | Step 4b standalone try/catch for `event/${gw}/live/` + liveMap-based output fields + captainDeltaRaw via liveMap | VERIFIED | Step 4b at lines 171-189. Lines 226-228 use `liveMap.get(optimalCaptain.element) ?? optimalCaptain.total_points` and `liveMap.get(yourCaptain.element) ?? yourCaptain.total_points`. 6 total `liveMap.get(` occurrences confirmed. CR-01 comment at lines 218-225. |
| `src/app/api/gw-review/route.test.ts` | FIX-03/04 TDD coverage + CR-01 captain_delta test (11 tests total) | VERIFIED | Contains `Phase 110 FIX-03/04` describe block with 4 tests (3 original + 1 new CR-01 test). `body.captain_delta === 12` assertion present. 11/11 tests pass. |
| `src/app/api/decision-history/route.ts` | Step 2b Promise.allSettled fan-out + actualPtsMap + modelCeilingPts from lookup | VERIFIED | Step 2b at lines 124-158. `Promise.allSettled` at line 136. `actualPtsMap` at line 134. `modelCeilingPts` at lines 174-175. CR-01 hardcode gone. |
| `src/app/api/decision-history/route.test.ts` | New test file with 4 FIX-06 tests (Wave 0 gap) | VERIFIED | File exists. First line: `// @vitest-environment node`. Contains `Phase 110 FIX-06`. 4/4 tests pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `GwReviewTab.tsx` | `review.benchmark_score / review.your_score` | `benchmark_score - your_score` at line 172 | VERIFIED | Correct subtraction order (benchmark minus user). |
| `gw-review/route.ts` Step 4b | `event/${gw}/live/` | `fetch` inside standalone try/catch, User-Agent header | VERIFIED | Line 176 fetches live endpoint. Standalone — no Promise.all wrap. Empty catch block. |
| `gw-review/route.ts` Step 5 (top scorer / bench) | `liveMap.get(element)` | `?? 0` fallback on every per-player lookup | VERIFIED | Lines 202, 213, 261, 267 use `liveMap.get(p.element) ?? 0`. |
| `gw-review/route.ts` Step 5 (captainDeltaRaw) | `liveMap.get(element)` | `?? total_points` fallback for both captain operands | VERIFIED | Lines 227-228 use `liveMap.get(optimalCaptain.element) ?? optimalCaptain.total_points` and `liveMap.get(yourCaptain.element) ?? yourCaptain.total_points`. `yourCaptain.multiplier` preserved. |
| `decision-history/route.ts` Step 2b | `element-summary/${id}/` | `Promise.allSettled` over `uniqueCeilingIds` | VERIFIED | Line 139 fetches `element-summary/${id}/`. `Promise.allSettled` at line 136. |
| `decision-history/route.ts` Step 3 | `actualPtsMap` | `actualPtsMap.get(modelCeilingId)?.get(gw) ?? null` | VERIFIED | Lines 174-175 use two-level map lookup. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `gw-review/route.ts` output `top_scorer_pts` | `liveMap.get(topScorer.element) ?? 0` | `event/${gw}/live/` → Step 4b → `liveMap` | Yes — FPL live endpoint returns actual post-GW points | FLOWING |
| `gw-review/route.ts` output `best_bench_player_pts` | `liveMap.get(bestBench.element) ?? 0` | Same liveMap | Yes | FLOWING |
| `gw-review/route.ts` output `captain_delta` | `(liveMap.get(optimalCaptain.element) ?? total_points) * 2 - (liveMap.get(yourCaptain.element) ?? total_points) * multiplier` | Same liveMap (Plan 04 CR-01 fix) | Yes — liveMap used for both captain operands; `?? total_points` SC-5 fallback | FLOWING |
| `GwReviewTab.tsx` `benchmarkDiff` | `review.benchmark_score - review.your_score` | API response fields (both populated by route) | Yes | FLOWING |
| `decision-history/route.ts` output `modelCeilingPts` | `actualPtsMap.get(modelCeilingId)?.get(gw) ?? null` | `element-summary/${id}/` → Step 2b → `actualPtsMap` | Yes — FPL element-summary carries full season history | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| FIX-05 component tests (17 total) | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | 17 passed, 0 failed | PASS |
| FIX-03/04 + CR-01 route tests (11 total) | `npx vitest run src/app/api/gw-review/route.test.ts` | 11 passed, 0 failed | PASS |
| FIX-06 decision-history tests (4 total) | `npx vitest run src/app/api/decision-history/route.test.ts` | 4 passed, 0 failed | PASS |
| CR-01 captain_delta liveMap wiring (grep) | `grep "liveMap.get(optimalCaptain.element)"` in route.ts | Found at line 227 | PASS |
| CR-01 broken formula absent | `grep "optimalCaptain.total_points \* 2 - yourCaptain.total_points"` in route.ts | Not found | PASS |
| SC-5 standalone catch for Step 4b | Inspect route.ts lines 171-189 | Empty `catch {}` block; no Promise.all wrap | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FIX-03 | 110-02-PLAN.md | GW Review top scorer card displays actual points | SATISFIED | `top_scorer_pts: liveMap.get(topScorer.element) ?? 0`; test asserts 14 not 5 |
| FIX-04 | 110-02-PLAN.md | GW Review best bench card displays actual bench points | SATISFIED | `best_bench_player_pts: bestBench != null ? (liveMap.get(bestBench.element) ?? 0) : 0`; test asserts 9 not 0 |
| FIX-05 | 110-01-PLAN.md | Dream team delta shows correct sign | SATISFIED | `benchmarkDiff = review.benchmark_score - review.your_score`; 3 TDD tests pass |
| FIX-06 | 110-03-PLAN.md | Decision history captain delta populated with actual points | SATISFIED | CR-01 Phase 96 deferral removed; `modelCeilingPts` from `actualPtsMap.get(modelCeilingId)?.get(gw) ?? null`; 4 TDD tests pass |
| CR-01 | 110-04-PLAN.md (gap closure) | captainDeltaRaw uses liveMap for both captain operands | SATISFIED | `liveMap.get(optimalCaptain.element) ?? optimalCaptain.total_points` and `liveMap.get(yourCaptain.element) ?? yourCaptain.total_points` at lines 227-228; companion test asserts `captain_delta === 12`; 11/11 route tests pass |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/squad/GwReviewTab.tsx` | 156 | `captainDelta == null` (loose equality) | INFO | WR-03 pre-existing. `captainDelta` is `number \| null` never `undefined`; `==` and `===` are equivalent. Low risk, cosmetic. |
| `src/components/squad/GwReviewTab.tsx` | 161-163 | `deltaClass` resolves to amber when `captainDelta` is null | INFO | WR-02 pre-existing. Unavailable data shown amber rather than neutral. Does not affect correctness. |

No BLOCKER or WARNING anti-patterns remain. All patterns flagged in the previous verification report are pre-existing and non-blocking.

### Human Verification Required

None required for this phase. All must-haves are verified programmatically:
- All three test suites run and pass (32 tests total: 17 + 11 + 4).
- The critical CR-01 fix is verified by code inspection and a deterministic unit test asserting `captain_delta === 12` with `pick.total_points=0` for all players and diverging liveMap values.

Manual UAT (already deferred to /gsd-uat-phase by all four plans): Hit `/api/gw-review` for a settled GW where user captain differs from optimal captain — `captain_delta` should now reflect the live point difference, not 0.

### Gaps Summary

No gaps. The previous verification's single gap (CR-01 — captainDeltaRaw not using liveMap) was resolved by Plan 04:

- Task 1 (RED): Added `'captain_delta reflects liveMap point difference when yourCaptain != optimalCaptain in a settled GW (CR-01)'` test to the Phase 110 FIX-03/04 describe block. With all `pick.total_points=0` and liveMap returning element2=20pts, element1=14pts, the broken formula yielded 0; the test asserted 12 (FAIL).
- Task 2 (GREEN): Rewired `captainDeltaRaw` to `(liveMap.get(optimalCaptain.element) ?? optimalCaptain.total_points) * 2 - (liveMap.get(yourCaptain.element) ?? yourCaptain.total_points) * yourCaptain.multiplier`. `yourCaptain.multiplier` preserved (Triple Captain semantics). `?? total_points` fallback (not `?? 0`) preserves SC-5 behaviour when live endpoint is unavailable.
- Result: 11/11 tests pass in `gw-review/route.test.ts`; full suite: 0 new failures.

---

_Verified: 2026-05-14T22:49:30Z_
_Verifier: Claude (gsd-verifier)_
