---
phase: 45-transfer-aware-mode
reviewed: 2026-04-30T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/components/optimiser/FtToggle.tsx
  - src/components/optimiser/OptimiserPanel.test.tsx
  - src/components/optimiser/OptimiserPanel.tsx
  - src/lib/suggest-transfers.test.ts
  - src/lib/suggest-transfers.ts
  - src/lib/types.ts
findings:
  critical: 2
  warning: 4
  info: 1
  total: 7
status: issues_found
---

# Phase 45: Code Review Report

**Reviewed:** 2026-04-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 45 implements a Transfer-Aware Mode for the OptimiserPanel: a `suggestTransfers` pure-function engine, an `FtToggle` component, and integration in `OptimiserPanel`. The engine logic, type contract, and UI integration are generally well-structured and follow existing codebase patterns.

Two blockers are present in `suggest-transfers.ts`. First, the single-transfer enumeration unconditionally emits a `-4pt hit` variant for every (sell, buy) pair regardless of `ftCount` — users with 2 FTs will be shown fictional hit costs for transfers that are actually free. Second, the 2-FT combo loop omits per-leg gain validation: a combo can have one losing leg offset by a large winning leg, surfacing a suggestion where the user is being advised to sell a player who is better than the replacement in that position.

---

## Critical Issues

### CR-01: Single transfers always emit a cost=4 hit variant regardless of ftCount

**File:** `src/lib/suggest-transfers.ts:137-148`

**Issue:** The single-transfer loop pushes a `cost: 4` entry for every valid (sell, buy) pair unconditionally. The comment on line 110-111 frames this as intentional so "the UI can rank ALL options." However, when `ftCount === 2`, the user has two free transfers — taking any single transfer does _not_ incur a hit. Surfacing a `cost: 4` hit variant for a transfer that is genuinely FREE under 2 FTs is factually wrong. A user with 2 FTs who follows the hit suggestion will believe they incur a -4pt penalty when they do not.

The `cost` field on `TransferSuggestion` is described in `types.ts` as the actual cost of taking that transfer. Emitting `cost: 4` for a transfer that costs 0 under the current `ftCount` violates the type contract's own engine invariants (§9: "All suggestions are budget-feasible (D-10 hard filter applied upstream)"), and by extension misleads the UI which renders the cost pill verbatim.

**Fix:** Thread `ftCount` through the single-transfer loop and derive cost correctly before emitting:

```typescript
// Inside the single-transfer loop, after the budget check:
const xPtsGainPerGw = xPtsGain / horizon

// Only 1 FT available: emit FREE + HIT pair so user can compare.
// With 2 FTs: every single transfer is free — emit FREE only.
singles.push({
  kind: 'single',
  sell,
  buy,
  cost: 0,
  xPtsGain,
  xPtsGainPerGw,
  breakEvenGws: null,  // breakEven(0, ...) is always null
})

if (ftCount === 1) {
  // HIT variant only makes sense when the single FT could be spent elsewhere.
  singles.push({
    kind: 'single',
    sell,
    buy,
    cost: 4,
    xPtsGain,
    xPtsGainPerGw,
    breakEvenGws: breakEven(4, xPtsGainPerGw),
  })
}
```

---

### CR-02: 2-FT combo loop allows negative-gain individual legs

**File:** `src/lib/suggest-transfers.ts:171-178`

**Issue:** The combo enumeration only gates on the _combined_ `xPtsGain > 0` (line 177). It does not check whether `gain1 > 0` or `gain2 > 0` individually. This means a combo where one leg has `gain1 = -3` and the other has `gain2 = +5` (combined `+2`) will be surfaced as a suggestion — the user is being advised to sell a player who is _better_ than the recommended replacement in that position.

This is wrong regardless of whether the overall combo is net-positive. Each individual transfer leg must be an improvement over the player being sold; otherwise the combo cannot be called an "optimal" 2-transfer plan. The spec comment at line 4 ("Algorithm step 5: keep xPtsGain > 0") should apply per-leg for combos, not just to the aggregate.

**Fix:** Add per-leg gain guards inside the inner loops:

```typescript
for (const buy1 of pool1) {
  const gain1 = horizonScore(buy1, field) - sell1Pts
  if (gain1 <= 0) continue  // leg 1 must individually improve

  for (const buy2 of pool2) {
    if (buy2.id === buy1.id) continue
    const gain2 = horizonScore(buy2, field) - sell2Pts
    if (gain2 <= 0) continue  // leg 2 must individually improve

    const xPtsGain = gain1 + gain2
    // xPtsGain is necessarily > 0 here, but keep the check as a guard
    if (xPtsGain <= 0) continue
    // ...rest unchanged
  }
}
```

---

## Warnings

### WR-01: Stale comment describes a dead code path for combo cost=4

**File:** `src/lib/suggest-transfers.ts:156`

**Issue:** Line 156 reads: "For a 2-transfer combo, cost = 0 when ftCount=2, cost = 4 when ftCount=1." The `ftCount=1` path is entirely unreachable: the whole combo block is guarded by `if (ftCount === 2)` on line 158. The comment implies an intentional design where combos can appear with a hit cost under 1 FT — but this code path was never implemented. The misleading comment will cause future maintainers to believe the behaviour was intentional and tested.

**Fix:** Either implement the `ftCount=1` combo path (2-FT combo where one transfer is free and one is a hit, `cost=4`) with the guard removed and a proper cost computation, or delete the dead-path clause from the comment:

```typescript
// For a 2-transfer combo using 2 FTs, cost is always 0 (FREE).
// ftCount=1 combos are not generated (no combo output when ftCount=1).
```

---

### WR-02: BGW eligibility count always uses horizon-1 field regardless of selected horizon

**File:** `src/components/optimiser/OptimiserPanel.tsx:244-248`

**Issue:** The BGW eligibility count shown in the soft/critical banner is computed using `p.xPts_1gw !== 0` regardless of the selected `horizon`. When the user switches to a 3GW or 5GW horizon, a player with `xPts_1gw === 0` (no 1GW fixture) but `xPts_3gw > 0` (has fixtures in the window) is still counted as BGW-ineligible. The eligibility count in the banner then disagrees with what the optimiser actually chose. The headline copy "only {eligibleCount} of your {totalPlayersInSquad} players have a fixture this gameweek" is factually misleading for non-1GW horizons.

**Fix:** Derive eligibility from the active horizon field:

```typescript
const eligible = squadData.picks.filter(pick => {
  const p = map.get(pick.element)
  if (!p) return false
  // Use horizon field: xPts_Ngw === 0 means no fixture in this window
  const horizonValue = p[HORIZON_FIELD[horizon]] as number | undefined
  return horizonValue !== 0
}).length
```

Note this also requires moving the eligibility calculation outside the current `useMemo` or adding `horizon` to its dependency array (it already includes `horizon`), so the fix is contained.

---

### WR-03: useMemo for transferSuggestions has an unnecessary lineup dependency

**File:** `src/components/optimiser/OptimiserPanel.tsx:262-272`

**Issue:** `transferSuggestions` depends on `lineup` (line 272), but `suggestTransfers` takes `currentPicks`, `players`, `horizon`, `ftCount`, `bank`, and `sellPrices` — none of which are `lineup`. The `lineup !== null` early-return guard inside the memo (line 263) means transfers are never computed when `lineup` is null. However the early-return branches above this memo (lines 326-345) mean the transfer section is never rendered when `lineup === null` anyway. The guard inside the memo is therefore redundant, and the `lineup` dependency causes the memo to recompute whenever the lineup changes — which happens independently of the transfer inputs.

In practice this means changing the lineup (e.g., toggling horizon already listed) causes an extra, unnecessary recompute of transfer suggestions. More importantly, if `lineup` is ever made optional/lazy, this dependency will silently suppress transfer suggestions in situations where they could validly be shown.

**Fix:** Remove `lineup` from the dependency array and drop the `!lineup` guard:

```typescript
const transferSuggestions: TransferSuggestion[] = useMemo(() => {
  if (!squadData || !playersData) return []
  return suggestTransfers({
    currentPicks: squadData.picks,
    players: playersData,
    horizon,
    ftCount,
    bank: squadData.entry_history.bank,
    sellPrices: exactSellPrices,
  })
}, [squadData, playersData, horizon, ftCount, exactSellPrices])
```

---

### WR-04: React list keys based on array index for transferSuggestions

**File:** `src/components/optimiser/OptimiserPanel.tsx:455`

**Issue:** `transferSuggestions.map((sug, idx) => { ... key={\`sug-${idx}\`} ... })` uses the array index as key. When `ftCount` or `horizon` changes, the sorted list is replaced entirely, but React may diff by index rather than by identity, leading to incorrect element reuse. While suggestions are currently display-only, any future addition of per-row state (e.g., a dismiss button, expanded state) will produce subtle bugs because the same index will resolve to a different suggestion after a re-sort.

**Fix:** Generate a stable key from the suggestion's content. For singles, `sell.id` and `buy.id` are sufficient; for combos, use all four IDs:

```typescript
const key = sug.kind === 'single'
  ? `single-${sug.sell.id}-${sug.buy.id}-${sug.cost}`
  : `combo-${sug.transfers[0].sell.id}-${sug.transfers[0].buy.id}-${sug.transfers[1].sell.id}-${sug.transfers[1].buy.id}`
```

---

## Info

### IN-01: Top-30 per-position pool includes GKs — not documented in algorithm comment

**File:** `src/lib/suggest-transfers.ts:36`

**Issue:** `POSITIONS` is `[GK, DEF, MID, FWD]`, meaning the engine generates GK transfer suggestions. This is correct FPL behaviour. However the algorithm comment block (lines 3-18) only says "Filter player pool to top-30 per position" without clarifying that GKs are included. Because GK transfers are relatively rare and many tools omit them, a future developer maintaining the top-N pool or position list may be surprised to see GK entries in results.

**Fix:** Add GK to the position list enumeration in the algorithm comment:

```
// 1. Filter player pool to top-30 per position (GK, DEF, MID, FWD) by xPts[horizon] (D-03).
```

---

_Reviewed: 2026-04-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
