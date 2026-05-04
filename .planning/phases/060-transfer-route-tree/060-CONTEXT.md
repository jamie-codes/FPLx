# Phase 60: Transfer Route Tree - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a "Route Tree" sub-tab to the Plan section. A pure-TypeScript engine generates 2–3 branching transfer paths — each starting from a different sell-player root with greedy continuation per branch — and presents them in a side-by-side summary table. The highest net-xPts path is highlighted. Each path is expandable to a GW-by-GW breakdown. A "Load into Manual Planner" button bridges any path into the Phase 59 Manual Plan sub-tab for manual refinement.

No LLM involvement. No new data sources. The tree runs entirely on existing squad, xPts, and FT-engine data.

</domain>

<decisions>
## Implementation Decisions

### Greedy Algorithm
- **D-01:** Per-GW rule: **0 or 1 transfer per step, skip if no positive xPts gain.** Each step checks for the best available position-matched transfer; if no player improves xPts over the current squad member, the step is a hold (no transfer). FTs bank when held.
- **D-02:** FT banking: use `computeNextFTState` from `free-transfer-engine.ts` exactly as-is. A held GW banks the unused FT (up to 2 available max). The same engine used by Phase 59 is reused without modification.
- **D-03:** Sell roots: the **3 squad players with the lowest `xPts_1gw`** across all 15 picks (regardless of position). Each root becomes the player sold in GW1 of its branch. Position-matched replacement (the best available buy for that position) is applied immediately as the root transfer.
- **D-04:** When 2 FTs are available in a GW: make 2 transfers **only if both individually produce a positive xPts gain**. The second transfer is not forced just because the FT is free. Both transfers are position-matched and budget-checked independently.

### Route Tree Placement
- **D-05:** New Plan sub-tab: id `'route-tree'`, label `'Route Tree'`, mobileLabel `'Routes'`. Inserted **after `'manual-plan'`** in the Plan section's `subTabs` array.
- **D-06:** Sub-tab order: `Planner | Manual Plan | Route Tree | Club Form | Value Gems | Rivals`.
- **D-07:** Horizon state: **shared with the section-level `HorizonSelector`** in `page.tsx` (same prop passed down from the Plan section header). Changing the horizon in any Plan sub-tab affects all of them including Route Tree (TRT-07 recalculation is automatic — same state re-triggers useMemo).

### Bridge Behavior (TRT-05)
- **D-08:** If the existing `fplx_manual_plan` localStorage has **any steps with transfers**, show an inline confirm: *"This will replace your current manual plan. Continue?"* (Yes / Cancel). If the plan is empty or doesn't exist, overwrite silently. On confirm: write to localStorage, then switch `activeSubTab` to `'manual-plan'`.
- **D-09:** Bridge payload: writes `ManualStep[]` with the tree path's `(sellId, buyId)` pairs per GW, sets `horizon` to match the Route Tree's active horizon, and sets `chip = null` on every step. The user sets chips manually in Manual Plan after loading.

### Mobile Layout
- **D-10:** Summary table container uses `overflow-x-auto` (horizontal scroll), matching the `TransferPlanTable` pattern from Phase 59. Mobile users swipe to compare paths side-by-side.
- **D-11:** Expandable GW-by-GW breakdown rows (TRT-03) stay inside the table — they are `<tr>` rows spanning all columns and scroll horizontally with the parent table. No full-width breakout.

### Claude's Discretion
- Exact column headers for the summary table (e.g., "Hits", "Hit cost", "Net xPts", "Chips").
- Visual highlight style for the recommended path (e.g., ring, background tint — follow existing highlight patterns in the app).
- Whether "Load into Manual Planner" button is inside the summary table row or below each path's expanded breakdown.
- Empty/no-squad state messaging for the Route Tree tab (mirror Phase 59 D-09 pattern).
- Skeleton/loading state while the tree computes (useMemo is sync, so this may be trivial).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §Transfer Route Tree (TRT-01–TRT-07) — 7 locked requirements; read before planning
- `.planning/ROADMAP.md` §Phase 60 — phase goal, success criteria, phase notes (pure TypeScript, no LLM, TRT-05 bridge requires Phase 59)

### Navigation — must update this file
- `src/app/page.tsx` lines 48–86 — `SubTab` union type and `SECTIONS` constant; add `'route-tree'` to SubTab and insert Route Tree entry in Plan section's `subTabs` array after `'manual-plan'`

### FT Engine (Phase 56 corrected)
- `src/lib/free-transfer-engine.ts` — `computeNextFTState`, `computeHitCost`, `snapshotSquad` — all FT state propagation for branch nodes goes through this file; must be used as-is

### Manual Plan Types & Bridge Target (Phase 59)
- `src/lib/manual-plan.ts` — `ManualPlan`, `ManualStep`, `ManualTransfer`, `DerivedStep`, `ManualPlanSummary`, `MANUAL_PLAN_KEY`, `persistManualPlan`, `loadManualPlan` — bridge writes a `ManualPlan` using these types and persists via `persistManualPlan`
- `src/components/planner/ManualPlanTab.tsx` — the bridge navigation target; understand how it reads from localStorage on mount so the bridge payload is compatible

### Transfer Suggestion Engine (greedy pattern)
- `src/lib/suggest-transfers.ts` — existing position-matched, budget-aware, xPts-sorted single-GW transfer suggestion logic; the tree engine should mirror its sell-value and xPts-gain calculation patterns (D-03, D-04)

### Existing Planner Components (reuse)
- `src/components/planner/HorizonSelector.tsx` — shared section-level horizon control (D-07); do NOT render a second instance in Route Tree
- `src/components/planner/TransferPlanTable.tsx` — reference for `overflow-x-auto` horizontal scroll table pattern (D-10)
- `src/components/planner/PlannerTab.tsx` — understand how it reads `initialFTState`, `sellPrices`, and `bankBalance` — Route Tree needs the same starting values

### Types
- `src/lib/types.ts` — `FTState`, `PlannerHorizon`, `PlannerChip`, `ScoredPlayer`, `MergedPlayer`, `OptimiserHorizon` — understand type shapes before defining new RouteTree types

### Auth & Squad Patterns
- `src/lib/hooks/useMyTeam.ts` — exact `selling_price` per pick when authenticated
- `src/lib/hooks/useSquad.ts` — squad picks + `entry_history.bank` for starting bank
- `src/lib/hooks/useAuthStatus.ts` — determines sell price path

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `computeNextFTState` / `computeHitCost` / `snapshotSquad` — pure functions; call per branch node to propagate FT state (D-02)
- `suggest-transfers.ts` `sellValueFor` and `horizonScore` patterns — mirror for sell-price and xPts lookups in tree engine
- `HorizonSelector` — already rendered at section level; Route Tree reads the prop, does not render its own (D-07)
- `persistManualPlan` / `MANUAL_PLAN_KEY` — bridge writes via these (D-08, D-09)
- `TransferPlanTable` — reference for `overflow-x-auto` container pattern (D-10)

### Established Patterns
- `useImmer` for nested plan state (see `ManualPlanTab.tsx`) — if Route Tree needs local mutable state, follow this pattern
- `initialFTState` derived from `myTeamData.entry_history.event_transfers` + `squadData.active_chip` — tree needs the same derivation as its starting FT state
- `sellPrices` map: `Object.fromEntries(myTeamData.picks.map(p => [p.element, p.selling_price]))` — copy this pattern for root sell prices
- Bank balance from `myTeamData?.entry_history?.bank ?? squadData?.entry_history?.bank ?? 0`
- Dark-mode classes: `bg-white dark:bg-zinc-900`, `border-zinc-200 dark:border-zinc-700`
- Null display: em-dash `—`
- No-squad guard: show "Load your squad first" prompt if `squadData` is null (mirror Phase 59 D-09)

### Integration Points
- `src/app/page.tsx` — add `'route-tree'` to `SubTab` union, insert into Plan `subTabs`, add render conditional for `RouteTreeTab` component
- New files: `src/lib/transfer-route-tree.ts` (pure engine) + `src/components/planner/RouteTreeTab.tsx` (UI)
- Bridge: `RouteTreeTab` calls `persistManualPlan(bridgePlan)` then triggers `setActiveSubTab('manual-plan')` via prop callback

</code_context>

<specifics>
## Specific Ideas

- The side-by-side table highlights the highest net-xPts path — follow whatever visual highlight pattern already exists in the app (ring or background tint, not a new design language).
- The "Load into Manual Planner" confirm wording: *"This will replace your current manual plan. Continue?"* — keep it short, not a modal, just an inline confirmation state on the button (e.g., button text changes to "Are you sure?" with a second click to confirm).
- The tree engine should be a pure function in `src/lib/transfer-route-tree.ts` (no React, no side effects) — importable in Vitest node-environment tests, same pattern as `suggest-transfers.ts` and `free-transfer-engine.ts`.

</specifics>

<deferred>
## Deferred Ideas

- **LLM-generated branches (NLP-01):** AI-driven branching paths with narrative explanations deferred to v1.12. Phase 60 is pure TypeScript — no LLM.
- **Wildcard squad builder in Route Tree:** Generating a full 15-player squad via the tree (not just single transfers) — deferred; standard transfer-swap mode covers v1.9 scope.
- **Save/favourite a route:** Persisting a particular path without loading it into Manual Plan — deferred; localStorage already used for Manual Plan, a separate "saved routes" store is v2.x scope.

</deferred>

---

*Phase: 60-Transfer Route Tree*
*Context gathered: 2026-05-04*
