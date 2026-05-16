---
phase: 114-polish-carry-forward-fixes-v1-21
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/planner/ChipToggle.tsx
  - src/components/planner/RouteTreeTab.tsx
  - src/components/gem-table/columns.tsx
  - src/components/gem-table/GwToggle.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 114: Code Review Report

**Reviewed:** 2026-05-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four files were reviewed: ChipToggle (chip selector widget), RouteTreeTab (route-tree planner tab), columns (gem-table column definitions), and GwToggle (gameweek horizon toggle with column visibility helpers). The implementation is largely sound. The most impactful issues are a stale `chipMode` constant that silently prevents user chip interaction in RouteTreeTab, a sparkline coordinate formula that clips when trajectory arrays exceed 5 elements, and a missing column visibility entry that causes `rank_trajectory` to remain visible in the Analysis preset contrary to the pattern established by all other secondary analytical columns.

---

## Warnings

### WR-01: `chipMode` is a hardcoded `null` constant — ChipToggle UI is completely non-functional

**File:** `src/components/planner/RouteTreeTab.tsx:90`
**Issue:** `chipMode` is declared as a module-level constant `const chipMode: PlannerChip = null` and never changes. The rendered `<ChipToggle>` is permanently `disabled={true}` and `activeChip={null}`, and `onToggle` is a no-op `() => {}`. This makes the entire chip selection widget decorative — clicking any chip button does nothing, the tree always recomputes with `chipMode=null`, and no chip state is ever reflected in the loaded `ManualPlan` (the bridge at line 139 also hardcodes `chip: null` per each step). If chip support in the route tree is a future concern, this is fine only as a deliberate stub; however there is no comment or test marking this as intentional stub behaviour rather than an accidental omission. Any user who sees the chip buttons and clicks them receives silent no-feedback failure.

**Fix:** Either (a) elevate `chipMode` to component state and wire up `onToggle`, or (b) remove the `<ChipToggle>` block entirely from the squad-loaded branch so the UI does not present an interaction affordance that does nothing:
```tsx
// Option B — remove the dead widget (lines 233-240)
// <div>
//   <ChipToggle gw={startingGw ?? 1} activeChip={null} onToggle={() => {}} disabled={true} />
// </div>
```

---

### WR-02: SVG sparkline x-coordinates overflow viewBox when trajectory length > 5

**File:** `src/components/gem-table/columns.tsx:345`
**Issue:** The coordinate formula `2 + i * 9` for a 40px-wide viewBox (`width="40" viewBox="0 0 40 20"`) is hardcoded for exactly 5 points. With 5 points (i=0..4), the last x=38, which fits. If the pipeline ever emits a 6-element (or longer) array — possible during development, A/B transitions, or if the type annotation `number[]` is widened without updating this component — the polyline extends beyond x=40 and is clipped by SVG `overflow:hidden` with no error. The type `rank_trajectory?: number[]` carries no compile-time length constraint.

**Fix:** Slice to 5 before mapping, or compute the step dynamically:
```tsx
// Safe version — slice to max 5 and compute step from actual length
const pts = trajectory.slice(0, 5)
const step = pts.length > 1 ? 36 / (pts.length - 1) : 0
const pointsStr = pts.map((v, i) => `${2 + i * step},${(1 + v * 18).toFixed(1)}`).join(' ')
```

---

### WR-03: `rank_trajectory` missing from `PRESET_COLUMN_VISIBILITY['analysis']` — column stays visible in Analysis preset

**File:** `src/components/gem-table/GwToggle.tsx:63-71`
**Issue:** The `analysis` preset object does not include `rank_trajectory: false`. Every other secondary analytical column (`fdr_score`, `form_score`, `xg_score`, `xa_score`, `ownership_score`, `minutes_score`, `set_piece_score`) is hidden in this preset. `rank_trajectory` (added in Phase 114) is hidden in `compact` (line 49) and `MOBILE_HIDDEN_COLUMNS` (line 25), but is conspicuously absent from `analysis`. This means the sparkline column is unexpectedly visible in Analysis preset alongside `xPts`, `regression_signal`, `differential_flag`, `routes_to_points`, etc., which may or may not be desired but is inconsistent with every comparable secondary column.

**Fix:** Add the entry to the `analysis` object:
```ts
analysis: {
  fdr_score: false,
  form_score: false,
  xg_score: false,
  xa_score: false,
  ownership_score: false,
  minutes_score: false,
  set_piece_score: false,
  rank_trajectory: false,  // add this line
},
```
If the intent is to show the sparkline in Analysis preset, add a comment explaining the deliberate omission so future reviewers do not treat it as a bug.

---

### WR-04: `chipMode` in `useMemo` dependency array is a stable constant — dependency is misleading noise

**File:** `src/components/planner/RouteTreeTab.tsx:108`
**Issue:** `chipMode` is listed as a `useMemo` dependency at line 108: `[picks, scoredPlayers, horizon, ..., chipMode, ...]`. Because `chipMode` is `const chipMode: PlannerChip = null` (a literal constant declared in the render body on line 90), it is referentially stable across renders — it never causes a recompute. Including it as a dependency is misleading: it implies the tree would recompute when the chip changes, but it cannot change. This creates confusion for anyone modifying the component to add real chip state.

**Fix:** Either remove `chipMode` from the dependency array (since it is a constant), or convert it to real state as described in WR-01 so the dependency is genuine:
```tsx
// If keeping as a constant, remove from deps:
}, [picks, scoredPlayers, horizon, initialFTState, bankBalance, sellPriceMap, startingGw, playerMap])
```

---

## Info

### IN-01: `ChipToggle` buttons have no `type="button"` attribute — risk of accidental form submission

**File:** `src/components/planner/ChipToggle.tsx:27`
**Issue:** The `<button>` elements inside `ChipToggle` do not specify `type="button"`. The HTML default for a button inside a form is `type="submit"`. If `ChipToggle` is ever rendered inside a `<form>` element (e.g., as part of a larger planner form), clicking a chip button would submit the form unexpectedly. The pattern is already established elsewhere — `GwToggle` correctly omits this because it is never in a form, but ChipToggle's context is less controlled.

**Fix:**
```tsx
<button
  key={chipCode}
  type="button"
  aria-pressed={isActive}
  onClick={() => onToggle(chipCode)}
  ...
>
```

---

### IN-02: `loadManualPlan()` called inside `useCallback` without try/catch — localStorage read can throw

**File:** `src/components/planner/RouteTreeTab.tsx:149`
**Issue:** `handleClickLoad` calls `loadManualPlan()` on line 149 with no error handling. If `localStorage` is unavailable (private browsing with storage blocked, quota errors, or security policy), this will throw and leave the component in an undefined state (the `tree` check on line 148 passes, but the load silently fails with an uncaught exception). `persistManualPlan` in `handleConfirmLoad` (line 142) has the same gap.

**Fix:** Wrap in try/catch, matching the pattern already used in `handleLoadSquad` (line 167):
```tsx
const handleClickLoad = useCallback((i: number) => {
  if (!tree) return
  let existing: ManualPlan | null = null
  try { existing = loadManualPlan() } catch {}
  const hasTransfers = existing?.steps.some(s => s.transfers.length > 0) ?? false
  if (hasTransfers) {
    setConfirmingLoadIndex(i)
  } else {
    handleConfirmLoad(i)
  }
}, [tree, handleConfirmLoad])
```

---

### IN-03: `String.fromCharCode(65 + i)` produces garbage labels for more than 26 paths

**File:** `src/components/planner/RouteTreeTab.tsx:279`
**Issue:** `String.fromCharCode(65 + i)` generates A–Z for i=0..25. The engine currently generates at most 3 paths per the comment on line 229, so this is not an immediate problem. However, the type `RoutePath[]` has no maximum length enforced, and if `buildTransferRouteTree` is extended, i=26 produces `[` (ASCII 91), which is not a letter. No runtime guard exists.

**Fix:** Either cap with a guard or use a lookup:
```tsx
const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const pathLabel = `Path ${LABELS[i] ?? String(i + 1)}`
```

---

_Reviewed: 2026-05-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
