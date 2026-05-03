---
phase: 056-ft-engine-fix
fixed_at: 2026-05-03T00:00:00Z
review_path: .planning/phases/056-ft-engine-fix/056-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 056: Code Review Fix Report

**Fixed at:** 2026-05-03T00:00:00Z
**Source review:** .planning/phases/056-ft-engine-fix/056-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (2 Critical, 4 Warning)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: `handleManualEdit` silently corrupts state when editing a no-transfer step

**Files modified:** `src/components/planner/PlannerTab.tsx`
**Commit:** d1acd9a
**Applied fix:** Added early-return guard immediately after reading `planResult.steps[stepIndex]`: if `step.transfersIn.length === 0 || step.transfersOut.length === 0` the function returns without attempting the transfer swap. This prevents `origBuyId` and `oldSellId` from being `undefined`, which was the root cause of the squad corruption, wrong bank calculation, and corrupted downstream re-score.

### CR-02: `ScoredTransfer.hitCost` is always 0 — stored value is misleading and wrong for multi-transfer contexts

**Files modified:** `src/lib/planning-engine.ts`
**Commit:** 659525d
**Applied fix:** Hoisted the hit-cost computation out of the per-candidate inner loop. Before the loop, `transferNumber = 1` is declared (documenting that the greedy engine takes exactly 1 transfer per GW) and `stepCandidateHitCost = computeHitCost(currentFT.available, transferNumber, null)` is computed once. Inside the loop, `hitCost` is assigned from `stepCandidateHitCost` rather than recomputing on every iteration. This makes the intent explicit and removes the redundant per-candidate recomputation.

### WR-01: `handleManualEdit` does not update `draftStep.hitCost` in the Immer mutation

**Files modified:** `src/components/planner/PlannerTab.tsx`
**Commit:** 3e94186
**Applied fix:** Added `draftStep.hitCost = computeHitCost(draftStep.freeTransfersAvailable, 1, null)` to the Immer mutation block, alongside the existing `transfersIn`, `squadAfter`, and `positionsAfter` updates. Also added `computeHitCost` to the import from `@/lib/free-transfer-engine` (it was not previously imported in `PlannerTab.tsx`).

### WR-02: `computeNextFTState` produces invalid `FTState` when `currentAvailable < 1`

**Files modified:** `src/lib/free-transfer-engine.ts`
**Commit:** 1d3fe69
**Applied fix:** Applied Option B from the review: added `Math.max(0, ...)` defensive floor to the `banked` computation in both the `wildcard` and `freehit` branches. Changed `Math.min(1, currentAvailable - 1)` to `Math.min(1, Math.max(0, currentAvailable - 1))`. All existing test assertions continue to hold (verified manually for `available = 1` and `available = 2` inputs).

### WR-03: `startingGw` derivation can silently return `null` for BGW first-player

**Files modified:** `src/components/planner/PlannerTab.tsx`
**Commit:** fb3361f
**Applied fix:** Replaced the single-player `scoredPlayers[0]?.fixtures[0]?.event_id ?? null` derivation with an IIFE that collects all `event_id` values across all players via `flatMap` and returns `Math.min(...ids)` (or `null` if the array is empty). This ensures the starting GW is the earliest fixture across the entire player pool, correctly handling BGW scenarios where the first player in the array has no fixture this week.

### WR-04: `handleRestoreSuggested` calls `handleManualEdit` without checking whether current step has a transfer

**Files modified:** `src/components/planner/PlannerTab.tsx`
**Commit:** 9112bee
**Applied fix:** Added an explicit check for the *current* step after the existing guard on the original step: `if (currentStep.transfersOut.length === 0) return`. This prevents `handleManualEdit` from being called when the current step has no sell slot, which would have triggered the CR-01 corruption path even after the primary guard was added inside `handleManualEdit`.

---

_Fixed: 2026-05-03T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
