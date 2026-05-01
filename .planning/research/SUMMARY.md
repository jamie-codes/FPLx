# Project Research Summary

**Project:** FPL Analyst v1.7 — Decision Assistant
**Domain:** FPL decision assistance — transfers, captaincy, chips, bench, timing advice
**Researched:** 2026-05-01
**Confidence:** HIGH

## Executive Summary

v1.7 adds six decision-assistant features on top of the completed v1.6 Squad Optimiser. The defining research finding is that **zero new packages are required** — every feature is implementable using the existing stack (Next.js 16, React 19, TanStack Query, Tailwind v4, Vitest, Python with numpy/scipy). All six features are built from pure-TypeScript engine functions in `src/lib/` and new React components in `src/components/`, following patterns already established in v1.6. The only genuine work at the data layer is two small Python pipeline additions: surfacing `cs_prob` per player and emitting `xPts_components_3gw`/`xPts_components_5gw` — both arithmetic extensions of functions that already run inside the pipeline.

The recommended build order is dictated by feature dependencies rather than complexity. Fixture Swing Detector and CS Probability are independent of all other v1.7 features and produce engines that the later Lifecycle Labels and Decision Summary features consume. xPts Breakdown is similarly self-contained. These three features form the foundation tier. Lifecycle Labels builds on Fixture Swing. Transfer Opportunity Cost Simulator is isolated. The Weekly Decision Summary is the capstone — it composes all preceding outputs and must be built last.

The primary risk for this milestone is not technical but product-level: the Decision Summary aggregates four separate engines that were never designed to be reconciled, meaning they can produce contradictory recommendations about the same player. A priority hierarchy (`resolveDecisionSummary()`) must be defined in the spec before implementation, not discovered during it. Secondary risks are fixture swing alert noise (too many teams flagged every week) and lifecycle label instability (signals flip weekly near classification boundaries). Both are mitigated by defined thresholds and hysteresis rules documented in PITFALLS.md.

---

## Key Findings

### Stack Additions

**No new npm packages. No new Python packages.** Every v1.7 feature is implementable using the existing validated stack.

| New TypeScript file | Purpose |
|---|---|
| `src/lib/opportunity-cost.ts` | `computeOpportunityCost()` — wraps `suggestTransfers()` across horizons |
| `src/lib/fixture-swing.ts` | `computeFixtureSwings()` — derives swing direction from existing `ClubForm` |
| `src/lib/lifecycle-labels.ts` | `computeLifecycleLabel()` — synthesises existing signals into timing label |
| `src/lib/xpts-breakdown.ts` | `computeXPtsBreakdown()` — derives probability chain from `MergedPlayer` fields |
| `src/lib/cs-probability.ts` | `computeCSProbability()` — mirrors `_cs_prob()` Python formula in TypeScript |

| Pipeline change (Python, no new imports) | Cost |
|---|---|
| Surface `cs_prob_1gw` / `cs_prob_3gw` per player | ~5 lines in existing merge loop |
| Emit `xPts_components_3gw` / `xPts_components_5gw` | ~20 lines extending `_xpts_ngw()` |

All Zod schema and `MergedPlayer` type changes are optional field additions (`?:`), following the existing convention. No breaking changes.

### Expected Features

**Must have (table stakes):**
- Transfer comparison showing Roll / 1-FT / 2-FT / Hit on the same screen — missing = product incomplete
- Net-of-hit-cost xPts gain and per-GW break-even for each transfer option
- Captain and transfer recommendation surfaced together for the user's actual squad
- Any fixture difficulty display for GK/DEF picks (CS% basic form)
- Buy/Hold/Sell verdict retained at minimum for squad players

**Should have (differentiators — no free competitor does these algorithmically):**
- 1/3/5 GW horizon toggle on the transfer comparison
- Quantified fixture swing delta (upcoming ease minus recent ease) — not just absolute difficulty
- Granular timing labels beyond Buy/Hold/Sell: Buy Next Week, Hold One More, Sell Soon, Minutes Trap, Fixture Trap
- Per-component xPts breakdown with appearance probability and minutes factor made explicit
- CS% derived from the same xGA rolling model as xPts (model consistency is the differentiator)
- All five weekly decisions (captain, transfer, bench, chip, risks) on one screen personalised to the actual squad

**Defer to v2+:**
- AI/LLM-generated prose summaries
- Multi-week transfer sequence (already covered by GW Planner v1.3)
- Automated chip activation (irreversible; recommendation-only is correct)
- Mini-league / head-to-head analysis (out of scope per PROJECT.md)
- Injury probability modelling
- Betting odds integration

### Architecture Approach

All six features follow an identical architectural pattern: pure-TypeScript engine function in `src/lib/` (testable via Vitest, no React dependency), called from a new React component or hook in `src/components/` or `src/lib/hooks/`. No new API routes. No new pipeline JSON artifacts beyond small additions to the existing `merged_players.json`. The single source of truth for player data (`usePlayers()` with `['players']` query key) is preserved throughout.

**Major new components:**
1. `opportunity-cost-engine.ts` + `SimulatorTable.tsx` — wraps `suggestTransfers()` for horizon comparison; placed in Squad or Plan
2. `useDecisionSummary.ts` + `DecisionSummaryPanel.tsx` — composite hook composing 4 existing hooks; new Plan > Decision sub-tab
3. `fixture-swing-engine.ts` + `FixtureSwingPanel.tsx` — pure swing delta over `ClubForm`; injected above `FixtureEaseRankingPanel`
4. `lifecycle-labels.ts` + `LifecycleBadge.tsx` — replaces `VerdictBadge` in squad context within Decision Summary
5. `xpts-breakdown.ts` + `XPtsBreakdownCard.tsx` — replaces native `title=` tooltip in `XPtsCell` with hover card
6. `cs-probability.ts` + `CSProbCell.tsx` — new GemTable column, visible in Analysis preset only

**Invariants that must not be broken:**
- `/api/*` routes remain stateless thin Blob readers — no computation, no new routes
- All decision logic stays in pure-TS engine functions, testable in isolation
- `teamId` lifted to `page.tsx`; squad data passed as props, never independently fetched inside child components
- All new `MergedPlayer` fields declared optional in both the TypeScript interface and Zod schema simultaneously

### Critical Pitfalls

1. **Engine conflicts in Decision Summary** — `computeVerdicts()`, `suggestTransfers()`, and `CaptainPicksPanel` can simultaneously recommend HOLD, SELL, and Captain for the same player. Implement a `resolveDecisionSummary()` priority-hierarchy function in the spec before coding. Transfer engine overrides Verdict engine for squad management signals; captain is an independent dimension.

2. **Fixture Swing alert noise** — Without a meaningful threshold the swing detector fires on 12 of 20 teams every week and becomes ignored. Define swing as delta >= 0.20 on the 3 GW ease score; cap output at 4 improving + 4 worsening teams. Group fixtures by `event_id` (not per fixture entry) to avoid DGW double-counting in ease aggregates.

3. **Lifecycle label instability** — Labels computed from continuous signals near classification boundaries flip weekly, destroying manager confidence. Implement hysteresis bands (e.g., require gem_score to fall below 85% of position average before flipping Hold to Sell). Define all thresholds in the spec, not during implementation.

4. **xPts breakdown components do not sum to displayed total** — Rounding at different pipeline stages means `sum(goal_pts, assist_pts, cs_pts, bonus_pts)` may differ from `xPts_1gw` by up to 0.01. Always render sum-of-components as the total in the breakdown UI; never show both simultaneously. Missing appearance points must be either added as a component or explicitly acknowledged in the UI.

5. **FT count default mismatch in Simulator** — Defaulting to `ftCount=1` when unauthenticated makes Roll always appear attractive for users already at the 2-FT cap. When authenticated, derive `ftCount` from the `my-team` API field `free_transfers` (already in `squad-adapter.ts`). Show a prominent FT selector only for unauthenticated state.

---

## Implications for Roadmap

Research identifies five natural build phases, driven by dependency order.

### Phase 1: Fixture Swing Detector + Clean Sheet Probability

**Rationale:** Both are pure client-side computation over data already in `ClubForm` and `MergedPlayer`. No dependencies on any other v1.7 feature. Building these first gives Phase 3 (Lifecycle Labels) and Phase 5 (Decision Summary) a fixture swing engine and CS probability function to call into.

**Delivers:** `fixture-swing-engine.ts`, `FixtureSwingPanel.tsx`, `cs-probability.ts`, `CSProbCell.tsx` (new GemTable Analysis preset column).

**Addresses:** Feature 3 (Fixture Swing Detector), Feature 6 (Clean Sheet Probability)

**Avoids:** DGW double-counting in ease aggregate (group by `event_id`); BGW teams showing non-zero CS%; team-level CS% appearing per-player (group by team, adjust for xmins).

**Research flag:** Standard patterns — skip phase research agent. Pure arithmetic over documented data structures.

---

### Phase 2: Explainable xPts Breakdown

**Rationale:** Self-contained. Depends only on existing `MergedPlayer` fields and `xPts_components_1gw`. Small pipeline extension needed to emit 3GW/5GW component breakdowns. Unblocks Decision Summary which will surface xPts components inline.

**Delivers:** `xpts-breakdown.ts`, `XPtsBreakdownCard.tsx`, pipeline extension for `xPts_components_3gw`/`xPts_components_5gw`, `appearance_pts` component decision.

**Addresses:** Feature 5 (Explainable xPts Breakdown)

**Avoids:** Components-don't-sum pitfall (render sum-of-components as total); appearance points omission (add component or document explicitly); DGW players showing partial breakdown ("breakdown unavailable for DGW" message).

**Research flag:** Standard patterns — skip phase research agent. Formula mirrors existing `_compute_xpts_fixture()` logic; XPtsCell pattern already established.

---

### Phase 3: Player Lifecycle Labels

**Rationale:** Depends on `computeVerdicts()` (existing) and fixture context from Phase 1's `fixture-swing-engine.ts`. `LifecycleBadge` replaces `VerdictBadge` in squad/transfer context for use in Phase 5.

**Delivers:** `lifecycle-labels.ts`, `LifecycleBadge.tsx`, `lifecycle-labels.test.ts`. Modified: `SquadView.tsx`, `TransferPanel.tsx`.

**Addresses:** Feature 4 (Player Lifecycle Labels)

**Avoids:** Label instability (define hysteresis thresholds in spec before coding); overlap with existing four signal systems (lifecycle label synthesises rather than adds to signals in Decision Summary context); Minutes trap misfires on cheap rotators (price-gate at £7.0m+, cross-check xPts-per-£m).

**Research flag:** The label priority map and hysteresis thresholds must be defined in the phase spec before any code is written. Architecture is clear; business rules need precise definition.

---

### Phase 4: Transfer Opportunity Cost Simulator

**Rationale:** Depends only on `suggestTransfers()` (existing, stable) and squad data hooks. Isolated from other v1.7 features. Placed after Phase 3 so the Decision Summary can draw on lifecycle labels alongside transfer recommendations.

**Delivers:** `opportunity-cost-engine.ts`, `SimulatorTable.tsx`. New sub-tab under Squad Simulator or embedded in OptimiserPanel.

**Addresses:** Feature 1 (Transfer Opportunity Cost Simulator)

**Avoids:** FT count default mismatch (read from `my-team` API when authenticated); infinite deferral loop (show deferral cost explicitly); break-even inconsistency across horizon toggle (compute from 1 GW rate only); 2-FT additive combo over-promise (label combos within 1.0 xPts of break-even as "marginal — verify").

**Research flag:** Standard patterns — skip phase research agent. Engine wraps `suggestTransfers()` which is fully built and tested.

---

### Phase 5: Weekly Decision Summary

**Rationale:** Aggregates outputs from all other v1.7 features (captain picks, transfer engine, chip strategy, lifecycle labels, fixture swings). Must be last. The engine conflict problem must be resolved by a `resolveDecisionSummary()` priority hierarchy that is specced before implementation begins.

**Delivers:** `useDecisionSummary.ts`, `DecisionSummaryPanel.tsx`, sub-components (CaptainCard, TransferCard, ChipCard, RiskCard). New nav entry: Plan > Decision.

**Addresses:** Feature 2 (Weekly Decision Summary)

**Avoids:** Engine conflict (Transfer engine overrides Verdict engine for same player in summary); information overload (hard limit of 4 outputs, no inline expansion); cross-query staleness (track oldest source timestamp; Refresh All button invalidates all query caches); horizon mismatch with Squad Optimiser (pin Decision Summary to 1 GW with explicit labelling, or lift horizon to shared state).

**Research flag:** The priority hierarchy for resolving conflicting engine outputs is the highest-risk design decision in this milestone. Spec it explicitly — including the full conflict matrix — before any implementation.

### Phase Ordering Rationale

- Phases 1 and 2 are independent of each other; Phase 1 is ordered first since its CS probability engine feeds into the Phase 2 fixture-adjusted CS% component in the breakdown.
- Phase 3 requires Phase 1's fixture swing engine for the "Buy Next Week" and "Hold One More" label signals.
- Phase 4 is fully independent but placed after Phase 3 so the Decision Summary can draw on lifecycle labels when presenting transfer recommendations.
- Phase 5 is strictly last — it is a composition layer over all preceding phases.

### Research Flags

Phases needing explicit spec work before implementation (not additional research agents):
- **Phase 3 (Lifecycle Labels):** Define the label taxonomy, priority map, and hysteresis thresholds before writing code.
- **Phase 5 (Decision Summary):** Define the `resolveDecisionSummary()` priority hierarchy and 4-output hard limit before implementation.

Phases with standard, well-understood patterns (skip research-phase agent):
- **Phase 1 (Fixture Swing + CS Prob):** Pure arithmetic over documented data structures.
- **Phase 2 (xPts Breakdown):** Mirrors existing pipeline formula in TypeScript; XPtsCell pattern already established.
- **Phase 4 (Simulator):** Wraps `suggestTransfers()` which is already fully built and tested.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase reading; zero-new-packages confirmed by checking every proposed feature against existing types and engines |
| Features | HIGH | Ecosystem survey across 11 FPL tools; table stakes confirmed by presence/absence survey; differentiators confirmed by absence in free tools |
| Architecture | HIGH | Direct codebase reading of all relevant source files; integration patterns confirmed by v1.6 implementations |
| Pitfalls | HIGH | Pitfalls derived from existing codebase invariants and prior v1.6 experience; specific threshold values are recommendations not yet empirically validated |

**Overall confidence:** HIGH

### Gaps to Address

- **Fixture swing threshold calibration:** SWING_THRESHOLD of 0.20 and the 4+4 team cap are reasoned recommendations. After Phase 1 ships, backtest against historical GW data and adjust if the cap is frequently hit or never reached.
- **Lifecycle label hysteresis values:** Specific hysteresis bands must be defined in the Phase 3 spec. Not yet specified anywhere in research.
- **Decision Summary priority hierarchy:** The Transfer-engine-overrides-Verdict-engine rule is established, but the full conflict matrix across all engine combinations and player states has not been exhaustively specced. Phase 5 spec must complete this.
- **Appearance points in xPts breakdown:** Two acceptable resolutions exist (add `appearance_pts` component, or document its absence in the UI). Phase 2 spec must choose one before UI design is finalised.

---

## Sources

### Primary (HIGH confidence — direct codebase reading)
- `src/lib/suggest-transfers.ts`, `src/lib/optimise-lineup.ts`, `src/lib/recommend.ts`, `src/lib/club-form.ts`, `src/lib/chip-strategy-engine.ts`, `src/lib/types.ts` — existing engine and schema ground truth
- `pipeline/merge.py` — `_cs_prob()`, `_compute_xpts_fixture()`, `_xpts_ngw()` implementations
- `src/app/page.tsx` — nav hierarchy and sub-tab state model
- `src/components/gem-table/columns.tsx` — XPtsCell and tooltip pattern
- `.planning/PROJECT.md` — established invariants and Key Decisions

### Secondary (HIGH confidence — ecosystem survey)
- FPLReview, FPL Copilot, FPL.team, Fantasy Football Fix, Fantasy Football Scout — table stakes and differentiator benchmarking
- AllFantasyTips, Fantasy Football Pundit, Never Manage Alone — CS% community expectation
- AllAboutFPL, Fantasy Football Hub — fixture swing analysis methodology and Buy/Hold/Sell timing vocabulary
- Fantasy Football Scout elite manager interviews — Roll value and hit economics

### Tertiary (MEDIUM confidence — reasoned from first principles)
- Fixture swing delta threshold (0.20) — calibrated from normalisation formula, not empirically tested
- Minutes trap price gate (£7.0m+) — community heuristic, not statistically validated
- Decision Summary 4-output hard limit — derived from UX newspaper front page model

---

*Research completed: 2026-05-01*
*Ready for roadmap: yes*
