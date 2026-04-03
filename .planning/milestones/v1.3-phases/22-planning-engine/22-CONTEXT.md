# Phase 22: Planning Engine — Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the pure TypeScript planning engine that takes the current squad + horizon and outputs a sequence of suggested transfers per GW, scored by projected points delta, fixture difficulty, DGW/BGW awareness, and hit costs.

This phase delivers PLAN-02 and PLAN-03:
- `generatePlan(squad, allPlayers, horizon, ftState, bankBalance): PlanResult`
- Scoring that accounts for projected points delta, fixture difficulty, DGW/BGW, and -4pt hits
- "Generate Plan" button in PlannerTab becomes active and calls the engine

Phase 23 (Transfer Output Table) consumes the `PlanResult` for display. Phase 24 (Squad Snapshot) consumes per-GW squad state. Phase 25 (Manual Edit) adds overrides on top.

</domain>

<decisions>
## Implementation Decisions

### D-01: Algorithm — greedy with 1-level look-ahead

The engine uses a greedy approach extended with 1-level look-ahead:

- For each GW step, score all candidate transfer options by their GW score **plus a discounted GW+1 payoff**.
- The look-ahead prevents committing to a good GW1 move that blocks a better GW2 target.
- "Greedy" still means: pick the best option at each step in sequence (no backtracking). The look-ahead is 1 level deep — enough to capture DGW setup moves without exponential cost.
- LP/MILP solver is explicitly out of scope (PLAN-11 deferred — greedy is sufficient for personal use).

### D-02: Per-GW scoring — `proj_pts_1gw × fixture_count_for_step`

The pipeline's `proj_pts_1gw` is the best per-GW forward estimate. For each step in the horizon:

- **Normal GW (1 fixture):** score = `proj_pts_1gw × 1`
- **DGW (2 fixtures):** score = `proj_pts_1gw × 2`
- **BGW (0 fixtures):** score = `proj_pts_1gw × 0` (penalised — buying into a blank)

Fixture count per step is derived from the existing `FixtureEntry[]` array by counting fixtures where `event_id === targetGw`. No pipeline changes required.

No new pipeline fields needed. `proj_pts_3gw` and `proj_pts_5gw` are not used by the planning engine (they're cumulative, not per-step).

### D-03: Hit threshold — suggest when net gain justifies

The engine suggests a paid transfer (-4pt hit) when the projected net gain exceeds the hit cost. Threshold: net gain after -4pt deduction must be positive. Engine surfaces the hit cost in the plan output so the user can evaluate.

Chip handling follows the existing FT math from Phase 21 (`computeHitCost`, `computeNextFTState`).

### D-04: Squad data — hybrid (Team ID + auth upgrade)

The engine works in two modes:
- **Team ID only (no auth):** Uses `now_cost` as approximate sell price, `bank = 0` (conservative budget). "Generate Plan" is enabled as soon as squad data loads from the Team ID endpoint.
- **Auth available:** Uses exact sell prices and bank balance from `useMyTeam`. Engine upgrades automatically when auth state is present.

Pattern: pass `bankBalance` and `sellPrices` as parameters. The calling component (`PlannerTab`) supplies whichever is available. Engine is pure — no hooks inside it.

### D-05: Engine is a pure function (TDD)

Same pattern as all prior engines (`computeTransferSuggestions`, `computeNextFTState`):
- `generatePlan(...)` is a pure function — no side effects, no hooks
- Full Vitest test coverage using RED → GREEN TDD
- `PlannerTab` calls it on button click, stores result in local state

### Claude's Discretion

- Discount factor for the look-ahead payoff (0.8 recommended — near-future GWs still count heavily)
- Candidate pre-filter count per position (e.g. top-20 by gem_score before the look-ahead loop — benchmark-tuned)
- Exact `PlanResult` shape (array of `GWStep` with scored candidates, or flat transfer list)
- Whether to expose the look-ahead discount as a constant or a parameter

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing engine patterns
- `src/lib/free-transfer-engine.ts` — FT accumulation logic (`computeNextFTState`, `computeHitCost`) — chain across GW steps
- `src/lib/transfer-engine.ts` — Single-GW greedy engine pattern, DGW fixture count helper, budget logic

### Types
- `src/lib/types.ts` — `PlannerHorizon`, `PlannerChip`, `FTState`, `GWStep`, `PlannerState`, `ScoredPlayer`, `FixtureEntry`

### Entry point
- `src/components/planner/PlannerTab.tsx` — "Generate Plan" button to be activated; engine called on click

### Data hooks
- `src/lib/hooks/usePlayers.ts` — all scored players (includes `proj_pts_1gw`, `fdr_score`, `fixtures`)
- `src/lib/hooks/useMyTeam.ts` — auth'd squad with exact prices (optional — hybrid mode)
- `src/lib/hooks/useSquad.ts` — Team ID squad (approximate prices — always available if team ID set)

### Tests
- `tests/lib/free-transfer-engine.test.ts` — Vitest TDD pattern to follow

### Requirements
- `.planning/ROADMAP.md` — Phase 22 success criteria (PLAN-02, PLAN-03)
- `.planning/REQUIREMENTS.md` — PLAN-02, PLAN-03 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `computeTransferSuggestions` — greedy single-GW engine; Phase 22 extends this pattern to multi-GW with look-ahead
- `computeNextFTState` / `computeHitCost` — chain these across GW steps to track FT state through the horizon
- `nextGwFixtureCount(player)` in `transfer-engine.ts` — adapt to `fixtureCountForGw(player, gw)` for any GW step
- `ScoredPlayer.fixtures: FixtureEntry[]` — use `event_id` grouping to derive per-step fixture counts

### Established Patterns
- All engines are pure functions — no hooks inside lib files
- TDD: write failing tests first, then implement (RED → GREEN as in Phase 21)
- `immer` / `use-immer` installed and available for mutable squad state during look-ahead simulation
- Budget check: `buy.now_cost / 10 <= bankBalance / 10 + sell.now_cost / 10`

### Integration Points
- `PlannerTab.tsx` calls engine on button click → stores `PlanResult` in local `useState`
- `PlannerTab` supplies squad data from whichever hook is available (auth or Team ID)
- Phase 23 reads `PlanResult` from `PlannerTab` state for the output table

</code_context>

<specifics>
## Specific Ideas

- Look-ahead discount of ~0.8 suggested — GW2 payoff counts 80% as much as GW1 when evaluating GW1 candidates
- BGW scoring = 0 makes transfers INTO a blank actively penalised — important for correct DGW targeting behaviour
- Candidate pre-filter (top-N by gem_score per position) should be benchmarked during Phase 22 to confirm performance is acceptable for a ~500 player pool

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 22-planning-engine*
*Context gathered: 2026-04-02*
