---
phase: 074-transfer-engine-overhaul
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/components/squad/DecisionSummaryTab.tsx
  - src/components/transfers/OpportunityCostTable.tsx
  - src/components/transfers/TransferPanel.tsx
  - src/lib/__tests__/opportunity-cost.test.ts
  - src/lib/opportunity-cost.test.ts
  - src/lib/opportunity-cost.ts
  - src/lib/suggest-transfers.test.ts
  - src/lib/suggest-transfers.ts
  - src/lib/types.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 074: Code Review Report

**Reviewed:** 2026-05-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase delivers the transfer engine overhaul (TFX-01 through TFX-05): team-cap filtering on in-pool candidates, sell-side dedup for 2-FT combos, bank-constraint UI, and the opportunity-cost mapper (`computeOpportunityCostRows`) surfaced in both `TransferPanel` and `DecisionSummaryTab`.

The engine logic in `suggest-transfers.ts` is structurally sound. Two **blockers** were found: the `-8 Hit` row is silently omitted when `ftCount=1` (the most common user state), contradicting D-07's design contract; and the "Free transfers" UI control in `TransferPanel` captures user input but the value is discarded — the engine always uses `derivedFtCount` instead. Both are correctness failures visible to users. Four warnings cover an affordability edge case, a memoization gap, a misleading test title, and a redundant inner-loop guard. Three info items flag dead state, a duplicated test file, and a CSS class collision.

---

## Critical Issues

### CR-01: `-8 Hit` row silently absent when `ftCount=1` — contradicts D-07

**File:** `src/lib/opportunity-cost.ts:85-108, 158-180`

**Issue:** The `-8 Hit` (`combo-hit-8`) row is derived from `best2FTCombo`, which is found by searching for `s.kind === 'combo' && s.cost === 0` (line 85-88). However, the engine (`suggest-transfers.ts` line 211) only emits combos with `cost: 0` when `ftCount=2`, and only emits combos with `cost: 4` when `ftCount=1`. When `ftCount=1` (the default for most users), `best2FTCombo` is always `undefined`, so neither the `combo-free` row nor the `combo-hit-8` row is ever pushed. The user never sees the `-8 Hit` option even when it would be actionable. This contradicts the design contract in the file's own comment: "D-07: −8 Hit row is derived from the best cost:0 combo; not emitted by the engine." The engine does not enumerate a cost:0 combo when `ftCount=1`.

**Fix:** The engine should always enumerate the best combo at `cost:0` regardless of `ftCount` (labelled as an "internal reference combo" for mapper use), alongside the cost:4 combo for `ftCount=1`. Alternatively, the mapper can look for `best2FTHit` (cost:4) as the fallback source for deriving the `-8 Hit` row when no cost:0 combo exists:

```typescript
// In computeOpportunityCostRows — after best2FTHit is resolved:
const comboForHit8 = best2FTCombo ?? best2FTHit
if (comboForHit8) {
  const t1 = comboForHit8.transfers[0]
  const t2 = comboForHit8.transfers[1]
  const bankAfter8 =
    bank + sellValueFor(t1.sell) + sellValueFor(t2.sell) - t1.buy.now_cost - t2.buy.now_cost
  rows.push({
    kind: 'combo-hit-8',
    label: '−8 Hit',
    xPtsGain: comboForHit8.xPtsGain,
    xPtsGainNet: comboForHit8.xPtsGain - 8,
    xPtsGainPerGw: comboForHit8.xPtsGainPerGw,
    breakEvenGws:
      comboForHit8.xPtsGainPerGw > 0
        ? Math.max(1, Math.ceil(8 / comboForHit8.xPtsGainPerGw))
        : null,
    cost: 8,
    transfers: [t1, t2],
    bankAfter: bankAfter8,
    isAffordable: bankAfter8 >= 0,
    disabledReason: formatDisabledReason(bankAfter8),
  })
}
```

---

### CR-02: "Free transfers" UI control in `TransferPanel` is dead — value never reaches the engine

**File:** `src/components/transfers/TransferPanel.tsx:40, 213-230, 87-92`

**Issue:** `freeTransfers` state is initialised (line 40), rendered in a labelled `<input>` (lines 213-230), and the user can manipulate it. However, the engine call at line 104 uses `derivedFtCount` (lines 87-92) — not `freeTransfers`. The UI field gives false confidence: a user who cannot authenticate (unauthenticated path) sets "Free transfers" to 2, but the engine still uses the hardcoded default `derivedFtCount = 1` (line 87-91: `if (!isAuthenticated || !myTeamData) return 1`). This is a functional regression from any previous state where the user's manual FT count was honoured. The mismatch means transfer suggestions for unauthenticated users are always computed with `ftCount=1` regardless of what the field shows.

**Fix:** Either (a) wire `freeTransfers` into `derivedFtCount` as the unauthenticated fallback, or (b) remove the UI control entirely and document that FT count is authentication-gated. Option (a) is the minimal fix:

```typescript
const derivedFtCount: 1 | 2 = useMemo(() => {
  if (!isAuthenticated || !myTeamData) {
    // Use the manual input, clamped to 1|2
    return (freeTransfers >= 2 ? 2 : 1) as 1 | 2
  }
  const chip = squadData?.active_chip
  if (chip === 'wildcard' || chip === 'freehit') return 1
  return myTeamData.entry_history.event_transfers === 0 ? 2 : 1
}, [isAuthenticated, myTeamData, squadData, freeTransfers])
```

---

## Warnings

### WR-01: `combo-hit` row `isMarginal` badge silently ignored in `OpportunityCostTable`

**File:** `src/components/transfers/OpportunityCostTable.tsx:70` and `src/lib/opportunity-cost.ts:129`

**Issue:** `computeOpportunityCostRows` sets `isMarginal: true` on the `combo-hit` row (line 129) when `xPtsGain < MARGINAL_THRESHOLD`. However, `badgeFor()` in `OpportunityCostTable` only checks `row.kind === 'combo-free' && row.isMarginal === true` (line 70). A `combo-hit` row with `isMarginal=true` falls through to the default badge with no visual warning, silently hiding a marginal hit suggestion from the user.

**Fix:**
```typescript
function badgeFor(row: OCSRow): BadgeConfig {
  if ((row.kind === 'combo-free' || row.kind === 'combo-hit') && row.isMarginal === true)
    return MARGINAL_BADGE
  return BADGE_BY_KIND[row.kind]
}
```

---

### WR-02: `hasAvailableChip` computed outside `useMemo` despite depending on memoized state

**File:** `src/components/squad/DecisionSummaryTab.tsx:369-370`

**Issue:** `hasAvailableChip` (lines 369-370) is computed inline as a plain variable that reads `usedChips`, which is a `useMemo` result. This value is then passed into the `computeDecisionSeverity` `useMemo` at line 382. Because `hasAvailableChip` is not itself memoized, it is recomputed on every render — including renders triggered by unrelated state changes. More importantly, it could diverge from `usedChips` in a concurrent render scenario where React re-runs the render function but not all memos. While React guarantees `useMemo` output is stable within a render, the inconsistency creates a maintenance hazard.

**Fix:** Wrap in `useMemo`:
```typescript
const hasAvailableChip = useMemo(
  () => !usedChips.has('bboost') || !usedChips.has('3xc') || !usedChips.has('freehit'),
  [usedChips],
)
```

---

### WR-03: `isMarginal` threshold check uses raw `xPtsGain`, not `xPtsGainNet`, for hit rows

**File:** `src/lib/opportunity-cost.ts:129`

**Issue:** For the `combo-hit` row, `isMarginal` is set when `best2FTHit.xPtsGain < MARGINAL_THRESHOLD` (1.0 xPts). But the user-facing `xPtsGainNet` for a hit row is `xPtsGain - 4`. A combo with `xPtsGain = 0.9` is marked marginal (correct), but a combo with `xPtsGain = 4.5` (which the engine does allow — engine only filters `xPtsGain <= 0`) has `xPtsGainNet = 0.5`, which is below the 1.0 threshold but is not flagged as marginal. The marginal flag does not capture the true break-even risk for hit rows.

**Fix:** For hit rows, the marginal check should compare `xPtsGainNet` against the threshold:
```typescript
// combo-hit row:
isMarginal: (best2FTHit.xPtsGain - 4) < MARGINAL_THRESHOLD,
```

---

### WR-04: Redundant inner sell-side dedup guard runs inside the O(n²) buy loop

**File:** `src/lib/suggest-transfers.ts:199`

**Issue:** The sell-side dedup guard `if (sell2.id === sell1.id) continue` appears twice: once at line 189 (correct — between the `j` loop body start and pool lookup) and again at line 199 inside the innermost `buy2` loop. The inner guard at line 199 is unreachable in effect because `sell1` and `sell2` are fixed for the entire inner buy loop — if `sell2.id === sell1.id` was true it would have already `continue`d at line 189. The inner guard is never triggered but executes on every `buy2` iteration (worst case ~30 × 30 = 900 iterations per `(sell1, sell2)` pair). The comment acknowledges it: "redundant inner guard".

**Fix:** Remove line 199:
```typescript
for (const buy2 of pool2) {
  if (buy2.id === buy1.id) continue   // buy-side dedup only
  // sell2.id === sell1.id guard belongs at line 189, not here
  const gain2 = horizonScore(buy2, field) - sell2Pts
```

---

## Info

### IN-01: Duplicate test file for `computeOpportunityCostRows` — divergence risk

**Files:** `src/lib/opportunity-cost.test.ts` and `src/lib/__tests__/opportunity-cost.test.ts`

**Issue:** Two separate test files cover the same function `computeOpportunityCostRows`. Vitest's default `include` pattern picks up both. The files use different `describe` block names so they do not directly conflict, but they have overlapping coverage (e.g., Roll row structure, bankAfter arithmetic, marginal flag). Future changes to `opportunity-cost.ts` require updating tests in two places. `src/lib/opportunity-cost.test.ts` additionally uses `@vitest-environment node` directive while the `__tests__` file uses the jsdom default — meaning the same function is tested in different environments.

**Fix:** Consolidate into one file. The `__tests__/opportunity-cost.test.ts` file (which uses `@/lib/opportunity-cost` alias paths) is likely the older file. Merge unique test cases into `src/lib/opportunity-cost.test.ts` and delete the `__tests__` duplicate.

---

### IN-02: `freeTransfers` state is dead (unreachable effect) — misleads future developers

**File:** `src/components/transfers/TransferPanel.tsx:40, 213-230`

**Issue:** (Related to CR-02 but worth calling out as a code quality issue independently.) Even if CR-02 is resolved by removing the UI control rather than wiring it up, the `freeTransfers` `useState` at line 40 and its setter `setFreeTransfers` at line 228 would become dead code that needs removal. Currently `freeTransfers` is set but never read outside of the input's `value` prop — the comment on line 30 that names it as "local" hints it was always meant to be local, but there is no indication of its disconnection from the engine.

**Fix:** Either wire it (see CR-02 fix) or remove the state declaration and the associated `<input>` control.

---

### IN-03: Duplicate `transition-colors` + `transition-transform` Tailwind classes on Submit button

**File:** `src/components/transfers/TransferPanel.tsx:265`

**Issue:** The "Load Squad" button has both `transition-colors` and `transition-transform` in its `className`. Tailwind CSS generates separate `transition-property` declarations for each; in practice the second declaration overrides the first because they both set `transition-property`. The `active:scale-95` animation (which requires `transition-transform`) will work, but colour-transition on hover may be suppressed in some Tailwind builds.

**Fix:** Use `transition-all` or list both in a single `transition-[transform,colors]` custom class, or rely on `transition` (Tailwind's shorthand that covers both):
```
className="... transition cursor-pointer active:scale-95 ..."
```

---

_Reviewed: 2026-05-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
