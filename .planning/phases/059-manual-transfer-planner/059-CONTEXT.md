# Phase 59: Manual Transfer Planner - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a "Manual Plan" sub-tab to the Plan section. Users build their own GW-by-GW transfer sequences from scratch — no AI suggestions. The system tracks running bank balance, FT bank per step (Free or Hit −4pts) using the corrected Phase 56 engine, a plan summary (total hits, total hit cost, avg break-even), and a collapsible 15-player squad snapshot per step. Plan state persists to localStorage and survives page navigation.

</domain>

<decisions>
## Implementation Decisions

### Navigation & Sub-tab
- **D-01:** New sub-tab ID: `'manual-plan'` in the Plan section. Label: `'Manual Plan'`, mobileLabel: `'Manual'`. Appended after `'planner'` in `SECTIONS` Plan.subTabs array — so AI Planner comes first, Manual Plan second.
- **D-02:** SubTab union in `page.tsx` gains `'manual-plan'`. Standard render guard: `activeSection === 'plan' && activeSubTab === 'manual-plan'`.

### GW Steps & Horizon
- **D-03:** Manual plan uses the same `HorizonSelector` (1/3/5 GW toggle) as the AI planner — fixed N blank GW steps on open.
- **D-04:** Changing the horizon **truncates** steps beyond the new horizon — no confirmation prompt, no preservation of hidden steps. Matches how the AI planner discards steps on horizon change.
- **D-05:** localStorage key: `'fplx_manual_plan'` (follows the `fplx_` prefix convention from Phase 58's `'fplx_mini_league_id'`). Serialized plan state (steps + horizon) is restored on mount.

### Transfer Entry UX
- **D-06:** Each GW step has an **"+ Add Transfer" button** that opens the existing `PlayerPickerModal`. Player-out is selected from the current GW's squad snapshot; player-in is position-filtered and budget-aware (bank balance at that step). Remove transfer via an ✕ button on each transfer row.
- **D-07:** **Unlimited transfers per GW step** — no cap. Hit cost is computed automatically for any transfers beyond the FT bank at that step.
- **D-08:** **ChipToggle per GW step** — reuses the existing `ChipToggle` component (None / Wildcard / Free Hit / Bench Boost / Triple Captain). Chip drives `computeHitCost` and `computeNextFTState` for that step and all subsequent steps.

### No-squad Behavior
- **D-09:** Squad is **required** — the Manual Plan sub-tab is accessible but shows a "Load your squad first" prompt (with Team ID input) if no squad data is available. Bank balance starting point, sell prices, and squad snapshots all depend on real squad data.

### Squad Snapshot & Summary
- **D-10:** Squad snapshot is a **collapsible accordion, collapsed by default**, per GW step — reuses the `SquadSnapshotRow` component pattern from the AI planner.
- **D-11:** A **summary header above the GW steps** shows: `Hits: N | Hit cost: −N pts | Avg break-even: N.N GWs`. Always visible regardless of accordion state.

### Sell Prices
- **D-12:** When **authenticated**: exact `selling_price` from `myTeamData.picks` used for the initial squad's sell prices (same as PlannerTab). Sell prices for players acquired mid-plan default to `now_cost` (cannot know future selling_price).
- **D-13:** When **unauthenticated**: caveat banner shown ("Sell prices are approximate — log in for exact values"). Uses `now_cost` for all sell prices (MTP-07 from ROADMAP.md).

### Claude's Discretion
- Break-even formula: `4 ÷ (xPts_1gw_in − xPts_1gw_out)` using **1-GW xPts fixed** — simplest, consistent with how the OCS (Phase 50) calculates break-even. Horizon toggle does not affect break-even calculation.
- Exact layout and spacing within summary header row.
- Loading/empty states within GW step rows (e.g., while PlayerPickerModal results are loading).
- Mobile column hiding strategy for squad snapshot rows (follow `SquadSnapshotRow` mobile patterns).
- Exact localStorage serialization schema for plan steps (follow Immer-safe plain-object conventions established in `PlannerTab`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §Manual Transfer Planner (MTP-01–MTP-08) — 8 locked requirements; read before planning
- `.planning/ROADMAP.md` §Phase 59 — phase goal, success criteria, phase notes (MTP-07 sell price caveat, MTP-08 localStorage)

### Navigation — must update these files
- `src/app/page.tsx` lines 48–86 — `SubTab` union type and `SECTIONS` constant; add `'manual-plan'` to SubTab and add Manual Plan entry to Plan section's `subTabs` array (after `'planner'`)

### FT Engine (Phase 56 corrected)
- `src/lib/free-transfer-engine.ts` — `computeNextFTState`, `computeHitCost`, `snapshotSquad` — all FT tracking goes through this file; must be used as-is (not re-implemented)

### Existing Planner Components (reuse these)
- `src/components/planner/HorizonSelector.tsx` — 1/3/5 GW toggle; reuse directly
- `src/components/planner/ChipToggle.tsx` — chip selector per GW step; reuse directly
- `src/components/planner/PlayerPickerModal.tsx` — player picker for transfers; reuse (may need prop adaptations for position filter + budget constraint in manual mode)
- `src/components/planner/SquadSnapshotRow.tsx` — collapsible squad accordion; reuse
- `src/components/planner/PlannerTab.tsx` — understand how it initialises `FTState`, derives `initialFTState`, reads `sellPrices`, and manages `bankBalance` — mirror these patterns

### Types
- `src/lib/types.ts` — `FTState`, `PlanResult`, `PlanStep`, `PlannerHorizon`, `PlannerChip` — understand existing shapes before defining new ManualPlan types; prefer extending over forking

### Auth & Squad Patterns
- `src/lib/hooks/useMyTeam.ts` — exact `selling_price` per pick when authenticated
- `src/lib/hooks/useSquad.ts` — squad picks + `entry_history.bank` for starting bank
- `src/lib/hooks/useAuthStatus.ts` — determines sell price path (D-12 vs D-13)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HorizonSelector` — direct reuse, same 1/3/5 toggle
- `ChipToggle` — direct reuse, same chip set (None/WC/FH/BB/TC)
- `PlayerPickerModal` — modal for player-in/player-out selection; built for AI planner manual edit but reusable with position filter + budget params
- `SquadSnapshotRow` — collapsible accordion component; built for per-step squad display in AI planner
- `computeNextFTState` / `computeHitCost` — pure functions; called per step to propagate FT state
- `snapshotSquad` — deep-clone helper for squad arrays

### Established Patterns
- `useImmer` for complex nested state with plan steps (see `PlannerTab.tsx` — `updatePlanResult` Immer recipe pattern)
- `initialFTState` derived from `myTeamData.entry_history.event_transfers` + `squadData.active_chip` — identical derivation applies here
- `sellPrices` map: `Object.fromEntries(myTeamData.picks.map(p => [p.element, p.selling_price]))` — copy this pattern
- Bank balance from `myTeamData?.entry_history?.bank ?? squadData?.entry_history?.bank ?? 0`
- Dark-mode classes: `bg-white dark:bg-zinc-900`, `border-zinc-200 dark:border-zinc-700`
- Null/unavailable display: em-dash `—`
- localStorage: `typeof window !== 'undefined'` guard before reads/writes

### Integration Points
- `src/app/page.tsx` — add `'manual-plan'` to SubTab, add entry to Plan subTabs, add render conditional
- New component: `src/components/planner/ManualPlanTab.tsx` — main tab component
- Plan section will then have 5 sub-tabs: Planner | Manual Plan | Club Form | Value Gems | Rivals

</code_context>

<specifics>
## Specific Ideas

- The summary header (D-11) mirrors the OpportunityCostTable summary aesthetic from Phase 50 — a compact single row of key metrics, not a card grid.
- `'fplx_manual_plan'` localStorage key follows the `fplx_` prefix convention introduced in Phase 58 — consistent namespace for all app-specific persistence keys.
- The MTP-07 unauthenticated caveat banner should be visually consistent with other auth-state messaging in the app (amber background, like the stale-data indicator) — not an error red.
- Break-even shown as `∞` (or `—`) when xPts delta ≤ 0 (selling a better player for a worse one — break-even would be negative/infinite).

</specifics>

<deferred>
## Deferred Ideas

- **Phase 60 bridge (TRT-05):** "Load into Manual Planner" from Transfer Route Tree — this requires Phase 59 to exist first. Phase 60 adds the bridge; no Phase 59 changes needed for it.
- **Wildcard squad builder mode:** Using the manual planner with a Wildcard chip could benefit from a full "build from scratch" 15-player squad picker (not just transfer-by-transfer). Deferred — standard transfer-swap mode covers the majority use case.
- **Export/share plan:** Exporting the manual plan as a text summary or shareable link. Out of scope for v1.9.

</deferred>

---

*Phase: 59-Manual Transfer Planner*
*Context gathered: 2026-05-04*
