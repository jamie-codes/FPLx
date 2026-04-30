# Research Summary -- v1.6 Squad Optimiser

**Synthesised:** 2026-04-30
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, PROJECT.md
**Confidence:** HIGH across all four research areas (all grounded in direct codebase inspection + authoritative FPL rules)

---

## Executive Summary

v1.6 adds a Squad Optimiser tab to an already feature-complete personal FPL analyst tool. Research shows the problem decomposes into two computationally separate problems: (1) selecting the best 11 from an existing 15-player squad -- C(15,11)=1,365 subsets solved by pure TypeScript enumeration in under 1ms with no library needed; and (2) building an optimal 15-player squad from ~650 candidates -- a constrained knapsack solved by greedy algorithm. All required inputs (xPts_1gw/3gw/5gw, xPts_90th_1gw, element_type, now_cost, status, mins_risk) already exist in MergedPlayer. No pipeline changes and no new API routes are needed.

The architectural verdict is unambiguous: a pure TypeScript engine in src/lib/squad-optimiser.ts parallel to planning-engine.ts, wired through a useOptimiser hook that piggybacks on the existing usePlayers() and useSquad() cache. The Squad section gains sub-tabs (Transfers | Optimiser) via a 10-line change to SECTIONS in page.tsx. The existing generatePlan() and free-transfer-engine.ts utilities handle transfer-cost logic and are imported, not forked.

The primary risks are correctness risks, not performance risks. Formation constraints have six rules that must all be encoded simultaneously. The 3-per-club cap applies to all 15 players, not just the XI. BGW players must be hard-excluded from the starting 11, not merely penalised. Budget arithmetic must stay in integer tenths throughout. Each of these has caused real production bugs in FPL tooling in the wild. Unit testing the engine with degenerate squads before any UI work begins is mandatory.

---

## Stack Additions

**New Python dependency:** None. scipy.optimize.milp (bundled HiGHS solver) is available since scipy 1.9; the pipeline already pins scipy>=1.14.0. Only needed if a Python-side MILP path is added for the standalone squad builder -- architecture research concludes greedy TypeScript is sufficient for v1.6.

**New npm dependency:** None. Best-11 enumeration is ~60 lines of plain TypeScript. glpk.js is explicitly ruled out: Next.js serverless WASM issues, ~1MB bundle cost, and architecture mismatch with the existing client-computed pattern.

**New pipeline JSON artifact:** None. The optimiser is user-specific (it needs the manager's actual 15 picks, which the pipeline cannot know). All computation runs client-side.

**Reused stack (unchanged):**
- usePlayers() / TanStack Query -- piggyback on existing ['players'] cache key; never duplicate
- useSquad() / useMyTeam() -- always use as source of truth for current squad
- computeAllGemScores() -- derive ScoredPlayer[] once in OptimiserPanel via useMemo
- free-transfer-engine.ts -- computeHitCost, computeNextFTState, snapshotSquad reusable by transfer-aware mode
- planning-engine.ts -- fixtureCountForGw, LOOK_AHEAD_DISCOUNT (0.8) -- import, never fork

**What to avoid:**
- glpk.js or any WASM LP solver on the client
- PuLP or python-mip (scipy.milp already covers the need)
- Custom genetic algorithm or simulated annealing
- Any new pipeline JSON file for per-manager decisions
- Calling computeAllGemScores inside useOptimiser -- compute it upstream once

---

## Feature Table Stakes

The 7 things that must ship for this milestone to be useful, in dependency order:

| # | Feature | Complexity | Key dependency |
|---|---------|------------|----------------|
| TS-01 | Correct FPL constraint enforcement: 6 formation rules + 3-per-club cap at squad level | Low | Foundation -- everything else depends on this |
| TS-02 | Formation auto-selection: enumerate all valid formations, pick highest xPts XI | Medium | xPts_1gw/3gw/5gw already in MergedPlayer |
| TS-03 | Captain / VC recommendation: captain = highest xPts_90th_1gw starter; VC = second | Low | xPts_90th_1gw built in Phase 31 |
| TS-04 | Bench ordering: GK isolated at slot 0; outfield bench sorted by xPts descending | Low | xPts_1gw per bench player |
| TS-05 | Configurable 1/3/5 GW horizon: switch xPts column per selection | Low | xPts_1gw/3gw/5gw already in MergedPlayer |
| TS-08 + TS-09 | Side-by-side current vs optimised comparison with xPts delta | Low-Med | OptimisedLineup type from TS-01/02 |
| TS-07 | Transfer-aware mode (1-2 FT): net gain = xPts gain minus hit cost | Medium | free-transfer-engine.ts, MyTeamPickSchema.selling_price |

**Differentiators to include in v1.6 (low cost):**
- D-01: Wildcard / Free Hit chip toggle (same algorithm; chip mode removes transfer cost)
- D-02: xPts ceiling for captain card (already in pipeline; integration cost only)
- D-06: BGW starter warning
- D-07: Transfer hit break-even display

**Defer to v2+:** D-03 (time decay), D-04 (player locking), D-05 (captain swap what-if)

**Anti-features -- do not build in v1.6:** Full MILP in browser, Monte Carlo xPts simulation, live in-match refresh, automated chip activation, formation preference picker.

---

## Architecture Overview

**New code location:**

```
src/lib/
  squad-optimiser.ts     pure engine: optimiseLineup(picks, players, horizon, chipMode?)
  squad-builder.ts       pure engine: buildSquad(players, budget, horizon?) -- standalone mode

src/lib/hooks/
  useOptimiser.ts        wraps usePlayers + useSquad; derives OptimisedLineup via useMemo

src/components/squad/
  OptimiserPanel.tsx     container; wires hooks to engine to sub-components
  LineupView.tsx         pitch layout (GK/DEF/MID/FWD rows with player pills)
  ComparisonTable.tsx    current vs optimised side-by-side diff
  OptimiserControls.tsx  horizon selector, chip toggle, mode switch
  SquadBuilderPanel.tsx  standalone budget builder UI
```

**Modified files (minimal surface area):**

| File | Change |
|------|--------|
| src/app/page.tsx | Add sub-tabs to Squad section in SECTIONS; add OptimiserPanel render |
| src/lib/types.ts | Add OptimisedLineup, BuiltSquad, LineupPlayer interfaces |
| src/components/nav/MobileNav.tsx | Squad sub-tab pills when activeSection === squad |

**Key integration invariants:**
- OptimiserPanel derives ScoredPlayer[] via computeAllGemScores(useMemo(...)) -- same pattern as TransferPanel
- useOptimiser receives pre-computed ScoredPlayer[] as a parameter
- Budget arithmetic: always integer tenths (now_cost=65 stays 65 until display)
- Source of truth: always useSquad() / useMyTeam() -- never planResult

**Algorithm per sub-problem:**

| Sub-problem | Algorithm |
|---|---|
| Best 11 + formation from current 15 | TypeScript enumeration of C(15,11)=1,365 subsets |
| Captain selection | Sort starters by xPts_90th_1gw descending |
| Bench order | Sort outfield bench by xPts_1gw descending; GK isolated at slot 0 |
| Transfer-aware 1-2 FT | Reuse generatePlan() pattern + computeHitCost |
| Wildcard / Free Hit | Same enumeration; candidate pool = all players within budget |
| Standalone squad builder | Greedy by xPts/cost efficiency with positional quotas and club cap |

---

## Watch Out For

### 1. Formation constraints are six rules, not one (CRITICAL)

"Best 11 by xPts" without constraints produces invalid lineups (e.g., 1 GK + 5 DEF + 5 MID + 0 FWD). Must encode all six bounds simultaneously: exactly 1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD, exactly 11 total.

**Prevention:** Encode as integer bounds on position counts before ranking. Unit test with degenerate squads: all-MID squad (assert at least 1 FWD); 5-DEF squad (assert formation valid).

### 2. Three-per-club cap applies to all 15, not just the XI (CRITICAL)

The club limit is a squad-level rule. A builder that only checks the starting XI can produce an illegal bench. Transfer-aware mode must re-check after each simulated transfer.

**Prevention:** Assert max club count across all 15 <= 3 before emitting any recommendation. Unit test: 3 Arsenal players in squad -- optimiser must not suggest a 4th regardless of xPts.

### 3. BGW players must be hard-excluded from starters, not merely penalised (HIGH)

A greedy algorithm may still start BGW players (xPts=0) if all position candidates have low xPts. In FPL, a BGW player scores exactly 0 -- guaranteed, not probabilistic.

**Prevention:** Pre-filter: starters = squad.filter(p => fixtureCountForGw(p, targetGw) > 0). Surface a warning if fewer than 11 eligible players exist. Unit test: squad with 8 blanking players -- assert only non-blankers start.

### 4. Budget arithmetic must stay in integer tenths throughout (HIGH)

Float arithmetic on prices creates phantom budget (6.5 + 7.4 = 13.899...). The existing planning-engine.ts and free-transfer-engine.ts already enforce integer tenths -- match this pattern. In transfer-aware mode use MyTeamPickSchema.selling_price, not now_cost -- the 50% haircut on price rises matters.

**Prevention:** Never divide by 10 inside budget loops; divide only at display. Unit test: player bought at 65, now_cost 67 -- assert sell proceeds = 66, not 67.

### 5. Optimiser must always read from useSquad / useMyTeam, never from planResult (MEDIUM)

The Planner's planResult holds a simulated future squad. Reading from it produces confusing results. Free Hit mode output must also be scoped as this GW only -- the existing computeNextFTState('freehit') handles FT bank passthrough correctly; squad reversion across the Optimiser boundary is the new risk.

**Prevention:** Source squad data exclusively from useSquad() / useMyTeam(). Label Free Hit outputs explicitly as temporary.

**Bonus -- mobile side-by-side layout:** Two 11-player lists at 375px is unreadable. Stack current above optimised on mobile with a "Changes: X players" badge and highlight only the diff. Reuse the SquadSnapshotRow accordion pattern from the Planner tab.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Stack | HIGH | Direct inspection of pipeline/requirements.txt, npm tree, and codebase |
| Features | HIGH | Official FPL rules (2025/26) + FPLReview solver documentation |
| Architecture | HIGH | All relevant source files inspected: planning-engine.ts, free-transfer-engine.ts, squad-adapter.ts, types.ts, page.tsx, TransferPanel.tsx |
| Pitfalls | HIGH | FPL rule edge cases from official docs; integration pitfalls from codebase inspection |

**One gap to verify before build starts:** Confirm that xPts_1gw already aggregates over all fixtures in a GW so DGW players naturally score higher. If it only uses the first fixture, DGW handling is broken at source and must be fixed in the pipeline first. (See FEATURES.md TS-06.)

---

## Implications for Roadmap

Suggested phase structure -- 5 phases, each independently shippable:

| Phase | Scope | Rationale |
|-------|-------|-----------|
| A: Lineup Engine + Basic UI | squad-optimiser.ts (lineup mode only), OptimiserPanel, LineupView, OptimiserControls (horizon only), Squad sub-tabs in page.tsx | Core deliverable. Establishes data flow, type shapes, and navigation. All other phases depend on this. |
| B: Captain / VC + Comparison Table | Captain/VC selection logic using xPts_90th_1gw; ComparisonTable showing start/bench changes | Completes the optimise-current-15 feature. Captain logic is one extra output field on OptimisedLineup. Comparison table is the primary user-facing value prop. |
| C: Transfer-Aware Mode | Extend engine with 1-2 FT budget awareness; hit cost logic from free-transfer-engine.ts; ComparisonTable extended with transfer suggestions | Medium complexity. Budget tracking and club-cap re-check per simulated transfer. |
| D: Wildcard / Free Hit Chip Mode | chipMode wildcard or freehit in optimiseLineup; chip toggle buttons in OptimiserControls | Extends Phase C budget tracking to full player pool. Do not conflate chip-is-active with planning-mode. |
| E: Standalone Squad Builder | squad-builder.ts, SquadBuilderPanel; greedy by xPts/cost efficiency; club cap enforced at squad level | Algorithmically distinct (knapsack over 650 players vs slot-filling from 15). Can start after Phase A establishes LineupView patterns. |

**Research flags:**
- Phases A and B: well-established patterns; no research phase needed.
- Phase C and D: consider a research phase if transfer-aware + chip-mode interaction proves complex.
- Phase E: standard greedy knapsack pattern; no research phase needed.

---

## Sources (Aggregated)

- FPL Official Rules 2025/26: https://fantasy.premierleague.com/help/rules
- FPLReview Solver Settings: https://docs.fplreview.com/the-model/solvers/settings/
- FPLReview Transfer Solver vs Linear Optimiser: https://docs.fplreview.com/the-model/solvers/solver-comparison/
- SciPy MILP docs: https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.milp.html
- Linearly Optimising FPL Teams (O'Connor): https://medium.com/@joseph.m.oconnor.88/linearly-optimising-fantasy-premier-league-teams-3b76e9694877
- FPL Auto Subs Explained -- LiveFPL: https://www.livefpl.com/blog/fpl-auto-subs
- Codebase (HIGH confidence): src/lib/planning-engine.ts, src/lib/free-transfer-engine.ts, src/lib/squad-adapter.ts, src/lib/types.ts, src/app/page.tsx, src/components/squad/SquadView.tsx, src/components/transfers/TransferPanel.tsx
