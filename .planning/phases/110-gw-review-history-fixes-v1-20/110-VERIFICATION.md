---
phase: 110-gw-review-history-fixes-v1-20
verified: 2026-05-14T00:00:00Z
status: gaps_found
score: 3/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "GW Review captain analytics (captain_delta) display correct numbers for settled gameweeks"
    status: failed
    reason: "captainDeltaRaw at route.ts lines 221-222 reads optimalCaptain.total_points and yourCaptain.total_points directly from FPL picks. pick.total_points is 0 for settled GWs (the same root cause FIX-03/04 resolved for top_scorer_pts and best_bench_player_pts). liveMap is now built in Step 4b but is NOT used in the captainDeltaRaw formula, making captain_delta wrong whenever user captain != optimal captain in a settled GW."
    artifacts:
      - path: "src/app/api/gw-review/route.ts"
        issue: "Lines 221-222: captainDeltaRaw = optimalCaptain.total_points * 2 - yourCaptain.total_points * yourCaptain.multiplier. Both operands read from pick.total_points (stale field). The liveMap built in Step 4b is unused here. The FIX-03/04 test does not catch this because its fixture uses the same element for both user captain and optimal captain (delta = 0 under either formula)."
    missing:
      - "Replace optimalCaptain.total_points with liveMap.get(optimalCaptain.element) ?? optimalCaptain.total_points in captainDeltaRaw"
      - "Replace yourCaptain.total_points with liveMap.get(yourCaptain.element) ?? yourCaptain.total_points in captainDeltaRaw"
      - "Add a companion test with yourCaptain != optimalCaptain with diverging pick.total_points vs liveMap values, asserting captain_delta equals the liveMap-based result"
---

# Phase 110: GW Review & History Fixes Verification Report

**Phase Goal:** User trusts the post-gameweek summary because the top scorer, bench points, dream-team comparison and decision-history captain analytics all display correct numbers — eliminating four data-accuracy bugs that currently undermine the review/history surfaces
**Verified:** 2026-05-14T00:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can open GW Review and see the top scorer card render the player's actual points (FIX-03) | VERIFIED | `route.ts` Step 4b fetches `event/${gw}/live/` into `liveMap`; output field `top_scorer_pts: liveMap.get(topScorer.element) ?? 0` at line 255. Test `top_scorer_pts equals live total_points for the top starter` asserts `body.top_scorer_pts === 14` (live value) not 5 (pick.total_points). SC-5 test confirms 200 response on liveMap failure. |
| 2 | User can open GW Review and see the best bench card display actual bench points (FIX-04) | VERIFIED | Same `liveMap` from Step 4b; output field `best_bench_player_pts: bestBench != null ? (liveMap.get(bestBench.element) ?? 0) : 0` at line 261. Test `best_bench_player_pts equals live total_points for the best bench player` asserts `body.best_bench_player_pts === 9`. |
| 3 | User can see dream-team delta with correct sign — positive when dream team outscored user (FIX-05) | VERIFIED | `GwReviewTab.tsx` line 172: `benchmarkDiff = review.benchmark_score - review.your_score`. Tests confirm: your_score=72, benchmark_score=122 → `+50 vs you` amber; your_score=95, benchmark_score=80 → `−15 vs you` (U+2212) green; your_score=88, benchmark_score=88 → `on par` green. |
| 4 | User can open Decision History and see captain delta populated with actual points difference (FIX-06) | VERIFIED | `decision-history/route.ts` Step 2b: collects `uniqueCeilingIds`, fans out `element-summary/${id}/` via `Promise.allSettled`, builds `actualPtsMap: Map<number, Map<number, number>>`. Line 174-175: `modelCeilingPts = modelCeilingId !== null ? (actualPtsMap.get(modelCeilingId)?.get(gw) ?? null) : null`. CR-01 deferral from Phase 96 removed. 4 tests pass covering happy path (regret=16), SC-5 503 fallback (null), dedup (1 call for 2 GWs), and ENOENT skip. |

**Score:** 3/4 truths verified — SC-1 through SC-3 verified; SC-4 verified. The gap is separate from the success criteria: it is the captainDeltaRaw bug (CR-01 from code review), which corrupts the GW Review captain delta stat card for settled GWs.

### Phase Goal Broader Assessment

The phase goal contains the phrase "captain analytics all display correct numbers." The 4 success criteria map to FIX-03, FIX-04, FIX-05, FIX-06. However, the GW Review surface also has a "Captain delta" stat card (`captain_delta` field) computed by `captainDeltaRaw`. This field is NOT one of the 4 explicitly named requirements but falls within the "captain analytics" text of the goal.

**CR-01 analysis:** The code review identified that `captainDeltaRaw` still reads `optimalCaptain.total_points` and `yourCaptain.total_points` from the FPL picks response. `pick.total_points` is 0 for settled GWs — the same root cause FIX-03/04 fixed for `top_scorer_pts` and `best_bench_player_pts`. Phase 110's plan 02 Task 2 explicitly says "Do NOT touch the captain_delta computation" but this instruction is incorrect: after FIX-03/04, `liveMap` is now available but deliberately not used for `captainDeltaRaw`, creating a partial fix. The GW Review captain delta card will show 0 ("Optimal captain - no delta") for any settled GW where the user's captain and the optimal captain differ — regardless of how many actual points each scored. This is a regression vs. pre-Phase-110 behavior in terms of user trust: the three stats around it (top_scorer_pts, best_bench_player_pts) now show correct live values, but captain_delta remains stuck at a misleading 0/wrong value.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/squad/GwReviewTab.tsx` | Corrected benchmarkDiff sign and swapped sentiment classes | VERIFIED | Line 172: `benchmark_score - your_score`. `benchmarkDiff > 0` → amber; `< 0` → green. |
| `src/components/squad/GwReviewTab.test.tsx` | FIX-05 TDD coverage + updated PGW-03 assertions | VERIFIED | Contains `Phase 110 FIX-05` describe block with 3 tests. Updated PGW-03 assertions match corrected sign. 17 tests pass. |
| `src/app/api/gw-review/route.ts` | Step 4b standalone try/catch for `event/${gw}/live/` + liveMap-based output fields | VERIFIED | Step 4b at lines 171-189 builds `liveMap`. Lines 255 and 261 use `liveMap.get()`. Standalone (no Promise.all). Empty catch block. |
| `src/app/api/gw-review/route.test.ts` | FIX-03/04 TDD coverage including SC-5 | VERIFIED | Contains `Phase 110 FIX-03/04` describe block with 3 tests. `mockUpstream` has `/live/` branch. Assertions for `top_scorer_pts===14`, `best_bench_player_pts===9`, `res.status===200` on liveOk=false. |
| `src/app/api/decision-history/route.ts` | Step 2b with Promise.allSettled fan-out + actualPtsMap + modelCeilingPts from lookup | VERIFIED | Step 2b at lines 124-160. `Promise.allSettled` at line 136. `actualPtsMap` at line 134. `modelCeilingPts` at line 174-175. CR-01 hardcode removed. |
| `src/app/api/decision-history/route.test.ts` | New test file with 4 FIX-06 tests (Wave 0 gap) | VERIFIED | File exists. First line: `// @vitest-environment node`. Contains `Phase 110 FIX-06`. Has 4 tests: happy path, SC-5, dedup, ENOENT skip. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `GwReviewTab.tsx` | `review.benchmark_score / review.your_score` | `benchmark_score - your_score` at line 172 | VERIFIED | Pattern present. Subtraction order is correct (benchmark minus your). |
| `gw-review/route.ts` Step 4b | `event/${gw}/live/` | `fetch` inside standalone try/catch, User-Agent header | VERIFIED | Line 176 fetches the live endpoint. Matches plan pattern `event/\$\{gw\}/live/`. |
| `gw-review/route.ts` Step 5 | `liveMap.get(element)` | `?? 0` fallback on every per-player lookup | VERIFIED | Lines 202, 213 use `liveMap.get(p.element) ?? 0` in reductions. Lines 255, 261 use it in output. |
| `decision-history/route.ts` Step 2b | `element-summary/${id}/` | `Promise.allSettled` over `uniqueCeilingIds` | VERIFIED | Line 139 fetches `element-summary/${id}/`. `Promise.allSettled` confirmed at line 136. |
| `decision-history/route.ts` Step 3 | `actualPtsMap` | `actualPtsMap.get(modelCeilingId)?.get(gw) ?? null` | VERIFIED | Line 174-175 uses the two-level map lookup. |

### Gap: captainDeltaRaw Not Updated to Use liveMap (CR-01)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `gw-review/route.ts` Step 5 | `liveMap` for `captainDeltaRaw` | Should use `liveMap.get(element)` for both operands | NOT_WIRED | Lines 221-222 still read `optimalCaptain.total_points` and `yourCaptain.total_points`. `liveMap` is available (built in Step 4b) but not used here. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `gw-review/route.ts` output `top_scorer_pts` | `liveMap.get(topScorer.element) ?? 0` | `event/${gw}/live/` → Step 4b → `liveMap` | Yes — liveMap populated from FPL live endpoint actual points | FLOWING |
| `gw-review/route.ts` output `best_bench_player_pts` | `liveMap.get(bestBench.element) ?? 0` | Same liveMap | Yes | FLOWING |
| `gw-review/route.ts` output `captain_delta` | `optimalCaptain.total_points * 2 - yourCaptain.total_points * yourCaptain.multiplier` | `pick.total_points` from FPL picks | No — `pick.total_points` is 0 for settled GWs | DISCONNECTED (from liveMap) |
| `GwReviewTab.tsx` benchmarkDiff | `review.benchmark_score - review.your_score` | API response fields | Yes — both fields populated correctly | FLOWING |
| `decision-history/route.ts` output `modelCeilingPts` | `actualPtsMap.get(modelCeilingId)?.get(gw) ?? null` | `element-summary/${id}/` → Step 2b → `actualPtsMap` | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| FIX-05 component tests | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | 17 passed (per SUMMARY) | PASS (SUMMARY-reported; source code confirms correct implementation) |
| FIX-03/04 route tests | `npx vitest run src/app/api/gw-review/route.test.ts` | 10 passed (per SUMMARY) | PASS (source confirms liveMap wired correctly for top_scorer_pts/best_bench_player_pts) |
| FIX-06 route tests | `npx vitest run src/app/api/decision-history/route.test.ts` | 4 passed (per SUMMARY) | PASS (source confirms actualPtsMap lookup replaces hardcoded null) |
| captainDeltaRaw liveMap wiring | Inspect lines 221-222 of route.ts | `optimalCaptain.total_points * 2 - yourCaptain.total_points * yourCaptain.multiplier` | FAIL — pick.total_points used, not liveMap |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FIX-03 | 110-02-PLAN.md | GW Review top scorer card displays actual points | SATISFIED | `top_scorer_pts: liveMap.get(topScorer.element) ?? 0` at route.ts line 255; test asserts 14 not 5 |
| FIX-04 | 110-02-PLAN.md | GW Review best bench card displays actual bench points | SATISFIED | `best_bench_player_pts: bestBench != null ? (liveMap.get(bestBench.element) ?? 0) : 0` at route.ts line 261; test asserts 9 not 0 |
| FIX-05 | 110-01-PLAN.md | Dream team delta shows correct sign | SATISFIED | `benchmarkDiff = review.benchmark_score - review.your_score` at GwReviewTab.tsx line 172; 3 TDD tests covering all cases |
| FIX-06 | 110-03-PLAN.md | Decision history captain delta populated | SATISFIED | CR-01 deferral from Phase 96 removed; `modelCeilingPts` from `actualPtsMap.get(modelCeilingId)?.get(gw) ?? null`; 4 TDD tests pass |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/api/gw-review/route.ts` | 221-222 | `optimalCaptain.total_points * 2 - yourCaptain.total_points * yourCaptain.multiplier` | BLOCKER | `pick.total_points` is 0 for settled GWs. liveMap exists (Step 4b) but is not used for `captainDeltaRaw`. The GW Review "Captain delta" stat card will show 0 (no regret apparent) in any settled GW where user captain differs from optimal captain — directly contradicting the phase goal that "captain analytics all display correct numbers". |
| `src/components/squad/GwReviewTab.tsx` | 156 | `captainDelta == null` (loose equality) | WARNING | WR-03 from code review. `captainDelta` is typed as `number \| null` never `undefined`; `==` and `===` are equivalent here. Low risk but inconsistent with project style. |
| `src/components/squad/GwReviewTab.tsx` | 161-163 | `deltaClass` resolves to amber when `captainDelta` is null | WARNING | WR-02 from code review. Unavailable data shown in amber (implies bad captain choice) rather than neutral grey. |
| `src/app/api/gw-review/route.ts` | 197 | `starters.find(p => p.is_captain) ?? starters[0]` | WARNING | WR-01 from code review. Silent wrong-captain fallback if FPL picks return no captain. Produces plausible-looking but incorrect data. Pre-existing issue. |

### Human Verification Required

None required programmatically beyond the gap above. The captainDeltaRaw issue is deterministically verifiable from code inspection and the code review finding.

**Note for manual UAT (already deferred by plans):** After gap is resolved, test `/api/gw-review` for a settled GW where user captain differs from optimal captain — `captain_delta` should reflect live point difference, not 0.

### Gaps Summary

**1 gap blocking full goal achievement.**

The phase successfully implements FIX-03, FIX-04, FIX-05, and FIX-06 per their explicit requirements. All 4 REQUIREMENTS.md items (FIX-03 through FIX-06) are satisfied by their specific acceptance criteria.

However, Phase 110's FIX-03/04 work introduced an inconsistency: `liveMap` is now built (correctly) in Step 4b and used for `top_scorer_pts` and `best_bench_player_pts`, but the `captainDeltaRaw` formula on lines 221-222 was not updated and continues to read `pick.total_points`. For settled GWs, `pick.total_points` is 0 for all players, meaning:
- `optimalCaptain.total_points * 2 = 0`
- `yourCaptain.total_points * multiplier = 0`
- `captainDeltaRaw = 0 - 0 = 0`
- `captainDelta = Math.max(0, 0) = 0`

The captain delta card will always show "0 / Optimal captain - no delta" for any settled GW, regardless of actual points. This is precisely the problem FIX-03/04 was introduced to fix — and the fix is incomplete because it only covers two of the three fields that read from `pick.total_points`.

The code review identified this as CR-01 before this verification. The fix is straightforward: replace `optimalCaptain.total_points` with `liveMap.get(optimalCaptain.element) ?? optimalCaptain.total_points` and `yourCaptain.total_points` with `liveMap.get(yourCaptain.element) ?? yourCaptain.total_points` in `captainDeltaRaw`. The `?? pick.total_points` fallback preserves SC-5 behavior when liveMap is empty.

**Root cause of the gap:** Plan 02 Task 2 explicitly instructed the executor not to touch `captainDeltaRaw` ("this is unrelated to FIX-03/04"). This instruction was incorrect — `captain_delta` shares the same root cause (D-01: `pick.total_points` = 0 for settled GWs) and the same fix (liveMap lookup). The FIX-03/04 tests did not catch this because the test fixture uses element=1 as both user captain and optimal captain, making the delta zero under both the old and new formulas.

---

_Verified: 2026-05-14T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
