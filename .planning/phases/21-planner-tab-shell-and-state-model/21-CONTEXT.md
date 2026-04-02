# Phase 21: Planner Tab Shell and State Model — Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a "Planner" tab to both navigation components (desktop tab strip and mobile bottom bar) and establish the foundational types and state model for the multi-GW transfer planner.

This phase delivers:
1. Navigation entry point (PLAN-08)
2. Horizon selector control — user picks 1–5 GWs (PLAN-01)
3. Free transfer accumulation logic — unit-tested TypeScript functions
4. Squad snapshot deep-copy pattern — verified no cross-GW mutation

Phases 22–25 build the planning engine, output table, squad snapshots, and manual edit mode on top of this foundation.

</domain>

<decisions>
## Implementation Decisions

### D-01: Planner shell content in Phase 21

The Planner tab shows:
- A "Planning Horizon" heading
- A segmented button group: [1 GW] [2 GW] [3 GW] [4 GW] [5 GW]
- A disabled "Generate Plan" button below the selector

The disabled button establishes the layout shape so Phase 22 can activate it without restructuring. No placeholder output table or empty-state message in this phase.

### D-02: Mobile nav — "Plan" label, 6-tab compression

The mobile bottom nav adds "Plan" as the 6th tab (short label for narrow fit). All 6 buttons remain `flex-1`; each gets ~62px on a 375px screen. The 44px min-height tap target is preserved. No scroll, no hiding of existing tabs.

**Desktop tab label:** "Planner" (full label, more room on desktop).

### D-03: Horizon selector — segmented button group

Five toggle buttons in a horizontal row: `[1 GW] [2 GW] [3 GW] [4 GW] [5 GW]`. Matches the existing position filter pills and projected-points GW toggles (1/3/5 toggle). Default selection: 3 GWs (Claude's discretion on default).

Active button uses the same active style as existing filter pills in the app.

### D-04: State architecture — co-located in PlannerTab component

All planner state lives inside a self-contained `PlannerTab` component. `page.tsx` renders `{activeTab === 'planner' && <PlannerTab />}` — no new state added to `page.tsx`.

```
page.tsx
  └ activeTab state (unchanged, adds 'planner' to Tab union)
  └ {activeTab === 'planner' && <PlannerTab />}

PlannerTab.tsx
  └ horizon: number (useState, default 3)
  └ planResult state (Phase 22+)
  └ <HorizonSelector />
  └ <PlannerOutput /> (Phase 22+)
```

State can be lifted to a PlannerContext in a later phase if cross-tree access is needed (e.g. Phase 24 squad snapshots reading planner state from outside PlannerTab). Do not pre-emptively create Context in Phase 21.

### D-05: Tab type — extend in both files

The `Tab` type in `page.tsx` and the `TABS` array in `MobileNav.tsx` are currently duplicated. Add `'planner'` to both. No refactor to extract a shared TABS constant in this phase — Claude's discretion.

### Claude's Discretion

- Default horizon value (3 GWs recommended — middle of range, typical planning window)
- Free transfer unit test file location (alongside or near `transfer-engine.ts`)
- Squad snapshot deep-copy implementation (structuredClone vs JSON round-trip vs spread)
- Exact styling of disabled Generate Plan button (opacity, cursor-not-allowed)
- Whether to add a small icon to the Planner tab buttons (not required)

</decisions>

<canonical_refs>
## Canonical References

- `src/components/nav/MobileNav.tsx` — mobile bottom bar (add 'Plan' tab, extend Tab type)
- `src/app/page.tsx` — desktop tab strip and tab rendering (add 'planner' to Tab union and tab button)
- `src/lib/types.ts` — shared types (add planner types here: PlannerState, GWStep, TransferMove)
- `src/lib/transfer-engine.ts` — existing transfer logic (free transfer accumulation logic will sit nearby or extend this)
- `.planning/ROADMAP.md` — Phase 21 success criteria (PLAN-01, PLAN-08)

No external ADRs or specs referenced for this phase.
</canonical_refs>

<free_transfer_rules>
## Free Transfer Rules (2025/26) — for unit test spec

These are FPL rules, not design decisions. Captured here so the planner agent can write correct unit tests without re-researching.

- Base: 1 free transfer per GW
- Unused FTs bank: carry 1 unused FT forward → cap at 2 banked FTs
- Extra transfers: each costs -4 pts
- **Wildcard**: all transfers that GW are free; FT bank resets to 1 the following GW
- **Free Hit**: all transfers that GW are free; squad reverts at end of GW; FT bank is unchanged (carry through as if Free Hit GW didn't happen)
- **Triple Captain / Bench Boost**: do not affect FT count at all

Example sequence for unit tests:
- GW1: 1 FT available, use 0 → bank 1 extra → GW2 has 2 FTs
- GW2: 2 FTs available, use 2 → GW3 has 1 FT (cap resets)
- GW3: 1 FT available, use 3 → GW3 cost = -8 pts (2 hits), GW4 has 1 FT
- GW4: Wildcard played → 0 hit, GW5 has 1 FT (resets)
- GW5: 1 FT available, use 0 → bank 1 → GW6 has 2 FTs
- GW6: Free Hit played → 0 hit, GW7 has 2 FTs (bank unchanged from GW5 carry)
</free_transfer_rules>
