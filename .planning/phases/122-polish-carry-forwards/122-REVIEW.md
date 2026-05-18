---
phase: 122-polish-carry-forwards
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/planner/RouteTreeTab.tsx
  - src/components/planner/RouteTreeTab.test.tsx
  - src/components/transfers/OpportunityCostTable.tsx
  - src/components/transfers/OpportunityCostTable.test.tsx
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 122: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four source files reviewed: two component implementations (`RouteTreeTab.tsx`, `OpportunityCostTable.tsx`) and their corresponding test files. The implementations are generally well-structured with clear data-flow and good test coverage. However, one critical type-safety bug exists in `OpportunityCostTable.tsx` where `MergedPlayer` objects are cast to `ScoredPlayer` via a type assertion — a cast that is not always valid and can produce incorrect runtime behavior. Four warnings cover logic gaps and test reliability issues that could cause silent failures or user-facing incorrectness.

---

## Critical Issues

### CR-01: Unsafe `MergedPlayer` → `ScoredPlayer` cast in `PlayerMoveCell` (`computeRejection` argument)

**File:** `src/components/transfers/OpportunityCostTable.tsx:131`

**Issue:** `OCSRow.transfers` holds `Array<{ sell: MergedPlayer; buy: MergedPlayer }>` (declared in `src/lib/opportunity-cost.ts:27`). Inside `PlayerMoveCell`, the sell-side is cast with `t.sell as unknown as ScoredPlayer` before being passed to `computeRejection`. `MergedPlayer` and `ScoredPlayer` are related but not identical — `ScoredPlayer` carries computed fields (`gem_score`, `xPts_1gw`, `mins_risk`, `start_prob`, `form_pts_per90`, etc.) that `MergedPlayer` does not necessarily populate. The double-cast (`as unknown as ScoredPlayer`) suppresses the TypeScript compiler's ability to catch the mismatch entirely. If `computeRejection` dereferences any field that is undefined on the underlying `MergedPlayer`, it will silently produce wrong rejection reasons (e.g., treating `undefined` start_prob as falsy and emitting spurious "Rotation risk" badges) or crash at runtime if a field is accessed without a null guard inside `computeRejection`.

The `allPlayers: ScoredPlayer[]` parameter to the same function is satisfied by the `allPlayers` prop, but the **first** argument — the candidate being evaluated — receives the unsafely-cast sell object. These are fundamentally different shapes.

**Fix:** Either:
1. Change `OCSRow.transfers` to carry `ScoredPlayer` instead of `MergedPlayer` for the sell side (requires updating `computeOpportunityCostRows` to accept `ScoredPlayer[]`), or
2. Look up the player in `allPlayers` by ID before calling `computeRejection`:

```tsx
// Safe lookup: fall back gracefully when player not in allPlayers pool
const sellPlayer = allPlayers.find(p => p.id === t.sell.id)
const { reasons: sellReasons } = sellPlayer
  ? computeRejection(sellPlayer, allPlayers, lifecycleLabels)
  : { reasons: [] }
```

---

## Warnings

### WR-01: `isHit` derivation is always `false` — dead branch and misleading comment

**File:** `src/components/planner/RouteTreeTab.tsx:390`

**Issue:** The code reads:
```tsx
const isHit = node.hitCost !== 0  // always false per D-01 / Plan 01 contract
```
The comment acknowledges the value is always `false`, but the conditional rendering branch for hit display (lines 399–402) still executes the `isHit` check and renders a red "Hit −4 pts" badge if it were ever true. This dead code creates a maintenance hazard: if the engine contract changes (e.g., hits are later allowed), the hit badge rendering is present but `isHit` will still be `false` because `hitCost` is typed as literal `0` on `RouteNode` (see `transfer-route-tree.ts:46: hitCost: 0`). Any future developer adding hit support must remember to update this component — the comment and dead branch signal conflicting intent. More importantly, the comment "always false per D-01" could cause a future developer to incorrectly trust the badge works when it has never been exercised.

**Fix:** Either remove the dead `isHit` branch and always render the "Free" badge for transfer rows (matching the engine contract), or remove the misleading comment and add a test that would fail if hits start appearing. If the intent is to support hits in the future, replace the comment with a `TODO` that references the specific design doc change needed.

```tsx
// Remove: const isHit = node.hitCost !== 0
// Always render "Free" since D-01 forbids hits in this engine:
<span className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs font-semibold rounded px-2 py-1">
  Free
</span>
```

---

### WR-02: `pathLabel` character calculation silently wraps for paths beyond index 25

**File:** `src/components/planner/RouteTreeTab.tsx:278`

**Issue:**
```tsx
const pathLabel = `Path ${String.fromCharCode(65 + i)}`  // A, B, C
```
The comment implies only A/B/C are produced. The engine caps paths at 3 (one per sell root), so today this is safe. However, the label is computed from the raw index with no guard. If the engine ever emits more than 26 paths (index ≥ 26), `String.fromCharCode(91+)` produces `[`, `\`, `]`, etc. More practically, if it emits more than 3 today due to a bug in the engine, paths would silently render with wrong labels. The test suite only verifies `rows.length >= 1` — it does not assert the maximum, so this gap in the test would not catch an engine regression.

**Fix:** Add an explicit guard or use a lookup array:

```tsx
const PATH_LABELS = ['A', 'B', 'C', 'D', 'E']
const pathLabel = `Path ${PATH_LABELS[i] ?? String(i + 1)}`
```

And in the test file, add an assertion: `expect(rows.length).toBeLessThanOrEqual(3)`.

---

### WR-03: `onSwitchSubTab` is captured in `beforeEach` but `vi.resetAllMocks()` resets it, then it is not re-mocked — subtle ordering bug in test file

**File:** `src/components/planner/RouteTreeTab.test.tsx:145-150`

**Issue:**
```ts
const onSwitchSubTab = vi.fn()
beforeEach(() => {
  onSwitchSubTab.mockClear()
  vi.resetAllMocks()          // <-- resets ALL mocks, including onSwitchSubTab
  mU(loadManualPlan).mockReturnValue(null)
})
```
`vi.resetAllMocks()` resets every mock — including the module-level `onSwitchSubTab` vi.fn(). After `vi.resetAllMocks()`, `onSwitchSubTab` has no implementation (all calls return `undefined`), its call history is cleared, and the `mockClear()` on the line above it is redundant. The test file relies on `onSwitchSubTab` as a spy assertion (`expect(onSwitchSubTab).toHaveBeenCalledWith('manual-plan')`), and while `vi.resetAllMocks()` does not remove the spy function itself, it resets its recorded calls and any implementations. Because `mockClear()` is called before `resetAllMocks()`, the correct call count after `resetAllMocks()` is zero — which means the assertions currently work by accident (the slate is clean from `resetAllMocks`). However, if `vi.resetAllMocks()` ever transitions to `vi.restoreAllMocks()` or if a developer moves the mock definition inside `setupDefaultMocks`, the ordering will produce hard-to-diagnose failures.

**Fix:** Put `vi.resetAllMocks()` first, then `mU(loadManualPlan).mockReturnValue(null)`, and remove the now-redundant `onSwitchSubTab.mockClear()`:

```ts
beforeEach(() => {
  vi.resetAllMocks()
  mU(loadManualPlan).mockReturnValue(null)
  // onSwitchSubTab is a plain vi.fn() — its call history is already cleared by resetAllMocks
})
```

---

### WR-04: `OpportunityCostTable` uses `row.kind` as the React list `key` — breaks when duplicate kinds appear

**File:** `src/components/transfers/OpportunityCostTable.tsx:204`

**Issue:**
```tsx
{rows.map((row) => {
  ...
  return (
    <tr key={row.kind} ...>
```
`OCSRow.kind` is one of six string literals. If a caller ever passes a `rows` array with two entries of the same `kind` (e.g., two `'single-free'` rows for debugging, A/B comparison, or a future multi-suggestion mode), React will silently render only one of the duplicate-keyed rows and emit a console warning. There is no runtime guard or TypeScript constraint preventing duplicate kinds. The engine contract today produces at most one row per kind, but the component's `rows: OCSRow[]` prop carries no such constraint.

**Fix:** Use the array index as a stable secondary key, or combine kind and index:

```tsx
{rows.map((row, i) => {
  ...
  return (
    <tr key={`${row.kind}-${i}`} ...>
```

---

## Info

### IN-01: `MinsRiskBadge` called without `mins60Prob` prop — tooltip will never show probability

**File:** `src/components/transfers/OpportunityCostTable.tsx:145`

**Issue:**
```tsx
<MinsRiskBadge minsRisk={t.buy.mins_risk} />
```
`MinsRiskBadge` accepts an optional `mins60Prob` prop (see `MinsRiskBadge.tsx:46`) which, when provided, enriches the tooltip with "X% chance 60+ min". `ScoredPlayer` carries `mins_60_prob?: number`. The call site omits this prop entirely, so the badge tooltip falls back to the generic config title (e.g., "Rotation risk: rotation risk identified") rather than the specific probability. This is a minor UX degradation introduced by phase 122 — the badge is present but less informative than it could be.

**Fix:**
```tsx
<MinsRiskBadge minsRisk={t.buy.mins_risk} mins60Prob={t.buy.mins_60_prob} />
```

---

### IN-02: Empty tree fallback test uses verbose, fragile setup to force empty engine output — poor signal fidelity

**File:** `src/components/planner/RouteTreeTab.test.tsx:494-537`

**Issue:** The "empty tree fallback" test goes through three rounds of attempted setup, each commenting on why the previous approach would not work, before landing on a solution that depends on intimate knowledge of how `buildCandidatePool` filters `ownedIds`. The test comment explicitly says "Actually with bank=0 and sell_price=999, budget = 999, so any player at <= 999 is affordable — Let's instead use a scored pool with NO non-squad candidates at all". This is a logic-reasoning comment inside production test code rather than a simple, obvious fixture. If `buildCandidatePool` ever changes its filtering (e.g., allowing self-targeting under some condition), this test will silently pass an empty snapshot rather than detecting the real empty-tree logic. The test asserts `route-tree-empty` is present but does not verify the engine was actually invoked (no spy on `buildTransferRouteTree`).

**Fix:** Extract a named helper `makeSquadOnlyScored()` with a clear comment explaining the invariant that makes the engine produce no paths, and add an inline assertion on the number of paths:

```ts
// Invariant: no non-squad players → buildCandidatePool returns [] → all branches dropped.
const squadOnlyScored = makeSquadOnlyScored()
setupDefaultMocks({ scoredPlayers: squadOnlyScored })
const { container } = render(...)
expect(container.querySelector('[data-testid="route-tree-empty"]')).not.toBeNull()
// Belt-and-suspenders: if the engine somehow produced paths, the table would also appear.
expect(container.querySelectorAll('[data-testid^="path-row-"]').length).toBe(0)
```

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
