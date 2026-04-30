# Architecture: v1.6 Squad Optimiser Integration

**Domain:** FPL decision-support — squad optimisation and lineup selection
**Researched:** 2026-04-30
**Confidence:** HIGH — based on direct codebase inspection of all relevant source files

---

## Overview

The squad optimiser integrates into an existing three-tier architecture:

1. **Python pipeline** (`pipeline/`) — daily runs via GitHub Actions, writes JSON to Vercel Blob. Cross-player normalisations, API-rate-limited fetches.
2. **Next.js Route Handlers** (`src/app/api/`) — serve cached JSON; derive data from Blob files.
3. **Client-side engines** (`src/lib/`) — pure TypeScript functions called via `useMemo`. Squad-specific, user-reactive, fast.

The optimiser belongs entirely in Tier 3 (client-side pure functions). It needs no pipeline changes and no new API routes. All required inputs — `xPts_1gw/3gw/5gw`, `fixtures`, `element_type`, `now_cost`, `mins_risk`, `status` — are already in `MergedPlayer`, already delivered by `usePlayers()`, and already scored by `computeAllGemScores()`. The Squad section already has `TransferPanel` consuming `useSquad()` + `usePlayers()`. The optimiser plugs into these same hooks.

**Architectural verdict:** Pure TypeScript function in `src/lib/squad-optimiser.ts`, parallel to `planning-engine.ts`. No new Python code. No new API routes.

---

## Answering the Core Questions

### Should the optimiser be TypeScript or Python?

**TypeScript client-side pure function.** Reasons:

- All inputs are already available in the client: `ScoredPlayer[]` (from `computeAllGemScores(usePlayers())`), `SquadPick[]` (from `useSquad()` / `useMyTeam()`), `bank` and `sell_prices` from `EntryHistory`.
- The planning engine (`planning-engine.ts`) already demonstrates this pattern works for complex squad-aware computation. The optimiser is the same class of problem — it takes the current squad state and produces a ranked recommendation.
- Adding Python computation would require a new pipeline output file, a new API route, a new hook, a new loading state — all for computation that takes <5ms client-side with 15 players.
- The optimiser must be user-specific (it needs the manager's actual squad picks) which rules out pre-computing it in a daily pipeline run.

**The pipeline is unchanged for this milestone.**

### Where in the file structure?

```
src/lib/
  squad-optimiser.ts        ← new: pure optimiser engine (lineup + transfer-aware + standalone)
  squad-builder.ts          ← new: standalone budget squad construction (separate concern)

src/components/squad/
  OptimiserPanel.tsx         ← new: container, wires hooks → engine → sub-components
  LineupView.tsx             ← new: pitch layout / formation display (current vs optimised)
  OptimiserControls.tsx      ← new: horizon selector, chip toggle, mode switch
  ComparisonTable.tsx        ← new: current vs optimised side-by-side diff table
  SquadBuilderPanel.tsx      ← new: standalone budget builder UI

src/lib/hooks/
  useOptimiser.ts            ← new: wraps usePlayers + useSquad, computes optimised lineup via useMemo
```

`src/lib/squad-optimiser.ts` is parallel to `planning-engine.ts`. Both are pure functions that take `SquadPick[]` + `ScoredPlayer[]` and return structured results. The optimiser solves "best lineup from current squad"; the planner solves "best transfer sequence".

### How does it consume MergedPlayer xPts data?

The engine receives `ScoredPlayer[]` (already gem-scored via `computeAllGemScores`). It selects the best 11 by maximising total `xPts_Ngw` over the chosen horizon (1/3/5 GW). Formation constraints are applied via `element_type` counts. Captain is the player with highest `xPts_90th_1gw` (already in `MergedPlayer`).

No new fields are needed in `merged_players.json`. The engine uses:

| Field | Already In Schema | Used For |
|-------|------------------|----------|
| `xPts_1gw` / `xPts_3gw` / `xPts_5gw` | Yes | Lineup scoring per horizon |
| `xPts_90th_1gw` | Yes | Captain / VC selection (ceiling-based) |
| `element_type` | Yes | Formation constraint (1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD) |
| `now_cost` | Yes | Budget constraint for transfer-aware + standalone modes |
| `status` | Yes | Exclude injured / unavailable players from selection |
| `mins_risk` | Yes | Weight or exclude cameo / rotation_risk in lineup |
| `fixtures` | Yes | DGW multiplier (fixtureCountForGw, already implemented in planning-engine.ts) |
| `gem_score` | Yes | Secondary sort within position for candidate ranking |

### What new UI components are needed vs what can be extended?

**New components (justified):**

| Component | Why New, Not Extended |
|-----------|----------------------|
| `OptimiserPanel.tsx` | Container for the Squad section. Currently `TransferPanel` owns the Squad section and conflates squad view + transfer suggestions. The optimiser needs a peer-level container, not a child of TransferPanel. |
| `LineupView.tsx` | Pitch layout (GK/DEF/MID/FWD rows with player pills) is a distinct visual pattern. Nothing in the codebase renders a formation layout. |
| `ComparisonTable.tsx` | Side-by-side current vs optimised diff. No existing component has this shape. |
| `OptimiserControls.tsx` | Horizon selector (1/3/5 GW), chip toggle (WC/FH), mode switch (lineup / transfer-aware / standalone). Reuses `HorizonSelector` pattern from planner but with different controls. |
| `SquadBuilderPanel.tsx` | Standalone budget-only squad builder is a distinct mode with different state (no current squad anchor). |

**Existing components to extend or reuse, not replace:**

| Component | Extension |
|-----------|-----------|
| `SquadView.tsx` | Show in the "current" pane of the comparison. Pass `optimiserHighlight` prop to highlight players who differ from the optimised lineup — a thin prop addition, not a rewrite. |
| `HorizonSelector.tsx` | Reuse directly in `OptimiserControls`. No changes needed. |
| `PlayerPickerModal.tsx` | Reuse for standalone squad builder's player selection flow. |
| `MinsRiskBadge.tsx`, `VerdictBadge.tsx` | Reuse in `LineupView` player pills. No changes needed. |

**Squad section navigation:** The Squad section currently has no sub-tabs (`subTabs: []` in SECTIONS constant). To accommodate the optimiser alongside the existing transfer panel, two options exist:

- **Option A (recommended):** Add sub-tabs to the Squad section: `Transfers` (existing TransferPanel) + `Optimiser` (new OptimiserPanel). Update `SECTIONS` in `page.tsx` and `SubTab` union type. This is 10 lines of change.
- **Option B:** Merge optimiser into TransferPanel as a mode toggle. Rejected — TransferPanel is already 200+ lines and the optimiser is a different conceptual task.

### What new API routes are needed?

**None.** All data is already served:

- `/api/players` → `usePlayers()` → `computeAllGemScores()` → `ScoredPlayer[]`
- `/api/squad/{teamId}/{gw}` (via FPL proxy) → `useSquad()` → `SquadPick[]`
- `/api/my-team` (auth) → `useMyTeam()` → `MyTeamPick[]` with exact sell prices

The standalone squad builder needs only the full player pool — already available from `usePlayers()`.

### How does the standalone squad builder differ architecturally from the lineup optimiser?

| Dimension | Lineup Optimiser | Standalone Builder |
|-----------|-----------------|-------------------|
| Squad anchor | Manager's current 15 players | No anchor — builds from scratch |
| Budget constraint | `bank + sell_price` per player | Fixed total budget (e.g. £100m) |
| Transfer cost | Yes — hit cost logic from `free-transfer-engine.ts` | No — no existing squad to trade from |
| Formation constraint | Same FPL rules (1 GK, min 3 DEF, min 1 FWD, max 3 from same club) | Same FPL rules |
| Algorithm | Greedy xPts maximisation over current squad positions | Knapsack-style budget-constrained selection across all players |
| Chip modes | Wildcard (transfers free) / Free Hit (reverts) | N/A |
| Primary input | `SquadPick[]` + `ScoredPlayer[]` + `bankBalance` | `ScoredPlayer[]` + total budget |
| Output | `OptimisedLineup` (best 11 + bench + captain from existing 15) | `BuiltSquad` (15 players + positions meeting budget) |

The standalone builder lives in a separate file (`squad-builder.ts`) because the algorithm is fundamentally different. The lineup optimiser works within position slots already occupied. The builder must solve a true selection problem: choose 15 players from 825, subject to position quotas, club limits, and a budget cap. This is a constrained knapsack variant that does not share code with the lineup optimiser's slot-filling approach.

**Standalone builder algorithm:** Greedy descending by `xPts_Ngw / now_cost` (value efficiency), with backtracking to fill required position slots. This is the same class as the chip-step greedy used in `generateChipStep` but with a hard budget ceiling rather than a `bank + sell_price` per-player budget.

---

## Integration Points

### Modified Files

| File | Change | Risk |
|------|--------|------|
| `src/app/page.tsx` | Add `'optimiser'` and `'transfers'` to `SubTab` union; add sub-tabs to Squad section in `SECTIONS`; add `<OptimiserPanel />` conditional render | Low — established pattern from v1.5 nav refactor |
| `src/lib/types.ts` | Add `OptimisedLineup`, `BuiltSquad`, `LineupPlayer` types | Low — additive |
| `src/components/nav/MobileNav.tsx` | Add Squad sub-tab navigation pills when Squad section is active | Low — MobileNav already conditionally renders per-section |

### New Files

| File | Purpose | Depends On |
|------|---------|------------|
| `src/lib/squad-optimiser.ts` | Pure function: `optimiseLineup(picks, players, horizon, chipMode?) → OptimisedLineup` | `ScoredPlayer`, `SquadPick`, `free-transfer-engine.ts` |
| `src/lib/squad-builder.ts` | Pure function: `buildSquad(players, budget, horizon?) → BuiltSquad` | `ScoredPlayer` only |
| `src/lib/hooks/useOptimiser.ts` | TanStack Query + useMemo wrapper — derives `OptimisedLineup` from existing hooks | `usePlayers`, `useSquad`, `useMyTeam` |
| `src/components/squad/OptimiserPanel.tsx` | Container component for Squad > Optimiser sub-tab | All squad optimiser components |
| `src/components/squad/LineupView.tsx` | Formation pitch display (current or optimised) | `ScoredPlayer`, `SquadPick` |
| `src/components/squad/ComparisonTable.tsx` | Side-by-side current vs optimised diff | `ScoredPlayer`, `OptimisedLineup` |
| `src/components/squad/OptimiserControls.tsx` | Horizon + chip toggle + mode switch UI | `HorizonSelector` (reused) |
| `src/components/squad/SquadBuilderPanel.tsx` | Standalone budget builder container | `squad-builder.ts`, `PlayerPickerModal` (reused) |

### No Pipeline Changes

No changes to `pipeline/merge.py`, `pipeline/run.py`, or any pipeline module. No new JSON output files. No new API routes.

---

## Data Flow

```
usePlayers() ─────────────────────────────────────────────────────┐
  [MergedPlayer[] from /api/players, 6h stale]                    │
  └─► computeAllGemScores() ──► ScoredPlayer[]                    │
                                     │                            │
useSquad(teamId) ─────────────────── │ ──────────────────────────┐│
useMyTeam(isAuth) ──────────────┐    │                           ││
  [SquadPick[], bank, sellPrices]│    │                           ││
                                 └───▼────────────────────────── ││
                                      optimiseLineup(             ││
                                        picks,                    ││
                                        scoredPlayers,            ││
                                        horizon,                  ││
                                        chipMode                  ││
                                      ) → OptimisedLineup         ││
                                                │                 ││
                              ┌─────────────────┴──────────┐      ││
                              ▼                            ▼      ││
                        LineupView                  ComparisonTable││
                    (optimised pitch)             (current vs opt) ││
                                                                   ││
                                                 buildSquad(       ││
                                                   scoredPlayers,  ││
                                                   budget          ││
                                                 ) → BuiltSquad    ││
                                                       │           ││
                                                  SquadBuilderPanel││
```

### Key Invariants (carry forward from existing architecture)

- `usePlayers()` single query key `['players']` — do not create a new players fetch; piggyback on the same cache.
- `computeAllGemScores()` is called once in the containing component via `useMemo` and passed down — do not call it again inside `useOptimiser`.
- All budget values remain in **tenths of £1m** (integers) throughout — never convert to £m until display.
- The optimiser is a pure function — no hooks, no side effects, no `fetch` calls inside it.

---

## Type Shapes

### OptimisedLineup

```typescript
// src/lib/types.ts additions

export interface LineupPlayer {
  player: ScoredPlayer
  position: number       // 1-11 (starting), 12-15 (bench)
  isCaptain: boolean
  isViceCaptain: boolean
  xPtsContribution: number   // xPts_Ngw for selected horizon
}

export interface OptimisedLineup {
  horizon: 1 | 3 | 5
  chipMode: 'none' | 'wildcard' | 'freehit'
  startingXI: LineupPlayer[]   // 11 players, formation-valid
  bench: LineupPlayer[]        // 4 players, bench-ordered
  formation: string            // e.g. "4-4-2", "3-5-2"
  totalXPts: number            // sum of starting XI xPts for horizon
  captainId: number
  viceCaptainId: number
  changesFromCurrent: {        // diff vs manager's actual lineup
    playersIn: number[]        // IDs to start who are currently benched
    playersOut: number[]       // IDs to bench who are currently starting
  }
}

export interface BuiltSquad {
  players: LineupPlayer[]      // full 15 (11 starting + 4 bench)
  formation: string
  totalCost: number            // tenths of £1m
  totalXPts: number
  remainingBudget: number      // tenths of £1m
}
```

### optimiseLineup signature

```typescript
// src/lib/squad-optimiser.ts

export function optimiseLineup(
  picks: SquadPick[],
  allPlayers: ScoredPlayer[],
  horizon: 1 | 3 | 5,
  chipMode?: 'none' | 'wildcard' | 'freehit',
): OptimisedLineup
```

For `chipMode === 'none'`: select best 11 from the manager's 15 players only.
For `chipMode === 'wildcard'`: extend the candidate pool to any affordable player (budget = bank + all sell prices), selecting an entirely new 15-man squad.
For `chipMode === 'freehit'`: same as wildcard for selection, but flag the result as temporary (reverts next GW).

### buildSquad signature

```typescript
// src/lib/squad-builder.ts

export function buildSquad(
  allPlayers: ScoredPlayer[],
  budget: number,     // tenths of £1m (default: 1000 = £100m)
  horizon?: 1 | 3 | 5,
): BuiltSquad
```

---

## Recommended Build Order

Dependencies flow from engine to UI, and from simpler modes to complex ones.

### Phase A: Lineup Optimiser Engine + Basic UI

**Scope:** `squad-optimiser.ts` (lineup mode only, no chip modes), `OptimiserPanel.tsx`, `LineupView.tsx`, `OptimiserControls.tsx` (horizon only), Squad section sub-tabs in `page.tsx`.

**Why first:** This is the core deliverable. No chip modes, no comparison table, no budget builder — just "select my best 11 from my current 15". Establishes the data flow, the type shapes, and the Squad sub-tab navigation that all subsequent phases depend on.

**Key implementation detail:** Lineup optimisation is a small search space (15 players, formation-constrained). Enumerate valid formations (4-4-2, 4-3-3, 3-5-2, 3-4-3, 5-3-2, 5-4-1, 4-5-1) and for each formation, greedily assign the highest `xPts_Ngw` player per slot. Pick the formation with the highest total.

**Integration change:** `SECTIONS` in `page.tsx` — add `subTabs: [{ id: 'transfers', label: 'Transfers' }, { id: 'optimiser', label: 'Optimiser' }]` to the Squad section. Update `SubTab` union type. Wrap existing `<TransferPanel />` in `activeSubTab === 'transfers'` guard.

### Phase B: Captain / VC Recommendation + Comparison Table

**Scope:** Captain/VC selection logic (using `xPts_90th_1gw`), `ComparisonTable.tsx` showing which players change between current and optimised lineup.

**Why second:** Captain logic is a small addition to Phase A's engine — one extra output field. The comparison table is the primary user-facing value: "here's what to change in your starting 11 this week." Both depend on Phase A's `OptimisedLineup` type being established.

**Dependency:** `xPts_90th_1gw` is already in `MergedPlayer` (Phase 31). No pipeline work needed.

### Phase C: Transfer-Aware Mode

**Scope:** `optimiseLineup` extended with 1–2 free transfer budget awareness. When `freeTransfers >= 1`, the engine can also recommend swapping a current squad player for a non-squad player (within budget) if it improves the lineup. Side-by-side comparison includes transfer suggestions alongside lineup changes.

**Why third:** Transfer-aware mode adds complexity to the engine (budget tracking, hit cost) and shares algorithms with `planning-engine.ts`. It builds on Phase A's established engine signature. The comparison table from Phase B is extended to show transfer costs.

**Reuse:** `computeHitCost` and `computeNextFTState` from `free-transfer-engine.ts`. Same pattern as `generatePlan` candidate scoring.

### Phase D: Wildcard / Free Hit Chip Mode

**Scope:** `chipMode: 'wildcard' | 'freehit'` in `optimiseLineup`. When wildcard mode is active, the candidate pool expands to all affordable players from the full player pool (budget = bank + all sell prices). `OptimiserControls` chip toggle buttons.

**Why fourth:** Wildcard/FH mode re-uses Phase C's budget tracking and the knapsack-style selection logic developed for the standalone builder (Phase E). The chip toggle UI is a small addition to Phase A's controls. Chip mode must respect the existing FPL rules already encoded in `free-transfer-engine.ts`.

**Note on chip state:** The `active_chip` from `useSquad()` / `useMyTeam()` indicates a chip is currently active (e.g. Free Hit in play). The optimiser chip toggle is a planning mode ("what if I wildcard?"), not the actual active chip — do not conflate these.

### Phase E: Standalone Squad Builder

**Scope:** `squad-builder.ts`, `SquadBuilderPanel.tsx`. Budget input, position quota display, greedy player selection by value efficiency (`xPts / cost`), manual override via `PlayerPickerModal`.

**Why last:** The builder is a standalone feature that doesn't share squad state with the other modes. It is the most algorithmically distinct (true knapsack selection vs slot-filling optimisation). Placing it last means Phase A–D's patterns (formation validation, player display, mobile layout) are already established and can be reused.

**Club-per-squad limit:** FPL limits 3 players from the same club. The builder must enforce this — `planning-engine.ts` does not currently enforce this constraint (transfer engine doesn't change the club composition drastically). The builder needs an explicit club-count guard.

### Summary Table

| Phase | Engine Changes | UI Components | Modified Files | Risk |
|-------|---------------|---------------|----------------|------|
| A: Lineup optimiser | `squad-optimiser.ts` (new) | `OptimiserPanel`, `LineupView`, `OptimiserControls` | `page.tsx` (sub-tabs), `types.ts` | Low |
| B: Captain + comparison | Extend `OptimisedLineup` type | `ComparisonTable` | `squad-optimiser.ts`, `types.ts` | Low |
| C: Transfer-aware | Extend engine with FT budget | `ComparisonTable` extended | `squad-optimiser.ts` | Medium |
| D: Chip modes | Extend engine with full pool selection | `OptimiserControls` chip toggle | `squad-optimiser.ts`, `OptimiserPanel` | Medium |
| E: Squad builder | `squad-builder.ts` (new) | `SquadBuilderPanel` | `types.ts` | Medium |

---

## Dependency Graph

```
Phase A (Lineup Engine + Basic UI)
  └── Phase B (Captain + Comparison Table)
        └── Phase C (Transfer-Aware Mode)
              └── Phase D (Chip Modes)

Phase E (Standalone Builder)   ← independent, can start after Phase A establishes LineupView patterns
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: New API Route for the Optimiser

**Wrong:** Creating `/api/optimiser` that runs the lineup selection server-side.

**Why:** The optimiser is user-specific (needs the manager's actual 15 picks) and fast (<5ms for 15 players). A Route Handler adds a network round-trip and creates a server-side dependency on squad data that is already fetched client-side. There is no shared output to cache.

### Anti-Pattern 2: Python Pipeline for Optimiser Computation

**Wrong:** Adding an `optimise_squad()` function to the Python pipeline.

**Why:** The pipeline computes per-player fields, not per-manager decisions. The manager's squad is not in the pipeline. Pre-computing "best lineup" would require the pipeline to know each manager's 15 players — impossible for a personal tool.

### Anti-Pattern 3: Merging Optimiser into TransferPanel

**Wrong:** Adding optimiser state and controls into the existing `TransferPanel` component.

**Why:** TransferPanel is already ~280 lines managing squad fetch, auth state, transfer suggestions, verdicts, and captaincy candidates. The optimiser adds its own controls (horizon, chip mode), its own computed result type, and its own display components. Merging creates an unmanageable component. Use Squad sub-tabs instead.

### Anti-Pattern 4: Conflating Lineup Optimiser with Standalone Builder

**Wrong:** Using a single function with a flag: `optimiseSquad(picks?, allPlayers, budget, fromScratch: boolean)`.

**Why:** The algorithms are fundamentally different. The lineup optimiser fills 11 slots from 15 known players — a small selection problem with a finite candidate set. The standalone builder selects 15 from 825 players subject to budget and club limits — a constrained knapsack requiring a different algorithm structure. Shared code would require excessive branching and make both functions harder to test.

### Anti-Pattern 5: Calling computeAllGemScores Inside the Optimiser Hook

**Wrong:** `useOptimiser` calling `computeAllGemScores(playersData ?? [])` internally.

**Why:** `TransferPanel` and `PlannerTab` both already call `computeAllGemScores` via `useMemo`. Calling it again in `useOptimiser` creates a third independent computation — wasteful and inconsistent. Pass `scoredPlayers` as a parameter to `useOptimiser`, derived once in `OptimiserPanel` (or lifted to page.tsx if Squad sub-tabs share it).

---

## Mobile Considerations

The Squad section currently has no sub-tab row on mobile (MobileNav renders section pills + sub-tab pills when sub-tabs exist). Adding sub-tabs to Squad requires:

- `MobileNav` to render Squad sub-tab pills when `activeSection === 'squad'` (same pattern already used for Analyse and Plan sections)
- `LineupView` pitch layout must degrade gracefully at 375px — player pills in rows (GK/DEF/MID/FWD) rather than a true pitch grid is the safe mobile choice
- `ComparisonTable` should hide secondary columns on mobile (same `isMobile` guard pattern used in `SquadView`)

---

## Sources

- `src/lib/planning-engine.ts` — greedy + look-ahead engine pattern; `fixtureCountForGw`, `generateChipStep` reuse candidates (HIGH confidence — codebase)
- `src/lib/transfer-engine.ts` — candidate pool approach, budget arithmetic, position-locking pattern (HIGH confidence — codebase)
- `src/lib/free-transfer-engine.ts` — `computeHitCost`, `computeNextFTState`, `snapshotSquad` — all reusable by transfer-aware mode (HIGH confidence — codebase)
- `src/lib/squad-adapter.ts` — `SquadPick` type, `EntryHistory` with `bank` field in tenths (HIGH confidence — codebase)
- `src/lib/types.ts` — full `MergedPlayer` schema confirming all required fields already present (HIGH confidence — codebase)
- `src/components/squad/SquadView.tsx` — existing squad display; extend not replace (HIGH confidence — codebase)
- `src/components/transfers/TransferPanel.tsx` — hook composition pattern, auth integration, `useMemo` for derived computations (HIGH confidence — codebase)
- `src/components/planner/PlannerTab.tsx` — `useImmer` for complex result state; horizon selector pattern (HIGH confidence — codebase)
- `src/app/page.tsx` — `SECTIONS` constant, `SubTab` union, Squad section has empty `subTabs: []` currently (HIGH confidence — codebase)
- `src/lib/hooks/usePlayers.ts` — `['players']` query key, 6h staleTime — must not duplicate (HIGH confidence — codebase)
- `.planning/research/ARCHITECTURE.md` (v1.4) — established principle: all per-player fields flow through `merged_players.json`; no new Blob files for client-computed features (HIGH confidence — prior research)

---

*Architecture research for: FPLx v1.6 Squad Optimiser*
*Researched: 2026-04-30*
