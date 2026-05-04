# Milestones

## v1.9 Competitive Intelligence (Shipped: 2026-05-04)

**Phases completed:** 5 phases (56-60), 13 plans
**Timeline:** 2026-05-03 → 2026-05-04 (2 days)
**Files changed:** 121 files, +27,865 / −1,388 lines

**Key accomplishments:**

1. FT Engine Fix (Phase 56): `Math.min(1, currentAvailable - 1)` Wildcard bank preservation + `initialFTState` useMemo — FTX-01/FTX-02
2. Effective Ownership Mode (Phase 57): top-5 EO% ranked captain panel, 4-mode EOModeToggle, Dangerous-to-fade badge — EO-01..EO-04
3. Mini-League Rival Tracker (Phase 58): `useRivals` with `p-limit(3)` batching, `rival-intel.ts` differential engine, `RivalsTab` — ML-01..ML-08
4. Manual Transfer Planner (Phase 59): GW-by-GW transfer sequences, bank/FT simulation, localStorage persistence, hit break-even — MTP-01..MTP-08
5. Transfer Route Tree (Phase 60): `buildTransferRouteTree` pure-TS engine, `RouteTreeTab` expandable tree, "Load into Manual Planner" bridge — TRT-01..TRT-07
6. D-07 Section-Level Horizon Lift: `planHorizon` lifted to `page.tsx`; single `HorizonSelector` shared across PlannerTab, ManualPlanTab, RouteTreeTab

---

## v1.8 Predictive Intelligence (Shipped: 2026-05-03)

**Phases completed:** 4 phases (52-55), 12 plans
**Timeline:** 2026-05-02 → 2026-05-03 (2 days)

**Key accomplishments:**

1. xMins Confidence Engine (Phase 52): calibrated `start_prob`, `mins_60_prob`, `sub_risk_label` per player; `xmins_v2_enabled` gate — MIN-01
2. Bonus Point Predictor (Phase 53): per-player `bonus_ev` shrinkage estimator (empirical mean + position prior, ≥4 starts gate); `bonus_predictor_enabled` flag — BPS-01
3. Price Change Predictor (Phase 54): daily rise/fall predictions from cumulative net-transfer snapshots; HIGH/MEDIUM/LOW confidence tiers; `PriceChangePanel` — PRC-01
4. Bench Order Optimiser (Phase 55): `benchOrder()` EV-ranked autosub-optimal bench (start_prob × xPts); BGW/DGW rules; BB bypass note — BENCH-01

---

## v1.7 Decision Assistant (Shipped: 2026-05-02)

**Phases completed:** 5 phases (47-51), 14 plans
**Timeline:** 2026-05-01 → 2026-05-02 (2 days)
**Files changed:** 323 files, 88 commits

**Key accomplishments:**

1. Fixture Swing Detector (Phase 47): `swing_*gw` deltas, `cs_prob_1gw` per fixture (DGW formula: `1-(1-p1)*(1-p2)`), `FixtureSwingDetector` panel — CS-01..03, SWG-01..04
2. Explainable xPts Breakdown (Phase 48): `appearance_pts` component in xPts breakdown; CSS-only hover card on `XPtsCell`; mobile toggle — XPT-01..04
3. Player Lifecycle Labels (Phase 49): 7-label taxonomy with priority cascade (`computeLifecycleLabel`); `LifecycleLabelBadge` in `TransferPanel` — LCL-01..03
4. Transfer Opportunity Cost Simulator (Phase 50): Roll/1-FT/2-FT/Hit table; `computeOpportunityCostRows`; break-even weeks; `derivedFtCount` heuristic — OCS-01..05
5. Weekly Decision Summary (Phase 51): 4-card Decision tab (Captain/Transfer/Chip/Risk); `computeDecisionSeverity`; Decision sub-tab as default Squad landing (D-10) — WDS-01..05

---

## v1.6 Squad Optimiser (Shipped: 2026-05-01)

**Phases completed:** 5 phases (42-46), 12 plans
**Timeline:** 2026-04-28 → 2026-05-01 (4 days)
**Files changed:** 68 files, +17,511 / −646 lines

**Key accomplishments:**

1. xPts form signal: recency-weighted xG+xA per-90 (BLEND_ALPHA=0.4, 5-GW window) gated by accuracy backtest — `form_signal_enabled` gate in `accuracy_backtest.json` — Phase 42
2. Pure TS lineup optimiser: C(15,11)=1,365 subset enumeration (<1ms), configurable 1/3/5 GW horizon, captain/VC selection (`xPts_90th_1gw`), BGW exclusion — Phase 43
3. Squad navigator: Transfers+Optimiser sub-tabs; `teamId` lifted to `page.tsx`; `OptimiserPanel` pitch UI (FPL convention: FWD/MID/DEF/GK rows) — Phase 43
4. Comparison table: current vs optimised side-by-side; xPts delta pill per changed row; HeadlineRow with formation + change count + gain; Promoted/Dropped bench badges — Phase 44
5. Transfer-aware mode: `suggestTransfers()` pure engine (1-FT and 2-FT, FREE+HIT variants); `FtToggle` pill; hit break-even GW indicator — Phase 45
6. Chip modes: `buildOptimalSquad()` greedy engine (100m budget, 3-per-club cap); Wildcard/Free Hit/Bench Boost via `ChipModeToggle` 4-button pill; `ChipSquadView` position-grouped display — Phase 46

---

## v1.5 UX & Polish (Shipped: 2026-04-30)

**Phases completed:** 6 phases (36-41), 14 plans
**Timeline:** 2026-04-29 → 2026-04-30 (2 days)
**Files changed:** 87 files, +10,652 / −453 lines

**Key accomplishments:**

1. 3-section navigation hierarchy (Analyse / Plan / Squad) replacing flat 8-tab nav — NAV-01 through NAV-05
2. GemTable view presets (Default / Compact / Analysis) with 3 named column maps and session-persistent state — GEM-01 through GEM-04
3. Data freshness "Updated X ago" live ticker on every tab — `formatRelativeTime()` + 30s interval tick — FRE-01 through FRE-03
4. Player comparison modal: side-by-side xPts/Gem/fixtures/signals for any two players from GemTable rows — CMP-01 through CMP-06
5. Accuracy pipeline backtest: `compute_accuracy_backtest()` over last 5 GWs; xPts 16.7% vs proj_pts 9.0% hit rate — ACC-01
6. AccuracyTab UI + last-GW actuals column in GemTable; proj_pts model removed from entire codebase (22 files swept) — ACC-02 through ACC-06

---

## v1.3 Gameweek Planner (Shipped: 2026-04-03)

**Phases completed:** 7 phases, 14 plans, 19 tasks
**Timeline:** 2026-04-02 → 2026-04-03 (2 days)
**Files changed:** 32 files, +4,276 / −44 lines

**Key accomplishments:**

1. xG/xA proxy from FPL goals/assists for all unmatched players, DefCon threshold raised to 5 games, pts_last3gw/pts_last5gw pipeline fields — all v1.3 data quality gaps closed
2. Native `<dialog>` AuthModal with step-by-step Chrome DevTools guide, clipboard paste button, and three-state expiry display (normal/expiring-soon/expired) — replaces inline token form
3. Foundational planner type system and pure free transfer engine (31 TDD tests covering banking, wildcard reset, free hit, hit costs) — "Planner" tab wired into desktop and mobile nav with HorizonSelector
4. `generatePlan()` pure function with greedy + 1-level look-ahead (LOOK_AHEAD_DISCOUNT=0.8), DGW/BGW fixture scoring, hit cost threshold — PLAN-02 and PLAN-03 satisfied with 17-test TDD suite
5. `TransferPlanTable` with chip toggles, DGW/BGW badges, plan value headline — wired into PlannerTab via useImmer state management
6. `positionsAfter: Record<number, number>` on PlanStep + `SquadSnapshotRow` accordion — 15-player per-GW squad view with position grouping and transfer highlighting
7. `generatePlanFrom()` re-scoring engine, `PlayerPickerModal` (native dialog, position-filtered), pencil/undo icons — full manual edit mode with per-row overrides and forward re-scoring

---

## v1.2 Mobile (Shipped: 2026-04-01)

**Phases completed:** 6 phases, 12 plans, 20 tasks

**Key accomplishments:**

- Fixed bottom tab bar (MobileNav) with CSS-only show/hide pattern, iOS safe area viewport contract, and single-column layout guarantee at 375px
- 44px tap targets, 16px mobile input fonts, and active:scale-95 feedback applied to PositionFilter, GwToggle, GemTable headers, and TransferPanel — completing Phase 13 mobile touch compliance with visual checkpoint approved
- GemTable mobile-responsive: 5-column view on phones with sticky Player column and tap-to-expand row detail panel showing all 15 hidden columns as labelled key-value pairs
- SquadView reduced to 4-column mobile layout (Player, Price, Risk, Rec) with sticky Player column and dynamic ExplainPanel colSpan, matching Phase 14 isMobile pattern
- DefConTables, ClubFormTable, and ValueGemsTable reduced to 4-5 priority columns on mobile via TanStack VisibilityState, matching the GemTable pattern from Phase 14
- One-liner:
- One-liner:
- Blob-aware /api/last-updated route using @vercel/blob list() pattern, mirroring /api/players for production timestamp freshness — GitHub Actions cron confirmed operational
- Transfer engine (DGW-01):
- Tailwind v4 @custom-variant dark + FOUC-prevention inline script + ThemeToggle button wired to localStorage and .dark class on <html>
- One-liner:
- MinsRiskBadge.tsx

---

## v1.1 Decision Engine (Shipped: 2026-03-31)

**Phases completed:** 6 phases, 15 plans, 18 tasks

**Key accomplishments:**

- defcon.py refactored as pure computation module accepting pre-fetched summaries dict; new xmins.py computes xmins/start_prob/mins_risk for all players using locked status-gated classification
- One-liner:
- VerdictBadge and CaptaincyPanel surfaced to user in TransferPanel — Buy/Hold/Sell badges in SquadView Rec column, ranked captaincy picks with projected captain pts, safe/upside type, and mins risk below squad.
- Pure `computeExplanations(player: ScoredPlayer): string[]` function mapping all D-03 signals to natural-language reasons with 20 Vitest tests green
- Expandable player rows in SquadView showing natural-language reasons and replacement shortlist for Sell players, with per-player chevron toggle and bench exclusion
- One-liner:
- Inline FPL login form with TanStack Query auth hooks delivering exact sell prices (£X.Xm) and tilde-prefixed approximate prices (~£X.Xm) toggled by auth state, without gating any squad features

---

## v1.0 MVP (Shipped: 2026-03-29)

**Phases completed:** 6 phases, 19 plans (+ 1 gap-closure)
**Timeline:** 2026-03-27 → 2026-03-29 (3 days)
**Codebase:** ~6,600 LOC (TypeScript + Python), 166 files changed

**Key accomplishments:**

1. Next.js scaffold with FPL proxy Route Handler, Zod validation adapter, Vercel Blob caching, and 825-entry FPL-to-Understat player ID map
2. Python pipeline combining FPL API + Understat xG/xA with custom FDR (rolling xGA), per-90 normalisation, and GitHub Actions daily cron
3. Composite Gem Rating engine (7 dimensions) with min-max normalisation — sortable/filterable TanStack table at `/`
4. DefCon Analysis: per-match hit rates from element-summary history, position-split tables (DEF=10, MID/FWD=12 thresholds)
5. Squad View with Team ID input and Transfer Engine (position lock, budget enforcement, chip guard, save-transfer recommendation)
6. Club Form tab, Value Gems tab with filter pills, price trend columns, FixtureBadges, and LastUpdated banner

**Known Gaps:**

- DAT-01: Automated daily pipeline refresh — `pipeline/run.py` exists and GitHub Actions workflow is scaffolded but daily scheduling was not verified as operational for v1. Candidate for v1.1.

---
