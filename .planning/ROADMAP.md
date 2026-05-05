# Roadmap: FPL Analyst

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-29)
- ✅ **v1.1 Decision Engine** — Phases 7-12 (shipped 2026-03-31)
- ✅ **v1.2 Mobile** — Phases 13-18 (shipped 2026-04-01)
- ✅ **v1.3 Gameweek Planner** — Phases 19-25 (shipped 2026-04-03)
- ✅ **v1.4 Analytics Engine** — Phases 26-35 (shipped 2026-04-29)
- ✅ **v1.5 UX & Polish** — Phases 36-41 (shipped 2026-04-30)
- ✅ **v1.6 Squad Optimiser** — Phases 42-46 (shipped 2026-05-01)
- ✅ **v1.7 Decision Assistant** — Phases 47-51 (shipped 2026-05-02)
- ✅ **v1.8 Predictive Intelligence** — Phases 52-55 (shipped 2026-05-03)
- ✅ **v1.9 Competitive Intelligence** — Phases 56-60 (shipped 2026-05-04)
- **v1.11 Insights & Infrastructure** — Phases 66-73 (Phases 66-71 planned; 72-73 complete 2026-05-05)
- **v1.12 Modelling & Refinement** — Phases 61-65 (carry-forward) + 74-77 (in progress)

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

- [x] Phase 42: xPts Accuracy Improvements — form signal (BLEND_ALPHA=0.4), accuracy gate
- [x] Phase 43: Lineup Engine & Navigator — `optimiseLineup()`, pitch UI, Squad sub-tabs
- [x] Phase 44: Comparison Output — ComparisonTable, HeadlineRow, Promoted/Dropped badges
- [x] Phase 45: Transfer-Aware Mode — `suggestTransfers()`, FtToggle, break-even indicator
- [x] Phase 46: Chip Modes — Wildcard/Free Hit/Bench Boost, ChipModeToggle, ChipSquadView

</details>

<details>
<summary>✅ v1.7 Decision Assistant (Phases 47-51) — SHIPPED 2026-05-02</summary>

See `.planning/milestones/v1.7-ROADMAP.md` for full phase details.

- [x] Phase 47: Fixture Swing Detector & Clean Sheet Probability — swing signals, cs_prob_1gw, FixtureSwingDetector panel
- [x] Phase 48: Explainable xPts Breakdown — appearance_pts component, CSS-only hover card on XPtsCell
- [x] Phase 49: Player Lifecycle Labels — 7-label taxonomy, priority cascade, LifecycleLabelBadge
- [x] Phase 50: Transfer Opportunity Cost Simulator — Roll/1-FT/2-FT/Hit table, break-even weeks, derivedFtCount
- [x] Phase 51: Weekly Decision Summary — 4-card Decision tab (default Squad landing), computeDecisionSeverity

</details>

<details>
<summary>✅ v1.8 Predictive Intelligence (Phases 52-55) — SHIPPED 2026-05-03</summary>

See `.planning/milestones/v1.8-ROADMAP.md` for full phase details.

- [x] Phase 52: xMins Confidence Engine — calibrated start_prob, mins_60_prob, sub_risk_label
- [x] Phase 53: Bonus Point Predictor — per-player bonus_ev shrinkage estimator
- [x] Phase 54: Price Change Predictor — daily rise/fall predictions with confidence tiers
- [x] Phase 55: Bench Order Optimiser — benchOrder() EV-ranked autosub-optimal bench

</details>

<details>
<summary>✅ v1.9 Competitive Intelligence (Phases 56-60) — SHIPPED 2026-05-04</summary>

See `.planning/milestones/v1.9-ROADMAP.md` for full phase details.

- [x] Phase 56: FT Engine Fix — Wildcard bank preservation, initialFTState useMemo
- [x] Phase 57: Effective Ownership Mode — top-5 EO%, 4-mode toggle, Dangerous-to-fade badge
- [x] Phase 58: Mini-League Rival Tracker — useRivals p-limit(3), RivalsTab
- [x] Phase 59: Manual Transfer Planner — GW-by-GW plan, bank/FT simulation, localStorage
- [x] Phase 60: Transfer Route Tree — buildTransferRouteTree, RouteTreeTab, Manual Planner bridge

</details>

### v1.12 Modelling & Refinement — Carry-forward (Phases 61-65)

- [ ] **Phase 61: MC Simulation Core** — 10k sim engine in pipeline, blank%/haul%/floor/ceiling per player per GW
- [ ] **Phase 62: MC Rank Simulator & Captain Integration** — 5-GW rank trajectory UI, captain picker MC augmentation
- [ ] **Phase 63: Model Versioning & Calibration Charts** — version tags in pipeline, multi-version comparison, calibration reliability diagrams in AccuracyTab
- [ ] **Phase 64: Sensitivity Analysis** — fragility engine over transfer candidates + captain picks, amber indicators
- [ ] **Phase 65: Rejection Explainer** — "why not?" natural-language engine across GemTable, TransferPanel, SquadView

### v1.11 Insights & Infrastructure (Phases 66-71)

- [ ] **Phase 66: Fixture Heat Map** — 20 teams × 8 GWs colour-coded grid, DGW highlighted, BGW blank
- [ ] **Phase 67: LLM Prose Summaries** — Claude API weekly prose summary grounded in structured model output, manual refresh button
- [ ] **Phase 68: In-App Alert System** — price/injury/set-piece change banners, deadline countdown, dismissible with localStorage persistence
- [ ] **Phase 69: Event-Based Pipeline Refresh** — GitHub Actions deadline-aware triggers (6h/2h/30min/post), stale-data warning UX
- [ ] **Phase 70: Post-GW Review** — auto-generated GW review (bench pts, captain delta, vs top-10k), Vercel Blob + `/api/gw-review`
- [ ] **Phase 71: Decision History & Regret Backtester** — decision logging per team ID, cumulative ROI dashboard, 2×2 process×outcome matrix
- [x] **Phase 72: Lineup Optimiser** — recommend optimal starting XI + bench order from squad using xPts×start_prob, formation-constraint solver, overridable team sheet UI (LINEUP-01) ✓ 2026-05-05
- [x] **Phase 73: Post-GW Review** — 5th Squad sub-tab showing last 3 settled GWs: bench pts left, captain delta vs optimal, top scorer, FPL average score; pipeline writes `gw_review_gw{N}.json` to Vercel Blob (PGW-01, PGW-02) ✓ 2026-05-05

### v1.12 Modelling & Refinement — New Phases (74-77)

- [ ] **Phase 74: Transfer Engine Overhaul** — 3-per-team cap enforcement, duplicate transfer bug fix, multi-hit view (1FT/2FT/−4/−8), bank balance auto-pull and feasibility checks
- [ ] **Phase 75: Fixture Heat Map v2** — opponent labels per cell, owned-team filtering and row highlighting, user-selectable horizon (8/12/16 GWs), ATT/DEF difficulty toggle
- [ ] **Phase 76: Analytics Enhancements** — routes_to_points pipeline score + GemTable column, Accuracy GW row drill-down, LineupTab manual captain/VC override
- [ ] **Phase 77: Pitch Visuals & Mobile Polish** — LineupTab kit art with placeholder fallback, Decision tab captain card overflow fix, full mobile layout audit on 390–430px viewport

## Phase Details

_All milestone phase details archived to `.planning/milestones/`. See the relevant `v{version}-ROADMAP.md` file for each milestone's full phase specifications._

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
  **Wave 1**
  - [x] 47-01-PLAN.md — extend ClubForm + MergedPlayer types (past_ease_3gw, swing_*gw, cs_prob_1gw)
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 47-02-PLAN.md — TDD: implement past_ease_3gw and swing deltas in computeClubForm
  - [x] 47-03-PLAN.md — TDD: add cs_prob_1gw aggregation (single/DGW/BGW) to pipeline/merge.py
  - [x] 47-04-PLAN.md — add CS% column to GemTable (Analysis preset only, mobile hidden)
  **Wave 3** *(blocked on Wave 2 completion)*
  - [x] 47-05-PLAN.md — build FixtureSwingDetector panel + mount + human-verify checkpoint
  **Cross-cutting constraints:**
  - `cs_prob_1gw?: number` must be written to every player in pipeline before GemTable column can render (Plans 01→03→04)
  - `ClubForm.swing_*gw` fields must be typed (Plan 01) and computed (Plan 02) before FixtureSwingDetector can consume them (Plan 05)
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
**Plans**: 3 plans (2 waves)
  **Wave 1** *(parallel)*
  - [x] 48-01-PLAN.md — TDD: extend pipeline _compute_xpts_fixture + _xpts_ngw with appearance_pts; test_merge_xpts_components.py
  - [x] 48-02-PLAN.md — extend xPts_components_1gw type in types.ts; update PlayerComparisonModal.test.tsx mocks
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 48-03-PLAN.md — refactor XPtsCell with CSS-only hover card, useState mobile toggle, minsRisk prop; extend columns.test.tsx
  **Cross-cutting constraints:**
  - `appearance_pts: number` must be in types.ts (Plan 02) before XPtsCell can render it (Plan 03)
  - Pipeline must produce `appearance_pts` in xPts_components_1gw (Plan 01) before full integration is possible
**Phase notes**: appearance_pts resolved as explicit component (D-01). DGW: summed breakdown (D-05). BGW: no hover card (D-06). Native title tooltip removed and replaced with hover card (D-03). MinsRiskBadge shown below Total row to satisfy XPT-01 minutes risk requirement (D-02).
**UI hint**: yes

### Phase 49: Player Lifecycle Labels
**Goal**: Squad players display granular timing labels that extend beyond Buy/Hold/Sell — giving managers specific action timing (Buy Next Week, Hold One More, Sell Soon, Minutes Trap, Fixture Trap) with a consistent priority hierarchy preventing contradictory signals
**Depends on**: Phase 47 (fixture swing context required for Buy Next Week and Hold One More labels)
**Requirements**: LCL-01, LCL-02, LCL-03
**Success Criteria** (what must be TRUE):
  1. Each squad player in the Transfers view displays exactly one lifecycle label from the set: Buy Next Week, Hold One More, Sell Soon, Minutes Trap, Fixture Trap, Hold, Sell — never two simultaneously
  2. When multiple label conditions apply to the same player, the priority hierarchy resolves to the single highest-priority label (priority order defined in plan spec)
  3. Labels are computed in pure TypeScript over existing `MergedPlayer` fields — loading a squad triggers label computation with no additional API call
**Plans**: 2 plans (2 waves)
  **Wave 1**
  - [x] 049-01-PLAN.md — TDD: src/lib/lifecycle-label.ts + lifecycle-label.test.ts (7-label engine, threshold constants, computeLifecycleLabel + computeLifecycleLabels with priority cascade)
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 049-02-PLAN.md — LifecycleLabelBadge component + TransferPanel useClubForm wiring + SquadView labels prop swap + sell|sell_soon shortlist trigger + human-verify checkpoint
  **Cross-cutting constraints:**
  - `LifecycleLabel` type and `computeLifecycleLabels` function must exist (Plan 01) before LifecycleLabelBadge can import the union and TransferPanel can call the engine (Plan 02)
  - Plan 02 retains `computeVerdicts` and `Verdict` exports in `src/lib/recommend.ts` so Phase 51 (Decision Summary) can reuse them
**Phase notes**: Label taxonomy locked in 049-RESEARCH.md §"Label Taxonomy". Hysteresis: SELL_THRESHOLD = 0.85 (replaces recommend.ts 0.90 for this engine), SELL_SOON_THRESHOLD = 0.90, SWING_THRESHOLD = 0.20 (Phase 47 D-01), MINUTES_TRAP_MIN_COST = 70 (£7.0m gate), MINUTES_TRAP_START_PROB = 0.65. Priority cascade: Minutes Trap > Fixture Trap > Buy Next Week > Hold One More > Sell Soon > Sell > Hold. Bench excluded (pick.position >= 12). Null clubForm degrades gracefully (gem-only labels, no crash).
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
**Plans**: 2 plans (2 waves)
  **Wave 1**
  - [x] 050-01-PLAN.md — TDD: src/lib/opportunity-cost.ts + opportunity-cost.test.ts (computeOpportunityCostRows pure mapper, OCSRowKind/OCSRow/MARGINAL_THRESHOLD exports, 16 test cases for OCS-01/02/04/05)
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 050-02-PLAN.md — OpportunityCostTable component + TransferPanel wiring (ocsHorizon/ocsFtCount state, derivedFtCount from event_transfers + active_chip, suggestTransfers call, FtToggle + GwToggle in section header) + human-verify checkpoint
  **Cross-cutting constraints:**
  - `computeOpportunityCostRows`, `OCSRow`, `OCSRowKind`, `MARGINAL_THRESHOLD` must exist (Plan 01) before OpportunityCostTable can render and TransferPanel can compose (Plan 02)
  - Existing `computeTransferSuggestions()` "Suggested Transfers" block in TransferPanel is preserved unchanged — OCS is additive (RESEARCH.md §UI Placement Decision)
  - `free_transfers` is NOT a direct FPL API field — derived from `myTeamData.entry_history.event_transfers` + `squadData.active_chip` heuristic (RESEARCH.md §FT Count Sourcing); ROADMAP phase note below is corrected by RESEARCH.md
**Phase notes**: When authenticated, `ocsFtCount` is derived from `entry_history.event_transfers` + `active_chip` (the "free_transfers" field referenced in earlier notes does NOT exist on the FPL my-team API — see 050-RESEARCH.md §Pitfall 1). When unauthenticated, the FT pill toggle defaults to 1 FT and remains the user's manual selector. 2-FT additive approximation combos with `xPtsGain < MARGINAL_THRESHOLD` (1.0) are labelled "Marginal — verify".
**UI hint**: yes

### Phase 51: Weekly Decision Summary
**Goal**: Users see captain recommendation, transfer recommendation, chip timing flag, and risk flags on a single screen — no tab-hopping required — with a clear priority order and severity signals
**Depends on**: Phases 47, 48, 49, 50 (composites all preceding v1.7 engines)
**Requirements**: WDS-01, WDS-02, WDS-03, WDS-04, WDS-05
**Success Criteria** (what must be TRUE):
  1. A user with a squad loaded can view all four weekly decision types (captain, transfer, chip timing, risk flags) on a single screen without navigating to any other tab
  2. Recommendations appear in priority order: captain first, then transfer, then chip timing, then risks — so the most time-sensitive action is always at the top
  3. Each recommendation card carries a severity badge (High / Medium / Low) indicating urgency
  4. When no squad is loaded, the screen degrades gracefully — captain picks and chip timing cards remain visible; transfer and bench cards are hidden with an explanatory prompt
  5. When the upcoming gameweek is a DGW or BGW, a context flag is shown on the chip timing card affecting the recommendation framing
**Plans**: 2 plans (2 waves)
  **Wave 1**
  - [x] 051-01-PLAN.md — TDD: src/lib/decision-severity.ts + decision-severity.test.ts (computeDecisionSeverity pure function for WDS-03/WDS-05; SeverityLevel/DecisionSeverity/ComputeDecisionSeverityArgs exports; 21 test cases covering captain >= 2x boundary, transfer/risk shared rule, chip DGW/BGW HIGH gate)
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 051-02-PLAN.md — DecisionSummaryTab component composing v1.7 engines (4 cards: Captain/Transfer/Chip/Risk) + page.tsx wiring (Decision sub-tab as default Squad landing — D-10) + human-verify checkpoint
  **Cross-cutting constraints:**
  - `computeDecisionSeverity`, `SeverityLevel`, `DecisionSeverity` must exist (Plan 01) before DecisionSummaryTab can import the rule classifier and drive its four severity badges (Plan 02)
  - DecisionSummaryTab MUST receive identical props to TransferPanel (Phase 43 D-11): `{ teamId, onTeamIdChange, submittedId, onSubmit }`
  - The OCS table inside the Transfer card is mounted with `horizon={1}` and `derivedFtCount` — no FtToggle/GwToggle in this card (CONTEXT.md D-05/D-06/D-09)
**Phase notes**: The `resolveDecisionSummary()` priority hierarchy for conflicting engine outputs (e.g., Transfer engine recommends Sell while Verdict engine recommends Hold for the same player) must be fully specced — including the complete conflict matrix — before implementation begins. Hard limit of 4 visible outputs; no inline expansion. Track oldest source timestamp across all composed hooks; surface a "Refresh All" trigger. Decision Summary pinned to 1 GW horizon explicitly labelled, or horizon lifted to shared state — spec must choose before UI design.
**UI hint**: yes

### Phase 52: xMins Confidence Engine
**Goal**: Replace the four-bucket rotation label with calibrated per-player probability distributions — `start_prob`, `mins_60_prob`, and a refined `sub_risk_label` — so xPts computes appearance and CS components from real probabilities instead of heuristic buckets
**Depends on**: Phase 51 (v1.7 complete)
**Requirements**: MIN-01
**Success Criteria** (what must be TRUE):
  1. Every player in `merged_players.json` carries `start_prob` (sharpened, regularised), `mins_60_prob` (Bernoulli P(≥60 min)), and `sub_risk_label` (5-value enum) written by an extended `pipeline/xmins.py`
  2. `_compute_xpts_fixture` in `merge.py` consumes `mins_60_prob` for CS and appearance scaling, replacing the `min(1.0, xmins/60.0)` approximation
  3. Backward-compatibility preserved: existing `mins_risk` enum remains on `MergedPlayer`; `sub_risk_label` is an additive field
  4. Changes to xPts numerics are gated behind `xmins_v2_enabled` flag in `accuracy_backtest.json`, defaulting OFF until a 5-GW shadow-run shows non-regression
**Plans**: 4 plans (2 waves)
  **Wave 1** *(parallel)*
  - [ ] 052-01-PLAN.md — TDD: extend _compute_player_xmins with mins_60_prob, sub_risk_label, position-prior fallback (D-05/D-06/D-08); add SubRiskLabel + optional fields to src/lib/types.ts (same-commit per Pitfall 4)
  - [ ] 052-02-PLAN.md — TDD: extend _cs_prob signature with optional mins_60_prob kwarg (D-01); preserve backward-compat default None
  **Wave 2** *(blocked on Wave 1 completion)*
  - [ ] 052-03-PLAN.md — wire xmins_v2_enabled flag (D-02): merge_players kwarg threading + copy block + 3 _cs_prob call sites + run.py read + accuracy.py gate write
  - [ ] 052-04-PLAN.md — MinsRiskBadge optional mins60Prob prop (D-09) + 3 call-site updates (TransferPanel/CaptaincyPanel/XPtsCell hover, D-10) + Vitest test file + human-verify checkpoint
  **Cross-cutting constraints:**
  - `MergedPlayer.mins_60_prob?: number` field and `SubRiskLabel` type must exist (Plan 01) before Plan 04 can compile the badge prop wiring
  - `_cs_prob` must accept the optional `mins_60_prob` kwarg (Plan 02) before Plan 03 can update the 3 call sites
  - Plans 01 and 02 are parallel-safe (no file overlap); Plans 03 and 04 are parallel-safe (Plan 03 = Python pipeline, Plan 04 = TS UI)
  - D-03 contract: `mins_60_prob` and `sub_risk_label` are ALWAYS written to MergedPlayer regardless of `xmins_v2_enabled` flag — only the `_cs_prob` formula swap is gated
**Phase notes**: BGW guard misplacement (Pitfall 1) is a critical anti-pattern — `start_prob` and `mins_60_prob` MUST NOT be zeroed in `pipeline/xmins.py` for BGW players; the existing `_compute_xpts_fixture` guard at `merge.py` handles xPts=0 correctly. Same-commit rule (Pitfall 4) for `pipeline/xmins.py` + `src/lib/types.ts` (Plan 01). Tooltip format locked: `<Label> — <X>% chance 60+ min` (em-dash U+2014, integer percentage via `Math.round`). Four out-of-scope MinsRiskBadge call sites (SquadView, DecisionSummaryTab, gem-table column cell, PlayerComparisonModal) intentionally deferred per UI-SPEC.md scope.


### Phase 53: Bonus Point Predictor
**Goal**: Replace the flat per-position bonus rate constant with a per-player learned bonus EV derived from BPS history, so xPts captures individual bonus-scoring tendencies (top-3 BPS frequency) instead of a position average
**Depends on**: Phase 52 (sharper mins_60_prob feeds CS/appearance; same merge.py edit window)
**Requirements**: BPS-01
**Success Criteria** (what must be TRUE):
  1. `pipeline/bonus.py` exports `compute_bonus_predictions()` returning per-player `bonus_ev` using a shrinkage estimator (empirical mean blended with position prior, gated at ≥4 starts)
  2. `merge.py` replaces `BONUS_RATE[element_type]` lookup with per-player EV; flat rate remains as fallback for insufficient-sample players
  3. `xPts_components_1gw.bonus_pts` sum-integrity preserved: `appearance + goal + assist + cs + bonus == total` within ±0.01
  4. BPS-CS double-counting mitigated (bonus_ev residualised against cs_prob or split by action type)
  5. Model gated behind `bonus_predictor_enabled` flag; accuracy backtest must show non-regression before flag flips ON


**Plans**: 3 plans (2 waves)
  **Wave 1**
  - [x] 053-01-PLAN.md — TDD: pipeline/bonus.py (compute_bonus_predictions, shrinkage estimator, BPS-CS residualisation for GK/DEF) + test_bonus.py
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 053-02-PLAN.md — TDD: extend merge.py (_compute_xpts_fixture/_xpts_ngw/_compute_xpts_sigma/merge_players with bonus_predictor_enabled + bonus_ev kwargs); wire run.py compute call + flag read; test_merge_bonus.py + parametrise test_merge_xpts_components.py
  - [x] 053-03-PLAN.md — accuracy.py _read_existing_bonus_predictor_flag helper + summary key in compute_accuracy_backtest/_empty_backtest; 3 new tests in test_accuracy.py
  **Cross-cutting constraints:**
  - Plan 01 must ship `pipeline/bonus.py` with `compute_bonus_predictions(bootstrap, summaries, finished_gws)` before Plan 02 can import it in run.py
  - Plans 02 and 03 are parallel-safe (Plan 02 = merge.py + run.py, Plan 03 = accuracy.py + test_accuracy.py — no file overlap)
  - BONUS_RATE constant at merge.py line 22 must remain unchanged (Pitfall C1: documented fallback for insufficient-sample players)
  - bonus_predictor_enabled defaults OFF; manual flip after 5-GW shadow run shows non-regression (Phase 52 D-02 mirror)
**Phase notes**: BPS-CS double-counting mitigated for GK/DEF only via residualisation `max(0, bonus_ev_raw - 0.5 * cs_rate)` using historical clean_sheets from element-summary history rows; MID/FWD use plain shrinkage. Position priors `{1:0.30, 2:0.40, 3:0.60, 4:0.70}` match merge.BONUS_RATE exactly. Recent window = last 10 starts, MIN_STARTS_GATE = 4, SHRINKAGE_K = 12. No new HTTP calls — reuses the shared `summaries` cache fetched in run.py. Sum-integrity tolerance relaxes to ±0.02 when both `xmins_v2_enabled` AND `bonus_predictor_enabled` are ON (Pitfall 3).

### Phase 54: Price Change Predictor ✓ (2026-05-02)
**Goal**: Surface daily rise/fall predictions for FPL player prices — with confidence tiers and a progress indicator — so managers can act on team-value gains and avoid holding falling assets
**Depends on**: Phase 51 (independent of Phases 52-53; no merge.py dependency)
**Requirements**: PRC-01
**Success Criteria** (what must be TRUE):
  1. `pipeline/price_changes.py` computes per-player `direction` (rise/fall/stable), `confidence_pct`, and `eta_days` from cumulative net-transfer snapshots; `price_changes_snapshot.json` persists daily state
  2. `/api/price-changes` route (USE_BLOB toggle, 30-min cache) serves `price_changes.json`; `usePriceChanges` hook (30-min staleTime) exposes the data
  3. `PriceChangePanel` displays predictions grouped by HIGH/MEDIUM/LOW confidence; surfaced under the Analyse section
  4. Panel shows "early data" flag until ≥14 days of snapshots are available; badges suppressed below 70% precision threshold
  5. Cold-start handled: `price_changes.json` seeded to `{ predictions: [] }` so the route never 500s on fresh checkout
**Plans**: 3 plans (3 waves)
  **Wave 1**
  - [x] 054-01-PLAN.md — pipeline/price_changes.py (compute_price_change_predictions + 7 pytest cases) + cold-start seed files (git add -f) + run.py integration block after set-piece block
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 054-02-PLAN.md — src/lib/types.ts PriceDirection/PriceChangePrediction/PriceChanges; /api/price-changes route (USE_BLOB, s-maxage=1800); usePriceChanges hook (30-min staleTime)
  **Wave 3** *(blocked on Wave 2 completion)*
  - [x] 054-03-PLAN.md — PriceChangePanel.tsx (rise/fall sections, inline-style progress bar, tier badges suppressed when snapshot_days < 14, early-data banner) + 4 Vitest cases + page.tsx wiring (SubTab union + SECTIONS entry + render conditional + import) + human-verify checkpoint
  **Cross-cutting constraints:**
  - Plan 01 must ship pipeline/cache/price_changes.json seed file before Plan 02 route can serve cold-start (SC-5)
  - Plan 02 PriceChanges type must exist before Plan 03 PriceChangePanel can compile
  - pipeline/cache/ is gitignored at .gitignore line 43-44; both seed files require git add -f (Pitfall 1 / PATTERNS Critical Note 1)
  - Progress bar MUST use inline style {{ width: `${confidence_pct}%` }} — Tailwind JIT does not generate dynamic classes (Pitfall 4)
**Phase notes**: Confidence tier badges (HIGH=red, MEDIUM=amber, LOW=zinc per Phase 51 D-13 severity convention) suppressed below 14 days of snapshot history (D-06). `eta_days === 0` renders "Tonight". Stable predictions filtered out (D-04). GW reset boundary: cumulative_net resets to 0 only when cost_change_event != 0 in new bootstrap reading. Phase 54 is read-only public data — no ASVS controls required (RESEARCH.md §Security Domain).

### ✅ Phase 55: Bench Order Optimiser (completed 2026-05-03)
**Goal**: Suggest an autosub-optimal bench ordering (positions 1–3 outfield + GK slot) weighted by start_prob × xPts EV and respecting FPL formation-legality constraints — so the manager's bench actually maximises expected points captured via autosubs
**Depends on**: Phase 52 (consumes sharpened `start_prob` from MIN-01)
**Requirements**: BENCH-01
**Success Criteria** (what must be TRUE):
  1. `benchOrder()` exported from `optimise-lineup.ts` ranks outfield bench slots by `start_prob × xPts_{horizon}` EV, with GK fixed at bench[0]
  2. Formation-legality validator reused from `optimiseLineup` — never suggests an order where the top autosub candidate would be skipped due to formation rules
  3. BGW bench players (no fixture this GW) sorted to slot 3 regardless of xPts; DGW bench players correctly double-weighted
  4. BB chip mode detected: panel shows "Bench order doesn't affect score with Bench Boost active"
  5. `optimise-lineup.test.ts` covers: formation-locked slot-1 selection, BGW-to-slot-3 rule, DGW double-weight, BB bypass
**Plans**: 2 plans (1 wave)
  **Wave 1** *(parallel — disjoint files)*
  - [x] 055-01-PLAN.md — TDD: benchOrder() in src/lib/optimise-lineup.ts (EV/BGW/DGW/formation logic) + 4 BENCH-01 tests in optimise-lineup.test.ts + integration replacing line-136 sort
  - [x] 055-02-PLAN.md — BB inline note in OptimiserPanel.tsx (bb-bench-order-note guarded by chipMode === 'bench-boost') + 1 RTL test in OptimiserPanel.test.tsx
  **Cross-cutting constraints:**
  - Plans 01 and 02 touch DISJOINT files (Plan 01 = src/lib/optimise-lineup.{ts,test.ts}; Plan 02 = src/components/optimiser/OptimiserPanel.{tsx,test.tsx}) — fully parallel-safe
  - benchOrder() (Plan 01) is a pure function with no chip-mode awareness (D-10); BB note (Plan 02) is purely informational — no behavioural coupling between the plans
**Phase notes**: EV formula `start_prob × (player[HORIZON_FIELD[horizon]] ?? 0) × player.fixtures.length` (D-03) auto-handles DGW (×2) and BGW (×0); BGW also forced to bench[3] by explicit partition (D-05/D-06). Formation-flex check is a tie-breaker rank, not exclusion (D-09) — invalid candidates still appear in returned array. No new types, no new files beyond extensions to existing ones.

---

_v1.9 phase details archived to `.planning/milestones/v1.9-ROADMAP.md`_

---

### Phase 61: MC Simulation Core
**Goal**: Users can see simulation-derived blank probability, haul probability, floor (10th percentile), and ceiling (90th percentile) for any player for the upcoming GW — making the uncertainty of xPts predictions explicit
**Depends on**: Phase 60 (v1.9 complete); reuses `_compute_xpts_fixture` Poisson/Bernoulli parameters from `pipeline/merge.py`
**Requirements**: MC-01, MC-02
**Success Criteria** (what must be TRUE):
  1. `pipeline/simulate.py` runs 10,000 Monte Carlo simulations per player per GW using Poisson goal/assist distributions and Bernoulli CS distributions drawn from the existing xPts pipeline parameters, and writes `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` to each player in `merged_players.json`
  2. User can see blank% and haul% for any player in GemTable row expand — "X% chance of blank (≤2 pts) | Y% chance of haul (≥10 pts)"
  3. User can see floor (10th percentile) and ceiling (90th percentile) outcomes for any player, shown alongside the existing xPts headline figure
  4. BGW players show blank% = 100% and haul% = 0% (no fixture = guaranteed blank); DGW players correctly simulate both fixtures and combine
  5. Simulation results are written once per pipeline run and consumed as static JSON — no client-side simulation, no added latency on page load
**Plans**: TBD
**UI hint**: yes

### Phase 62: MC Rank Simulator & Captain Integration
**Goal**: Users can simulate where their rank will be after 5 GWs under their current XI vs an alternative XI, and captain recommendations are augmented with MC-derived labels (highest ceiling, lowest floor, best P(haul))
**Depends on**: Phase 61 (requires `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` per player from MC-01/MC-02)
**Requirements**: MC-03, MC-04
**Success Criteria** (what must be TRUE):
  1. User can open a 5-GW rank trajectory simulator that shows P(top-10k), P(rank gain), and P(rank drop) for their current XI lineup
  2. User can define an alternative XI (by swapping players) and see the rank trajectory comparison side-by-side with the current XI
  3. Each captain candidate in `CaptainPicksPanel` shows one augmented MC label — "Highest ceiling", "Lowest floor", or "Best P(haul)" — with the corresponding simulated value displayed
  4. TC (Triple Captain) decision engine surfaces the player with the highest P(haul) as the TC recommendation, annotated with the simulated probability
  5. Rank simulator degrades gracefully when squad is not loaded — shows an explanatory prompt rather than an empty chart
**Plans**: TBD
**UI hint**: yes

### Phase 63: Model Versioning & Calibration Charts
**Goal**: The accuracy pipeline tracks model version history, and AccuracyTab users can compare accuracy across multiple model versions and inspect calibration reliability diagrams broken out by position
**Depends on**: Phase 60 (v1.9 complete); extends existing `pipeline/accuracy.py` and `AccuracyTab.tsx`
**Requirements**: VER-01, VER-02, CAL-01, CAL-02
**Success Criteria** (what must be TRUE):
  1. Every pipeline run writes a version record to `accuracy_backtest.json` containing: formula version string, data timestamp, and all active gate flag states (xmins_v2_enabled, bonus_predictor_enabled, form_signal_enabled)
  2. AccuracyTab shows a version comparison table with hit rate per version and a delta indicator — user can see at a glance whether a model change improved or degraded accuracy
  3. AccuracyTab shows a calibration reliability diagram: for players predicted at each haul% bracket (e.g., 30-40%), the diagram shows the actual observed haul rate — a well-calibrated model produces a near-diagonal line
  4. Calibration diagram is broken out by position (GK / DEF / MID / FWD) so position-specific over- or under-confidence is immediately visible
  5. Both version comparison and calibration diagram are populated from static `accuracy_backtest.json` — no additional API route or pipeline changes to data flow required beyond `accuracy.py` extensions
**Plans**: TBD
**UI hint**: yes

### Phase 64: Sensitivity Analysis
**Goal**: Transfer candidates and captain recommendations carry a fragility flag when the recommendation would reverse under plausible adverse conditions — making it clear which picks are robust and which are conditional
**Depends on**: Phase 60 (v1.9 complete); operates over existing `MergedPlayer` data in client-side TypeScript
**Requirements**: SENS-01, SENS-02
**Success Criteria** (what must be TRUE):
  1. Every transfer candidate row and every captain recommendation row carries a computed fragility flag — "fragile" when the recommendation reverses if start_prob drops below 70%, fixture difficulty worsens by 1 tier, or the action requires a 4pt hit
  2. Fragile recommendations display an amber indicator that is visually distinct from the existing severity badge system — not easily confused with High/Medium/Low severity
  3. Each fragile recommendation shows a one-line explanation: "no longer recommended if: [specific condition]" — naming the exact condition that would reverse the call
  4. Non-fragile recommendations show no fragility indicator — the UI is not cluttered for robust picks
  5. Fragility computation is pure TypeScript over existing `MergedPlayer` fields — no new API call, no pipeline change required
**Plans**: TBD
**UI hint**: yes

### Phase 65: Rejection Explainer
**Goal**: Users can understand why any player they are curious about did not surface as a transfer target or captain recommendation — turning opaque ranking into an auditable, trust-building explanation
**Depends on**: Phase 64 (sensitivity flags inform rejection reasons); operates over existing `MergedPlayer` and recommendation engine outputs
**Requirements**: WHY-01, WHY-02, WHY-03
**Success Criteria** (what must be TRUE):
  1. User can expand any GemTable row and read a natural-language "why not?" explanation for why that player falls below the transfer or captain recommendation threshold — covering at least: ownership%, xPts ranking, start probability, fixture difficulty, and any active fragility flag
  2. TransferPanel shows a dedicated callout for any player with >20% ownership who is absent from the transfer candidate list — the callout names the player and gives a one-sentence reason ("Salah: already ranked #1 in your squad by xPts — no upgrade available at position")
  3. Squad view row expand for an owned player explains why they are not recommended to hold or captain — distinguishing between "below xPts threshold", "rotation risk", "difficult fixture", and "fragile recommendation"
  4. All three explainer surfaces (GemTable, TransferPanel callout, SquadView) are computed client-side over existing data — loading a page or squad triggers computation with no additional network request
  5. Explanations use plain English with specific values — not generic phrases like "not recommended" — so the user can act on the reasoning
**Plans**: TBD
**UI hint**: yes

---

## v1.11 Insights & Infrastructure (Phases 66-71)

### Phase 66: Fixture Heat Map
**Goal**: Users can see at a glance which teams have favourable upcoming runs across the next 8 GWs — a single colour-coded grid replaces tab-by-tab fixture inspection and makes long-horizon transfer planning trivially scannable
**Depends on**: Phase 60 (v1.9 complete); reuses existing `attacking_difficulty` per-fixture values from `pipeline/merge.py`
**Requirements**: HEAT-01, HEAT-02, HEAT-03
**Success Criteria** (what must be TRUE):
  1. User can open a fixture heat map showing all 20 PL teams as rows × the next 8 GWs as columns, with each cell colour-coded green (easy) / amber (medium) / red (hard) using existing `attacking_difficulty` thresholds
  2. DGW cells are visually distinguished (split cell or DGW badge) so the manager immediately recognises a double-fixture opportunity; BGW teams display a blank/empty cell for that GW with no colour coding
  3. The full 20×8 grid fits a single desktop screen with no horizontal scrolling — all teams and all 8 GWs visible at one glance
  4. Hovering a cell reveals the opponent club name, home/away indicator, and the underlying difficulty value — so the colour can be cross-checked against the data
  5. Heat map is reachable from the Analyse section navigation as a dedicated tab
**Plans**: 3 plans (2 waves)
  **Wave 1** *(parallel — disjoint files)*
  - [ ] 066-01-PLAN.md — pipeline/merge.py FIXTURE_LOOKAHEAD 5→16 + src/lib/types.ts upcoming_fixtures comment "next 5"→"next 16"
  - [ ] 066-02-PLAN.md — TDD: src/components/club-form/FixtureHeatMap.tsx + FixtureHeatMap.test.tsx (12 cases covering HEAT-01/HEAT-02/HEAT-03, groupby event_id, DGW gradient, BGW empty, alphabetical sort, tooltip formats)
  **Wave 2** *(blocked on Plan 02 completion)*
  - [ ] 066-03-PLAN.md — src/app/page.tsx wiring (import + SubTab union + SECTIONS Analyse entry + render guard) + src/app/page.test.tsx vi.mock + Phase 66 navigation test
  **Cross-cutting constraints:**
  - Plans 01 and 02 touch DISJOINT files (Plan 01 = pipeline/merge.py + src/lib/types.ts; Plan 02 = src/components/club-form/FixtureHeatMap.{tsx,test.tsx}) — fully parallel-safe
  - Plan 03 imports `FixtureHeatMap` from Plan 02; the page.test.tsx vi.mock MUST land in the SAME plan/commit as the page.tsx import to avoid breaking the existing test suite (Pitfall 3 from RESEARCH.md)
**Phase notes**: D-01 FIXTURE_LOOKAHEAD=16 (8 GWs × 2 DGW max). D-02 client-side groupby event_id over upcoming_fixtures, first 8 unique event_ids form columns (derived from union across all teams — Pitfall 1). D-03 DGW cells use CSS linear-gradient split-diagonal (inline style; dark-mode hex limitation accepted per Pitfall 2). D-04 DGW tooltip slash-separated; D-08 single-fixture tooltip uses em-dash U+2014. D-05 reuses ClubFormFixture.difficulty_tier directly — no new threshold computation. D-06 sub-tab inserted after `'price-changes'` in Analyse SECTIONS, label `'Heat Map'` (mobile and desktop identical). HEAT-03 desktop no-scroll achieved via `min-w-[640px]` table inside `overflow-x-auto` wrapper (20 rows × 8 × 48px ≈ 448px < 1440px viewport). No new API routes, no new hooks — `useClubForm()` is the data source.
**UI hint**: yes

### Phase 67: LLM Prose Summaries
**Goal**: Users can read a plain-English weekly summary of the model's top recommendations — a Claude-generated paragraph grounded in structured pipeline output (no hallucinated player data) — turning numeric rankings into a digestible narrative
**Depends on**: Phase 51 (Decision Summary supplies the structured input — captain pick, transfer recommendation, chip flag, risk flags)
**Requirements**: NLP-01, NLP-02
**Success Criteria** (what must be TRUE):
  1. User can read a weekly prose summary on the Decision Summary screen — Claude-generated paragraph derived from the same structured engine outputs that drive the four Decision cards, with player names and numeric values quoted verbatim from the structured input (no invented player data)
  2. User can press a "Refresh summary" button to regenerate the prose mid-week (e.g., after price changes, injury news) without waiting for the next pipeline run
  3. Summary regenerates automatically each pipeline run, persisted alongside other pipeline output (Vercel Blob), and served via a typed API route consumed by a TanStack Query hook
  4. When the LLM call fails or quota is exceeded, the screen degrades gracefully — falls back to the existing structured Decision cards without blocking the rest of the UI
  5. Generated prose names only players present in the structured model input — a guardrail check rejects responses referencing players not in the input set
**Plans**: 3 plans (3 waves)
  **Wave 1**
  - [ ] 067-01-PLAN.md — Wave 0 test scaffolds, ProseSummary/ProseRefreshPayload types, shared TS guardrail (prose-guardrail.ts), Anthropic SDK dependencies (Python + npm)
  **Wave 2** *(blocked on Plan 01 completion)*
  - [ ] 067-02-PLAN.md — Pipeline path: prose_summary.py + run.py integration + pipeline.yml ANTHROPIC_API_KEY; GET /api/prose-summary route + useProseSummary hook + ProseSummaryBlock mounted in DecisionSummaryTab (payload=null placeholder)
  **Wave 3** *(blocked on Plan 02 completion)*
  - [ ] 067-03-PLAN.md — Refresh path: POST /api/prose-summary (zod + maxDuration=30 + Anthropic SDK + retry guardrail), real useProseRefresh mutation, DecisionSummaryTab builds ProseRefreshPayload from existing state + human-verify checkpoint
  **Cross-cutting constraints:**
  - `ProseSummary` and `ProseRefreshPayload` types must exist in src/lib/types.ts (Plan 01) before Plans 02+03 can compile
  - `passesGuardrail` TS module (Plan 01) algorithm MUST be byte-equivalent to `_passes_guardrail` in pipeline/prose_summary.py (Plan 02)
  - Plan 02 lands a stub `useProseRefresh` (no-op mutation) so ProseSummaryBlock compiles without the POST route; Plan 03 replaces the stub with real `useMutation` — file path stays the same
  - DecisionSummaryTab passes `payload={null}` in Plan 02 and `payload={proseRefreshPayload}` in Plan 03 — same component prop, evolving caller
  - `export const maxDuration = 30` is REQUIRED on the POST route (Pitfall 1: Hobby plan default 10s will silently 504)
  - ANTHROPIC_API_KEY GitHub repo secret + local .env must be configured by user before pipeline merge — D-14 graceful skip handles missing key without crash
**Phase notes**: D-01 pipeline writes global squad-agnostic prose covering top-3 captains + top-3 differential gems (recomputed in prose_summary.py from merged_players.json — captain_picks.json schema unchanged per Open Question 1 resolution). D-02 prompt input deviates: top-3 captains from merged xPts_1gw, top-3 gems = ownership<15% AND xPts_1gw>0 (Open Question 2 resolution; insights.json contains pattern statements not gems). D-08 model = `claude-haiku-4-5` (alias) for both Python and TS calls. D-12 exact-match guardrail (case-insensitive + whitespace-normalised) implemented twice: src/lib/prose-guardrail.ts + pipeline/prose_summary.py — algorithms must agree. D-13 422 → silent UI hide; D-14 Python guardrail double-fail → no Blob write. Open Question 3: prose is QUALITATIVE (no numeric values; cards above already show exact figures). Open Question 4: POST handler reads merged_players.json server-side via USE_BLOB switch — body does NOT carry corpus.
**UI hint**: yes

### Phase 68: In-App Alert System
**Goal**: Users see proactive in-app alerts when actionable changes occur since their last visit — price moves, injury status flips, set-piece taker changes, and imminent deadlines — so they never miss a window to act
**Depends on**: Phase 54 (price change snapshots), Phase 26 (set-piece change detection); both already in production
**Requirements**: ALERT-01, ALERT-02, ALERT-03
**Success Criteria** (what must be TRUE):
  1. User sees an in-app alert banner or notification badge when any of the following have changed since their last visit: a player price rose or fell, a player's injury/availability status changed, or a set-piece taker assignment changed
  2. When a GW deadline is within 24 hours, a live deadline countdown is shown in the alert banner area, updating in real time as the deadline approaches
  3. User can dismiss individual alerts (close button per alert); dismissed alerts do not return on subsequent visits — dismissed-state is persisted via localStorage keyed by alert ID
  4. Alerts are computed client-side from existing pipeline outputs (price_changes.json, bootstrap status field, set_piece_changes.json) — no new pipeline cron, no server-side state required
  5. Alert area is accessible on every section (top of page, above the section nav) — managers see alerts regardless of which tab they land on
**Plans**: TBD
**UI hint**: yes

### Phase 69: Event-Based Pipeline Refresh
**Goal**: Pipeline data is fresh near gameweek deadlines and post-deadline — additional GitHub Actions triggers run the pipeline at 6h/2h/30min before each deadline and immediately after, so managers always see current data when it matters most; stale data is surfaced rather than served silently
**Depends on**: Phase 60 (v1.9 complete); extends existing GitHub Actions daily cron in `.github/workflows/pipeline.yml`
**Requirements**: REFRESH-01, REFRESH-02, REFRESH-03
**Success Criteria** (what must be TRUE):
  1. Pipeline runs successfully on additional scheduled GitHub Actions triggers at 6 hours, 2 hours, and 30 minutes before each GW deadline — verified by the `last_updated` timestamp in `/api/last-updated` advancing within those windows
  2. Pipeline runs automatically within 1 hour after each GW deadline passes — post-deadline transfer activity (auto-substitutes, captain confirmations) is reflected in the merged dataset
  3. When the pipeline has not refreshed within the expected window for the upcoming deadline, the app shows a visible warning ("Last successful run: X ago — data may be stale") on every section, replacing the silent stale-serve behaviour
  4. GitHub Actions workflow uses the FPL `events` API to compute deadline-relative trigger times rather than hard-coded cron schedules — so a deadline change does not require a workflow file edit
  5. Pipeline failures (any step exits non-zero) leave the previous successful `last_updated` timestamp untouched — the staleness warning fires cleanly instead of overwriting good data with broken data
**Plans**: TBD
**UI hint**: yes

### Phase 70: Post-GW Review
**Goal**: After each gameweek settles, users can read an auto-generated GW review — bench points left, captain delta vs optimal, top scorer, score vs top-10k template — turning each completed GW into a learning moment rather than a number on a leaderboard
**Depends on**: Phase 55 (`benchOrder()` and `optimiseLineup()` supply the optimal-captain comparison), Phase 69 (post-deadline pipeline refresh ensures actual scores are available)
**Requirements**: PGW-01, PGW-02
**Success Criteria** (what must be TRUE):
  1. After each GW settles, user can view a Post-GW Review card showing: total bench points left, their captain pick vs the optimal captain (player name and points delta), their top scorer (player name and points), and their GW score vs the top-10k average
  2. Review data is written by the pipeline to Vercel Blob after each GW settles (post-deadline + after final scores fix) and served via a new `/api/gw-review` route, consumed by a typed TanStack Query hook
  3. Review surfaces in the Squad section as a new "Review" sub-tab (or analogous placement) — historic GW reviews are listed by GW number for retrospective browsing
  4. When the pipeline cannot compute a review (GW not yet settled, missing data), the screen degrades gracefully with a clear "GW review will appear once scores finalise" prompt rather than an empty card or error
  5. Review is keyed by team ID — a manager loading a different team ID sees the corresponding manager's GW review, not stale state from a previous team
**Plans**: TBD
**UI hint**: yes

### Phase 71: Decision History & Regret Backtester
**Goal**: Users can log their actual decisions each GW and see a cumulative report — captain hit rate, transfer ROI, hit break-even rate — plus a per-transfer regret backtester with a 2×2 process×outcome matrix, so they learn whether their process is sound regardless of luck
**Depends on**: Phase 70 (post-GW actuals are needed to score logged decisions retrospectively)
**Requirements**: HIST-01, HIST-02, BACK-01, BACK-02
**Success Criteria** (what must be TRUE):
  1. User can log each GW's decisions (captain pick, transfers in/out, chip used if any) via a Decision Log form on the Squad section; logged entries are persisted to Vercel Blob keyed by team ID + GW number
  2. User can view a cumulative Decision Report showing: captain hit rate (% of GWs where captain outscored vice), transfer ROI (xPts gained on bought minus scored by sold at decision time), and hit break-even success rate
  3. For each logged transfer, user can see a retrospective verdict: actual GW outcome (points scored by player bought vs player sold that GW) plus a process grade (Good process = model ranked the buy above the sell at decision time, irrespective of actual outcome)
  4. Regret dashboard displays a 2×2 outcome matrix — Good process / Bad outcome, Good process / Good outcome, Bad process / Good outcome, Bad process / Bad outcome — with the count of transfers and example player pairs in each quadrant
  5. When no decisions have been logged yet, the Decision Report and Regret matrix degrade gracefully with an explanatory prompt and a one-click jump to the Decision Log form
**Plans**: TBD
**UI hint**: yes

### Phase 72: Lineup Optimiser
**Goal**: Users can see the algorithm's recommended starting XI and bench order on a classic FPL-style pitch layout, and override it via two-tap swap interactions (position-compatibility enforced) — turning the existing C(15,11) optimiser output into an interactive team sheet that the manager can adjust for cases the algorithm cannot know
**Depends on**: Phase 43 (`optimiseLineup()` and `benchOrder()` already in `src/lib/optimise-lineup.ts`); reuses `useSquad`/`usePlayers` hooks and `OptimiserPanel`'s empty/loading/error/BGW shell pattern unchanged
**Requirements**: LINEUP-01
**Success Criteria** (what must be TRUE):
  1. User can open the Squad section and click a 4th sub-tab ("Lineup", positioned after Optimiser) to see a pitch-layout team sheet rendering `optimiseLineup(picks, players, 1)`'s recommendation with formation rows (GK / DEF / MID / FWD) and a bench row below
  2. Each player card shows web_name + xPts_1gw (1 decimal) + start_prob percentage (rounded integer); captain card has an amber "C" badge, vice-captain card has a grey "VC" badge
  3. User can tap a starter to arm a swap (amber ring + amber tint), see compatible bench players highlighted (green ring) and incompatible ones dimmed (40% opacity, disabled), then tap a compatible bench player to execute the swap — captain/VC and formation string update automatically per FPL rules
  4. Tapping the same armed starter again disarms the swap; tapping the pitch background also clears the armed state; `e.stopPropagation()` on every card prevents accidental disarm via event bubbling
  5. Reset button restores the algorithm's original recommendation; user-made swaps are session-only (no localStorage persistence per D-08); refetches reset overrides as accepted side effect
**Plans**: 2 plans (2 waves)
  **Wave 1**
  - [x] 072-01-PLAN.md — `src/lib/lineup-swap.ts` + `src/lib/lineup-swap.test.ts` (pure helpers `isLegalSwap` and `applySwap` — GK rule, formation-legality predicate mirroring `optimise-lineup.ts:91-97`, captain/formation recomputation per Pitfalls 2/3)
  **Wave 2** *(blocked on Plan 01)*
  - [x] 072-02-PLAN.md — `src/components/squad/LineupTab.tsx` + `LineupTab.test.tsx` (pitch UI, two-tap state machine, override state, Reset) + `src/app/page.tsx` 4-line additive wiring + `page.test.tsx` mock and Lineup sub-tab nav test + manual UAT checkpoint for visual styling / transition feel / mobile viewport
  **Cross-cutting constraints:**
  - Plan 02 imports `isLegalSwap` and `applySwap` from Plan 01 — sequential dependency
  - All 9 CONTEXT.md decisions (D-01..D-09) and all 7 RESEARCH.md pitfalls (Pitfall 1: `xPts_1gw !== 0` BGW filter; 2: captain recompute; 3: formation string update; 4/5: full `isLegalSwap` validator; 6: refetch reset accepted; 7: `e.stopPropagation()` on every card) MUST be encoded — acceptance criteria in each task grep-verify the load-bearing patterns
**Phase notes**: Pure UI phase — no pipeline change, no scoring formula change. D-01 `xPts_1gw` already embeds `start_prob` (no re-multiplication — would double-count per `pipeline/merge.py` CR-02). D-02 horizon=1 only (no toggle). D-04 cards: web_name + xPts.toFixed(1) + Math.round(start_prob × 100) + "%". D-05 captain logic copied verbatim from `optimise-lineup.ts:57-58` (`xPts_90th_1gw ?? xPts_1gw ?? 0`). D-07 GK only swaps with GK; outfield cross-position allowed iff resulting formation in {3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1}. D-08 session-only — no localStorage. D-09 4th sub-tab in Squad section after Optimiser. UI-SPEC two-weight typography contract (400/600 only — `font-bold` is forbidden per the captain badge specification reduced from `font-bold` to `font-semibold`).
**UI hint**: yes

### Phase 73: Post-GW Review
**Goal**: Users can view an auto-generated review for each of the last 3 settled GWs — bench points left, captain delta vs optimal, top scorer, GW score vs FPL average — via a 5th "Review" sub-tab in the Squad section with a GW pill toggle, turning each completed GW into a learning moment
**Depends on**: Phase 55 (`benchOrder()` and `optimiseLineup()` supply the optimal-captain comparison); Phase 72 (5th sub-tab after Lineup)
**Requirements**: PGW-01, PGW-02
**Success Criteria** (what must be TRUE):
  1. User can open Squad → "Review" sub-tab and see a GW review card for the most recently settled GW showing: bench points left, their captain vs the optimal captain (player names + points delta), their top scorer (player name + points), and their GW score vs FPL average
  2. Review data is written by the pipeline to Vercel Blob as `gw_review_gw{N}.json` (fields: `gw`, `average_score`) for the last 3 settled GWs; served via `GET /api/gw-review?teamId=&gw=` which merges Blob data with on-demand FPL picks; consumed by `useGwReview` TanStack Query hook
  3. A GW pill toggle (e.g., "GW33 | GW34 | GW35") lets the user switch between the last 3 settled GWs; defaults to most recent settled GW
  4. When GW is not yet settled or Blob file is missing, screen shows "GW review will appear once scores finalise" rather than an error; when no team ID is loaded, shows "Load your squad to see GW reviews"
  5. Review is keyed by team ID — switching team ID loads that team's own GW review data, not stale state from a previous team
**Plans**: 3 plans (3 waves)
  **Wave 1**
  - [x] 073-01-PLAN.md — Pipeline gw_review writer block in run.py + 3 cold-start seed files (gw_review_gw{33,34,35}.json) force-added to git
  **Wave 2** *(blocked on Wave 1 completion)*
  - [x] 073-02-PLAN.md — GwReview TypeScript interface + GET /api/gw-review route (USE_BLOB switch, direct FPL upstream fetch, captain_delta with pick.multiplier) + useGwReview TanStack Query hook (30 min staleTime)
  **Wave 3** *(blocked on Wave 2 completion)*
  - [x] 073-03-PLAN.md — Wave 0 GwReviewTab.test.tsx (4 RTL cases) → GwReviewTab.tsx component (5 state branches, GW pill toggle, UI-SPEC styling) → page.tsx 4 additive edits → MobileNav.test.tsx updated to expect 5 Squad pills
  **Cross-cutting constraints:**
  - Plan 02 imports the GwReview interface created in Plan 02 Task 1; the API route and the hook share that single source of truth in src/lib/types.ts
  - Plan 03 Task 1 (test file) is Wave 0 per VALIDATION.md — written BEFORE the component (RED phase); Task 2 implements component to pass tests (GREEN)
  - SETTLED_GWS_PLACEHOLDER constant in page.tsx is hardcoded [33,34,35] for v1 ship — derives-from-bootstrap is deferred per RESEARCH.md Open Question 2; UI gracefully degrades when a requested gw lacks a Blob file
  - pipeline/cache/ is gitignored (.gitignore line 44); seed files require `git add -f` (Pitfall 5)
  - API route MUST call FPL upstream directly (Pitfall 1) — relative-URL self-fetch fails in Vercel serverless deployments
  - captain_delta MUST use `pick.multiplier` not hardcoded 2 (Pitfall 3 — handles Triple Captain where multiplier=3)
**UI hint**: yes

---

## v1.12 Modelling & Refinement (Phases 61-65 carry-forward + 74-77 new)

### Phase 74: Transfer Engine Overhaul
**Goal**: Transfer suggestions correctly enforce the 3-player-per-team cap, never duplicate player moves across multi-transfer plans, and present all four cost scenarios (1FT, 2FT, −4, −8) with live bank balance and clear affordability indicators
**Depends on**: Phase 73 (v1.11 complete); extends existing `suggestTransfers()` in `src/lib/optimise-lineup.ts` and `TransferPanel`
**Requirements**: TFX-01, TFX-02, TFX-03, TFX-04, TFX-05
**Success Criteria** (what must be TRUE):
  1. Transfer panel never suggests a player from a team where the user already owns 3 players — the 3-per-team cap is silently filtered before any candidate appears
  2. When the user views a 2FT or hit plan, no player appears as both a sell candidate in one step and a buy candidate in another — each move involves a distinct player pair
  3. User can view 1FT, 2FT, −4 hit, and −8 hit (two hits) scenarios in a single panel without switching views — all four rows visible simultaneously
  4. Each scenario row shows the remaining bank balance after the move; unaffordable moves are visually disabled (greyed out or struck through) rather than silently excluded
  5. When authenticated, bank balance is auto-derived from FPL sell prices; when unauthenticated, user can type their bank balance into a field that immediately updates all affordability checks
**Plans**: TBD
**UI hint**: yes

### Phase 75: Fixture Heat Map v2
**Goal**: The fixture heat map gains opponent labels in every cell, owned-team row highlighting, a user-selectable horizon (8/12/16 GWs), and an ATT/DEF difficulty toggle — making it useful for targeted transfer planning rather than just general fixture scanning
**Depends on**: Phase 66 (Fixture Heat Map Phase 1 — base grid must exist); Phase 66 plans not yet started, so Phase 75 is sequenced after Phase 66 executes
**Requirements**: HEAT-04, HEAT-05, HEAT-06, HEAT-07, HEAT-08
**Success Criteria** (what must be TRUE):
  1. Every fixture cell in the heat map displays the opponent's abbreviated name (e.g. "MCI", "ARS") so the manager can read who each team plays without hovering
  2. User can press a toggle to show only rows for teams where they own at least one player; full grid is restored when squad is not loaded or toggle is off
  3. Heat map rows for teams where the user owns players are visually highlighted (distinct background or left border) even when the filter is off, so owned-team fixtures stand out at a glance
  4. User can select an 8 GW, 12 GW, or 16 GW horizon using a pill selector — the grid expands to the chosen width without layout overflow
  5. User can toggle between attacking difficulty view and defensive difficulty view via a two-button pill — both datasets already exist in the pipeline per team per fixture
**Plans**: TBD
**UI hint**: yes

### Phase 76: Analytics Enhancements
**Goal**: GemTable gains a sortable Routes to Points column from pipeline data; Accuracy tab GW rows become clickable to reveal flagged players and haulers; LineupTab gains a manual captain/VC override interaction
**Depends on**: Phase 73 (v1.11 complete); Phase 72 (LineupTab exists for OPT-01); extends existing `pipeline/merge.py`, `AccuracyTab.tsx`, and `LineupTab.tsx`
**Requirements**: RTP-01, RTP-02, ACC2-01, OPT-01
**Success Criteria** (what must be TRUE):
  1. Pipeline writes a `routes_to_points` integer (1–5) to every player in `merged_players.json` counting their distinct point-scoring routes (pen taker, FK taker, corner taker, primary xG scorer, primary xA provider)
  2. GemTable shows a "Routes" column with the `routes_to_points` value, sortable ascending/descending; column is hidden on mobile portrait view
  3. User can click any GW row in the Accuracy GW Summary table to expand a drill-down panel showing which players were xPts-flagged (predicted haul, actual blank) and which were haulers (substantially outperformed xPts) for that GW, with player names and actual vs predicted points
  4. User can tap any player on the LineupTab pitch to arm a captain assignment (amber "C" badge reassignment); a distinct secondary interaction (e.g. long-press or dedicated VC button) assigns vice-captain; the override is session-only and a Reset button restores the algorithm's recommendation
**Plans**: TBD
**UI hint**: yes

### Phase 77: Pitch Visuals & Mobile Polish
**Goal**: LineupTab renders player kit art alongside names for faster visual scanning; Decision tab captain card no longer overflows its container; all tabs are verified clean on 390–430px viewport with no truncation, overflow, or undersized tap targets
**Depends on**: Phase 76 (LineupTab captain override must be complete before kit art is layered on top); Phase 74 (transfer panel layout stable before mobile audit)
**Requirements**: OPT-02, POL-01, POL-02, POL-03
**Success Criteria** (what must be TRUE):
  1. Each player card on the LineupTab pitch displays a team kit image (shirt colours) alongside the player's name — a coloured placeholder renders when the image URL is unavailable or fails to load
  2. CaptainPicksPanel on the Decision tab renders entirely within its card container on desktop — no content clips the card boundary; card expands vertically or uses an internal scroll region as needed
  3. GemTable and all sub-tables (Accuracy, Rivals, Value Gems, DefCon) render without horizontal overflow on 390–430px viewport widths — xPts columns and sortable columns are fully visible or the table is explicitly scroll-bounded
  4. Every tab verified individually on a 430px viewport (Galaxy S26+): no truncated text, no misaligned cells, no tap targets below 44px — all violations resolved before the phase is marked complete
**Plans**: TBD
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
| 61 | v1.12 | 0 | Not started | - |
| 62 | v1.12 | 0 | Not started | - |
| 63 | v1.12 | 0 | Not started | - |
| 64 | v1.12 | 0 | Not started | - |
| 65 | v1.12 | 0 | Not started | - |
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
