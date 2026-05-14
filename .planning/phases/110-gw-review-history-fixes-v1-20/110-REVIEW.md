---
phase: 110-gw-review-history-fixes-v1-20
reviewed: 2026-05-14T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/components/squad/GwReviewTab.tsx
  - src/components/squad/GwReviewTab.test.tsx
  - src/app/api/gw-review/route.ts
  - src/app/api/gw-review/route.test.ts
  - src/app/api/decision-history/route.ts
  - src/app/api/decision-history/route.test.ts
findings:
  critical: 1
  warning: 3
  info: 0
  total: 4
status: issues_found
---

# Phase 110: Code Review Report

**Reviewed:** 2026-05-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 110 introduces three targeted fixes to the GW review and decision-history routes: FIX-03 (top scorer points from live endpoint), FIX-04 (best bench player points from live endpoint), FIX-05 (benchmark diff sign correction in the component), and FIX-06 (modelCeilingPts from element-summary in decision-history).

FIX-05 and FIX-06 are implemented correctly. The decision-history route's element-summary deduplication, SC-5 graceful degradation, and Promise.allSettled fan-out are all sound.

One critical defect remains: FIX-03 migrated top_scorer_pts to use liveMap but left the `captainDeltaRaw` formula using stale `pick.total_points` for both the optimal and user captain. The existing FIX-03 test does not catch this because the test fixture makes the user's captain and optimal captain the same element (so the delta is zero regardless of which point source is used). This produces a wrong `captain_delta` value whenever the user's captain differs from the optimal captain and `pick.total_points` diverges from liveMap — the exact scenario FIX-03 was introduced to handle.

Three warning-level issues are also present: a silent wrong-data fallback when no captain is found in starters, a misleading amber sentiment colour on an unavailable (null) delta, and inconsistent null-check style.

## Critical Issues

### CR-01: `captainDeltaRaw` uses stale `pick.total_points` instead of `liveMap`

**File:** `src/app/api/gw-review/route.ts:221-223`

**Issue:** FIX-03 correctly changed `top_scorer_pts` (line 255) and the selection of `topScorer`/`optimalCaptain` (lines 200-205) to use `liveMap`. However, the `captainDeltaRaw` formula on lines 221-223 was not updated and still reads `optimalCaptain.total_points` and `yourCaptain.total_points` directly from the FPL picks response — the same stale field FIX-03 identified as unreliable for settled GWs:

```typescript
// Current (broken):
const captainDeltaRaw =
  optimalCaptain.total_points * 2 - yourCaptain.total_points * yourCaptain.multiplier
```

When liveMap is populated and contains values different from `pick.total_points` (the core FIX-03 scenario), the captain delta is computed from stale data. Consider: user captain element 1 (`pick.total_points=5`, live=14) vs optimal captain element 2 (`pick.total_points=3`, live=20). The current formula yields `3*2 - 5*2 = -4`, clamped to 0 (wrong — no regret shown). The correct formula yields `20*2 - 14*2 = 12` (user missed 12 captain points).

The existing FIX-03 test in `route.test.ts` does not catch this bug because it constructs a fixture where the user's captain and the optimal captain are the same element (`element=1` is both `is_captain=true` and the highest in liveMap), so the delta is 0 under both the old and new formulas. A fixture where `yourCaptain !== optimalCaptain` with differing live vs pick.total_points values is needed.

**Fix:**
```typescript
// Use liveMap for both sides of the delta (consistent with top_scorer_pts at line 255).
// Fall back to pick.total_points only when liveMap is absent (SC-5 — live endpoint failed).
const optimalCaptainLivePts =
  liveMap.get(optimalCaptain.element) ?? optimalCaptain.total_points
const yourCaptainLivePts =
  liveMap.get(yourCaptain.element) ?? yourCaptain.total_points

const captainDeltaRaw =
  optimalCaptainLivePts * 2 - yourCaptainLivePts * yourCaptain.multiplier
const captainDelta = Math.max(0, captainDeltaRaw)
```

A companion test should be added that sets `yourCaptain` and `optimalCaptain` to different elements with diverging `pick.total_points` vs liveMap values, and asserts `captain_delta` equals the liveMap-based result.

## Warnings

### WR-01: Silent wrong-captain fallback when no starter has `is_captain=true`

**File:** `src/app/api/gw-review/route.ts:197`

**Issue:** When no starter has `is_captain: true`, the route silently falls back to `starters[0]` as the captain:

```typescript
const yourCaptain = starters.find((p) => p.is_captain) ?? starters[0]
```

This is a data integrity failure in the FPL picks response. Rather than surfacing an error (or at minimum logging a warning), the route proceeds to compute and return `captain_name`, `optimal_captain_name`, and `captain_delta` using an arbitrary starter. The values will be wrong and will look valid to the caller. The component will render a plausible-looking but incorrect captain row.

**Fix:** Return a 502 (same as the existing `starters.length === 0` guard) or log the anomaly and set `captain_name` to a sentinel value. At minimum, the fallback should be documented:

```typescript
const yourCaptain = starters.find((p) => p.is_captain)
if (!yourCaptain) {
  return Response.json(
    { error: 'FPL picks: no captain found in starting XI' },
    { status: 502 },
  )
}
```

### WR-02: Amber sentiment shown for unavailable (`null`) captain delta

**File:** `src/components/squad/GwReviewTab.tsx:161-163`

**Issue:** `GwReview.captain_delta` is typed as `number` (non-optional), but the component defensively converts it with `review.captain_delta ?? null` (line 153), acknowledging it could be absent at runtime. When `captainDelta` is `null`, `deltaIsOptimal` is `false` (because `null !== 0`), so `deltaClass` resolves to amber (`text-amber-700`). The StatCard then renders the `'—'` value in amber — the same colour used to indicate a bad captain choice — when the data is simply unavailable.

```typescript
// Lines 161-163:
const deltaClass = deltaIsOptimal
  ? 'text-green-600 dark:text-green-400'
  : 'text-amber-700 dark:text-amber-300'  // applies to null too
```

**Fix:** Add a separate branch for the null case:

```typescript
const deltaClass =
  captainDelta === null
    ? 'text-zinc-500 dark:text-zinc-400'    // neutral — data unavailable
    : deltaIsOptimal
      ? 'text-green-600 dark:text-green-400'
      : 'text-amber-700 dark:text-amber-300'
```

### WR-03: Loose equality (`==`) for null check inconsistent with rest of file

**File:** `src/components/squad/GwReviewTab.tsx:156`

**Issue:** Line 156 uses `==` (loose equality) for a null check while the rest of the file uses `===`:

```typescript
const deltaValue = captainDelta == null   // line 156 — loose equality
  ? '—'
  : deltaIsOptimal
    ? '0'
    : `+${captainDelta}pts missed`
```

`captainDelta` is typed as `number | null` (never `undefined`), so `== null` and `=== null` behave identically here. However, the inconsistency with `=== 0` on line 154 and the project-wide `===` convention is a code quality issue that linters will flag.

**Fix:**
```typescript
const deltaValue = captainDelta === null
  ? '—'
  : deltaIsOptimal
    ? '0'
    : `+${captainDelta}pts missed`
```

---

_Reviewed: 2026-05-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
