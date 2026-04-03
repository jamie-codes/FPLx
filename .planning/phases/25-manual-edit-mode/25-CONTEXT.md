# Phase 25: Manual Edit Mode - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Each transfer row in `TransferPlanTable` gets an edit control (✏ icon in the In cell). Clicking it opens a modal player picker filtered to the correct position, sorted by `proj_pts_1gw`, with a search input. After the user picks a replacement, the engine re-runs from step X+1 with the new squad state. An undo icon in the In cell restores the original suggestion. Earlier manual edits are preserved across re-runs.

No changes to the planning algorithm itself. No new packages.

</domain>

<decisions>
## Implementation Decisions

### D-01: Edit trigger — ✏ icon in the In cell

A small pencil (✏) icon appears next to the player name in the In column of each transfer row. Clicking it opens the player picker. Hold rows ("No profitable transfer") do not have an edit control — only rows with a suggested transfer.

### D-02: Picker UI — modal dialog

Uses the existing `<dialog>` + `showModal()`/`close()` pattern from `AuthModal`. A new `PlayerPickerModal` component opens centered on screen, dismisses with Escape or backdrop click. Shows: position label heading, search input (filters by `web_name`), scrollable list of players sorted by `proj_pts_1gw` descending, filtered to the correct `element_type`.

### D-03: Re-scoring — re-run engine from step X+1

After a manual pick at step index X:
1. Apply the override to step X (`transfersIn`, `transfersOut` updated)
2. Derive the new squad state after step X
3. Re-run `generatePlan()` from step X+1 to the end of the horizon, using the new squad as starting picks
4. Splice the engine's new steps into `planResult.steps[X+1:]`
5. Earlier steps (0 to X) are untouched

This requires either a `generatePlanFrom(picks, startStep, ...)` entry point, or passing the mid-plan squad state as the starting picks to `generatePlan()` with a reduced horizon.

### D-04: Mode toggle — undo icon in In cell, original stored on PlanResult

- `PlanResult` gains an `originalSteps: PlanStep[]` field, set at generation time and never mutated
- After a manual edit, the In cell shows `"PlayerName [↺] ✏"` — the ↺ icon restores `originalSteps[X]`
- Restoring calls the same re-score flow (step D-03) but with the original player
- If the current In player matches `originalSteps[X].transfersIn[0]`, no undo icon is shown (row is in Suggested state)

### D-05: Player picker sort and search

- List sorted by `proj_pts_1gw` descending (most relevant for the next GW)
- Search input filters `web_name` case-insensitively
- Players already in the squad excluded from the list
- The currently suggested player (engine's pick) shown at the top, visually highlighted, even if search filters would hide it

### Claude's Discretion

- Exact undo/undo icon symbol (↺, ↩, ×, etc.)
- Modal width, max-height, scroll behaviour
- Whether the search input auto-focuses on modal open
- Exact styling of the "currently suggested" highlight in the picker

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` — PLAN-04 (manual edit of suggested sequence)
- `.planning/ROADMAP.md` §Phase 25 — goal and all 4 success criteria

### Existing code to read before implementing
- `src/components/transfers/AuthModal.tsx` — `<dialog>` + `showModal()`/`close()` pattern, backdrop click handler, `useRef<HTMLDialogElement>` — replicate this exact approach in `PlayerPickerModal`
- `src/lib/types.ts` — `PlanResult`, `PlanStep` interfaces — `originalSteps` must be added to `PlanResult`; understand `transfersIn`, `transfersOut`, `squadAfter`, `positionsAfter`
- `src/lib/planning-engine.ts` — `generatePlan()` signature and internals — understand how to call it with a mid-plan squad state and reduced horizon for re-scoring
- `src/components/planner/PlannerTab.tsx` — `useImmer` + `updatePlanResult` pattern — manual edits use the same Immer draft mutation approach
- `src/components/planner/TransferPlanTable.tsx` — current In cell rendering — ✏ icon and ↺ icon slot in here; `onManualEdit` and `onRestoreSuggested` callbacks needed
- `src/components/squad/SquadView.tsx` — position group constants (`POSITION_LABELS`) for picker heading

</canonical_refs>
