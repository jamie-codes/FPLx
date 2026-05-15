---
phase: 112
status: findings
depth: standard
reviewed_files:
  - src/lib/cap-transfer-suggestions.ts
  - src/lib/cap-transfer-suggestions.test.ts
  - src/components/optimiser/OptimiserPanel.tsx
  - src/components/optimiser/OptimiserPanel.test.tsx
  - src/components/transfers/TransferPanel.tsx
  - src/components/transfers/OpportunityCostTable.tsx
  - src/components/transfers/OpportunityCostTable.test.tsx
critical: 0
warning: 3
info: 3
---

# Phase 112: Code Review Report

**Reviewed:** 2026-05-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** findings

## Summary

Phase 112 introduces two features: an on-demand optimiser gate (OPT-01, `hasRun` flag) and a per-position transfer suggestion cap (TFR-02, `capByPosition`). The pure-function `capByPosition` is clean and well-tested for the single-position case. The React integration in `OptimiserPanel` and `TransferPanel` is structurally sound. Three warnings and three info items were found — no critical/blocking bugs.

The most significant finding is that `capByPosition` assigns cross-position combo suggestions (e.g., sell a DEF + sell a MID) to a single bucket using only `transfers[0].buy.element_type`, leaving the second leg's position entirely unrepresented in `totalsByPosition`. This is undocumented, untested for the cross-position case, and produces a subtly incorrect footnote when such combos are the marginal entries in a truncated bucket. A second warning concerns a missing fallback in `OptimiserPanel`'s footnote rendering that would silently emit `undefined` into the DOM for any element_type value outside {1,2,3,4}.

---

## Warnings

### WR-01: `capByPosition` uses `transfers[0].buy.element_type` for combo bucketing — cross-position combos are silently misclassified

**File:** `src/lib/cap-transfer-suggestions.ts:28-30`

**Issue:** A combo `TransferSuggestion` contains two legs, each potentially involving a different position (e.g., sell DEF id=3 / buy DEF id=77, sell MID id=9 / buy MID id=44). The function buckets the entire combo under `transfers[0].buy.element_type`. If `transfers[0]` is a DEF and `transfers[1]` is a MID, then:

1. The combo contributes to the DEF bucket's count toward the cap, not to the MID bucket.
2. `totalsByPosition` for MID does not include this combo, so the "Showing top 3 of N MID suggestions" footnote underreports N.
3. Whether a cross-position combo gets capped is determined solely by how many other combos happened to land in `transfers[0]`'s bucket — which can differ between runs due to map insertion order depending on input.

`suggestTransfers` produces combos with legs at independent positions (see the nested loop at `suggest-transfers.ts:206-249` — `sell1` and `sell2` come from `currentPlayers[i]` and `currentPlayers[j]` independently). The engine guarantees position-lock per-leg (sell and buy of the same leg have the same position), but the two legs of a combo can be at different positions.

**Fix:** Document the intentional simplification if it is accepted behaviour, or bucket combos under both leg positions and deduplicate. The minimal fix is a comment:

```ts
// NOTE: cross-position combos (e.g. DEF leg + MID leg) are bucketed under
// transfers[0].buy.element_type only. The second leg's position bucket is not
// credited. This means totalsByPosition may undercount for the second leg's position.
const pos =
  sug.kind === 'single'
    ? sug.buy.element_type
    : sug.transfers[0].buy.element_type
```

If correct per-position counting is desired, bucket under both legs:

```ts
if (sug.kind === 'combo') {
  for (const leg of sug.transfers) {
    const p = leg.buy.element_type
    const bucket = byPosition.get(p)
    if (bucket === undefined) byPosition.set(p, [sug])
    else if (!bucket.includes(sug)) bucket.push(sug)
  }
} else {
  // single: bucket under buy.element_type as before
}
```

---

### WR-02: `OptimiserPanel` footnote renders `undefined` in the DOM for unknown `element_type` values

**File:** `src/components/optimiser/OptimiserPanel.tsx:698`

**Issue:** The footnote copy is built as:

```tsx
Showing top 3 of {transferTotalsByPosition.get(pos)} {POSITION_LABELS[pos]} suggestions.
```

`POSITION_LABELS` is defined as `Record<number, string>` with entries only for keys 1–4. If `pos` is any other value (e.g., `0` or `5`, which could arrive from corrupted upstream data), `POSITION_LABELS[pos]` evaluates to `undefined` and React renders the literal string `"undefined"` in the DOM. The companion component `OpportunityCostTable.tsx` at line 249 correctly guards with `?? pos`, but `OptimiserPanel` does not.

**Fix:**

```tsx
Showing top 3 of {transferTotalsByPosition.get(pos)} {POSITION_LABELS[pos] ?? String(pos)} suggestions.
```

---

### WR-03: `transferSuggestions` useMemo in `OptimiserPanel` depends on `lineup` but transfer suggestions are independent of lineup output

**File:** `src/components/optimiser/OptimiserPanel.tsx:284,298`

**Issue:** The memo dependency array is `[squadData, playersData, lineup, horizon, ftCount, exactSellPrices]`. The `lineup` variable does not affect the computation — it is only used as a guard (`if (!squadData || !playersData || !lineup)`) to skip computation when null. This has two consequences:

1. Any time the optimiser recomputes a lineup (e.g., on horizon change), the transfer suggestions memo is also invalidated and recomputed, even though neither `squadData` nor `playersData` changed. This is unnecessary work.
2. When `lineup === null` (BGW critical path), transfer suggestions always return `[]`, even though the transfer engine would produce valid results independent of the lineup result. If a future refactor renders the transfer section even when `lineup === null`, suggestions will silently never appear.

The guard's intent — preventing `suggestTransfers` from running before the squad is loaded — is already satisfied by `!squadData || !playersData`. The `!lineup` guard is redundant and adds a spurious dependency.

**Fix:** Remove `lineup` from both the guard condition and the dependency array:

```ts
const { transferSuggestions, transferTotalsByPosition } = useMemo<{...}>(() => {
  if (!squadData || !playersData) {
    return { transferSuggestions: [] as TransferSuggestion[], transferTotalsByPosition: new Map<number, number>() }
  }
  // ...
}, [squadData, playersData, horizon, ftCount, exactSellPrices])
```

---

## Info

### IN-01: `cap-transfer-suggestions.test.ts` — no test for cross-position combo bucketing

**File:** `src/lib/cap-transfer-suggestions.test.ts:72-88`

**Issue:** The `comboSug` factory always creates both transfer legs with the same `element_type` (line 82–83: both `transfers[0]` and `transfers[1]` use the same `element_type` argument). No test exercises the case where `transfers[0].buy.element_type !== transfers[1].buy.element_type`. The bucketing behaviour for cross-position combos (described in WR-01) is therefore entirely untested.

**Fix:** Add a test case with a combo where `transfers[0]` is a DEF and `transfers[1]` is a MID, and assert which bucket the combo lands in and what `totalsByPosition` reports for each position.

---

### IN-02: `cap-transfer-suggestions.test.ts` `breakEvenGws` formula uses `xPtsGain` instead of `xPtsGainPerGw`

**File:** `src/lib/cap-transfer-suggestions.test.ts:68`

**Issue:** The `singleSug` test helper computes:

```ts
breakEvenGws: cost === 0 ? null : Math.max(1, Math.ceil(4 / xPtsGain))
```

The production formula (and the `breakEven()` function in `suggest-transfers.ts:87`) divides by `xPtsGainPerGw`, not `xPtsGain`. In the test fixture, `xPtsGainPerGw = xPtsGain` (line 66), so this does not cause test failures. However, the fixture is misleading and would produce incorrect `breakEvenGws` values if the fixture were ever modified to pass a different `xPtsGainPerGw`.

**Fix:**

```ts
breakEvenGws: cost === 0 ? null : Math.max(1, Math.ceil(4 / xPtsGainPerGw)),
```

---

### IN-03: `OptimiserPanel.tsx` inline IIFE for transfer suggestion grouping adds cyclomatic complexity

**File:** `src/components/optimiser/OptimiserPanel.tsx:607-703`

**Issue:** The transfer suggestion rendering block uses a self-invoking arrow function (`{(() => { ... })()}`) spanning approximately 95 lines to group suggestions by position and render them with footnotes. This is hard to test in isolation and difficult to read. No bugs result, but it is a code quality signal.

**Fix:** Extract the grouping and rendering logic into a named sub-component or helper function, similar to the existing `ComparisonTable` / `MobileComparisonCards` pattern in the same file.

---

_Reviewed: 2026-05-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
