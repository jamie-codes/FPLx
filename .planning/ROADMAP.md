# Roadmap: FPL Analyst

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-29)
- ✅ **v1.1 Decision Engine** — Phases 7-12 (shipped 2026-03-31)
- ✅ **v1.2 Mobile** — Phases 13-18 (shipped 2026-04-01)
- ✅ **v1.3 Gameweek Planner** — Phases 19-25 (shipped 2026-04-03)
- ✅ **v1.4 Analytics Engine** — Phases 26-35 (shipped 2026-04-29)
- ✅ **v1.5 UX & Polish** — Phases 36-41 (shipped 2026-04-30)
- ✅ **v1.6 Squad Optimiser** — Phases 42-46 (shipped 2026-05-01)
- 🔄 **v1.7 Decision Assistant** — Phases 47-51 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-6) — SHIPPED 2026-03-29</summary>

See `.planning/milestones/v1.0-ROADMAP.md` for full phase details.

- [x] Phase 1: Foundation
- [x] Phase 2: Data Pipeline
- [x] Phase 3: Gem Rating Table
- [x] Phase 4: DefCon Analysis
- [x] Phase 5: Squad View & Transfer Engine
- [x] Phase 6: Club Form, Value Gems & Polish

</details>

<details>
<summary>✅ v1.1 Decision Engine (Phases 7-12) — SHIPPED 2026-03-31</summary>

See `.planning/milestones/v1.1-ROADMAP.md` for full phase details.

- [x] Phase 7-12: Decision engine, explainability, captaincy, auth

</details>

<details>
<summary>✅ v1.2 Mobile (Phases 13-18) — SHIPPED 2026-04-01</summary>

See `.planning/milestones/v1.2-ROADMAP.md` for full phase details.

- [x] Phase 13-18: Mobile nav, responsive tables, dark mode, DGW transfer engine

</details>

<details>
<summary>✅ v1.3 Gameweek Planner (Phases 19-25) — SHIPPED 2026-04-03</summary>

See `.planning/milestones/v1.3-ROADMAP.md` for full phase details.

- [x] Phase 19-25: Transfer planner engine, plan table, squad snapshots, manual edit mode

</details>

<details>
<summary>✅ v1.4 Analytics Engine (Phases 26-35) — SHIPPED 2026-04-29</summary>

- [x] Phase 26: Set Pieces — set-piece taker panel, change alerts, landscape tip
- [x] Phase 27: FDR++ Pipeline — rolling xGA custom difficulty, FixtureEaseRankingPanel
- [x] Phase 28: xPts Engine — Poisson/Bernoulli xPts, XPtsCell tooltip, variance/ceiling
- [x] Phase 29: Regression Detector — BUY/SELL signal from FPL xG/xA delta, Signal column in GemTable
- [x] Phase 30: Differential Tracker — DIFF/TRAP flags, DifferentialBadge, ownership% tooltip
- [x] Phase 31: Captaincy Ceiling — EO-adjusted captain picks, xPts_90th_1gw, CaptainPicksPanel
- [x] Phase 32: Team Target List — xGI%, FixtureEaseRankingPanel expand, top-3 player inline table
- [x] Phase 33: Insights Tab — 11+ pattern statements, 4 categories, tier badges, InsightsTab
- [x] Phase 34: Chip Strategy — BB/TC/FH scoring, 5-cell ease bars, FH squad view, ChipStrategyPanel
- [x] Phase 35: Tech Debt Fixes — 7 audit items resolved (BGW guard, TRAP gate, upload_json, mobile columns)

</details>

<details>
<summary>✅ v1.5 UX & Polish (Phases 36-41) — SHIPPED 2026-04-30</summary>

See `.planning/milestones/v1.5-ROADMAP.md` for full phase details.

- [x] Phase 36: Navigation Consolidation — 3-section hierarchy (Analyse/Plan/Squad), sub-tabs
- [x] Phase 37: GemTable View Presets — Default/Compact/Analysis presets, session-persistent
- [x] Phase 38: Data Freshness UX — "Updated X ago" live ticker, 30s interval, amber stale
- [x] Phase 39: Player Comparison Modal — side-by-side xPts/Gem/fixtures/signals, native dialog
- [x] Phase 40: Accuracy Pipeline — backtest over 5 GWs; xPts 16.7% vs proj_pts 9.0%
- [x] Phase 41: Accuracy UI & Model Rationalisation — AccuracyTab, last-GW actuals, proj_pts removed (22 files)

</details>

<details>
<summary>✅ v1.6 Squad Optimiser (Phases 42-46) — SHIPPED 2026-05-01</summary>

See `.planning/milestones/v1.6-ROADMAP.md` for full phase details.

- [x] Phase 42: xPts Accuracy Improvements — form signal (BLEND_ALPHA=0.4), accuracy gate
- [x] Phase 43: Lineup Engine & Navigator — `optimiseLineup()`, pitch UI, Squad sub-tabs
- [x] Phase 44: Comparison Output — ComparisonTable, HeadlineRow, Promoted/Dropped badges
- [x] Phase 45: Transfer-Aware Mode — `suggestTransfers()`, FtToggle, break-even indicator
- [x] Phase 46: Chip Modes — Wildcard/Free Hit/Bench Boost, ChipModeToggle, ChipSquadView

</details>

<details>
<summary>🔄 v1.7 Decision Assistant (Phases 47-51) — IN PROGRESS</summary>

- [ ] **Phase 47: Fixture Swing Detector & Clean Sheet Probability** — foundation signal engines that unblock phases 48, 49, and 51
- [ ] **Phase 48: Explainable xPts Breakdown** — per-component xPts breakdown card using CS-01 data
- [ ] **Phase 49: Player Lifecycle Labels** — granular timing labels beyond Buy/Hold/Sell, using fixture swing context
- [ ] **Phase 50: Transfer Opportunity Cost Simulator** — Roll/1-FT/2-FT/Hit comparison table across 1/3/5 GW horizons
- [ ] **Phase 51: Weekly Decision Summary** — one-screen decision view composing all preceding v1.7 engines

</details>

## Phase Details

### Phase 47: Fixture Swing Detector & Clean Sheet Probability
**Goal**: Users can see which teams have materially improving or worsening fixtures and accurate CS% for every upcoming fixture — giving proactive buy/sell signals and grounding defensive picks in data
**Depends on**: Phase 46 (v1.6 complete)
**Requirements**: CS-01, CS-02, CS-03, SWG-01, SWG-02, SWG-03, SWG-04
**Success Criteria** (what must be TRUE):
  1. User can see a panel listing teams with materially improving upcoming fixtures (buy signal) and teams with worsening fixtures (sell signal), with the quantified ease delta shown
  2. Fixture swing view is toggleable across 1/3/5 GW windows, consistent with the existing horizon controls elsewhere in the app
  3. User's own squad players belonging to high-swing teams are visually highlighted in the fixture swing panel
  4. User can see CS% per fixture for GK/DEF-relevant teams on the Club Form tab or a dedicated panel, derived from rolling xGA
  5. DGW fixtures show combined CS% using the `1 - (1-p1)*(1-p2)` formula so double-gameweek opportunity is correctly represented
**Plans**: 5 plans (3 waves)
  - [ ] 47-01-PLAN.md — extend ClubForm + MergedPlayer types (past_ease_3gw, swing_*gw, cs_prob_1gw)
  - [ ] 47-02-PLAN.md — TDD: implement past_ease_3gw and swing deltas in computeClubForm
  - [ ] 47-03-PLAN.md — TDD: add cs_prob_1gw aggregation (single/DGW/BGW) to pipeline/merge.py
  - [ ] 47-04-PLAN.md — add CS% column to GemTable (Analysis preset only, mobile hidden)
  - [ ] 47-05-PLAN.md — build FixtureSwingDetector panel + mount + human-verify checkpoint
**Phase notes**: Fixture swing threshold (recommended 0.20 delta, 4+4 team cap) must be confirmed in the plan spec before coding. Group by `event_id` to avoid DGW double-counting in ease aggregates. BGW teams must show zero CS%. `cs_prob_1gw` field addition to `merged_players.json` (~5 pipeline lines) required.
**UI hint**: yes

### Phase 48: Explainable xPts Breakdown
**Goal**: Users can inspect the component-level breakdown of any player's projected score — making the xPts model transparent and grounding the CS component in the specific upcoming fixture
**Depends on**: Phase 47 (CS-01 output required for XPT-03)
**Requirements**: XPT-01, XPT-02, XPT-03, XPT-04
**Success Criteria** (what must be TRUE):
  1. User can expand or hover any player's xPts figure to see a breakdown of all components: appearance probability, goal contribution, assist contribution, clean sheet probability, bonus points, and minutes risk modifier
  2. The sum of displayed components matches the headline xPts_1gw value (within ±0.01 rounding tolerance) — the breakdown total is the canonical figure shown, not both simultaneously
  3. The clean sheet component in the breakdown reflects the CS% for that player's specific upcoming fixture (from Phase 47), not a generic season average
  4. The breakdown is accessible for any player without requiring authentication — no login gate
**Plans**: TBD
**Phase notes**: The appearance points resolution (add `appearance_pts` as an explicit component, or document its absence in the UI) must be decided in the plan spec before UI design. Render sum-of-components as the total to avoid the components-don't-sum pitfall. DGW players may show "breakdown unavailable" if components can't be cleanly attributed.
**UI hint**: yes

### Phase 49: Player Lifecycle Labels
**Goal**: Squad players display granular timing labels that extend beyond Buy/Hold/Sell — giving managers specific action timing (Buy Next Week, Hold One More, Sell Soon, Minutes Trap, Fixture Trap) with a consistent priority hierarchy preventing contradictory signals
**Depends on**: Phase 47 (fixture swing context required for Buy Next Week and Hold One More labels)
**Requirements**: LCL-01, LCL-02, LCL-03
**Success Criteria** (what must be TRUE):
  1. Each squad player in the Transfers view displays exactly one lifecycle label from the set: Buy Next Week, Hold One More, Sell Soon, Minutes Trap, Fixture Trap, Hold, Sell — never two simultaneously
  2. When multiple label conditions apply to the same player, the priority hierarchy resolves to the single highest-priority label (priority order defined in plan spec)
  3. Labels are computed in pure TypeScript over existing `MergedPlayer` fields — loading a squad triggers label computation with no additional API call
**Plans**: TBD
**Phase notes**: The full label taxonomy, priority map, and hysteresis thresholds (e.g., gem_score must fall below 85% of position average before flipping Hold to Sell) must be defined in the plan spec before any code is written. Minutes trap should be gated at £7.0m+ price to avoid misfiring on cheap rotators. Architecture is clear; business rules need precise spec-level definition.
**UI hint**: yes

### Phase 50: Transfer Opportunity Cost Simulator
**Goal**: Users can compare Roll, 1-FT, 2-FT, and Hit options in a single table — with net xPts gain, break-even weeks, and named player-in/player-out pairs for each option — making the cost of inaction and the cost of a hit both explicit
**Depends on**: Phase 46 (`suggestTransfers()` already built; independent of phases 47-49)
**Requirements**: OCS-01, OCS-02, OCS-03, OCS-04, OCS-05
**Success Criteria** (what must be TRUE):
  1. User sees a table with one row per transfer option (Roll / 1-FT / 2-FT / Hit) showing xPts gain net of hit cost and break-even weeks for each row
  2. The Roll row explicitly shows 0 gain, making the cost of inaction visible rather than absent
  3. 1-FT and 2-FT rows each show the specific player-in and player-out names, grounding the comparison in real squad members
  4. The table is toggleable across 1/3/5 GW horizons and updates all values accordingly
  5. Hit options are clearly labelled with the 4pt cost deducted, and the current free transfer count (1 or 2 FTs) is reflected — options requiring a hit are flagged as such
**Plans**: TBD
**Phase notes**: When authenticated, derive `ftCount` from `free_transfers` in the `my-team` API field (already available in `squad-adapter.ts`). When unauthenticated, show a prominent FT selector so Roll is not misleadingly attractive for users at the 2-FT cap. 2-FT additive approximation combos within 1.0 xPts of break-even should be labelled "marginal — verify".
**UI hint**: yes

### Phase 51: Weekly Decision Summary
**Goal**: Users see captain recommendation, transfer recommendation, bench order, chip timing flag, and risk flags on a single screen — no tab-hopping required — with a clear priority order and severity signals
**Depends on**: Phases 47, 48, 49, 50 (composites all preceding v1.7 engines)
**Requirements**: WDS-01, WDS-02, WDS-03, WDS-04, WDS-05
**Success Criteria** (what must be TRUE):
  1. A user with a squad loaded can view all five weekly decision types (captain, transfer, bench order, chip timing, risk flags) on a single screen without navigating to any other tab
  2. Recommendations appear in priority order: captain first, then transfer, then bench, then chip timing, then risks — so the most time-sensitive action is always at the top
  3. Each recommendation card carries a severity badge (High / Medium / Low) indicating urgency
  4. When no squad is loaded, the screen degrades gracefully — captain picks and chip timing cards remain visible; transfer and bench cards are hidden with an explanatory prompt
  5. When the upcoming gameweek is a DGW or BGW, a context flag is shown on the chip timing card affecting the recommendation framing
**Plans**: TBD
**Phase notes**: The `resolveDecisionSummary()` priority hierarchy for conflicting engine outputs (e.g., Transfer engine recommends Sell while Verdict engine recommends Hold for the same player) must be fully specced — including the complete conflict matrix — before implementation begins. Hard limit of 4 visible outputs; no inline expansion. Track oldest source timestamp across all composed hooks; surface a "Refresh All" trigger. Decision Summary pinned to 1 GW horizon explicitly labelled, or horizon lifted to shared state — spec must choose before UI design.
**UI hint**: yes

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-6 | v1.0 | 19 | Complete | 2026-03-29 |
| 7-12 | v1.1 | 15 | Complete | 2026-03-31 |
| 13-18 | v1.2 | 12 | Complete | 2026-04-01 |
| 19-25 | v1.3 | 14 | Complete | 2026-04-03 |
| 26-35 | v1.4 | 10 | Complete | 2026-04-29 |
| 36-41 | v1.5 | 14 | Complete | 2026-04-30 |
| 42-46 | v1.6 | 12 | Complete | 2026-05-01 |
| 47 | v1.7 | 0/5 | Not started | - |
| 48 | v1.7 | 0/TBD | Not started | - |
| 49 | v1.7 | 0/TBD | Not started | - |
| 50 | v1.7 | 0/TBD | Not started | - |
| 51 | v1.7 | 0/TBD | Not started | - |
