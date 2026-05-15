# FPL Analyst

## What This Is

A personal web app for Fantasy Premier League managers that pulls in your squad via FPL Team ID and surfaces actionable intelligence: which players to target, who to sell, hidden gems, DefCon candidates, form analysis, transfer suggestions, and a full lineup optimiser — all grounded in FPL API data plus Understat xG/xA.

v1.20 Phase 112 complete (2026-05-15) — OPT-01 + TFR-02: Optimiser tab now shows a calm empty state with 'Optimise Lineup' button; `hasRun` gate prevents auto-compute on tab load; controls remain interactive pre-click; post-click control changes re-trigger silently. `capByPosition(raw, 3)` pure utility caps transfer suggestions at top-3 per element_type bucket in both OptimiserPanel and TransferPanel/OpportunityCostTable; per-position `cap-footnote-{POS}` rendered when bucket exceeds limit. 67/67 Phase 112 tests GREEN. 14/14 must-haves verified. Engine untouched (D-05).

v1.20 Phase 111 complete (2026-05-15) — FIX-01 + FIX-02: Partially-played DGW heatmap cell now surfaces played leg via tooltip suffix `'— Played'` (mixed-state branch in HeatMapRow, 2 new TDD tests). CR-02 fallback-sort hardened in `club-form.ts` (`.sort((a,b) => a.id-b.id)` before `.slice(-1)`, 1 regression test). Position-lock enforced at all 4 `suggestTransfers` call sites with `inPoolByPosition.get(sell.element_type)` + `VALID_ELEMENT_TYPES` guard. 37/37 plan-specific tests GREEN. Score 3/3 must-haves verified.

v1.19 Phase 108 complete (2026-05-14) — NLP-BATCH-01/02/03: Batch AI insight pre-generation pipeline + Blob read-before-generate cache path. `pipeline/batch_insights.py` generates 2–3 sentence Claude insights for top-20 players by xPts and writes to `player_insights/gw{N}/element_{id}.json`. `pipeline/run.py` wired with `INSIGHT_BATCH_ENABLED` gate (non-fatal, top-20 selection, fully skipped when unset). `src/app/api/player-insight/route.ts` now reads Blob before calling Anthropic — cache hit returns pre-generated insight in ~50–150ms with zero Claude spend. 16 vitest + 224 pipeline tests GREEN. NLP-BATCH-03 gap closed via TDD RED→GREEN cycle.

v1.19 Phase 107 complete (2026-05-14) — CACHE-01 + CACHE-02: `system` parameter on both `client.messages.create` calls in `/api/player-insight` changed from `string` to `TextBlockParam[]` with `cache_control: { type: 'ephemeral' as const }`. Cache metrics logged after every successful Claude call (`[player-insight] cache` log line with `attempt`, `cache_creation_input_tokens`, `cache_read_input_tokens`). TDD RED→GREEN cycle: 12/12 tests pass. Caching is structural no-op at ~80 tokens — activates when prompt crosses Anthropic's 1024-token minimum (Phase 108 or organic prompt growth).

v1.19 Phase 106 complete (2026-05-14) — WR-01/02/03/04: Load Squad button now has single `transition-all` (no duplicate transition utilities); `computeDecisionSeverity` returns `LOW` for `candidates.length < 2`; NAV-05 click test extended to all 7 analyse pills (`club-form`, `accuracy`, `price-changes`); WR-03 acknowledged as no-op (Phase 97 D-02 already resolved). 4 tasks, 4 commits, all 25 pre-existing failures unchanged.

v1.18 Phase 105 complete (2026-05-13) — NLP-02: per-player LLM insight route, hook, and UI wired. `POST /api/player-insight` (Node.js, maxDuration=30, two-attempt guardrail, Vercel Blob cache with allowOverwrite:true). `usePlayerInsight` TanStack mutation hook with two-tier localStorage + Blob cache (`playerInsight:{id}:gw{N}` key). `PlayerInsightSection` component with 5 states (idle/loading/error/guardrail-failed/insight). Wired into GemTable mobile+desktop expand rows and TransferPanel → OpportunityCostTable → PlayerMoveCell (buy-candidate rows only). `gw` prop threaded through full prop chain. 43/43 TDD tests GREEN (RED→GREEN cycle across 3 waves). Human UAT approved (Vercel env + Anthropic cap confirmed).

v1.18 Phase 104 complete (2026-05-13) — SENS-01 (already shipped Phase 93) + WHY-01: `computeRejection` wired onto sell side of every OCS row in TransferPanel and DecisionSummaryTab. `OpportunityCostTable` gains two required props (`allPlayers`, `lifecycleLabels`); `PlayerMoveCell` calls `computeRejection(t.sell, ...)` per transfer leg and renders up to 4 zinc-500 reason lines inline below the sell name (always-visible, no toggle). Strong sells render nothing. Both production consumers thread their existing `scoredPlayers`/`lifecycleLabels` memos. 10 tests GREEN (6 updated + 4 new TDD). Human UAT pending.

v1.18 Phase 103 complete (2026-05-13) — CAL-01 + CAL-02: position-aware sparse-bucket thresholds (GK/DEF ≥15, MID/FWD ≥8, all ≥5) + pool guard (hide chart if <50 total obs) in `pipeline/accuracy.py`. New `CalibrationHealthIndicator` component (good/fair/poor tiers, cold-start state, absent-guard) wired into `DecisionSummaryTab` between 4-card grid and ProseSummaryBlock. TS-side `sample_n >= 5` double-filter removed — Python is now single gate. 34 accuracy tests + 9 TDD component tests GREEN. Human UAT pending.

v1.18 Phase 102 complete (2026-05-13) — MC-01 + MC-02: MC gate flipped to `MC_ENABLED = True` in `pipeline/run.py` (10k-sim engine now active on every daily run). New `MCDistributionBar` component (teal fill track, P10/P90 labels, conditional amber Haul% ≥40%) wired into XPtsCell hover card replacing inline text rows. CaptainPicksPanel CandidateRow now shows inline `· P10–P90` range (raw undoubled, muted zinc-400, silent gate-off). GitHub Actions hygiene: anthropic pin 0.98.1, numpy==2.2.3, MC_ITERATIONS/MC_SEED env vars. Human UAT pending next pipeline run. Build clean; 58 mc+columns tests + 26 captaincy tests GREEN.

v1.17 Phase 101 complete (2026-05-12) — GWT-01 + UX-01: GW-targeted transfer scoring engine + UI. `computeGwXpts` TypeScript port of Python `_xpts_per_gw` (DGW sums, BGW=0, correct CS direction). `suggestTransfers` extended with optional `targetGw` routing all 4 scoring sites through `scorePlayer`; denominator=1 for per-GW view. Target GW `<select>` dropdown in TransferPanel OCS header with `availableGws` memo, `disabled={!!targetGw}` GwToggle pills, column-header switch, and "Ranked by GW{N} xPts" sub-label. UX-01: GwToggle labels renamed "Next 1 GW / Next 3 GWs / Next 5 GWs". 88 tests GREEN.

v1.17 Phase 99 complete (2026-05-12) — PGW-03: Dream-team benchmark card in GW Review. `/api/gw-review` fetches `dream-team/{gw}/` in a standalone try/catch; GwReview type extended with `benchmark_score`, `benchmark_label`, `missed_players`; 4th StatCard slot now shows dream-team score with sentiment delta (+N/−N vs you); conditional Missed row lists up to 3 unowned dream-team players. Graceful degradation to FPL average on upstream failure. 21 tests (7 route + 14 component) all GREEN.

v1.17 Phase 97 complete (2026-05-12) — HEAT-01: Fixture Heat Map toggle wired. `ClubFormViewToggle` pill (Form/Heat Map) + `ClubFormTab` wrapper with TDD RED→GREEN (6 tests). `fixture-heat-map` sub-tab removed from page navigation; `club-form` moved from Plan to Analyse. 44 tests passing.

v1.16 Phase 96 complete (2026-05-11) — BACK-01: Captain decision backtester shipped. Pipeline writes `captain_picks_gw{N}.json` to Vercel Blob as a durable snapshot trail. `/api/decision-history` joins snapshots with FPL picks to compute per-GW regret. `useDecisionHistory` hook caches to localStorage (38-entry ring buffer, cache-first). `BackTab` recharts BarChart (red/green bars, y=0 ReferenceLine) + season summary header + per-GW detail table. AccuracyTab restructured with Summary | Calibration | Back pill nav. 22 tests TDD RED→GREEN.

v1.16 Phase 95 complete (2026-05-11) — SPQ-04: Set-piece delivery league table shipped. All 20 PL teams ranked by composite corner+FK danger score. `aggregateSetPieceLeague` pure aggregation library, `SetPieceLeagueTable` ranked table with Insufficient Data section, `SetPieceViewToggle` mobile-visible pill, toggle wired into `SetPieceTakerPanel`. 13 tests (TDD RED→GREEN).

v1.15 started (2026-05-09) — Pipeline Intelligence: Data Health Dashboard (DH-01/02/03) and SPQ pipeline (SPQ-01/02), completing the two features deferred from v1.14.

v1.14 partial (2026-05-09) — Phase 83 (GK save-point projections: Poisson-floor saves math, xPts 6th component, gate persistence, XPtsCell "Saves" row) and Phase 85 (SPQ UI: DeliveryQualityBadge Elite/Good/Weak tier in FK and Corner rows, sp_tier quartile logic in /api/set-pieces) shipped. Phases 82 (Data Health) and 84 (SPQ pipeline) deferred to v1.15.

v1.11 started (2026-05-04) — Insights & Infrastructure milestone: LLM prose summaries, fixture heat map, in-app alerts, event-based pipeline refresh, post-GW review, decision history ROI, transfer regret backtester.

v1.10 planned (2026-05-04) — Modelling & Trust phases 61-65 defined in ROADMAP.md (MC, calibration, versioning, sensitivity, rejection explainer); deprioritised mid-season in favour of v1.11. Work to resume post-season.

v1.9 complete (shipped 2026-05-04) — Competitive Intelligence milestone finished with Phase 60 (Transfer Route Tree). The pure-TypeScript greedy multi-branch engine (`buildTransferRouteTree`) generates 2–3 distinct transfer paths from a squad, presents them in a side-by-side summary table with a "Load into Manual Planner" bridge, and shares a section-level planning horizon across all Plan sub-tabs (D-07 lift: `planHorizon` state in `page.tsx`, `<HorizonSelector>` above Plan nav, horizon prop threaded to PlannerTab + ManualPlanTab + RouteTreeTab). Phase 59 shipped the Manual Transfer Planner: GW-by-GW sequences with live bank balance, FT tracking, hit cost, break-even weeks, squad snapshots, and localStorage persistence. See previous milestone summary below.

v1.8 completed Predictive Intelligence: calibrated per-player xMins probability distributions (start_prob, mins_60_prob), learned bonus EV replacing flat BONUS_RATE, price change predictor with rise/fall confidence tiers, and autosub-legal bench ordering via benchOrder().

v1.7 completed the Decision Assistant: single-screen Decision Summary composing captain picks, transfer opportunity cost, chip timing, and risk flags with High/Medium/Low severity signals. New engines: Fixture Swing Detector, CS% per fixture, explainable xPts breakdown, player lifecycle labels, and Transfer Opportunity Cost Simulator.

v1.6 completed the Squad Optimiser: best starting 11 + bench order + auto formation, configurable 1/3/5 GW horizon, transfer-aware mode, and chip modes (Wildcard, Free Hit, Bench Boost).

v1.3 added the Gameweek Planner: 1–5 GW transfer sequences, fixture-aware scoring, chip timing, per-GW squad snapshots, and manual edit mode.

## Current Milestone: v1.20 Fixes & Decision Quality

**Goal:** Fix 6 data accuracy bugs across GW Review, fixture heatmap, planner, and decision history; add transfer regret backtester; make optimiser on-demand; limit transfer suggestions to top 3 per position.

**Target features:**
- FIX-01–06: Bug sweep — heatmap BGW false-positive for already-played GW, planner cross-position lock, GW Review top scorer points, best bench pts, dream team delta sign, decision history captain delta
- BACK-02: Transfer regret backtester — per-GW what engine recommended vs what you did, with hindsight xPts delta
- OPT-01: Lineup optimiser on-demand — "Optimise Lineup" button replaces auto-calculate on tab load
- TFR-02: Transfer suggestions capped at top 3 candidates per position slot

## Previous Milestone: v1.19 AI Quality & Insight Delivery (Complete 2026-05-14)

**Goal:** Deepen the AI intelligence layer — batch-pre-generate player insights to eliminate latency, wire MC output into calibration, and cut NLP-02 API cost via prompt caching — plus clear the WR backlog.

**Delivered:** Batch insight pre-generation pipeline (top-20 by xPts, `INSIGHT_BATCH_ENABLED` gate, Blob write), Blob read-before-generate in UI route (cache hits zero Claude spend), MC-enabled calibration (haul_prob as predicted_rate, calibration_mode badge), prompt caching plumbing (cache_control ephemeral on system prompt, cache token logging), WR backlog cleared (4 items).

## Previous Milestone: v1.18 Forecast Transparency & AI Intelligence (Complete 2026-05-14)

**Goal:** Surface model confidence and reasoning — Monte Carlo outcome distributions, calibration evidence, sensitivity flags, and rejection explainers — and introduce Claude API per-player prose insights.

**Delivered:** MC gate (10k-sim MC fields live), MCDistributionBar, P10/P90 on captain picks, CalibrationHealthIndicator, fragility badges + rejection reasons on TransferPanel, NLP-02 per-player LLM insight with two-tier cache and name-whitelist guardrail.

## Previous Milestone: v1.17 End-of-Season Intelligence (Complete 2026-05-12)

**Goal:** Surface actionable end-of-season intelligence — fixture heat map, post-GW review, personal decision analytics, GW-targeted transfer advice, and UX polish.

**Target features:**
- HEAT-01: Fixture heat map — all 20 teams × next 8 GWs, colour-coded by difficulty, DGW/BGW highlighted
- PGW-01/02/04: Post-GW review — bench pts left, captain vs optimal, auto-surface after deadline
- PGW-03: Dream-team benchmark card in GW Review
- HIST-01/02/03: Personal decision history — captain hit rate, transfer ROI, chip ROI
- GWT-01: GW-targeted transfer recommendations — per-GW xPts re-rank with target GW selector
- UX-01: xPts temporal labels — "Next 1 GW / Next 3 GWs / Next 5 GWs"

## Core Value

Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.

## Previous State (v1.9 Competitive Intelligence — SHIPPED 2026-05-04)

v1.9 complete — 5 phases (56-60), 13 plans. All four competitive intelligence features delivered: FT Engine Fix (Wildcard FT preservation, bank cap, FTX-01/FTX-02); Effective Ownership Mode (EO% per candidate, 4-mode toggle, Dangerous-to-fade badge, EO-01..EO-04); Mini-League Rival Tracker (p-limit(3) batching, differential engine, RivalsTab, ML-01..ML-08); Manual Transfer Planner (GW-by-GW sequences, bank simulation, MTP-01..MTP-08); Transfer Route Tree (pure-TS greedy multi-branch engine, RouteTreeTab, D-07 section-level horizon lift, TRT-01..TRT-07). See `.planning/milestones/v1.9-ROADMAP.md` (when created).

---

## Previous State (v1.8 Predictive Intelligence — SHIPPED 2026-05-03)

v1.8 complete — 4 phases (52-55), 12 plans. All four predictive intelligence features delivered: xMins Confidence Engine (start_prob, mins_60_prob, sub_risk_label, position-prior fallback, xmins_v2_enabled gate); Bonus Point Predictor (shrinkage estimator, BPS-CS residualisation for GK/DEF, bonus_predictor_enabled gate); Price Change Predictor (cumulative net-transfer snapshots, PriceChangePanel with HIGH/MEDIUM/LOW confidence tiers, 14-day early-data guard); Bench Order Optimiser (benchOrder() EV formula, formation-legality validator, BGW/DGW partition, BB bypass note). See `.planning/milestones/v1.8-ROADMAP.md`.

---

## Previous State (v1.7 Decision Assistant — SHIPPED 2026-05-02)

v1.7 complete — 5 phases (47-51), 14 plans. Full weekly decision engine shipped. All six target features delivered: Fixture Swing Detector with 1/3/5 GW toggle and owned-player highlighting; CS% per fixture (rolling xGA, DGW combined formula); Explainable xPts Breakdown (CSS-only hover card, 5 components + Total); Player Lifecycle Labels (7-label taxonomy with priority cascade); Transfer Opportunity Cost Simulator (Roll/1-FT/2-FT/Hit table, break-even weeks, named player pairs, auto-FT detection); Weekly Decision Summary composing all engines into 4 severity-badged cards, default Squad landing. See `.planning/milestones/v1.7-ROADMAP.md`.

---

## Previous State (v1.6 Squad Optimiser — SHIPPED 2026-05-01)

v1.6 complete — 5 phases (42-46), 12 plans. Full in-browser squad optimiser shipped: `optimiseLineup()` C(15,11) enumeration, configurable 1/3/5 GW horizon, captain/VC selection, ComparisonTable with xPts delta per slot, `suggestTransfers()` transfer-aware engine with hit break-even, and `buildOptimalSquad()` greedy chip engine (Wildcard/Free Hit/Bench Boost). Form signal added to xPts pipeline with accuracy gate. See `.planning/milestones/v1.6-ROADMAP.md`.

---

## Previous State (v1.5 UX & Polish — SHIPPED 2026-04-30)

v1.5 complete (2026-04-30) — All 6 phases shipped: 3-section nav hierarchy (Analyse/Plan/Squad), GemTable view presets (Default/Compact/Analysis), data freshness "Updated X ago" live ticker, player comparison modal, accuracy pipeline backtest, AccuracyTab UI. proj_pts model removed (xPts 16.7% vs proj_pts 9.0% hit rate). 22 files swept. See `.planning/milestones/v1.5-ROADMAP.md`.

Phase 41 complete — Accuracy UI & Model Rationalisation shipped: AccuracyTab (GwSummaryTable + HaulterList + PlayerDeltaTable), useAccuracy hook, /api/accuracy route, last_gw_actual_pts column in GemTable, proj_pts sweep complete.

Phase 40 complete — Accuracy Pipeline shipped: pipeline/accuracy.py with compute_accuracy_backtest() and build_predictions_snapshot(), wired into run.py, accuracy_backtest.json written to cache.

Phase 39 complete — Player Comparison Modal shipped: PlayerComparisonModal (native dialog, 4 sections: xPts, Gem breakdown, fixtures, signals), createColumns(onCompare) factory, mobile action sheet, comparePlayer state at page.tsx.

Phase 38 complete — Data Freshness UX shipped: `formatRelativeTime(isoTimestamp, nowMs?)` pure utility added at `src/lib/formatRelativeTime.ts` — four time bands per D-01 ("just now" / "X min ago" / "X hours ago" / "X days ago") with injected `nowMs` for deterministic testing (13 Vitest cases, TDD RED→GREEN). `LastUpdated.tsx` upgraded: `LastUpdatedDisplay` now accepts `relativeTime: string` (pre-formatted, DAT-02 split preserved); connected `LastUpdated` ticks every 30s via `setInterval`, clears on unmount, effect deps `[data?.last_updated]`. Stale colour: amber (`text-amber-600 dark:text-amber-500`), fresh: zinc (`text-zinc-400`). No "Data as of" prefix, no "(stale)" suffix. 11 RTL tests (display, colour, fake-timer tick, unmount cleanup spy); 397 total pass. FRE-01, FRE-02, FRE-03 satisfied. Human verified on all sections and sub-tabs, desktop and mobile.

Phase 37 complete — GemTable View Presets shipped: `ViewPreset = 'default' | 'compact' | 'analysis'` type and `PRESET_COLUMN_VISIBILITY` maps (17/9/7 hidden columns) exported from `GwToggle.tsx`; `getColumnVisibility` extended with optional `preset` third param (default `'default'`); mobile path bypasses preset entirely (isMobile guard first). New `PresetToggle.tsx` segmented button component (desktop-only, `hidden sm:flex`); `GemTable.tsx` accepts `preset`/`onPresetChange` props, wires `getColumnVisibility(gwHorizon, isMobile, isMobile ? 'default' : preset)`; `gemPreset` state lifted to `page.tsx` above conditional render for session persistence (GEM-04). 12 vitest tests for preset logic; 373 total pass. GEM-01 through GEM-04 satisfied.

Phase 36 complete — Navigation Consolidation shipped: flat 8-tab nav replaced with 3-section hierarchy (Analyse / Plan / Squad). `src/app/page.tsx` exports `Section`, `SubTab`, `SECTIONS` constant; nested state model (`activeSection` + `sectionMemory` Record) implements per-section sub-tab memory (D-05) and default Analyse→Gem Ratings landing (D-06). Desktop two-tier nav: section row + conditional sub-tab row (hidden for Squad). `src/components/nav/MobileNav.tsx` imports shared SECTIONS from page.tsx; renders pill row above section bar (pill row hidden when Squad active). CR-01 fix: all sub-tab content blocks dual-guarded with `activeSection !== 'squad' && activeSubTab === X`. 14 new tests; 362 total pass. NAV-01 through NAV-05 satisfied.

## Previous State (v1.4 Analytics Engine — SHIPPED 2026-04-29, all 10 phases complete)

Phase 35 complete — Tech Debt Fixes shipped: `pipeline/merge.py` BGW exclusion guard added to both the position-median build loop (`if xpts_val:`) and the flag-assignment loop (`if not p.get('xPts_1gw'): continue`); TRAP gate predicate changed from `not above_median` to strict `xpts_1gw < position_median`; `_player_patterns` in `insights.py` guards all four out.append() blocks with `if sample_n_X > 0:`; `upload_json` signature corrected to `data: list | dict`; `MOBILE_HIDDEN_COLUMNS` key renamed `signal` → `regression_signal`; `InsightsTab.test.tsx` empty-state mock cast to `Insight[]`; `ChipStrategyPanel.tsx` bestGw guard documented with invariant comment. All 7 audit items (WR-01–WR-07) resolved; 8/8 must-haves verified.

Phase 34 complete — Chip Strategy shipped: `src/lib/chip-strategy-engine.ts` (422 lines) implements pure `computeBBScore`, `computeTCScore`, `computeFHResult` functions scoring the next 5 GWs by fixture ease (ease = 1 - attacking_difficulty); `buildClubFormMap` helper; `GWEaseScore`/`FHResult`/`FHSquadPlayer` types; `BGW_NEUTRAL_EASE=0.5` / `TC_CANDIDATE_COUNT=3` constants; 28 unit tests covering all 5 common pitfalls. `useChipHistory(teamId)` TanStack Query hook (6h staleTime, numeric `/^\d+$/` guard for T-34-01). `ChipStrategyPanel` (302 lines) renders 3 chip rows (BB/TC/FH) with 5-cell ease bars, best-GW green ring, FH expand-on-click 15-player squad table, used-chip opacity-40 state; mounted as first child of PlannerTab space-y-6 with useClubForm. CHIP-01, CHIP-02, CHIP-03 satisfied.

Phase 33 complete — Insights Tab shipped: `pipeline/insights.py` (431 lines) computes 11+ pattern statements across 4 categories (defensive CS rates, attacking goal-share, player regression/differential signals, captaincy haul stats) with `MIN_SAMPLE_TOTAL=10` sample floor and `_TRIVIAL_PATTERN_IDS` exclusion set; wired into `pipeline/run.py` (writes `insights.json` after `captain_picks.json`); seeded `pipeline/cache/insights.json` as `[]` so `/api/insights` never 500s on fresh checkout; `Insight` TypeScript interface (6 fields per D-12) in `src/lib/types.ts`; `/api/insights` route (USE_BLOB toggle, clone of captain-picks pattern); `useInsights` hook (6h staleTime, `Insight[]`); `InsightsTab` component with four category sections, HIGH/MEDIUM/LOW tier badges (green/amber/zinc), HTML title tooltip (em-dash format), loading/error/empty states, footnote; Insights button added to desktop nav (between Set Pieces and Value Gems) and MobileNav (8 buttons); 11 component tests. INS-01, INS-02, INS-03, INS-04 satisfied.

Phase 32 complete — Team Target List shipped: `pipeline/merge.py` writes `expected_goals` and `expected_assists` (FPL StatsBomb season totals, float, zero-guard) to every player dict; `MergedPlayer` declares both as non-optional `number`; `src/lib/xgi.ts` exports `computeXgiInvolvement` (two-pass team-share aggregation, zero-division guard); `FixtureEaseRankingPanel` extended with green TARGET badge (teams with 4+ fixtures `attacking_difficulty < 0.5` of next 5), keyboard-operable expand-on-click, inline top-3 player table (columns: Player/Pos/xGI%/xPts/Signal/Diff), single-open invariant. TGT-01, TGT-02, TGT-03 satisfied.

Phase 31 complete — Captaincy Ceiling shipped: `_compute_captain_picks()` helper in `pipeline/merge.py` computes ceiling (max `xPts_90th_1gw` among `status='a'` players) and EO-adjusted picks (threshold ladder 25%→35%→ceiling fallback via `_safe_float(selected_by_percent)`); `xPts_90th_1gw` persisted per-player in `merged_players.json` (D-11, Z=1.28); `captain_picks.json` written by `run.py` alongside `merged_players.json`; `/api/captain-picks` route (USE_BLOB toggle); `useCaptainPicks` hook (6h staleTime); `CaptainPicksPanel` two-card component with locked UI-SPEC Tailwind tokens and copy; mounted on Gems tab below GemTable. CAP-03 and CAP-04 satisfied.

Phase 30 complete — Differential Tracker shipped: `_compute_differential_flag()` in `pipeline/merge.py` computes `differential_flag` per player using position-relative median of `xPts_1gw` per `element_type` (GK/DEF/MID/FWD); DIFF gate (D-03): above-median xPts + owned <5% + status='a'; TRAP gate (D-04): below-median xPts + owned >15%, status-agnostic (D-12 asymmetry); field absent when neither fires (D-05); `MergedPlayer` extended with `differential_flag?: 'diff' | 'trap' | null`; `DifferentialBadge` renders green DIFF pill / amber TRAP pill / em-dash with D-10 ownership % tooltips; `Diff` column added to GemTable after Signal with `{diff:0,trap:2}` sort; hidden on portrait mobile. TMPL-01, TMPL-02 satisfied.

Phase 29 complete — Regression Detector shipped: `_compute_regression_signal()` in `pipeline/merge.py` computes buy/sell signals from FPL element-summary xG/xA (last-5-unique-rounds window, 900-min gate, ±0.5 threshold; D-01/D-02: uses FPL StatsBomb data, not Understat); `MergedPlayer` extended with `regression_signal` and `actual_vs_xg_delta` fields; `RegressionSignalBadge` component renders green BUY pill / amber SELL pill / em-dash; Signal column added to GemTable after xPts_5gw with custom sort (BUY-first ascending); hidden on portrait mobile. All 3 Phase 29 requirements (DATA-03, REG-01, REG-02) satisfied.

Phase 28 complete — xPts Engine shipped: Poisson/Bernoulli xPts pipeline (goal, assist, CS, bonus components); `XPtsCell` with component breakdown tooltip; variance/ceiling indicators; xPts_1gw/3gw/5gw columns in GemTable. All 3 Phase 28 requirements (DATA-02, XPTS-01, XPTS-02) satisfied.

Phase 27 complete — FDR++ pipeline and UI shipped: `pipeline/merge.py` now emits `attacking_difficulty` and `defensive_difficulty` per fixture (3-game goals-scored rolling window, non-inverted); `computeClubForm()` mirrors the math and returns 6 ease aggregates per team (`attacking_ease_{1,3,5}gw`, `defensive_ease_{1,3,5}gw`); `FixtureEaseRankingPanel` ranks all 20 PL teams by fixture ease on the Club Form tab with ATT/DEF + 1/3/5 GW pill toggles. All 3 Phase 27 requirements (DATA-01, FIX-01, FIX-02) satisfied. Existing `difficulty_score` untouched.

Phase 26 complete — Set-piece intelligence layer shipped: "Set Pieces" tab in nav, `SetPieceTakerPanel` showing penalty/FK/corner takers per PL team, `SetPieceChangeAlert` amber banner for taker changes between pipeline runs, `LandscapeTip` on Gems and DefCon for mobile portrait UX. Pipeline extended with `_text` fields (DATA-04) and `_diff_sp_snapshots` snapshot diff producing `set_piece_changes.json`. All 4 Phase 26 requirements (SP-01, SP-02, MOB-LS-01, DATA-04) satisfied.

v1.3 complete — Full Gameweek Planner shipped: "Planner" tab in nav, 1–5 GW horizon selector, `generatePlan()` greedy + look-ahead engine, `TransferPlanTable` with chip toggles and DGW/BGW badges, per-GW `SquadSnapshotRow` accordion, and manual edit mode via `PlayerPickerModal` + `generatePlanFrom()` re-scoring. All 14 v1.3 requirements satisfied across 7 phases, 14 plans.

**Tech stack:** Next.js 16, React 19, TypeScript, TanStack Table v8, TanStack Query, Tailwind CSS v4, Vitest, immer/use-immer, Python (requests, pandas, soccerdata), Vercel Blob

**Codebase:** ~11,600 LOC (Phase 26 adds ~288 lines), ~200+ files

**What's running:**
- `/` — Gem Ratings tab (default), DefCon tab, Squad tab, Club Form tab, Value Gems tab, Set Pieces tab
- `/api/players` — merged FPL+Understat dataset from Vercel Blob
- `/api/defcon` — DefCon stats from pipeline cache
- `/api/club-form` — club form computed from fixtures
- `/api/set-pieces` — set-piece taker changes from pipeline cache (new in Phase 26)
- `/api/last-updated` — timestamp of last pipeline run
- `pipeline/run.py` — daily refresh via GitHub Actions cron (confirmed operational)

## Requirements

### Validated (v1.0)

**Data Pipeline & API Layer**
- ✓ FPL proxy Route Handler — server-side CORS-free fetches via `/api/fpl/[...proxy]` — v1.0
- ✓ Zod validation adapter — structured failure on field changes, stale-cache fallback — v1.0
- ✓ 825-entry `player_id_map.json` (782 matched, 43 null Understat entries) — v1.0
- ✓ Python pipeline: FPL + Understat xG/xA merged, per-90 normalised, custom FDR — v1.0
- ✓ `GET /api/players` from Vercel Blob, `usePlayers()` with 6h stale time — v1.0
- ✓ `cost_change_event` / `cost_change_start` fields in pipeline and `MergedPlayer` type — v1.0

**Gem Rating Table** — v1.0
- ✓ `computeAllGemScores` scores every player across 7 dimensions with min-max normalisation
- ✓ Null xG/xA excluded from composite (not zero-filled); displayed as em-dash
- ✓ Sortable/filterable TanStack Table at `/`, position filter, component scores per row

**DefCon Analysis** — v1.0
- ✓ Per-match hit rates from `element-summary` (DEF=10, MID/FWD=12 per-match thresholds)
- ✓ `pipeline/defcon.py` + `defcon_stats.json`, two position-split sortable tables

**Squad View & Transfer Suggestions** — v1.0
- ✓ Team ID input → squad split by position (GK/DEF/MID/FWD) with price, own%, mins, flags
- ✓ Transfer engine: position lock, approximate budget, chip guard, save recommendation
- ✓ Ranked by Gem delta; affordable suggestions sorted before unaffordable

**Club Form, Value Gems & Polish** — v1.0
- ✓ `computeClubForm()` rolling 5-game window, DGW-safe
- ✓ `isCheapGem` / `isLowOwned` filter predicates; Value Gems tab with filter pills
- ✓ `PriceTrendCell` on GemTable, ValueGemsTable, TransferPanel (NaN guards: `?? 0`)
- ✓ `FixtureBadges` (next 5, colour-coded H/A) on Club Form + Gem Ratings
- ✓ `LastUpdated` component (amber when stale), `tier()` inversion fixed

### Validated (v1.1)

- ✓ PROJ-01/02/03: Projected points next 1/3/5 GW per player (Python pipeline) — v1.1
- ✓ MINS-01: Expected minutes and start probability per player — v1.1
- ✓ MINS-02: Rotation risk badge (Nailed / Likely start / Rotation risk / Cameo) — v1.1
- ✓ MINS-03: Transfer suggestions de-prioritise rotation-risk buy candidates — v1.1
- ✓ PROJ-04: Projected points columns in GemTable (sortable, 1/3/5 GW toggle) + TransferPanel — v1.1
- ✓ REC-01: Buy / Hold / Sell recommendation per squad player — v1.1
- ✓ REC-02: Replacement shortlist with projected points delta for Sell candidates — v1.1
- ✓ CAP-01/02: Captaincy rankings — top-5, safe vs upside, projected captain points — v1.1
- ✓ EXP-01/02: Explainability panel with natural-language reasons + risk flags — v1.1
- ✓ AUTH-01/02: Optional FPL session-cookie login, exact sell prices and bank balance — v1.1

### Validated (v1.2)

- ✓ MOB-NAV-01/02/03: Fixed bottom tab bar on mobile (5 tabs, CSS-only show/hide, iOS safe area) — v1.2
- ✓ MOB-LAY-01/02: Single-column layout at 375px, no horizontal overflow on any tab — v1.2
- ✓ MOB-TOUCH-01/02/03: 44px tap targets, 16px input fonts, active:scale-95 feedback — v1.2
- ✓ MOB-TBL-01: GemTable 5-column mobile view (Player, Pos, Gem, Proj Pts, Risk) — v1.2
- ✓ MOB-TBL-02/03/04: DefConTables, ClubFormTable, ValueGemsTable column hiding on mobile — v1.2
- ✓ MOB-TBL-05: Sticky Player column in GemTable and SquadView on mobile — v1.2
- ✓ MOB-TBL-06: Tap-to-expand row detail panel in GemTable — v1.2
- ✓ MOB-COMP-01/02/03: Transfer cards 2-row layout, login form stacking, captaincy 2-col grid — v1.2
- ✓ MOB-POL-01/02: Sticky GemTable filter bar, back-to-top button — v1.2
- ✓ DAT-01: GitHub Actions cron confirmed operational, /api/last-updated Blob read path live — v1.2
- ✓ DGW-01/02: DGW-aware transfer engine tier, DGW labels in FixtureBadges/CaptaincyPanel — v1.2
- ✓ DARK-01/02/03: Tailwind v4 class-based dark mode, FOUC prevention, ThemeToggle, all components — v1.2

### Validated (v1.3)

- ✓ DQ-01: Players without Understat xG/xA use FPL goals/assists as proxy in Gem score — v1.3
- ✓ DQ-02: DefCon threshold raised to 5 games; "Insufficient data" reserved for genuine edge cases — v1.3
- ✓ VG-01: Pipeline computes pts_last3gw and pts_last5gw per player from FPL element-summary history — v1.3
- ✓ VG-02: Value Gems table shows Total Pts, Pts (last 5 GW), Pts (last 3 GW) columns — v1.3
- ✓ AUTH-03: User can log in to FPL via modal-based guided token entry with step-by-step Chrome DevTools guide — v1.3
- ✓ AUTH-04: Manual cookie entry supported with clipboard paste button as friction reducer — v1.3
- ✓ PLAN-01: User can set a planning horizon of 1–5 gameweeks — v1.3
- ✓ PLAN-02: System auto-suggests an optimal transfer sequence for the chosen horizon — v1.3
- ✓ PLAN-03: Transfer sequence scored by projected pts delta, fixture difficulty, DGW/BGW awareness, -4pt hit cost — v1.3
- ✓ PLAN-04: User can manually edit the suggested sequence (swap players in/out per GW step) — v1.3
- ✓ PLAN-05: Output shows a transfer-by-transfer table (GW | Out | In | Cost | Projected gain) — v1.3
- ✓ PLAN-06: Output shows a squad snapshot for each gameweek in the plan — v1.3
- ✓ PLAN-07: Chip timing (Wildcard, Free Hit, TC, BB) is visible and configurable in the plan — v1.3
- ✓ PLAN-08: Planner accessible via "Planner" tab in the navigation bar — v1.3

### Validated (v1.5)

- ✓ NAV-01/02/03/04/05: 3-section nav hierarchy (Analyse/Plan/Squad) with sub-tabs — v1.5
- ✓ GEM-01/02/03/04: GemTable view presets (Default/Compact/Analysis), session-persistent — v1.5
- ✓ FRE-01/02/03: "Updated X ago" live ticker on every tab, amber stale colour — v1.5
- ✓ CMP-01/02/03/04/05/06: Player comparison modal (xPts, Gem, fixtures, signals) from GemTable — v1.5
- ✓ ACC-01: Accuracy pipeline backtest (5 GWs, proj_pts vs xPts hit rates) — v1.5
- ✓ ACC-02/03/04/05/06: AccuracyTab UI, last-GW actuals column, proj_pts removed (9.0% vs xPts 16.7%) — v1.5

### Validated (v1.6)

- ✓ OPT-01/02/03/04/05: Lineup optimiser — best 11 + bench, 1/3/5 GW horizon, captain/VC, BGW exclusion — v1.6
- ✓ NAV-01 (v1.6): Squad sub-tabs (Transfers | Optimiser), MobileNav pill row — v1.6
- ✓ CMP-01/02/03 (v1.6): Current vs optimised comparison table, xPts delta per slot, headline change count — v1.6
- ✓ TFR-01/02/03: Transfer-aware mode — 1–2 FT suggestions, hit break-even indicator — v1.6
- ✓ CHIP-01/02/03: Wildcard/Free Hit/Bench Boost chip modes — `buildOptimalSquad()` greedy engine — v1.6
- ✓ ACC-01/02/04 (v1.6): xPts form signal (BLEND_ALPHA=0.4), accuracy gate in pipeline, mid-tier track — v1.6
- ⚠ ACC-03 (v1.6): Gate logic ships; production hit-rate validation pending live pipeline run — v1.6

### Validated (v1.7)

- ✓ CS-01/02/03: CS% per fixture from rolling xGA; DGW combined formula; GemTable Analysis column — v1.7
- ✓ SWG-01/02/03/04: Fixture Swing Detector — buy/sell signals, 1/3/5 GW toggle, owned-player highlight — v1.7
- ✓ XPT-01/02/03/04: Explainable xPts Breakdown — component hover card (appearance+goals+assists+CS+bonus), sum integrity, CS grounded in fixture — v1.7
- ✓ LCL-01/02/03: Player Lifecycle Labels — 7-label taxonomy, pure TS over MergedPlayer, priority cascade — v1.7
- ✓ OCS-01/02/03/04/05: Transfer Opportunity Cost Simulator — Roll/1-FT/2-FT/Hit table, break-even weeks, named pairs, FT count auto-detection — v1.7
- ✓ WDS-01/02/03/04/05: Weekly Decision Summary — 4-card single screen, priority order, severity badges, no-squad degradation, DGW/BGW context flags — v1.7

### Validated (v1.8)

- ✓ MIN-01: xMins Confidence Engine — start_prob, mins_60_prob, sub_risk_label, xmins_v2_enabled gate — v1.8
- ✓ BPS-01: Bonus Point Predictor — shrinkage estimator, BPS-CS residualisation, bonus_predictor_enabled gate — v1.8
- ✓ PRC-01: Price Change Predictor — net transfer velocity, PriceChangePanel, HIGH/MEDIUM/LOW tiers — v1.8
- ✓ BENCH-01: Bench Order Optimiser — benchOrder() EV, formation-legality, BGW/DGW rules, BB bypass — v1.8

### Validated (v1.9)

- ✓ FTX-01/02: FT Engine Fix — Wildcard FT preservation, 4-FT bank cap, authenticated event_transfers seeding — v1.9
- ✓ EO-01/02/03/04: Effective Ownership Mode — EO% per candidate, 4-mode toggle (Max xPts/Protect Rank/Chase Rank/Differential Aggressive), Dangerous-to-fade badge — v1.9
- ✓ ML-01/02/03/04/05/06/07/08: Mini-League Rival Tracker — useRivals with p-limit(3), rival-intel.ts differential engine, RivalsTab/RivalSummaryTable/RivalDetailPanel — v1.9
- ✓ MTP-01/02/03/04/05/06/07/08: Manual Transfer Planner — GW-by-GW sequences, bank simulation, FT tracking, hit cost, squad snapshots, caveat banner, localStorage persistence — v1.9
- ✓ TRT-01/02/03/04/05/06/07: Transfer Route Tree — pure-TS greedy multi-branch engine, RouteTreeTab summary + expand, recommended highlight, bridge to Manual Plan, horizon recompute — v1.9
- ✓ D-07: Section-level horizon lift — planHorizon state in page.tsx, shared HorizonSelector above Plan sub-tab nav, horizon prop threaded to PlannerTab + ManualPlanTab + RouteTreeTab — v1.9

### Validated (v1.18)

- ✓ MC-01: Monte Carlo gate activation — `MC_ENABLED = True` in `pipeline/run.py`; `MCDistributionBar` (haul%, P10/P90) in XPtsCell hover card — v1.18
- ✓ MC-02: P10/P90 range on CaptainPicksPanel CandidateRow (raw undoubled, zinc-400, gate-off silent) — v1.18
- ✓ CAL-01: Calibration sparse-bucket fix — position-aware thresholds (GK/DEF ≥15, MID/FWD ≥8, pool guard <50 obs); Python single gate; TS double-filter removed — v1.18
- ✓ CAL-02: `CalibrationHealthIndicator` (good/fair/poor, cold-start, absent-guard) on Decision Summary tab — v1.18
- ✓ SENS-01: FragilityBadge on TransferPanel buy candidates (robust=silent, fragile=dot, knife_edge=pill) — v1.18
- ✓ WHY-01: `computeRejection` on sell side of every OCS row — up to 4 reason lines always-visible below sell name — v1.18
- ✓ NLP-02: Per-player LLM insight (`claude-haiku-4-5-20251001`, on-demand, two-tier cache, name-whitelist guardrail) in GemTable expand + TransferPanel buy rows — v1.18

### Validated (v1.19)

- ✓ NLP-BATCH-01: Pipeline pre-generates insights for top-20 players by `xPts_1gw` → Vercel Blob (`player_insights/gw{N}/element_{id}.json`) — v1.19
- ✓ NLP-BATCH-02: `INSIGHT_BATCH_ENABLED` env var gates batch independently of daily pipeline — v1.19
- ✓ NLP-BATCH-03: `/api/player-insight` reads Blob before calling Anthropic — cache hits ~50-150ms, zero Claude spend — v1.19
- ✓ MC-CAL-01: Calibration uses MC `haul_prob` as `predicted_rate` (gated by `mc_enabled`); `calibration_mode` written to `accuracy_backtest.json` — v1.19
- ✓ MC-CAL-02: `CalibrationHealthIndicator` renders teal `MC` / zinc `Analytical` mode badge — v1.19
- ✓ CACHE-01/02: `/api/player-insight` system prompt wrapped as `TextBlockParam[]` with `cache_control: ephemeral`; cache token metrics logged — v1.19
- ✓ WR-01/02/03/04: Load Squad button uses single `transition-all`; captain severity `LOW` for `<2 candidates`; NAV-05 extended to 7 pills — v1.19

### Active (v1.20)

- [ ] **FIX-01**: User sees current-GW fixture correctly when team has already played mid-week (no false BGW on heatmap)
- [ ] **FIX-02**: Transfer planner only suggests players of the same position as the player being transferred out
- [ ] **FIX-03**: GW Review top scorer displays actual points earned alongside player name
- [ ] **FIX-04**: GW Review best bench displays actual bench points (not 0)
- [ ] **FIX-05**: GW Review dream team delta shows correct sign (positive when dream team beats user score)
- [ ] **FIX-06**: Decision history captain delta displays actual points difference per GW (not dashes)
- [ ] **BACK-02**: User can view per-GW transfer regret — what the engine recommended vs what was done, with hindsight xPts delta
- [x] **OPT-01**: Lineup optimiser shows empty state with "Optimise Lineup" button; calculation only runs on explicit trigger — Validated Phase 112 (2026-05-15)
- [x] **TFR-02**: Transfer suggestions show at most 3 candidates per position slot — Validated Phase 112 (2026-05-15)

### Out of Scope

- Live in-match updates — data refreshes daily, not during gameweeks
- Mobile app — web only (responsive web covers the mobile use case)
- Automated chip timing recommendations — chip visibility in plan is in-scope; chip strategy analysis (finder) is now in v1.4; fully automated auto-timing remains out
- Offline mode — daily refresh is sufficient

## Context

- **FPL API**: Official undocumented API at `https://fantasy.premierleague.com/api/`
- **Understat**: Shot-level xG/xA via soccerdata Python library
- **DefCon rule**: 2025/26 season. DEF threshold=10 defensive contributions, MID/FWD threshold=12. Award=+2 pts.
- **Transfer rules**: Position-locked. Free transfers accumulate to 2/week; extra cost 4 pts each.
- **Auth**: Session-cookie auth (not OAuth). Team ID only for public API; optional login for exact prices.
- **Dark mode**: Tailwind v4 `@custom-variant dark` with `.dark` class on `<html>`; localStorage persistence; FOUC prevented by inline script in `<head>`.

## Constraints

- **Auth**: FPL login uses session-cookie auth — handle securely, nothing persistent
- **Data**: Understat scraping needs rate limiting / caching
- **API**: FPL API undocumented — adapter layer isolates breakage
- **Single user**: Personal tool — no multi-tenancy, no DB required
- **Refresh**: Once-daily sufficient; no real-time requirements

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Custom FDR from rolling xGA (not official integers) | Official FDR doesn't reflect actual team strength | ✓ Good — produces meaningful difficulty tiers |
| `merged_players.json` as single source of truth | One schema for all downstream UI phases | ✓ Good — prevented type drift across 6 phases |
| No database for v1 | Single-user tool; cached JSON sufficient | ✓ Good — no infra overhead |
| Zod 4 unknown-field stripping | Zod 4 strips by default — no `.strip()` needed | ✓ Good — simpler adapter code |
| `parseFPLBootstrap` wraps `safeParse` | Callers decide throw-vs-stale-cache | ✓ Good — flexible error handling per context |
| USE_BLOB env var for Blob vs local cache routing | Dev/prod parity without Blob credentials locally | ✓ Good — smooth dev workflow |
| `usePlayers` single query key `['players']` with 6h stale | Prevents duplicate fetches across tabs | ✓ Good — single request per session |
| Page.tsx as client component (Phase 4) | Both GemTable and DefConTables are client components; server wrapper adds no benefit | ✓ Good — simpler tab state management |
| Transfer sort: affordable before unaffordable, then gem_delta desc | Actionable suggestions first | ✓ Good — user sees what they can actually do |
| `tier()` return-value swap (Phase 6 gap) | Thresholds were correct; only return labels were swapped | ✓ Fixed — Man City now shows red (hard) |
| `?? 0` guards for `cost_change_event/start` | Fields absent from older cached data; Math.abs(undefined)=NaN | ✓ Fixed — price trend never shows NaN |
| CSS-only mobile nav show/hide (`sm:hidden` / `hidden sm:flex`) | No JS state for nav visibility — CSS media query is simpler and avoids hydration issues | ✓ Good — zero flash on resize |
| TanStack `columnVisibility` for mobile column hiding | Reuses existing TanStack Table state; no new abstraction needed | ✓ Good — consistent pattern across 4 tables |
| Tailwind v4 `@custom-variant dark` with `.dark` class (not media query) | Manual toggle requires class-based switching; v4 `@custom-variant` is the correct primitive | ✓ Good — FOUC prevention script works cleanly |
| FOUC prevention: inline script in `<head>` with `suppressHydrationWarning` | Must run before first paint; React hydration ignores HTML/body attribute mismatch | ✓ Good — no white flash even on slow connections |
| AuthModal always in DOM (not conditionally rendered) | Prevents `showModal()` null ref on first open; native dialog pitfall | ✓ Good — consistent pattern reused in PlayerPickerModal |
| `dialog::backdrop` via globals.css (not Tailwind `backdrop:` prefix) | Tailwind v4 `backdrop:` support unverified in this config; CSS rule is guaranteed | ✓ Good — works across Chrome, Firefox, Safari |
| Greedy + 1-level look-ahead (LOOK_AHEAD_DISCOUNT=0.8) for planning engine | Sufficient for personal-use planning; no deep recursion needed | ✓ Good — fast and produces sensible plans |
| `positionsAfter: Record<number, number>` (not Map) on PlanStep | Keeps PlanStep JSON-serializable for any future persistence | ✓ Good — plain object passed cleanly through Immer |
| `readonly originalSteps: PlanStep[]` frozen via `structuredClone` | Compile-time protection against Immer accidentally mutating the plan baseline | ✓ Good — caught mutation bugs at the type level |
| useImmer for PlannerTab chip toggle + planResult state | Safe nested mutation without manual spread-copy for complex nested state | ✓ Good — `updatePlanResult` recipe pattern reused across markers |
| Pure TS enumeration for optimiser (C(15,11)=1,365 subsets, <1ms) | No WASM solver needed; `glpk.js` ruled out (WASM issues in Next.js, ~1MB bundle) | ✓ Good — fast, zero-dependency, fully testable |
| `optimiseLineup` extended via `chipMode` param, not forked | Chip modes share the same engine; no parallel code path to maintain | ✓ Good — Wildcard/Free Hit/BB all resolved in one call |
| Form signal gated by `form_signal_enabled` in `accuracy_backtest.json` | Never blend without measurable improvement; gate prevents regression | — Pending — production pipeline run needed to confirm |
| `suggestTransfers()` 2-FT gain uses additive approximation | Full `optimiseLineup` re-run per combo not warranted for personal tool | ✓ Good — fast enough; minor accuracy loss acceptable |
| `changeCount` via set-difference (not pairSection row count) | Avoids overcounting when xPts sort reshuffles pairs within same position | ✓ Good — fixed in execution after spec inconsistency caught |
| `isPromoted` uses `currentId` (player who moved from bench to XI) | Plan spec had inversion; corrected during execution | ✓ Fixed — caught by TDD test assertions |
| Test fixtures require valid single-GK formations (4-3-3, 5-3-2) | `optimiseLineup` is deterministic only with valid formations; 2-GK-in-XI fixtures aren't | ✓ Good — prevents flaky test failures |
| D-07: `planHorizon` lifted to `page.tsx`, single section-level HorizonSelector | Three Plan sub-tabs sharing horizon state via local selectors caused sync bugs; single source of truth eliminates drift | ✓ Good — all sub-tabs (PlannerTab/ManualPlanTab/RouteTreeTab) receive horizon prop; D-07 sync effect in ManualPlanTab mirrors prop → localStorage |
| TRT bridge chip `null` constant (D-09) | ChipToggle in RouteTreeTab deferred (RESEARCH.md A3); bridge always writes `chip: null` per step | ✓ Good — engine-level TRT-06 satisfied; UI ChipToggle deferred to v1.12 |
| `MC_ENABLED = True` as named constant in `run.py` (v1.18) | Named constant inside try block overrides sticky-read pattern for permanent gate flips — consistent with other gate defaults at lines 188–193 | ✓ Good — no downstream accuracy.py changes needed; sticky-read self-sustains after first write |
| NLP-02 on-demand trigger only, never `useEffect` (v1.18) | Cost explosion risk: 50 rows × 900 tokens × 4 sessions × 180 days ≈ USD 16–32/season from one bug | ✓ Good — `useMutation` + explicit button; two-tier cache eliminates repeat spend |
| NLP-02 Node.js runtime, never Edge (v1.18) | `@anthropic-ai/sdk` SSE parsing fails on Edge per anthropics/anthropic-sdk-typescript#292 | ✓ Good — `maxDuration = 30`, non-streaming `messages.create` only |
| Name-whitelist guardrail with structured fallback (v1.18) | LLM hallucination prevention — two-attempt guardrail; fallback to `reasons[]` array on both failures | ✓ Good — deterministic, never shows hallucinated content |
| Python single sparse-bucket gate for calibration (v1.18) | TS double-filter caused false confidence when Python had already filtered; single authority in pipeline | ✓ Good — AccuracyTab TS filters removed entirely |
| `INSIGHT_BATCH_ENABLED` env var gate defaults false (v1.19) | Batch runs on every daily pipeline and can generate unexpected Anthropic spend; gate allows controlled rollout | ✓ Good — cost stays predictable; Anthropic Console monthly cap remains defence-in-depth ceiling |
| Blob read-before-generate inserted before Anthropic client construction (v1.19) | Inserting after `new Anthropic()` would still call the constructor on cache hits, failing the zero-constructor-calls test contract | ✓ Good — auto-deviation from plan satisfied both the cache-first intent and the TDD contract |
| `calibration_mode` written per-run to `accuracy_backtest.json` (v1.19) | Allows UI to distinguish MC vs analytical calibration without hardcoding the flag; legacy cache degrades gracefully via `undefined` | ✓ Good — `CalibrationHealthIndicator` handles undefined silently |
| `maxDeviation` uses `predicted_rate` not `bucket_mid` (v1.19 D-11 fix) | `bucket_mid` is the bucket centre, not the model's prediction — in MC mode they diverge and the wrong field caused incorrect tier assignment | ✓ Fixed — corrective in MC mode, behaviour-preserving in analytical mode |

---

## Context

**Tech stack:** Next.js 16, React 19, TypeScript, TanStack Table v8, TanStack Query, Tailwind CSS v4, Vitest, immer/use-immer, Python (requests, pandas, soccerdata, anthropic), Vercel Blob, Anthropic Claude API

**Codebase:** ~30,000 LOC (~24,500 TypeScript + ~5,500 Python), ~460+ files

**What's running (v1.18):**
- `/` — Gem Ratings tab (default), DefCon tab, Squad tab (Decision | Transfers | Optimiser sub-tabs, Decision is default), Club Form tab, Value Gems tab, Set Pieces tab, Insights tab, Accuracy tab
- `/api/players` — merged FPL+Understat dataset from Vercel Blob (includes cs_prob_1gw, xPts_components_1gw, MC fields: blank_prob/haul_prob/p10_pts/p90_pts)
- `/api/accuracy` — accuracy backtest data including form signal gate, calibration data, mc_enabled flag
- `/api/player-insight` — on-demand Claude Haiku insight per player (Node.js, two-attempt guardrail, Vercel Blob cache)
- Decision Summary — composes all v1.7 engines + CalibrationHealthIndicator + ProseSummaryBlock + OpportunityCostTable with WHY-01 reasons
- GemTable expand rows — show PlayerInsightSection after ComparisonSearch (on demand)
- TransferPanel OCS — OpportunityCostTable with fragility badges (buy), rejection reasons (sell), PlayerInsightSection (buy candidates)
- `pipeline/run.py` — daily refresh via GitHub Actions cron; MC_ENABLED=True; 10k sims per player per GW

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-15 — Phase 112 complete. OPT-01 + TFR-02 shipped. 1 phase remaining in v1.20 (Phase 113: Transfer Regret Backtester).*
