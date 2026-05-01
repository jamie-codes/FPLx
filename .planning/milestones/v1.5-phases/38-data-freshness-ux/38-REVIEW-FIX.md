---
phase: 38-data-freshness-ux
fixed_at: 2026-04-29T00:00:00Z
review_path: .planning/phases/38-data-freshness-ux/38-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 38: Code Review Fix Report

**Fixed at:** 2026-04-29T00:00:00Z
**Source review:** .planning/phases/38-data-freshness-ux/38-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: `LastUpdated` renders an empty `<p>` on first paint when data is already cached

**Files modified:** `src/components/LastUpdated.tsx`
**Commit:** c94e6d8
**Applied fix:** Changed `useState<string>('')` to use a lazy initializer `() => (data?.last_updated ? formatRelativeTime(data.last_updated) : '')`. This computes the formatted label on the first render when React Query has cached data, eliminating the blank `<p>` flash before the `useEffect` fires.

---

### WR-02: `formatRelativeTime` silently produces `"NaN day ago"` for invalid input

**Files modified:** `src/lib/formatRelativeTime.ts`
**Commit:** 3dbceb9
**Applied fix:** Extracted `new Date(isoTimestamp).getTime()` into a `ts` variable and added `if (isNaN(ts)) return 'unknown'` before any arithmetic. This guard short-circuits on malformed input, preventing `NaN` from propagating through diffMs/diffMins/diffHours/diffDays calculations.

---

### WR-03: `LastUpdated` connected-component tests do not cover the first-paint blank-state scenario

**Files modified:** `src/components/LastUpdated.test.tsx`
**Commit:** 73c2fc3
**Applied fix:** Added a new test `'does not render a blank label on first paint when data is cached'` in the `describe('LastUpdated (connected)')` block. The test renders with cached data and asserts that if a `<p>` element is present, its `textContent` is not an empty string — directly exercising the WR-01 invariant.

---

_Fixed: 2026-04-29T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
