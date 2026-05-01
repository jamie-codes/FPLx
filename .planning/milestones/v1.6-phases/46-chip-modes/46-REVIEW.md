---
phase: 46-chip-modes
reviewed: 2026-05-01T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/components/gem-table/GwToggle.tsx
  - src/components/optimiser/ChipModeToggle.tsx
  - src/components/optimiser/ChipSquadView.tsx
  - src/components/optimiser/OptimiserPanel.tsx
  - src/lib/chip-modes.ts
  - src/lib/types.ts
  - src/components/optimiser/ChipModeToggle.test.tsx
  - src/components/optimiser/ChipSquadView.test.tsx
  - src/components/optimiser/OptimiserPanel.test.tsx
  - src/lib/chip-modes.test.ts
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 46: Code Review Report

**Reviewed:** 2026-05-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 46 introduces the chip-mode selector (WC/FH/BB) with a greedy squad builder, a new `ChipSquadView` component, and wires everything into `OptimiserPanel`. The core logic is mostly sound but contains three blockers: the greedy algorithm never enforces minimum-slot quotas so can produce squads missing required positions (e.g. 0 FWDs); the BB bench opacity suppression is inverted in `MobileComparisonCards` and therefore shows the wrong visual state; and the FH horizon lock in `chipSquad` memo correctly forces `horizon: 1` for the API call but still passes the user-selected `horizon` to `computeBenchBoostXPts` in the BB headline, leaking an inconsistency. There are also several warnings around the `chipSquad` memo dependency array, accessibility gaps in the new components, and a type-safety hole in `ChipSquadView`.

---

## Critical Issues

### CR-01: Greedy squad builder never enforces MIN_SLOTS — can return a squad with 0 FWDs (or too few of any position)

**File:** `src/lib/chip-modes.ts:56-81`

**Issue:** `buildOptimalSquad` only checks `MAX_SLOTS` per position (`filledSlots[pos] >= MAX_SLOTS[pos]`). It never checks `MIN_SLOTS`. Because the greedy loop picks the highest-`xPts` player globally and MIDs/DEFs tend to outscore FWDs, the algorithm can exhaust the budget or the 15-player cap before accumulating the required minimums (2 GKs, 3 DEFs, 2 MIDs, 1 FWD). A squad with, say, 0 FWDs would then pass the `squad.length < 15` guard and be returned to the UI. When `optimiseLineup` subsequently tries to build a valid XI from those 15 players it will return `null` (no valid formation) — triggering the fallback `return null` at line 98, but only after the algorithm has done unnecessary work. More dangerously, if `optimiseLineup` happens to find a creative valid formation the UI silently displays a squad that violates FPL rules.

The real failure mode is when the player pool has just barely enough of each position: e.g. exactly 2 GKs available. The greedy sort may not reach those GKs before the budget or slot cap triggers `squad.length >= 15`, returning a squad with only 1 GK and failing `optimiseLineup`. This is also the scenario the `MIN_SLOTS` constant was introduced to handle — yet it is never read by the algorithm (the `void MIN_SLOTS` at line 131 is a lint-suppression workaround confirming it is unused).

**Fix:** After filling each player check that all minimum quotas can still be met given remaining slots. The simplest correct approach is a two-pass strategy: fill minimum quota slots first (picking the best eligible player per position for each required slot), then greedily fill the remaining slots.

```typescript
// Pass 1: satisfy minimums
for (const [posStr, min] of Object.entries(MIN_SLOTS)) {
  const pos = Number(posStr)
  const needed = min - (filledSlots[pos] ?? 0)
  let taken = 0
  for (const player of sorted) {
    if (taken >= needed) break
    if (player.element_type !== pos) continue
    if ((teamCount.get(player.team) ?? 0) >= teamCap) continue
    if (runningCost + player.now_cost > budget) continue
    if (alreadyPicked.has(player.id)) continue
    // ... add player, update tracking
    taken++
  }
  if (taken < needed) return null  // can't satisfy minimum
}

// Pass 2: greedy fill remaining 15 - filledTotal slots
```

---

### CR-02: BB bench opacity logic is inverted in MobileComparisonCards

**File:** `src/components/optimiser/OptimiserPanel.tsx:200`

**Issue:** In `ComparisonTable` (line 137), bench rows that are **unchanged** get `opacity-80` when `isBenchBoost` is **false** — meaning: in normal mode, unchanged bench rows are dimmed (correct), and in BB mode they are fully opaque (correct, because all 15 score points). The logic is `row.isBench && !isBenchBoost`.

In `MobileComparisonCards` (line 200), the same intent is expressed as:
```
(isBenchBoost && row.isBench ? '' : ' opacity-60')
```
This reads: "apply `opacity-60` to EVERYTHING except bench rows when BB is active." The condition is truthy (`isBenchBoost && row.isBench`) only for bench rows in BB mode; all other rows — including **XI rows in normal mode** — fall through to the `opacity-60` class. Every unchanged XI row in normal mode will be rendered at 60% opacity on mobile, which is visually wrong (only bench rows should be dimmed). When BB is active, unchanged changed bench rows correctly skip the opacity class, but XI rows incorrectly get `opacity-60`.

The correct condition mirrors `ComparisonTable`: apply opacity only to `row.isBench && !isBenchBoost && !row.isChanged`.

**Fix:**
```tsx
// Line 200 — replace:
className={`py-2 border-b border-zinc-100 dark:border-zinc-800${row.isChanged ? ' border-l-2 border-l-green-500 pl-2' : (isBenchBoost && row.isBench ? '' : ' opacity-60')}`}

// With:
className={`py-2 border-b border-zinc-100 dark:border-zinc-800${row.isChanged ? ' border-l-2 border-l-green-500 pl-2' : (row.isBench && !isBenchBoost ? ' opacity-60' : '')}`}
```

---

### CR-03: chipSquad memo missing `ftCount` and `transferSuggestions` is a false positive, but `playerMap` dependency causes stale budget on sell-price change

**File:** `src/components/optimiser\OptimiserPanel.tsx:284-298`

**Issue:** The `chipSquad` memo (lines 284–298) declares `[chipMode, playersData, squadData, myTeamData, horizon, exactSellPrices, playerMap]` as dependencies. `playerMap` is itself derived from a `useMemo` that depends on `[squadData, playersData, horizon]`. Because `playerMap` is a `new Map()` created inside that memo, its reference changes every time `squadData`, `playersData`, or `horizon` changes — which means adding `playerMap` to `chipSquad`'s dep array causes `chipSquad` to recompute whenever `horizon` changes, even when `chipMode === 'none'`. This is a correctness issue because `chipSquad` is supposed to be `null` in that branch (it returns early at line 285), but the unnecessary re-computation is not the bug.

The real bug is that `playerMap` is included in `chipSquad`'s dependency array **solely** for the budget calculation:
```typescript
return s + (exactSellPrices.get(pick.element) ?? (playerMap.get(pick.element)?.now_cost ?? 0))
```
When `exactSellPrices` is updated (e.g. authenticated sell prices arrive), `chipSquad` will recompute via the `exactSellPrices` dep — correct. But `playerMap` is a derived memo whose identity can change even when no underlying player data has changed (only `horizon` changed), causing `chipSquad` to rebuild the entire optimal squad purely because the horizon toggled, even in WC mode. In WC mode the horizon _should_ drive recomputation, so this is correct but unintentionally wasteful. In a future refactor where `playerMap` is extracted independently of `horizon`, this dep can silently go stale.

The true **correctness** defect: `playerMap` is read inside `chipSquad`'s budget calculation but `playerMap` only depends on `squadData` and `playersData` for the `now_cost` values it provides as fallback. The `horizon` component of `playerMap`'s deps is irrelevant to budget calculation. If `playerMap` is ever refactored to drop `horizon` from its own deps, the budget fallback will correctly stabilise — but the current dep chain means removing `horizon` from the inner memo would break `lineup` computation. This tightly-coupled dep chain is a latent correctness hazard.

**Immediate fix:** Remove `playerMap` from `chipSquad`'s dep array and inline the `now_cost` fallback lookup directly against `playersData` (which is already a dep):
```typescript
// Replace playerMap.get(pick.element)?.now_cost fallback with:
return s + (exactSellPrices.get(pick.element) ?? (playersData.find(p => p.id === pick.element)?.now_cost ?? 0))
```
Then remove `playerMap` from the dep array. This makes the dependency graph acyclic and explicit.

---

## Warnings

### WR-01: GwToggle `disabled` prop does not set `aria-disabled` on the inner buttons

**File:** `src/components/gem-table/GwToggle.tsx:94-116`

**Issue:** When `disabled={true}` (FH mode), the wrapper `<div>` gets `pointer-events-none opacity-50`. This prevents mouse clicks but the buttons remain individually focusable via keyboard Tab, and screen readers see no indication that the control is disabled. Keyboard-only users can still Tab into the buttons, press Enter/Space, and `onChange` will fire — `pointer-events-none` does not block keyboard events on `<button>` elements. Each button needs `disabled` (or `aria-disabled="true"` + `tabIndex={-1}`) when the wrapper is disabled.

**Fix:**
```tsx
<button
  key={gw}
  onClick={() => onChange(gw)}
  aria-pressed={value === gw}
  disabled={disabled}
  // ...
>
```
Or, if preserving the current dimmed-but-visually-styled approach:
```tsx
<button
  key={gw}
  onClick={disabled ? undefined : () => onChange(gw)}
  aria-pressed={value === gw}
  aria-disabled={disabled}
  tabIndex={disabled ? -1 : undefined}
  // ...
>
```

---

### WR-02: ChipSquadView has no accessible labels on player rows — screen readers get no position context

**File:** `src/components/optimiser/ChipSquadView.tsx:68-103`

**Issue:** The position group headers ("GK", "DEF", etc.) are visual-only `<div>` elements with no `role` or `id`. The player rows beneath them have no `aria-label` or association with the section header. Screen readers will hear a list of player names and costs with no positional context. The same issue applies to the "Bench" section header. Compare with `ComparisonTable` in `OptimiserPanel` which uses `<table>` + `<thead>` / `<th>` giving native semantics.

**Fix:** Either use a `<dl>` / `<dt>` / `<dd>` pattern or add `role="list"` / `role="listitem"` with `aria-label` on rows:
```tsx
<div
  role="group"
  aria-label={`${POSITION_LABELS[pos]} players`}
>
  {group.map(p => (
    <div
      key={p.id}
      role="listitem"
      aria-label={`${p.web_name}, £${(p.now_cost / 10).toFixed(1)}m, ${p.xPts.toFixed(1)} expected points`}
      // ...
    >
```

---

### WR-03: `ChipSquadView` accepts `chipMode: 'wildcard' | 'free-hit'` but `OptimiserPanel` passes the raw `ChipMode` state without narrowing

**File:** `src/components/optimiser/OptimiserPanel.tsx:451`

**Issue:** At line 451, `<ChipSquadView result={chipSquad} chipMode={chipMode} />` is inside a branch guarded by `chipMode === 'wildcard' || chipMode === 'free-hit'`, so at runtime the value is correct. However TypeScript will flag this because `chipMode` has type `ChipMode` (`'none' | 'wildcard' | 'free-hit' | 'bench-boost'`), which is not assignable to `ChipSquadViewProps.chipMode` (`'wildcard' | 'free-hit'`). If TypeScript strict mode is enforced or this is checked by CI, the build will fail. Even if the compiler currently accepts it via type widening, the type contract is broken and a future refactor could introduce `'bench-boost'` into this branch by mistake without a compiler error.

**Fix:**
```tsx
// Narrow before passing:
const narrowedMode = chipMode as 'wildcard' | 'free-hit'
<ChipSquadView result={chipSquad} chipMode={narrowedMode} />
// Or use a type guard function, or widen ChipSquadViewProps to accept ChipMode.
```

---

### WR-04: `buildOptimalSquad` eligibility filter uses `xPts_1gw !== 0` for all horizons — BGW exclusion is horizon-agnostic when it should consult the active horizon field

**File:** `src/lib/chip-modes.ts:43`

**Issue:** The eligibility filter `p.status === 'a' && p.xPts_1gw !== 0` always checks `xPts_1gw` regardless of the `horizon` parameter. When `buildOptimalSquad` is called with `horizon: 3` (Wildcard) or `horizon: 5`, a player who has a fixture in GW+1 (so `xPts_1gw > 0`) but a blank in GW+2 and GW+3 will still be included in the pool even though their 3GW score is zero. Conversely, a player with `xPts_1gw === 0` (BGW this week) but excellent `xPts_3gw` is excluded even though over 3 GWs they are valuable.

This is documented as intentional ("BGW proxy, D-09") but the spec comment at line 43 says `xPts_1gw !== 0` is a "BGW proxy" — implying it is a deliberate simplification. However the downstream consequence is that WC builds with `horizon: 3` or `horizon: 5` silently exclude players who are blank only this GW, producing a suboptimal squad that contradicts the WC use case. At minimum this should be `p[HORIZON_FIELD[horizon]] !== 0` so the filter matches the scoring horizon.

**Fix:**
```typescript
const eligible = players.filter(p =>
  p.status === 'a' &&
  ((p[HORIZON_FIELD[horizon]] as number | undefined) ?? 0) !== 0
)
```

---

### WR-05: `computeBenchBoostXPts` is called twice in the BB headline with identical arguments — no memoisation

**File:** `src/components/optimiser/OptimiserPanel.tsx:467-479`

**Issue:** `computeBenchBoostXPts(lineup.bench, playersData, horizon)` is called at line 467 (for the "Bench xPts:" display) and again at line 477 (for the "Total:" computation). This function builds a `new Map` from `playersData` on every call, so the duplicate call doubles the work unnecessarily. While this is not a correctness issue per se, it is called in the render path (not memoised) and `playersData` can be 700+ player objects.

**Fix:** Compute once and reuse:
```tsx
{(() => {
  const benchXPts = computeBenchBoostXPts(lineup.bench, playersData, horizon)
  const starterXPts = lineup.starters.reduce(...)
  return (
    <>
      <span>Bench xPts: {benchXPts.toFixed(1)}</span>
      ...
      <span>Total: {(benchXPts + starterXPts).toFixed(1)}</span>
    </>
  )
})()}
```
Or extract to a local variable before the return JSX.

---

## Info

### IN-01: `MIN_SLOTS` is suppressed with `void MIN_SLOTS` — dead constant that documents unimplemented constraint

**File:** `src/lib/chip-modes.ts:130-131`

**Issue:** `MIN_SLOTS` is declared, referenced in JSDoc, but never used in the algorithm — confirmed by the `void MIN_SLOTS` workaround at line 131 to prevent the "unused variable" lint error. This is the direct source of CR-01. The comment "used for validation callers" is inaccurate; no caller uses it.

**Fix:** Either implement it in the algorithm (see CR-01) or delete both lines until it is needed.

---

### IN-02: `ChipModeToggle` buttons have no `disabled` prop and no visual affordance when a chip is already active in the FPL API

**File:** `src/components/optimiser/ChipModeToggle.tsx:29-44`

**Issue:** The FPL API `SquadPicksResponse.active_chip` field (present in `squad-adapter.ts`) indicates whether a chip is already active for the current GW. The UI makes no use of this field in `ChipModeToggle` — a user who has already played Wildcard this GW will see all four buttons as fully interactive. Selecting a chip mode the user cannot actually play (it is already used/active) produces a misleading optimised squad.

**Fix:** Pass `activeFplChip: string | null` as a prop and disable buttons whose chip is already played.

---

### IN-03: `ChipSquadView` bench section has no `data-testid` on the header `<div>`, unlike the position group headers

**File:** `src/components/optimiser/ChipSquadView.tsx:89`

**Issue:** All position group header divs are rendered inside the `POSITION_ORDER.map` but the "Bench" section header is a standalone `<div>` with no `data-testid`. Tests in `ChipSquadView.test.tsx` query bench rows via `[data-xi="false"]` which works, but there is no way to assert the "Bench" label text in a targeted way. Inconsistent with the position-group pattern and makes future test assertions harder.

**Fix:**
```tsx
<div
  data-testid="section-header-bench"
  className="text-[10px] font-semibold uppercase ..."
>
  Bench
</div>
```

---

_Reviewed: 2026-05-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
