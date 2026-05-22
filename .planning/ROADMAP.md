# Roadmap: FPL Analyst

## Milestones

- âœ… **v1.0 MVP** â€” Phases 1-6 (shipped 2026-03-29)
- âœ… **v1.1 Decision Engine** â€” Phases 7-12 (shipped 2026-03-31)
- âœ… **v1.2 Mobile** â€” Phases 13-18 (shipped 2026-04-01)
- âœ… **v1.3 Gameweek Planner** â€” Phases 19-25 (shipped 2026-04-03)
- âœ… **v1.4 Analytics Engine** â€” Phases 26-35 (shipped 2026-04-29)
- âœ… **v1.5 UX & Polish** â€” Phases 36-41 (shipped 2026-04-30)
- âœ… **v1.6 Squad Optimiser** â€” Phases 42-46 (shipped 2026-05-01)
- âœ… **v1.7 Decision Assistant** â€” Phases 47-51 (shipped 2026-05-02)
- âœ… **v1.8 Predictive Intelligence** â€” Phases 52-55 (shipped 2026-05-03)
- âœ… **v1.9 Competitive Intelligence** â€” Phases 56-60 (shipped 2026-05-04)
- **v1.11 Insights & Infrastructure** â€” Phases 66-73 (Phases 66-71 planned; 72-73 complete 2026-05-05)
- **v1.12 Modelling & Refinement** â€” Phases 61-65 (carry-forward) + 74-77 (in progress)
- âœ… **v1.13 Analytics UX & Intelligence** â€” Phases 78-81 (complete 2026-05-08)
- **v1.14 Analytics Depth** â€” Phases 82-85 (started 2026-05-08)
- **v1.15 Pipeline Intelligence** â€” Phases 86-87 (started 2026-05-09)
- **v1.16 Modelling & Trust** â€” Phases 88-96 (started 2026-05-09)
- âœ… **v1.17 End-of-Season Intelligence** â€” Phases 97-101 (shipped 2026-05-12)
- âœ… **v1.18 Forecast Transparency & AI Intelligence** â€” Phases 102-105 (shipped 2026-05-14)
- âœ… **v1.19 AI Quality & Insight Delivery** â€” Phases 106-109 (shipped 2026-05-14)
- âœ… **v1.20 Fixes & Decision Quality** â€” Phases 110-113 (shipped 2026-05-16)
- âœ… **v1.21 Polish, Intelligence & Team News** â€” Phases 114-116 (shipped 2026-05-17)
- âœ… **v1.22 Lineup Intelligence** â€” Phases 117-119 (shipped 2026-05-18)
- âœ… **v1.23 Technical Debt & Test Health** â€” Phases 120-121 (shipped 2026-05-18)
- âœ… **v1.24 End of Season & Off-Season Intelligence** â€” Phases 122-126 (shipped 2026-05-19)
- âœ… **v1.25 Pre-Season Intelligence** â€” Phases 127-129 (shipped 2026-05-20)
- **v1.26 Off-Season Intelligence** â€” Phases 130-135 (active 2026-05-21)

## Phases

<details>
<summary>âœ… v1.0 MVP (Phases 1-6) â€” SHIPPED 2026-03-29</summary>

See `.planning/milestones/v1.0-ROADMAP.md` for full phase details.

- [x] Phase 1: Foundation
- [x] Phase 2: Data Pipeline
- [x] Phase 3: Gem Rating Table
- [x] Phase 4: DefCon Analysis
- [x] Phase 5: Squad View & Transfer Engine
- [x] Phase 6: Club Form, Value Gems & Polish

</details>

<details>
<summary>âœ… v1.1 Decision Engine (Phases 7-12) â€” SHIPPED 2026-03-31</summary>

See `.planning/milestones/v1.1-ROADMAP.md` for full phase details.

- [x] Phase 7-12: Decision engine, explainability, captaincy, auth

</details>

<details>
<summary>âœ… v1.2 Mobile (Phases 13-18) â€” SHIPPED 2026-04-01</summary>

See `.planning/milestones/v1.2-ROADMAP.md` for full phase details.

- [x] Phase 13-18: Mobile nav, responsive tables, dark mode, DGW transfer engine

</details>

<details>
<summary>âœ… v1.3 Gameweek Planner (Phases 19-25) â€” SHIPPED 2026-04-03</summary>

See `.planning/milestones/v1.3-ROADMAP.md` for full phase details.

- [x] Phase 19-25: Transfer planner engine, plan table, squad snapshots, manual edit mode

</details>

<details>
<summary>âœ… v1.4 Analytics Engine (Phases 26-35) â€” SHIPPED 2026-04-29</summary>

- [x] Phase 26: Set Pieces â€” set-piece taker panel, change alerts, landscape tip
- [x] Phase 27: FDR++ Pipeline â€” rolling xGA custom difficulty, FixtureEaseRankingPanel
- [x] Phase 28: xPts Engine â€” Poisson/Bernoulli xPts, XPtsCell tooltip, variance/ceiling
- [x] Phase 29: Regression Detector â€” BUY/SELL signal from FPL xG/xA delta, Signal column in GemTable
- [x] Phase 30: Differential Tracker â€” DIFF/TRAP flags, DifferentialBadge, ownership% tooltip
- [x] Phase 31: Captaincy Ceiling â€” EO-adjusted captain picks, xPts_90th_1gw, CaptainPicksPanel
- [x] Phase 32: Team Target List â€” xGI%, FixtureEaseRankingPanel expand, top-3 player inline table
- [x] Phase 33: Insights Tab â€” 11+ pattern statements, 4 categories, tier badges, InsightsTab
- [x] Phase 34: Chip Strategy â€” BB/TC/FH scoring, 5-cell ease bars, FH squad view, ChipStrategyPanel
- [x] Phase 35: Tech Debt Fixes â€” 7 audit items resolved (BGW guard, TRAP gate, upload_json, mobile columns)

</details>

<details>
<summary>âœ… v1.5 UX & Polish (Phases 36-41) â€” SHIPPED 2026-04-30</summary>

See `.planning/milestones/v1.5-ROADMAP.md` for full phase details.

- [x] Phase 36: Navigation Consolidation â€” 3-section hierarchy (Analyse/Plan/Squad), sub-tabs
- [x] Phase 37: GemTable View Presets â€” Default/Compact/Analysis presets, session-persistent
- [x] Phase 38: Data Freshness UX â€” "Updated X ago" live ticker, 30s interval, amber stale
- [x] Phase 39: Player Comparison Modal â€” side-by-side xPts/Gem/fixtures/signals, native dialog
- [x] Phase 40: Accuracy Pipeline â€” backtest over 5 GWs; xPts 16.7% vs proj_pts 9.0%
- [x] Phase 41: Accuracy UI & Model Rationalisation â€” AccuracyTab, last-GW actuals, proj_pts removed (22 files)

</details>

<details>
<summary>âœ… v1.6 Squad Optimiser (Phases 42-46) â€” SHIPPED 2026-05-01</summary>

- [x] Phase 42: xPts Accuracy Improvements â€” form signal (BLEND_ALPHA=0.4), accuracy gate
- [x] Phase 43: Lineup Engine & Navigator â€” `optimiseLineup()`, pitch UI, Squad sub-tabs
- [x] Phase 44: Comparison Output â€” ComparisonTable, HeadlineRow, Promoted/Dropped badges
- [x] Phase 45: Transfer-Aware Mode â€” `suggestTransfers()`, FtToggle, break-even indicator
- [x] Phase 46: Chip Modes â€” Wildcard/Free Hit/Bench Boost, ChipModeToggle, ChipSquadView

</details>

<details>
<summary>âœ… v1.7 Decision Assistant (Phases 47-51) â€” SHIPPED 2026-05-02</summary>

See `.planning/milestones/v1.7-ROADMAP.md` for full phase details.

- [x] Phase 47: Fixture Swing Detector & Clean Sheet Probability â€” swing signals, cs_prob_1gw, FixtureSwingDetector panel
- [x] Phase 48: Explainable xPts Breakdown â€” appearance_pts component, CSS-only hover card on XPtsCell
- [x] Phase 49: Player Lifecycle Labels â€” 7-label taxonomy, priority cascade, LifecycleLabelBadge
- [x] Phase 50: Transfer Opportunity Cost Simulator â€” Roll/1-FT/2-FT/Hit table, break-even weeks, derivedFtCount
- [x] Phase 51: Weekly Decision Summary â€” 4-card Decision tab (default Squad landing), computeDecisionSeverity

</details>

<details>
<summary>âœ… v1.8 Predictive Intelligence (Phases 52-55) â€” SHIPPED 2026-05-03</summary>

See `.planning/milestones/v1.8-ROADMAP.md` for full phase details.

- [x] Phase 52: xMins Confidence Engine â€” calibrated start_prob, mins_60_prob, sub_risk_label
- [x] Phase 53: Bonus Point Predictor â€” per-player bonus_ev shrinkage estimator
- [x] Phase 54: Price Change Predictor â€” daily rise/fall predictions with confidence tiers
- [x] Phase 55: Bench Order Optimiser â€” benchOrder() EV-ranked autosub-optimal bench

</details>

<details>
<summary>âœ… v1.9 Competitive Intelligence (Phases 56-60) â€” SHIPPED 2026-05-04</summary>

See `.planning/milestones/v1.9-ROADMAP.md` for full phase details.

- [x] Phase 56: FT Engine Fix â€” Wildcard bank preservation, initialFTState useMemo
- [x] Phase 57: Effective Ownership Mode â€” top-5 EO%, 4-mode toggle, Dangerous-to-fade badge
- [x] Phase 58: Mini-League Rival Tracker â€” useRivals p-limit(3), RivalsTab
- [x] Phase 59: Manual Transfer Planner â€” GW-by-GW plan, bank/FT simulation, localStorage
- [x] Phase 60: Transfer Route Tree â€” buildTransferRouteTree, RouteTreeTab, Manual Planner bridge

</details>

### v1.12 Modelling & Refinement â€” Carry-forward (Phases 61-65)

- [x] **Phase 61: MC Simulation Core** â€” 10k sim engine in pipeline, blank%/haul%/floor/ceiling per player per GW *(complete 2026-05-05)*
- [x] **Phase 62: MC Rank Simulator & Captain Integration** â€” 5-GW rank trajectory UI, captain picker MC augmentation *(complete 2026-05-06)*
- [x] **Phase 63: Model Versioning & Calibration Charts** â€” version tags in pipeline, multi-version comparison, calibration reliability diagrams in AccuracyTab *(complete 2026-05-06)*
- [x] **Phase 64: Sensitivity Analysis** â€” fragility engine over transfer candidates + captain picks, amber indicators *(complete 2026-05-06)*
- [x] **Phase 65: Rejection Explainer** â€” "why not?" natural-language engine across GemTable, TransferPanel, SquadView *(complete 2026-05-06)*

### v1.11 Insights & Infrastructure (Phases 66-71)

- [ ] **Phase 66: Fixture Heat Map** â€” 20 teams Ã— 8 GWs colour-coded grid, DGW highlighted, BGW blank
- [ ] **Phase 67: LLM Prose Summaries** â€” Claude API weekly prose summary grounded in structured model output, manual refresh button
- [ ] **Phase 68: In-App Alert System** â€” price/injury/set-piece change banners, deadline countdown, dismissible with localStorage persistence
- [ ] **Phase 69: Event-Based Pipeline Refresh** â€” GitHub Actions deadline-aware triggers (6h/2h/30min/post), stale-data warning UX
- [ ] **Phase 70: Post-GW Review** â€” auto-generated GW review (bench pts, captain delta, vs top-10k), Vercel Blob + `/api/gw-review`
- [ ] **Phase 71: Decision History & Regret Backtester** â€” decision logging per team ID, cumulative ROI dashboard, 2Ã—2 processÃ—outcome matrix
- [x] **Phase 72: Lineup Optimiser** â€” recommend optimal starting XI + bench order from squad using xPtsÃ—start_prob, formation-constraint solver, overridable team sheet UI (LINEUP-01) âœ“ 2026-05-05
- [x] **Phase 73: Post-GW Review** â€” 5th Squad sub-tab showing last 3 settled GWs: bench pts left, captain delta vs optimal, top scorer, FPL average score; pipeline writes `gw_review_gw{N}.json` to Vercel Blob (PGW-01, PGW-02) âœ“ 2026-05-05

### v1.12 Modelling & Refinement â€” New Phases (74-77)

- [x] **Phase 74: Transfer Engine Overhaul** â€” 3-per-team cap enforcement, duplicate transfer bug fix, multi-hit view (1FT/2FT/âˆ’4/âˆ’8), bank balance auto-pull and feasibility checks (complete 2026-05-06)
- [x] **Phase 75: Fixture Heat Map v2** â€” opponent labels per cell, owned-team filtering and row highlighting, user-selectable horizon (8/12/16 GWs), ATT/DEF difficulty toggle *(complete 2026-05-07)*
- [x] **Phase 76: Analytics Enhancements** â€” routes_to_points pipeline score + GemTable column, Accuracy GW row drill-down, LineupTab manual captain/VC override *(complete 2026-05-07)*
- [x] **Phase 77: Pitch Visuals & Mobile Polish** â€” LineupTab kit art with placeholder fallback, Decision tab captain card overflow fix, full mobile layout audit on 390â€“430px viewport *(complete 2026-05-07)*

<details>
<summary>âœ… v1.18 Forecast Transparency & AI Intelligence (Phases 102-105) â€” SHIPPED 2026-05-14</summary>

See `.planning/milestones/v1.18-ROADMAP.md` for full phase details.

- [x] Phase 102: MC Gate Activation & MCDistributionBar Display â€” MC_ENABLED=True; MCDistributionBar in XPtsCell; P10/P90 on CaptainPicksPanel *(complete 2026-05-13)*
- [x] Phase 103: Calibration Sparse-Bucket Fix & Health Indicator â€” position-aware thresholds; CalibrationHealthIndicator on Decision Summary *(complete 2026-05-13)*
- [x] Phase 104: TransferPanel Sensitivity & Rejection Explainer Wire-Up â€” computeRejection on sell-side OCS rows; fragility badges on buy candidates *(complete 2026-05-13)*
- [x] Phase 105: NLP-02 Per-Player LLM Insight Route, Hook & UI â€” /api/player-insight (Node.js); usePlayerInsight mutation hook; PlayerInsightSection; two-tier cache; 43/43 tests *(complete 2026-05-13)*

</details>

<details>
<summary>âœ… v1.19 AI Quality & Insight Delivery (Phases 106-109) â€” SHIPPED 2026-05-14</summary>

See `.planning/milestones/v1.19-ROADMAP.md` for full phase details.

- [x] Phase 106: Code Quality Cleanup â€” WR backlog clearance (4 items: transition-all, captain LOW fix, NAV-05 7-pill test, WR-03 no-op)
- [x] Phase 107: NLP-02 Prompt Caching â€” `cache_control: ephemeral` on system prompt; cache token metrics logged
- [x] Phase 108: Batch AI Insight Pre-Generation â€” `pipeline/batch_insights.py`; `INSIGHT_BATCH_ENABLED` gate; Blob read-before-generate in UI route
- [x] Phase 109: MC-Enabled Calibration â€” `haul_prob` as `predicted_rate`; MC/Analytical mode badge on `CalibrationHealthIndicator`; D-11 maxDeviation fix

</details>

<details>
<summary>âœ… v1.20 Fixes & Decision Quality (Phases 110-113) â€” SHIPPED 2026-05-16</summary>

See `.planning/milestones/v1.20-ROADMAP.md` for full phase details.

- [x] Phase 110: GW Review & History Fixes â€” liveMap-sourced top scorer, bench pts, dream team delta sign, captain delta _(2026-05-14)_
- [x] Phase 111: Fixture Heatmap & Planner Cross-Position Fixes â€” partially-played DGW cell, position-lock at all suggestTransfers call sites _(2026-05-15)_
- [x] Phase 112: Optimiser On-Demand & Transfer Suggestion Cap â€” hasRun gate + empty state (OPT-01); capByPosition(3) transfer cap (TFR-02) _(2026-05-15)_
- [x] Phase 113: Transfer Regret Backtester â€” pipeline slim snapshot, computeTransferDelta, API extension, BackTab toggle + chart (BACK-02) _(2026-05-15)_

</details>

## Phase Details

_All milestone phase details archived to `.planning/milestones/`. See the relevant `v{version}-ROADMAP.md` file for each milestone's full phase specifications._

### Phase 47: Fixture Swing Detector & Clean Sheet Probability
**Goal**: Users can see which teams have materially improving or worsening fixtures and accurate CS% for every upcoming fixture â€” giving proactive buy/sell signals and grounding defensive picks in data
**Depends on**: Phase 46 (v1.6 complete)
**Requirements**: CS-01, CS-02, CS-03, SWG-01, SWG-02, SWG-03, SWG-04
**Success Criteria** (what must be TRUE):
  1. User can see a panel listing teams with materially improving upcoming fixtures (buy signal) and teams with worsening fixtures (sell signal), with the quantified ease delta shown
  2. Fixture swing view is toggleable across 1/3/5 GW windows, consistent with the existing horizon controls elsewhere in the app
  3. User's own squad players belonging to high-swing teams are visually highlighted in the fixture swing panel
  4. User can see CS% per fixture for GK/DEF-relevant teams on the Club Form tab or a dedicated panel, derived from rolling xGA
  5. DGW fixtures show combined CS% using the `1 - (1-p1)*(1-p2)` formula so double-gameweek opportunity is correctly represented
**Plans**: 5 plans (3 waves)
  **Wave 1**
  - [x] 47-01-PLAN.md â€” extend ClubForm + MergedPlayer types (past_ease_3gw, swing_*gw, cs_prob_1gw)
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 47-02-PLAN.md â€” TDD: implement past_ease_3gw and swing deltas in computeClubForm
  - [x] 47-03-PLAN.md â€” TDD: add cs_prob_1gw aggregation (single/DGW/BGW) to pipeline/merge.py
  - [x] 47-04-PLAN.md â€” add CS% column to GemTable (Analysis preset only, mobile hidden)
  **Wave 3** *(blocked on Wave 2 completion)*
  - [x] 47-05-PLAN.md â€” build FixtureSwingDetector panel + mount + human-verify checkpoint
  **Cross-cutting constraints:**
  - `cs_prob_1gw?: number` must be written to every player in pipeline before GemTable column can render (Plans 01â†’03â†’04)
  - `ClubForm.swing_*gw` fields must be typed (Plan 01) and computed (Plan 02) before FixtureSwingDetector can consume them (Plan 05)
**Phase notes**: Fixture swing threshold (recommended 0.20 delta, 4+4 team cap) must be confirmed in the plan spec before coding. Group by `event_id` to avoid DGW double-counting in ease aggregates. BGW teams must show zero CS%. `cs_prob_1gw` field addition to `merged_players.json` (~5 pipeline lines) required.
**UI hint**: yes

### Phase 48: Explainable xPts Breakdown
**Goal**: Users can inspect the component-level breakdown of any player's projected score â€” making the xPts model transparent and grounding the CS component in the specific upcoming fixture
**Depends on**: Phase 47 (CS-01 output required for XPT-03)
**Requirements**: XPT-01, XPT-02, XPT-03, XPT-04
**Success Criteria** (what must be TRUE):
  1. User can expand or hover any player's xPts figure to see a breakdown of all components: appearance probability, goal contribution, assist contribution, clean sheet probability, bonus points, and minutes risk modifier
  2. The sum of displayed components matches the headline xPts_1gw value (within Â±0.01 rounding tolerance) â€” the breakdown total is the canonical figure shown, not both simultaneously
  3. The clean sheet component in the breakdown reflects the CS% for that player's specific upcoming fixture (from Phase 47), not a generic season average
  4. The breakdown is accessible for any player without requiring authentication â€” no login gate
**Plans**: 3 plans (2 waves)
  **Wave 1** *(parallel)*
  - [x] 48-01-PLAN.md â€” TDD: extend pipeline _compute_xpts_fixture + _xpts_ngw with appearance_pts; test_merge_xpts_components.py
  - [x] 48-02-PLAN.md â€” extend xPts_components_1gw type in types.ts; update PlayerComparisonModal.test.tsx mocks
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 48-03-PLAN.md â€” refactor XPtsCell with CSS-only hover card, useState mobile toggle, minsRisk prop; extend columns.test.tsx
  **Cross-cutting constraints:**
  - `appearance_pts: number` must be in types.ts (Plan 02) before XPtsCell can render it (Plan 03)
  - Pipeline must produce `appearance_pts` in xPts_components_1gw (Plan 01) before full integration is possible
**Phase notes**: appearance_pts resolved as explicit component (D-01). DGW: summed breakdown (D-05). BGW: no hover card (D-06). Native title tooltip removed and replaced with hover card (D-03). MinsRiskBadge shown below Total row to satisfy XPT-01 minutes risk requirement (D-02).
**UI hint**: yes

### Phase 49: Player Lifecycle Labels
**Goal**: Squad players display granular timing labels that extend beyond Buy/Hold/Sell â€” giving managers specific action timing (Buy Next Week, Hold One More, Sell Soon, Minutes Trap, Fixture Trap) with a consistent priority hierarchy preventing contradictory signals
**Depends on**: Phase 47 (fixture swing context required for Buy Next Week and Hold One More labels)
**Requirements**: LCL-01, LCL-02, LCL-03
**Success Criteria** (what must be TRUE):
  1. Each squad player in the Transfers view displays exactly one lifecycle label from the set: Buy Next Week, Hold One More, Sell Soon, Minutes Trap, Fixture Trap, Hold, Sell â€” never two simultaneously
  2. When multiple label conditions apply to the same player, the priority hierarchy resolves to the single highest-priority label (priority order defined in plan spec)
  3. Labels are computed in pure TypeScript over existing `MergedPlayer` fields â€” loading a squad triggers label computation with no additional API call
**Plans**: 2 plans (2 waves)
  **Wave 1**
  - [x] 049-01-PLAN.md â€” TDD: src/lib/lifecycle-label.ts + lifecycle-label.test.ts (7-label engine, threshold constants, computeLifecycleLabel + computeLifecycleLabels with priority cascade)
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 049-02-PLAN.md â€” LifecycleLabelBadge component + TransferPanel useClubForm wiring + SquadView labels prop swap + sell|sell_soon shortlist trigger + human-verify checkpoint
  **Cross-cutting constraints:**
  - `LifecycleLabel` type and `computeLifecycleLabels` function must exist (Plan 01) before LifecycleLabelBadge can import the union and TransferPanel can call the engine (Plan 02)
  - Plan 02 retains `computeVerdicts` and `Verdict` exports in `src/lib/recommend.ts` so Phase 51 (Decision Summary) can reuse them
**Phase notes**: Label taxonomy locked in 049-RESEARCH.md Â§"Label Taxonomy". Hysteresis: SELL_THRESHOLD = 0.85 (replaces recommend.ts 0.90 for this engine), SELL_SOON_THRESHOLD = 0.90, SWING_THRESHOLD = 0.20 (Phase 47 D-01), MINUTES_TRAP_MIN_COST = 70 (Â£7.0m gate), MINUTES_TRAP_START_PROB = 0.65. Priority cascade: Minutes Trap > Fixture Trap > Buy Next Week > Hold One More > Sell Soon > Sell > Hold. Bench excluded (pick.position >= 12). Null clubForm degrades gracefully (gem-only labels, no crash).
**UI hint**: yes

### Phase 50: Transfer Opportunity Cost Simulator
**Goal**: Users can compare Roll, 1-FT, 2-FT, and Hit options in a single table â€” with net xPts gain, break-even weeks, and named player-in/player-out pairs for each option â€” making the cost of inaction and the cost of a hit both explicit
**Depends on**: Phase 46 (`suggestTransfers()` already built; independent of phases 47-49)
**Requirements**: OCS-01, OCS-02, OCS-03, OCS-04, OCS-05
**Success Criteria** (what must be TRUE):
  1. User sees a table with one row per transfer option (Roll / 1-FT / 2-FT / Hit) showing xPts gain net of hit cost and break-even weeks for each row
  2. The Roll row explicitly shows 0 gain, making the cost of inaction visible rather than absent
  3. 1-FT and 2-FT rows each show the specific player-in and player-out names, grounding the comparison in real squad members
  4. The table is toggleable across 1/3/5 GW horizons and updates all values accordingly
  5. Hit options are clearly labelled with the 4pt cost deducted, and the current free transfer count (1 or 2 FTs) is reflected â€” options requiring a hit are flagged as such
**Plans**: 2 plans (2 waves)
  **Wave 1**
  - [x] 050-01-PLAN.md â€” TDD: src/lib/opportunity-cost.ts + opportunity-cost.test.ts (computeOpportunityCostRows pure mapper, OCSRowKind/OCSRow/MARGINAL_THRESHOLD exports, 16 test cases for OCS-01/02/04/05)
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 050-02-PLAN.md â€” OpportunityCostTable component + TransferPanel wiring (ocsHorizon/ocsFtCount state, derivedFtCount from event_transfers + active_chip, suggestTransfers call, FtToggle + GwToggle in section header) + human-verify checkpoint
  **Cross-cutting constraints:**
  - `computeOpportunityCostRows`, `OCSRow`, `OCSRowKind`, `MARGINAL_THRESHOLD` must exist (Plan 01) before OpportunityCostTable can render and TransferPanel can compose (Plan 02)
  - Existing `computeTransferSuggestions()` "Suggested Transfers" block in TransferPanel is preserved unchanged â€” OCS is additive (RESEARCH.md Â§UI Placement Decision)
  - `free_transfers` is NOT a direct FPL API field â€” derived from `myTeamData.entry_history.event_transfers` + `squadData.active_chip` heuristic (RESEARCH.md Â§FT Count Sourcing); ROADMAP phase note below is corrected by RESEARCH.md
**Phase notes**: When authenticated, `ocsFtCount` is derived from `entry_history.event_transfers` + `active_chip` (the "free_transfers" field referenced in earlier notes does NOT exist on the FPL my-team API â€” see 050-RESEARCH.md Â§Pitfall 1). When unauthenticated, the FT pill toggle defaults to 1 FT and remains the user's manual selector. 2-FT additive approximation combos with `xPtsGain < MARGINAL_THRESHOLD` (1.0) are labelled "Marginal â€” verify".
**UI hint**: yes

### Phase 51: Weekly Decision Summary
**Goal**: Users see captain recommendation, transfer recommendation, chip timing flag, and risk flags on a single screen â€” no tab-hopping required â€” with a clear priority order and severity signals
**Depends on**: Phases 47, 48, 49, 50 (composites all preceding v1.7 engines)
**Requirements**: WDS-01, WDS-02, WDS-03, WDS-04, WDS-05
**Success Criteria** (what must be TRUE):
  1. A user with a squad loaded can view all four weekly decision types (captain, transfer, chip timing, risk flags) on a single screen without navigating to any other tab
  2. Recommendations appear in priority order: captain first, then transfer, then chip timing, then risks â€” so the most time-sensitive action is always at the top
  3. Each recommendation card carries a severity badge (High / Medium / Low) indicating urgency
  4. When no squad is loaded, the screen degrades gracefully â€” captain picks and chip timing cards remain visible; transfer and bench cards are hidden with an explanatory prompt
  5. When the upcoming gameweek is a DGW or BGW, a context flag is shown on the chip timing card affecting the recommendation framing
**Plans**: 2 plans (2 waves)
  **Wave 1**
  - [x] 051-01-PLAN.md â€” TDD: src/lib/decision-severity.ts + decision-severity.test.ts (computeDecisionSeverity pure function for WDS-03/WDS-05; SeverityLevel/DecisionSeverity/ComputeDecisionSeverityArgs exports; 21 test cases covering captain >= 2x boundary, transfer/risk shared rule, chip DGW/BGW HIGH gate)
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 051-02-PLAN.md â€” DecisionSummaryTab component composing v1.7 engines (4 cards: Captain/Transfer/Chip/Risk) + page.tsx wiring (Decision sub-tab as default Squad landing â€” D-10) + human-verify checkpoint
  **Cross-cutting constraints:**
  - `computeDecisionSeverity`, `SeverityLevel`, `DecisionSeverity` must exist (Plan 01) before DecisionSummaryTab can import the rule classifier and drive its four severity badges (Plan 02)
  - DecisionSummaryTab MUST receive identical props to TransferPanel (Phase 43 D-11): `{ teamId, onTeamIdChange, submittedId, onSubmit }`
  - The OCS table inside the Transfer card is mounted with `horizon={1}` and `derivedFtCount` â€” no FtToggle/GwToggle in this card (CONTEXT.md D-05/D-06/D-09)
**Phase notes**: The `resolveDecisionSummary()` priority hierarchy for conflicting engine outputs (e.g., Transfer engine recommends Sell while Verdict engine recommends Hold for the same player) must be fully specced â€” including the complete conflict matrix â€” before implementation begins. Hard limit of 4 visible outputs; no inline expansion. Track oldest source timestamp across all composed hooks; surface a "Refresh All" trigger. Decision Summary pinned to 1 GW horizon explicitly labelled, or horizon lifted to shared state â€” spec must choose before UI design.
**UI hint**: yes

### Phase 52: xMins Confidence Engine
**Goal**: Replace the four-bucket rotation label with calibrated per-player probability distributions â€” `start_prob`, `mins_60_prob`, and a refined `sub_risk_label` â€” so xPts computes appearance and CS components from real probabilities instead of heuristic buckets
**Depends on**: Phase 51 (v1.7 complete)
**Requirements**: MIN-01
**Success Criteria** (what must be TRUE):
  1. Every player in `merged_players.json` carries `start_prob` (sharpened, regularised), `mins_60_prob` (Bernoulli P(â‰¥60 min)), and `sub_risk_label` (5-value enum) written by an extended `pipeline/xmins.py`
  2. `_compute_xpts_fixture` in `merge.py` consumes `mins_60_prob` for CS and appearance scaling, replacing the `min(1.0, xmins/60.0)` approximation
  3. Backward-compatibility preserved: existing `mins_risk` enum remains on `MergedPlayer`; `sub_risk_label` is an additive field
  4. Changes to xPts numerics are gated behind `xmins_v2_enabled` flag in `accuracy_backtest.json`, defaulting OFF until a 5-GW shadow-run shows non-regression
**Plans**: 4 plans (2 waves)
  **Wave 1** *(parallel)*
  - [ ] 052-01-PLAN.md â€” TDD: extend _compute_player_xmins with mins_60_prob, sub_risk_label, position-prior fallback (D-05/D-06/D-08); add SubRiskLabel + optional fields to src/lib/types.ts (same-commit per Pitfall 4)
  - [ ] 052-02-PLAN.md â€” TDD: extend _cs_prob signature with optional mins_60_prob kwarg (D-01); preserve backward-compat default None
  **Wave 2** *(blocked on Wave 1 completion)*
  - [ ] 052-03-PLAN.md â€” wire xmins_v2_enabled flag (D-02): merge_players kwarg threading + copy block + 3 _cs_prob call sites + run.py read + accuracy.py gate write
  - [ ] 052-04-PLAN.md â€” MinsRiskBadge optional mins60Prob prop (D-09) + 3 call-site updates (TransferPanel/CaptaincyPanel/XPtsCell hover, D-10) + Vitest test file + human-verify checkpoint
  **Cross-cutting constraints:**
  - `MergedPlayer.mins_60_prob?: number` field and `SubRiskLabel` type must exist (Plan 01) before Plan 04 can compile the badge prop wiring
  - `_cs_prob` must accept the optional `mins_60_prob` kwarg (Plan 02) before Plan 03 can update the 3 call sites
  - Plans 01 and 02 are parallel-safe (no file overlap); Plans 03 and 04 are parallel-safe (Plan 03 = Python pipeline, Plan 04 = TS UI)
  - D-03 contract: `mins_60_prob` and `sub_risk_label` are ALWAYS written to MergedPlayer regardless of `xmins_v2_enabled` flag â€” only the `_cs_prob` formula swap is gated
**Phase notes**: BGW guard misplacement (Pitfall 1) is a critical anti-pattern â€” `start_prob` and `mins_60_prob` MUST NOT be zeroed in `pipeline/xmins.py` for BGW players; the existing `_compute_xpts_fixture` guard at `merge.py` handles xPts=0 correctly. Same-commit rule (Pitfall 4) for `pipeline/xmins.py` + `src/lib/types.ts` (Plan 01). Tooltip format locked: `<Label> â€” <X>% chance 60+ min` (em-dash U+2014, integer percentage via `Math.round`). Four out-of-scope MinsRiskBadge call sites (SquadView, DecisionSummaryTab, gem-table column cell, PlayerComparisonModal) intentionally deferred per UI-SPEC.md scope.


### Phase 53: Bonus Point Predictor
**Goal**: Replace the flat per-position bonus rate constant with a per-player learned bonus EV derived from BPS history, so xPts captures individual bonus-scoring tendencies (top-3 BPS frequency) instead of a position average
**Depends on**: Phase 52 (sharper mins_60_prob feeds CS/appearance; same merge.py edit window)
**Requirements**: BPS-01
**Success Criteria** (what must be TRUE):
  1. `pipeline/bonus.py` exports `compute_bonus_predictions()` returning per-player `bonus_ev` using a shrinkage estimator (empirical mean blended with position prior, gated at â‰¥4 starts)
  2. `merge.py` replaces `BONUS_RATE[element_type]` lookup with per-player EV; flat rate remains as fallback for insufficient-sample players
  3. `xPts_components_1gw.bonus_pts` sum-integrity preserved: `appearance + goal + assist + cs + bonus == total` within Â±0.01
  4. BPS-CS double-counting mitigated (bonus_ev residualised against cs_prob or split by action type)
  5. Model gated behind `bonus_predictor_enabled` flag; accuracy backtest must show non-regression before flag flips ON


**Plans**: 3 plans (2 waves)
  **Wave 1**
  - [x] 053-01-PLAN.md â€” TDD: pipeline/bonus.py (compute_bonus_predictions, shrinkage estimator, BPS-CS residualisation for GK/DEF) + test_bonus.py
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 053-02-PLAN.md â€” TDD: extend merge.py (_compute_xpts_fixture/_xpts_ngw/_compute_xpts_sigma/merge_players with bonus_predictor_enabled + bonus_ev kwargs); wire run.py compute call + flag read; test_merge_bonus.py + parametrise test_merge_xpts_components.py
  - [x] 053-03-PLAN.md â€” accuracy.py _read_existing_bonus_predictor_flag helper + summary key in compute_accuracy_backtest/_empty_backtest; 3 new tests in test_accuracy.py
  **Cross-cutting constraints:**
  - Plan 01 must ship `pipeline/bonus.py` with `compute_bonus_predictions(bootstrap, summaries, finished_gws)` before Plan 02 can import it in run.py
  - Plans 02 and 03 are parallel-safe (Plan 02 = merge.py + run.py, Plan 03 = accuracy.py + test_accuracy.py â€” no file overlap)
  - BONUS_RATE constant at merge.py line 22 must remain unchanged (Pitfall C1: documented fallback for insufficient-sample players)
  - bonus_predictor_enabled defaults OFF; manual flip after 5-GW shadow run shows non-regression (Phase 52 D-02 mirror)
**Phase notes**: BPS-CS double-counting mitigated for GK/DEF only via residualisation `max(0, bonus_ev_raw - 0.5 * cs_rate)` using historical clean_sheets from element-summary history rows; MID/FWD use plain shrinkage. Position priors `{1:0.30, 2:0.40, 3:0.60, 4:0.70}` match merge.BONUS_RATE exactly. Recent window = last 10 starts, MIN_STARTS_GATE = 4, SHRINKAGE_K = 12. No new HTTP calls â€” reuses the shared `summaries` cache fetched in run.py. Sum-integrity tolerance relaxes to Â±0.02 when both `xmins_v2_enabled` AND `bonus_predictor_enabled` are ON (Pitfall 3).

### Phase 54: Price Change Predictor âœ“ (2026-05-02)
**Goal**: Surface daily rise/fall predictions for FPL player prices â€” with confidence tiers and a progress indicator â€” so managers can act on team-value gains and avoid holding falling assets
**Depends on**: Phase 51 (independent of Phases 52-53; no merge.py dependency)
**Requirements**: PRC-01
**Success Criteria** (what must be TRUE):
  1. `pipeline/price_changes.py` computes per-player `direction` (rise/fall/stable), `confidence_pct`, and `eta_days` from cumulative net-transfer snapshots; `price_changes_snapshot.json` persists daily state
  2. `/api/price-changes` route (USE_BLOB toggle, 30-min cache) serves `price_changes.json`; `usePriceChanges` hook (30-min staleTime) exposes the data
  3. `PriceChangePanel` displays predictions grouped by HIGH/MEDIUM/LOW confidence; surfaced under the Analyse section
  4. Panel shows "early data" flag until â‰¥14 days of snapshots are available; badges suppressed below 70% precision threshold
  5. Cold-start handled: `price_changes.json` seeded to `{ predictions: [] }` so the route never 500s on fresh checkout
**Plans**: 3 plans (3 waves)
  **Wave 1**
  - [x] 054-01-PLAN.md â€” pipeline/price_changes.py (compute_price_change_predictions + 7 pytest cases) + cold-start seed files (git add -f) + run.py integration block after set-piece block
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 054-02-PLAN.md â€” src/lib/types.ts PriceDirection/PriceChangePrediction/PriceChanges; /api/price-changes route (USE_BLOB, s-maxage=1800); usePriceChanges hook (30-min staleTime)
  **Wave 3** *(blocked on Wave 2 completion)*
  - [x] 054-03-PLAN.md â€” PriceChangePanel.tsx (rise/fall sections, inline-style progress bar, tier badges suppressed when snapshot_days < 14, early-data banner) + 4 Vitest cases + page.tsx wiring (SubTab union + SECTIONS entry + render conditional + import) + human-verify checkpoint
  **Cross-cutting constraints:**
  - Plan 01 must ship pipeline/cache/price_changes.json seed file before Plan 02 route can serve cold-start (SC-5)
  - Plan 02 PriceChanges type must exist before Plan 03 PriceChangePanel can compile
  - pipeline/cache/ is gitignored at .gitignore line 43-44; both seed files require git add -f (Pitfall 1 / PATTERNS Critical Note 1)
  - Progress bar MUST use inline style {{ width: `${confidence_pct}%` }} â€” Tailwind JIT does not generate dynamic classes (Pitfall 4)
**Phase notes**: Confidence tier badges (HIGH=red, MEDIUM=amber, LOW=zinc per Phase 51 D-13 severity convention) suppressed below 14 days of snapshot history (D-06). `eta_days === 0` renders "Tonight". Stable predictions filtered out (D-04). GW reset boundary: cumulative_net resets to 0 only when cost_change_event != 0 in new bootstrap reading. Phase 54 is read-only public data â€” no ASVS controls required (RESEARCH.md Â§Security Domain).

### âœ… Phase 55: Bench Order Optimiser (completed 2026-05-03)
**Goal**: Suggest an autosub-optimal bench ordering (positions 1â€“3 outfield + GK slot) weighted by start_prob Ã— xPts EV and respecting FPL formation-legality constraints â€” so the manager's bench actually maximises expected points captured via autosubs
**Depends on**: Phase 52 (consumes sharpened `start_prob` from MIN-01)
**Requirements**: BENCH-01
**Success Criteria** (what must be TRUE):
  1. `benchOrder()` exported from `optimise-lineup.ts` ranks outfield bench slots by `start_prob Ã— xPts_{horizon}` EV, with GK fixed at bench[0]
  2. Formation-legality validator reused from `optimiseLineup` â€” never suggests an order where the top autosub candidate would be skipped due to formation rules
  3. BGW bench players (no fixture this GW) sorted to slot 3 regardless of xPts; DGW bench players correctly double-weighted
  4. BB chip mode detected: panel shows "Bench order doesn't affect score with Bench Boost active"
  5. `optimise-lineup.test.ts` covers: formation-locked slot-1 selection, BGW-to-slot-3 rule, DGW double-weight, BB bypass
**Plans**: 2 plans (1 wave)
  **Wave 1** *(parallel â€” disjoint files)*
  - [x] 055-01-PLAN.md â€” TDD: benchOrder() in src/lib/optimise-lineup.ts (EV/BGW/DGW/formation logic) + 4 BENCH-01 tests in optimise-lineup.test.ts + integration replacing line-136 sort
  - [x] 055-02-PLAN.md â€” BB inline note in OptimiserPanel.tsx (bb-bench-order-note guarded by chipMode === 'bench-boost') + 1 RTL test in OptimiserPanel.test.tsx
  **Cross-cutting constraints:**
  - Plans 01 and 02 touch DISJOINT files (Plan 01 = src/lib/optimise-lineup.{ts,test.ts}; Plan 02 = src/components/optimiser/OptimiserPanel.{tsx,test.tsx}) â€” fully parallel-safe
  - benchOrder() (Plan 01) is a pure function with no chip-mode awareness (D-10); BB note (Plan 02) is purely informational â€” no behavioural coupling between the plans
**Phase notes**: EV formula `start_prob Ã— (player[HORIZON_FIELD[horizon]] ?? 0) Ã— player.fixtures.length` (D-03) auto-handles DGW (Ã—2) and BGW (Ã—0); BGW also forced to bench[3] by explicit partition (D-05/D-06). Formation-flex check is a tie-breaker rank, not exclusion (D-09) â€” invalid candidates still appear in returned array. No new types, no new files beyond extensions to existing ones.

---

_v1.9 phase details archived to `.planning/milestones/v1.9-ROADMAP.md`_

---

### Phase 61: MC Simulation Core
**Goal**: Users can see simulation-derived blank probability, haul probability, floor (10th percentile), and ceiling (90th percentile) for any player for the upcoming GW â€” making the uncertainty of xPts predictions explicit
**Depends on**: Phase 60 (v1.9 complete); reuses `_compute_xpts_fixture` Poisson/Bernoulli parameters from `pipeline/merge.py`
**Requirements**: MC-01, MC-02
**Success Criteria** (what must be TRUE):
  1. `pipeline/simulate.py` runs 10,000 Monte Carlo simulations per player per GW using Poisson goal/assist distributions and Bernoulli CS distributions drawn from the existing xPts pipeline parameters, and writes `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` to each player in `merged_players.json`
  2. User can see blank% and haul% for any player in GemTable row expand â€” "X% chance of blank (â‰¤2 pts) | Y% chance of haul (â‰¥10 pts)"
  3. User can see floor (10th percentile) and ceiling (90th percentile) outcomes for any player, shown alongside the existing xPts headline figure
  4. BGW players show blank% = 100% and haul% = 0% (no fixture = guaranteed blank); DGW players correctly simulate both fixtures and combine
  5. Simulation results are written once per pipeline run and consumed as static JSON â€” no client-side simulation, no added latency on page load
**Plans**: 3 plans (2 waves)
  **Wave 0**
  - [x] 061-01-PLAN.md â€” TDD scaffolding (test_simulate.py 5 RED cases + columns.test.tsx 3 RED MC-row cases + types.ts MergedPlayer 4 optional MC fields)
  **Wave 1** *(parallel â€” disjoint files)*
  - [x] 061-02-PLAN.md â€” pipeline/simulate.py (compute_simulations + _simulate_player + _cs_prob_sim, NumPy vectorized) + run.py integration + requirements.txt numpy>=1.26.0
  - [x] 061-03-PLAN.md â€” XPtsCell hover-card extension (4 MC props + showMC guard + Blank%/Haul%/Floor/Ceiling rows + amber haul threshold + xPts_1gw column threading)
  **Cross-cutting constraints:**
  - Plan 061-01 is Wave 0 (RED tests + types) â€” Plans 02 and 03 both depend on it; Plans 02 and 03 are file-disjoint and run in Wave 1 parallel
  - simulate.py MUST NOT import from merge.py (D-02) â€” re-implement the 3-line _cs_prob inline as _cs_prob_sim
  - simulate.py MUST NOT read JSON files (D-03) â€” xmins_v2_enabled arrives as a parameter from run.py
  - p90_pts overwrites xPts_90th_1gw in the merged JSON (D-05) â€” downstream consumers (captain picker Chase Rank, PlayerComparisonModal) gain MC accuracy with no TS change
  - XPtsCell BGW guard at line 54 and showBreakdown guard at line 60 are NOT modified â€” MC rows show only when window===1 AND all 4 MC props are defined
**UI hint**: yes

### Phase 62: MC Rank Simulator & Captain Integration
**Goal**: Users can simulate where their rank will be after 5 GWs under their current XI vs an alternative XI, and captain recommendations are augmented with MC-derived labels (highest ceiling, lowest floor, best P(haul))
**Depends on**: Phase 61 (requires `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` per player from MC-01/MC-02)
**Requirements**: MC-03, MC-04
**Success Criteria** (what must be TRUE):
  1. User can open a 5-GW rank trajectory simulator that shows P(top-10k), P(rank gain), and P(rank drop) for their current XI lineup
  2. User can define an alternative XI (by swapping players) and see the rank trajectory comparison side-by-side with the current XI
  3. Each captain candidate in `CaptainPicksPanel` shows one augmented MC label â€” "Highest ceiling", "Lowest floor", or "Best P(haul)" â€” with the corresponding simulated value displayed
  4. TC (Triple Captain) decision engine surfaces the player with the highest P(haul) as the TC recommendation, annotated with the simulated probability
  5. Rank simulator degrades gracefully when squad is not loaded â€” shows an explanatory prompt rather than an empty chart
**Plans**: 3 plans (2 waves)
  **Wave 1** *(parallel â€” disjoint files)*
  - [x] 062-01-PLAN.md â€” MC-04: computeMCLabels pure ranker + McLabel badge + TC callout in CaptainPicksPanel
  - [x] 062-02-PLAN.md â€” MC-03 substrate: install recharts, useEntryRank hook, useGwAverage hook + /api/gw-average route, computeXITrajectory + computeBeatTheAverageProb math
  **Wave 2** *(blocked on Plan 02 completion)*
  - [x] 062-03-PLAN.md â€” MC-03 UI: RankSimTab component (4th Plan sub-tab) + page.tsx wiring + MobileNav.test.tsx update + human UAT
  **Cross-cutting constraints:**
  - Plans 01 and 02 touch DISJOINT files (Plan 01 = mc-labels.{ts,test.ts} + CaptainPicksPanel.{tsx,test.tsx}; Plan 02 = rank-sim.{ts,test.ts} + hooks + /api/gw-average + package.json) â€” fully parallel-safe
  - Plan 03 imports recharts (Plan 02 Task 1) and `computeXITrajectory`/`computeBeatTheAverageProb` (Plan 02 Task 4); the page.test.tsx `vi.mock` for RankSimTab MUST land in the SAME plan as the page.tsx import to avoid breaking the existing test suite
  - RankSimTab does NOT receive `bank` from page.tsx (Research Â§Pitfall 7) â€” bank is read from `useSquad`/`useMyTeam` internally
  - Recharts `ComposedChart` (NOT `AreaChart`) when mixing Area + Line; `hide={true}` (NOT `tooltipType="none"`) on confidence-band Areas (Research Â§Pitfalls 1, 6)
  - p10 erase-fill MUST use `fill="var(--background)"` (Research Â§Pitfall 2) â€” verified `--background` declared in src/app/globals.css for both light and dark themes
  - All MC field accesses guard `haul_prob !== undefined` (D-17): TC callout and MC badges are hidden when MC fields absent (pre-Phase 61 cache state)
**Phase notes**: Pure frontend phase + one tiny new API route (`/api/gw-average` reads gw_review_gw{N}.json â€” no pipeline change). Recharts v3.x is a new npm dependency (`@types/recharts` MUST NOT be installed â€” that v1 package is incompatible). `gw_average_pts` sourced from existing gw_review JSON cache (Research Option B), avoiding any `run.py` modification.
**UI hint**: yes

### Phase 63: Model Versioning & Calibration Charts
**Goal**: The accuracy pipeline tracks model version history, and AccuracyTab users can compare accuracy across multiple model versions and inspect calibration reliability diagrams broken out by position
**Depends on**: Phase 60 (v1.9 complete); extends existing `pipeline/accuracy.py` and `AccuracyTab.tsx`
**Requirements**: VER-01, VER-02, CAL-01, CAL-02
**Success Criteria** (what must be TRUE):
  1. Every pipeline run writes a version record to `accuracy_backtest.json` containing: formula version string, data timestamp, and all active gate flag states (xmins_v2_enabled, bonus_predictor_enabled, form_signal_enabled)
  2. AccuracyTab shows a version comparison table with hit rate per version and a delta indicator â€” user can see at a glance whether a model change improved or degraded accuracy
  3. AccuracyTab shows a calibration reliability diagram: for players predicted at each haul% bracket (e.g., 30-40%), the diagram shows the actual observed haul rate â€” a well-calibrated model produces a near-diagonal line
  4. Calibration diagram is broken out by position (GK / DEF / MID / FWD) so position-specific over- or under-confidence is immediately visible
  5. Both version comparison and calibration diagram are populated from static `accuracy_backtest.json` â€” no additional API route or pipeline changes to data flow required beyond `accuracy.py` extensions
**Plans**: 5 plans (5 waves) â€” plan 05 is gap closure
  **Wave 0**
  - [x] 063-01-PLAN.md â€” RED test stubs: 6 Python tests in pipeline/tests/test_accuracy.py covering VER-01 (append/dedup/cold-start) + CAL-01/CAL-02 (structure/sparse-filter/by-position); 6 React tests in AccuracyTab.test.tsx with extended fixture covering VersionHistoryTable + CalibrationSection + PositionTabSelector + legacy-cache suppression
  **Wave 1** *(blocked on Plan 01)*
  - [x] 063-02-PLAN.md â€” Python backend: FORMULA_VERSION='v1.12-a' constant + _read_existing_versions helper + version dedup-append logic + _compute_calibration_data decile bucketing helper; extend compute_accuracy_backtest return dict + _empty_backtest cold-start fallback with new versions/calibration keys
  **Wave 2** *(blocked on Plan 02)*
  - [x] 063-03-PLAN.md â€” TypeScript types: VersionGateFlags, VersionRecord, CalibrationBucket, CalibrationData interfaces in src/lib/types.ts; AccuracySummary gains optional xmins_v2_enabled + bonus_predictor_enabled (Pitfall 6); AccuracyBacktest gains optional versions + calibration
  **Wave 3** *(blocked on Plan 03)*
  - [x] 063-04-PLAN.md â€” React frontend: VersionHistoryTable + GateFlagsCell + formatRecordedAt (Task 1); CalibrationSection + PositionTabSelector + CalibrationTooltip + recharts ComposedChart with type='number' XAxis and ReferenceLine y=x diagonal (Task 2); both sections wired into AccuracyTab return block above GwSummaryTable; preserves unstaged sortable-column additions to GwSummaryTable/HaulterList
  **Cross-cutting constraints:**
  - Plan 01 (Wave 0) is RED-state by design â€” Python tests fail at collection (ImportError on FORMULA_VERSION); React tests fail at TS compile on fixtureWithVersionsAndCalibration `versions`/`calibration` literals
  - Plan 02 turns 6 Python tests GREEN; Plan 03 turns TS compilation GREEN (React runtime tests still RED until Plan 04); Plan 04 turns 6 React tests GREEN
  - Plan 04 MUST read AccuracyTab.tsx from disk (not the committed version) to preserve unstaged sortable-column additions to GwSummaryTable and HaulterList
  - All `versions`/`calibration` field additions are OPTIONAL on existing interfaces (Pitfall 6 â€” backward compat with legacy accuracy_backtest.json caches that pre-date Phase 63)
  - recharts v3.8.1 is already installed (Phase 62); `@types/recharts` MUST NOT be installed (v1 incompatibility)
  - hit_rate in version records uses `overall_xpts_blended_hit` (line 295 of accuracy.py) NOT `overall_xpts_hit` (Pitfall 1)
  - `_read_existing_versions` reads `prev.get('versions', [])` from TOP LEVEL not nested under summary (Pitfall 2); guards `(FileNotFoundError, json.JSONDecodeError, OSError)` mirror existing helpers; dedup uses `if not versions or versions[-1].get('formula_version') != FORMULA_VERSION` to avoid IndexError on empty list (Pitfall 7)
  - XAxis MUST have `type="number"` for the 0-1 numeric domain to be respected (Pitfall 4); sparse buckets are filtered out via `.filter(b => b.sample_n >= 5)` not zeroed (Pitfall 5)
**UI hint**: yes

### Phase 64: Sensitivity Analysis âœ“ Complete (2026-05-06)
**Goal**: Transfer candidates and captain recommendations carry a fragility flag when the recommendation would reverse under plausible adverse conditions â€” making it clear which picks are robust and which are conditional
**Depends on**: Phase 60 (v1.9 complete); operates over existing `MergedPlayer` data in client-side TypeScript
**Requirements**: SENS-01, SENS-02
**Success Criteria** (what must be TRUE):
  1. Every transfer candidate row and every captain recommendation row carries a computed fragility flag â€” "fragile" when the recommendation reverses if start_prob drops below 70%, fixture difficulty worsens by 1 tier, or the action requires a 4pt hit
  2. Fragile recommendations display an amber indicator that is visually distinct from the existing severity badge system â€” not easily confused with High/Medium/Low severity
  3. Each fragile recommendation shows a one-line explanation: "no longer recommended if: [specific condition]" â€” naming the exact condition that would reverse the call
  4. Non-fragile recommendations show no fragility indicator â€” the UI is not cluttered for robust picks
  5. Fragility computation is pure TypeScript over existing `MergedPlayer` fields â€” no new API call, no pipeline change required
**Plans**: 3 plans (2 waves)
  **Wave 1**
  - [x] 064-01-PLAN.md â€” TDD pure function: `computeFragility(player, isTransfer, xPtsGain?)` in src/lib/sensitivity.ts; 7 vitest unit tests (@vitest-environment node) covering D-04/D-07/D-09/D-10 conditions, BGW guard, multi-condition ordering
  - [x] 064-02-PLAN.md â€” TDD shared component: `FragilityNote` in src/components/shared/FragilityNote.tsx (inline âš  + amber text, no filled pill); 4 RTL tests (@vitest-environment jsdom) covering data-testid, aria-hidden, single-prefix multi-reason rendering, visual-distinction guards
  **Wave 2** *(blocked on Plans 01 + 02)*
  - [x] 064-03-PLAN.md â€” Wire-up: TransferPanel.tsx Row 4 injection (single + 2-transfer combo, isTransfer=true with xPtsGain); CaptainPicksPanel.tsx CandidateRow tail injection (isTransfer=false â€” D-09 captain has no hit cost)
**Cross-cutting constraints:**
  - `computeFragility` parameter widened to `MergedPlayer` (not `ScoredPlayer`) so CaptainPicksPanel CandidateRow needs no cast (Pitfall 2)
  - Reasons stored as short fragments ("start_prob < 70%", "harder fixture", "taken as a hit (-4pt)"); FragilityNote prepends "no longer recommended if: " exactly once (Pitfall 4)
  - 2-transfer combo cards have NO Row 3 budget badge â€” fragility note goes immediately after Row 2 (Pitfall 3)
  - FragilityNote MUST NOT use `bg-amber-100`/`bg-amber-900`/`inline-block`/`rounded` â€” those classes belong to filled-pill ecosystem (DangerousToFadeBadge / McLabel / SeverityBadge MEDIUM)
  - Pre-existing TEST-57 captain-picks.test.ts failures (5) are NOT regressions â€” Phase 64 must not introduce additional failures
**UI hint**: yes

### Phase 65: Rejection Explainer âœ“ Complete (2026-05-06)
**Goal**: Users can understand why any player they are curious about did not surface as a transfer target or captain recommendation â€” turning opaque ranking into an auditable, trust-building explanation
**Depends on**: Phase 64 (sensitivity flags inform rejection reasons); operates over existing `MergedPlayer` and recommendation engine outputs
**Requirements**: WHY-01, WHY-02, WHY-03
**Success Criteria** (what must be TRUE):
  1. User can expand any GemTable row and read a natural-language "why not?" explanation for why that player falls below the transfer or captain recommendation threshold â€” covering at least: ownership%, xPts ranking, start probability, fixture difficulty, and any active fragility flag
  2. TransferPanel shows a dedicated callout for any player with >20% ownership who is absent from the transfer candidate list â€” the callout names the player and gives a one-sentence reason ("Salah: already ranked #1 in your squad by xPts â€” no upgrade available at position")
  3. Squad view row expand for an owned player explains why they are not recommended to hold or captain â€” distinguishing between "below xPts threshold", "rotation risk", "difficult fixture", and "fragile recommendation"
  4. All three explainer surfaces (GemTable, TransferPanel callout, SquadView) are computed client-side over existing data â€” loading a page or squad triggers computation with no additional network request
  5. Explanations use plain English with specific values â€” not generic phrases like "not recommended" â€” so the user can act on the reasoning
**Plans**: 5 plans (3 waves)
  **Wave 0**
  - [x] 065-01-PLAN.md â€” RED test stubs: rejection.test.ts (12 cases) + HighOwnershipCallout.test.tsx (7 cases) + ExplainPanel.test.tsx (7 cases)
  **Wave 1** *(parallel â€” disjoint files)*
  - [x] 065-02-PLAN.md â€” TDD: computeRejection() + RejectionResult + thresholds in src/lib/explain.ts (delegates to computeFragility(player, false) and computePositionAverages())
  - [x] 065-03-PLAN.md â€” ExplainPanel rejectionReasons?: string[] prop + new HighOwnershipCallout.tsx component
  **Wave 2** *(parallel â€” disjoint files; blocked on Wave 1 completion)*
  - [x] 065-04-PLAN.md â€” GemTable WHY-01 wiring (getRowCanExpand=>true, desktop expand row hidden sm:table-row, mobile rejection panel appended below dl) + manual UAT
  - [x] 065-05-PLAN.md â€” TransferPanel WHY-02 callout (highOwnershipAbsent useMemo cap-3) + verdicts threading + SquadView WHY-03 per-player rejectionReasons (verdict + fragility translation + captain rejection D-09) + manual UAT
**Cross-cutting constraints:**
  - Plan 01 (Wave 0) ships RED tests; Plan 02 turns rejection.test.ts GREEN; Plan 03 turns ExplainPanel.test + HighOwnershipCallout.test GREEN â€” all three contract files exist before implementation begins
  - Plans 02 and 03 are file-disjoint (explain.ts vs ExplainPanel.tsx + HighOwnershipCallout.tsx) â€” fully Wave 1 parallel-safe
  - Plans 04 and 05 are file-disjoint (GemTable.tsx vs TransferPanel.tsx + SquadView.tsx) â€” fully Wave 2 parallel-safe
  - computeFragility MUST be called with isTransfer=false in computeRejection AND SquadView per-player rejection (Pitfall 4) â€” any true triggers spurious hit-cost reasons
  - parseFloat(player.selected_by_percent) is REQUIRED for ALL ownership comparisons (Pitfall 2) â€” selected_by_percent is a string field
  - Desktop expand row uses className="bg-blue-50 dark:bg-blue-950 hidden sm:table-row" â€” display:block is invalid on <tr> (Pitfall 5)
  - WHY-02 absence detection narrows on s.kind === 'single' (verified opportunity-cost.ts pattern) â€” DO NOT use 'buy' in s narrowing (loses combo handling)
  - SquadView reuses existing POSITION_LABELS const (lines 24-29) â€” DO NOT redeclare
**Phase notes**: Pure client-side TypeScript/React phase â€” no pipeline change, no API change, no new dependencies. computeRejection lives in explain.ts (alongside computeExplanations) per Claude's discretion resolved in UI-SPEC. Adaptive framing threshold: gem_score >= positionAverage AND no fragility AND start_prob >= 0.70 â†’ positive framing; otherwise rejection reasons in fixed D-07 order (rank, rotation, fixture, fragility, ownership). RESEARCH Open Q1 resolution: rejection-context fixture check covers BOTH medium AND hard tiers (broader than fragility's medium-only). RESEARCH Open Q2 resolution: in-squad rank for WHY-02 = starting-XI only (position < 12).
**UI hint**: yes

---

## v1.11 Insights & Infrastructure (Phases 66-71)

### Phase 66: Fixture Heat Map
**Goal**: Users can see at a glance which teams have favourable upcoming runs across the next 8 GWs â€” a single colour-coded grid replaces tab-by-tab fixture inspection and makes long-horizon transfer planning trivially scannable
**Depends on**: Phase 60 (v1.9 complete); reuses existing `attacking_difficulty` per-fixture values from `pipeline/merge.py`
**Requirements**: HEAT-01, HEAT-02, HEAT-03
**Success Criteria** (what must be TRUE):
  1. User can open a fixture heat map showing all 20 PL teams as rows Ã— the next 8 GWs as columns, with each cell colour-coded green (easy) / amber (medium) / red (hard) using existing `attacking_difficulty` thresholds
  2. DGW cells are visually distinguished (split cell or DGW badge) so the manager immediately recognises a double-fixture opportunity; BGW teams display a blank/empty cell for that GW with no colour coding
  3. The full 20Ã—8 grid fits a single desktop screen with no horizontal scrolling â€” all teams and all 8 GWs visible at one glance
  4. Hovering a cell reveals the opponent club name, home/away indicator, and the underlying difficulty value â€” so the colour can be cross-checked against the data
  5. Heat map is reachable from the Analyse section navigation as a dedicated tab
**Plans**: 3 plans (2 waves)
  **Wave 1** *(parallel â€” disjoint files)*
  - [ ] 066-01-PLAN.md â€” pipeline/merge.py FIXTURE_LOOKAHEAD 5â†’16 + src/lib/types.ts upcoming_fixtures comment "next 5"â†’"next 16"
  - [ ] 066-02-PLAN.md â€” TDD: src/components/club-form/FixtureHeatMap.tsx + FixtureHeatMap.test.tsx (12 cases covering HEAT-01/HEAT-02/HEAT-03, groupby event_id, DGW gradient, BGW empty, alphabetical sort, tooltip formats)
  **Wave 2** *(blocked on Plan 02 completion)*
  - [ ] 066-03-PLAN.md â€” src/app/page.tsx wiring (import + SubTab union + SECTIONS Analyse entry + render guard) + src/app/page.test.tsx vi.mock + Phase 66 navigation test
  **Cross-cutting constraints:**
  - Plans 01 and 02 touch DISJOINT files (Plan 01 = pipeline/merge.py + src/lib/types.ts; Plan 02 = src/components/club-form/FixtureHeatMap.{tsx,test.tsx}) â€” fully parallel-safe
  - Plan 03 imports `FixtureHeatMap` from Plan 02; the page.test.tsx vi.mock MUST land in the SAME plan/commit as the page.tsx import to avoid breaking the existing test suite (Pitfall 3 from RESEARCH.md)
**Phase notes**: D-01 FIXTURE_LOOKAHEAD=16 (8 GWs Ã— 2 DGW max). D-02 client-side groupby event_id over upcoming_fixtures, first 8 unique event_ids form columns (derived from union across all teams â€” Pitfall 1). D-03 DGW cells use CSS linear-gradient split-diagonal (inline style; dark-mode hex limitation accepted per Pitfall 2). D-04 DGW tooltip slash-separated; D-08 single-fixture tooltip uses em-dash U+2014. D-05 reuses ClubFormFixture.difficulty_tier directly â€” no new threshold computation. D-06 sub-tab inserted after `'price-changes'` in Analyse SECTIONS, label `'Heat Map'` (mobile and desktop identical). HEAT-03 desktop no-scroll achieved via `min-w-[640px]` table inside `overflow-x-auto` wrapper (20 rows Ã— 8 Ã— 48px â‰ˆ 448px < 1440px viewport). No new API routes, no new hooks â€” `useClubForm()` is the data source.
**UI hint**: yes

### Phase 67: LLM Prose Summaries
**Goal**: Users can read a plain-English weekly summary of the model's top recommendations â€” a Claude-generated paragraph grounded in structured pipeline output (no hallucinated player data) â€” turning numeric rankings into a digestible narrative
**Depends on**: Phase 51 (Decision Summary supplies the structured input â€” captain pick, transfer recommendation, chip flag, risk flags)
**Requirements**: NLP-01, NLP-02
**Success Criteria** (what must be TRUE):
  1. User can read a weekly prose summary on the Decision Summary screen â€” Claude-generated paragraph derived from the same structured engine outputs that drive the four Decision cards, with player names and numeric values quoted verbatim from the structured input (no invented player data)
  2. User can press a "Refresh summary" button to regenerate the prose mid-week (e.g., after price changes, injury news) without waiting for the next pipeline run
  3. Summary regenerates automatically each pipeline run, persisted alongside other pipeline output (Vercel Blob), and served via a typed API route consumed by a TanStack Query hook
  4. When the LLM call fails or quota is exceeded, the screen degrades gracefully â€” falls back to the existing structured Decision cards without blocking the rest of the UI
  5. Generated prose names only players present in the structured model input â€” a guardrail check rejects responses referencing players not in the input set
**Plans**: 3 plans (3 waves)
  **Wave 1**
  - [ ] 067-01-PLAN.md â€” Wave 0 test scaffolds, ProseSummary/ProseRefreshPayload types, shared TS guardrail (prose-guardrail.ts), Anthropic SDK dependencies (Python + npm)
  **Wave 2** *(blocked on Plan 01 completion)*
  - [ ] 067-02-PLAN.md â€” Pipeline path: prose_summary.py + run.py integration + pipeline.yml ANTHROPIC_API_KEY; GET /api/prose-summary route + useProseSummary hook + ProseSummaryBlock mounted in DecisionSummaryTab (payload=null placeholder)
  **Wave 3** *(blocked on Plan 02 completion)*
  - [ ] 067-03-PLAN.md â€” Refresh path: POST /api/prose-summary (zod + maxDuration=30 + Anthropic SDK + retry guardrail), real useProseRefresh mutation, DecisionSummaryTab builds ProseRefreshPayload from existing state + human-verify checkpoint
  **Cross-cutting constraints:**
  - `ProseSummary` and `ProseRefreshPayload` types must exist in src/lib/types.ts (Plan 01) before Plans 02+03 can compile
  - `passesGuardrail` TS module (Plan 01) algorithm MUST be byte-equivalent to `_passes_guardrail` in pipeline/prose_summary.py (Plan 02)
  - Plan 02 lands a stub `useProseRefresh` (no-op mutation) so ProseSummaryBlock compiles without the POST route; Plan 03 replaces the stub with real `useMutation` â€” file path stays the same
  - DecisionSummaryTab passes `payload={null}` in Plan 02 and `payload={proseRefreshPayload}` in Plan 03 â€” same component prop, evolving caller
  - `export const maxDuration = 30` is REQUIRED on the POST route (Pitfall 1: Hobby plan default 10s will silently 504)
  - ANTHROPIC_API_KEY GitHub repo secret + local .env must be configured by user before pipeline merge â€” D-14 graceful skip handles missing key without crash
**Phase notes**: D-01 pipeline writes global squad-agnostic prose covering top-3 captains + top-3 differential gems (recomputed in prose_summary.py from merged_players.json â€” captain_picks.json schema unchanged per Open Question 1 resolution). D-02 prompt input deviates: top-3 captains from merged xPts_1gw, top-3 gems = ownership<15% AND xPts_1gw>0 (Open Question 2 resolution; insights.json contains pattern statements not gems). D-08 model = `claude-haiku-4-5` (alias) for both Python and TS calls. D-12 exact-match guardrail (case-insensitive + whitespace-normalised) implemented twice: src/lib/prose-guardrail.ts + pipeline/prose_summary.py â€” algorithms must agree. D-13 422 â†’ silent UI hide; D-14 Python guardrail double-fail â†’ no Blob write. Open Question 3: prose is QUALITATIVE (no numeric values; cards above already show exact figures). Open Question 4: POST handler reads merged_players.json server-side via USE_BLOB switch â€” body does NOT carry corpus.
**UI hint**: yes

### Phase 68: In-App Alert System
**Goal**: Users see proactive in-app alerts when actionable changes occur since their last visit â€” price moves, injury status flips, set-piece taker changes, and imminent deadlines â€” so they never miss a window to act
**Depends on**: Phase 54 (price change snapshots), Phase 26 (set-piece change detection); both already in production
**Requirements**: ALERT-01, ALERT-02, ALERT-03
**Success Criteria** (what must be TRUE):
  1. User sees an in-app alert banner or notification badge when any of the following have changed since their last visit: a player price rose or fell, a player's injury/availability status changed, or a set-piece taker assignment changed
  2. When a GW deadline is within 24 hours, a live deadline countdown is shown in the alert banner area, updating in real time as the deadline approaches
  3. User can dismiss individual alerts (close button per alert); dismissed alerts do not return on subsequent visits â€” dismissed-state is persisted via localStorage keyed by alert ID
  4. Alerts are computed client-side from existing pipeline outputs (price_changes.json, bootstrap status field, set_piece_changes.json) â€” no new pipeline cron, no server-side state required
  5. Alert area is accessible on every section (top of page, above the section nav) â€” managers see alerts regardless of which tab they land on
**Plans**: TBD
**UI hint**: yes

### Phase 69: Event-Based Pipeline Refresh
**Goal**: Pipeline data is fresh near gameweek deadlines and post-deadline â€” additional GitHub Actions triggers run the pipeline at 6h/2h/30min before each deadline and immediately after, so managers always see current data when it matters most; stale data is surfaced rather than served silently
**Depends on**: Phase 60 (v1.9 complete); extends existing GitHub Actions daily cron in `.github/workflows/pipeline.yml`
**Requirements**: REFRESH-01, REFRESH-02, REFRESH-03
**Success Criteria** (what must be TRUE):
  1. Pipeline runs successfully on additional scheduled GitHub Actions triggers at 6 hours, 2 hours, and 30 minutes before each GW deadline â€” verified by the `last_updated` timestamp in `/api/last-updated` advancing within those windows
  2. Pipeline runs automatically within 1 hour after each GW deadline passes â€” post-deadline transfer activity (auto-substitutes, captain confirmations) is reflected in the merged dataset
  3. When the pipeline has not refreshed within the expected window for the upcoming deadline, the app shows a visible warning ("Last successful run: X ago â€” data may be stale") on every section, replacing the silent stale-serve behaviour
  4. GitHub Actions workflow uses the FPL `events` API to compute deadline-relative trigger times rather than hard-coded cron schedules â€” so a deadline change does not require a workflow file edit
  5. Pipeline failures (any step exits non-zero) leave the previous successful `last_updated` timestamp untouched â€” the staleness warning fires cleanly instead of overwriting good data with broken data
**Plans**: TBD
**UI hint**: yes

### Phase 70: Post-GW Review
**Goal**: After each gameweek settles, users can read an auto-generated GW review â€” bench points left, captain delta vs optimal, top scorer, score vs top-10k template â€” turning each completed GW into a learning moment rather than a number on a leaderboard
**Depends on**: Phase 55 (`benchOrder()` and `optimiseLineup()` supply the optimal-captain comparison), Phase 69 (post-deadline pipeline refresh ensures actual scores are available)
**Requirements**: PGW-01, PGW-02
**Success Criteria** (what must be TRUE):
  1. After each GW settles, user can view a Post-GW Review card showing: total bench points left, their captain pick vs the optimal captain (player name and points delta), their top scorer (player name and points), and their GW score vs the top-10k average
  2. Review data is written by the pipeline to Vercel Blob after each GW settles (post-deadline + after final scores fix) and served via a new `/api/gw-review` route, consumed by a typed TanStack Query hook
  3. Review surfaces in the Squad section as a new "Review" sub-tab (or analogous placement) â€” historic GW reviews are listed by GW number for retrospective browsing
  4. When the pipeline cannot compute a review (GW not yet settled, missing data), the screen degrades gracefully with a clear "GW review will appear once scores finalise" prompt rather than an empty card or error
  5. Review is keyed by team ID â€” a manager loading a different team ID sees the corresponding manager's GW review, not stale state from a previous team
**Plans**: TBD
**UI hint**: yes

### Phase 71: Decision History & Regret Backtester
**Goal**: Users can log their actual decisions each GW and see a cumulative report â€” captain hit rate, transfer ROI, hit break-even rate â€” plus a per-transfer regret backtester with a 2Ã—2 processÃ—outcome matrix, so they learn whether their process is sound regardless of luck
**Depends on**: Phase 70 (post-GW actuals are needed to score logged decisions retrospectively)
**Requirements**: HIST-01, HIST-02, BACK-01, BACK-02
**Success Criteria** (what must be TRUE):
  1. User can log each GW's decisions (captain pick, transfers in/out, chip used if any) via a Decision Log form on the Squad section; logged entries are persisted to Vercel Blob keyed by team ID + GW number
  2. User can view a cumulative Decision Report showing: captain hit rate (% of GWs where captain outscored vice), transfer ROI (xPts gained on bought minus scored by sold at decision time), and hit break-even success rate
  3. For each logged transfer, user can see a retrospective verdict: actual GW outcome (points scored by player bought vs player sold that GW) plus a process grade (Good process = model ranked the buy above the sell at decision time, irrespective of actual outcome)
  4. Regret dashboard displays a 2Ã—2 outcome matrix â€” Good process / Bad outcome, Good process / Good outcome, Bad process / Good outcome, Bad process / Bad outcome â€” with the count of transfers and example player pairs in each quadrant
  5. When no decisions have been logged yet, the Decision Report and Regret matrix degrade gracefully with an explanatory prompt and a one-click jump to the Decision Log form
**Plans**: TBD
**UI hint**: yes

### Phase 72: Lineup Optimiser
**Goal**: Users can see the algorithm's recommended starting XI and bench order on a classic FPL-style pitch layout, and override it via two-tap swap interactions (position-compatibility enforced) â€” turning the existing C(15,11) optimiser output into an interactive team sheet that the manager can adjust for cases the algorithm cannot know
**Depends on**: Phase 43 (`optimiseLineup()` and `benchOrder()` already in `src/lib/optimise-lineup.ts`); reuses `useSquad`/`usePlayers` hooks and `OptimiserPanel`'s empty/loading/error/BGW shell pattern unchanged
**Requirements**: LINEUP-01
**Success Criteria** (what must be TRUE):
  1. User can open the Squad section and click a 4th sub-tab ("Lineup", positioned after Optimiser) to see a pitch-layout team sheet rendering `optimiseLineup(picks, players, 1)`'s recommendation with formation rows (GK / DEF / MID / FWD) and a bench row below
  2. Each player card shows web_name + xPts_1gw (1 decimal) + start_prob percentage (rounded integer); captain card has an amber "C" badge, vice-captain card has a grey "VC" badge
  3. User can tap a starter to arm a swap (amber ring + amber tint), see compatible bench players highlighted (green ring) and incompatible ones dimmed (40% opacity, disabled), then tap a compatible bench player to execute the swap â€” captain/VC and formation string update automatically per FPL rules
  4. Tapping the same armed starter again disarms the swap; tapping the pitch background also clears the armed state; `e.stopPropagation()` on every card prevents accidental disarm via event bubbling
  5. Reset button restores the algorithm's original recommendation; user-made swaps are session-only (no localStorage persistence per D-08); refetches reset overrides as accepted side effect
**Plans**: 2 plans (2 waves)
  **Wave 1**
  - [x] 072-01-PLAN.md â€” `src/lib/lineup-swap.ts` + `src/lib/lineup-swap.test.ts` (pure helpers `isLegalSwap` and `applySwap` â€” GK rule, formation-legality predicate mirroring `optimise-lineup.ts:91-97`, captain/formation recomputation per Pitfalls 2/3)
  **Wave 2** *(blocked on Plan 01)*
  - [x] 072-02-PLAN.md â€” `src/components/squad/LineupTab.tsx` + `LineupTab.test.tsx` (pitch UI, two-tap state machine, override state, Reset) + `src/app/page.tsx` 4-line additive wiring + `page.test.tsx` mock and Lineup sub-tab nav test + manual UAT checkpoint for visual styling / transition feel / mobile viewport
  **Cross-cutting constraints:**
  - Plan 02 imports `isLegalSwap` and `applySwap` from Plan 01 â€” sequential dependency
  - All 9 CONTEXT.md decisions (D-01..D-09) and all 7 RESEARCH.md pitfalls (Pitfall 1: `xPts_1gw !== 0` BGW filter; 2: captain recompute; 3: formation string update; 4/5: full `isLegalSwap` validator; 6: refetch reset accepted; 7: `e.stopPropagation()` on every card) MUST be encoded â€” acceptance criteria in each task grep-verify the load-bearing patterns
**Phase notes**: Pure UI phase â€” no pipeline change, no scoring formula change. D-01 `xPts_1gw` already embeds `start_prob` (no re-multiplication â€” would double-count per `pipeline/merge.py` CR-02). D-02 horizon=1 only (no toggle). D-04 cards: web_name + xPts.toFixed(1) + Math.round(start_prob Ã— 100) + "%". D-05 captain logic copied verbatim from `optimise-lineup.ts:57-58` (`xPts_90th_1gw ?? xPts_1gw ?? 0`). D-07 GK only swaps with GK; outfield cross-position allowed iff resulting formation in {3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1}. D-08 session-only â€” no localStorage. D-09 4th sub-tab in Squad section after Optimiser. UI-SPEC two-weight typography contract (400/600 only â€” `font-bold` is forbidden per the captain badge specification reduced from `font-bold` to `font-semibold`).
**UI hint**: yes

### Phase 73: Post-GW Review
**Goal**: Users can view an auto-generated review for each of the last 3 settled GWs â€” bench points left, captain delta vs optimal, top scorer, GW score vs FPL average â€” via a 5th "Review" sub-tab in the Squad section with a GW pill toggle, turning each completed GW into a learning moment
**Depends on**: Phase 55 (`benchOrder()` and `optimiseLineup()` supply the optimal-captain comparison); Phase 72 (5th sub-tab after Lineup)
**Requirements**: PGW-01, PGW-02
**Success Criteria** (what must be TRUE):
  1. User can open Squad â†’ "Review" sub-tab and see a GW review card for the most recently settled GW showing: bench points left, their captain vs the optimal captain (player names + points delta), their top scorer (player name + points), and their GW score vs FPL average
  2. Review data is written by the pipeline to Vercel Blob as `gw_review_gw{N}.json` (fields: `gw`, `average_score`) for the last 3 settled GWs; served via `GET /api/gw-review?teamId=&gw=` which merges Blob data with on-demand FPL picks; consumed by `useGwReview` TanStack Query hook
  3. A GW pill toggle (e.g., "GW33 | GW34 | GW35") lets the user switch between the last 3 settled GWs; defaults to most recent settled GW
  4. When GW is not yet settled or Blob file is missing, screen shows "GW review will appear once scores finalise" rather than an error; when no team ID is loaded, shows "Load your squad to see GW reviews"
  5. Review is keyed by team ID â€” switching team ID loads that team's own GW review data, not stale state from a previous team
**Plans**: 3 plans (3 waves)
  **Wave 1**
  - [x] 073-01-PLAN.md â€” Pipeline gw_review writer block in run.py + 3 cold-start seed files (gw_review_gw{33,34,35}.json) force-added to git
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 073-02-PLAN.md â€” GwReview TypeScript interface + GET /api/gw-review route (USE_BLOB switch, direct FPL upstream fetch, captain_delta with pick.multiplier) + useGwReview TanStack Query hook (30 min staleTime)
  **Wave 3** *(blocked on Wave 2 completion)*
  - [x] 073-03-PLAN.md â€” Wave 0 GwReviewTab.test.tsx (4 RTL cases) â†’ GwReviewTab.tsx component (5 state branches, GW pill toggle, UI-SPEC styling) â†’ page.tsx 4 additive edits â†’ MobileNav.test.tsx updated to expect 5 Squad pills
  **Cross-cutting constraints:**
  - Plan 02 imports the GwReview interface created in Plan 02 Task 1; the API route and the hook share that single source of truth in src/lib/types.ts
  - Plan 03 Task 1 (test file) is Wave 0 per VALIDATION.md â€” written BEFORE the component (RED phase); Task 2 implements component to pass tests (GREEN)
  - SETTLED_GWS_PLACEHOLDER constant in page.tsx is hardcoded [33,34,35] for v1 ship â€” derives-from-bootstrap is deferred per RESEARCH.md Open Question 2; UI gracefully degrades when a requested gw lacks a Blob file
  - pipeline/cache/ is gitignored (.gitignore line 44); seed files require `git add -f` (Pitfall 5)
  - API route MUST call FPL upstream directly (Pitfall 1) â€” relative-URL self-fetch fails in Vercel serverless deployments
  - captain_delta MUST use `pick.multiplier` not hardcoded 2 (Pitfall 3 â€” handles Triple Captain where multiplier=3)
**UI hint**: yes

---

## v1.12 Modelling & Refinement (Phases 61-65 carry-forward + 74-77 new)

### Phase 74: Transfer Engine Overhaul
**Goal**: Transfer suggestions correctly enforce the 3-player-per-team cap, never duplicate player moves across multi-transfer plans, and present all four cost scenarios (1FT, 2FT, âˆ’4, âˆ’8) with live bank balance and clear affordability indicators
**Depends on**: Phase 73 (v1.11 complete); extends existing `suggestTransfers()` in `src/lib/optimise-lineup.ts` and `TransferPanel`
**Requirements**: TFX-01, TFX-02, TFX-03, TFX-04, TFX-05
**Success Criteria** (what must be TRUE):
  1. Transfer panel never suggests a player from a team where the user already owns 3 players â€” the 3-per-team cap is silently filtered before any candidate appears
  2. When the user views a 2FT or hit plan, no player appears as both a sell candidate in one step and a buy candidate in another â€” each move involves a distinct player pair
  3. User can view 1FT, 2FT, âˆ’4 hit, and âˆ’8 hit (two hits) scenarios in a single panel without switching views â€” all four rows visible simultaneously
  4. Each scenario row shows the remaining bank balance after the move; unaffordable moves are visually disabled (greyed out or struck through) rather than silently excluded
  5. When authenticated, bank balance is auto-derived from FPL sell prices; when unauthenticated, user can type their bank balance into a field that immediately updates all affordability checks
**Plans**: 4 plans (4 waves)
  **Wave 0**
  - [x] 074-01-PLAN.md â€” extend TransferSuggestion combo cost union to 0|4|8; create opportunity-cost.test.ts scaffold
  **Wave 1** *(blocked on Wave 0 completion)*
  - [x] 074-02-PLAN.md â€” engine: TFX-01 team cap filter, TFX-02 sell-side dedup, always-emit combos (D-06), breakEven cost:8
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 074-03-PLAN.md â€” mapper: 5-row output, bankAfter/isAffordable/disabledReason, derive âˆ’8 Hit row from best 2FT combo (D-07)
  **Wave 3** *(blocked on Wave 2 completion)*
  - [x] 074-04-PLAN.md â€” UI: TransferPanel manualBank state + remove FtToggle/Suggested Transfers; OpportunityCostTable disabled-row treatment + combo-hit-8 badge; human-verify checkpoint
  **Wave 4** *(gap closure â€” blocked on Wave 3)*
  - [x] 074-05-PLAN.md â€” gap closure: CR-01 âˆ’8 Hit fallback for ftCount=1, CR-02 freeTransfers wiring, WR-01/WR-03/WR-04, IN-01 test file dedup, IN-03 Tailwind cleanup
**UI hint**: yes

### Phase 75: Fixture Heat Map v2
**Goal**: The fixture heat map gains opponent labels in every cell, owned-team row highlighting, a user-selectable horizon (8/12/16 GWs), and an ATT/DEF difficulty toggle â€” making it useful for targeted transfer planning rather than just general fixture scanning
**Depends on**: Phase 66 (Fixture Heat Map Phase 1 â€” base grid must exist); Phase 66 plans not yet started, so Phase 75 is sequenced after Phase 66 executes
**Requirements**: HEAT-04, HEAT-05, HEAT-06, HEAT-07, HEAT-08
**Success Criteria** (what must be TRUE):
  1. Every fixture cell in the heat map displays the opponent's abbreviated name (e.g. "MCI", "ARS") so the manager can read who each team plays without hovering
  2. User can press a toggle to show only rows for teams where they own at least one player; full grid is restored when squad is not loaded or toggle is off
  3. Heat map rows for teams where the user owns players are visually highlighted (distinct background or left border) even when the filter is off, so owned-team fixtures stand out at a glance
  4. User can select an 8 GW, 12 GW, or 16 GW horizon using a pill selector â€” the grid expands to the chosen width without layout overflow
  5. User can toggle between attacking difficulty view and defensive difficulty view via a two-button pill â€” both datasets already exist in the pipeline per team per fixture
**Plans**: 2 plans (2 waves)
  **Wave 1**
  - [ ] 075-01-PLAN.md â€” bump LOOKAHEAD pipeline+client 16â†’32, lift tier() export, add lookahead tests (HEAT-06 infra)
  **Wave 2** *(blocked on Wave 1 completion)*
  - [ ] 075-02-PLAN.md â€” extend FixtureHeatMap with HEAT-04..HEAT-08: opponent labels, owned filter, horizon pill, ATT/DEF toggle, owned-row highlight, dark-mode gradient
**UI hint**: yes

### Phase 76: Analytics Enhancements
**Goal**: GemTable gains a sortable Routes to Points column from pipeline data; Accuracy tab GW rows become clickable to reveal flagged players and haulers; LineupTab gains a manual captain/VC override interaction
**Depends on**: Phase 73 (v1.11 complete); Phase 72 (LineupTab exists for OPT-01); extends existing `pipeline/merge.py`, `AccuracyTab.tsx`, and `LineupTab.tsx`
**Requirements**: RTP-01, RTP-02, ACC2-01, OPT-01
**Success Criteria** (what must be TRUE):
  1. Pipeline writes a `routes_to_points` integer (1â€“5) to every player in `merged_players.json` counting their distinct point-scoring routes (pen taker, FK taker, corner taker, primary xG scorer, primary xA provider)
  2. GemTable shows a "Routes" column with the `routes_to_points` value, sortable ascending/descending; column is hidden on mobile portrait view
  3. User can click any GW row in the Accuracy GW Summary table to expand a drill-down panel showing which players were xPts-flagged (predicted haul, actual blank) and which were haulers (substantially outperformed xPts) for that GW, with player names and actual vs predicted points
  4. User can tap any player on the LineupTab pitch to arm a captain assignment (amber "C" badge reassignment); a distinct secondary interaction (e.g. long-press or dedicated VC button) assigns vice-captain; the override is session-only and a Reset button restores the algorithm's recommendation
**Plans**: 4 plans (2 waves)
  **Wave 1** *(parallel â€” no shared files)*
  - [x] 076-01-PLAN.md â€” RTP-01: pipeline routes_to_points post-loop pass + 5 pytest cases (pipeline/merge.py + new pipeline/tests/test_merge_routes.py)
  - [x] 076-03-PLAN.md â€” ACC2-01: AccuracyTab GwSummaryTable expandable rows + Haulers/Flagged-Misses drill-down sub-tables + 6 vitest cases
  - [x] 076-04-PLAN.md â€” OPT-01: LineupTab captain/VC override (per-card Set C / Set VC pills, auto-shuffle, Reset & squad-refresh clears, no localStorage) + 8 vitest cases
  **Wave 2** *(blocked on Wave 1 Plan 01 only)*
  - [x] 076-02-PLAN.md â€” RTP-02: MergedPlayer.routes_to_points type + GemTable Routes column accessor + MOBILE_HIDDEN_COLUMNS entry + 4 vitest cases
**UI hint**: yes

### Phase 77: Pitch Visuals & Mobile Polish
**Goal**: LineupTab renders player kit art alongside names for faster visual scanning; Decision tab captain card no longer overflows its container; all tabs are verified clean on 390â€“430px viewport with no truncation, overflow, or undersized tap targets
**Depends on**: Phase 76 (LineupTab captain override must be complete before kit art is layered on top); Phase 74 (transfer panel layout stable before mobile audit)
**Requirements**: OPT-02, POL-01, POL-02, POL-03
**Success Criteria** (what must be TRUE):
  1. Each player card on the LineupTab pitch displays a team kit image (shirt colours) alongside the player's name â€” a coloured placeholder renders when the image URL is unavailable or fails to load
  2. CaptainPicksPanel on the Decision tab renders entirely within its card container on desktop â€” no content clips the card boundary; card expands vertically or uses an internal scroll region as needed
  3. GemTable and all sub-tables (Accuracy, Rivals, Value Gems, DefCon) render without horizontal overflow on 390â€“430px viewport widths â€” xPts columns and sortable columns are fully visible or the table is explicitly scroll-bounded
  4. Every tab verified individually on a 430px viewport (Galaxy S26+): no truncated text, no misaligned cells, no tap targets below 44px â€” all violations resolved before the phase is marked complete
**Plans**: 2 plans
  - [x] 077-01-PLAN.md â€” OPT-02 kit art on PlayerCard + POL-01 captain row flex-wrap + POL-02 AccuracyTab overflow-x-auto wrappers
  - [x] 077-02-PLAN.md â€” POL-03 Playwright install + 7-tab 430px mobile-overflow audit
**UI hint**: yes

## v1.13 Analytics UX & Intelligence (Phases 78-81)

### Phase 78: UI Visual Foundation
**Goal**: Establish a coherent design system â€” color tokens, typography, and navigation chrome â€” that makes the app feel like a polished analytics product rather than a data debug view
**Depends on**: Phase 77 (v1.12 complete)
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, VIS-05
**Completion date**: 2026-05-08
**Success Criteria** (what must be TRUE):
  1. CSS custom properties define a complete light/dark color token set (background, surface, elevated surface, text, muted, border, primary accent, secondary accent, positive/warning/negative) â€” no hardcoded hex values remain in core layout or card components
  2. App-wide font is Inter or Geist; all numeric data columns use `font-variant-numeric: tabular-nums` so values align vertically in tables
  3. Section tabs (Analyse/Plan/Squad) and sub-tabs render as filled pills with a clearly distinguished active state; navigation is sticky on scroll
  4. A "Last updated X ago" data freshness badge appears in the nav area on every section; badge colour shifts amber when data is >2h stale
  5. Light mode background is softened to off-white (#F7F8FC range); dark mode card background is deep navy (#111827 range); card borders are visible and distinct from background in both modes
**Plans**: 3 (all complete)
  - [x] 078-01-PLAN.md â€” VIS-01/02/05: full CSS token set in globals.css (11 tokens, @theme inline wiring, Arial removed, tabular-nums)
  - [x] 078-02-PLAN.md â€” VIS-03/04: sticky pill nav in page.tsx (rounded-full buttons, bg-surface/95 wrapper, LastUpdated in nav row)
  - [x] 078-03-PLAN.md â€” VIS-03/04: LastUpdated span pill badge + MobileNav token alignment
**Status**: âœ… Complete (2026-05-08)
**UI hint**: yes

### Phase 79: Insight Card Redesign
**Goal**: Every insight card communicates what the data means for FPL decisions â€” title/metric/takeaway/action/confidence layout, meaningful signal badges, mini visualisations â€” replacing the current flat-sentence format
**Depends on**: Phase 78 (design tokens foundation)
**Requirements**: INS-01, INS-02, INS-03, INS-04, INS-05, INS-06
**Success Criteria** (what must be TRUE):
  1. Every insight card has five distinct visual zones: category badge, bold card title (15â€“16px), large headline metric (28â€“36px tabular), plain-English takeaway sentence, and action hint â€” the full card structure is scannable in under 3 seconds
  2. Signal badges use semantic vocabulary â€” "Weak signal", "Watchlist", "Strong signal", "Trap risk", "Regression risk", "Hidden gem" â€” replacing LOW/MEDIUM/HIGH; each badge carries an icon prefix (â—/â–²/âš /â˜…) so meaning is not colour-only
  3. Percentage and rate metrics show an inline mini progress bar with a benchmark reference line so the user immediately sees whether the value is high or low relative to expectation
  4. InsightsTab is divided into labelled sections: Priority Insights (highest-signal), Defensive Patterns, Attacking Patterns, Player-Specific Patterns â€” each section collapsible, with a count badge on the section header
  5. A "Decision Summary" sticky panel at the top of InsightsTab lists the top 3 current actionable angles with affected player/team chips so the user's first scroll reveals what to do today
  6. Each card has a hover/expand area revealing methodology: sample size, GWs covered, confidence rationale â€” so the user can verify the reasoning without leaving the page
**Plans**: 4 plans (3 waves)
  **Wave 1** *(parallel â€” disjoint files)*
  - [x] 079-01-PLAN.md â€” Pipeline extension: `_signal_label()` helper + 11 new structured fields per insight + `pipeline/tests/test_insights.py` + cache regeneration (2026-05-08)
  - [x] 079-02-PLAN.md â€” TypeScript `Insight` interface + `SignalLabel` union + `--nav-height: 96px` token in globals.css (2026-05-08)
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 079-03-PLAN.md â€” InsightsTab rewrite: 5-zone InsightCard, CollapsibleSection, sticky DecisionSummary panel, SIGNAL_CLASSES; component test rewrite (2026-05-08)
  **Wave 3** *(blocked on Wave 2 completion)*
  - [x] 079-04-PLAN.md â€” Integration verification: API passthrough confirmation, full test suites, manual UX checkpoint (sticky scroll + methodology expand) (2026-05-08)
  **Cross-cutting constraints:**
  - Plan 01 regenerates `pipeline/cache/insights.json` to the 17-field shape; Plan 03 cannot ship without it (RESEARCH Pitfall 1)
  - Plan 02 defines `SignalLabel` and `--nav-height`; Plan 03 references both (compile-time enforcement via `Record<SignalLabel, string>`)
  - Plan 03 must satisfy all 6 INS-XX requirements via tests in `InsightsTab.test.tsx` BEFORE Plan 04 verifies integration
**UI hint**: yes

### Phase 80: GW-Specific Intelligence
**Goal**: Users see forward-looking gameweek context insights â€” rotation risk from European/cup fixtures, position-level GW opportunity, table-stakes pressure, DGW/BGW team flags, and player 3-GW fixture-run narratives â€” so every insight is tied to an actionable upcoming window
**Depends on**: Phase 79 (insight card infrastructure); pipeline rotation-risk data new
**Requirements**: GWI-01, GWI-02, GWI-03, GWI-04, GWI-05
**Success Criteria** (what must be TRUE):
  1. Pipeline detects when a PL club has a European or domestic cup fixture within 3 days of a PL fixture and writes a `rotation_risk: true` flag to that team in merged output; the flag is used by the insight engine and is visible in the Set Piece and TransferPanel views
  2. InsightsTab shows a dedicated "This Gameweek" section with GW-specific cards: position-level opportunity this GW (e.g. "defenders offer better value this GW given 12 easy home fixtures"), rotation-risk callouts for affected teams, and DGW/BGW team highlights
  3. Pipeline computes a `table_stakes_label` per team for the final 6 GWs â€” one of: title battle / European chase / relegation battle / nothing-to-play-for â€” and exposes it as a context field influencing squad-selection likelihood narrative
  4. Player fixture-run cards show a 3-GW forward outlook: narrative summary ("Thiago: 3 easy away fixtures â€” prime hold") plus xPts trajectory bar for the next 3 GWs; surfaced for top differentials and high-ownership players
  5. All GW-specific cards display the relevant GW range label (e.g. "GW36â€“38") and degrade to an empty-state placeholder ("GW insights will appear once fixtures are confirmed") rather than error or blank when data is unavailable
**Plans**: 4 plans
  - [x] 080-01-PLAN.md â€” Pipeline data layer: european_cup_dates.py, _xpts_per_gw, gw_intel.py (rotation_risk + table_stakes + compute_gw_intel), run.py wiring, pytest scaffolding
  - [x] 080-02-PLAN.md â€” TypeScript contracts: GWInsight union + rotation_risk field, /api/gw-intel route, useGWIntel hook, RotationRiskBadge component + tests
  - [x] 080-03-PLAN.md â€” InsightsTab "This Gameweek" section: GWIntelSection + 4 card subcomponents + XptsTrajectoryBar; extended test suite
  - [x] 080-04-PLAN.md â€” RotationRiskBadge integration in SetPieceTakerPanel team headers + OpportunityCostTable buy-player rows
**UI hint**: yes

### Phase 81: Team Shields & Visual Identity
**Goal**: Club crests appear as visual anchors throughout the app â€” Set Piece taker boxes, Fixture Heat Map row headers, and other team-identity surfaces â€” making the UI feel like a real FPL product and letting users identify teams at a glance without reading abbreviations
**Depends on**: Phase 78 (design tokens; consistent with brand system)
**Requirements**: SHD-01, SHD-02, SHD-03
**Success Criteria** (what must be TRUE):
  1. Each Set Piece taker box uses the team's crest as a low-opacity background or box header element â€” the crest is visible behind or above the content without obscuring player names or taker roles
  2. Fixture Heat Map row headers display the club crest (small, ~24px) alongside the team abbreviation so the team is identifiable without reading the text
  3. A shared `useTeamBadge(teamCode)` hook or utility resolves the PL badge URL for any team code and is used as the single source of truth for all crest placements across the app; graceful fallback to a coloured initial-letter swatch when the image fails to load
**Plans**: 4 plans
Plans:
- [x] 081-01-PLAN.md â€” useTeamBadge hook + unit tests (SHD-03, Wave 1)
- [x] 081-02-PLAN.md â€” SetPieceTakerPanel ghost watermark + sub-component extraction (SHD-01, Wave 2)
- [x] 081-03-PLAN.md â€” FixtureHeatMap row header crest + HeatMapRow extraction (SHD-02, Wave 2)
- [x] 081-04-PLAN.md â€” LineupTab kit-error state migration to useTeamBadge (SHD-03 cleanup, Wave 3, optional)
**Status**: âœ… Complete (2026-05-08)
**UI hint**: yes

## v1.14 Analytics Depth (Phases 82-85)

- [x] **Phase 82: Data Health Dashboard** â€” `data_health.json` artifact, collapsible AccuracyTab panel, `/api/data-health` route with 60s refetch (complete 2026-05-08)
- [x] **Phase 83: GK Save-Point Projections** â€” Poisson-floor `save_pts` in xPts pipeline, XPtsCell breakdown row for GKs, `save_predictor_enabled` gate (default OFF)
 (completed 2026-05-09)
- [x] **Phase 84: Set-Piece Threat Assisted Pipeline** â€” per-team Understat shot scrape, `player_assisted` aggregation, `sp_quality.json` with corner/FK danger scores
- [x] **Phase 85: Set-Piece Threat Assisted UI** â€” delivery-quality tier badges in SetPieceTakerPanel, `/api/set-pieces` extension, sample-size tooltip (completed 2026-05-09)

### Phase 82: Data Health Dashboard
**Goal**: Users can see at a glance whether the daily pipeline succeeded â€” per-artifact freshness, missing-player counts, null-xG categories, and sanity-check status â€” without leaving the app or inspecting JSON
**Depends on**: Phase 81 (v1.13 complete); extends `pipeline/run.py`, `AccuracyTab.tsx`, `/api/accuracy` pattern
**Requirements**: DH-01, DH-02, DH-03
**Success Criteria** (what must be TRUE):
  1. Pipeline writes `pipeline/cache/data_health.json` as the LAST step in `run.py` (after every other artifact) â€” JSON contains per-file write timestamps for each cache artifact, total player count, missing-player delta vs previous run, three distinct null-xG metrics (`understat_id null count`, `FPL-proxy-fallback count`, `xg_per90 null count`), and a `sanity_checks` array with `id/status/value/threshold` per check
  2. AccuracyTab renders a collapsible "Data Health" panel at the top of the tab, collapsed by default, with a single status pill (green = all OK / amber = warnings / red = errors) reusing existing `TIER_CLASSES`; expanded body shows signal rows with status icon, label, value, and threshold
  3. `/api/data-health` route reads `data_health.json` from Vercel Blob (USE_BLOB=true) or local cache (USE_BLOB=false), mirroring `/api/accuracy`; `useDataHealth` TanStack Query hook uses `staleTime: 0` and `refetchInterval: 60_000` so the panel reflects current pipeline state, not a 6h-cached snapshot
  4. Error messages written to `data_health.json` are sanitized via `_sanitize_error()` â€” environment-variable-shaped tokens (e.g. `BLOB_READ_WRITE_TOKEN`) and absolute paths are stripped, content truncated at 200 characters â€” verified by a pytest case that feeds a tokenised exception and asserts the redacted output
  5. Zero new HTTP calls are introduced: this phase is observability-only, computed entirely from existing pipeline outputs and run-state metadata
**Plans**: 3 plans
Plans:
- [x] 82-01-PLAN.md â€” Pipeline data_health.py + run.py instrumentation + pytest (DH-01, Wave 1)
- [x] 82-02-PLAN.md â€” /api/data-health route + useDataHealth hook + DataHealth/SanityCheck types (DH-03, Wave 2)
- [x] 82-03-PLAN.md â€” DataHealthPanel sub-component in AccuracyTab.tsx (DH-02, Wave 3)
**UI hint**: yes

### Phase 83: GK Save-Point Projections
**Goal**: Goalkeepers receive a calibrated save-points component in their xPts forecast, surfaced transparently in the XPtsCell hover card, gated OFF by default until a 5-GW shadow run validates non-regression
**Depends on**: Phase 82 (Data Health observability is in place to validate gate-flip rollout); extends `pipeline/merge.py`, new `pipeline/saves.py`, `columns.tsx` (XPtsCell)
**Requirements**: GK-01, GK-02, GK-03
**Success Criteria** (what must be TRUE):
  1. Pipeline computes `save_pts_ev` per GK per upcoming fixture using the Poisson-floor formula `E[floor(N/3)] = Î£ P(N â‰¥ 3k)` over opponent xG (NOT the naive `expected_saves / 3`); the value is written to `xPts_components_1gw.save_pts` and added to `xPts_1gw / 3gw / 5gw` totals; `var_saves â‰ˆ E[saves]/9` is added to `_compute_xpts_sigma` so GK ceiling ranking remains correct
  2. XPtsCell hover card shows a "Saves" component row when `save_pts > 0` and `element_type === 1` only; non-GK players never render the row, and BGW GKs render `save_pts = 0.0` with no breakdown row
  3. A Vitest invariant test asserts `Math.abs(cardTotal âˆ’ xPts_1gw) â‰¤ 0.015` for a GK fixture so the new component never silently breaks the hover card sum integrity (per RESEARCH Pitfall 1)
  4. `save_predictor_enabled` gate flag is written to `accuracy_backtest.json` (default OFF on cold start); the GK ceiling-captaincy filter excludes `element_type === 1` from `_compute_captain_picks` consistent with the prose-summary convention
  5. The gate ships OFF â€” no production-visible save_pts contribution until a non-regression shadow run over â‰¥5 GWs is recorded (this phase delivers the engine and gate; flip is a deliberate later operation)
**Plans**: 4 plans
Plans:
**Wave 1**
- [x] 83-01-PLAN.md â€” pipeline/saves.py Poisson-floor math module + pytest test_saves.py (GK-01, Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 83-02-PLAN.md â€” merge.py: opponent_xg_per_game enrichment + _compute_xpts_fixture/_xpts_ngw/_xpts_per_gw/_compute_xpts_sigma extension + captain GK guard + 5 new pytest cases (GK-01, GK-03, Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 83-03-PLAN.md â€” accuracy.py + run.py save_predictor_enabled gate plumbing + 3 cold-start pytest cases (GK-03, Wave 3)
- [x] 83-04-PLAN.md â€” types.ts + columns.tsx XPtsCell save_pts + Vitest XPtsCell-saves.test.tsx invariant (GK-02, Wave 3)
**UI hint**: yes

### Phase 84: Set-Piece Threat Assisted Pipeline
**Goal**: Pipeline produces a per-taker measure of set-piece delivery quality â€” aggregate xG generated by shots they assisted from corners and direct free kicks â€” written as a separate artifact so a scrape failure cannot poison `merged_players.json`
**Depends on**: Phase 82 (DH sanity checks surface unmatched-ID counts emitted by this phase)
**Requirements**: SPQ-01, SPQ-02
**Success Criteria** (what must be TRUE):
  1. Pipeline scrapes per-team Understat shot events from `https://understat.com/team/{name}/2025` (~20 requests, primary takers only, 24h disk cache); shots are filtered to `situation IN ('FromCorner', 'DirectFreekick')` and aggregated by `player_assisted` (NOT shooter) so the metric measures the deliverer's threat, not aerial threat from receivers
  2. Per-taker output written to `pipeline/cache/sp_quality.json` includes `corner_danger_score` (mean xG per assisted corner shot, null when sample n < 5), `fk_danger_score` (mean xG per direct-FK shot, null when n < 3), `delivery_quality_rank` (composite using Empirical-Bayes shrinkage k=20 to position-mean, null when both scores are null), and `sp_sample_n` (sample count)
  3. The entire scrape step in `run.py` is wrapped in try/except (mirroring the existing `prose_summary` pattern at run.py:351) so a 403 bot-protection response or network failure does NOT poison `merged_players.json` or any other artifact â€” a stale or absent `sp_quality.json` is the only failure mode
  4. Unmatched Understat IDs encountered during shot aggregation are logged and the count is surfaced as a sanity-check entry in DH-01 (`data_health.json sanity_checks[]`) so silent shot-drop on the 43-null-Understat-ID population is visible
  5. A pytest case feeds a fixture of mixed shot situations (corners, FKs, open play, penalties) and asserts the aggregator only counts `FromCorner` and `DirectFreekick` events grouped by `player_assisted` â€” guarding against the shooter-vs-deliverer pitfall (RESEARCH Pitfall 2)
**Plans**: 2 plans
Plans:
**Wave 1**
- [x] 84-01-PLAN.md â€” pipeline/set_piece_quality.py (scrape, EB shrinkage k=20, sp_quality.json) + pytest + run.py try/except isolation (SPQ-01, SPQ-02, Wave 1)

**Wave 2** *(blocked on Wave 1 completion â€” pipeline/run.py file overlap)*
- [x] 84-02-PLAN.md â€” pipeline/data_health.py sp_unmatched_count kwarg + _check_sp_unmatched helper + 5 new pytest cases + run.py compute_data_health() call site update (SPQ-02, Wave 2)

### Phase 85: Set-Piece Threat Assisted UI
**Goal**: Users see set-piece taker delivery quality at a glance in SetPieceTakerPanel â€” Elite/Good/Weak tier badges with a sample-size tooltip â€” so they can prefer takers whose deliveries actually generate xG
**Depends on**: Phase 84 (`sp_quality.json` must exist before UI can render); extends existing `/api/set-pieces` route (no new route)
**Requirements**: SPQ-03
**Success Criteria** (what must be TRUE):
  1. SetPieceTakerPanel renders a delivery-quality tier badge in each taker card: Elite (top quartile, green) / Good (middle half, zinc) / Weak (bottom quartile, amber) / "â€”" (insufficient data, grey) â€” tier classes reuse the existing `TIER_CLASSES` palette
  2. Hovering a tier badge shows a tooltip with the literal wording "xG generated by this taker's assisted set-piece shots â€” measures how often their deliveries produce high-xG chances (n=[sp_sample_n] shots)" â€” substituting the actual `sp_sample_n` value
  3. `/api/set-pieces` is EXTENDED (not replaced; no new route) to include `corner_danger_score`, `fk_danger_score`, `delivery_quality_rank`, and `sp_sample_n` per taker by reading `sp_quality.json` alongside the existing taker artifact
  4. When `sp_quality.json` is missing or a taker has no entry, the card renders the "â€”" insufficient-data badge gracefully â€” no error, no blank card, no console noise â€” verified by a Vitest case with a taker fixture omitted from the quality map
  5. Layout audit on 390â€“430px viewport confirms the new badge does not overflow the taker card or push existing fields out of view (consistent with v1.13 mobile polish standards)
**Plans**: 2 plans
  - [x] 85-01-PLAN.md â€” Extend SetPieceTaker type and /api/set-pieces route with sp_quality merge + server-side sp_tier (Wave 1)
  - [x] 85-02-PLAN.md â€” Render delivery-quality tier badge on FK/Corner rows + Vitest coverage + mobile layout audit (Wave 2)
**UI hint**: yes

## v1.15 Pipeline Intelligence (Phases 86-87)

- [x] **Phase 86: Data Health Dashboard** â€” delivered via Phase 82 (2026-05-08); DH-01/02/03 complete
- [x] **Phase 87: Set-Piece Delivery Pipeline** â€” delivered via Phase 84 (2026-05-09); SPQ-01/02 complete

### Phase 86: Data Health Dashboard
**Status**: Pre-delivered by Phase 82 (2026-05-08) â€” all DH-01/02/03 success criteria verified; no additional implementation needed
**Goal**: Users can see at a glance whether the daily pipeline succeeded â€” per-artifact freshness, missing-player counts, null-xG categories, and sanity-check status â€” without leaving the app or inspecting JSON
**Depends on**: Phase 85 (v1.14 SPQ UI complete); extends `pipeline/run.py`, `AccuracyTab.tsx`, and the `/api/accuracy` route pattern
**Requirements**: DH-01, DH-02, DH-03
**Success Criteria** (what must be TRUE):
  1. Pipeline writes `pipeline/cache/data_health.json` as the LAST step in `run.py` (after every other artifact) â€” JSON contains per-file write timestamps for each cache artifact, total player count, missing-player delta vs previous run, three distinct null-xG metrics (`understat_id null count`, `FPL-proxy-fallback count`, `xg_per90 null count`), and a `sanity_checks` array with `id/status/value/threshold` per check
  2. AccuracyTab renders a collapsible "Data Health" panel at the top of the tab, collapsed by default, with a single status pill (green = all OK / amber = warnings / red = errors) reusing existing `TIER_CLASSES`; expanded body shows signal rows with status icon, label, value, and threshold
  3. `/api/data-health` route reads `data_health.json` from Vercel Blob (USE_BLOB=true) or local cache (USE_BLOB=false), mirroring `/api/accuracy`; `useDataHealth` TanStack Query hook uses `staleTime: 0` and `refetchInterval: 60_000` so the panel reflects current pipeline state, not a 6h-cached snapshot
  4. Error messages written to `data_health.json` are sanitized via `_sanitize_error()` â€” environment-variable-shaped tokens (e.g. `BLOB_READ_WRITE_TOKEN`) and absolute paths are stripped, content truncated at 200 characters â€” verified by a pytest case that feeds a tokenised exception and asserts the redacted output
  5. Zero new HTTP calls are introduced: this phase is observability-only, computed entirely from existing pipeline outputs and run-state metadata
**Plans**: TBD
**UI hint**: yes

### Phase 87: Set-Piece Delivery Pipeline
**Status**: Pre-delivered by Phase 84 (2026-05-09) â€” all SPQ-01/SPQ-02 success criteria verified; no additional implementation needed
**Goal**: Pipeline produces a per-taker measure of set-piece delivery quality â€” aggregate xG generated by shots they assisted from corners and direct free kicks â€” written as a separate artifact so a scrape failure cannot poison `merged_players.json`
**Depends on**: Phase 86 (Data Health sanity checks surface unmatched-ID counts emitted by this phase); SPQ-03 UI shipped in v1.14 Phase 85 already consumes these fields
**Requirements**: SPQ-01, SPQ-02
**Success Criteria** (what must be TRUE):
  1. Pipeline scrapes per-team Understat shot events from `https://understat.com/team/{name}/2025` (~20 requests, primary takers only, 24h disk cache); shots are filtered to `situation IN ('FromCorner', 'DirectFreekick')` and aggregated by `player_assisted` (NOT shooter) so the metric measures the deliverer's threat, not aerial threat from receivers
  2. Per-taker output written to `pipeline/cache/sp_quality.json` includes `corner_danger_score` (mean xG per assisted corner shot, null when sample n < 5), `fk_danger_score` (mean xG per direct-FK shot, null when n < 3), `delivery_quality_rank` (composite using Empirical-Bayes shrinkage k=20 to position-mean, null when both scores are null), and `sp_sample_n` (sample count); these fields are merged into the `/api/set-pieces` payload that SetPieceTakerPanel already consumes
  3. The entire scrape step in `run.py` is wrapped in try/except (mirroring the existing `prose_summary` pattern at run.py:351) so a 403 bot-protection response or network failure does NOT poison `merged_players.json` or any other artifact â€” a stale or absent `sp_quality.json` is the only failure mode
  4. Unmatched Understat IDs encountered during shot aggregation are logged and the count is surfaced as a sanity-check entry in DH-01 (`data_health.json sanity_checks[]`) so silent shot-drop on the 43-null-Understat-ID population is visible
  5. A pytest case feeds a fixture of mixed shot situations (corners, FKs, open play, penalties) and asserts the aggregator only counts `FromCorner` and `DirectFreekick` events grouped by `player_assisted` â€” guarding against the shooter-vs-deliverer pitfall

## v1.16 Modelling & Trust (Phases 88-96)

- [x] **Phase 88: FPL News Flags UI** â€” surface `news` / `news_added` / `chance_of_playing_next_round` as banner/badge in TransferPanel and status indicator in GemTable; gated by `news_flag_enabled` display config (SCRAPER-01) (completed 2026-05-10)
- [x] **Phase 89: Event-Aware Pipeline Scheduling** â€” `pipeline/refresh_gate.py` deadline-guard, dense Fri/Sat/Sun cron entries in `.github/workflows/pipeline.yml`, `concurrency: cancel-in-progress` guard (REFRESH-01) (completed 2026-05-10)
- [x] **Phase 90: Monte Carlo Simulation Pipeline** â€” per-player 5-GW MC over existing Poisson/Bernoulli params, â‰¥1000 iterations, writes `xPts_5gw_p10/p50/p90` and `rank_trajectory` to `merged_players.json`; `mc_enabled` gate in `accuracy_backtest.json` (MC-01) (completed 2026-05-10)
- [x] **Phase 91: Calibration Charts** â€” AccuracyTab predicted-xPts-decile vs actuals over last 5 GWs with per-position breakdown; recharts (already installed) (CAL-01) (completed 2026-05-10)
- [x] **Phase 92: Cron History Sparkline** â€” extend `data_health.json` with rolling `history` (last 7 runs); render `DataHealthSparkline` recharts `<LineChart>` inside existing `DataHealthPanel`; zero new API routes/hooks (DH-04) (completed 2026-05-10)
- [x] **Phase 93: Sensitivity Analysis Enhancements** *(complete 2026-05-10)* â€” extend Phase 64 fragility engine with 5 perturbations (start_prob -0.15, mins_60 -0.10, fixture +1 tier, cost +0.5m, news flip to "doubt"); ROBUST / FRAGILE (1 reverses) / KNIFE EDGE (2+ reverse); GemTable + TransferPanel (SENS-01)
- [x] **Phase 94: Rejection Explainer Enhancements** â€” extend Phase 65 explainer with deterministic gate-cascade (â‰¥6 predicates); search field entry point in TransferPanel ("Why isn't X recommended?") + head-to-head mode in GemTable expand ("Why is X ranked above Y?") (WHY-01)
 (completed 2026-05-11)
- [x] **Phase 95: Set-Piece Delivery League Table** â€” all 20 PL teams ranked by composite delivery-quality score, toggle within Set Pieces tab, separate insufficient-sample section; client-side aggregation in `src/lib/setPieceLeague.ts`; zero pipeline changes (SPQ-04)
 (completed 2026-05-11)
- [x] **Phase 96: Captain Decision Backtester** â€” pipeline saves `captain_picks_gw{N}.json` per run; `/api/decision-history` + `useDecisionHistory`; new "Back" sub-tab in Accuracy section; GW-by-GW captain regret vs snapshotted recommendation; authenticated FPL API for actual captain; localStorage ring buffer last 38 GWs (BACK-01)
 (completed 2026-05-11)



### Phase 88: FPL News Flags UI
**Goal**: Users see official FPL news (injuries, suspensions, chance-of-playing) directly in TransferPanel and GemTable â€” never click into a player to discover they are flagged â€” without any new pipeline scraping
**Depends on**: Phase 87 (v1.15 complete); reuses `news`, `news_added`, and `chance_of_playing_next_round` fields already produced by `pipeline/merge.py`
**Requirements**: SCRAPER-01
**Success Criteria** (what must be TRUE):
  1. TransferPanel renders a news banner on any candidate row whose `chance_of_playing_next_round` is below 100 OR whose `news` string is non-empty â€” banner shows the literal `news` text (e.g. "Knock - 50% chance of playing"), the `news_added` timestamp formatted relative to now, and an amber/red severity tone derived from `chance_of_playing_next_round` (75=amber, â‰¤50=red)
  2. GemTable carries a small status indicator in the Player cell for any flagged player â€” visible in the default and compact presets, hidden on portrait mobile only when player name truncation would clash; row-expand panel echoes the full `news` text and `news_added` timestamp
  3. The full feature is gated by a single `news_flag_enabled` display flag (read from `accuracy_backtest.json` like other gates) â€” when OFF the banner and indicator render nothing and downstream layout is unchanged, so the gate is a true kill switch with no residual chrome
  4. Zero new pipeline work: a Vitest case asserts the component reads only existing `MergedPlayer` fields and a single new `useNewsFlagEnabled()` accessor â€” no new fetcher, no new query key, no new API route
  5. When all three news fields are absent or null on a player (cold-start cache, freshly promoted player), the banner and indicator render nothing â€” verified by a Vitest case with a player fixture missing every news field
**Plans**: 2 plans (2 waves)
  **Wave 0**
  - [x] 088-01-PLAN.md â€” RED scaffolding: TransferPanel news-banner test cases (5), GemTable status-indicator test cases (4), `news_flag_enabled` gate read in `useNewsFlagEnabled` test (3); shared `NewsBadge` / `NewsBanner` component contracts in src/components/news/
  **Wave 1** *(blocked on Wave 0 completion)*
  - [x] 088-02-PLAN.md â€” Implement `NewsBadge` (GemTable Player-cell variant + row-expand variant) + `NewsBanner` (TransferPanel candidate-row variant) + `useNewsFlagEnabled` accessor over `useAccuracy`; wire into TransferPanel and GemTable; severity-tone helper; mobile-portrait truncation guard
  **Cross-cutting constraints:**
  - `news_flag_enabled` MUST gate every render path â€” the gate is read once per render via `useNewsFlagEnabled()` (single source of truth); never inline `accuracy.news_flag_enabled` inside leaf components
  - Severity-tone helper lives in `src/lib/newsSeverity.ts` and is unit-tested in isolation â€” UI components consume tone tokens, never raw `chance_of_playing_next_round` ints
  - `NewsBadge` and `NewsBanner` MUST gracefully render nothing (empty fragment, not a 0-height div) when the player has no news â€” guards layout-shift on healthy players
**Phase notes**: SCRAPER-02 (external press/injury feed scraping) is explicitly OUT OF SCOPE per REQUIREMENTS.md â€” this phase is display-only over fields already in `merged_players.json`. Severity thresholds: `chance_of_playing_next_round === null || === 100` â†’ no flag; `=== 75` â†’ amber tone; `â‰¤ 50` â†’ red tone; non-empty `news` with `chance_of_playing_next_round === 100` (e.g. "Returned from international duty") â†’ zinc/info tone. `news_flag_enabled` gate ships ON by default since the underlying data is already in production. This phase intentionally precedes Phase 93 â€” SENS-01's "news flip to 'doubt'" perturbation depends on the news-flag taxonomy defined here.
**UI hint**: yes

### Phase 89: Event-Aware Pipeline Scheduling
**Goal**: Pipeline data is fresh in the 90-minute window before each GW deadline without burning Actions minutes the rest of the week â€” a dense conditional cron schedule plus a deadline-guard script run pipeline only when it matters, while a concurrency guard prevents race conditions with the existing 4Ã—/day baseline
**Depends on**: Phase 87 (v1.15 complete); extends existing `.github/workflows/pipeline.yml` daily cron and reuses `events[].deadline_time` from FPL bootstrap
**Requirements**: REFRESH-01
**Success Criteria** (what must be TRUE):
  1. `pipeline/refresh_gate.py` reads `events[].deadline_time` from the FPL bootstrap payload and exits with status 0 (skip) when the next deadline is more than 90 minutes away or has already passed by more than 90 minutes â€” and exits with a sentinel "proceed" status only inside the deadline window; pytest cases cover before-window, in-window, and post-window timestamps with a fixed `now` parameter
  2. `.github/workflows/pipeline.yml` carries dense `schedule:` cron entries covering Friday/Saturday/Sunday GW windows (typical FPL deadline days) at 15-minute or 30-minute granularity â€” every additional cron entry runs `refresh_gate.py` first and short-circuits the pipeline step when the gate skips, so the cron fires often but the pipeline body executes only inside windows
  3. The workflow declares `concurrency: { group: pipeline, cancel-in-progress: true }` so a deadline-window run can pre-empt an in-flight daily-cron run rather than racing on Vercel Blob writes â€” verified by inspecting the rendered workflow YAML in CI
  4. The existing 4Ã—/day baseline cron is preserved and continues to refresh data outside deadline windows â€” REFRESH-01 is additive, not a replacement
  5. When the FPL bootstrap fetch fails (network, 5xx), `refresh_gate.py` exits with the "skip" status (NOT proceed) â€” never run pipeline on broken bootstrap data; pytest case asserts the failure-skip behaviour with a mocked HTTP error
**Plans**: 2 plans (2 waves)
  **Wave 0**
  - [x] 089-01-PLAN.md â€” RED: `pipeline/tests/test_refresh_gate.py` (6 cases: before-window / in-window / after-window / failure-skip / DGW double-deadline / cold-bootstrap)
  **Wave 1** *(blocked on Wave 0 completion)*
  - [x] 089-02-PLAN.md â€” Implement `pipeline/refresh_gate.py` (90-min window math, configurable via env var `PIPELINE_DEADLINE_WINDOW_MINUTES=90`); update `.github/workflows/pipeline.yml` with dense Fri/Sat/Sun cron entries, refresh_gate guard step, and `concurrency` block; manual UAT: trigger workflow_dispatch outside window confirms skip, inside window confirms proceed
  **Cross-cutting constraints:**
  - `refresh_gate.py` MUST NOT import from `pipeline/run.py` â€” it is a thin standalone deadline-math utility so a syntax error in `run.py` cannot break gating
  - Bootstrap fetch in `refresh_gate.py` reuses the existing FPL proxy retry/timeout helper (mirroring `pipeline/merge.py`) â€” no duplicated HTTP logic
  - `concurrency: cancel-in-progress: true` MUST be set at workflow level (not job level) so the trailing daily-cron job is also cancellable when a deadline trigger fires
  - The dense cron entries are documented in a comment block at the top of `pipeline.yml` listing each cron's intent (e.g. `# Fri 17:30 UTC â€” typical Sat-deadline T-2h`) so future maintenance is self-explanatory
**Phase notes**: GitHub Actions has no native event-driven cron â€” the dense-cron + guard-script pattern is the documented best practice (per REQUIREMENTS.md "Out of Scope" note: "True event-driven GitHub Actions (Actions has no conditional cron â€” dense cron + guard is the pattern)"). DGW handling: when two deadlines are within the same day (e.g. GW33 DGW per MEMORY.md), the gate proceeds inside the 90-min window of EITHER deadline. `PIPELINE_DEADLINE_WINDOW_MINUTES` env var is a knob: default 90, can be tightened to 60 if Actions minutes burn becomes a concern post-launch. No TypeScript changes in this phase â€” pure DevOps.
**UI hint**: no

### Phase 90: Monte Carlo Simulation Pipeline
**Goal**: Pipeline produces per-player 5-GW xPts uncertainty bands (p10/p50/p90) and a rank trajectory under uncertainty â€” written into `merged_players.json` so every downstream consumer (GemTable, TransferPanel, CaptainPicksPanel) can read distributional data without any new HTTP round-trip
**Depends on**: Phase 87 (v1.15 complete); reuses `_compute_xpts_fixture` Poisson/Bernoulli parameters from `pipeline/merge.py` (no new HTTP calls)
**Requirements**: MC-01
**Success Criteria** (what must be TRUE):
  1. `pipeline/simulate.py` runs â‰¥1000 Monte Carlo iterations per player over the next 5 GWs using Poisson goal/assist distributions and Bernoulli CS distributions drawn from existing pipeline parameters; per-player output written to `merged_players.json` includes `xPts_5gw_p10`, `xPts_5gw_p50`, `xPts_5gw_p90` (10th/50th/90th percentile of cumulative 5-GW xPts) and `rank_trajectory` (a length-5 array of position-relative percentile ranks across the 5-GW horizon)
  2. The whole MC stage is gated by `mc_enabled` flag in `accuracy_backtest.json` (default OFF) â€” when OFF, simulate.py is skipped entirely in `run.py` and the four MC fields are absent from `merged_players.json` (NOT zero-filled), so consumers that read the fields can gracefully degrade
  3. BGW players in the 5-GW horizon contribute zero points for that GW in every iteration; DGW players run two fixtures per GW iteration combined; both behaviours covered by pytest cases against a synthetic 5-GW fixture mix
  4. Simulation results are written once per pipeline run and consumed as static JSON â€” no client-side simulation, no added page-load latency; a pytest case asserts iteration count is `â‰¥ 1000` (configurable via `MC_ITERATIONS=1000` env var) and seeded determinism (`MC_SEED=42`) so cache regeneration is reproducible across CI runs
  5. `simulate.py` MUST NOT import from `merge.py` (mirroring the v1.10 Phase 61 D-02 isolation rule from STATE.md) â€” Poisson/Bernoulli math is duplicated as a thin internal helper so a refactor of `merge.py` cannot silently break MC output
**Plans**: 3 plans (2 waves)
  **Wave 0**
  - [x] 090-01-PLAN.md â€” RED: `pipeline/tests/test_simulate.py` (6 cases: percentile invariants, BGW zero-fill, DGW combine, iteration-count gate, seed determinism, mc_enabled OFF skip); MergedPlayer types extension with 4 optional MC fields in `src/lib/types.ts`
  **Wave 1** *(parallel â€” file-disjoint)*
  - [x] 090-02-PLAN.md â€” `pipeline/simulate.py` (`compute_simulations`, `_simulate_player`, `_cs_prob_sim` reimplementing the 3-line Poisson formula inline per D-02 isolation); `run.py` integration after `merge.py`, before `data_health.py`; `numpy>=1.26.0` requirement (already pinned in v1.10 Phase 61 work â€” confirm)
  - [x] 090-03-PLAN.md â€” `accuracy.py` `mc_enabled` gate plumbing + cold-start fallback that writes `mc_enabled: false` on first run; pytest case for cold-start
  **Cross-cutting constraints:**
  - All four MC fields MUST be optional on `MergedPlayer` (`?:`) so legacy cache reads do not break â€” Pitfall 6 from Phase 63 calibration phase
  - Plan 02 and Plan 03 are file-disjoint (`simulate.py` + `run.py` patch vs `accuracy.py`) and run Wave 1 in parallel
  - `MC_ITERATIONS` and `MC_SEED` are env-var configurable but default to 1000 / 42 in code so a developer running `python -m pipeline.run` locally gets identical output to CI without env setup
  - `xPts_5gw_p50` MUST be approximately equal to `xPts_5gw` (within 5% sample tolerance at iter=1000) â€” pytest invariant guards against accidental decoupling of MC from the deterministic xPts engine
**Phase notes**: This is the v1.16 MC scope â€” pipeline + `merged_players.json` extension only. Rank simulator UI, MC captain integration, and per-player blank/haul probabilities (the v1.10 Phase 62 work) are NOT included; if ever wanted they'd land as MC-03/MC-04 in a later milestone. The `rank_trajectory` field is position-relative (player ranked vs same-position peers per GW) so it answers "is this MID likely to climb the MID rankings over the next 5 GWs?" rather than answering an overall-rank question. â‰¥1000 iterations chosen as the floor (10x lower than v1.10 Phase 61's 10,000) because v1.16 only writes percentiles, not full distributions â€” Monte Carlo error on percentile estimates at n=1000 is well below the precision GemTable can display. Gate ships OFF â€” flip to ON requires confirming non-regression on a pipeline run end-to-end.
**UI hint**: no

### Phase 91: Calibration Charts
**Goal**: AccuracyTab gains a calibration chart showing predicted-xPts decile vs actual points per decile over the last 5 GWs â€” broken out by position â€” so users (and the developer) can see at a glance whether the model is well-calibrated or systematically over/under-predicting at any decile or position
**Depends on**: Phase 87 (v1.15 complete); recharts already installed since Phase 63 (`recharts` v3.x); extends `pipeline/accuracy.py` and `AccuracyTab.tsx`
**Requirements**: CAL-01
**Success Criteria** (what must be TRUE):
  1. `pipeline/accuracy.py` extends `accuracy_backtest.json` with a `calibration` block: per-decile records of `predicted_mean`, `actual_mean`, `sample_n` over the last 5 GWs, with a `by_position` map keyed `GK / DEF / MID / FWD` containing the same three fields per decile per position
  2. AccuracyTab renders a calibration chart (recharts `ComposedChart`) with the predicted-xPts decile on the X axis (numeric 0â€“1 domain), actual-mean line plus a `y = x` reference line on the Y axis â€” a perfectly calibrated model traces the reference; deviations are immediately visible
  3. A position-tab selector (GK / DEF / MID / FWD / All) toggles the chart between aggregate and per-position views without re-fetching â€” both datasets ship in the same `accuracy_backtest.json` payload
  4. Sparse buckets (sample_n < 5) are filtered out of the chart (NOT zeroed) so a near-empty decile cannot mislead the eye â€” verified by a Vitest case with a fixture containing one bucket below the threshold
  5. The calibration block is OPTIONAL on the `AccuracyBacktest` interface so legacy `accuracy_backtest.json` caches predating this phase do not break the AccuracyTab render path â€” Pitfall 6 pattern from Phase 63
**Plans**: 4 plans (3 waves)
  **Wave 0**
  - [x] 091-01-PLAN.md â€” RED: `pipeline/tests/test_accuracy_calibration.py` (6 cases: decile bucketing math, by-position structure, sparse-filter, cold-start absence, 5-GW window, sample_n integrity); React `AccuracyTab.test.tsx` extension with calibration fixture and 5 RED cases
  **Wave 1** *(parallel â€” file-disjoint)*
  - [x] 091-02-PLAN.md â€” `pipeline/accuracy.py`: `_compute_calibration_data` decile bucketing helper + `compute_accuracy_backtest` return-dict extension + `_empty_backtest` cold-start fallback with empty calibration block
  - [x] 091-03-PLAN.md â€” TypeScript types: `CalibrationBucket`, `CalibrationData`, `AccuracyBacktest.calibration?` optional field in `src/lib/types.ts`
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 091-04-PLAN.md â€” `CalibrationSection` component in AccuracyTab (recharts `ComposedChart` with `XAxis type="number"`, `ReferenceLine y=x` diagonal, `PositionTabSelector`, sparse-filter at component edge); manual UAT in light + dark mode
**Cross-cutting constraints:**
  - `XAxis` MUST have `type="number"` for the 0-1 numeric domain to be respected (Pitfall 4 from Phase 63 calibration work â€” same pitfall applies)
  - Sparse-bucket filter `b.sample_n >= 5` lives at the component edge, not in the pipeline â€” pipeline writes everything; UI decides what to render
  - `@types/recharts` MUST NOT be installed (v1 incompatibility per Phase 62 / 63 notes)
  - `calibration` field is OPTIONAL on `AccuracyBacktest` â€” legacy cache compatibility (Pitfall 6 from Phase 63)
**Phase notes**: This is a complement to the existing accuracy backtest table â€” the table answers "what was our hit rate?" and the chart answers "where does the model under/over-predict?". Position breakdown is the differentiator: GKs and DEFs share a different scoring distribution from MIDs and FWDs, so an aggregate calibration line can hide position-specific drift. Independent of MC-01 (Phase 90) â€” uses the existing accuracy backtest data, not MC percentiles. CAL-02 (multi-version comparison) was shipped in v1.10 Phase 63; this phase is just the chart-and-position-breakdown.
**UI hint**: yes

### Phase 92: Cron History Sparkline
**Goal**: DataHealthPanel grows a tiny sparkline showing the last 7 pipeline runs at a glance â€” green/amber/red points trace whether the pipeline is healthy, intermittently failing, or broken â€” without any new API route or hook beyond the existing `useDataHealth`
**Depends on**: Phase 87 (v1.15 complete; DataHealthPanel exists); extends existing `pipeline/data_health.py` and the `DataHealthPanel` component already mounted in AccuracyTab
**Requirements**: DH-04
**Success Criteria** (what must be TRUE):
  1. `pipeline/data_health.py` extends `data_health.json` with a rolling `history` array containing the last 7 entries â€” each entry has `timestamp` (ISO-8601 string) and `overall_status` ("ok" | "warning" | "error") â€” the array is appended to (with a 7-element cap) on every pipeline run rather than recomputed from scratch
  2. `DataHealthSparkline` component renders the 7-point series inside the existing `DataHealthPanel` using a recharts `<LineChart>` with status-colour-coded dots (green = ok, amber = warning, red = error) and an inline tooltip showing the timestamp + status on hover
  3. Zero new API routes and zero new hooks â€” the sparkline reads the existing `useDataHealth()` query, just consuming a new optional `history?: HistoryEntry[]` field; cold-start (no history yet) renders a 1-point placeholder with the literal "first run" tooltip rather than an empty chart
  4. The history append is atomic-write-safe: a pytest case feeds three sequential runs and asserts the array is FIFO-capped at 7 entries with correct chronological order â€” guards against duplicate or reordered entries during partial-failure recovery
  5. When `history` field is absent from `data_health.json` (legacy cache predating this phase), the sparkline gracefully renders nothing and the rest of `DataHealthPanel` is unchanged â€” verified by a Vitest case with the fixture's `history` field deleted
**Plans**: 2 plans (2 waves)
  **Wave 0**
  - [x] 092-01-PLAN.md â€” RED: `pipeline/tests/test_data_health_history.py` (4 cases: append + FIFO cap, cold-start, status enum, atomic write order); `DataHealthSparkline.test.tsx` (5 cases: 7-point render, dot colour mapping, tooltip, cold-start placeholder, missing-field graceful)
  **Wave 1** *(blocked on Wave 0 completion)*
  - [x] 092-02-PLAN.md â€” Implement `_append_history` helper in `pipeline/data_health.py` (read-prev / append / cap-7 / write-back); extend `DataHealth` interface in `types.ts` with optional `history?: HistoryEntry[]`; build `DataHealthSparkline` component (recharts `<LineChart>` with `<Dot>` custom render for colour mapping); mount inside existing `DataHealthPanel` body
  **Cross-cutting constraints:**
  - The 7-element cap lives in `pipeline/data_health.py` (not the UI) so the cache file size stays bounded regardless of UI behaviour
  - `history` field is OPTIONAL on `DataHealth` â€” legacy compatibility
  - `DataHealthSparkline` MUST be a sibling component inside `DataHealthPanel` (NOT a sub-route) so DH-04 ships with zero changes to navigation, routing, or hooks
  - Status colour mapping reuses `TIER_CLASSES` palette from Phase 82 â€” green/amber/red tokens, no hardcoded hex
**Phase notes**: Builds on Phase 82's `data_health.json` â€” that phase wrote per-run snapshots; this phase adds the rolling history series. The 7-run window matches the conversational meaning of "the last week" (one run per day at the daily-cron baseline) without growing the cache file unbounded. DH-05 (history graph beyond 7 runs) is explicitly deferred per REQUIREMENTS.md "Future Requirements". Append happens AFTER all sanity checks compute their final overall_status, so the entry is always self-consistent.
**UI hint**: yes

### Phase 93: Sensitivity Analysis Enhancements
**Goal**: Extend the v1.10 Phase 64 fragility flag from a binary ROBUST/FRAGILE to a 5-perturbation tristate (ROBUST / FRAGILE / KNIFE EDGE) so users can distinguish picks that survive everything, picks that survive most things, and picks that hinge on multiple knife-edge assumptions
**Depends on**: Phase 88 (SCRAPER-01 news-flag taxonomy supplies the "news flip to 'doubt'" perturbation input); operates over existing `MergedPlayer` data in client-side TypeScript; extends the `computeFragility` engine shipped in v1.10 Phase 64
**Requirements**: SENS-01
**Success Criteria** (what must be TRUE):
  1. `computeFragility` is extended to evaluate 5 named perturbations against each candidate: (a) `start_prob -= 0.15`, (b) `mins_60_prob -= 0.10`, (c) `fixture difficulty +1 tier`, (d) `cost += 0.5m`, (e) `news flips to "doubt"` (chance_of_playing_next_round set to 50); each perturbation independently checks whether the recommendation reverses (transfer dropped from candidate list, or captain falls out of top-3)
  2. Result is a tristate `'robust' | 'fragile' | 'knife_edge'` â€” ROBUST when zero perturbations reverse, FRAGILE when exactly one reverses, KNIFE EDGE when two or more reverse â€” replacing the v1.10 binary flag everywhere it currently appears
  3. GemTable row-expand panel and TransferPanel candidate cards both render the tristate via a `FragilityBadge` (extending the existing `FragilityNote`) â€” KNIFE EDGE uses a stronger amber/red tone than FRAGILE; the badge lists the specific perturbations that reversed, so the user reads "no longer recommended if: harder fixture OR news flips to doubt" not just "fragile"
  4. The "news flip to 'doubt'" perturbation reuses the news-flag severity taxonomy from Phase 88 â€” no duplicated constants; a Vitest case asserts that simulating `chance_of_playing_next_round = 50` deterministically yields the "doubt" branch
  5. Fragility computation remains pure TypeScript over `MergedPlayer` fields â€” no new API call, no pipeline change; a Vitest case asserts the engine is callable from a node environment (mirroring the v1.10 Phase 64 `@vitest-environment node` pattern)
**Plans**: 4 plans (3 waves)
  **Wave 0**
  - [x] 093-01-PLAN.md â€” RED: extend `src/lib/sensitivity.test.ts` with 5-perturbation cases (â‰¥12 cases covering each perturbation in isolation, ROBUST when none reverse, FRAGILE when one, KNIFE EDGE when two and three, BGW guard, news-flag input shape)
  **Wave 1** *(parallel â€” file-disjoint)*
  - [x] 093-02-PLAN.md â€” Extend `computeFragility` in `src/lib/sensitivity.ts` to evaluate the 5 perturbations and return `{ tier: 'robust' | 'fragile' | 'knife_edge', reasons: string[] }` (preserving the v1.10 reason-fragment vocabulary); shared perturbation table extracted as a constant for testability
  - [x] 093-03-PLAN.md â€” `FragilityBadge` component (extends `FragilityNote` styling; KNIFE EDGE = amber-red tone, FRAGILE = amber tone, ROBUST = no badge); RTL tests for tristate rendering and reason-list join
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 093-04-PLAN.md â€” Wire-up: GemTable row-expand panel + TransferPanel candidate-row injection (replace existing `FragilityNote` callsites); manual UAT covering all 3 tiers on at least one real player
  **Cross-cutting constraints:**
  - Perturbation values (-0.15, -0.10, +1 tier, +0.5m, news=50) are extracted as named constants in `sensitivity.ts` (e.g. `PERTURB_START_PROB = -0.15`) â€” never inlined as magic numbers
  - `computeFragility` parameter widening (already done in v1.10 Phase 64 to accept `MergedPlayer`) is preserved â€” Pitfall 2 from that phase
  - The reason-fragment vocabulary stays consistent with v1.10 Phase 64 ("start_prob < 70%" / "harder fixture" / "taken as a hit") â€” the new fragments are "minutes risk drop" / "price up Â£0.5m" / "news flips to doubt"
  - KNIFE EDGE rendering MUST NOT use a pill/filled-bg style â€” to preserve visual distinction from severity badges (Pitfall 4 from v1.10 Phase 64)
**Phase notes**: This is an enhancement of the v1.10 Phase 64 fragility engine, NOT a replacement â€” the existing `computeFragility` API is preserved and extended; downstream callers (TransferPanel Row 4 injection, CaptainPicksPanel CandidateRow tail) re-render with no signature change. The 5 perturbations are deliberately small, plausible adverse moves â€” not worst-case. The KNIFE EDGE bucket exists because users trust binary ROBUST/FRAGILE less when picks straddle multiple thresholds simultaneously. Depends on Phase 88 â€” without the SCRAPER-01 news taxonomy, the fifth perturbation has no input to manipulate.
**UI hint**: yes

### Phase 94: Rejection Explainer Enhancements
**Goal**: Extend the v1.10 Phase 65 rejection explainer with two new entry points â€” a search field in TransferPanel ("Why isn't X recommended?") and a head-to-head comparison in GemTable expand ("Why is X ranked above Y?") â€” turning the engine from a passive expand-row feature into an actively queryable explainer
**Depends on**: Phase 87 (v1.15 complete); extends the existing `computeRejection` engine shipped in v1.10 Phase 65 (`src/lib/explain.ts`) â€” operates over existing `MergedPlayer` and recommendation engine outputs
**Requirements**: WHY-01
**Success Criteria** (what must be TRUE):
  1. TransferPanel renders a "Why isn't X recommended?" search field above the candidate list â€” typing a player name autocompletes against the full player list; selecting a player surfaces a callout panel with the same gate-cascade explanation (â‰¥6 predicates: ownership %, fixture tier, form signal, start_prob, price trend, lifecycle label) the row-expand path already produces
  2. GemTable row-expand grows a head-to-head mode triggered by a dedicated "Compare withâ€¦" button inside the expand panel â€” selecting a second player produces a "Why is X ranked above Y?" callout naming the specific predicates that flipped (e.g. "Salah is ranked above Saka because: higher xPts (+1.2), better fixture (easy vs medium), lower fragility tier")
  3. The deterministic gate-cascade evaluates â‰¥6 predicates in a fixed order so the same input always produces the same explanation â€” covered by a Vitest case asserting two consecutive calls with identical inputs return character-equal output strings
  4. Both new entry points reuse the existing `computeRejection` engine (no parallel rejection logic) â€” a Vitest case asserts the head-to-head explainer composes `computeRejection(playerA)` and `computeRejection(playerB)` outputs rather than duplicating predicate evaluation
  5. Both new surfaces degrade gracefully when squad data is unavailable (unauthenticated user) â€” the search field still works for any player without ownership-of-squad context, and the head-to-head still works for any two players without squad context; the WHY-02 high-ownership callout from Phase 65 is unchanged
**Plans**: 3 plans (3 waves)
  **Wave 1**
  - [x] 94-01-PLAN.md â€” TDD engine extension: extend `computeRejection` in `src/lib/explain.ts` to 8 predicates (form D-01, price D-02, lifecycle D-04 added) + add 3rd required param `lifecycleLabels: Map<number, LifecycleLabel>` (D-05) + add new pure helper `computeHeadToHead(x, y, lifecycleLabels?)` (D-11/D-12 winning-only deltas); rewrite all 14 existing tests to pass `new Map()` as 3rd arg + add 8 new tests covering new predicates, 8-predicate determinism (SC-3), and h2h zero-predicate case; update GemTable.tsx call site at line ~299 to pass `new Map()` (D-05 â€” no squad context in GemTable)
  **Wave 2** *(blocked on Wave 1)*
  - [x] 94-02-PLAN.md â€” WHY-01-A entry point: build shared `PlayerSearchInput` component (`src/components/shared/PlayerSearchInput.tsx` â€” debounced autocomplete, dropdown, iOS-zoom guard) + `RejectionSearchCallout` (`src/components/transfers/RejectionSearchCallout.tsx` â€” search field + computeRejection callout) + mount in TransferPanel ABOVE the squadData guard so the search is always visible (D-07/D-08); manual UAT checkpoint
  **Wave 3** *(blocked on Wave 2 â€” needs PlayerSearchInput)*
  - [x] 94-03-PLAN.md â€” WHY-01-B entry point: build `ComparisonSearch` (`src/components/gem-table/ComparisonSearch.tsx` â€” row-scoped state, computeHeadToHead narrative output, self-exclusion from autocomplete) + mount in BOTH desktop and mobile expand-row IIFEs of GemTable.tsx after the FragilityBadge (D-10); manual UAT checkpoint
  **Cross-cutting constraints:**
  - `computeRejection` signature changes by design â€” gains required 3rd param `lifecycleLabels: Map<number, LifecycleLabel>` per D-05; all call sites (GemTable line ~299 and the two new components) updated atomically in Wave 1 to prevent transient broken builds (RESEARCH Â§Pitfall 1)
  - 8-predicate cascade order is fixed: rank â†’ start_prob â†’ form â†’ fixture â†’ price â†’ fragility â†’ lifecycle â†’ ownership (D-06); SC-3 determinism test in rejection.test.ts asserts the full 8-position order via `findIndex` chain
  - Both new surfaces use `scoredPlayers` from `usePlayers()` â€” the existing single source of truth â€” no new fetch (D-09)
  - WHY-02 (HighOwnershipCallout) from Phase 65 is unchanged and remains inside the squadData guard; the new RejectionSearchCallout renders OUTSIDE the squadData guard so it works pre-squad-load
  - GemTable's ComparisonSearch intentionally does NOT pass lifecycleLabels â€” there is no clubFormMap/squadData in GemTable, so lifecycle deltas are silent in the head-to-head (acceptable per RESEARCH Â§Open Q2)
  - Shared `PlayerSearchInput` is consumed by both new entry points (avoids duplicating the debounce + filter + dropdown logic) â€” Plan 03 depends on Plan 02 because Plan 02 creates this file
**Phase notes**: This is an enhancement of the v1.10 Phase 65 rejection explainer, NOT a replacement. WHY-02 (>20% ownership callout) and WHY-03 (squad-row rejection per-player) from Phase 65 are unchanged. The two new entry points are intentionally additive â€” the existing GemTable row-expand explanation surface stays in place; the new "Compare withâ€¦" button is a sibling action, not a replacement. The â‰¥6 predicate floor is a quality bar â€” the engine MUST surface at least six distinct gate predicates (not six instances of the same one) so the explanation feels comprehensive rather than narrow. Independent of Phase 93 â€” they share the "explain" domain but neither depends on the other.
**UI hint**: yes

### Phase 95: Set-Piece Delivery League Table
**Goal**: Set Pieces tab grows a league-wide ranking of all 20 PL teams by composite delivery-quality score â€” so a manager browsing for set-piece value can see "which clubs have the best deliveries this season?" without inspecting every team's takers individually
**Depends on**: Phase 87 (v1.15 complete); reuses `sp_quality.json` shipped in v1.14 Phase 84 / v1.15 Phase 87 (no pipeline change)
**Requirements**: SPQ-04
**Success Criteria** (what must be TRUE):
  1. A toggle within the existing Set Pieces tab switches between the per-team taker view (current) and a league-table view ranking all 20 PL teams by composite delivery quality â€” corner danger + free-kick danger combined into a single score per team using the existing Empirical-Bayes shrinkage means
  2. League table renders teams in descending order of composite score; each row shows team crest, team name, composite score, corner score, FK score, sample-n indicator, and primary taker (top-ranked corner taker named for context)
  3. Teams with insufficient sample (composite score null because both corner and FK sample sizes fall below their respective gates) are shown in a separate "Insufficient Data" section below the main table â€” never silently dropped, never falsely ranked
  4. Aggregation is pure client-side TypeScript in `src/lib/setPieceLeague.ts` over the existing `sp_quality.json` payload â€” zero pipeline changes, zero new API routes, zero new hooks (reuses the existing `/api/set-pieces` data flow already consumed by SetPieceTakerPanel)
  5. The toggle state is session-only (component-local React state) â€” switching tabs and returning resets to the per-team view; this matches the existing GemTable preset toggle behaviour from v1.5 and avoids surprising state survival
**Plans**: 2 plans (2 waves)
  **Wave 0**
  - [ ] 095-01-PLAN.md â€” RED: `src/lib/setPieceLeague.test.ts` (8 cases: composite formula, descending order, null-handling for insufficient sample, primary-taker extraction, EB shrinkage preservation, deterministic order on tie, empty-input graceful, all-20-teams coverage); `SetPieceLeagueTable.test.tsx` (5 RED cases)
  **Wave 1** *(blocked on Wave 0 completion)*
  - [ ] 095-02-PLAN.md â€” Implement `aggregateSetPieceLeague` in `src/lib/setPieceLeague.ts`; build `SetPieceLeagueTable` component; toggle wiring inside `SetPieceTakerPanel` (segmented "Takers / League Table" pill above existing content); team-crest reuse via `useTeamBadge()` from v1.13 Phase 81
  **Cross-cutting constraints:**
  - Composite score formula extracted as a named constant function (`computeCompositeScore(corner, fk)`) so the weighting can be tuned without touching the table component
  - "Insufficient Data" section uses the same null-tolerant pattern as the v1.14 Phase 85 "â€”" badge â€” never crash, never blank
  - Toggle state lives in `SetPieceTakerPanel` component-local state â€” does NOT lift to page.tsx (no need for cross-tab sharing)
  - `useTeamBadge` from Phase 81 is the single source for crest URLs â€” no inline image paths
**Phase notes**: SPQ-04 is intentionally pure client-side because all the data already exists from v1.14 Phase 84's pipeline work (`sp_quality.json` written per taker). The aggregation step is a one-line groupby-team-and-mean that doesn't warrant a pipeline change. The composite score weighting (corner vs FK) is initially equal-weight; the constant function form makes future tuning trivial. SPQ-05 (cross-season alerts) is explicitly deferred per REQUIREMENTS.md.
**UI hint**: yes

### Phase 96: Captain Decision Backtester
**Goal**: Users can browse a GW-by-GW retrospective of their own captain decisions vs the model's snapshotted recommendation â€” every GW is scored on captain regret (how many points the user lost vs the model's pick at decision time, NOT vs retrospective max) â€” so the manager learns whether their gut overrides actually beat the model or quietly hurt
**Depends on**: Phase 87 (v1.15 complete); requires authenticated FPL API access for actual-captain backfill (already in production via session cookie); writes a new pipeline artifact and adds a new sub-tab to the Accuracy section
**Requirements**: BACK-01
**Success Criteria** (what must be TRUE):
  1. Pipeline saves `captain_picks_gw{N}.json` to Vercel Blob after each run â€” mirroring the existing `predictions_snapshot_gw{N}.json` pattern from Phase 41 â€” so every GW the model's top-3 captain recommendation at decision time is durably snapshotted and cannot drift retrospectively
  2. `/api/decision-history` route reads the per-GW snapshots, joins with the user's actual captain pulled from the authenticated `/entry/{id}/event/{gw}/picks/` endpoint, and returns a per-GW timeline of regret scores; `useDecisionHistory` TanStack Query hook consumes the route
  3. A new "Back" sub-tab appears in the Accuracy section showing GW-by-GW captain regret: user's captain (player + actual points) vs model's snapshotted top recommendation (player + actual points) vs regret score (model_pts Ã— 2 âˆ’ user_pts Ã— 2; positive = user lost points by overriding model); the chart highlights GWs where regret was largest
  4. localStorage ring buffer caches the last 38 GWs of joined data per team ID â€” the chart loads from local cache first then refreshes in background, so a user with many historical GWs sees the timeline instantly on revisit
  5. When the authenticated FPL API call fails (cookie expired) the screen degrades gracefully â€” model snapshots still render with "actual captain unavailable â€” log in to see regret score" placeholder per row; never errors, never blocks the rest of the AccuracyTab
**Plans**: 4 plans (3 waves)
  **Wave 0**
  - [x] 096-01-PLAN.md â€” RED scaffolding: `pipeline/tests/test_captain_snapshots.py` (4 cases: snapshot write, idempotent repeat, blob path convention, cold-start GW-1 absence); `src/lib/regret.test.ts` (8 cases: regret formula, missing-actual graceful, ring-buffer FIFO 38, top-3 snapshot shape, deterministic order, BGW handling, captain swap mid-window, localStorage key by team ID); `BackTab.test.tsx` (5 RED cases); types in `src/lib/types.ts` (`CaptainPickSnapshot`, `RegretEntry`, `DecisionHistory`)
  **Wave 1** *(parallel â€” file-disjoint)*
  - [x] 096-02-PLAN.md â€” Pipeline path: `pipeline/captain_snapshots.py` (writes `captain_picks_gw{N}.json` to Blob with timestamp + top-3 array); `run.py` integration after `merge.py` and the existing `captain_picks.json` write (so this phase is a side-write, not a replacement)
  - [x] 096-03-PLAN.md â€” Regret engine + hook: `src/lib/regret.ts` (`computeRegret`, `mergeWithLocalCache`, `RING_BUFFER_SIZE = 38`); `useDecisionHistory.ts` hook composing snapshot fetch + authenticated picks fetch; `/api/decision-history` route proxying snapshot reads
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 096-04-PLAN.md â€” `BackTab` sub-tab component (timeline list + per-GW regret rows + cookie-expired graceful degradation message); page.tsx wiring under the Accuracy section sub-tab nav (so AccuracyTab grows from "Summary / Calibration" to "Summary / Calibration / Back"); manual UAT covering an authenticated multi-GW history
**Cross-cutting constraints:**
  - The model snapshot is captured at decision time (per-pipeline-run write) so retrospective max-pts is NEVER what the regret is computed against â€” Pitfall: comparing user-pick to retrospective-max paints every override as a loss, which is unfair and uninformative
  - localStorage ring buffer key is `decisionHistory:teamId:{id}` so swapping team IDs (researching another manager's history) does not corrupt the user's own cache
  - `captain_picks_gw{N}.json` snapshots persist forever (no Blob TTL) â€” they are decision evidence, deleting them would break the regret retrospective
  - `useDecisionHistory` MUST handle the unauthenticated path â€” actual-captain backfill fails cleanly, snapshot data still renders
  - The new "Back" sub-tab MUST reuse the existing AccuracyTab nav pattern â€” no new top-level nav entry
**Phase notes**: This is the most complex phase in v1.16 â€” pipeline write + new API route + new hook + new sub-tab + localStorage caching. Sequenced near the end of the milestone so simpler wins ship first. Authenticated FPL API picks endpoint is already used by `useMyTeam` so cookie management is already solved. Ring buffer size 38 = full PL season; cumulative storage at ~10KB per GW Ã— 38 â‰ˆ 400KB which fits comfortably in localStorage (per REQUIREMENTS.md "Out of Scope" note: IndexedDB is overkill). BACK-02 (transfer regret backtester) is explicitly deferred to v1.17 because it requires a Python port of `suggestTransfers()` â€” out of scope here. The regret formula `(model_pts âˆ’ user_pts) Ã— 2` accounts for the captain points-doubling rule.
**UI hint**: yes



<details>
<summary>v1.17 End-of-Season Intelligence (Phases 97-101) - SHIPPED 2026-05-12</summary>

- [x] Phase 97: Fixture Heat Map (2/2 plans) - completed 2026-05-12
- [x] Phase 98: Post-GW Review Core (3/3 plans) - completed 2026-05-12
- [x] Phase 99: Top-10k Comparison (2/2 plans) - completed 2026-05-12
- [x] Phase 100: Decision History Analytics (4/4 plans) - completed 2026-05-12
- [x] Phase 101: GW-Targeted Transfers & UX Polish (3/3 plans) - completed 2026-05-12

See .planning/milestones/v1.17-ROADMAP.md for full phase details.

</details>

### Phase 97: Fixture Heat Map
**Goal**: Users can scan all 20 teams' upcoming fixture difficulty across 8 GWs at a glance -- a single colour-coded grid replaces tab-by-tab fixture inspection and makes end-of-season transfer targeting trivially fast
**Depends on**: Phase 96 (v1.16 complete); reuses existing attacking_difficulty per-fixture values already in useClubForm() output; no pipeline change required
**Requirements**: HEAT-01, HEAT-02
**Success Criteria** (what must be TRUE):
  1. User can toggle the Club Form tab to a heat map view showing all 20 PL teams as rows and the next 8 GWs as columns, with each cell colour-coded green (easy) / amber (medium) / red (hard) using existing attacking_difficulty thresholds
  2. DGW cells are visually distinguished -- shown as a split cell or carrying a "DGW" badge -- so the manager immediately recognises a double-fixture opportunity; BGW teams display a blank/empty cell for that GW
  3. Hovering any cell reveals the specific opponent name and H/A designation so the colour can be cross-checked against the matchup
  4. The full 20x8 grid is accessible on desktop without horizontal scrolling; on mobile it is scroll-bounded with sticky team-name column
**Plans**: 2 plans (2 waves)
  **Wave 1**
  - [x] 97-01-PLAN.md â€” TDD: src/components/club-form/ClubFormViewToggle.tsx + ClubFormTab.tsx + ClubFormTab.test.tsx (pill toggle Form|Heat Map, useState owner, 6 test cases for default view / toggle switches / aria-pressed / submittedId forwarding)
  **Wave 2** *(blocked on Plan 01 completion â€” Plan 02 imports ClubFormTab)*
  - [x] 97-02-PLAN.md â€” src/app/page.tsx nav refactor (D-01 remove fixture-heat-map sub-tab, D-02 move club-form to Analyse after Set Pieces, D-03 keep label "Club Form"/"Form", D-07 replace multi-component club-form block with <ClubFormTab submittedId={submittedId} />, remove FixtureHeatMap import) + src/app/page.test.tsx updates (relocate Planâ†’Club Form test target, MobileNav Form pill assertion to Analyse, replace Phase 66 Heat Map test with two Phase 97 tests for new Analyse order + Club Form toggle render)
  **Cross-cutting constraints:**
  - Plan 01 is self-contained (creates 3 NEW files; no existing-file modification) â€” fully parallel-safe with any other Wave 1 work
  - Plan 02 depends on Plan 01 (imports ClubFormTab); the page.test.tsx mock + nav assertions MUST land in the same plan/commit as the page.tsx structural change to avoid breaking the existing test suite mid-wave (lesson carried from Phase 66 Plan 03 pattern)
**UI hint**: yes

### Phase 98: Post-GW Review Core
**Goal**: After each gameweek settles, users can see how many points they left on the bench, how their captain performed vs the optimal captain in their own squad, and have the review card auto-surface on next visit -- turning each completed GW into a learning moment without manual navigation
**Depends on**: Phase 96 (BackTab + useDecisionHistory hook already exist; authenticated FPL picks endpoint already used); extends existing Squad Review sub-tab pattern from Phase 73
**Requirements**: PGW-01, PGW-02, PGW-04
**Success Criteria** (what must be TRUE):
  1. User can see a post-GW bench summary showing the highest-scoring bench player's points and the total points left on the bench for the most recently settled GW
  2. User can see captain comparison for the settled GW -- their actual captain (player name + points scored x multiplier) vs the highest-scoring player in their squad that GW (player name + points), with the points delta labelled
  3. When the user visits the app after a GW deadline has passed (determined by FPL bootstrap events[].deadline_time), the post-GW review card auto-surfaces without requiring the user to navigate to the Review sub-tab
  4. When no settled GW data is available or squad is not loaded, the review card degrades gracefully with an explanatory prompt rather than an error
**Plans**: 3 plans
Plans:
**Wave 1**
- [x] 98-01-PLAN.md â€” Extend FPLEventSchema with data_checked and GwReview with best_bench_player fields (foundation for both downstream plans)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 98-02-PLAN.md â€” PGW-01: bench summary in /api/gw-review route + Best bench row in GwReviewTab (with new route.test.ts)
- [x] 98-03-PLAN.md â€” PGW-02 live data + PGW-04 auto-surface: useSettledGws hook + page.tsx wiring + auto-surface useEffect
**UI hint**: yes

### Phase 99: Top-10k Comparison
**Goal**: Users can see how their GW score compares to the top-10k average and which template players they did not own that gameweek -- contextualising their result against serious FPL managers and surfacing ownership blind spots
**Depends on**: Phase 98 (Post-GW Review Core -- this phase extends the review card with top-10k data); FPL bootstrap events[].average_entry_score is already available; top-10k average requires FPL league standings API endpoint consideration
**Requirements**: PGW-03
**Success Criteria** (what must be TRUE):
  1. User can see their GW score compared to the top-10k average for that gameweek, with a clear delta (e.g. "+3 vs top-10k average" or "-8 vs top-10k average")
  2. User can see which template players (high-ownership in the top-10k) they did not own that GW, named specifically -- surfacing the differential decisions that most likely explain the gap
  3. When top-10k data is unavailable (API access limitation or GW not yet in top-10k data), the comparison degrades to showing vs overall FPL average from bootstrap events[].average_entry_score, with a clear label indicating which benchmark is shown
**Plans**: 2 plans (2 waves)
Plans:
**Wave 1**
- [x] 99-01-PLAN.md â€” Extend GwReview type with benchmark_score/benchmark_label/missed_players; extend /api/gw-review route.ts with parallel dream-team fetch + benchmark/missed computation; extend route.test.ts with /dream-team/ mock branch + 4 PGW-03 tests (RED â†’ GREEN within plan)

**Wave 2** *(blocked on Wave 1 completion â€” Plan 02 reads new GwReview fields)*
- [x] 99-02-PLAN.md â€” GwReviewTab: extend StatCard with delta+testid props; replace 4th StatCard with benchmark card (sentiment-coloured delta, U+2212 minus sign, FPL-average degraded fallback omits delta); insert conditional Missed info row below Best bench; extend sampleReview + add 8 PGW-03 component tests (UI-SPEC test-visible contracts)
**UI hint**: yes

### Phase 100: Decision History Analytics
**Goal**: Users can see a season-level summary of their decision quality -- captain hit rate, chip ROI, hit break-even tracking -- turning the raw BackTab GW-by-GW regret data into actionable season-level conclusions about their process
**Depends on**: Phase 96 (BACK-01 -- useDecisionHistory hook + BackTab already exist; captain hit rate derives from this data); Phase 98 (post-GW actuals available for chip ROI calculation); authenticated FPL transfer history for HIST-03
**Requirements**: HIST-01, HIST-02, HIST-03
**Success Criteria** (what must be TRUE):
  1. User can see their season captain hit rate -- the percentage of GWs where their captain outscored the field (computed from existing useDecisionHistory / BackTab data, no new pipeline work) -- displayed as a headline metric in the Accuracy section
  2. User can see chip ROI -- the actual points scored in GWs where they used BB, TC, or FH compared to their season average GW score -- making the chip value immediately legible (e.g. "Bench Boost GW29: +14 vs your 52-point average")
  3. User can see hit break-even tracking -- for each -4pt transfer hit taken during the season, whether the player bought outscored the player sold by 4+ points within the expected window -- sourced from authenticated FPL transfer history
  4. When the user is not authenticated, HIST-02 and HIST-03 show a prompt to log in rather than an error; HIST-01 (captain hit rate from BackTab) always renders regardless of auth state
**Plans**: 4 plans (3 waves)
Plans:
**Wave 1**
- [x] 100-01-PLAN.md â€” Foundation: extend types.ts with ChipRoiEntry / HitTrackingEntry / SeasonAnalytics; extend SeasonSummary + computeSeasonSummary with captainHitRate + captainHits (D-02); REDâ†’GREEN in regret.test.ts

**Wave 2** *(blocked on Wave 1 â€” both plans import types/helpers from 100-01)*
- [x] 100-02-PLAN.md â€” Create /api/season-analytics route: parallel /history/ + /transfers/ + per-player /element-summary/ fetch with partial-failure fold; D-04 Wildcard exclusion; D-05 season average; D-07 break-even (round >= event inclusive); 8 REDâ†’GREEN tests
- [x] 100-03-PLAN.md â€” Create useSeasonAnalytics TanStack v5 hook (6h staleTime per D-11, no localStorage per A1); 4 REDâ†’GREEN jsdom tests

**Wave 3** *(blocked on Waves 1+2 â€” consumes hook + extended SeasonSummary)*
- [x] 100-04-PLAN.md â€” Extend BackTab: SeasonSummaryHeader gets HIST-01 inline stat; new ChipRoiSection + HitTrackingSection components below per-GW table; auth-guard + loading + error states wired to useSeasonAnalytics; 9 REDâ†’GREEN component tests
**UI hint**: yes

### Phase 101: GW-Targeted Transfers & UX Polish
**Goal**: Users can select a specific future GW in TransferPanel and see buy candidates re-ranked by that GW's xPts only -- not the current horizon average -- enabling targeted end-of-season planning; and the GwToggle labels are renamed for clarity throughout the app
**Depends on**: Phase 96 (v1.16 complete); operates over existing MergedPlayer data and suggestTransfers() engine; no pipeline change required for either feature
**Requirements**: GWT-01, UX-01
**Success Criteria** (what must be TRUE):
  1. User can select a target GW (e.g. GW36) in TransferPanel and see transfer candidates re-ranked by their projected xPts for that specific GW's fixtures only -- not the 1/3/5 GW horizon average that currently drives ranking
  2. When a target GW is selected, the panel clearly labels which GW is being scored (e.g. "Ranked by GW36 xPts") so the user understands the ranking context has changed
  3. GwToggle labels across the app read "Next 1 GW", "Next 3 GWs", "Next 5 GWs" (replacing "1 GW / 3 GW / 5 GW") in both GwToggle.tsx and all column headers that reference the horizon
  4. UX-01 label rename does not affect any data logic -- it is a pure display string change verified by Vitest snapshot or text-content assertions
**Plans**: 3 plans
Plans:
**Wave 1**
- [x] 101-01-PLAN.md â€” GWT-01 engine: computeGwXpts pure helper (TS port of Python _xpts_per_gw) + suggestTransfers optional targetGw param routing through scorePlayer at all four sites with denominator=1
- [x] 101-03-PLAN.md â€” UX-01: GwToggle button labels {gw} GW â†’ Next {gw} GW{s} + OptimiserPanel.test.tsx line 209 assertion update

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 101-02-PLAN.md â€” GWT-01 UI: TransferPanel targetGw state + Target GW <select> dropdown + availableGws memo + GwToggle disabled wrapper + OpportunityCostTable conditional column header + sub-label
**UI hint**: yes

### Phase 102: MC Gate Activation & MCDistributionBar Display _(v1.18 â€” see `.planning/milestones/v1.18-ROADMAP.md`)_
**Goal**: Users can see haul %, blank %, and P10/P90 outcome distributions for any player in the xPts hover card and on the captain picks card â€” flipping the `mc_enabled` gate so the already-shipped 10k-sim engine surfaces in production for Triple Captain and differential decisions
**Depends on**: Phase 101 (v1.17 complete); reuses existing `pipeline/simulate.py` 10k-sim engine; MC fields (`blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`) already present in `merged_players.json` but gated off by `mc_enabled: false`
**Requirements**: MC-01, MC-02
**Success Criteria** (what must be TRUE):
  1. User can hover any player's xPts cell and see haul %, blank %, P10 pts, and P90 pts displayed via a new `MCDistributionBar` component (rendered only when `haul_prob !== undefined` so legacy / gate-off data degrades silently)
  2. User can see a P10/P90 pts range on each captain picks card row, supporting Triple Captain ceiling vs differential captaincy floor comparison at a glance
  3. The `mc_enabled` gate in `accuracy_backtest.json.summary` is `true` in production and `MC_ITERATIONS=10000` / `MC_SEED=42` are set in the GitHub Actions env block so MC fields populate deterministically on every daily pipeline run
  4. GitHub Actions workflow hygiene is corrected: `anthropic` Python pin aligned from 0.40.0 to 0.98.1, explicit `numpy==2.2.3` added to the install line (no longer transitive via pandas)
**Plans:** 3 plans

**Wave 1** *(all parallel â€” zero file overlap)*
- [x] 102-01-PLAN.md â€” Flip mc_enabled gate to MC_ENABLED=True constant in pipeline/run.py + GitHub Actions hygiene (anthropic==0.98.1, numpy==2.2.3, MC_ITERATIONS=10000, MC_SEED=42)
- [x] 102-02-PLAN.md â€” Create MCDistributionBar component (src/components/mc/) and wire into XPtsCell hover card, replacing inline Blank%/Haul%/Floor/Ceiling rows
- [x] 102-03-PLAN.md â€” Add inline P10/P90 base-points range to CaptainPicksPanel CandidateRow after pts (C)
**Phase notes**: The `mc_enabled` flip is a single state change but unblocks every downstream MC consumer â€” including the NLP-02 prompt context Phase 105 depends on, so this must ship first. Confirm the flip mechanism during planning: `pipeline/run.py` line 203 reads the gate from the previous `accuracy_backtest.json`, so it is either a one-time direct Blob edit OR a pipeline patch that sets the flag from inside the run (validate cleaner path before opening the PR). Pitfall to avoid: do NOT port `simulate.py` MC into browser TypeScript â€” 700 players Ã— 10k sims Ã— `Math.random()` loops freeze the main thread for 2â€“5 seconds; the pipeline is authoritative and the browser reads pre-computed scalars only. Use Tailwind flex row (no Recharts at row scale) for `MCDistributionBar`.
**UI hint**: yes

### Phase 103: Calibration Sparse-Bucket Fix & Health Indicator
**Goal**: Users can trust the per-position calibration tabs â€” sparse-data noise no longer makes the GK/DEF tab look broken when the model is fine â€” and the Decision Summary tab surfaces a one-line calibration health summary so the manager has at-a-glance evidence that today's recommendations are well-calibrated
**Depends on**: Phase 101 (v1.17 complete); independent of Phase 102 (calibration uses analytical xPts decile-rank proxy, not MC); reuses existing `pipeline/accuracy.py` `_compute_calibration_data` and existing `useAccuracy` hook
**Requirements**: CAL-01, CAL-02
**Success Criteria** (what must be TRUE):
  1. User can open the AccuracyTab GK or DEF position tab and no longer see a misleading miscalibration chart at small sample sizes â€” sparse-bucket threshold is raised to `sample_n < 15` for GK/DEF and `sample_n < 8` for MID/FWD, and the chart is hidden entirely with an "Insufficient data" banner when the position-pool total is below 50 observations
  2. User can see a one-sentence calibration health summary on the Decision Summary tab (e.g. "Calibration: good â€” predicted vs actual within 3pp across 4 deciles") derived from existing `useAccuracy` data without any new fetch or pipeline work
  3. When fewer than 3 completed GWs are available (early-season cold start), the per-position calibration chart and the Decision Summary health indicator both degrade gracefully to a "Calibration evidence will appear after 3+ completed GWs" prompt rather than rendering noisy charts
**Plans**: 2 plans

Plans:
- [x] 103-01-PLAN.md â€” Position-aware sparse-bucket threshold + position-pool guard in pipeline/accuracy.py (Python â€” CAL-01)
- [x] 103-02-PLAN.md â€” AccuracyTab CalibrationSection cleanup + CalibrationHealthIndicator component + DecisionSummaryTab integration (TypeScript â€” CAL-01, CAL-02)
**Phase notes**: Purely additive and independent of Phase 102 â€” safe parallelisation candidate but sequenced second so MC gate ships first for downstream momentum. The threshold change in `pipeline/accuracy.py` is a 1-line edit; position-pool guard is a 1-line conditional; health indicator is ~30 LOC of additive React reading an existing hook. Pitfall to avoid: small-bin instability is statistically documented (PMC 7923594) â€” a single haulting GK shifts `actual_rate` by 12+ percentage points at `sample_n` near 8. The all-positions aggregate (~200 obs/decile) is fine at the existing `< 5` filter; only the per-position breakdown needs the tighter threshold. Do not introduce a second charting library â€” reuse existing recharts `ComposedChart`.
**UI hint**: yes

### Phase 104: TransferPanel Sensitivity & Rejection Explainer Wire-Up
**Goal**: Users can see fragility indicators on every transfer buy candidate and expand any sell-side row to see the top-2 plain-English reasons that candidate fell below threshold â€” completing the symmetry across recommendation surfaces so TransferPanel matches the trust signals already present in GemTable and CaptainPicksPanel
**Depends on**: Phase 101 (v1.17 complete); reuses existing `computeFragility` in `src/lib/sensitivity.ts`, existing `computeRejection` in `src/lib/explain.ts`, existing `FragilityBadge` component; both engines are unit-tested and already wired into other call sites
**Requirements**: SENS-01, WHY-01
**Success Criteria** (what must be TRUE):
  1. User can see a fragility indicator on each transfer buy candidate in TransferPanel â€” robust candidates are silent (no badge), fragile candidates show a small amber dot, and knife-edge candidates show an amber pill â€” computed by `computeFragility` with `isTransfer: true` and `xPtsGain` context
  2. User can expand any transfer sell candidate in TransferPanel and see the top-2 plain-English reasons that player fell below the recommendation threshold (e.g. "xPts 4.2 < threshold 4.7", "fragility: knife-edge on start_prob"), computed by the existing `computeRejection` engine
  3. The fragility badge and rejection reasons render only on rows inside the active recommendation set (top transfers, top sell candidates) â€” never on every row â€” so the visual signal does not die from spam after GW30 when many candidates legitimately become fragile
  4. When `computeLifecycleLabel` is required for rejection context, it is either threaded from `page.tsx` via existing `allPlayers` scope or computed locally at the TransferPanel boundary as a safe fallback â€” never breaks if the prop is unavailable
**Plans:** 1/1 plans complete

Plans:
- [x] 104-01-PLAN.md â€” Wire computeRejection into PlayerMoveCell sell side; thread scoredPlayers + lifecycleLabels from TransferPanel into OpportunityCostTable; update tests (WHY-01; SENS-01 already shipped via FragilityBadge in Phase 93 â€” no new code)
**Phase notes**: Both engines ship and are unit-tested â€” this is mechanical addition of call sites, not new logic. Combining SENS-01 and WHY-01 into one phase because both touch `TransferPanel.tsx` with identical risk surface (call-site addition over a unit-tested engine) and produces consistent structured output that Phase 105 LLM prompts depend on for grounding. Pitfall to avoid: do NOT render fragility on rows outside the recommendation set â€” `start_prob` < 0.85 triggers fragility for 40â€“60% of late-season candidates and the signal dies if shown everywhere. Track `fragile_transfer_pct` in `data_health.json` and warn if it exceeds 45% (defer the monitoring wire-up to v1.19 if it stretches scope here). Tier-based visual weight (robust=silent, fragile=dot, knife_edge=pill) is non-negotiable.
**UI hint**: yes

### Phase 105: NLP-02 Per-Player LLM Insight Route, Hook & UI
**Goal**: Users can request an on-demand Claude-generated explanation for any player from GemTable row expand or TransferPanel via an explicit "Get AI insight" button â€” grounded in structured player data (MC fields, rejection reasons, fragility tier) with a name-whitelist guardrail and a two-tier cache, so the model can never invent statistics or auto-fire on row mount
**Depends on**: Phase 102 (MC fields non-null in production so `haul_prob` / `p10_pts` / `p90_pts` are available as prompt context), Phase 104 (rejection reasons and fragility tier wired into TransferPanel as visible UI signals so LLM grounding matches what the user sees)
**Requirements**: NLP-02
**Success Criteria** (what must be TRUE):
  1. User can click an explicit "Get AI insight" button on any GemTable row expand or TransferPanel candidate and see a brief Claude-generated qualitative explanation grounded in that player's structured data (MC fields, top-2 rejection reasons, fragility tier, lifecycle label) â€” never auto-generated on row mount, never fired from `useEffect`
  2. The generated insight is cached for that `(player_id, pipeline_run_date)` pair in localStorage and durably in Vercel Blob (`player_insights/gw{N}/element_{id}.json`, `addRandomSuffix: false`) so the same insight returns instantly on subsequent clicks within the same pipeline cycle, with zero additional Claude API spend
  3. The two-attempt name-whitelist guardrail rejects any response that names players outside the structured context; on guardrail failure for both attempts the UI falls back deterministically to the structured `reasons[]` array (never displays a hallucinated answer)
  4. The Route Handler `/api/player-insight` handles 401 / 429 / 5xx / missing-key / 422-guardrail errors with layered user-facing messages and never streams (non-streaming `messages.create` only â€” Edge runtime is explicitly forbidden because `@anthropic-ai/sdk` SSE parsing fails on Edge)
  5. `ANTHROPIC_API_KEY` is present in the deployment environment before merge and an Anthropic Console monthly spending cap is configured as defence-in-depth against runaway costs
**Plans**: 3 plans
  - [x] 105-01-PLAN.md â€” Wave 0 test scaffolding (RED phase: route, hook, component, OCT additions, GemTable test stubs)
  - [x] 105-02-PLAN.md â€” Wave 1 core infrastructure (PlayerInsight types, /api/player-insight route, usePlayerInsight hook, PlayerInsightSection component)
  - [x] 105-03-PLAN.md â€” Wave 2 integration (TransferPanelâ†’OCTâ†’PlayerMoveCell gw threading, GemTable expand-row insertion, full-suite phase gate, manual UAT checkpoint)
**Phase notes**: This is the only phase with genuinely new infrastructure (new POST Route Handler, new `usePlayerInsight` mutation hook, Blob cache namespace `player_insights/`, Anthropic Console spending cap) and the only phase where a single bug can spend money â€” sequenced last so all upstream context (MC fields from 102, rejection reasons + fragility tier from 104) is validated before the LLM is in the loop. **Runtime: Node.js only â€” never Edge** (`@anthropic-ai/sdk` SSE parsing fails on Edge per anthropics/anthropic-sdk-typescript#292; `maxDuration = 30`). **Trigger: on-demand only â€” never `useEffect`** (50 visible GemTable rows Ã— 900 tokens Ã— 4 sessions/day Ã— 180 days approx. USD 16â€“32/season from a single bug). **`ANTHROPIC_API_KEY` must be in deployment env before merge** (server-side only, never `NEXT_PUBLIC_*`). **Set an Anthropic Console monthly spending cap before shipping** as defence-in-depth. Use `claude-haiku-4-5-20251001` (USD 1 / USD 5 per MTok), `useMutation` not `useQuery` (no auto-refetch), `mutationKey: ['playerInsight', playerId, gw]` for in-flight dedup. Inject structured XML context built from real `computeRejection` + `computeFragility` output; system prompt forbids numeric values (qualitative only); two-attempt name-whitelist guardrail with deterministic fallback to raw `reasons[]` on failure. Prompt caching (`cache_control: ephemeral`) is deferred â€” system prompt is ~80 tokens, far below the 1024-token cache minimum. Phase 5 spike: confirm Vercel Blob `put` with `addRandomSuffix: false` overwrite semantics in the deployed runtime before relying on it for the cache key.
**UI hint**: yes

---

### Phase 106: Code Quality Cleanup _(v1.19 â€” see `.planning/milestones/v1.19-ROADMAP.md`)_
**Goal**: Users get a quieter, more predictable UI on the Decision and Squad surfaces â€” duplicate Tailwind transition utilities removed from the Load Squad button, captain card severity returns the correct LOW signal when no real captain choice exists, and the mobile nav test suite accurately reflects the live 5-pill nav row including the Acc pill
**Depends on**: Phase 105 (v1.18 complete)
**Requirements**: WR-01, WR-02, WR-03, WR-04
**Success Criteria** (what must be TRUE):
  1. User can click the Load Squad button on the Decision Summary tab and see a clean single-transition hover/active animation â€” duplicate `transition-*` Tailwind utilities removed from `DecisionSummaryTab.tsx`, no behavioural change, no regressions in the Decision tab visual layout
  2. User can open the Decision tab with a squad that has fewer than 2 viable captain candidates and see the captain card severity render as LOW (not MEDIUM) â€” `decision-severity.ts` captain branch corrected so `candidates.length < 2` returns `LOW`, matching the documented severity ladder
  3. The MobileNav test suite description text accurately matches the live nav (5 pills, not 4) and includes a regression test that verifies the Acc pill is rendered, is focusable, and routes to the Accuracy sub-tab â€” eliminating two long-standing carry-forward WR items from v1.16
**Plans**: 1 plan (1 wave)
  **Wave 1**
  - [x] 106-01-PLAN.md â€” Clear WR-01/02/04 (WR-03 no-op): replace duplicate transition utilities with transition-all on Load Squad button; captain severity returns LOW when candidates.length less than 2 (update Tests 4 and 5); extend NAV-05 analyse-pills click test to all 7 pills (Form/Acc/Prices)
**Phase notes**: All four WR items are small, independent, mechanical cleanups carried forward from v1.16 (see STATE.md Pre-existing deferred items). Combining into one warm-up phase because each individual fix is â‰¤10 LOC, the risk surface is isolated (one button, one severity branch, one test file), and a single cleanup phase keeps the v1.19 progress table tidy. No new dependencies, no design decisions, no UAT gate beyond the existing Vitest suites turning green. Pitfall to avoid: do NOT bundle WR fixes into the larger NLP-BATCH or MC-CAL phases â€” keep them isolated so a regression in this phase cannot block the higher-value feature work.

### Phase 107: NLP-02 Prompt Caching _(v1.19 â€” see `.planning/milestones/v1.19-ROADMAP.md`)_
**Goal**: User-visible behaviour is unchanged but the per-player AI insight feature ships with Anthropic prompt caching active on the system prompt block â€” every Claude call after the first within the 5-minute cache window pays the cache-read rate (~0.1Ã— input) instead of full input tokens, and cache hit rate is observable in Vercel server logs so cost trajectory can be monitored without a separate dashboard
**Depends on**: Phase 105 (`/api/player-insight` Node.js Route Handler + system prompt block must exist as the target call site); Phase 106 (clean WR baseline)
**Requirements**: CACHE-01, CACHE-02
**Success Criteria** (what must be TRUE):
  1. User can request AI insights for multiple players in the same session and the second-through-N requests within the 5-minute Anthropic cache window cost cache-read input tokens rather than full input tokens â€” system prompt message block in `/api/player-insight` carries `cache_control: {"type": "ephemeral"}` and the prompt body crosses Anthropic's 1024-token minimum (or the call gracefully falls back if it does not)
  2. Server-side Vercel logs include a structured log line per `/api/player-insight` call recording `cache_creation_input_tokens` and `cache_read_input_tokens` from `response.usage`, so cache hit rate can be observed by filtering Vercel logs â€” no separate dashboard, no PII, no player IDs in logs beyond what is already there
  3. The two-attempt name-whitelist guardrail behaviour from Phase 105 is unchanged â€” if the first attempt is cached but fails the guardrail, the retry attempt re-uses the same cached system prompt and continues to fall back to structured `reasons[]` on double failure (caching never degrades the safety contract)
**Plans**: 1 plan
  - [ ] 107-01-PLAN.md â€” Wrap system prompt in TextBlockParam[] with cache_control: ephemeral on both attempt-0 and attempt-1 client.messages.create calls; log usage.cache_creation_input_tokens and usage.cache_read_input_tokens after every successful call; update route.test.ts mocks to include usage field and add a cache-control-shape assertion test
**UI hint**: no
**Phase notes**: Sequenced before NLP-BATCH so any pipeline batch run benefits from caching from day one. Pure server-side change at a single call site â€” `cache_control: ephemeral` on the system prompt message block plus a `console.log` or structured log of `response.usage.cache_creation_input_tokens` / `cache_read_input_tokens`. Pitfall to avoid: the cache requires the prompt prefix to be byte-identical and at least 1024 tokens â€” if Phase 105 system prompt is only ~80 tokens (it is, per Phase 105 phase notes), the prompt body must be padded with stable structural framing OR the test must accept that caching is a no-op until the prompt grows. Confirm prompt token count during planning before relying on the cost saving. No UI work; no user-facing copy change.

### Phase 108: Batch AI Insight Pre-Generation _(v1.19 â€” see `.planning/milestones/v1.19-ROADMAP.md`)_
**Goal**: User clicks "Get AI insight" on a top-20 player and the response is instant (Vercel Blob read, ~50â€“150ms) instead of the previous 2â€“6 second Claude round-trip â€” the daily pipeline pre-generates insights for the 20 highest-`xPts_1gw` players and writes them to the same Blob namespace the on-demand route uses, so the existing two-tier cache (localStorage â†’ Blob â†’ live API) finds a hit on first interaction for the most-viewed candidates
**Depends on**: Phase 107 (prompt caching active so the batch job runs at cache-read cost from the second player onward; same `cache_control` block keeps batch and on-demand paths cost-aligned); Phase 105 Blob namespace (`player_insights/gw{N}/element_{id}.json`)
**Requirements**: NLP-BATCH-01, NLP-BATCH-02, NLP-BATCH-03
**Success Criteria** (what must be TRUE):
  1. After a daily pipeline run with `INSIGHT_BATCH_ENABLED=true`, Vercel Blob contains insight files at `player_insights/gw{N}/element_{id}.json` for each of the top 20 players ranked by `xPts_1gw` from that day's `merged_players.json`, written with `addRandomSuffix: false` and `allowOverwrite: true` so subsequent days overwrite the same keys cleanly
  2. With `INSIGHT_BATCH_ENABLED=false` (or unset), the daily pipeline runs to completion without making any Anthropic API calls â€” the batch step is fully skippable and isolated in a try/except block so a batch failure cannot break the rest of the pipeline (`merged_players.json`, `captain_picks.json`, `accuracy_backtest.json` all still write)
  3. User can click "Get AI insight" on a top-20 player after a successful batch run and see the insight render within 200ms with zero new Claude spend â€” `usePlayerInsight` hits the Blob via the existing read path with no UI change required; on cache miss (non-top-20 player, batch disabled, or fresh GW before batch ran) on-demand generation still fires exactly as before
**Plans**: 3 plans (3 waves)
  **Wave 1**
  - [x] 108-01-PLAN.md â€” Create pipeline/batch_insights.py (generate_batch_insights signature, _passes_guardrail, 2-attempt strict retry, cache_control ephemeral, save() abstraction) + 10 unit tests with mocked Anthropic SDK [NLP-BATCH-01]
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 108-02-PLAN.md â€” Insert INSIGHT_BATCH_ENABLED-gated batch step in pipeline/run.py after prose_summary except block; top-20 selection by xPts_1gw (status=a, selected_by_percent tie-break); non-fatal try/except; 6 new integration tests [NLP-BATCH-02, NLP-BATCH-03]
  **Wave 3** *(gap closure â€” blocked on Wave 2; closes NLP-BATCH-03 verification gap)*
  - [x] 108-03-PLAN.md â€” Add Blob read-before-generate cache path to /api/player-insight/route.ts so pre-generated insights served by Plan 01 batch are returned to users (~50ms) instead of re-generated; 4 new vitest tests for cache hit/miss/USE_BLOB-false/read-error fallback [NLP-BATCH-03]
**UI hint**: no
**Phase notes**: Pipeline-side feature only â€” no UI changes required because the existing two-tier cache (Phase 105) reads Blob transparently. The batch step lives in `pipeline/run.py` after `merged_players.json` is finalised and runs strictly behind `INSIGHT_BATCH_ENABLED` to keep cost controllable independently of the daily refresh. Pitfall to avoid: do NOT pre-generate insights for all 700 players â€” top-20 only (20 Ã— ~900 tokens Ã— ~30 cents per MTok â‰ˆ free at cache-read rate after the first call, but bypassing the cap is the kind of bug that bills USD 100/month silently). Top-20 selection rule: rank by `xPts_1gw` after status filter (`status == 'a'`); ties broken by `selected_by_percent` desc; cap is a hard 20 even if 21st-ranked player ties. Anthropic Console monthly spending cap from Phase 105 remains the defence-in-depth ceiling. Sequenced after Phase 107 so caching is live before batch generation amplifies the call volume.

### Phase 109: MC-Enabled Calibration _(v1.19 â€” see `.planning/milestones/v1.19-ROADMAP.md`)_
**Goal**: User trusts the calibration evidence more because predicted haul rates are now grounded in actual 10k-sim MC `haul_prob` percentiles rather than an analytical xPts decile-rank proxy â€” and the CalibrationHealthIndicator on the Decision Summary labels which mode the calibration is running in so the manager knows whether they are looking at MC-grounded or analytical-fallback evidence
**Depends on**: Phase 102 (v1.18) â€” `MC_ENABLED = True` must be live in production so `haul_prob` is non-null for every player on every daily run; Phase 103 (v1.18) â€” `_compute_calibration_data` + `CalibrationHealthIndicator` exist as the modification surface
**Requirements**: MC-CAL-01, MC-CAL-02
**Success Criteria** (what must be TRUE):
  1. Calibration backtest in `pipeline/accuracy.py` uses MC `haul_prob` (P(pts â‰¥ 10) from 10k sims, per-player per-GW) as the `predicted_rate` for each decile bin, replacing the analytical xPts decile-rank proxy â€” gated by the existing `mc_enabled` flag in `accuracy_backtest.json.summary` so a future gate flip cleanly reverts to the analytical path without code change
  2. User can open the Decision Summary tab and see the CalibrationHealthIndicator render a distinguishing label (e.g. "Calibration: good â€” MC-grounded" vs "Calibration: good â€” analytical fallback") so it is observable from the UI which calibration mode is in use; no new fetch, no new endpoint â€” derived from existing `useAccuracy` payload via a new `calibration_mode: 'mc' | 'analytical'` field on the summary
  3. When `mc_enabled` is true but MC fields are partially missing (e.g. a player without `haul_prob` due to a pipeline gap), the calibration computation falls back to the analytical proxy for that player only and the summary still reports `calibration_mode: 'mc'` if â‰¥80% of the population has MC fields â€” graceful degradation, never NaN, never an empty chart
**Plans**: 2 plans (1 wave â€” parallel)
  **Wave 1**
  - [x] 109-01-PLAN.md â€” Python pipeline: `_compute_calibration_data` MC path + `compute_accuracy_backtest` calibration_mode + run.py haul_lookup wire-up (TDD) (complete 2026-05-14)
  - [x] 109-02-PLAN.md â€” TypeScript: AccuracySummary type + CalibrationHealthIndicator MC/Analytical badge + D-11 `predicted_rate` bug fix (TDD) (complete 2026-05-14)
  **Cross-cutting constraints:**
  - Plans 01 and 02 share zero `files_modified` (Python pipeline vs TypeScript component) â€” can run in parallel within Wave 1
  - Plan 02 ships with null-render fallback for legacy cache (no `calibration_mode` field); the field becomes populated after the first daily pipeline run that includes Plan 01
**UI hint**: yes
**Phase notes**: Two-file change at heart â€” `pipeline/accuracy.py` (`_compute_calibration_data` switches from analytical decile rank to MC `haul_prob` percentile when `mc_enabled and haul_prob is not None`; emits `calibration_mode` on the summary) and `CalibrationHealthIndicator.tsx` (renders the mode label). MC-CAL was deferred from v1.18 (see STATE.md Pre-existing deferred items) and unblocks now that MC-01 has shipped and `haul_prob` is populated in production. Pitfall to avoid: do NOT compute MC haul rate as raw count â‰¥ 10 across the population â€” use per-player `haul_prob` (already in `merged_players.json`) averaged within each decile bin, which is what the analytical proxy approximates and what makes the MC and analytical paths directly comparable. The â‰¥80% population coverage rule for declaring `calibration_mode: 'mc'` is from the existing position-pool guard pattern in Phase 103 â€” keep the threshold consistent.


### Phase 110: GW Review & History Fixes _(v1.20)_
**Goal**: User trusts the post-gameweek summary because the top scorer, bench points, dream-team comparison and decision-history captain analytics all display correct numbers â€” eliminating four data-accuracy bugs that currently undermine the review/history surfaces
**Depends on**: Phase 109 (v1.19 complete)
**Requirements**: FIX-03, FIX-04, FIX-05, FIX-06
**Success Criteria** (what must be TRUE):
  1. User can open GW Review after a settled gameweek and see the top scorer card render the playerâ€™s actual points alongside the player name (no missing-points display)
  2. User can open GW Review and see the best bench card display the actual bench points scored that gameweek (never a stuck zero when bench points were earned)
  3. User can open GW Review and see the dream-team delta with the correct sign â€” positive when the dream team outscored the user (e.g. +50 when user=72 and dream team=122), never sign-inverted
  4. User can open the Back / Decision History view and see the captain delta column populated with the actual points difference per gameweek instead of dashes for every row
**Plans**: 3 plans (1 wave)
  **Wave 1** *(all parallel â€” zero file overlap)*
  - [x] 110-01-PLAN.md â€” FIX-05 dream team delta sign + sentiment fix (GwReviewTab.tsx)
  - [x] 110-02-PLAN.md â€” FIX-03/04 event/{gw}/live/ liveMap for top scorer + best bench points (gw-review/route.ts)
  - [x] 110-03-PLAN.md â€” FIX-06 element-summary deduped fan-out for modelCeilingPts (decision-history/route.ts; new test file)
**UI hint**: yes
**Phase notes**: Four independent data-accuracy fixes that all live in the GW Review / Decision History surfaces (`/api/gw-review`, `/api/decision-history`, `GwReviewTab`, `BackTab`). Grouped together so a single TDD pass can lock down all four with one round of UAT against last-settled-GW data. Pitfall to avoid: the four bugs may share a root cause (e.g. a single mis-typed field name in `gw_review_gw{N}.json` or a sign convention drift between pipeline writer and UI reader) â€” investigate cross-bug correlations during research before assuming four isolated patches.

### Phase 111: Fixture Heatmap & Planner Cross-Position Fixes _(v1.20)_
**Goal**: Users see correct fixtures on the heatmap during mid-week gameweeks and never get cross-position transfer suggestions â€” two engine/data-layer bugs that compromise core planning surfaces are resolved
**Depends on**: Phase 110
**Requirements**: FIX-01, FIX-02
**Success Criteria** (what must be TRUE):
  1. User can view the fixture heat map mid-week when their team has already played the current gameweek and see the current GW cell render that teamâ€™s completed fixture (or a "played" state), NOT a false BGW indicator
  2. User can open the transfer planner, select a player to transfer out, and see only buy candidates of the same position (no MID candidates suggested for a GK sell, no FWD candidates for a DEF sell, etc.)
  3. Position-lock is enforced everywhere `suggestTransfers` / planner candidate ranking surfaces a buy suggestion â€” Squad Transfers, Manual Plan, Route Tree, Decision Summary OCS sells, all honour the same rule
**Plans**: 4 plans
  - [x] 111-01-PLAN.md â€” FIX-01 data layer: extend ClubForm with current_gw_played, populate from finished current-GW fixtures in computeClubForm, pass bootstrap.events through /api/club-form route (TDD)
  - [x] 111-02-PLAN.md â€” FIX-01 render layer: extend FixtureHeatMap with byTeamGwPlayed map and three-way cell branch (true BGW / played single / played DGW), dimmed via opacity-40 with "â€” Played" tooltip (TDD)
  - [x] 111-03-PLAN.md â€” FIX-02 engine guard + audit: position-lock regression tests (single + combo), defensive element_type guard at suggestTransfers entry per D-09, FIX-02 annotations on all 4 call sites (TDD)
  - [x] 111-04-PLAN.md â€” FIX-01 gap closure: add partially-played DGW render branch (fixtures.length === 1 AND playedFixtures.length >= 1) in FixtureHeatMap with mixed-state tooltip; harden CR-02 fallback-sort in club-form.ts (TDD)
**UI hint**: yes
**Phase notes**: Two unrelated bugs combined because both are short, isolated, engine/data-layer fixes in adjacent code areas (fixture heatmap aggregation, transfer suggestion engine). FIX-01 root cause likely sits in `FixtureHeatMap` BGW detection logic (`fixtures.length === 0` vs `fixtures.filter(f => f.finished === false).length === 0`). FIX-02 root cause is likely missing or wrong position filter in `suggestTransfers` / planner candidate selection â€” every existing call site should be audited because v1.6 onwards added several new paths (RouteTree, Manual Plan, GW-targeted scoring) that may have regressed the v1.0 position lock.

### Phase 112: Optimiser On-Demand & Transfer Suggestion Cap _(v1.20)_
**Goal**: Users get a calmer, more deliberate planning surface â€” the Optimiser tab no longer auto-computes when opened (button-gated, eliminating wasted compute on tab switches), and transfer suggestion lists never overwhelm with more than 3 candidates per position slot so the user can focus on the meaningful top picks
**Depends on**: Phase 111
**Requirements**: OPT-01, TFR-02
**Success Criteria** (what must be TRUE):
  1. User can open the Squad â†’ Optimiser sub-tab and see an empty state with a clear "Optimise Lineup" call-to-action button â€” no calculation runs until the user clicks the button
  2. User can click the "Optimise Lineup" button and the optimiser computes and renders results as before, with all existing controls (1/3/5 GW horizon, chip modes, captain/VC) functioning identically to pre-fix behaviour
  3. User can open the Squad â†’ Transfers sub-tab and see at most 3 buy candidates per position slot in the transfer suggestion list â€” ranked by gem delta descending with affordable candidates first, surplus candidates truncated
**Plans**: 3 plans
  - [x] 112-01-PLAN.md â€” capByPosition pure utility + tests (TFR-02 foundation)
  - [x] 112-02-PLAN.md â€” OptimiserPanel: OPT-01 button gate + TFR-02 cap/footnote in transferSuggestions
  - [x] 112-03-PLAN.md â€” TransferPanel + OpportunityCostTable: TFR-02 cap/footnote in ocsSuggestions
**UI hint**: yes
**Phase notes**: Two small UX-layer fixes grouped because both modify Squad sub-tab surfaces with no engine changes. OPT-01: lift `optimisationResult` initial computation out of `useEffect` mount and behind an explicit button click; preserve all downstream wiring (comparison table, headline row, chip toggle). TFR-02: cap is per-position-slot, not global â€” apply after sort, after affordability ordering, so the top-3 are the *best* top-3 not an arbitrary slice. Confirm with the user whether "position slot" means by `element_type` (GK/DEF/MID/FWD) or by the specific squad-slot being filled (15 slots) â€” defaults to `element_type` if no clarification.

### Phase 113: Transfer Regret Backtester _(v1.20)_
**Goal**: User can see, per past gameweek, what the transfer engine recommended that week vs what they actually did â€” with the hindsight xPts delta showing whether the engineâ€™s recommendation would have earned more, less, or the same points; surfaces a new "Transfer Regret" view alongside the existing captain-decision backtester so transfer ROI becomes observable for the first time
**Depends on**: Phase 112; Phase 96 (BACK-01 captain backtester pattern provides the snapshot + per-GW join + recharts template); Phase 109 (v1.19 MC calibration provides the trusted scoring substrate)
**Requirements**: BACK-02
**Success Criteria** (what must be TRUE):
  1. Pipeline snapshots a per-GW transfer recommendation for each user (or, where snapshot is impractical, computes a deterministic recommendation post-hoc from that GWâ€™s `merged_players.json`) so the engineâ€™s "what would I have recommended last GW" answer is auditable and stable across runs
  2. User can open the Back / Decision History tab and see a new "Transfer Regret" section listing, per past settled GW: engine-recommended OUT player, engine-recommended IN player, userâ€™s actual transfer (if any), and the hindsight xPts delta between engine and actual (e.g. +3.2 means engine pick would have outscored, âˆ’1.5 means userâ€™s pick was better)
  3. The Transfer Regret view degrades gracefully when no snapshot exists (early GWs, users with no transfer history) â€” empty state, never NaN, never a broken chart; cumulative-delta headline updates when enough GWs have data
  4. The hindsight scoring uses actual realised points (FPL `event-summary`) for both the engine pick and the userâ€™s pick, NOT predicted xPts â€” so "regret" is grounded in what actually happened, mirroring the captain-decision backtester rule
**Plans**: 4 plans (3 waves)
  **Wave 1**
  - [x] 113-01-PLAN.md â€” Pipeline slim snapshot module + run.py side-write + TransferRegretEntry/SlimPlayer types
  - [x] 113-02-PLAN.md â€” TDD: computeTransferDelta + computeTransferSeasonSummary in src/lib/regret.ts
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 113-03-PLAN.md â€” /api/decision-history extension: readTransferSlimSnapshot, squad reconstruction, suggestTransfers post-hoc, element-summary fan-out, transferEntries response field
  **Wave 3** *(blocked on Wave 2 completion)*
  - [x] 113-04-PLAN.md â€” BackTab Captain|Transfer pill toggle + TransferRegretView (summary + bar chart + per-GW rows) + tests + human-verify checkpoint
**UI hint**: yes
**Phase notes**: Largest v1.20 phase. Requires Python (or TypeScript) port of the `suggestTransfers` recommendation rule so the pipeline can write `transfer_recommendation_gw{N}.json` to Vercel Blob as a durable snapshot trail (mirroring `captain_picks_gw{N}.json` from Phase 96). `/api/decision-history` extended to join the snapshot with the userâ€™s `event_transfers` from authenticated FPL data + element-summary point totals. New `TransferRegretSection` component on the existing `BackTab` (do NOT add a new sub-tab). Pitfall to avoid: do NOT recommend transfers retroactively using *future* GW data â€” recommendation snapshot must use the data available at deadline minus 1 hour, so the regret comparison is honest. Carry-forward item BACK-02 from v1.19 Deferred Items is now resolved by this phase. BACK-03 (full transfer ROI tracker requiring a multi-GW persistent store) remains out of scope and stays in the v1.20 Out of Scope section.

### âœ… Phase 114: Polish & Carry-Forward Fixes _(v1.21)_ â€” COMPLETE 2026-05-16
**Goal**: Users see a corrected and enriched GemTable surface â€” the Transfer Route Tree "Hits" label shows the right number, a disabled ChipToggle stub is visible in RouteTreeTab, the Transfer Regret Backtester passes human UAT on all four visual dimensions, and GemTable gains a rank trajectory sparkline column so managers can see trend direction at a glance
**Depends on**: Phase 113 (v1.20 complete; BACK-02 code delivered; rank_trajectory already in MergedPlayer)
**Requirements**: UAT-01, TRT-01, TRT-02, SPARK-01
**Success Criteria** (what must be TRUE):
  1. User opens the Transfer Regret Backtester in dark mode and sees correct colour polarity (positive delta = green, negative = red), correct multi-transfer GW formatting, and no captain regression artefacts â€” all four UAT-01 visual checkpoints pass
  2. User opens RouteTreeTab and sees the "Hits" column display the correct total hits count (matching the engine's totalHits field, not totalTransfers)
  3. User opens RouteTreeTab and sees a ChipToggle UI element that is visibly present but disabled, replacing the implicit null hardcode
  4. User opens GemTable and sees a rank trajectory sparkline mini-column showing the player's ownership rank trend across recent GWs, rendered as an inline SVG or Recharts sparkline
**Plans**: 3 plans (2 waves)
  **Wave 1** *(parallel)*
  - [x] 114-01-PLAN.md -- ChipToggle disabled prop + RouteTreeTab: totalHits cell fix + disabled ChipToggle stub (TRT-01, TRT-02)
  - [x] 114-02-PLAN.md -- GemTable: rank_trajectory sparkline column in columns.tsx + MOBILE_HIDDEN_COLUMNS + compact preset (SPARK-01)
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 114-03-PLAN.md -- UAT-01 human visual checkpoint: BackTab dark mode, delta colour, multi-transfer format, captain separation (UAT-01)
**UI hint**: yes

### âœ… Phase 115: Team News Wiring _(v1.21)_ â€” COMPLETE 2026-05-17
**Goal**: Users see live FPL team news on the two highest-stakes decision surfaces â€” captain picks and transfer candidates â€” with a 14-day staleness suppression gate ensuring zinc-severity badges for long-settled news never dilute the signal quality on decision-critical surfaces
**Depends on**: Phase 114; NEWS-01 staleness suppression is a prerequisite that must exist before NewsBanner is wired into any new call site â€” deploying NEWS-02 or NEWS-03 without this gate would cause badge fatigue
**Requirements**: NEWS-01, NEWS-02, NEWS-03
**Success Criteria** (what must be TRUE):
  1. NewsBanner badges with zinc severity and a news_added date older than 14 days are suppressed from display â€” red and amber severity badges are never suppressed regardless of age
  2. User sees NewsBanner in CaptainPicksPanel candidate rows â€” team news (e.g. "75% chance of playing") is shown alongside each captain pick candidate, using the same severity colour-coding as TransferPanel
  3. User sees NewsBanner in TransferPanel / OpportunityCostTable buy-candidate rows with staleness suppression from NEWS-01 applied â€” stale zinc news does not appear on buy candidates
**Plans**: 2 plans
- [x] 115-01-PLAN.md â€” NEWS-01 staleness suppression guard in NewsBanner + 5 new Vitest cases (Wave 1)
- [x] 115-02-PLAN.md â€” NEWS-02 NewsBanner wiring into CaptainPicksPanel CandidateRow + NEWS-03 automated staleness verification in OpportunityCostTable (Wave 2)
**UI hint**: yes

### âœ… Phase 116: Prose Staleness & Model Versioning _(v1.21)_ â€” COMPLETE 2026-05-17
**Goal**: Users can see when the weekly AI prose summary was generated (so they know whether it reflects a post-deadline injury) and can browse a version history of the accuracy model showing hit rate and sample size per formula version â€” closing two trust-signal gaps that make the model's outputs harder to rely on without transparency
**Depends on**: Phase 115; VER-01 schema extension must land in the pipeline before VER-02 UI is built
**Requirements**: PROSE-01, PROSE-02, VER-01, VER-02
**Success Criteria** (what must be TRUE):
  1. User sees the prose summary generation time displayed as relative time ("Updated 2 hours ago") in ProseSummaryBlock alongside the GW label â€” amber note appears when summary is older than 20 hours
  2. Pipeline weekly prose narrative includes chip timing context and lifecycle risk flags, producing a richer decision summary that covers more than just captains and gems
  3. accuracy.py version records include a sample_gws integer field so the version comparison UI can correctly label or filter cold-start entries where 0 GWs have contributed to the hit rate
  4. User sees a "Versions" pill in the AccuracyTab pill nav (alongside "Summary | Calibration | Back"), displaying a VersionHistoryTable with formula version, date, hit rate, gate flags, and sample_gws â€” cold-start entries (sample_gws < 3) are labelled rather than shown as misleading 0.0% regressions
**Plans**: 4 plans
Plans:
**Wave 1**
- [x] 116-01-PLAN.md â€” PROSE-01 ProseSummaryBlock staleness footer (relative time + amber when >=20h)
- [x] 116-02-PLAN.md â€” PROSE-02 prose pipeline DGW + lifecycle enrichment
- [x] 116-03-PLAN.md â€” VER-01 sample_gws field on accuracy.py version records + VersionRecord TS type

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 116-04-PLAN.md â€” VER-02 Versions sub-tab in AccuracyTab with Sample GWs column + cold-start render
**UI hint**: yes


<details>
<summary>v1.22 Lineup Intelligence (Phases 117-119) â€” IN PROGRESS</summary>

- [x] **Phase 117: Scraper Pipeline & Artifact** â€” lineup_news.json pipeline, API route, hook, staleness guard
 (completed 2026-05-17)
- [x] **Phase 118: Engine Integration** â€” suggestTransfers() and optimiseLineup()/benchOrder() availability_factor penalties
 (completed 2026-05-17)
- [x] **Phase 119: UI Surfaces** â€” captain badge, transfer flag, Team News Alert card, Decision Summary wiring
 (completed 2026-05-18)

</details>

<details>
<summary>âœ… v1.23 Technical Debt &amp; Test Health (Phases 120-121) â€” SHIPPED 2026-05-18</summary>

- [x] **Phase 120: Test Suite Restoration** â€” fix all 25 failing tests across captain-picks, MobileNav, useRivals, club-form (TH-01/02/03/04)
- [x] **Phase 121: Deferred Docs & Verification** â€” Phase 60 VERIFICATION.md (DOC-01) + Phase 48 hover card live check (VER-01) *(2026-05-18)*

</details>

<details>
<summary>âœ… v1.24 End of Season &amp; Off-Season Intelligence (Phases 122-126) â€” SHIPPED 2026-05-19</summary>

See `.planning/milestones/v1.24-ROADMAP.md` for full phase details.

- [x] Phase 122: Polish Carry-Forwards (2/2 plans) â€” completed 2026-05-18
- [x] Phase 123: SCRAPER-02 Pipeline (3/3 plans) â€” completed 2026-05-18
- [x] Phase 124: Season Review (3/3 plans) â€” completed 2026-05-19
- [x] Phase 125: Summer Window Tracker (3/3 plans) â€” completed 2026-05-19
- [x] Phase 126: Next Season Planner (4/4 plans) â€” completed 2026-05-19

</details>


### Phase 117: Scraper Pipeline & Lineup News Artifact
**Goal**: Pipeline emits lineup_news.json with per-player availability signals from four sources (FPL official, premierleague.com, Sky Sports RSS, BBC Sport RSS) -- accessible via API route and hook, with non-fatal scraper isolation and a staleness guard
**Depends on**: Phase 116 (v1.21 complete)
**Requirements**: SCRP-01, SCRP-02, SCRP-03, SCRP-04, SCRP-05, SCRP-06, INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):
  1. Pipeline writes lineup_news.json to Vercel Blob with a source_health object tracking ok/last_success/last_error per scraper source; any scraper failure leaves merged_players.json intact and never writes an empty players[] array to Blob
  2. Each player entry carries availability_factor (1.0 / 0.75 / 0.5 / 0.25 / 0.0) and status_label (confirmed_start / doubted / confirmed_absent / unknown) derived from FPL official bootstrap fields as primary source
  3. /api/lineup-news route reads lineup_news.json from Vercel Blob and useLineupNews TanStack Query hook (6h staleTime) fetches from the route, following the established gw-intel / set-pieces artifact pattern
  4. All engine consumers treat lineup_news.json with scraped_at older than 48 hours as neutral -- no availability_factor penalty is applied when data is stale
  5. premierleague.com, Sky Sports RSS, and BBC Sport RSS scrapers each run in an isolated try/except block outside the main pipeline try; a failure in any one source does not block the others or the main pipeline
**Plans**: 2 plans

  **Wave 1**
  - [x] 117-01-PLAN.md â€” Python pipeline: lineup_news.py module + run.py integration + tests + requirements

  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 117-02-PLAN.md â€” TypeScript layer: types + /api/lineup-news route + useLineupNews hook

  **Cross-cutting constraints:**
  - pipeline/upload.py `save()` is the only Blob write path â€” never call Vercel Blob SDK directly
  - Empty `players[]` must never be written to Blob (SCRP-05)
  - Web scrapers never mutate `availability_factor` â€” FPL bootstrap is sole source (D-03)
**UI hint**: no

### Phase 118: Engine Integration
**Goal**: Transfer suggestions and lineup optimiser/bench order penalise doubted and confirmed-absent players when lineup news is available -- making the engine's recommendations reflect real-world injury and selection signals
**Depends on**: Phase 117 (lineup_news.json Blob artifact and useLineupNews hook must exist)
**Requirements**: ENGN-01, ENGN-02 (also closes Phase 117 INFRA-02 gap in Plan 01)
**Success Criteria** (what must be TRUE):
  1. A confirmed-absent buy candidate scores near-zero in suggestTransfers() output -- the availability_factor x0.01 multiplier sinks the player to the bottom of every position bucket regardless of xPts
  2. A doubted buy candidate (availability_factor 0.75) is visibly downranked relative to an equally-rated healthy candidate in the transfer suggestion list
  3. A confirmed-absent player in the squad bench sinks to the last bench slot automatically in benchOrder() output -- consistent with BGW treatment (EV score effectively 0)
  4. When lineupNewsMap is absent or stale (>48 hours), suggestTransfers() and optimiseLineup()/benchOrder() produce identical output to their pre-ENGN state -- no degradation for users with no news data
**Plans**: 3 plans

  **Wave 1**
  - [x] 118-01-PLAN.md â€” Close Phase 117 INFRA-02 gap: add 48h staleness select transform to useLineupNews hook + Vitest coverage

  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 118-02-PLAN.md â€” ENGN-01 TDD: suggestTransfers buy-side availability_factor penalty (scoreBuyCandidate closure + 6 tests)
  - [x] 118-03-PLAN.md â€” ENGN-02 TDD: optimiseLineup + benchOrder absent-player exclusion / evScore=0 (6 tests)

  **Cross-cutting constraints:**
  - Sell-side scoring stays unpenalised (D-01) â€” Phase 119 UI-03 Team News Alert handles selling urgency
  - Only confirmed_absent triggers starter exclusion and bench zero-out (D-08) â€” doubted players still selectable as starters
  - 0.01 floor for absent buy candidates (D-02) â€” ensures they appear at bottom of position buckets rather than disappearing
**UI hint**: no

### Phase 119: UI Surfaces
**Goal**: Captain picks, transfer candidates, and Decision Summary all surface player availability status -- confirmed-absent and doubted players are visually flagged so the manager never blindly acts on a recommendation for an injured player
**Depends on**: Phase 117 (useLineupNews hook), Phase 118 (engine params accepting lineupNewsMap)
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. CaptainPicksPanel CandidateRow shows a status badge (confirmed_start / doubted / confirmed_absent) for each player when lineup news is available -- badge absent when no news entry exists for that player
  2. TransferPanel OCS buy-candidate rows show an inline news confidence badge or news text for doubted/absent players when lineup news is available -- healthy players show nothing extra
  3. Decision Summary tab shows a "Team News Alert" severity card listing owned squad players with active news (within 14 days), respecting the existing NEWS-01 staleness gate from Phase 115
  4. Decision Summary tab OCS table reflects availability penalties -- DecisionSummaryTab threads lineupNewsMap into its suggestTransfers() call so the table rankings match the penalised engine output
**Plans**: 3 plans

  **Wave 1**
  - [x] 119-01-PLAN.md â€” Create shared StatusLabelBadge component (red pill confirmed_absent, amber pill doubted, null for confirmed_start/unknown/undefined) + Vitest coverage

  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 119-02-PLAN.md â€” UI-01 + UI-02: useLineupNews wired into CaptainPicksPanel CandidateRow; OpportunityCostTable accepts optional lineupNewsMap prop and renders StatusLabelBadge for buy candidate; TransferPanel forwards the map

  **Wave 3** *(blocked on Wave 2 completion)*
  - [x] 119-03-PLAN.md â€” UI-03 + UI-04: DecisionSummaryTab calls useLineupNews, threads lineupNewsMap into suggestTransfers and OpportunityCostTable, and renders the Team News Alert section between the 2x2 grid and CalibrationHealthIndicator
**UI hint**: yes


### Phase 120: Test Suite Restoration
**Goal**: The test suite is fully green with all 25 pre-existing failures resolved across four test files
**Depends on**: Phase 119 (v1.22 complete)
**Requirements**: TH-01, TH-02, TH-03, TH-04
**Success Criteria** (what must be TRUE):
  1. captain-picks test file exits clean with all 5 tests passing (CAP-03/CAP-04 CaptainPicksPanel rendering, tests/lib/captain-picks.test.ts)
  2. MobileNav test file exits clean with all 10 tests passing (NAV-01 through NAV-05, Lineup tab drift from Phase 119 resolved, src/components/nav/MobileNav.test.tsx)
  3. useRivals test file exits clean with all 8 tests passing (ML-01/02/08, D-05 sub-tab memory, src/lib/hooks/useRivals.test.ts)
  4. club-form test file exits clean with all 1 tests passing (difficulty-tier classification assertion, tests/lib/club-form.test.ts)
  5. Full vitest suite passes with no new failures introduced by the fixes
**Plans**: 4 plans
  - [x] 120-01-PLAN.md â€” Fix captain-picks JSX render (TH-01)
  - [x] 120-02-PLAN.md â€” Add QueryClientProvider wrapper to MobileNav tests (TH-02)
  - [x] 120-03-PLAN.md â€” Add data_checked to useRivals bootstrap fixture (TH-03)
  - [x] 120-04-PLAN.md â€” Update event 32 difficulty fixture for club-form (TH-04)

### Phase 121: Deferred Docs & Verification
**Goal**: The VERIFY-60 documentation debt is cleared and the Phase 48 XPtsCell appearance_pts hover card is confirmed live in production
**Depends on**: Phase 120 (clean suite baseline established; verification is independent of test fixes but sequenced after for review clarity)
**Requirements**: DOC-01, VER-01
**Success Criteria** (what must be TRUE):
  1. The Phase 60 VERIFICATION.md file exists at the correct path, is committed, and documents what was shipped in Phase 60 (Transfer Route Tree) with acceptance sign-off
  2. A developer can open the production app, load a player's XPtsCell hover card, and confirm that appearance_pts is rendered as a separate named row in the breakdown (not absent or zero)
**Plans**: 3 plans

  **Wave 1**
  - [x] 121-01-PLAN.md â€” Write Phase 60 historical VERIFICATION.md (DOC-01)
  - [x] 121-02-PLAN.md â€” Write Phase 48 VERIFICATION.md + human production confirmation of appearance_pts hover card (VER-01)

  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 121-03-PLAN.md â€” Update REQUIREMENTS.md traceability table for DOC-01 and VER-01

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
| 47 | v1.7 | 5/5 | Complete | 2026-05-01 |
| 48 | v1.7 | 3/3 | Complete | 2026-05-01 |
| 49 | v1.7 | 2/2 | Complete | 2026-05-02 |
| 50 | v1.7 | 2/2 | Complete | 2026-05-02 |
| 51 | v1.7 | 2/2 | Complete | 2026-05-02 |
| 52 | v1.8 | 4/4 | Complete | 2026-05-02 |
| 53 | v1.8 | 3/3 | Complete | 2026-05-02 |
| 54 | v1.8 | 3/3 | Complete | 2026-05-02 |
| 55 | v1.8 | 2/2 | Complete | 2026-05-03 |
| 56 | v1.9 | 2/2 | Complete | 2026-05-03 |
| 57 | v1.9 | 2/2 | Complete | 2026-05-03 |
| 58 | v1.9 | 4/4 | Complete | 2026-05-04 |
| 59 | v1.9 | 3/3 | Complete | 2026-05-04 |
| 60 | v1.9 | 2/2 | Complete | 2026-05-04 |
| 61 | v1.12 | 0/3 | Not started | - |
| 62 | v1.12 | 0/3 | Not started | - |
| 63 | v1.12 | 0 | Not started | - |
| 64 | v1.12 | 0 | Not started | - |
| 65 | v1.12 | 0/5 | Not started | - |
| 66 | v1.11 | 3/3 | Complete | 2026-05-05 |
| 67 | v1.11 | 3/3 | Complete | 2026-05-05 |
| 68 | v1.11 | 0 | Not started | - |
| 69 | v1.11 | 0 | Not started | - |
| 70 | v1.11 | 0 | Not started | - |
| 71 | v1.11 | 0 | Not started | - |
| 72 | v1.11 | 2/2 | Complete | 2026-05-05 |
| 73 | v1.11 | 3/3 | Complete | 2026-05-05 |
| 74 | v1.12 | 0 | Not started | - |
| 75 | v1.12 | 0 | Not started | - |
| 76 | v1.12 | 0 | Not started | - |
| 77 | v1.12 | 0 | Not started | - |
| 78 | v1.13 | 0 | Not started | - |
| 79 | v1.13 | 0 | Not started | - |
| 80 | v1.13 | 0 | Not started | - |
| 81 | v1.13 | 4/4 | Complete | 2026-05-08 |
| 82 | v1.14 | 3/3 | Complete | 2026-05-08 |
| 83 | v1.14 | 4/4 | Complete    | 2026-05-09 |
| 84 | v1.14 | 2/2 | Complete | 2026-05-09 |
| 85 | v1.14 | 2/2 | Complete    | 2026-05-09 |
| 86 | v1.15 | - | Merged into Phase 82 | 2026-05-08 |
| 87 | v1.15 | - | Merged into Phase 84 | 2026-05-09 |
| 88 | v1.16 | 2/2 | Complete    | 2026-05-10 |
| 89 | v1.16 | 2/2 | Complete    | 2026-05-10 |
| 90 | v1.16 | 0/3 | Not started | - |
| 91 | v1.16 | 4/4 | Complete    | 2026-05-10 |
| 92 | v1.16 | 0/2 | Not started | - |
| 93 | v1.16 | 0/4 | Not started | - |
| 94 | v1.16 | 3/3 | Complete    | 2026-05-11 |
| 95 | v1.16 | 2/2 | Complete    | 2026-05-11 |
| 96 | v1.16 | 4/4 | Complete    | 2026-05-11 |
| 97 | v1.17 | 2/2 | Complete    | 2026-05-12 |
| 98 | v1.17 | 3/3 | Complete    | 2026-05-12 |
| 99 | v1.17 | 2/2 | Complete    | 2026-05-12 |
| 100 | v1.17 | 4/4 | Complete    | 2026-05-12 |
| 101 | v1.17 | 3/3 | Complete    | 2026-05-12 |
| 102 | v1.18 | 3/3 | Complete    | 2026-05-13 |
| 103 | v1.18 | 2/2 | Complete    | 2026-05-13 |
| 104 | v1.18 | 1/1 | Complete    | 2026-05-13 |
| 105 | v1.18 | 3/3 | Complete    | 2026-05-13 |
| 106 | v1.19 | 4/4 | Complete    | 2026-05-14 |
| 107 | v1.19 | 1/1 | Complete    | 2026-05-14 |
| 108 | v1.19 | 3/3 | Complete    | 2026-05-14 |
| 109 | v1.19 | 2/2 | Complete    | 2026-05-14 |
| 110 | v1.20 | 4/4 | Complete    | 2026-05-14 |
| 111 | v1.20 | 4/4 | Complete    | 2026-05-15 |
| 112 | v1.20 | 3/3 | Complete    | 2026-05-15 |
| 113 | v1.20 | 4/4 | Complete    | 2026-05-16 |
| 114 | v1.21 | 0/0 | Not started | - |
| 115 | v1.21 | 0/0 | Not started | - |
| 116 | v1.21 | 4/4 | Complete    | 2026-05-17 |
| 117 | v1.22 | 2/2 | Complete    | 2026-05-17 |
| 118 | v1.22 | 3/3 | Complete    | 2026-05-17 |
| 119 | v1.22 | 3/3 | Complete | 2026-05-18 |
| 120 | v1.23 | 4/4 | Complete | 2026-05-18 |
| 121 | v1.23 | 3/3 | Complete | 2026-05-18 |


### Phase 122: Polish Carry-Forwards
**Goal**: All carry-forward UI items from v1.9 and v1.8 are resolved, giving the codebase a clean baseline before new infrastructure is introduced
**Depends on**: Phase 121 (v1.23 complete, test suite green)
**Requirements**: POL-01, POL-02, POL-03, POL-04, POL-05, POL-06
**Success Criteria** (what must be TRUE):
  1. User can select a chip mode (None / Bench Boost / Triple Captain) in RouteTreeTab, and the selected mode is reflected in the route output â€” chipMode is no longer hardcoded to null
  2. RouteTreeTab displays the correct "Transfer Hits" column heading (not a stale or incorrect label from Phase 60)
  3. MinsRiskBadge (Nailed / Likely start / Rotation risk / Cameo) is visible on each player row in SquadView (Transfers tab)
  4. MinsRiskBadge is visible in the buy-player badge cluster of OpportunityCostTable (after StatusLabelBadge, before NewsBanner), and appears as an inline column cell in GemTable alongside existing signal columns
  5. MinsRiskBadge is visible for both players in PlayerComparisonModal
**Plans**: 2 plans
  - [x] 122-01-PLAN.md - RouteTreeTab ChipToggle wiring and column label fix (POL-01, POL-02)
  - [x] 122-02-PLAN.md - OpportunityCostTable MinsRiskBadge insertion plus POL-03/05/06 verification record (POL-03, POL-04, POL-05, POL-06)
**UI hint**: yes

### Phase 123: SCRAPER-02 Pipeline
**Goal**: The pipeline ingests summer transfer news from Sky Sports and BBC Sport RSS feeds, matches articles to FPL player IDs, and exposes the feed to the UI via a Route Handler and TanStack hook; the IS_OFF_SEASON gate prevents null-crashes when no current GW exists
**Depends on**: Phase 122
**Requirements**: SCR-01, SCR-02, SCR-03, SCR-04, SCR-05, WIN-03
**Success Criteria** (what must be TRUE):
  1. pipeline/transfer_news.json is written to Vercel Blob on each pipeline run containing articles from Sky Sports RSS and BBC Sport RSS, each with a classification field (confirmed_signing / rumour / injury_return / rotation_signal / general) and a matched FPL element ID where the player name is resolved
  2. The TRANSFER_NEWS_ENABLED env var gates the scraper; a scraper failure logs an error and continues the rest of the pipeline without writing an empty or corrupt artifact
  3. /api/transfer-news Route Handler serves transfer_news.json and useTransferNews() TanStack Query hook fetches from it, following the established artifact pattern
  4. pipeline/run.py detects IS_OFF_SEASON (no event with is_current=True) and all GW-dependent pipeline steps skip gracefully rather than crashing with a null/KeyError
  5. player_matching.py shared utility is used by both transfer_news.py and the existing lineup_news.py (no duplication of name-matching logic)
**Plans**: 3 plans
  - [x] 123-01-PLAN.md â€” Python pipeline foundation: rapidfuzz dependency, player_matching.py, transfer_news.py with classifier + env gate + non-fatal isolation + pytest coverage (SCR-01, SCR-02, SCR-03, SCR-05)
  - [x] 123-02-PLAN.md â€” TypeScript layer: TransferNewsArticle/Feed types, /api/transfer-news Route Handler, useTransferNews() hook with 6h staleTime + Vitest spec (SCR-04)
  - [x] 123-03-PLAN.md â€” IS_OFF_SEASON gate in run.py wrapping GW-dependent steps + year-round transfer_news.scrape() call + contract tests (WIN-03, SCR-01 wiring, SCR-05 outer wrap)
**UI hint**: no

### Phase 124: Season Review
**Goal**: The user can view a full-season performance summary with a decision quality process grade, a GW-by-GW rank chart with xPts overlay, all surfaced in a dedicated Season sub-tab in the Analyse section
**Depends on**: Phase 122
**Requirements**: REV-01, REV-02, REV-03, REV-04
**Success Criteria** (what must be TRUE):
  1. Season summary card displays total rank, total points, captain hit rate %, transfer net gain/loss, best GW score, and worst GW score aggregated across all available GWs; GWs before app deployment are shown as N/A rather than zero
  2. A decision quality A-D grade is computed from captain EV rate (40%) + hit break-even rate (35%) + chip ROI positive rate (25%); the card shows the composite score, the three component scores, a methodology note, and chip GWs scored separately from normal GWs
  3. A season variance chart shows GW-by-GW rank trajectory with an xPts expectation overlay; chip GWs are highlighted with a distinct marker
  4. The Season Review is accessible as a "Season" sub-tab in the Analyse section on both desktop and MobileNav
**Plans**: 3 plans
Plans:
**Wave 1**
- [x] 124-01-PLAN.md â€” Types (SeasonReview/SeasonGwEntry) + computeDecisionGrade pure function (REV-02 D-05/D-06) + /api/season-review Route Handler (REV-01)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 124-02-PLAN.md â€” useSeasonReview TanStack Query v5 hook with 6h staleTime + numeric teamId guard + Vitest contract spec (REV-03 wiring)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 124-03-PLAN.md â€” SeasonReviewTab component (REV-01 summary card + REV-02 grade card + REV-03 ComposedChart with avg manager overlay & chip markers) + page.tsx 'season' SubTab wiring (REV-04)
**UI hint**: yes

### Phase 125: Summer Window Tracker
**Goal**: The user can browse confirmed PL signings and transfer rumours from the scraped feed, filtered by classification, and see confirmed signing badges on relevant player rows across GemTable and TransferPanel
**Depends on**: Phase 123 (useTransferNews() hook and transfer_news.json artifact must exist)
**Requirements**: WIN-01, WIN-02
**Success Criteria** (what must be TRUE):
  1. Summer Window tab in the Analyse section shows articles from the transfer news feed sorted by date, with filter pills for confirmed / rumour / injury / rotation â€” an empty state is shown when no articles match the selected filter
  2. A confirmed signing badge appears on the relevant player row in GemTable and TransferPanel when a confirmed_signing article is matched to that player's FPL element ID; the badge is absent for unmatched players and players with no confirmed_signing articles
**Plans**: 3 plans
Plans:
**Wave 1**
- [x] 125-01-PLAN.md â€” ConfirmedSigningBadge shared component + Vitest contract test (WIN-02 primitive)
- [x] 125-02-PLAN.md â€” SummerWindowTab feed component with filter pills, stale banner, article cards, empty/loading/error states + Vitest tests (WIN-01)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 125-03-PLAN.md â€” page.tsx Summer Window sub-tab registration + GemTable expanded-row badge injection (mobile + desktop) + OpportunityCostTable PlayerMoveCell buy-cluster badge injection (WIN-01 routing + WIN-02 wiring)
**UI hint**: yes

### Phase 126: Next Season Planner
**Goal**: The user can build an optimal 15-player squad from all 700+ FPL players at a 100m budget for next season, see a GW1-8 fixture difficulty heatmap when fixture data is available, and the pipeline archives per-player element-summary history before the GW38 rollover
**Depends on**: Phase 123 (for confirmed signing badges on squad builder rows; core builder is independent)
**Requirements**: NSP-01, NSP-02, NSP-03, NSP-04
**Success Criteria** (what must be TRUE):
  1. pipeline/archive_season.py writes season_archive_gw38.json to Vercel Blob before GW38 closes, capturing per-player element-summary history that would otherwise be lost after the season rollover
  2. buildPreSeasonSquad() returns a valid 15-player squad from the full player pool at a 100m budget; if the greedy heuristic returns null, a pipeline/suggest_squad.py ILP fallback (PuLP) serves a pre-computed optimal squad from Blob
  3. The Next Season Planner tab in the Plan section shows a squad builder UI with a "Prices pending" graceful state when off-season FPL price data is unavailable
  4. A GW1-8 fixture difficulty heatmap reuses the existing HeatMapRow component; a "Fixtures not yet published" empty state is shown until FPL releases next-season fixture data
**Plans**: TBD
**UI hint**: yes


<details>
<summary>âœ… v1.25 Pre-Season Intelligence (Phases 127-129) â€” SHIPPED 2026-05-20</summary>

See `.planning/milestones/v1.25-ROADMAP.md` for full phase details.

- [x] **Phase 127: Squad Health Diagnostics & Transfer Watchlist** â€” GREEDY-NULL pipeline sweep + diagnoseBuildPreSeasonSquad() + health API field; useWatchlist() hook + pin toggle in GemTable + dedicated Watchlist sub-tab. *(Complete 2026-05-19)*
- [x] **Phase 128: Pre-Season Auto-Activation** â€” Tri-state PRE_SEASON_ACTIVE gate + pre_season_active.json artifact + suggest_squad.py force=True; usePreSeasonActive() hook + NextSeasonPlannerTab status pill + first-activation banner. *(Complete 2026-05-20)*
- [x] **Phase 129: Squad Cost Simulator** â€” Budget slider in NextSeasonPlannerTab via useDeferredValue + commit-on-release; /api/pre-season-squad?include=inputs API refactor; infeasibility messaging using health.min_feasible_budget_greedy. *(Complete 2026-05-20)*

</details>

<details>
<summary>v1.26 Off-Season Intelligence (Phases 130-135) - IN PROGRESS</summary>

- [x] **Phase 130: Auth Fix** - return ENDPOINT_GONE from fpl-login route; preserve token-paste flow (AUTH-05, AUTH-06) ✓ 2026-05-21
- [x] **Phase 131: Transfer Speculation Scoring** - source tier badge + confidence decay on Summer Window articles (SPEC-01, SPEC-02, SPEC-03) ✓ 2026-05-22
- [x] **Phase 132: Deadline Day Banner** - countdown to next GW deadline, 3-state urgency, per-GW dismiss (DL-01, DL-02, DL-03) (completed 2026-05-22)
- [ ] **Phase 133: Price Reset Analysis** - price_baseline.json pipeline + PriceResetTab with delta pills and Value Targets (PRST-01, PRST-02, PRST-03, PRST-04)
- [ ] **Phase 134: Push Notifications** - VAPID service worker, subscribe/unsubscribe, price/injury/deadline/captain push triggers (PUSH-01, PUSH-02, PUSH-03, PUSH-04, PUSH-05)
- [ ] **Phase 135: Pre-Deadline Pipeline & Notify** - fast-mode pre-deadline run + standalone notify.py dispatch step (PIPE-01, PIPE-02, PIPE-03)

</details>

### Phase 127: Squad Health Diagnostics & Transfer Watchlist
**Goal**: User can see how often the greedy squad builder fails (and at which budget it becomes feasible), and can pin players to a persistent watchlist from any GemTable row and view those picks together on a dedicated Plan sub-tab
**Depends on**: Phase 126 (v1.24 complete; relies on existing buildPreSeasonSquad(), /api/pre-season-squad, /api/players, GemTable expand-row pattern, lineup_news.json)
**Requirements**: GREEDY-01, GREEDY-02, GREEDY-03, WATCH-01, WATCH-02, WATCH-03, WATCH-04
**Success Criteria** (what must be TRUE):
  1. User can read a health indicator below the cost slider area in NextSeasonPlannerTab showing the greedy null rate and minimum feasible budget computed by pipeline/squad_health.py, and can see a "Greedy" vs "ILP fallback" badge on the squad formation grid identifying which solver produced the displayed squad
  2. /api/pre-season-squad responds with a health field (greedy_null_rate, min_feasible_budget_greedy, min_feasible_budget_ilp, greedy_optimality_gap_avg) sourced from pre_season_squad_health.json on Vercel Blob; the response shape is stable enough for Phase 128 and Phase 129 to consume without further refactor
  3. User can tap a star icon in any GemTable row's expand-action cluster (mobile and desktop) to pin or unpin that player, and the pin state persists across page reloads via localStorage['fplx_watchlist']
  4. User can open a "Watchlist" sub-tab in the Plan section (positioned after "Next Season") and see all pinned players as cards in a 2-column mobile / 3-column desktop grid, each card showing current price + trend arrow, ownership %, news badge (amber border if news within 48h), squad-overlap dot when the player is in the current pre-season squad, and a "Departed" pill when an ID no longer exists in /api/players
  5. Watchlist tab shows graceful empty-state, loading skeleton, and error state when /api/players is unavailable; no entries are silently dropped when player IDs persist across season boundaries
**Plans**: 4 plans
  - [x] 127-01-PLAN.md â€” Backend foundation: SquadHealth/PreSeasonSquadResponse types, diagnoseBuildPreSeasonSquad, pipeline/squad_health.py + run.py wiring, /api/pre-season-squad envelope refactor
  - [x] 127-02-PLAN.md â€” useWatchlist hook (localStorage-backed) + GemTable star button action row in both expand rows
  - [x] 127-03-PLAN.md â€” WatchlistPlayerCard + WatchlistTab components (loading/error/empty/grid states)
  - [x] 127-04-PLAN.md â€” Integration: usePreSeasonSquad envelope migration, NextSeasonPlannerTab health indicator + solver badge, page.tsx sub-tab + useWatchlist wiring
**UI hint**: yes

### Phase 128: Pre-Season Auto-Activation
**Goal**: When FPL publishes next-season bootstrap data the pipeline detects it automatically, re-runs the ILP squad builder against fresh prices, and the UI flips a status pill from "Awaiting" to "Live" with a one-time activation banner
**Depends on**: Phase 127 (Phase 127 stabilises the suggest_squad.py idempotency pattern that AUTO-02's force=True parameter refactors, and the /api/pre-season-squad response shape that AUTO-03 consumes)
**Requirements**: AUTO-01, AUTO-02, AUTO-03
**Success Criteria** (what must be TRUE):
  1. The daily (4x-daily) pipeline writes pre_season_active.json to Vercel Blob exactly once â€” on the first run where the tri-state predicate (IS_OFF_SEASON AND len(events)>=38 AND no event finished AND events[0].deadline_time is present) flips from false to true â€” and the artifact is idempotent on subsequent runs
  2. On first activation, pipeline/suggest_squad.py is invoked with force=True and produces a fresh ILP-optimal squad against the newly published bootstrap prices, overriding the previous-season cached squad
  3. User can open NextSeasonPlannerTab and see a zinc "Awaiting" status pill when pre-season is not yet active, and a green "Live" status pill once pre_season_active.json exists; the visual transition happens within one TanStack Query refetch cycle of the artifact being written
  4. User sees a dismissible first-activation banner on NextSeasonPlannerTab when pre-season first becomes Live, and never sees it again after dismissal (suppressed via localStorage key nsp_activation_seen_{seasonId})
  5. /api/pre-season-active responds with the activation timestamp and seasonId so usePreSeasonActive() can drive both pill state and banner suppression deterministically
**Plans**: 4 plans
  - [x] 128-01-PLAN.md â€” pipeline/suggest_squad.py force-parameter refactor + Phase 128 activation-predicate regression tests
  - [x] 128-02-PLAN.md â€” pipeline/run.py activation block (predicate + idempotent artifact write + suggest_squad force-recompute)
  - [x] 128-03-PLAN.md â€” PreSeasonActiveResponse type + /api/pre-season-active route handler
  - [x] 128-04-PLAN.md â€” usePreSeasonActive hook + tests + NextSeasonPlannerTab status pill + first-activation banner
**UI hint**: yes

### Phase 129: Squad Cost Simulator
**Goal**: User can drag a budget slider in NextSeasonPlannerTab and see the 15-player squad and GW1-8 fixture heatmap re-render to reflect the squad that the greedy builder produces at the chosen budget, with clear infeasibility messaging when no squad is possible
**Depends on**: Phase 127 (consumes /api/pre-season-squad?include=inputs and health.min_feasible_budget_greedy) and Phase 128 (committed budget recompute path expects suggest_squad.py force=True idempotency from AUTO-02)
**Requirements**: COST-01, COST-02, COST-03
**Success Criteria** (what must be TRUE):
  1. User can drag a budget slider in NextSeasonPlannerTab between Â£80m and Â£120m in Â£0.5m steps (default Â£100m), and the squad formation grid + GW1-8 FDR heatmap update to reflect the new greedy squad without a server round-trip per slider tick
  2. The recompute commits on pointer release (or 300ms after keyboard navigation) using useDeferredValue, so the slider stays responsive at every tick while expensive greedy work runs only on commit
  3. /api/pre-season-squad?include=inputs response now includes inputs (players, scoreMap, budget_default) and health alongside squad, and the client uses cached inputs to drive the recompute in-browser (no Python subprocess from a route handler)
  4. When greedy returns null at the chosen budget, user sees inline message "No squad possible at Â£X.Xm â€” try Â£Y.Ym+" where Y is health.min_feasible_budget_greedy from Phase 127, and the slider track renders amber below the minimum feasible budget threshold
  5. Slider state is scoped to NextSeasonPlannerTab via local context (not lifted to page.tsx), so GemTable and other Plan sub-tabs do not re-render on slider drag
**Plans**: 4 plans
  - [x] 129-01-PLAN.md â€” Wave 0: RED test scaffolding (route.test.ts + extended NextSeasonPlannerTab.test.tsx with makeInputs helper, 15 new component tests, 6 new route tests)
  - [x] 129-02-PLAN.md â€” Wave 1: types extension (PreSeasonSquadInputs + optional inputs? on PreSeasonSquadResponse) + route refactor (GET(request: NextRequest), shared loadSquadInputs helper, Object.fromEntries serialisation, graceful degradation on Resolution 1)
  - [x] 129-03-PLAN.md â€” Wave 2: hook parameterisation (queryKey discriminator) + component slider, useDeferredValue commit pipeline, scoreMapHydrated/clientSquad memos, lastValidSquad/hasCommitted state, API-squad-before-commit render (D-06)
  - [x] 129-04-PLAN.md â€” Wave 3: infeasibility paragraph (D-08/D-09 variants A+B), dynamic amber slider gradient (D-10) with zinc fallback (D-11), inputs-refetch reset effect for lastValidSquad/hasCommitted
**UI hint**: yes

### Phase 130: Auth Fix
**Goal**: The FPL login route handler returns a clean ENDPOINT_GONE error immediately rather than proxying a dead credential endpoint, so users always reach the working token-paste flow without 502 errors
**Depends on**: Phase 129 (v1.25 complete)
**Requirements**: AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):
  1. POST /api/auth/fpl-login returns a JSON body with { ok: false, code: "ENDPOINT_GONE" } and a 200 status (not a 502) when the FPL credential endpoint is unavailable
  2. The login UI, on receiving ENDPOINT_GONE, immediately falls back to the token-paste flow with a clear message that the direct login path is no longer available
  3. All existing token-paste and team-ID-only flows continue to work exactly as before - no regression to authenticated squad loading
**Plans**: 2 plans
  - [x] 130-01-PLAN.md - Backend: replace fpl-login route body with ENDPOINT_GONE stub + contract test (AUTH-05)
  - [x] 130-02-PLAN.md - Frontend: remove credentials form, mode tabs, and credential state from AuthModal (AUTH-06)

### Phase 131: Transfer Speculation Scoring
**Goal**: Summer Window articles carry a visible source reliability tier so users can instantly judge how much weight to give each transfer rumour, and stale articles visually signal their age via confidence decay
**Depends on**: Phase 130 (auth fix complete; speculation scoring is independent but sequenced after P0 auth fix)
**Requirements**: SPEC-01, SPEC-02, SPEC-03
**Success Criteria** (what must be TRUE):
  1. Every article card in the Summer Window tab displays a tier badge (Official / Reliable / Speculative) sourced from the article's source_tier field
  2. Articles older than 21 days show a visible decay indicator (reduced opacity or age label) so users can distinguish fresh rumours from stale ones without reading the timestamp
  3. The 5-pill classification filter row gains a tier pill filter (Official / Reliable / Speculative) and filtering by tier shows only matching articles, consistent with the existing All/Confirmed/Rumour/Injury/Rotation behaviour
  4. Existing Summer Window article consumers (ConfirmedSigningBadge, GemTable injections) are unaffected - source_tier and confidence_score are optional additive fields
**Plans:** 2 plans
- [x] 131-01-PLAN.md — Pipeline source_tier field (SPEC-01 backend: SOURCE_TIER dict, _get_source_tier helper, field injection, pytest)
- [x] 131-02-PLAN.md — Frontend tier badge + 21d decay + tier filter pills (SPEC-01/02/03: SourceTier type, TIER_PILLS, isArticleStale, AND-logic filter chain, Tests 11-18)
**UI hint**: yes

### Phase 132: Deadline Day Banner
**Goal**: Users always know how much time remains before the next FPL gameweek deadline, with urgency escalating as the deadline approaches, and the ability to dismiss the banner once noted
**Depends on**: Phase 130 (auth fix; banner is independent of all other v1.26 features)
**Requirements**: DL-01, DL-02, DL-03
**Success Criteria** (what must be TRUE):
  1. A countdown banner is visible above the section nav showing time remaining to the next FPL gameweek deadline in the user's local timezone (e.g. "GW32 deadline in 14h 22m")
  2. The banner's visual appearance shifts through three urgency states: zinc neutral (>24h), amber (2-24h), red sticky (< 2h) - transitions happen automatically as time passes without page reload
  3. User can click a dismiss button on the banner and it disappears for the current gameweek, reappearing automatically when the next gameweek's deadline window opens (state stored per-GW in localStorage)
**Plans**: 2 plans
  - [x] 132-01-PLAN.md — useNextDeadline hook (TanStack Query) returning next bootstrap is_next event
  - [x] 132-02-PLAN.md — DeadlineBanner component (3-state urgency + per-GW dismiss) wired into page.tsx
**UI hint**: yes

### Phase 133: Price Reset Analysis
**Goal**: When FPL publishes next-season prices, users can immediately see which players rose or fell vs the season-end baseline, with a Value Targets section highlighting fallen-price players who still rate well by xPts
**Depends on**: Phase 132 (DL banner ships first; price reset needs PRST-01 baseline captured before FPL overwrites costs)
**Requirements**: PRST-01, PRST-02, PRST-03, PRST-04
**Success Criteria** (what must be TRUE):
  1. pipeline/price_baseline.py writes price_baseline.json (now_cost per player, all 700+ elements) to Vercel Blob idempotently - once written it is never overwritten by subsequent pipeline runs
  2. User can open a "Price Reset" tab in the Analyse section and see a table of players with their season-end price, new price, and coloured delta pills (+X.Xm green / -X.Xm red) once FPL publishes next-season prices
  3. A "Value Targets" section within PriceResetTab lists players whose price fell but whose xPts still rates above their position median - each row shows the price drop pill and the xPts rank
  4. Before next-season prices are published, the Price Reset tab shows a clear empty state with an estimated availability note ("FPL typically publishes new prices in mid-to-late July")
**Plans**: 3 plans in 2 waves

**Wave 1** *(parallel)*
- [ ] 133-01-PLAN.md — pipeline/price_baseline.py + run.py integration (PRST-01)
- [ ] 133-02-PLAN.md — types + /api/price-reset route + usePriceReset hook (PRST-02, PRST-03, PRST-04)

**Wave 2** *(blocked on Wave 1 — Plan 02 types + hook)*
- [ ] 133-03-PLAN.md — PriceResetTab component + page.tsx sub-tab registration (PRST-02, PRST-03, PRST-04)
**UI hint**: yes

### Phase 134: Push Notifications
**Goal**: Users can opt in to browser push notifications and receive timely alerts for price projection changes, injury status changes, deadline reminders, and captain recommendation changes
**Depends on**: Phase 133 (price reset infra ready; push notifications are the highest-complexity phase and ship last among UI features)
**Requirements**: PUSH-01, PUSH-02, PUSH-03, PUSH-04, PUSH-05
**Success Criteria** (what must be TRUE):
  1. User can enable or disable push notifications via a single toggle in settings - the browser permission prompt appears only after the user explicitly clicks Enable, never on page load
  2. User receives a push notification when a watched or owned player's price projection changes by 0.2m or more - with a 24h per-player cooldown and a cap of 3 notifications per pipeline run
  3. User receives a push notification when an owned player's injury or doubt status changes (new flag or change to existing flag) - notification identifies the player and the new status
  4. User receives deadline reminder push notifications at 24h and 2h before each FPL gameweek deadline - deduplication ensures the 24h reminder fires at most once per gameweek
  5. User receives a push notification when the top captain recommendation changes for the upcoming gameweek - notification shows who is now recommended
**Plans**: TBD
**UI hint**: yes

### Phase 135: Pre-Deadline Pipeline & Notify
**Goal**: Pipeline runs in a fast lightweight mode within 6 hours of each GW deadline, and a standalone notify.py step dispatches push notifications by comparing current output to the previous Blob state
**Depends on**: Phase 134 (push subscription infrastructure must exist before notify.py can dispatch)
**Requirements**: PIPE-01, PIPE-02, PIPE-03
**Success Criteria** (what must be TRUE):
  1. When PIPELINE_DEADLINE_WINDOW_MINUTES is set to 360 and the pipeline runs within 360 minutes of a GW deadline, it skips Understat scraping, Monte Carlo simulation, and batch AI insight generation - completing in under 5 minutes instead of 15+
  2. notify.py is a standalone Python script that never imports from run.py; it reads current Blob state, compares to previous state, and POSTs change events to /api/push/send following the refresh_gate.py isolation pattern
  3. notify.py correctly detects price projection changes and injury flag changes between pipeline runs and dispatches the appropriate push notification payloads to /api/push/send
**Plans**: TBD
| 122 | v1.24 | 2/2 | Complete    | 2026-05-18 |
| 123 | v1.24 | 3/3 | Complete    | 2026-05-18 |
| 124 | v1.24 | 3/3 | Complete    | 2026-05-19 |
| 125 | v1.24 | 3/3 | Complete    | 2026-05-19 |
| 126 | v1.24 | 4/4 | Complete    | 2026-05-19 |
| 127 | v1.25 | 4/4 | Complete    | 2026-05-19 |
| 128 | v1.25 | 4/4 | Complete    | 2026-05-20 |
| 129 | v1.25 | 4/4 | Complete   | 2026-05-20 |
| 130 | v1.26 | 0/0 | Not started | - |
| 131 | v1.26 | 0/0 | Not started | - |
| 132 | v1.26 | 2/2 | Complete    | 2026-05-22 |
| 133 | v1.26 | 0/3 | Planned     | -          |
| 134 | v1.26 | 0/0 | Not started | - |
| 135 | v1.26 | 0/0 | Not started | - |
