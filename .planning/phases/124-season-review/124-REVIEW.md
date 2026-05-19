---
phase: 124-season-review
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/lib/types.ts
  - src/lib/season-review.ts
  - src/lib/season-review.test.ts
  - src/app/api/season-review/route.ts
  - src/app/api/season-review/route.test.ts
  - src/lib/hooks/useSeasonReview.ts
  - src/lib/hooks/useSeasonReview.test.ts
  - src/components/season-review/SeasonReviewTab.tsx
  - src/components/season-review/SeasonReviewTab.test.tsx
  - src/app/page.tsx
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 124: Code Review Report

**Reviewed:** 2026-05-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 124 introduces the Season Review tab: a new API route (`/api/season-review`), a TanStack Query v5 hook (`useSeasonReview`), a pure `computeDecisionGrade` function, and the `SeasonReviewTab` component. The API route and pure library function are well-implemented with correct SSRF guards, NaN protection, and empty-state handling.

Two critical defects exist in `SeasonReviewTab.tsx`. First, a runtime crash when `teamId` is non-numeric and non-null (e.g. `"abc"`) — the non-null assertion `reviewQuery.data!` is reached with `data=undefined`, causing an immediate property-access crash. Second, a grade miscalculation when the user played a wildcard chip: `chipCount` is sourced from `gwData` (which includes wildcard GWs), but `chipRoi` from `useSeasonAnalytics` explicitly excludes wildcards per D-04, causing the grade formula to treat the wildcard as an ROI-positive chip component when computing the weighted score, silently inflating or deflating the result.

---

## Critical Issues

### CR-01: Runtime crash when `teamId` is non-numeric and non-null

**File:** `src/components/season-review/SeasonReviewTab.tsx:235`

**Issue:** The render guard at line 222 (`if (!teamId)`) only catches `null`, empty string, and other falsy values. It does NOT catch a non-numeric but truthy string such as `"abc"`. When `teamId="abc"`, the three hooks are idle (`enabled: false` due to the `/^\d+$/` regex gate), so `reviewQuery.isLoading=false`, `reviewQuery.isError=false`, and `reviewQuery.data=undefined`. All three early-return guards pass without firing, and execution reaches line 235:

```ts
const reviewData = reviewQuery.data!  // data is undefined — crash
const transferNet = formatTransferNet(reviewData.transferNetPoints)  // TypeError
```

This is a real crash path reachable when a user submits a non-numeric team ID in `page.tsx`, which passes the raw `submittedId` (a `string | null`) to `SeasonReviewTab` without prior numeric validation.

**Fix:** Add an `isSuccess` guard before the main render, so `data` is only accessed when TanStack Query has confirmed a successful fetch:

```ts
// After the !teamId check (line 222), add:
if (!reviewQuery.isSuccess) {
  // Queries enabled but not yet resolved — should not normally reach here,
  // but guards against idle queries for non-numeric teamId that slipped past !teamId.
  return null
}
const reviewData = reviewQuery.data  // guaranteed defined by isSuccess
```

Alternatively, validate `teamId` with the same regex used in the hooks before rendering the main body:

```ts
if (!teamId || !/^\d+$/.test(teamId)) {
  // show the "enter your FPL Team ID" empty state
}
```

---

### CR-02: `chipCount` includes wildcard GWs; `chipRoi` excludes wildcards — grade formula silently misfires

**File:** `src/components/season-review/SeasonReviewTab.tsx:127`

**Issue:** `chipCount` is computed by filtering `reviewQuery.data.gwData` for any GW where `chipPlayed !== null`:

```ts
const chipCount = reviewQuery.data.gwData.filter(g => g.chipPlayed !== null).length
```

The `gwData` array is sourced from `route.ts`, which maps chip slugs from `history.chips[]` verbatim — including `'wildcard'`.

However, `chipRoi` from `useSeasonAnalytics` explicitly filters wildcards out (`ALLOWED_CHIPS = ['bboost', '3xc', 'freehit']`). So if a user played a wildcard and no other chips:

- `chipCount = 1` (wildcard counted)
- `chipRoi.length = 0` (wildcard excluded)
- `chipROIPositiveRate = 0` (zero-length fallback in grade memo)
- `computeDecisionGrade` is called with `chipCount=1`, so it uses the **three-component** formula including `chipROIPositiveRate × 0.25`

This means a user who played only a wildcard (an optimal chip-saving strategy from an ROI perspective) is penalised with a zero chip ROI score that weighs 25% of the grade, rather than triggering the D-06 renormalisation path (which only fires when `chipCount === 0`). The grade is incorrect.

The same mismatch exists in `componentScores` at lines 165–169, but there `chipRoi.length === 0` causes `chipROIPositiveRate` to be `null` (displayed as `—`), while `grade` uses a raw `0` — so the display is misleading too: the grade card shows `—` for Chip ROI but the grade itself quietly applies `0`.

**Fix:** Align the `chipCount` signal with the source that actually feeds `chipROIPositiveRate`. Either:

Option A — derive `chipCount` from `chipRoi` (cleanest):
```ts
const chipCount = analyticsQuery.data.chipRoi.length  // already excludes wildcard per D-04
```

Option B — filter wildcards from `gwData` to match the analytics exclusion:
```ts
const COUNTED_CHIPS = new Set(['bboost', '3xc', 'freehit'])
const chipCount = reviewQuery.data.gwData.filter(
  g => g.chipPlayed !== null && COUNTED_CHIPS.has(g.chipPlayed)
).length
```

Apply the same fix to `componentScores` (line 171) for consistency.

---

## Warnings

### WR-01: `!isLoading` in error branch is dead code — masks future ordering bugs

**File:** `src/components/season-review/SeasonReviewTab.tsx:207`

**Issue:** The error branch condition is `if (isError && !isLoading)`. Because the loading branch at line 187 already returns unconditionally, `isLoading` is always `false` at line 207. The `!isLoading` guard is dead code. While harmless today, it creates a misleading read — future developers might infer that there's a meaningful case where `isError && isLoading` could simultaneously be true and would be handled differently.

**Fix:** Remove the redundant guard:
```ts
if (isError) {
  return ( ... )
}
```

---

### WR-02: Missing `Cache-Control` header on the empty-current payload branch

**File:** `src/app/api/season-review/route.ts:99`

**Issue:** When `current.length === 0`, the route returns a zero/empty `SeasonReview` payload at line 99–103 without a `Cache-Control` header. The non-empty path at line 146–149 correctly sets `Cache-Control: public, s-maxage=1800, stale-while-revalidate=86400`. An empty season (e.g. a brand-new team in GW1) would get no caching, causing repeated FPL API calls on every tab render.

**Fix:**
```ts
return Response.json(empty, {
  status: 200,
  headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' },
})
```

---

### WR-03: `ChipDot` typed as `any` — bypasses prop-shape safety

**File:** `src/components/season-review/SeasonReviewTab.tsx:67`

**Issue:** `ChipDot` accepts `props: any` with an explicit `eslint-disable` comment for `@typescript-eslint/no-explicit-any`. The `any` typing means that if recharts changes the shape of the dot render prop (cx, cy, payload), the error manifests at runtime as `undefined` reads rather than a type error at compile time.

**Fix:** Use the known recharts dot prop shape:
```ts
interface DotProps { cx: number; cy: number; payload: SeasonGwEntry }
function ChipDot({ cx, cy, payload }: DotProps): React.ReactElement {
  if (!payload?.chipPlayed) {
    return <circle cx={cx} cy={cy} r={3} fill="currentColor" stroke="none" />
  }
  return <circle cx={cx} cy={cy} r={6} fill="#f59e0b" stroke="none" />
}
```
Remove the eslint-disable comment.

---

## Info

### IN-01: Locale-dependent test assertion for `toLocaleString()` output

**File:** `src/components/season-review/SeasonReviewTab.test.tsx:284`

**Issue:** The test asserts `screen.getByText('500,000')` which depends on `(500000).toLocaleString()` returning `'500,000'`. In CI environments configured with a locale that uses a period as the thousands separator (e.g. `de-DE`), this assertion would fail with `'500.000'`. The test environment is jsdom, whose locale behaviour varies by Node version and OS.

**Fix:** Use a locale-neutral assertion or explicitly format with a fixed locale:
```ts
// Option A: match the rendered number regardless of separator
expect(screen.getByText(/500[,.]000/)).toBeTruthy()

// Option B: mock toLocaleString in this test or use a test locale configuration
```

---

### IN-02: `queryFn` `!teamId` throw is dead code given `enabled` guard

**File:** `src/lib/hooks/useSeasonReview.ts:41`

**Issue:** Inside `queryFn`, the code throws `new Error('teamId is required')` when `!teamId`. However, `enabled: !!teamId && /^\d+$/.test(teamId)` means TanStack Query will never invoke `queryFn` when `teamId` is null or falsy — making the throw unreachable during normal operation. This is the same pattern used in `useSeasonAnalytics.ts` (line 42), suggesting it's a copy-paste convention, but it produces dead defensive code.

This is low risk — the pattern is a consistent project convention and causes no incorrect behaviour. No fix required, but the throw could be removed for clarity or replaced with a TypeScript assertion.

---

_Reviewed: 2026-05-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
