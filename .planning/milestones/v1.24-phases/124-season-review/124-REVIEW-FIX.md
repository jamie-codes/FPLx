---
phase: 124-season-review
fixed_at: 2026-05-19T09:14:00Z
review_path: .planning/phases/124-season-review/124-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 124: Code Review Fix Report

**Fixed at:** 2026-05-19T09:14:00Z
**Source review:** .planning/phases/124-season-review/124-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, CR-02, WR-01, WR-02, WR-03)
- Fixed: 4
- Skipped: 1

## Fixed Issues

### WR-01: Dead `!isLoading` guard in error branch

**Files modified:** `src/components/season-review/SeasonReviewTab.tsx`
**Commit:** 686029a
**Applied fix:** Simplified `if (isError && !isLoading)` to `if (isError)` — the `!isLoading` condition was dead code since the loading branch unconditionally returns before line 207.

---

### WR-03: `ChipDot` typed as `any` — bypasses prop-shape safety

**Files modified:** `src/components/season-review/SeasonReviewTab.tsx`
**Commit:** b3acc9f
**Applied fix:** Replaced `props: any` (with `eslint-disable` comment) with a typed `interface DotProps { cx: number; cy: number; payload: SeasonGwEntry }`. Changed the function signature from destructuring via cast to directly destructuring `{ cx, cy, payload }`. Removed the `eslint-disable-next-line @typescript-eslint/no-explicit-any` comment.

---

### CR-01: Runtime crash when `teamId` is non-numeric and non-null

**Files modified:** `src/components/season-review/SeasonReviewTab.tsx`
**Commit:** b1815bc
**Applied fix:** Two-part fix:
1. Extended the empty-state guard from `if (!teamId)` to `if (!teamId || !/^\d+$/.test(teamId))` so non-numeric strings (e.g. `"abc"`) return the empty-state UI instead of falling through to the main render.
2. Added `if (!reviewQuery.isSuccess) { return null }` before accessing `reviewQuery.data`, which allows TypeScript to narrow the type to `SeasonReview` (removing the need for the `!` non-null assertion). The `!` assertion was removed from `reviewQuery.data!`.

---

### CR-02: `chipCount` includes wildcard GWs; `chipRoi` excludes wildcards

**Files modified:** `src/components/season-review/SeasonReviewTab.tsx`
**Commit:** 50662a7
**Applied fix (Option A):** In both the `grade` useMemo and the `componentScores` useMemo, changed `chipCount` from `reviewQuery.data.gwData.filter(g => g.chipPlayed !== null).length` to `chipRoi.length`. This aligns both variables on the same source (`analyticsQuery.data.chipRoi`), which already excludes wildcards per D-04/ALLOWED_CHIPS in `useSeasonAnalytics`. Also removed `reviewQuery.isSuccess` and `reviewQuery.data` from the `componentScores` deps array since `chipCount` no longer reads from `reviewQuery`.

Note: This fix is classified as **fixed: requires human verification** because the logic change (wildcard exclusion from chipCount) is a semantic correction — both memos now correctly agree that a wildcard-only season has `chipCount=0` and triggers D-06 renormalisation.

---

## Skipped Issues

### WR-02: Missing `Cache-Control` header on empty-current payload branch

**File:** `src/app/api/season-review/route.ts:99`
**Reason:** Code context differs from review — fix already applied. At the time of fixing, `route.ts` line 99–102 already included `headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' }` on the empty-branch `Response.json` call. The finding was accurate at review time but was resolved before or during code submission.

---

_Fixed: 2026-05-19T09:14:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
