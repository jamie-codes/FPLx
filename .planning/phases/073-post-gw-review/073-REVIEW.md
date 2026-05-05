---
phase: 073-post-gw-review
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - pipeline/run.py
  - src/app/api/gw-review/route.ts
  - src/app/page.tsx
  - src/lib/hooks/useGwReview.ts
  - src/lib/types.ts
  - src/components/squad/GwReviewTab.tsx
  - src/components/squad/GwReviewTab.test.tsx
  - src/components/nav/MobileNav.test.tsx
  - src/app/page.test.tsx
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 073: Code Review Report

**Reviewed:** 2026-05-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase adds the Post-GW Review feature: a pipeline step that writes per-GW global files, an API route that merges those files with on-demand FPL picks data, a TanStack Query hook, and a tab component. The implementation is generally well-structured, but contains three correctness bugs — one of which silently produces wrong data for Triple Captain users — and several quality gaps that will bite in production.

---

## Critical Issues

### CR-01: Triple Captain captain-delta formula is wrong

**File:** `src/app/api/gw-review/route.ts:157`
**Issue:** The captain-delta formula is:

```
optimalCaptain.total_points * 2 - yourCaptain.total_points * yourCaptain.multiplier
```

`total_points` returned by the FPL picks endpoint **already includes the captaincy multiplier**. When the user plays Triple Captain (multiplier=3), `yourCaptain.total_points` is already tripled, so multiplying again by 3 double-counts the captaincy bonus and produces a grossly negative (then clamped to 0) or wrong delta.

The FPL API `entry/{id}/event/{gw}/picks/` returns `total_points` as the player's **base** fixture score without the captaincy multiplier applied. The multiplier is a separate field used by the FPL scoring engine, and the displayed GW score is the sum of `pick.total_points * pick.multiplier` across all picks. This is the source of the confusion cited in the Pitfall 3 comment.

Verify against the actual FPL API response contract. If `total_points` is already multiplied, the formula must not multiply again:

```typescript
// Correct form when total_points is the raw fixture score (NOT pre-multiplied):
const captainDeltaRaw =
  optimalCaptain.total_points * 2 - yourCaptain.total_points * yourCaptain.multiplier

// Correct form when total_points IS already the multiplied value (pre-multiplied):
const captainDeltaRaw =
  optimalCaptain.total_points * 2 - yourCaptain.total_points
```

The Pitfall 3 comment says "handles Triple Captain where multiplier=3" but this is exactly where the error lives. The comment asserts intent without verifying which convention the FPL API uses. This must be confirmed against a real FPL TC response before shipping, as it will silently produce 0 (clamped) for every TC user regardless of whether the choice was optimal.

---

### CR-02: `SETTLED_GWS_PLACEHOLDER` is hardcoded to GWs 33/34/35 — will be wrong for every future season and wrong today for many users

**File:** `src/app/page.tsx:42`
**Issue:** The constant `SETTLED_GWS_PLACEHOLDER: number[] = [33, 34, 35]` is passed as `settledGws` to `GwReviewTab`. The pipeline writes `gw_review_gw{N}.json` for the **actual** last 3 finished GWs determined at run time (sliding window). When the user loads the page after GW 36+ is settled, the tab will silently request GWs 33/34/35 — which may or may not have Blob files, depending on the retention policy — rather than the three most recent settled GWs.

More critically, at GW 1–32, GW 38, or GW 39 the hardcoded values may correspond to GWs that have never been played. The API route correctly returns 404 for missing files, and the tab renders an error message, but the user sees "Review data unavailable" rather than their actual latest GW scores. This is a data-correctness failure for the feature's core purpose.

The comment in `page.tsx` acknowledges this as deferred (Open Question 2) but classifies it as a future enhancement. It is not an enhancement — it is a prerequisite for the feature to return correct data past the current season. A minimal fix is to derive the list from `useBootstrap` events as the comment itself suggests:

```typescript
// Replace SETTLED_GWS_PLACEHOLDER with a hook or derived value:
const settledGws = bootstrap?.events
  .filter(e => e.finished)
  .map(e => e.id)
  .slice(-3) ?? []
```

---

### CR-03: `page.test.tsx` does not mock `GwReviewTab` — test suite will explode when the Squad "Review" sub-tab test path is exercised

**File:** `src/app/page.test.tsx:141-156`
**Issue:** Every other heavy component rendered by `page.tsx` is mocked at the top of `page.test.tsx` (TransferPanel, OptimiserPanel, LineupTab, DecisionSummaryTab, etc.). `GwReviewTab` is **not mocked**. The test at line 141 exercises the Squad section and verifies the sub-tab nav contains "Review", and the one at line 70 navigates to the Squad section. When those code paths cause React to render `GwReviewTab`, it will call `useGwReview`, which calls `useQuery` (TanStack Query). No `QueryClientProvider` is set up in the test file, causing a runtime crash ("No QueryClient set, use QueryClientProvider to set one") or a dangling fetch against a non-existent local server.

The suite appears to pass today only because the tests navigate to Squad/Decision, Squad/Transfers, Squad/Optimiser, or Squad/Lineup — none of which trigger the "review" sub-tab render path. The "Review" pill is **visible in the nav** (tested at line 155) but clicking it is never tested in `page.test.tsx`. However, this is a latent crash waiting to trigger if a future test clicks "Review" or if the test isolation order changes.

Fix: add a mock for `GwReviewTab` alongside the other squad tab mocks:

```typescript
vi.mock('@/components/squad/GwReviewTab', () => ({
  GwReviewTab: (_props: { teamId: string; settledGws: number[] }) => (
    <div data-testid="gw-review-tab" />
  ),
}))
```

---

## Warnings

### WR-01: `queryGw` can be `null` even when settled GWs exist, but the null guard is placed after the hook call

**File:** `src/components/squad/GwReviewTab.tsx:73-74`
**Issue:** `queryGw` is defined as:

```typescript
const queryGw = selectedGw ?? defaultGw
```

`defaultGw` is `null` when `settledGws` is empty. So `queryGw` is `null` when `settledGws.length === 0`. The hook is then called with `gw = null` at line 74:

```typescript
const { data, isLoading, isError, error } = useGwReview(submittedId, queryGw)
```

The hook's `enabled` guard prevents the fetch (`gw !== null` check at line 35 of `useGwReview.ts`), so there is no network error. However, the component also has a no-settled-GWs guard at line 89 that is checked **after** the hook call — this is correct for React's rules of hooks. The problem is that `queryGw` being `null` while `submittedId` is non-null causes `useGwReview` to be called with a `null` gw even when settled GWs exist but `selectedGw` has not yet been set by a pill click. The `defaultGw` fallback on line 73 makes this safe in practice, but the logic is fragile: `queryGw` can only ever be `null` when `defaultGw` is `null`, i.e., when `settledGws.length === 0`. The guard at line 89 (`queryGw === null`) is therefore redundant with `settledGws.length === 0` and adds dead-code complexity. This is not a bug in the current implementation but would become one if `defaultGw` is ever changed to not mirror `settledGws.length`.

---

### WR-02: Blob pathname check is fragile — prefix-match collision risk

**File:** `src/app/api/gw-review/route.ts:64-65`
**Issue:** The Blob list call uses `prefix: filename` with `limit: 1`, then checks `blobs[0].pathname !== filename`. The `@vercel/blob` `list` API matches by prefix, so `gw_review_gw3.json` would match a `list({ prefix: 'gw_review_gw3.json' })` call exactly, but `gw_review_gw30.json` would also be returned if it sorts before `gw_review_gw3.json` and the Blob store returns results in lexicographic order. For GW values >= 10 this is safe (two-digit prefix is specific enough). For single-digit GWs (GW 1–9), `gw_review_gw1.json` is a prefix of `gw_review_gw10.json`, `gw_review_gw11.json`, etc. Because `limit: 1` is used and the pathname equality check (`blobs[0].pathname !== filename`) catches any mismatch, this is only a latency issue (extra Blob list call returning a non-matching blob) rather than returning wrong data. However, the pathname check at line 65 is the only thing preventing a wrong-file read in this scenario, and it deserves an explicit comment. The existing comment references path-traversal mitigation but not this Blob prefix-collision case.

---

### WR-03: `import time as _time` is deferred inside a loop body

**File:** `pipeline/run.py:150`
**Issue:** `import time as _time` is placed inside the `for element in bootstrap['elements']:` loop. Python caches module imports, so this does not re-import on every iteration, but it is an unusual and misleading pattern. If a future maintainer does not know about Python's import caching, they may introduce a slow path thinking this is safe to move or that the alias creates a new object each time. The import should be at the top of the file alongside the other standard-library imports.

**Fix:**
```python
# At top of file, with other stdlib imports:
import time
# Then in the loop:
time.sleep(0.1)
```

---

### WR-04: `yourCaptain` falls back to `starters[0]` when no captain flag is set — silently wrong

**File:** `src/app/api/gw-review/route.ts:144`
**Issue:**

```typescript
const yourCaptain = starters.find((p) => p.is_captain) ?? starters[0]
```

If the FPL API returns picks without any `is_captain === true` entry (possible if the GW data is partially settled or there is an upstream API anomaly), the code silently falls back to `starters[0]` (the goalkeeper). This produces a wrong `captain_name` and an incorrect `captainDelta` calculation without any error surfacing to the caller. The same stale-data scenario could also occur if the picks endpoint is called before the GW is fully processed by FPL.

A safer approach is to return a 502 error when no captain is found:

```typescript
const yourCaptain = starters.find((p) => p.is_captain)
if (!yourCaptain) {
  return Response.json({ error: 'No captain found in picks' }, { status: 502 })
}
```

---

## Info

### IN-01: `deltaValue` format includes "pts missed" in the stat card value string — separates amount from units inconsistently

**File:** `src/components/squad/GwReviewTab.tsx:147`
**Issue:** The `value` prop of `StatCard` is `'+${review.captain_delta}pts missed'` — a string that embeds both a numeric value and explanatory copy. All other `StatCard` calls pass plain numeric strings (`String(review.your_score)`, `'0'`). This inconsistency makes the component harder to restyle and mixes presentation copy into data formatting logic.

**Suggestion:** Pass just the numeric value as `value` and use the `label` to convey "pts missed":

```tsx
<StatCard
  label={deltaIsOptimal ? 'Captain choice' : 'Pts missed (captain)'}
  value={deltaIsOptimal ? 'Optimal' : `+${review.captain_delta}`}
  sentimentClass={deltaClass}
/>
```

---

### IN-02: `console.error` in `DecisionErrorBoundary.componentDidCatch` is the only logging call — acceptable but worth noting

**File:** `src/app/page.tsx:50`
**Issue:** `console.error('[DecisionSummaryTab crash]', error, info)` is intentional error-boundary logging, not a debug artifact. No action required, but if a structured error-reporting service (Sentry, etc.) is adopted in future, this is the hook point.

---

### IN-03: `MobileNav.test.tsx` — NAV-02 test asserts only 4 Analyse pills but the Analyse section has 7 sub-tabs

**File:** `src/components/nav/MobileNav.test.tsx:40-48`
**Issue:** The test at line 40 filters for pills with text matching `['Gems', 'Insights', 'DefCon', 'SP']` and asserts `pillButtons.length === 4`. The Analyse section actually has 7 sub-tabs (Gems, Insights, DefCon, Set Pieces, Accuracy, Price Changes, Heat Map), so only 4 of 7 pills are verified. The test passes because the remaining pills ('Acc', 'Prices', 'Heat Map') are simply not included in the filter list. This does not affect the passing of the test but means the test silently ignores pills that could be misrendered or duplicated. The test should either assert all 7 pills or explicitly acknowledge it is a partial check.

---

_Reviewed: 2026-05-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
