# Phase 112: Optimiser On-Demand & Transfer Suggestion Cap (v1.20) - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Two Squad sub-tab UX fixes with zero engine changes:
- **OPT-01:** Gate the lineup optimiser behind an explicit "Optimise Lineup" button click — no auto-calculation on tab mount. All downstream wiring (comparison table, headline row, chip toggle, transfer suggestions) functions identically once the user has clicked.
- **TFR-02:** Cap transfer suggestion lists at 3 buy candidates per `element_type` (GK/DEF/MID/FWD), applied post-sort and post-affordability-ordering so the top-3 are the *best* top-3. Applied to both the Transfers sub-tab (`TransferPanel`) and the Optimiser sub-tab's transfer section (`OptimiserPanel`).

</domain>

<decisions>
## Implementation Decisions

### OPT-01 — Optimiser On-Demand

- **D-01:** Controls visible pre-click — the horizon selector (1/3/5 GW), FT count toggle (1/2), and chip mode toggle are rendered and interactive *before* the user clicks "Optimise Lineup". User configures their settings first, then triggers one intentional run.
- **D-02:** Empty state design — a bordered card placeholder (matching existing panel style) appears below the controls, containing the "Optimise Lineup" button centred with a short teaser line (e.g. "Click to calculate the best lineup for your horizon"). This replaces the current auto-computed results area on first load.
- **D-03:** Re-trigger policy — after the user clicks "Optimise Lineup" once and results are shown, any subsequent control change (horizon, FT count, chip mode) auto-recomputes immediately. No second button click required. The button gate only applies to the *initial* computation on tab load.

### TFR-02 — Transfer Suggestion Cap

- **D-04:** Position slot definition — `element_type` (4 buckets: GK=1, DEF=2, MID=3, FWD=4). At most 3 buy candidates per bucket. Not per squad slot.
- **D-05:** Cap application — post-filter utility applied *after* `suggestTransfers` returns, within each component's `useMemo`. Not inside the `suggestTransfers` engine (preserves the engine for planner, route tree, and OCS row logic). A shared `capByPosition(suggestions, 3)` utility function keeps the logic DRY.
- **D-06:** Cap scope — both the Transfers sub-tab (`TransferPanel`, `ocsSuggestions` memo) and the Optimiser sub-tab's Transfer Suggestions section (`OptimiserPanel`, `transferSuggestions` memo) apply the same cap.
- **D-07:** Truncation indicator — subtle muted footnote below each position group that was truncated: "Showing top 3 of N [position] suggestions." Silent (no footnote) when N ≤ 3.

### Claude's Discretion
- Button copy and teaser line wording can be tuned by the planner/executor for tone consistency with the rest of the app (e.g. "Optimise Lineup" vs "Run Optimiser").
- Exact footnote copy and placement within the suggestions list is flexible — fit the existing row style.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §OPT-01, §TFR-02 — requirement text and traceability rows

### Roadmap
- `.planning/ROADMAP.md` Phase 112 section — goal, success criteria, phase notes (includes position-slot clarification and the explicit "no engine changes" constraint)

### Key source files
- `src/components/optimiser/OptimiserPanel.tsx` — OPT-01 target: `useMemo` at line ~247 calls `optimiseLineup` on mount; `transferSuggestions` useMemo at line ~271 calls `suggestTransfers`. Add `hasRun` boolean state; gate the lineup `useMemo` computation; add "Optimise Lineup" button empty state.
- `src/components/transfers/TransferPanel.tsx` — TFR-02 target: `ocsSuggestions` useMemo at line ~122; apply `capByPosition` after `suggestTransfers` call.
- `src/lib/suggest-transfers.ts` — engine (DO NOT MODIFY for TFR-02; understand the `TransferSuggestion` union type and `element_type` field used for bucketing).
- `src/lib/types.ts` — `TransferSuggestion` type (discriminated union: `kind: 'single'` has `.buy.element_type`; `kind: 'combo'` has `.transfers[].buy.element_type`).

### Prior phase context (FIX-02)
- `.planning/phases/111-fixture-heatmap-planner-cross-position-fixes-v1-20/` — Phase 111 added position-lock enforcement in `suggestTransfers`; the `capByPosition` filter is downstream of that and must not conflict.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `OptimiserPanel.tsx` existing states (no-team-id, loading, error, no-squad-data, bgw-critical) — all remain unchanged; the new "ready to optimise" state slots in after the data-ready checks, before the lineup computation guard.
- `GwToggle` / `FtToggle` / `ChipModeToggle` — already rendered before the results block; no repositioning needed for D-01.
- `TransferSuggestion` discriminated union (`kind: 'single' | 'combo'`) — the `capByPosition` utility must handle both kinds (extract `element_type` from `sug.buy` for single; from `sug.transfers[0].buy` for combo, since both legs are position-matched).

### Established Patterns
- `useMemo` gating pattern — adding a `hasRun` state (`useState(false)`) and returning early (`if (!hasRun) return null`) inside the optimiser memo is the minimal change that preserves all downstream wiring while gating the initial computation.
- Bordered card placeholder style — matches existing empty/loading state borders: `rounded border border-zinc-200 dark:border-zinc-700 p-6 text-center`.
- Post-`suggestTransfers` memo filtering — already precedent in `TransferPanel` (high-ownership-absent filter post-OCS at line ~144); same pattern applies for the cap.

### Integration Points
- `OptimiserPanel.tsx`: new `hasRun` state + "Optimise Lineup" button in the results placeholder. `transferSuggestions` memo also needs `capByPosition` applied.
- `TransferPanel.tsx`: `ocsSuggestions` memo gets `capByPosition` applied after `suggestTransfers`.
- New shared utility: `src/lib/cap-transfer-suggestions.ts` (or inline in each memo — planner's call on whether to extract).
- Footnote rendering: within the suggestions list UI in both components, after each position group that was truncated.

</code_context>

<specifics>
## Specific Ideas

- "Deliberate planning surface" is the v1.20 theme — the empty state copy and button should reinforce intentionality, not just add a blocker.
- TFR-02 footnote is only shown when truncation actually occurs (N > 3); no noise when the list is already short.
- The cap applies to the sorted, affordability-ordered list — so "top 3" means the 3 most valuable affordable candidates, not an arbitrary slice.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 112-optimiser-on-demand-transfer-suggestion-cap-v1-20*
*Context gathered: 2026-05-15*
