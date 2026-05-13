---
phase: 104-transferpanel-sensitivity-rejection-explainer-wire-up
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/transfers/OpportunityCostTable.tsx
  - src/components/transfers/TransferPanel.tsx
  - src/components/squad/DecisionSummaryTab.tsx
  - src/components/transfers/OpportunityCostTable.test.tsx
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 104: Code Review Report

**Reviewed:** 2026-05-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This phase wires sell-side rejection reasons (WHY-01) into `PlayerMoveCell` inside `OpportunityCostTable`, and threads `allPlayers` + `lifecycleLabels` through both `TransferPanel` and `DecisionSummaryTab`. The core rendering logic and test coverage are sound, but there are two blockers: a type-unsafe cast that causes a runtime `undefined` access on `gem_score`, and a logic divergence in `derivedFtCount` between the two consumer components that silently undercounts free transfers for unauthenticated users in `DecisionSummaryTab`.

---

## Critical Issues

### CR-01: `t.sell` cast to `ScoredPlayer` hides missing `gem_score` field — runtime `undefined` in `computeRejection`

**File:** `src/components/transfers/OpportunityCostTable.tsx:115`

**Issue:** `OCSRow.transfers[].sell` is typed as `MergedPlayer` (`src/lib/opportunity-cost.ts:27`). `computeRejection` expects a `ScoredPlayer` and reads `player.gem_score` at `explain.ts:138` to decide adaptive framing. `MergedPlayer` does not carry `gem_score`. The cast `t.sell as unknown as ScoredPlayer` defeats TypeScript's safety: at runtime `player.gem_score` is `undefined`, and the comparison `undefined >= posAvg` always evaluates to `false`, so **every sell candidate is treated as non-strong** and always receives a full rejection-reasons list — including the spurious "Ranked #N at POS by xPts" opener — even for players that would qualify as strong. This silently defeats the adaptive framing logic of WHY-01 for all sell-side annotations.

**Root cause:** `OCSRow.transfers` stores `MergedPlayer` references (the engine's type boundary), but `computeRejection` was designed for `ScoredPlayer`. The sell object must be a `ScoredPlayer` for the call to be correct, or `computeRejection` must be narrowed to use only `MergedPlayer` fields.

**Fix option A — widen OCSRow.transfers to ScoredPlayer (preferred):**
```typescript
// src/lib/opportunity-cost.ts line 27
transfers?: Array<{ sell: ScoredPlayer; buy: ScoredPlayer }>
```
This requires importing `ScoredPlayer` in `opportunity-cost.ts` and ensuring the call sites (`computeOpportunityCostRows`) receive `ScoredPlayer` objects from `suggestTransfers`. Since `suggestTransfers` already operates on `ScoredPlayer[]`, the transfer objects it emits are `ScoredPlayer` at runtime — the type just needs to reflect that.

**Fix option B — guard at call site:**
```typescript
// OpportunityCostTable.tsx line 115 — look up the full ScoredPlayer from allPlayers
const sellPlayer = allPlayers.find(p => p.id === t.sell.id) ?? (t.sell as unknown as ScoredPlayer)
const { reasons: sellReasons } = computeRejection(sellPlayer, allPlayers, lifecycleLabels)
```
Option B avoids changing the library type but adds an O(n) lookup per transfer leg per render.

---

### CR-02: `derivedFtCount` in `DecisionSummaryTab` always returns `1` for unauthenticated users — diverges from `TransferPanel`

**File:** `src/components/squad/DecisionSummaryTab.tsx:219-224`

**Issue:** `TransferPanel.tsx` (lines 103-112) reads the manual `freeTransfers` input when unauthenticated:
```typescript
if (!isAuthenticated || !myTeamData) {
  return (freeTransfers >= 2 ? 2 : 1) as 1 | 2
}
```
`DecisionSummaryTab.tsx` has a comment "verbatim from TransferPanel.tsx lines 87-92" but the copy is from a **stale revision** — it hard-codes `return 1` for the unauthenticated path:
```typescript
if (!isAuthenticated || !myTeamData) return 1
```
`DecisionSummaryTab` has no `freeTransfers` state and no corresponding input. The result: unauthenticated users who have two free transfers see `1 FT (default)` copy and the OCS table is computed with `ftCount=1`, suppressing the free combo row and incorrectly showing hit rows. This also means the sub-label "Using 1 free transfer (default)" always appears even for managers who deliberately have 2 FTs.

The comment on line 218 ("verbatim from TransferPanel.tsx lines 87-92") is actively misleading — it documented the old version and the copy was never updated to match the current version.

**Fix:** Either add a `freeTransfers` prop/state to `DecisionSummaryTab` mirroring `TransferPanel`, or accept that the Decision Summary tab always operates in 1-FT mode and remove the misleading comment + update the sub-label copy accordingly:

```typescript
// Option A: add freeTransfers state + input (mirrors TransferPanel)
const [freeTransfers, setFreeTransfers] = useState<number>(1)
const derivedFtCount: 1 | 2 = useMemo(() => {
  if (!isAuthenticated || !myTeamData) {
    return (freeTransfers >= 2 ? 2 : 1) as 1 | 2
  }
  const chip = squadData?.active_chip
  if (chip === 'wildcard' || chip === 'freehit') return 1
  return myTeamData.entry_history.event_transfers === 0 ? 2 : 1
}, [isAuthenticated, myTeamData, squadData, freeTransfers])

// Option B: if 1 FT is an intentional design choice for this tab, remove the misleading comment
// and update the sub-label to never say "detected from your team" for FT count:
// "Using 1 free transfer · upgrade on Transfers tab for full options"
```

---

## Warnings

### WR-01: `combo-hit-8` row can never receive `MARGINAL_BADGE` — silently misclassified when near break-even

**File:** `src/components/transfers/OpportunityCostTable.tsx:80`

**Issue:** `badgeFor()` only applies `MARGINAL_BADGE` when `row.kind === 'combo-free' || row.kind === 'combo-hit'`. The `combo-hit-8` kind is excluded. However, `computeOpportunityCostRows` in `opportunity-cost.ts` never sets `isMarginal` on the `combo-hit-8` row (lines 169-184), so even if the guard were widened, it would have no effect without also setting `isMarginal` in the engine.

The inconsistency is: `combo-hit-8` can have an `xPtsGainNet` that is well within the 1.0 xPts marginal band (e.g., `xPtsGain=8.5 → xPtsGainNet=0.5`), but it never gets the "Marginal — verify" badge, giving the user no visual warning that an -8pt hit is barely justifiable. The guard in `badgeFor` and the population of `isMarginal` in the engine need to be consistent.

**Fix:** In `opportunity-cost.ts` (lines 169-184), add `isMarginal` to the `combo-hit-8` row and extend `badgeFor` to cover it:
```typescript
// opportunity-cost.ts — combo-hit-8 block
rows.push({
  kind: 'combo-hit-8',
  // ...
  isMarginal: (comboForHit8.xPtsGain - 8) < MARGINAL_THRESHOLD,
  // ...
})

// OpportunityCostTable.tsx — badgeFor
if (
  (row.kind === 'combo-free' || row.kind === 'combo-hit' || row.kind === 'combo-hit-8') &&
  row.isMarginal === true
)
  return MARGINAL_BADGE
```

---

### WR-02: `proseRefreshPayload` sends `xPtsGain` (gross) instead of `xPtsGainNet` (after hit cost) as `delta`

**File:** `src/components/squad/DecisionSummaryTab.tsx:335`

**Issue:** The `transfer.delta` field in `proseRefreshPayload` is populated with `topRow.xPtsGain` — the gross expected gain before deducting any hit cost. For a hit row (e.g., `single-hit` or `combo-hit`), this overstates the benefit by 4 pts (or 8 pts for `combo-hit-8`). The LLM prose summary will describe the transfer as being worth more than it actually is net-of-penalty.

The first non-roll row found by `ocsRows.find(r => r.transfers && r.transfers.length > 0)` will be `single-free` when a free transfer exists, which is harmless (gross == net). But if `ocsRows` only contains hit rows (no free transfer available), the delta will include the phantom hit-cost gain.

**Fix:**
```typescript
delta: topRow.xPtsGainNet,  // line 335 — use net gain after hit deduction
```

---

### WR-03: Column-header tests in the first `describe` block render without `QueryClientProvider` — fragile isolation

**File:** `src/components/transfers/OpportunityCostTable.test.tsx:103-151`

**Issue:** Tests in the first `describe` block use bare `render(...)` without the `withQueryClient` wrapper. This works currently because `makeRollRow()` produces a `roll` row, and `PlayerMoveCell` short-circuits on `row.kind === 'roll'`, never invoking downstream hooks. However, if `OpportunityCostTable` gains a hook at the top level (not inside `PlayerMoveCell`), these tests will break with `No QueryClient set`. The WHY-01 tests correctly use `withQueryClient` — the header tests should match.

**Fix:** Wrap all renders in the first `describe` with `withQueryClient`:
```typescript
it('renders "xPts Gain (Next 1 GW)" in horizon mode with horizon=1 (singular)', () => {
  const { container } = withQueryClient(
    <OpportunityCostTable rows={[makeRollRow()]} horizon={1} allPlayers={[]} lifecycleLabels={new Map()} />
  )
  // ...
})
```

---

## Info

### IN-01: Duplicate `transition` Tailwind class on Load Squad button in `DecisionSummaryTab`

**File:** `src/components/squad/DecisionSummaryTab.tsx:481`

**Issue:** The `className` string contains both `transition-colors` and `transition-transform`, which is redundant. Only the last one (`transition-transform`) will take effect for any property that both classes attempt to control. The corresponding button in `TransferPanel.tsx` (line 286) only uses `transition`, the base class.

**Fix:** Replace with the single base `transition` class consistent with `TransferPanel`:
```tsx
className="... transition cursor-pointer active:scale-95 w-full sm:w-auto"
```

---

### IN-02: `makeRollRow()` in test file uses `as unknown as OCSRow` cast that masks missing required fields

**File:** `src/components/transfers/OpportunityCostTable.test.tsx:18-31`

**Issue:** `makeRollRow()` omits the `isMarginal` field (which is optional and fine) but also casts with `as unknown as OCSRow`. If `OCSRow` gains new required fields, this cast will silently suppress the type error in tests, meaning factory functions won't fail to compile even when they should. `makeSingleFreeRow` (line 72) and `makeComboFreeRow` (line 87) have the same pattern. The cast is used in at least 6 test render calls.

**Fix:** Define factory returns with explicit type annotations instead of blanket casts, or at minimum use `satisfies OCSRow` to retain type checking while allowing inference:
```typescript
function makeRollRow(): OCSRow {
  return {
    kind: 'roll',
    label: 'Roll FT',
    // ...all required fields explicitly
  }  // no cast — if OCSRow adds a required field, this will fail to compile
}
```

---

_Reviewed: 2026-05-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
