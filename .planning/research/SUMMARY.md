# Project Research Summary

**Project:** FPL Analyst — v1.3 Gameweek Planner
**Domain:** Multi-gameweek FPL transfer sequence planner integrated into an existing personal analytics web app
**Researched:** 2026-04-01
**Confidence:** HIGH

## Executive Summary

The v1.3 milestone adds a multi-gameweek transfer planner as a new tab in an existing, stable FPL Analyst app. The research is grounded entirely in the current codebase rather than generic best practices: ARCHITECTURE.md was produced from direct file inspection, STACK.md from verified npm package versions, and PITFALLS.md from analysis of the specific state models in `transfer-engine.ts` and `squad-adapter.ts`. The recommended approach is additive — a new `PlannerPanel` tab component, a new `multi-gw-planner.ts` pure-function engine, and `immer`/`use-immer` for plan state mutation — with zero changes to the existing data pipeline, hooks, or other tab components.

The core algorithm is a greedy look-ahead (depth 2–3) over transfer candidates, executed client-side in TypeScript. This matches the architectural pattern of all existing engines in the codebase and stays within the ~100ms client-compute budget for a 5-GW horizon. The only new npm dependency is `immer` + `use-immer`, which resolves the deeply-nested state mutation problem without introducing a global store. All UI is hand-written Tailwind CSS, consistent with the rest of the project.

The primary risks are in the planner state model, not the UI. Three pitfalls are catastrophic if built wrong: Free Hit squad reversion (silent data corruption across all subsequent GW steps), squad snapshot reference mutation (edits corrupt earlier plan steps), and incorrect free-transfer threading (phantom hit costs throughout the plan). All three must be addressed in the foundational state model before any UI or scoring layer is built on top. The correct FPL 2025/26 chip rules — particularly that banked transfers are preserved after Wildcard/Free Hit, not reset to 1 — differ from widely-documented pre-2024/25 behaviour and must be encoded from the start.

## Key Findings

### Recommended Stack

The existing stack (Next.js 16, React 19, TypeScript, TanStack Query v5, TanStack Table v8, Tailwind CSS v4, Vitest, Vercel Blob) requires no changes. The planner adds exactly two packages: `immer@^11.1.4` and `use-immer@^0.11.0`. These provide `useImmerReducer` for plan state management — the plan state has 3–5 levels of nesting (horizon → gwStep → transfer → player) where plain `useReducer` spreads are verbose and error-prone. Both packages are confirmed compatible with React 19.2.4. No UI component library, state manager, optimisation solver, or animation library is needed.

**Core technologies:**
- `immer` + `use-immer`: plan state mutation — safe draft mutation syntax for deeply nested GwPlan[] state; eliminates spread boilerplate without changing the useReducer model
- Pure TypeScript greedy look-ahead: algorithm — no library needed; O(beam × candidates × horizon) is well within browser compute limits (~100ms for 5 GWs)
- Custom Tailwind combobox (~50 LOC): player picker UI — consistent with codebase pattern; no headlessui or react-select needed for a single filtered-list component
- Existing TanStack Query hooks (usePlayers, useSquad, useMyTeam, useAuthStatus): data layer — no new API routes required; all planner data is already available via cached queries

### Expected Features

**Must have (table stakes — P1, ship with v1.3):**
- Planner tab in navigation — entry point without which nothing else is accessible
- Horizon selector (1–5 GW) — the defining characteristic of a multi-GW planner
- Free transfer accumulation logic — stateful chain across GW steps; must be correct before anything else
- Budget tracking per GW — load-bearing dependency for auto-suggest, manual edit, and squad snapshot
- Hit cost factored into scoring — net gain = gross gain minus (hits x 4)
- Transfer-by-transfer output table — the core deliverable (GW / Out / In / Cost / Projected gain)
- Auto-suggest optimal sequence (greedy with 2–3 GW look-ahead) — answers the core user question
- DGW/BGW flags in output table — visual flag per GW row; reuses existing fixture count logic
- Chip slots in output (declarative) — user declares chip intent; Wildcard adjusts hit cost
- Fixture difficulty column — reuse existing FixtureBadges component

**Should have (P2, add after core):**
- Squad snapshot per GW — 15-player squad after each step; accordion UI for mobile; high implementation cost but high value
- Manual edit mode — override auto-suggested transfers via player picker; requires the combobox component
- Net projected gain headline number — "Plan value: +N pts net" summary at top of output

**Defer (v1.4+):**
- Save/compare plan drafts (localStorage persistence, Plan A vs Plan B)
- Chip timing recommendation ("Consider Wildcard in GW X")
- Price trend as informational column (surface cost_change_event alongside gain)
- Full-season (GW38) planning — data does not support beyond 5 GWs; proj_pts_Xgw caps at 5

**Hard anti-features (do not build):**
- Automated transfer execution via FPL API — write endpoints are undocumented; risk of account ban
- MILP/LP solver — no stable browser WASM port; greedy is the correct scope for a personal tool
- Real-time squad sync — contradicts the once-daily data refresh design in PROJECT.md

### Architecture Approach

The architecture is strictly additive. `PlannerPanel` is a new component in `src/components/planner/` that mirrors the pattern of the existing `TransferPanel`: it owns all local state (plan config, plan output, edit cursor), calls the same data hooks (sharing TanStack Query cache at the `['players']` key), and passes derived data to dumb child components via props. The planning engine (`multi-gw-planner.ts`) is a pure function called from `useMemo`, matching the pattern of `computeTransferSuggestions`, `computeAllGemScores`, and `computeVerdicts`. No new API routes are needed. The `Tab` union type should be extracted to a shared `src/lib/tabs.ts` file before adding `'planner'` to avoid a three-file change problem.

**Major components:**
1. `src/lib/planner-types.ts` — type definitions (GwTransfer, GwPlan, PlannerConfig); zero dependencies; built first
2. `src/lib/multi-gw-planner.ts` — pure-function planning engine; greedy look-ahead; unit-tested with Vitest
3. `src/components/planner/PlannerPanel.tsx` — orchestrator; owns GwPlan[] state via useImmerReducer; mounts on tab activation
4. `src/components/planner/PlanGwRow.tsx` — dumb component; renders one GW row in the plan table
5. `src/components/planner/PlanSquadSnapshot.tsx` — dumb component; renders 15-player squad grid per GW (collapsed by default)
6. `src/components/planner/PlannerConfig.tsx` — controlled form; horizon selector, FT count, chip availability
7. `src/components/planner/PlanTransferEditor.tsx` — player picker combobox; position-filtered, sorted by proj_pts

### Critical Pitfalls

1. **Free Hit squad reversion (Pitfall 28)** — Free Hit GWs are temporary; the squad must revert to the pre-Free-Hit state for GW N+1. Model this as a state branch (save squad snapshot before FH, restore it after), not as a normal transfer mutation. If built wrong, all subsequent GW state is silently corrupted. Address in PLAN-01/02 before any UI layer.

2. **Squad snapshot reference mutation (Pitfall 31)** — JavaScript reference semantics mean `const nextSquad = currentSquad` shares the same array. Every plan step's output squad must be a deep copy (`squad.map(p => ({...p}))`). Failure means editing GW 3 corrupts the GW 2 snapshot. Address in PLAN-01/02; write unit tests verifying step isolation.

3. **Free transfer threading (Pitfall 33)** — Free transfer count must flow as explicit state through each plan step: `nextFT = min(5, currentFT - used + 1)` if no hit; `= 1` if hit taken. Wildcard/Free Hit chips preserve banked transfers in 2025/26 (not reset to 1 — this differs from pre-2024/25 rules that persist in community resources). Address in PLAN-01/07.

4. **Wildcard banked transfer preservation (Pitfall 29)** — The 2025/26 rule change: playing Wildcard or Free Hit preserves all banked free transfers rather than resetting to 1. Community code and older tutorials reflect the wrong rule. Verify against official FPL rules before coding and add a source comment in the implementation.

5. **DGW/BGW detection is not forward-guaranteed (Pitfall 32)** — Fixtures for GW N+3 and beyond may not yet be announced. An empty fixtures array means "unconfirmed", not BGW. Check fixture count completeness per GW before labelling; fall back to average difficulty (0.5) with an "unconfirmed" UI label when fewer than 18 teams have confirmed fixtures.

6. **Greedy optimisation misses globally superior plans (Pitfall 34)** — Pure single-GW greedy never recommends a justified hit for a DGW target. Use look-ahead depth 2–3: evaluate (GW N, GW N+1) pairs to find sequences where a hit in GW N unlocks superior positioning in GW N+1. GWs 4–5 can use greedy fallback given fixture uncertainty.

## Implications for Roadmap

Based on research, the state model is the non-negotiable foundation. All scoring, UI, and manual-edit features are built on top of it. The suggested phase structure follows the dependency graph from FEATURES.md and the pitfall-to-phase mapping from PITFALLS.md.

### Phase 1: Navigation and Tab Shell
**Rationale:** The planner tab must exist in the nav before any feature can be tested end-to-end. Trivial implementation (two files modified: page.tsx and MobileNav.tsx) but it is the entry point for all subsequent phases.
**Delivers:** Planner tab accessible from bottom nav (mobile) and tab strip (desktop); empty panel mounts without error; Tab union type extracted to shared tabs.ts.
**Addresses:** PLAN-11 (planner tab in nav); Tab union extraction to tabs.ts (tech-debt cleanup before adding 6th tab)
**Avoids:** Three-file duplication problem when adding the Tab literal

### Phase 2: Planner State Model and Types
**Rationale:** The most critical phase in the milestone. The planner state model determines whether Free Hit reversion, squad snapshot isolation, and free transfer threading work correctly. Every subsequent phase depends on this being right.
**Delivers:** `planner-types.ts` (GwTransfer, GwPlan, PlannerConfig); `computeNextFreeTransfers` pure function with Vitest tests covering all edge cases (0 used, 1 used, 2 used, Wildcard, Free Hit, cap at 5); squad snapshot deep-copy pattern established.
**Addresses:** PLAN-01; Pitfalls 28, 29, 31, 33 — all addressed at the model level before any UI builds on top
**Avoids:** Free Hit reversion corruption, squad reference mutation, wrong free transfer accumulation

### Phase 3: Planning Engine (Auto-Suggest)
**Rationale:** The pure-function engine with look-ahead is the algorithmic core of the milestone. It must be built and unit-tested in isolation before any React component touches it, following the codebase's existing pattern of testing engines separately from UI.
**Delivers:** `multi-gw-planner.ts` with `computeMultiGwPlan(picks, allPlayers, config): GwPlan[]`; greedy look-ahead depth 2–3 for first 3 GWs; greedy single-step for GWs 4–5; budget propagation; DGW multiplier using existing fixture data; fixture completeness check before scoring.
**Uses:** `immer`/`use-immer` install; existing `ScoredPlayer`, `SquadPick`, `MergedPlayer.proj_pts_Xgw` types
**Avoids:** Greedy suboptimality pitfall (Pitfall 34); DGW/BGW false-negative pitfall (Pitfall 32); exhaustive look-ahead performance trap (pre-filter to top 10 sell x top 5 buy per position)

### Phase 4: Config UI and Planner Panel Shell
**Rationale:** With types and engine tested, the React layer can be assembled. PlannerPanel owns all state; PlannerConfig is a controlled form component. This phase wires the engine output to plan state via `useImmerReducer`.
**Delivers:** `PlannerConfig.tsx` (horizon selector 1–5, FT count input, chip availability checkboxes); `PlannerPanel.tsx` shell with hooks, useMemo for engine call, and planState initialisation; "Generate Plan" button that populates planState from engine output.
**Implements:** Panel-level state ownership pattern; useMemo for derived plan state

### Phase 5: Transfer Output Table and Hit Cost Scoring
**Rationale:** The transfer-by-transfer table is the primary user-facing output. Hit cost scoring and the net gain headline are part of this phase since they are table columns, not separate UI surfaces.
**Delivers:** `PlanGwRow.tsx`; plan table rendering GW / Chip / Out / In / Hit Cost / Proj Gain per GW; DGW/BGW GW header flags; chip slot badge per GW row; fixture difficulty column via FixtureBadges reuse; "Plan value: +N pts net" headline above table; per-transfer gain breakdown.
**Addresses:** PLAN-02, PLAN-04, PLAN-05, PLAN-06, PLAN-07, PLAN-08, PLAN-09
**Avoids:** Budget estimation labelling (Pitfall 30) — future GW budget figures must carry "estimated" badge; time-decayed confidence display (Pitfall 38)

### Phase 6: Squad Snapshot
**Rationale:** High value but high implementation cost (15-player grid x up to 5 GWs). Accordion UX (collapsed by default, expand per GW) is mandatory for mobile. Deferred until after the transfer table is proven useful.
**Delivers:** `PlanSquadSnapshot.tsx` with accordion expand/collapse per GW; position grouping (GK/DEF/MID/FWD); changed-player highlight; bench player display for Bench Boost GWs.
**Addresses:** PLAN-10; Pitfall 36 (Bench Boost scoring requires all 15 players, not just XI)

### Phase 7: Manual Edit Mode and Player Picker
**Rationale:** The highest-value differentiator. Users need to override auto-suggested transfers with their own knowledge. Requires the custom combobox component.
**Delivers:** `PlanTransferEditor.tsx` (custom combobox ~50 LOC, position-filtered, sorted by proj_pts_Xgw); Edit button per GW row; plan mode toggle (Suggested / Manual); partial re-score from edited GW onwards via `rescoreFromGw(planState, gwIndex, scoredPlayers)` — preserves manual edits to earlier GWs.
**Addresses:** PLAN-03
**Avoids:** Full plan regeneration on single edit (Anti-Pattern 4); plan reset destroying earlier manual edits (UX pitfall)

### Phase Ordering Rationale

- Phases 1–2 are prerequisites for everything: nav entry point and state model correctness are non-negotiable before UI work begins.
- Phase 3 (engine) before Phase 4 (React wiring): pure functions are easier to test and debug without React in the loop.
- Phase 5 (output table) before Phase 6 (squad snapshot): the table is P1; squad snapshot is P2. If time-constrained, the planner ships as useful without squad snapshots.
- Phase 7 (manual edit) last: it is the most complex UI interaction and depends on the output table (Phase 5) being stable.
- The build order aligns with ARCHITECTURE.md's suggested 11-step implementation sequence.

### Research Flags

Phases with well-documented patterns (skip `/gsd:research-phase`):
- **Phase 1** — trivial nav extension; well-established pattern in codebase
- **Phase 4** — identical to TransferPanel setup; codebase provides the template
- **Phase 5** — TanStack Table column config is established; FixtureBadges reuse is direct

Phases that may benefit from a brief research spike during planning:
- **Phase 3** — the look-ahead depth (2 vs 3 GWs) and pre-filter candidate counts affect both quality and performance; worth reviewing fplreview's documented beam width before committing to constants
- **Phase 7** — keyboard accessibility for the custom combobox (ARIA aria-expanded, aria-controls pattern) is the one area where a native ~50 LOC implementation carries real risk; 30 minutes checking the ARIA combobox pattern before building is worthwhile

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified on npm; React 19 peer deps confirmed; no speculative additions |
| Features | HIGH | Table stakes derived from first-principles FPL rules (official, unambiguous) + competitor analysis for differentiators; anti-features well-argued |
| Architecture | HIGH | Based on direct codebase inspection of all touched files; not inferred from generic patterns |
| Pitfalls | HIGH | Critical pitfalls derived from analysis of existing transfer-engine.ts and squad-adapter.ts; chip rules verified against official PL documentation; FT accumulation rule change (2024/25) verified |

**Overall confidence:** HIGH

### Gaps to Address

- **Look-ahead search constants:** The optimal look-ahead depth (2 vs 3 GWs) and candidate pre-filter counts (top N sell x top M buy) are not verified empirically. STACK.md suggests beam width 3–5 and depth 3; PITFALLS.md suggests top 10 sell x top 5 buy per position. These should be validated during Phase 3 implementation via Vitest performance benchmarks before settling on final values.

- **Free transfer cap discrepancy:** PITFALLS.md documents the 2025/26 FT cap as 5 (updated from 2 in previous seasons). FEATURES.md references the cap as 2. This must be resolved against official FPL rules before Phase 2's free transfer accumulation logic is coded. The higher cap (5) should be treated as correct for 2025/26 pending verification.

- **Chip availability API:** ARCHITECTURE.md recommends manual chip availability input (user checks which chips they have) rather than auto-fetching from `entry/{id}/history/`. This avoids a new API route but introduces user friction. If auto-fetch is added post-MVP, it requires a new authenticated route. Flag for Phase 8 if manual input proves high-friction.

- **Budget approximation magnitude:** The `now_cost` vs `selling_price` approximation for future GW budget steps is accepted with a UI label. The exact divergence magnitude across a 5-GW plan has not been quantified. Acceptable for a personal tool but should be reflected in the plan output UI copy.

## Sources

### Primary (HIGH confidence)
- `src/lib/transfer-engine.ts` — ChipState type, computeTransferSuggestions pattern, DGW awareness implementation
- `src/components/transfers/TransferPanel.tsx` — panel-level state ownership pattern, useMemo for derived values
- `src/lib/types.ts` — MergedPlayer.proj_pts_1gw/3gw/5gw fields, FixtureEntry.event_id for DGW detection
- `src/app/page.tsx` — Tab union type, conditional render pattern
- `src/components/nav/MobileNav.tsx` — TABS array structure, Tab type location
- immer npm (v11.1.4 confirmed): https://www.npmjs.com/package/immer
- use-immer npm (v0.11.0 confirmed): https://www.npmjs.com/package/use-immer

### Secondary (MEDIUM confidence)
- fplreview solver comparison: https://docs.fplreview.com/the-model/solvers/solver-comparison/ — confirms greedy/beam approach and look-ahead depth rationale
- Premier Fantasy Tools FPL Planner: https://www.premierfantasytools.com/fpl-planner-intro/ — competitor feature set (chip slots, squad snapshots)
- FPLWatch Transfer Planner: https://fplwatch.com/planner — budget tracking and fixture analysis patterns
- FPLCore Transfer Planner: https://www.fplcore.com/transfer-planner — hit calculation and budget tracking feature precedent
- React state management 2025 (makersden.io) — useReducer recommendation for co-located complex state

### Tertiary (MEDIUM confidence — community sources)
- Efficient Algorithms for Optimising Fantasy Football (dtravers.com) — academic analysis of greedy vs lookahead tradeoffs for FPL
- Ben Crellin's FPL Transfer Planning Sheet (fantasyfootballhub.co.uk) — community planning patterns and user mental models
- FPLStrat App (fplstrat.app) — xG-based FDR and mobile-first positioning precedents

---
*Research completed: 2026-04-01*
*Ready for roadmap: yes*
