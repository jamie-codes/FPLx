# Phase 24: Squad Snapshot - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Each GW row in the `TransferPlanTable` gets an expandable accordion revealing the full 15-player squad state after that GW's transfers are applied. The accordion shows players grouped by position (GK/DEF/MID/FWD), highlights newly transferred-in players, and distinguishes bench from starting XI.

Scope is limited to reading and displaying `squadAfter` (plus the new `positionsAfter`) data from `PlanStep`. No changes to the planning algorithm, no new scoring columns, no editing.

</domain>

<decisions>
## Implementation Decisions

### D-01: Accordion trigger — chevron in GW cell

A ▶/▼ chevron icon inside the GW cell triggers expand/collapse. The GW cell becomes a clickable button (e.g. `GW33 ▶ DGW`). No extra column added to the table. Collapsed by default per ROADMAP success criteria.

### D-02: Player info density — name + team only

Each player row shows `web_name` and `team_short_name` only. No price, gem score, or other columns. Clean and scannable in a plan context — not a full squad review.

### D-03: Transfer highlight — green ⬆ IN badge

The newly transferred-in player (from `step.transfersIn`) gets a small green "IN" badge next to their name in the accordion. No other players are specially marked (the sold player is no longer in `squadAfter`).

### D-04: Bench/starting XI distinction — extend PlanStep with positionsAfter

Add `positionsAfter: Record<number, number>` to `PlanStep` in `src/lib/types.ts`. The planning engine already tracks a `positionMap` internally — this surfaces it in the output. Bench players (positions 12–15) are shown dimmed (`opacity-50`) with a "bench" label, matching the existing `SquadView` pattern.

### D-05: Bench Boost display

When `step.chip === 'bboost'`, bench players are shown at full opacity (not dimmed) — all 15 players are prominent. This satisfies ROADMAP success criterion 3.

### Claude's Discretion

- Exact chevron icon/symbol and hover styling
- Whether the accordion animates open/closed or snaps
- Layout of the bench divider (e.g. a horizontal rule or a "— bench —" label)
- Whether the accordion is a `<details>`/`<summary>` element or a React state toggle

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` — PLAN-06 (squad snapshot per GW step)
- `.planning/ROADMAP.md` §Phase 24 — goal and all 4 success criteria

### Existing code to read before implementing
- `src/lib/types.ts` — `GWStep`, `PlanStep`, `PlanResult` interfaces (PlanStep.squadAfter is the data source; positionsAfter must be added here)
- `src/lib/planning-engine.ts` — `positionMap` tracking (lines 59–64, 161–165, 189) — expose as `positionsAfter` in each `PlanStep`
- `src/components/planner/TransferPlanTable.tsx` — table structure to understand where the chevron and accordion rows slot in
- `src/components/squad/SquadView.tsx` — existing GK/DEF/MID/FWD grouping pattern, bench `opacity-50` and "bench" label convention, `POSITION_LABELS` map

</canonical_refs>
