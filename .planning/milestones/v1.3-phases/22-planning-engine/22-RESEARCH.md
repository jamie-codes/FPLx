# Phase 22: Planning Engine — Research

**Researched:** 2026-04-02
**Domain:** Pure TypeScript planning engine — greedy multi-GW transfer sequencing with 1-level look-ahead
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Algorithm — greedy with 1-level look-ahead**
The engine uses a greedy approach extended with 1-level look-ahead:
- For each GW step, score all candidate transfer options by their GW score **plus a discounted GW+1 payoff**.
- The look-ahead prevents committing to a good GW1 move that blocks a better GW2 target.
- "Greedy" still means: pick the best option at each step in sequence (no backtracking). The look-ahead is 1 level deep — enough to capture DGW setup moves without exponential cost.
- LP/MILP solver is explicitly out of scope (PLAN-11 deferred — greedy is sufficient for personal use).

**D-02: Per-GW scoring — `proj_pts_1gw × fixture_count_for_step`**
For each step in the horizon:
- **Normal GW (1 fixture):** score = `proj_pts_1gw × 1`
- **DGW (2 fixtures):** score = `proj_pts_1gw × 2`
- **BGW (0 fixtures):** score = `proj_pts_1gw × 0` (penalised — buying into a blank)

Fixture count per step is derived from the existing `FixtureEntry[]` array by counting fixtures where `event_id === targetGw`. No pipeline changes required. `proj_pts_3gw` and `proj_pts_5gw` are NOT used by the planning engine.

**D-03: Hit threshold — suggest when net gain justifies**
The engine suggests a paid transfer (-4pt hit) when projected net gain after -4pt deduction is positive. Engine surfaces the hit cost in the plan output so the user can evaluate. Chip handling follows existing FT math (`computeHitCost`, `computeNextFTState`).

**D-04: Squad data — hybrid (Team ID + auth upgrade)**
- **Team ID only (no auth):** Uses `now_cost` as approximate sell price, `bank = 0` (conservative budget). "Generate Plan" is enabled as soon as squad data loads.
- **Auth available:** Uses exact sell prices and bank balance from `useMyTeam`. Engine upgrades automatically when auth state is present.
- Pattern: pass `bankBalance` and `sellPrices` as parameters. PlannerTab supplies whichever is available. Engine is pure — no hooks inside it.

**D-05: Engine is a pure function (TDD)**
- `generatePlan(...)` is a pure function — no side effects, no hooks
- Full Vitest test coverage using RED → GREEN TDD
- `PlannerTab` calls it on button click, stores result in local state

### Claude's Discretion

- Discount factor for the look-ahead payoff (0.8 recommended — near-future GWs still count heavily)
- Candidate pre-filter count per position (e.g. top-20 by gem_score before the look-ahead loop — benchmark-tuned)
- Exact `PlanResult` shape (array of `GWStep` with scored candidates, or flat transfer list)
- Whether to expose the look-ahead discount as a constant or a parameter

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAN-02 | System auto-suggests an optimal transfer sequence for the chosen horizon | `generatePlan()` engine + `PlannerTab` button activation |
| PLAN-03 | Transfer sequence scoring accounts for projected points delta, fixture difficulty, DGW/BGW awareness, and -4pt hit cost | Scoring formula `proj_pts_1gw × fixture_count`, `computeHitCost`, fixture-count-per-GW helper |
</phase_requirements>

---

## Summary

Phase 22 builds a pure TypeScript planning engine (`generatePlan`) that extends the existing single-GW greedy pattern from `transfer-engine.ts` to a multi-GW horizon with 1-level look-ahead. All the foundational pieces are already in place: `computeHitCost` and `computeNextFTState` from `free-transfer-engine.ts` chain FT state across steps; `ScoredPlayer.fixtures` carries `FixtureEntry[]` with `event_id` for per-GW fixture counting; `transfer-engine.ts` demonstrates the budget check and candidate ranking patterns.

The main design challenge is the look-ahead loop. For each GW step, the engine must: (1) snapshot the current simulated squad, (2) enumerate position-legal, budget-legal candidate swaps, (3) for each candidate score it as GW_score + DISCOUNT × GW+1_score (with provisional application of the transfer), then (4) commit the best-scoring option and advance the FT state. The immer/structuredClone pattern from `snapshotSquad` is the right mechanism for squad state during simulation.

The `PlannerTab` integration is minimal: activate the disabled "Generate Plan" button, wire it to call `generatePlan(...)` with the best available squad data, store the `PlanResult` in `useState`. Phase 23 will consume that state for the output table — Phase 22 only needs to produce the result, not render it.

**Primary recommendation:** New file `src/lib/planning-engine.ts` following the exact structure of `transfer-engine.ts`. TDD via `tests/lib/planning-engine.test.ts` using the `describe`/`it`/`expect` pattern from `free-transfer-engine.test.ts`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (built-in) | — | Type-safe pure functions | All lib files are `.ts` |
| Vitest | already installed | TDD test runner | Project standard — `vitest.config.ts` present |
| immer / structuredClone | already installed | Deep squad copy for simulation | `snapshotSquad` already uses `structuredClone`; immer available for mutable squad state in loops |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | already installed | Data hooks in PlannerTab (no changes needed) | PlannerTab calls `useSquad`/`useMyTeam`/`usePlayers` — existing hooks unchanged |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| structuredClone | immer produce() | Either works; structuredClone simpler for plain objects matching `snapshotSquad` convention |
| greedy + 1-level look-ahead | LP/MILP | LP is globally optimal but deferred (PLAN-11); greedy sufficient for personal use at this scale |

**Installation:** No new packages required. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/lib/
├── planning-engine.ts       # NEW — generatePlan() pure function
├── transfer-engine.ts       # Existing — single-GW pattern to replicate
├── free-transfer-engine.ts  # Existing — computeHitCost, computeNextFTState, snapshotSquad
└── types.ts                 # Existing — GWStep, PlannerHorizon, FTState; PlanResult to add here

tests/lib/
└── planning-engine.test.ts  # NEW — TDD tests mirroring free-transfer-engine.test.ts structure

src/components/planner/
└── PlannerTab.tsx           # Modify — activate button, call engine, store PlanResult in useState
```

### Pattern 1: Per-GW Fixture Count Helper

The existing `nextGwFixtureCount` in `transfer-engine.ts` is hardcoded to the first fixture's GW. Phase 22 needs a generalised version:

```typescript
// Source: derived from transfer-engine.ts nextGwFixtureCount
function fixtureCountForGw(player: ScoredPlayer, targetGw: number): number {
  return player.fixtures.filter(f => f.event_id === targetGw).length
  // Returns 0 for BGW, 1 for normal, 2 for DGW
}
```

This is the foundation for the D-02 scoring formula: `score = proj_pts_1gw × fixtureCountForGw(player, gw)`.

### Pattern 2: Greedy Step With Look-Ahead

```typescript
// Source: design based on transfer-engine.ts computeTransferSuggestions pattern
function scoreCandidate(
  player: ScoredPlayer,
  gw: number,
  discount: number,
  nextGw: number | null,
): number {
  const gwScore = player.proj_pts_1gw * fixtureCountForGw(player, gw)
  if (nextGw === null) return gwScore
  const nextScore = player.proj_pts_1gw * fixtureCountForGw(player, nextGw)
  return gwScore + discount * nextScore
}
```

The look-ahead is applied at candidate evaluation time — no recursive expansion.

### Pattern 3: FT State Chain Across Steps

```typescript
// Source: free-transfer-engine.ts — exact functions, chained across horizon steps
// Step N:
const hitCost = computeHitCost(ftState.available, transfersUsedThisStep, chip)
const nextFTState = computeNextFTState(ftState.available, transfersUsedThisStep, chip)
// Pass nextFTState as ftState for Step N+1
```

### Pattern 4: Budget Check

```typescript
// Source: transfer-engine.ts line 87
// Sell price: use sellPrices[player.id] if available (auth), else player.now_cost (Team ID mode)
const sellPrice = sellPrices?.[sellPlayer.id] ?? sellPlayer.now_cost
const availableBudget = bankBalance + sellPrice
const affordable = buyPlayer.now_cost <= availableBudget
```

Note: all prices are in tenths of £1m — do not divide before comparing, to avoid floating-point drift.

### Pattern 5: PlanResult Type Shape

The `GWStep` type in `types.ts` already exists with `gw`, `chip`, `transfersIn`, `transfersOut`, `freeTransfersAvailable`, `hitCost`. `PlanResult` is an extension to add per-step scored candidates for Phase 23 consumption:

```typescript
// Recommended addition to types.ts
export interface ScoredTransfer {
  sellId: number
  buyId: number
  gwScore: number         // proj_pts delta for this GW
  lookAheadScore: number  // discounted GW+1 delta
  totalScore: number      // gwScore + lookAheadScore
  hitCost: number         // 0 or negative (-4 per excess transfer)
  netGain: number         // totalScore + hitCost
  affordable: boolean
}

export interface PlanStep extends GWStep {
  scoredTransfers: ScoredTransfer[]   // top candidates considered (for transparency)
  squadAfter: number[]                // player IDs in simulated squad after this step
}

export interface PlanResult {
  steps: PlanStep[]       // length === horizon
  horizon: PlannerHorizon
}
```

Phase 23 reads `PlanResult.steps` to render the output table. Phase 24 reads `squadAfter` per step.

### Anti-Patterns to Avoid

- **Calling hooks inside the engine:** Engine must be pure — no `useState`, no `useMemo`. Hooks stay in PlannerTab.
- **Using `proj_pts_3gw` or `proj_pts_5gw` for per-step scoring:** These are cumulative, not per-step. Only `proj_pts_1gw × fixtureCount` is correct per D-02.
- **Dividing prices before budget check:** `now_cost / 10` for display only; arithmetic comparisons should stay in tenths to avoid floating-point issues.
- **Mutating the simulated squad array between look-ahead candidates:** Each candidate evaluation must start from the same snapshot — structuredClone before applying provisional transfers.
- **Returning position 12-15 (bench) players as sell candidates without a guard:** Transfer engine filters to `position >= 1 && position <= 11` (starting XI). Apply the same guard.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FT state tracking | Custom FT accumulation | `computeNextFTState` from `free-transfer-engine.ts` | Already tested with 25+ Vitest cases covering wildcard/freehit/normal |
| Hit cost calculation | `transfersUsed - available * -4` inline | `computeHitCost` from `free-transfer-engine.ts` | Handles -0 IEEE754, chip guards, edge cases |
| Deep squad copy | JSON.stringify/parse or spread | `snapshotSquad` (structuredClone) | Correct deep clone; already in project |
| Candidate scoring for single GW | Custom sorter | Adapt `computeTransferSuggestions` candidate loop | Budget logic, position lock, rotation risk patterns already established |

**Key insight:** The planning engine is a composition of existing primitives, not a from-scratch build. The primary new logic is the look-ahead loop and the multi-step state chain.

---

## Common Pitfalls

### Pitfall 1: Candidate Pool Explosion

**What goes wrong:** Without pre-filtering, iterating all ~500 players × 15 squad positions × horizon depth × look-ahead creates O(500 × 15 × 5 × 2) = ~75,000 evaluations per button click. This is borderline acceptable but can lag on mobile.

**Why it happens:** The FPL player pool is large (~700+ including injured/benched).

**How to avoid:** Pre-filter candidates to top-N by `gem_score` per position before entering the loop. The CONTEXT.md suggests top-20 per position as a starting point. Benchmark with Vitest `performance.now()` — if > 200ms in the test environment, reduce N.

**Warning signs:** Test execution slowing noticeably; React UI freezing on button click.

### Pitfall 2: Stale Squad IDs After Provisional Transfer

**What goes wrong:** When simulating look-ahead (GW+1), the provisional transfer from GW is not reflected in the squad — leading to double-buying the same player or leaving the old player as "not in squad".

**Why it happens:** The `squadIds` Set must be updated when applying provisional transfers during simulation.

**How to avoid:** After each greedy selection at step N, build a fresh `squadIds` Set from the updated simulated squad before evaluating step N+1 candidates. Use `snapshotSquad` to clone the squad array first.

### Pitfall 3: BGW / GW Beyond Fixture Data

**What goes wrong:** If `player.fixtures` does not contain entries for a future GW (because the fixture data only covers ~5 GWs), `fixtureCountForGw(player, futureGw)` returns 0 — the player looks like a BGW target even when fixtures aren't yet published.

**Why it happens:** Fixture data from the pipeline covers next 5 GWs. For a horizon-5 plan starting at GW34, GW38+ may have no data.

**How to avoid:** Distinguish "confirmed blank" (team has a fixture but player has 0 in this GW) from "data not available" (no fixture entries exist for this GW at all). If no players have fixture entries for a given GW, flag that GW step as `unconfirmed_fixtures: true` in `PlanStep` rather than scoring as BGW. The CONTEXT.md success criterion 4 requires BGW and unconfirmed GWs to be flagged.

**Warning signs:** All players scoring 0 for a particular GW step despite being widely expected to play.

### Pitfall 4: Hit Suggestion When Net Gain Barely Positive

**What goes wrong:** A -4pt hit that produces +4.1 pts projected gain is flagged as a valid suggestion. In practice, projection uncertainty means this is noise.

**Why it happens:** The D-03 threshold is "net gain > 0" — technically correct per the decision, but borderline cases will feel arbitrary.

**How to avoid:** The engine correctly implements D-03 as-is. Surface hit cost explicitly in `ScoredTransfer.hitCost` and `netGain` so the user can see the margin. Phase 25 (manual edit) allows the user to override anyway.

### Pitfall 5: usePlayers Returns MergedPlayer, Not ScoredPlayer

**What goes wrong:** `usePlayers()` returns `MergedPlayer[]` (no `gem_score` field). Passing this directly to `generatePlan` which expects `ScoredPlayer[]` will be a TypeScript error.

**Why it happens:** The existing pattern in all components is to call `computeAllGemScores(playersData ?? [])` inside a `useMemo` to get `ScoredPlayer[]`. PlannerTab must follow this pattern.

**How to avoid:** In `PlannerTab.tsx`:
```typescript
import { computeAllGemScores } from '@/lib/gem-score'
const { data: playersData } = usePlayers()
const scoredPlayers = useMemo(() => computeAllGemScores(playersData ?? []), [playersData])
// Pass scoredPlayers to generatePlan
```

### Pitfall 6: "Generate Plan" Enabled Before Squad Data Ready

**What goes wrong:** Button activates immediately on component mount (before squad data loads), calling `generatePlan` with an empty squad.

**How to avoid:** The button `disabled` state must gate on both squad data and scored players being non-empty:
```typescript
const canGenerate = squadData != null && scoredPlayers.length > 0
<button disabled={!canGenerate} ...>Generate Plan</button>
```

---

## Code Examples

Verified patterns from existing codebase:

### Fixture Count for Any GW (adapted from transfer-engine.ts)
```typescript
// Source: transfer-engine.ts nextGwFixtureCount — generalised
function fixtureCountForGw(player: ScoredPlayer, targetGw: number): number {
  return player.fixtures.filter(f => f.event_id === targetGw).length
}
```

### Budget Check (from transfer-engine.ts line 87)
```typescript
// Source: transfer-engine.ts
const available_budget = bankBalance + sellPrice   // tenths of £1m, integer arithmetic
const budget_sufficient = buyPlayer.now_cost <= available_budget
```

### FT Chain (from free-transfer-engine.ts)
```typescript
// Source: free-transfer-engine.ts
const hitCost = computeHitCost(ftState.available, transfersUsed, chip)  // 0 or -4n
const nextState = computeNextFTState(ftState.available, transfersUsed, chip)
```

### Squad Deep Copy (from free-transfer-engine.ts snapshotSquad)
```typescript
// Source: free-transfer-engine.ts
const simulatedSquad = snapshotSquad(currentSquad)  // structuredClone
```

### Vitest TDD Pattern (from free-transfer-engine.test.ts)
```typescript
// Source: tests/lib/free-transfer-engine.test.ts
import { describe, it, expect } from 'vitest'
import { generatePlan } from '@/lib/planning-engine'

describe('generatePlan', () => {
  it('returns empty steps for horizon 0', () => {
    // RED first — write this before implementing
  })
})
```

### PlannerTab Button Activation Pattern
```typescript
// Source: derived from TransferPanel.tsx + PlannerTab.tsx existing shell
const [planResult, setPlanResult] = useState<PlanResult | null>(null)
const { data: playersData } = usePlayers()
const scoredPlayers = useMemo(() => computeAllGemScores(playersData ?? []), [playersData])
const canGenerate = !!squadData && scoredPlayers.length > 0

function handleGeneratePlan() {
  const result = generatePlan(squadPicks, scoredPlayers, horizon, initialFTState, bankBalance)
  setPlanResult(result)
}
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/lib/planning-engine.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-02 | `generatePlan` returns `PlanResult` with `steps.length === horizon` | unit | `npx vitest run tests/lib/planning-engine.test.ts` | No — Wave 0 |
| PLAN-02 | Steps contain valid `transfersIn`/`transfersOut` player IDs | unit | same | No — Wave 0 |
| PLAN-02 | "Generate Plan" button enabled when squad + players loaded | unit | same | No — Wave 0 |
| PLAN-03 | DGW player scores 2× vs equivalent single-GW player | unit | same | No — Wave 0 |
| PLAN-03 | BGW player scores 0 (penalised, not suggested over normal-GW players) | unit | same | No — Wave 0 |
| PLAN-03 | Hit cost deducted from net gain: 1 extra transfer → -4 net adjustment | unit | same | No — Wave 0 |
| PLAN-03 | Look-ahead: prefers player with strong GW+1 over equally-rated immediate target | unit | same | No — Wave 0 |
| PLAN-03 | Budget guard: unaffordable buys not suggested | unit | same | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/lib/planning-engine.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/lib/planning-engine.test.ts` — covers all PLAN-02 and PLAN-03 cases above
- [ ] `src/lib/planning-engine.ts` — the engine itself (created during implementation, not Wave 0)
- [ ] `PlanResult`, `PlanStep`, `ScoredTransfer` types added to `src/lib/types.ts`

*(No framework changes needed — Vitest config already covers `tests/lib/*.test.ts`)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-GW greedy (`computeTransferSuggestions`) | Multi-GW greedy with look-ahead (`generatePlan`) | Phase 22 | Enables DGW-aware planning |
| "Save" recommendation when no positive delta | Per-step hit threshold (net gain > 0 after -4pt) | Phase 22 | Surfaces justified paid transfers |
| Disabled "Generate Plan" button | Active button wired to engine | Phase 22 | Activates PLAN-02/03 |

---

## Open Questions

1. **What is the current GW number at runtime?**
   - What we know: `usePlayers()` returns `MergedPlayer[]` including `proj_pts_1gw` and `fixtures[].event_id`. The `fixtures` array starts from the next upcoming GW.
   - What's unclear: The engine needs to know *which* GW is "step 1" to iterate `gw+1`, `gw+2`, etc. for look-ahead. The first `event_id` in any player's `fixtures[0]` is the next GW.
   - Recommendation: Derive `currentGw` as `scoredPlayers[0]?.fixtures[0]?.event_id ?? null`. If null, disable the button. Pass as a parameter to `generatePlan`.

2. **Candidate pre-filter size (top-N per position)**
   - What we know: CONTEXT.md suggests top-20; STATE.md flags this as needing benchmarking.
   - What's unclear: Whether 20 is fast enough on mobile without noticeable lag.
   - Recommendation: Start with top-20 per position (80 candidates across 4 positions). Add a `performance.now()` assertion in the test: plan generation must complete in < 100ms for a 3-GW horizon. Tune N if it fails.

3. **`PlanResult` shape consumed by Phase 23**
   - What we know: Phase 23 (Transfer Output Table) reads from `PlanResult`. Phase 24 (Squad Snapshot) reads `squadAfter` per step.
   - What's unclear: The exact columns Phase 23 needs (the CONTEXT.md for Phase 23 doesn't exist yet).
   - Recommendation: Include `scoredTransfers` (top N candidates considered), `squadAfter`, `hitCost`, `netGain` in each `PlanStep`. This is a superset of what Phase 23 likely needs, and the extra fields cost nothing.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely TypeScript code and tests with no new external dependencies. All required packages (`vitest`, `immer`, TypeScript) are already installed.

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md reads `@AGENTS.md`, which states:

> This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Implications for this phase:** The planning engine (`src/lib/planning-engine.ts`) is a pure TypeScript file with no Next.js API surface — no Route Handlers, no server components, no `use client`. This constraint has no direct effect on engine implementation. PlannerTab modifications are client-side React (`'use client'` already declared) — no new Next.js APIs are introduced.

**Planner must verify:** Any new Route Handlers added (none expected in Phase 22) must follow current Next.js conventions per AGENTS.md.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/transfer-engine.ts` — single-GW engine pattern, budget check, candidate loop, `nextGwFixtureCount`
- `src/lib/free-transfer-engine.ts` — `computeNextFTState`, `computeHitCost`, `snapshotSquad` — chaining patterns
- `src/lib/types.ts` — `GWStep`, `FTState`, `PlannerHorizon`, `ScoredPlayer`, `FixtureEntry` — all existing types
- `src/components/planner/PlannerTab.tsx` — integration point, current disabled-button shell
- `tests/lib/free-transfer-engine.test.ts` — TDD pattern, test structure, describe/it/expect conventions
- `vitest.config.ts` — test framework config, alias resolution, environment

### Secondary (MEDIUM confidence)
- `src/components/gem-table/GemTable.tsx` and `TransferPanel.tsx` — established pattern for `usePlayers()` + `computeAllGemScores()` inside `useMemo`
- `src/lib/squad-adapter.ts` — `SquadPick`, `MyTeamPick` (with `selling_price`) — hybrid mode data shapes
- `.planning/phases/22-planning-engine/22-CONTEXT.md` — locked decisions, algorithm spec, canonical refs

### Tertiary (LOW confidence)
- None — all findings are derived from codebase inspection, not external sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and in use
- Architecture: HIGH — patterns derived directly from existing engine files
- Pitfalls: HIGH — derived from codebase analysis (usePlayers returns MergedPlayer, not ScoredPlayer; nextGwFixtureCount is GW-hardcoded)
- Test map: HIGH — Vitest config confirmed, test directory confirmed, test patterns confirmed

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable codebase — no fast-moving external dependencies)
