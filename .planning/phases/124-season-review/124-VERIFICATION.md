---
phase: 124-season-review
verified: 2026-05-19T00:00:00Z
status: human_needed
score: 7/8 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "A season variance chart shows GW-by-GW rank trajectory with an xPts expectation overlay; chip GWs are highlighted with a distinct marker"
    reason: "User explicitly chose 'Points' chart over 'Rank trajectory' in the Discussion Log (124-DISCUSSION-LOG.md). CONTEXT.md D-01 documents this as the approved decision. UI-SPEC approved a GW points + avg manager overlay chart. The chart delivers the spirit of REV-03 (GW-by-GW seasonal view with chip markers) using the user-approved data axes."
    accepted_by: "needs-owner-acceptance"
    accepted_at: "2026-05-19T00:00:00Z"
human_verification:
  - test: "Verify 'Season' sub-tab appears between 'Accuracy' and 'Price Changes' in the Analyse nav on desktop"
    expected: "Season tab is the 7th tab in Analyse, after Accuracy, before Price Changes; clicking it renders the Season Review UI"
    why_human: "UI nav ordering requires visual inspection in a running browser; SECTIONS array order is correct in code but MobileNav rendering needs confirmation"
  - test: "Verify the chart chip markers render as amber dots (r=6, fill=#f59e0b) on GWs where a chip was played"
    expected: "Chip GWs show a filled amber circle, non-chip GWs show a small currentColor circle"
    why_human: "ChipDot is a custom recharts dot renderer; jsdom tests mock recharts — visual confirmation requires a running browser"
  - test: "Verify the grade resolves to A/B/C/D (not always '—') when a valid team ID with complete data is supplied"
    expected: "After all three hooks load, the grade badge shows a letter; if historyQuery returns no entries, grade shows '—' correctly"
    why_human: "Grade depends on live FPL data via useDecisionHistory; the three-hook success gate can only be confirmed against real data"
  - test: "Verify that pre-deployment GW handling matches ROADMAP SC1 intent"
    expected: "GWs before the app was deployed do not appear as zero-value entries; the route returns only GWs present in FPL history.current[], so N/A rows simply don't appear"
    why_human: "Requires confirming against a real FPL team that joined mid-season — the code is correct but the ROADMAP said 'N/A rather than zero' which implies a distinct N/A row; the implementation omits those rows entirely instead"
---

# Phase 124: Season Review Verification Report

**Phase Goal:** Ship a Season Review tab in the Analyse section that shows each manager's season at a glance — ranked performance, a decision-quality grade (A–D), and a GW points chart — all computed client-side from FPL data the app already fetches.
**Verified:** 2026-05-19
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | GET /api/season-review?teamId={id} returns aggregated SeasonReview JSON for valid numeric teamId | VERIFIED | `src/app/api/season-review/route.ts` line 66: `export async function GET(request: NextRequest)`. Full aggregation logic with parallel FPL fetches, gwData mapping, and SeasonReview payload construction confirmed at lines 77–148. |
| 2 | GET /api/season-review with missing/non-numeric teamId returns 400 | VERIFIED | Route line 71–73: `if (!teamIdParam \|\| !/^\d+$/.test(teamIdParam)) return Response.json({ error: 'Invalid teamId parameter' }, { status: 400 })`. Route test file contains 8 tests including test 1 (missing) and test 2 (non-numeric). |
| 3 | computeDecisionGrade returns A/B/C/D matching D-05/D-06 thresholds | VERIFIED | `src/lib/season-review.ts` lines 41–47: correct branching logic with thresholds `>= 0.75 → 'A'`, `>= 0.50 → 'B'`, `>= 0.25 → 'C'`, else `'D'`. Test file has 10 tests covering all boundaries. |
| 4 | computeDecisionGrade with chipCount=0 renormalizes captainEV+hitBE weights and never divides by zero | VERIFIED | `src/lib/season-review.ts` line 42: `captainEVRate * (40 / 75) + hitBreakEvenRate * (35 / 75)` — chipROIPositiveRate not referenced in that branch. Tests 6/7/8 cover this path including NaN guard. |
| 5 | useSeasonReview(teamId) fetches /api/season-review and is disabled when teamId is null or non-numeric | VERIFIED | `src/lib/hooks/useSeasonReview.ts` line 45: `enabled: !!teamId && /^\d+$/.test(teamId)`. Line 17: `fetch('/api/season-review?teamId=${teamId}')`. Hook test file has 6 tests covering null, non-numeric, and success paths. |
| 6 | SeasonReviewTab renders Summary Card (REV-01), Grade Card (REV-02 with component scores), and Points Chart (REV-03) when teamId is provided and hooks succeed | VERIFIED | `src/components/season-review/SeasonReviewTab.tsx` confirms all three cards. REV-01: `<h2>Season Summary</h2>` with 6-stat dl grid (lines 242–283). REV-02: `<h2>Decision Quality</h2>` with grade badge, `data-testid="grade-component-scores"` dl, and methodology note (lines 287–343). REV-03: `<h2>Season Points</h2>` with ComposedChart (lines 345–404). 9 render tests pass. |
| 7 | page.tsx exposes a 'season' SubTab in Analyse between 'accuracy' and 'price-changes', renders SeasonReviewTab when active | VERIFIED | `src/app/page.tsx` line 57: `SubTab` union contains `'season'`. Lines 69–71: SECTIONS array has `{ id: 'season' as SubTab, label: 'Season', mobileLabel: 'Season' }` between `accuracy` and `price-changes`. Line 284: `{activeSection !== 'squad' && activeSubTab === 'season' && <SeasonReviewTab teamId={submittedId} />}`. Import at line 27. |
| 8 | Season variance chart shows GW-by-GW rank trajectory with xPts expectation overlay (ROADMAP SC3) | PASSED (override) | Override: User explicitly chose a GW points chart over a rank trajectory chart in 124-DISCUSSION-LOG.md ("Chart primary axis — Points (Recommended)" was the User's choice). CONTEXT.md D-01 documents this approved design decision. UI-SPEC §REV-03 approves the "Season Points" chart with avg manager overlay and chip markers. The implementation correctly delivers the approved design. |

**Score:** 7/8 truths verified (1 passed via approved override)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `src/lib/types.ts` | SeasonGwEntry and SeasonReview interfaces | VERIFIED | Lines 790–811 confirm both interfaces with all required fields. SeasonReview does NOT contain captainHits/captainGwsWithData per D-04. |
| `src/lib/season-review.ts` | computeDecisionGrade + GradeLabel type | VERIFIED | 49-line file exports both. D-06 renormalization constants `40 / 75` and `35 / 75` present at line 42. |
| `src/lib/season-review.test.ts` | 10 boundary tests | VERIFIED | 10 `it(` cases covering grade boundaries, D-06 chip=0 renorm, NaN guard, partial renorm, 3-component, GradeLabel type. |
| `src/app/api/season-review/route.ts` | GET handler with SSRF guard + parallel FPL fetches | VERIFIED | 151-line file exports GET, contains SSRF guard, Promise.all, average_entry_score, overall_rank, Cache-Control header. |
| `src/app/api/season-review/route.test.ts` | 8 route tests | VERIFIED | 8 `it(` cases per test count check. |
| `src/lib/hooks/useSeasonReview.ts` | TanStack Query v5 hook | VERIFIED | 50-line file. No onSuccess/onError/onSettled/placeholderData. staleTime 6h, retry 1, enabled guard present. |
| `src/lib/hooks/useSeasonReview.test.ts` | 6 hook contract tests | VERIFIED | `// @vitest-environment jsdom` on line 1. 6 `it(` cases. |
| `src/components/season-review/SeasonReviewTab.tsx` | Root client component >= 200 lines | VERIFIED | 407-line `'use client'` component. All three hooks unconditionally called at top. Grade useMemo gated on triple-isSuccess. Component scores useMemo. |
| `src/components/season-review/SeasonReviewTab.test.tsx` | 9 render tests | VERIFIED | `// @vitest-environment jsdom` line 1. 9 `it(` cases including component-scores test (test 8) and chip ROI null placeholder test (test 9). |
| `src/app/page.tsx` | SubTab union + SECTIONS + render condition | VERIFIED | Import at line 27, SubTab at line 57, SECTIONS entry at lines 69–71, render condition at line 284. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/api/season-review/route.ts` | `https://fantasy.premierleague.com/api/entry/{teamId}/history/` | fetch with FPL_UA header | VERIFIED | Route line 32: `fetch(\`${FPL_BASE}/entry/${teamId}/history/\`, { headers: { 'User-Agent': FPL_UA } })` |
| `src/app/api/season-review/route.ts` | `https://fantasy.premierleague.com/api/bootstrap-static/` | fetch with FPL_UA header | VERIFIED | Route line 46: `fetch(\`${FPL_BASE}/bootstrap-static/\`, { headers: { 'User-Agent': FPL_UA } })` |
| `src/app/api/season-review/route.ts` | `src/lib/types.ts` | `import type { SeasonReview, SeasonGwEntry }` | VERIFIED | Route line 13: `import type { SeasonReview, SeasonGwEntry } from '@/lib/types'` |
| `src/lib/hooks/useSeasonReview.ts` | `/api/season-review` | fetch with teamId query param | VERIFIED | Hook line 17: `` fetch(`/api/season-review?teamId=${teamId}`) `` |
| `src/lib/hooks/useSeasonReview.ts` | `src/lib/types.ts` | `import type { SeasonReview }` | VERIFIED | Hook line 14: `import type { SeasonReview } from '../types'` |
| `src/components/season-review/SeasonReviewTab.tsx` | `src/lib/hooks/useSeasonReview.ts` | `import { useSeasonReview }` | VERIFIED | Component line 23: `import { useSeasonReview } from '@/lib/hooks/useSeasonReview'` |
| `src/components/season-review/SeasonReviewTab.tsx` | `src/lib/hooks/useSeasonAnalytics.ts` | `import { useSeasonAnalytics }` | VERIFIED | Component line 24: `import { useSeasonAnalytics } from '@/lib/hooks/useSeasonAnalytics'` |
| `src/components/season-review/SeasonReviewTab.tsx` | `src/lib/hooks/useDecisionHistory.ts` | `import { useDecisionHistory }` | VERIFIED | Component line 25: `import { useDecisionHistory } from '@/lib/hooks/useDecisionHistory'` |
| `src/components/season-review/SeasonReviewTab.tsx` | `src/lib/regret.ts` | `import { computeSeasonSummary }` | VERIFIED | Component line 26: `import { computeSeasonSummary } from '@/lib/regret'` |
| `src/components/season-review/SeasonReviewTab.tsx` | `src/lib/season-review.ts` | `import { computeDecisionGrade }` | VERIFIED | Component line 27: `import { computeDecisionGrade, type GradeLabel } from '@/lib/season-review'` |
| `src/app/page.tsx` | `src/components/season-review/SeasonReviewTab.tsx` | `<SeasonReviewTab teamId={submittedId} />` | VERIFIED | page.tsx line 27 (import) + line 284 (render condition with teamId prop) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `SeasonReviewTab.tsx` | `reviewQuery.data` | `useSeasonReview(teamId)` → `GET /api/season-review` → FPL `/entry/{id}/history/` | Yes — route fetches live FPL API, maps to SeasonGwEntry[], returns SeasonReview JSON | FLOWING |
| `SeasonReviewTab.tsx` | `analyticsQuery.data` | `useSeasonAnalytics(teamId)` (existing hook, pre-phase 124) | Yes — existing route fetching FPL history for chip/hit analytics | FLOWING |
| `SeasonReviewTab.tsx` | `historyQuery.data` | `useDecisionHistory(teamId)` (existing hook) | Yes — existing route fetching decision history snapshots | FLOWING |
| `SeasonReviewTab.tsx` | `grade` (useMemo) | `computeDecisionGrade(captainHitRate, hitBERate, chipROIRate, chipCount)` | Yes — computed from live data after all three hooks succeed | FLOWING |
| `SeasonReviewTab.tsx` | `componentScores` (useMemo) | Derived from all three hooks' `.data` | Yes — null while loading, populated values once resolved | FLOWING |
| `src/app/api/season-review/route.ts` | `gwData` | `fetchHistory(teamId)` + `fetchBootstrapEvents()` via `Promise.all` | Yes — parallel FPL upstream fetches; bootstrap failure folds to avgManagerScore=0 (non-fatal) | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — server requires FPL upstream access; route cannot be probed without a running server and live FPL API. Manual verification items cover the equivalent checks.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| REV-01 | 124-01, 124-03 | Season summary card: total rank, total points, captain hit rate %, transfer net, best GW, worst GW | SATISFIED | Route handler returns SeasonReview with all fields. Component renders all 6 stats. Test 6 in SeasonReviewTab.test.tsx asserts formatted values. |
| REV-02 | 124-01, 124-03 | Decision quality A–D grade: captain EV (40%) + hit BE (35%) + chip ROI (25%); methodology note | SATISFIED | computeDecisionGrade with D-05/D-06 logic. Grade card shows badge, component scores (data-testid="grade-component-scores"), methodology note. Tests 4/5/7/8/9 cover grade states. |
| REV-03 | 124-02, 124-03 | Season variance chart: GW-by-GW trajectory with overlay, chip GW markers | SATISFIED (with override) | ComposedChart with two Line series (points + avgManagerScore), ChipDot custom dot renderer. User-approved change from rank-trajectory to points chart. |
| REV-04 | 124-03 | Season Review as "Season" sub-tab in Analyse, desktop + MobileNav | SATISFIED | page.tsx SECTIONS entry between accuracy and price-changes. SubTab union extended. Render condition wired. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `SeasonReviewTab.tsx` | 76 | `return null` in SeasonChartTooltip | Info | Correct use — recharts tooltip returns null when not active. Not a stub. |
| `SeasonReviewTab.tsx` | 122, 124 | `return null` in grade useMemo | Info | Correct use — null means grade not yet computed (loading state). Renders `—` in badge. Not a stub. |

No blockers. No FIXME/TODO/placeholder comments found in any of the four implementation files.

---

### Human Verification Required

#### 1. Season sub-tab position in Analyse nav

**Test:** Open the app in a browser and navigate to the Analyse section. Count the sub-tabs from left to right.
**Expected:** Season appears 7th, after Accuracy and before Price Changes. Sub-tab renders on both desktop and MobileNav (bottom). Clicking Season with no team ID entered shows "Enter your FPL Team ID to see your Season Review".
**Why human:** Nav rendering and touch targets cannot be verified in jsdom.

#### 2. Chart chip markers (amber dots)

**Test:** Load the Season Review for a team ID that has played chips (e.g., used Bench Boost in GW29). Inspect the chart.
**Expected:** GWs where a chip was played show a larger amber dot (r=6, fill=#f59e0b). Non-chip GWs show small currentColor dots (r=3).
**Why human:** ChipDot is a custom recharts dot renderer; recharts is mocked in unit tests. Visual rendering requires a browser.

#### 3. Grade resolves from — to A/B/C/D with live data

**Test:** Enter a valid team ID with a complete season of data. Wait for all three hooks to load.
**Expected:** Grade badge initially shows `—`, then transitions to a letter grade (A–D) once reviewQuery + analyticsQuery + historyQuery all succeed.
**Why human:** The triple-isSuccess gate depends on real hook behavior with live FPL API responses.

#### 4. N/A handling for pre-deployment GWs (ROADMAP SC1 nuance)

**Test:** Check whether GWs before the app was deployed appear in the Season Review. Use a team that existed before the app launch.
**Expected:** GWs before app deployment do not appear as zero-value rows — the route returns only GWs present in FPL history.current[], so pre-deployment GWs simply don't appear in gwData. The ROADMAP SC1 said "shown as N/A rather than zero" which implies a distinct row; the implementation omits those rows entirely.
**Why human:** This is a behavioral distinction that requires a test account with known deployment-relative history to verify. The implementation is functionally correct (no false zeros) but differs from the ROADMAP text.

---

## Override Suggestion for SC3

The ROADMAP Success Criterion 3 reads "A season variance chart shows GW-by-GW rank trajectory with an xPts expectation overlay." The implementation delivers a GW-by-GW **points** chart with **average manager score** overlay. This deviation was explicitly user-approved in 124-DISCUSSION-LOG.md before implementation began.

To formally accept this deviation, add to this file's frontmatter `overrides:` section with the owner's details:

```yaml
overrides:
  - must_have: "A season variance chart shows GW-by-GW rank trajectory with an xPts expectation overlay; chip GWs are highlighted with a distinct marker"
    reason: "User chose points chart over rank trajectory in discussion (124-DISCUSSION-LOG.md). CONTEXT.md D-01 documents this as the approved design decision. The chart delivers the same goal (season-at-a-glance view with chip markers) using the user-approved axes."
    accepted_by: "jamie"
    accepted_at: "<ISO timestamp>"
```

---

## Gaps Summary

No blocking gaps were found. All four REV-* requirements are wired end-to-end with real data flows. Tests are substantive (10 + 8 + 6 + 9 = 33 tests across all four new test files).

The `human_needed` status is set because:
1. Visual rendering of chart chip markers cannot be verified without a browser.
2. The grade badge transition from `—` to a letter requires live FPL data to confirm.
3. The ROADMAP SC1 "N/A rather than zero" nuance for pre-deployment GWs needs behavioral confirmation.
4. The SC3 chart deviation override needs owner signature.

---

_Verified: 2026-05-19_
_Verifier: Claude (gsd-verifier)_
