# Phase 25: Manual Edit Mode - Research

**Researched:** 2026-04-03
**Domain:** React component state management, native `<dialog>` API, planning engine re-entry
**Confidence:** HIGH

## Summary

Phase 25 adds manual overrides to the transfer plan table. Every decision is already locked in CONTEXT.md — the implementation is a pure UI + engine plumbing exercise with no new packages and no algorithm changes. The domain splits into three self-contained problems: (1) a `PlayerPickerModal` component that replicates the `AuthModal` dialog pattern, (2) a `generatePlanFrom` engine entry point that accepts a mid-plan squad state and a reduced horizon, and (3) Immer draft mutations in `PlannerTab` that wire the two together while preserving earlier manual edits.

All patterns required are already present in the codebase. The `AuthModal` supplies the complete `<dialog>` recipe. `generatePlan()` in `planning-engine.ts` is a pure function that accepts a `picks` array and `startingGw` — re-running it from an intermediate squad state is straightforward. The `useImmer` + `updatePlanResult` pattern from `PlannerTab` is the correct mutation vehicle for splicing new steps.

The main complexity is the `originalSteps` field that must be added to `PlanResult`, frozen at generation time, and never touched again. Planners must be careful not to add `originalSteps` to the Immer draft mutations that update step content — only `steps[]` is mutable.

**Primary recommendation:** Implement in two plans — Plan 01 covers the type changes + engine entry point + modal component; Plan 02 wires the callbacks in `PlannerTab` and `TransferPlanTable`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Edit trigger — pencil icon in the In cell**
A small pencil icon appears next to the player name in the In column of each transfer row. Clicking it opens the player picker. Hold rows ("No profitable transfer") do not have an edit control — only rows with a suggested transfer.

**D-02: Picker UI — modal dialog**
Uses the existing `<dialog>` + `showModal()`/`close()` pattern from `AuthModal`. A new `PlayerPickerModal` component opens centered on screen, dismisses with Escape or backdrop click. Shows: position label heading, search input (filters by `web_name`), scrollable list of players sorted by `proj_pts_1gw` descending, filtered to the correct `element_type`.

**D-03: Re-scoring — re-run engine from step X+1**
After a manual pick at step index X:
1. Apply the override to step X (`transfersIn`, `transfersOut` updated)
2. Derive the new squad state after step X
3. Re-run `generatePlan()` from step X+1 to the end of the horizon, using the new squad as starting picks
4. Splice the engine's new steps into `planResult.steps[X+1:]`
5. Earlier steps (0 to X) are untouched

This requires either a `generatePlanFrom(picks, startStep, ...)` entry point, or passing the mid-plan squad state as the starting picks to `generatePlan()` with a reduced horizon.

**D-04: Mode toggle — undo icon in In cell, original stored on PlanResult**
- `PlanResult` gains an `originalSteps: PlanStep[]` field, set at generation time and never mutated
- After a manual edit, the In cell shows `"PlayerName [undo] pencil"` — the undo icon restores `originalSteps[X]`
- Restoring calls the same re-score flow (step D-03) but with the original player
- If the current In player matches `originalSteps[X].transfersIn[0]`, no undo icon is shown (row is in Suggested state)

**D-05: Player picker sort and search**
- List sorted by `proj_pts_1gw` descending
- Search input filters `web_name` case-insensitively
- Players already in the squad excluded from the list
- The currently suggested player (engine's pick) shown at the top, visually highlighted, even if search filters would hide it

**No new packages.** No changes to the planning algorithm.

### Claude's Discretion

- Exact undo icon symbol (undo, back-arrow, x, etc.)
- Modal width, max-height, scroll behaviour
- Whether the search input auto-focuses on modal open
- Exact styling of the "currently suggested" highlight in the picker

### Deferred Ideas (OUT OF SCOPE)

None listed in CONTEXT.md.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAN-04 | User can manually edit the suggested sequence (swap players in/out per GW step) | Fully supported — all patterns exist in the codebase. `AuthModal` supplies the dialog recipe; `generatePlan()` supplies the re-scoring entry point; `useImmer` supplies the mutation pattern. |
</phase_requirements>

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| use-immer | installed (Phase 21) | Immer draft mutations for `planResult` | Already used in `PlannerTab`; pattern is `updatePlanResult(draft => { ... })` |
| React (useState, useRef, useEffect, useCallback) | installed | Modal state, ref to `<dialog>`, event handlers | Standard hooks — same as `AuthModal` |

### No New Packages

CONTEXT.md D-00 is explicit: no new packages. All functionality uses the existing stack.

**Installation:** none required.

**Version verification:** Not applicable — all dependencies are already installed and confirmed working in Phases 21-24.

---

## Architecture Patterns

### Recommended File Layout

```
src/
├── components/
│   └── planner/
│       ├── PlayerPickerModal.tsx    # NEW — dialog component (modal pattern)
│       ├── TransferPlanTable.tsx    # MODIFIED — pencil/undo icons in In cell
│       └── PlannerTab.tsx          # MODIFIED — handleManualEdit + handleRestoreSuggested
├── lib/
│   ├── types.ts                    # MODIFIED — originalSteps on PlanResult
│   └── planning-engine.ts          # MODIFIED — generatePlanFrom() or param extension
```

### Pattern 1: AuthModal Dialog Recipe

**What:** Native `<dialog>` element controlled via `showModal()` / `close()`, with a React `useRef<HTMLDialogElement>`, a `useEffect` to sync the `open` prop, and a backdrop-click handler.

**When to use:** Any modal in this project. Already validated in Phase 20.

**Key details from `AuthModal.tsx`:**
- `dialogRef.current.showModal()` called inside `useEffect([open])`
- `el.addEventListener('close', handleClose)` in a separate `useEffect` captures native Escape dismissal
- Backdrop click: `if (e.target === dialogRef.current) onClose()` — target is the `<dialog>` element itself when the user clicks outside the content box
- The `<dialog>` is always rendered in the DOM (never conditionally), to prevent `showModal()` null-ref on first open
- `dialog::backdrop` styled via `globals.css` CSS rule, not via Tailwind `backdrop:` prefix (Tailwind v4 support unverified)

**Example (PlayerPickerModal signature):**
```typescript
// Modelled on src/components/transfers/AuthModal.tsx
interface PlayerPickerModalProps {
  open: boolean
  position: PositionCode           // filter by element_type
  squadIds: Set<number>            // exclude players already in squad
  suggestedPlayerId: number        // always shown at top, highlighted
  scoredPlayers: ScoredPlayer[]
  onPick: (playerId: number) => void
  onClose: () => void
}
```

### Pattern 2: Immer Draft Mutation for PlanResult

**What:** `useImmer<PlanResult | null>` in `PlannerTab`. Mutations via `updatePlanResult(draft => { ... })`.

**When to use:** Any time a nested field inside `planResult.steps[i]` needs to change. Already used for chip toggles.

**Key constraint:** `originalSteps` must NEVER be mutated via Immer draft. It is set once at generation time and read-only thereafter. Only `draft.steps` is ever modified.

**Example (applying a manual override to step X):**
```typescript
// Inside PlannerTab handleManualEdit(stepIndex: number, newBuyId: number)
updatePlanResult(draft => {
  if (!draft) return
  const step = draft.steps[stepIndex]
  step.transfersIn = [newBuyId]
  // transfersOut, hitCost, scoredTransfers etc. updated by re-score below
})
// Then splice in re-scored steps from X+1 onward
```

### Pattern 3: Re-scoring from a Mid-Plan Squad State

**What:** After a manual edit at step X, reconstruct the squad state as it exists after step X, then call `generatePlan()` with that squad as `picks`, `horizon - (X+1)` as the horizon, and `startingGw + X + 1` as `startingGw`.

**Key insight from `planning-engine.ts`:** `generatePlan()` is a pure function. The `picks` parameter is just `SquadPick[]` (array of `{ element, position, ... }`). The squad state after step X is available from `step.squadAfter` (IDs) and `step.positionsAfter` (ID → position map). These can be reconstructed into `SquadPick[]` objects with enough data to re-run the engine.

**Reconstruction approach:**
```typescript
// squadAfter: number[]  (player IDs after step X)
// positionsAfter: Record<number, number>  (playerID -> position 1-15)
// Convert to SquadPick[] for generatePlan() input
const syntheticPicks: SquadPick[] = squadAfterStepX.map(id => ({
  element: id,
  position: positionsAfterStepX[id],
  multiplier: 1,
  is_captain: false,
  is_vice_captain: false,
}))
```

**FT state propagation:** FT state evolves step-by-step. To re-score from step X+1, the FT state after step X must be passed in. This requires tracking FT state through all prior steps, or deriving it from the existing `steps[0..X]` record (each step stores `freeTransfersAvailable` and `hitCost`, which is sufficient to reconstruct FT state via `computeNextFTState`).

**Bank balance propagation:** Bank after step X can be reconstructed by walking `steps[0..X]`, applying each transfer's sell price minus buy cost. Sell prices for original picks are available from `PlannerTab`'s existing `sellPrices` prop. For subsequently bought players, use `player.now_cost`.

**Recommended entry point:** Add `generatePlanFrom` as a thin wrapper in `planning-engine.ts`:
```typescript
// New export in planning-engine.ts
export function generatePlanFrom(
  picksAfterStep: SquadPick[],
  allPlayers: ScoredPlayer[],
  remainingHorizon: number,        // horizon - (X+1)
  startingGw: number,              // original startingGw + X + 1
  ftStateAfterStep: FTState,
  bankAfterStep: number,
  sellPrices?: Record<number, number>,
): PlanStep[]
```
This is just `generatePlan(...)` returning `result.steps` — no algorithm change, just a convenience signature.

### Pattern 4: originalSteps Immutability

**What:** `PlanResult.originalSteps` is set once when `generatePlan()` returns and never touched again. It serves as the "undo" source for all steps.

**Type change required:**
```typescript
// src/lib/types.ts — PlanResult interface
export interface PlanResult {
  steps: PlanStep[]
  originalSteps: PlanStep[]        // NEW — frozen at generation time, never mutated
  horizon: PlannerHorizon
  startingGw: number
}
```

**Set in PlannerTab:**
```typescript
// handleGeneratePlan in PlannerTab.tsx
const result = generatePlan(...)
updatePlanResult(() => ({
  ...result,
  originalSteps: structuredClone(result.steps),  // deep copy, never referenced again
}))
```

### Pattern 5: TransferPlanTable Callback Props

**What:** `TransferPlanTable` receives two new callbacks alongside the existing `onChipToggle`.

**New props:**
```typescript
interface TransferPlanTableProps {
  planResult: PlanResult
  scoredPlayers: ScoredPlayer[]
  onChipToggle: (stepIndex: number, chip: PlannerChip) => void
  onManualEdit: (stepIndex: number, newBuyId: number) => void    // NEW
  onRestoreSuggested: (stepIndex: number) => void                 // NEW
}
```

**In cell rendering logic:**
- If `hasTransfer`:
  - Always show pencil icon button → opens `PlayerPickerModal`
  - If `step.transfersIn[0] !== originalSteps[i].transfersIn[0]`: show undo icon → calls `onRestoreSuggested(i)`
- If `!hasTransfer` (Hold row): no edit control

### Anti-Patterns to Avoid

- **Mutating originalSteps:** Set it once, never touch it in Immer drafts. If the planner accidentally wraps it in Immer, it loses its reference integrity.
- **Conditional dialog render:** The `PlayerPickerModal` must always be in the DOM (like `AuthModal`), only `open` prop changes. Conditional rendering causes null-ref on `showModal()`.
- **Searching allPlayers instead of scoredPlayers:** The picker list needs `proj_pts_1gw` for sorting. Use `scoredPlayers` (already computed in `PlannerTab`), not raw `playersData`.
- **Showing currently-in-squad players in the picker:** The picker must exclude all players in `squadAfter` of the step being edited — not just the current starting XI. Use `step.squadAfter` as the exclusion set.
- **Re-running full horizon on edit:** Re-score from step X+1, not step 0. Steps 0..X are preserved.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal dialog | Custom div overlay with z-index | Native `<dialog>` + `showModal()` | Focus trapping, Escape handling, backdrop are free. Pattern already in `AuthModal`. |
| Deep clone of originalSteps | JSON.parse/stringify | `structuredClone()` | Already the project standard (see `free-transfer-engine.ts` `snapshotSquad`). Handles all types correctly. |
| FT state reconstruction | Re-derive from scratch | `computeNextFTState()` from `free-transfer-engine.ts` | Already tested, handles wildcard/freehit edge cases. |
| Nested state mutation | Spread + Object.assign | `useImmer` draft mutation | Already installed. Maintains referential equality for unchanged parts. |

**Key insight:** Every utility needed (dialog, deep clone, FT state, Immer) is already in the codebase. This phase is integration work, not new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Squad Exclusion Set Uses Wrong Snapshot
**What goes wrong:** The player picker shows players already in the post-edit squad.
**Why it happens:** Developer uses the initial squad IDs instead of `step.squadAfter` for the exclusion set.
**How to avoid:** Pass `new Set(step.squadAfter)` as the `squadIds` exclusion prop to `PlayerPickerModal`. `squadAfter` reflects the squad after that step's transfer, not the initial squad.
**Warning signs:** Engine picks available as edit candidates; picker lists players already in the plan.

### Pitfall 2: originalSteps Mutated by Immer
**What goes wrong:** Undo functionality breaks after the first edit — undo restores to a previously-edited state, not the original engine suggestion.
**Why it happens:** `originalSteps` lives inside the `PlanResult` Immer draft. If any mutation path touches `draft.originalSteps`, Immer allows it silently.
**How to avoid:** Only ever mutate `draft.steps[i]`, never `draft.originalSteps`. In TypeScript, consider making `originalSteps` `readonly PlanStep[]` to get compile-time protection.
**Warning signs:** Second undo restores to a wrong player; first undo works, subsequent undos do not.

### Pitfall 3: FT State Not Propagated Through Edited Steps
**What goes wrong:** Re-scored steps after the edit have incorrect hit cost calculations.
**Why it happens:** Re-scoring from step X+1 uses the initial FT state instead of the FT state after step X.
**How to avoid:** Walk `steps[0..X]` to derive FT state before calling `generatePlanFrom`. Use `computeNextFTState(ftState.available, step.transfersIn.length, step.chip)` for each step.
**Warning signs:** Free transfers show as 1 when they should be 2; hit cost shown for a free transfer.

### Pitfall 4: Bank Balance Incorrectly Calculated for Re-score
**What goes wrong:** Engine suggests unaffordable players in re-scored steps, or excludes affordable ones.
**Why it happens:** Bank balance after step X is not recalculated when a manual override changes the buy/sell prices.
**How to avoid:** After applying the manual edit to step X, recalculate bank: `bank = bankBalance + sellPrice(out) - now_cost(newIn)`. For steps 1..X, apply each transfer's sell/buy delta. Use `sellPrices` for the original squad players; use `player.now_cost` for players bought in earlier plan steps.
**Warning signs:** Engine suggests players that cost more than the bank; budget-constrained picks become invisible.

### Pitfall 5: Suggested Player Filtered Out of Picker List
**What goes wrong:** The currently-suggested player is not visible in the picker, or appears mid-list after a search.
**Why it happens:** The suggested player passes through the normal `element_type` filter but gets hidden by the search input or is sorted below the fold.
**How to avoid:** Pin the suggested player to the top of the list before applying sort + search. Render it in a visually distinct "Suggested" section above the scrollable list. The search input should not hide it.
**Warning signs:** User searches and the suggested player disappears; no obvious way to revert to suggested pick without closing the modal.

### Pitfall 6: Modal backdrop styled via Tailwind `backdrop:` prefix
**What goes wrong:** The dialog backdrop style is not applied.
**Why it happens:** Tailwind v4 `backdrop:` prefix support is unverified for this project (per Phase 20 decision in STATE.md).
**How to avoid:** Style `dialog::backdrop` in `globals.css` as a plain CSS rule, not via Tailwind. Same approach used by `AuthModal`.

---

## Code Examples

### PlayerPickerModal — dialog wiring (from AuthModal pattern)
```typescript
// Source: src/components/transfers/AuthModal.tsx (verified)
const dialogRef = useRef<HTMLDialogElement>(null)

useEffect(() => {
  const el = dialogRef.current
  if (!el) return
  if (open) {
    if (!el.open) el.showModal()
  } else {
    if (el.open) el.close()
  }
}, [open])

useEffect(() => {
  const el = dialogRef.current
  if (!el) return
  const handleClose = () => onClose()
  el.addEventListener('close', handleClose)
  return () => el.removeEventListener('close', handleClose)
}, [onClose])

const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
  if (e.target === dialogRef.current) onClose()
}

return (
  <dialog ref={dialogRef} onClick={handleDialogClick} className="...">
    {/* content */}
  </dialog>
)
```

### Deriving squad picks from squadAfter + positionsAfter
```typescript
// Reconstruct SquadPick[] from PlanStep snapshot for re-scoring
function squadPicksFromStep(step: PlanStep): SquadPick[] {
  return step.squadAfter.map(id => ({
    element: id,
    position: step.positionsAfter[id],
    multiplier: 1,
    is_captain: false,
    is_vice_captain: false,
  }))
}
```

### FT state derivation through prior steps
```typescript
// Derive FT state after step X by replaying steps 0..X
function ftStateAfterStep(
  steps: PlanStep[],
  upToIndex: number,
  initialFT: FTState
): FTState {
  let ft = { ...initialFT }
  for (let i = 0; i <= upToIndex; i++) {
    ft = computeNextFTState(ft.available, steps[i].transfersIn.length, steps[i].chip)
  }
  return ft
}
```

### Picker list construction with pinned suggested player
```typescript
// Build picker list: suggested pinned at top, rest sorted by proj_pts_1gw
function buildPickerList(
  scoredPlayers: ScoredPlayer[],
  position: PositionCode,
  squadIds: Set<number>,
  suggestedId: number,
  search: string,
): { pinned: ScoredPlayer; rest: ScoredPlayer[] } {
  const lc = search.toLowerCase()
  const pool = scoredPlayers
    .filter(p => p.element_type === position && !squadIds.has(p.id) && p.id !== suggestedId)
    .filter(p => !lc || p.web_name.toLowerCase().includes(lc))
    .sort((a, b) => b.proj_pts_1gw - a.proj_pts_1gw)
  const pinned = scoredPlayers.find(p => p.id === suggestedId)!
  return { pinned, rest: pool }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom overlay divs | Native `<dialog>` + `showModal()` | Phase 20 (AuthModal) | Free focus trap, Escape key, backdrop — no library needed |
| useState for nested plan mutations | useImmer | Phase 23 | Enables safe nested mutation without spreading |

**No deprecated patterns relevant to this phase.**

---

## Open Questions

1. **Bank balance tracking through prior steps**
   - What we know: `PlannerTab` has `bankBalance` (initial). Each step's sell price and buy cost can be derived from player data.
   - What's unclear: For players bought in earlier plan steps (steps 0..X-1), their sell price is their `now_cost` at plan generation time, not the `sellPrices` map (which only covers the original squad). This is a minor edge case — price changes mid-plan are not modelled.
   - Recommendation: Use `playerMap.get(id)?.now_cost` for any player not in the original `sellPrices` map. Document the approximation.

2. **Hold rows and manual edits**
   - What we know: CONTEXT.md D-01 says hold rows have no edit control.
   - What's unclear: Can a user force a transfer in a hold step (override the "no profitable transfer" decision)?
   - Recommendation: Honour D-01 strictly — no edit control on hold rows. If the user wants to force a transfer in a hold GW, that is out of scope for Phase 25.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 25 is pure client-side UI + pure function changes. No external dependencies, no CLI tools, no databases. All required packages are already installed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (or package.json `"test": "vitest run"`) |
| Quick run command | `npx vitest run src/lib/planning-engine` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-04 | `generatePlanFrom` returns correct steps from mid-plan squad state | unit | `npx vitest run src/lib/planning-engine` | No — Wave 0 gap |
| PLAN-04 | FT state correctly propagated through prior steps in re-score | unit | `npx vitest run src/lib/planning-engine` | No — Wave 0 gap |
| PLAN-04 | `originalSteps` on `PlanResult` is not mutated by Immer draft operations | unit | `npx vitest run src/lib/planning-engine` | No — Wave 0 gap |
| PLAN-04 | Picker list excludes squad members and pins suggested player above search results | unit | `npx vitest run src/components/planner` | No — Wave 0 gap |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/planning-engine`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/planning-engine.test.ts` — covers `generatePlanFrom` re-scoring correctness, FT state propagation, bank balance derivation
- [ ] `src/components/planner/PlayerPickerModal.test.tsx` (optional, lower priority) — covers picker list construction logic if extracted to a pure helper

*(Existing `src/lib/squad-adapter.test.ts` and `src/components/gem-table/GwToggle.test.ts` are unaffected.)*

---

## Sources

### Primary (HIGH confidence)
- `src/components/transfers/AuthModal.tsx` — complete `<dialog>` pattern, backdrop click, Escape sync
- `src/lib/types.ts` — `PlanResult`, `PlanStep`, `GWStep` interfaces; confirmed `originalSteps` not yet present
- `src/lib/planning-engine.ts` — `generatePlan()` signature, pure function, all inputs verified
- `src/components/planner/PlannerTab.tsx` — `useImmer`, `updatePlanResult` pattern, `handleChipToggle` precedent
- `src/components/planner/TransferPlanTable.tsx` — current In cell rendering, callback prop pattern
- `src/lib/free-transfer-engine.ts` — `computeNextFTState`, `computeHitCost`, `snapshotSquad`
- `src/lib/squad-adapter.ts` — `SquadPick` shape (element, position, multiplier, is_captain, is_vice_captain)
- `.planning/phases/25-manual-edit-mode/25-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Phase 20 decision: `dialog::backdrop` styled via globals.css, not Tailwind prefix
- `package.json` — confirmed vitest 4.1.2, no relevant missing packages

### Tertiary (LOW confidence)
- None — all findings verified against source code.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against package.json and codebase
- Architecture: HIGH — verified against existing component code (AuthModal, PlannerTab, TransferPlanTable)
- Pitfalls: HIGH — derived from direct code inspection and Phase 20/23/24 decisions in STATE.md
- Re-scoring engine: HIGH — generatePlan is a pure function; all inputs/outputs verified from source

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable domain — no external dependencies)
