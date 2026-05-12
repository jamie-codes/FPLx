---
phase: 100-decision-history-analytics
reviewed: 2026-05-12T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/app/api/season-analytics/route.test.ts
  - src/app/api/season-analytics/route.ts
  - src/components/accuracy/BackTab.test.tsx
  - src/components/accuracy/BackTab.tsx
  - src/lib/hooks/useSeasonAnalytics.test.ts
  - src/lib/hooks/useSeasonAnalytics.ts
  - src/lib/regret.test.ts
  - src/lib/regret.ts
  - src/lib/types.ts
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 100: Code Review Report

**Reviewed:** 2026-05-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase adds chip ROI and hit break-even analytics (`/api/season-analytics`, `useSeasonAnalytics`, updates to `BackTab`, new types, and an augmented `regret.ts`). The API route architecture is sound — parallel fetches, partial-failure folding, numeric guards on element IDs, and the empty-current early-exit all work correctly. The main logic bug is a semantic mismatch in the break-even calculation: the hit cost is always deducted as 4 pts regardless of how many transfers were taken in the same GW, which produces wrong `netPts`/`brokeEven` values for multi-hit gameweeks. There are also two floating-point accumulation issues — one in the season summary and one in the regret library — and a minor missing-data state in the `BackTab` render path.

---

## Critical Issues

### CR-01: Multi-hit GW break-even applies wrong cost per transfer (route.ts line 193)

**File:** `src/app/api/season-analytics/route.ts:193`

**Issue:** When a player takes two (or more) transfers in the same GW and incurs a double hit (`event_transfers_cost = 8`), the route emits one `HitTrackingEntry` per transfer pair. Each row deducts exactly 4 pts (`elementInPts - elementOutPts - 4`), effectively charging 4 pts per row. A double hit actually costs 8 pts total. The per-transfer cost should be the total `event_transfers_cost` from `history.current` divided by 4, or more simply `event_transfers_cost / hitCount` for that GW.

For a concrete example: two transfers in GW5 with `event_transfers_cost = 8`. Both rows currently compute `netPts = inPts - outPts - 4`. The two rows together imply an 8-pt deduction in aggregate, but each row's `brokeEven` is evaluated as `netPts > 0` where only 4 pts was charged, so both transfers look cheaper than they were. A user who brought in two players each contributing 3 pts more than the player sold would see `netPts = +2, brokeEven = true` on both rows — but the pair as a whole lost points (6 extra pts gained vs 8 pts cost).

**Fix:** Compute the per-transfer hit cost from the GW cost record and pass it through:

```typescript
// Build per-GW cost map (event_transfers_cost is the total for that GW)
const gwCostMap = new Map<number, number>(
  current
    .filter((c) => c.event_transfers_cost > 0)
    .map((c) => [c.event, c.event_transfers_cost]),
)

// In the hitTransfers.map(), derive cost per transfer:
const gwHitTransfers = hitTransfers.filter((t) => t.event === gw)
const transferCount = gwHitTransfers.length
const totalCost = gwCostMap.get(t.event) ?? 4
const costPerTransfer = transferCount > 0 ? totalCost / transferCount : 4

const netPts =
  elementInPts === null || elementOutPts === null
    ? null
    : elementInPts - elementOutPts - costPerTransfer
```

Alternatively, expose the full GW cost on each row so the UI can display aggregate cost accurately. Either way, `- 4` hardcoded at line 193 is wrong for double/triple hits.

---

## Warnings

### WR-01: `computeSeasonSummary` accumulates floating-point `regret` values without rounding (regret.ts line 59)

**File:** `src/lib/regret.ts:59`

**Issue:** `computeRegret` rounds each individual regret value to 1 d.p. to eliminate float noise (see the comment at line 31). However, `computeSeasonSummary` accumulates those values by direct addition (`totalRegret += e.regret`) without rounding the running total. Over a 38-GW season the accumulated float errors can surface in the UI. For example, `4.0 + 4.0 + ... (20 times) = 79.99999999999999` instead of `80` is a realistic outcome for simple values once the sum grows large. The `SeasonSummaryHeader` in `BackTab.tsx` renders `totalRegret` directly in the heading string, so users would see `+79.999999999pts`.

**Fix:** Round `totalRegret` before returning it:

```typescript
return {
  totalRegret: Math.round(totalRegret * 10) / 10,
  gwsWithData,
  modelBetter,
  userWon,
  tied,
  captainHitRate,
  captainHits,
}
```

---

### WR-02: `seasonAvgPoints` rendered as `Math.round(avgInt)` — hides loss of precision for display parity with delta (BackTab.tsx line 208)

**File:** `src/components/accuracy/BackTab.tsx:208`

**Issue:** The chip ROI list item formats the season average as `const avgInt = Math.round(c.seasonAvgPoints)` and then renders `{avgInt}pt avg`. The delta is separately formatted by `formatSignedPts(Math.round(c.delta))`. Because `seasonAvgPoints` and `delta` are independently rounded, the displayed figures can fail the arithmetic identity that a user would expect: `gwPoints - avgInt` does not necessarily equal the displayed delta.

Example: `gwPoints = 48`, `seasonAvgPoints = 47.5`. `avgInt = 48` (rounds up), `Math.round(delta) = Math.round(0.5) = 1`. The UI renders `"48pts vs 48pt avg → +1pts"` which looks inconsistent (same number, yet a positive delta).

A less confusing approach rounds `seasonAvgPoints` only for display and derives the rendered delta from the rounded values consistently, or presents one decimal place for the average.

**Fix:**

```typescript
const avgRounded = Math.round(c.seasonAvgPoints)
const deltaRounded = c.gwPoints - avgRounded  // derive delta from same rounded avg
return (
  <li ...>
    <span ...>{displayName} GW{c.event}</span>
    <span ...>
      {c.gwPoints}pts vs {avgRounded}pt avg → {formatSignedPts(deltaRounded)}
    </span>
  </li>
)
```

This ensures the three numbers are arithmetically consistent in the rendered text.

---

### WR-03: `BackTab` has no render branch when `seasonData` is defined but `teamId` is null after the decision-history data guard passes (BackTab.tsx lines 353–389)

**File:** `src/components/accuracy/BackTab.tsx:353-389`

**Issue:** The `seasonSections` block checks `teamId === null` first and renders an auth-guard prompt. This is correct. However, the function reaches that block only after the `data.entries.length === 0` guard at line 341 passes — meaning there IS decision-history data. When `teamId === null` is passed alongside real decision-history data (which is only possible if a caller passes `teamId={null}` while `useDecisionHistory` still returns data from cache), the `useSeasonAnalytics` hook is already disabled (returns `isLoading: false, data: undefined`), but neither the `seasonLoading` nor `seasonData` branches fire because `teamId === null` is caught first. This is technically correct, but the `else if (seasonData)` branch can never render when `teamId === null` — there is an implicit coupling between the `teamId === null` guard and the hook's `enabled` flag that is not validated anywhere, making the code fragile to future refactoring.

More concretely: if a caller ever passes a non-null `teamId` that becomes `null` after the data guard (e.g., through a racing state update), neither the loading spinner nor the error message nor the auth-guard prompt will show because the `else if` chain falls through to `null` — `seasonSections` remains `null` and the season sections silently disappear without feedback.

**Fix:** Add a final `else` branch to the `seasonSections` assignment to ensure a visible fallback:

```typescript
} else {
  // Idle / no data — render nothing (season data not yet available)
  seasonSections = null
}
```

This makes the exhaustive intent explicit and prevents silent blank sections if the control flow ever changes.

---

## Info

### IN-01: `useSeasonAnalytics.test.ts` line 30 — `samplePayload` uses `brokeEven: false` for a transfer where `netPts = 4 > 0` (test fixture inconsistency)

**File:** `src/lib/hooks/useSeasonAnalytics.test.ts:30-35`

**Issue:** The `samplePayload()` fixture sets `elementInPts: 18, elementOutPts: 10, netPts: 4, brokeEven: false`. Given the type contract (`brokeEven = netPts > 0`) and the API implementation (`netPts = 4 > 0 → brokeEven = true`), this fixture is internally inconsistent. The route would never produce `{ netPts: 4, brokeEven: false }`. This does not cause a test failure because `useSeasonAnalytics` tests only check that the payload is passed through from the fetch mock — they do not assert on `brokeEven` individually — but it is a misleading fixture that could conceal future regressions and confuse readers.

Compare with `BackTab.test.tsx:128` which correctly uses `brokeEven: true` for `netPts: 4`.

**Fix:** Update the fixture to be consistent with the type contract:

```typescript
{ ..., netPts: 4, brokeEven: true }
```

---

_Reviewed: 2026-05-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
