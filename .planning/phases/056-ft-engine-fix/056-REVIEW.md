---
phase: 056-ft-engine-fix
reviewed: 2026-05-03T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/planner/PlannerTab.tsx
  - src/lib/free-transfer-engine.ts
  - src/lib/planning-engine.ts
  - tests/lib/free-transfer-engine.test.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 056: Code Review Report

**Reviewed:** 2026-05-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four files reviewed: the free-transfer engine, the planning engine, the PlannerTab component, and the engine test suite.

`free-transfer-engine.ts` is internally correct and well-tested. The FT state transitions, hit-cost arithmetic, and wildcard/free-hit pass-through logic all hold up. The tests are comprehensive and cover the key sequences from CONTEXT.md.

The critical problems are in `PlannerTab.tsx`. `handleManualEdit` is called with a `stepIndex` that may point to a no-transfer step (when the engine decided no profitable transfer existed). In that case `step.transfersIn[0]` and `step.transfersOut[0]` are both `undefined`, causing silent data corruption throughout the function: the new player is never inserted into the squad, the bank calculation uses `undefined` as a player ID yielding a wrong balance, and the downstream re-score runs on a corrupted state. This is a BLOCKER.

`planning-engine.ts` contains a correctness bug in the `generatePlan` scoring loop: the hit-cost baked into each scored transfer's `netGain` is computed as if only 1 transfer is made per GW, but this is evaluated once per candidate pair. The value is correct for the final selected transfer — but the `hitCost` value stored on `ScoredTransfer` records for transfers beyond the first one in a potential multi-transfer scenario would be understated. More critically, the engine's decision threshold of `netGain > 0` means a transfer that would genuinely be a hit (-4 pts) can be selected if `totalScore > 0` but `totalScore < 4` — the hit cost is never factored into the threshold check because `computeHitCost(available, 1, null)` always returns 0 for a single transfer (1 ≤ available which is always at least 1). This makes the stored `hitCost` on `ScoredTransfer` records always 0, even though the step-level `stepHitCost` at line 182 is computed separately and correctly. The disconnect means the `scoredTransfers` display in the UI will show `hitCost: 0` for every candidate even when the engine has consumed its free transfer and a second transfer would be a hit.

---

## Critical Issues

### CR-01: `handleManualEdit` silently corrupts state when editing a no-transfer step

**File:** `src/components/planner/PlannerTab.tsx:93-117`

**Issue:** `handleManualEdit` unconditionally reads `step.transfersIn[0]` and `step.transfersOut[0]` at lines 93–94 without checking whether the step had any transfers. When the planning engine finds no profitable transfer for a GW, it sets `transfersIn = []` and `transfersOut = []`. In this state:

- `origBuyId` and `oldSellId` are both `undefined`
- Line 97: `step.squadAfter.map(id => id === undefined ? newBuyId : id)` — no match, `newBuyId` is never inserted into `newSquadAfter`
- Line 99: `newPositionsAfter[undefined]` returns `undefined`, so the position block is skipped — `newBuyId` has no position in the resulting map
- Line 106: `sellPrices?.[undefined]` and `playerMap.get(undefined)` both return `undefined`, so `sellPrice = 0` — bank is corrupted by the full buy cost being subtracted with no sell proceeds
- Line 117: `bankAfterStepX` is wrong
- `generatePlanFrom` then re-scores downstream GWs with both a wrong squad (missing `newBuyId`) and a wrong bank

The function can be called on a no-transfer step through `handleRestoreSuggested` (which calls `handleManualEdit`) and potentially directly from the UI if the TransferPlanTable exposes an edit affordance for every step regardless of whether a transfer exists.

**Fix:**
```typescript
function handleManualEdit(stepIndex: number, newBuyId: number) {
  if (!planResult || !startingGw) return
  const step = planResult.steps[stepIndex]

  // Guard: can only manually edit a step that has exactly one transfer
  if (step.transfersIn.length === 0 || step.transfersOut.length === 0) return

  const origBuyId = step.transfersIn[0]
  const oldSellId = step.transfersOut[0]
  // ... rest of function unchanged
}
```

### CR-02: `ScoredTransfer.hitCost` is always 0 — stored value is misleading and wrong for multi-transfer contexts

**File:** `src/lib/planning-engine.ts:129`

**Issue:** At line 129, the hit cost baked into every scored transfer record is:

```typescript
const hitCost = computeHitCost(currentFT.available, 1, null)
```

`computeHitCost(available, 1, null)` always returns 0 because `available` is at minimum 1 (the starting state), so `hits = max(0, 1 - available) = 0`. This means every `ScoredTransfer` record stored in `scoredTransfers` carries `hitCost: 0` and `netGain === totalScore`.

The correct hit cost for a scored transfer depends on whether it would be the *Nth* transfer in the GW (for a multi-transfer step). Even for a single-transfer-per-GW engine, this value will be wrong in any future extension where the engine considers a second transfer in the same GW (it would still compute `computeHitCost(available, 1, ...)` rather than `computeHitCost(available, 2, ...)`).

More immediately, the `ScoredTransfer` type documents `hitCost: number  // 0 or -4` in the type definition, and the UI presumably uses this field to display the cost of each candidate. Showing `hitCost: 0` on every candidate is misleading when the step's actual `stepHitCost` (computed correctly at line 182) is non-zero.

**Fix:** Remove `hitCost` from the per-candidate scoring loop and instead derive it from the step's transfer count when building the `PlanStep` record. If `hitCost` must remain on `ScoredTransfer` for UI display, pass the step-level transfer count rather than hardcoding `1`:

```typescript
// Before the candidate loop, compute what transferN this would be (0-indexed):
// For a greedy single-transfer engine this is always the first (and only) transfer.
const transferNumber = 1  // engine only ever takes 1 transfer per GW

// Inside the loop:
const hitCost = computeHitCost(currentFT.available, transferNumber, null)
const netGain = totalScore + hitCost
```

The deeper fix is to remove `hitCost` from `ScoredTransfer` entirely and derive it in the UI from `step.freeTransfersAvailable` and the transfer's position in the list.

---

## Warnings

### WR-01: `handleManualEdit` does not update `draftStep.hitCost` in the Immer mutation

**File:** `src/components/planner/PlannerTab.tsx:141-149`

**Issue:** The Immer mutation at lines 141–149 updates `transfersIn`, `squadAfter`, and `positionsAfter` but does not update `draftStep.hitCost`. For a single-transfer edit the hit cost doesn't change (same number of transfers against the same `freeTransfersAvailable`), but if the UI ever enables replacing a no-transfer step with a transfer step (or vice versa), the stored `hitCost` would be stale. This is currently consistent with the guarded case, but should be explicit.

**Fix:**
```typescript
updatePlanResult(draft => {
  if (!draft) return
  const draftStep = draft.steps[stepIndex]
  draftStep.transfersIn = [newBuyId]
  draftStep.hitCost = computeHitCost(draftStep.freeTransfersAvailable, 1, null)  // re-derive
  draftStep.squadAfter = newSquadAfter
  draftStep.positionsAfter = newPositionsAfter
  draft.steps.splice(stepIndex + 1, draft.steps.length - stepIndex - 1, ...newStepsFromXPlus1)
})
```

### WR-02: `computeNextFTState` produces invalid `FTState` when `currentAvailable < 1`

**File:** `src/lib/free-transfer-engine.ts:9-18`

**Issue:** For the `wildcard` and `freehit` branches:

```typescript
const banked = Math.min(1, currentAvailable - 1)
const nextAvailable = 1 + banked
```

If `currentAvailable` is 0 (not currently prevented by types — `FTState.available` is typed as `number`, not `1 | 2`), then `banked = -1` and `nextAvailable = 0`. This propagates invalid FT state through the entire plan.

The same issue exists in the normal-GW branch (`unused = max(0, 0 - 0) = 0`, `banked = 0`, `nextAvailable = 1`) — which accidentally recovers — but the WC/FH branch does not recover.

**Fix:** Either tighten the `FTState` type or add a defensive floor:

```typescript
// Option A: tighten the type
export interface FTState {
  available: 1 | 2
  banked: 0 | 1
}

// Option B: defensive floor in the function
const banked = Math.min(1, Math.max(0, currentAvailable - 1))
```

### WR-03: `startingGw` derivation can silently return `null` for BGW first-player

**File:** `src/components/planner/PlannerTab.tsx:44`

**Issue:**

```typescript
const startingGw = scoredPlayers[0]?.fixtures[0]?.event_id ?? null
```

This derives the starting GW from the *first* fixture of the *first* player in the scored array. If that player happens to have a blank gameweek (no fixtures for the current GW), `fixtures[0].event_id` will be the *next* gameweek, causing the plan to start one GW late. Alternatively, if `fixtures` is empty for the first player, `startingGw` is `null` and plan generation is blocked entirely even when other players have fixture data.

**Fix:** Compute the minimum `event_id` across all players:

```typescript
const startingGw = scoredPlayers.length > 0
  ? Math.min(...scoredPlayers.flatMap(p => p.fixtures.map(f => f.event_id)).filter(Boolean))
  : null
// Or guard against Infinity:
const startingGw = (() => {
  const ids = scoredPlayers.flatMap(p => p.fixtures.map(f => f.event_id))
  return ids.length > 0 ? Math.min(...ids) : null
})()
```

### WR-04: `handleRestoreSuggested` calls `handleManualEdit` without checking whether the original step had a transfer

**File:** `src/components/planner/PlannerTab.tsx:152-157`

**Issue:**

```typescript
function handleRestoreSuggested(stepIndex: number) {
  if (!planResult) return
  const originalBuyId = planResult.originalSteps[stepIndex]?.transfersIn[0]
  if (originalBuyId === undefined) return
  handleManualEdit(stepIndex, originalBuyId)
}
```

The guard `if (originalBuyId === undefined) return` correctly skips the call when the *original* step had no transfer. However, the *current* step at `stepIndex` could now have a transfer (e.g., after a manual edit that introduced a transfer to a previously-empty step — though the current UI likely doesn't support this). More importantly, after the guard passes, `handleManualEdit` is called which then reads the *current* step's `transfersOut[0]`. If the current step's `transfersOut` is empty (because it was a no-transfer step that was not edited at the sell level), CR-01 is triggered. The guard here protects only one path.

This is secondary to CR-01: fixing CR-01 with the guard inside `handleManualEdit` is the correct primary fix, but `handleRestoreSuggested` also needs to check the *current* step:

```typescript
function handleRestoreSuggested(stepIndex: number) {
  if (!planResult) return
  const originalBuyId = planResult.originalSteps[stepIndex]?.transfersIn[0]
  if (originalBuyId === undefined) return
  const currentStep = planResult.steps[stepIndex]
  if (currentStep.transfersOut.length === 0) return  // no sell to restore against
  handleManualEdit(stepIndex, originalBuyId)
}
```

---

## Info

### IN-01: Redundant `playerMap` construction in `handleChipToggle` for BB/3xc branch

**File:** `src/components/planner/PlannerTab.tsx:167`

**Issue:** A `playerMap` is constructed at line 167 inside the `bboost`/`3xc` branch and again at line 195 for the WC/FH path. These two maps are constructed from the same `scoredPlayers` array. The function could compute the map once at the top.

**Fix:** Move `const playerMap = new Map(scoredPlayers.map(p => [p.id, p]))` to the top of `handleChipToggle`, before the chip-type branch.

### IN-02: `generateChipStep` has no upper limit on candidate sort+slice per iteration

**File:** `src/lib/planning-engine.ts:269-272`

**Issue:** Inside the `generateChipStep` loop (one iteration per transfer, up to `maxTransfers = 3`), the candidate pool is re-computed from scratch each iteration:

```typescript
const candidates = allPlayers
  .filter(...)
  .sort(...)
  .slice(0, CANDIDATES_PER_POSITION)
```

This differs from `generatePlan` which pre-computes `candidatePoolByPosition` outside the GW loop. For `generateChipStep`, the per-transfer rebuild is necessary because `squadSet` changes after each selection. However, the full `allPlayers.filter().sort()` runs against the entire player list on each of the (up to 3) iterations × (up to 11) selling candidates = up to 33 full sorts. With a realistic player count (~600), this is a bounded operation but is worth noting as a future optimisation target.

This is informational only — correctness is unaffected.

---

_Reviewed: 2026-05-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
