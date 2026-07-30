# UIX-01 Feature Inventory (keep-all-features contract)
**Generated 2026-06-12 from code inspection — every item below must survive the overhaul.**

Scope: `src/app/page.tsx`, all 27 sub-tab components, `src/components/**`, `src/lib/hooks/`, MobileNav.
Structure: 3 sections (Analyse 12 tabs, Plan 9 tabs, Squad 6 tabs) = **27 sub-tabs**.

---

## Global chrome

Everything in `src/app/page.tsx` outside the tab content, plus app-level components:

- **Header**: "FPLx" wordmark (Honk display font, 5xl). On mobile the header row also holds BellNotificationButton + ThemeToggle (`sm:hidden`); header scrolls away.
- **DeadlineBanner** (`src/components/DeadlineBanner.tsx`): countdown banner "GW<n> deadline in Xh Ym", 60s tick, urgency tiers — neutral (≥24h), amber (2–24h), red (<2h, becomes sticky z-50). Dismiss (×) persists per GW via localStorage `deadline-dismissed:GW<N>`; resets on GW change. `aria-live="polite"`. Data: `useNextDeadline` → `/api/fpl/bootstrap-static/`.
- **Sticky nav wrapper** (top-0 z-40, backdrop blur): two desktop pill rows (`hidden sm:flex`):
  - **Section nav**: Analyse / Plan / Squad pill buttons, `aria-current="page"` on active, min-h-44px touch targets.
  - **Sub-tab row**: pills for the active section's sub-tabs.
  - Right side of section nav: **LastUpdated** + **BellNotificationButton** + **ThemeToggle**.
- **Section memory** (D-05): `sectionMemory` state remembers the last sub-tab per section — switching sections does NOT reset the sub-tab.
- **Plan-section HorizonSelector** (D-07): "Planning Horizon" + `HorizonSelector` rendered at section level only when Plan is active (separate desktop/mobile layouts, testids `plan-section-horizon`/`plan-section-horizon-mobile`). Shared `planHorizon` state (1–5) consumed by Planner, Manual Plan, Route Tree, Rank Sim, Wildcard. Initialised from the persisted manual plan (`loadManualPlan()`), default 3.
- **FPL team-ID state lift** (Phase 43 D-11): `teamId` / `submittedId` live in page.tsx, initialised from localStorage `fpl_team_id`; `handleTeamIdSubmit` trims, writes localStorage, sets `submittedId`. Threaded into Decision, Transfers, Optimiser, Lineup, Review, Live, Club Form, Accuracy, Season, Rivals, Manual Plan, Route Tree, Rank Sim, Planner (CaptainPicksPanel), Wildcard.
- **Watchlist state lift** (Phase 127 D-10): `useWatchlist()` (localStorage-backed `watchlistIds` + `toggleWatchlist`) lives in page.tsx, shared by GemTable and WatchlistTab.
- **Compare modal state lift**: `comparePlayer`/`compareOpen` in page.tsx; `PlayerComparisonModal` rendered at page level outside `<main>`, opened from GemTable rows.
- **Auto-surface Review** (Phase 98 PGW-04): `useSettledGws` effect — when a new GW settles and localStorage `pgw-reviewed:GW<N>` is unset, navigates to Squad > Review once per GW and writes the flag synchronously.
- **DecisionErrorBoundary**: class error boundary wrapping only DecisionSummaryTab; renders red error card with the crash message and "please report" text.
- **MobileNav** (`src/components/nav/MobileNav.tsx`): bottom-fixed mobile nav (desktop nav is `hidden sm:flex`, this is the mobile counterpart). Top mini-bar: LastUpdated + ThemeToggle. Middle: horizontally scrollable sub-tab pill row for the active section (uses `mobileLabel` short labels from SECTIONS). Bottom: 3 equal-width section buttons (Analyse/Plan/Squad), active filled. `nav-safe-bottom` notch safety. Receives activeSection/activeSubTab/onSectionChange/onSubTabChange.
- **ThemeToggle** (`src/components/theme/ThemeToggle.tsx`): 🌙/☀️ dark-mode toggle; toggles `dark` class on `<html>`, persists localStorage `theme`; hydration-safe initial read; aria-label.
- **LastUpdated** (`src/components/LastUpdated.tsx`): "● Updated <relative>" badge, amber ⚠ variant when stale; re-formats every 30s; `useLastUpdated` → `/api/last-updated`; returns null when unavailable. Split into pure `LastUpdatedDisplay` + connected `LastUpdated`.
- **BellNotificationButton** (`src/components/push/BellNotificationButton.tsx`): 🔔 popover with push-subscription toggle switch (`role="switch"`); permission states granted/denied/default/unsupported with sentiment text/colors; switch disabled when denied/unsupported/loading; Escape + click-outside dismiss. Backed by push subscription flow → `/api/push/subscribe` (send paths: `/api/push/send`, dev `/api/push/test-send`).
- **PushServiceWorkerRegistrar** (`src/components/push/PushServiceWorkerRegistrar.tsx`): registers `/sw.js` on mount, renders nothing, warns silently on failure.
- **Layout**: `max-w-7xl` main, `max-sm:pb-24` clearance for MobileNav, overflow-x hidden.

---

## Analyse section (12 tabs)

### Gem Ratings (`gems`, gem-table/GemTable.tsx)
Master player-scoring table: all players ranked by composite gem_score (value, form, fixtures, ownership, minutes, set pieces, xG/xA), sortable on every metric column, with expandable rows exposing rejection reasons, AI insight, fragility, news, head-to-head comparison and watchlist pinning. The single richest surface in the app.

- **Interactions**: position filter (All/GK/DEF/MID/FWD); view PresetToggle (Default/Compact/Analysis, desktop-only, drives `PRESET_COLUMN_VISIBILITY`); GwToggle horizon 1/3/5 GW (drives which xPts column shows; supports `disabled` for FH mode); click-to-sort all columns with asc/desc triangles; row click expands — mobile inline (rejection panel, ComparisonSearch, news section, FragilityBadge, AI insight, confirmed-signing badge, watchlist star pin as FIRST element per D-16, Compare/Dismiss action sheet), desktop expand below; back-to-top floating button (mobile, appears past 1 viewport); LandscapeTip portrait warning; dynamic column visibility per preset+horizon+mobile (`MOBILE_HIDDEN_COLUMNS`).
- **Data**: `usePlayers` → `/api/players`; `useAccuracy` → `/api/accuracy` (last settled GW header label + `news_flag_enabled` gate); `useTransferNews` → `/api/transfer-news` (confirmedSigningMap, Phase 125 WIN-02).
- **Cross-tab**: opens page-level PlayerComparisonModal via `onCompare`; watchlist pin shares state with Plan > Watchlist; row-level ComparisonSearch (Phase 94 WHY-01-B) shows the other player's exclusive rejection reasons.
- **Sub-components**: PositionFilter, GwToggle, PresetToggle, VarianceBadge (⬆/= ceiling-vs-floor on xPts), RegressionSignalBadge (BUY/SELL), DifferentialBadge (DIFF/TRAP), RoutePillsCell (PK/FK/CK + xG/xA pills), BonusEvCell, MCDistributionBar (in xPts hover card), FragilityBadge, PlayerInsightSection (on-demand LLM insight, Phase 105 NLP-02), ConfirmedSigningBadge, RowExpandNewsSection (severity-coded news + relative time, gated by news flag), RejectionPanelInline (WHY-01 "Why not recommended" / green no-signals state), ComparisonSearch, LandscapeTip.

### Weekly Picks (`picks`, weekly-picks/WeeklyPicksTab.tsx)
Top-10 picks ranked by xPts in two side-by-side tables (Next GW, Next 3 GWs), with an honesty-first ConfidenceStrip (top-10 mean pts, haul capture %, captain return rate; labelled live vs 2025/26-validated by `n_gws >= 8`) and an "Under the radar" strip of highest-xPts sub-10%-owned players. Off-season shows the strip plus "Picks return when season starts."

- **Interactions**: row click expands to xPts component breakdown stacked bars (goals/assists/CS/bonus/appearance/saves/DefCon) + MCDistributionBar when MC stats present; haul-probability column (1-GW table only); DifferentialBadge per pick; ⚠ status flag for d/i/s/n players.
- **Data**: `usePlayers` → `/api/players`; `useAccuracy` → `/api/accuracy` (HonestMetrics).
- **Sub-components**: ConfidenceStrip, PicksTable, ExpandedPanel, UnderTheRadar, FixtureBadges.

### Insights (`insights`, insights/InsightsTab.tsx)
Layered intelligence feed: a sticky DecisionSummary (top-3 highest-confidence insights distilled to action + player/team entity pills), a "This Gameweek" GW Intel collapsible (4 card types: Position Opportunity, Rotation Risk, DGW/BGW, Fixture Run with 3-GW XptsTrajectoryBar), then 5 collapsible categories of season-long pattern insights (Priority — top 5 by confidence — Defensive, Attacking, Player-Specific, Captaincy).

- **Interactions**: 5 CollapsibleSections with count badges (▼/▶); per-card collapsible Methodology `<details>` (sample n, GW coverage, confidence %); metric-vs-benchmark progress bar with benchmark tick; signal badges (Strong signal/Hidden gem/Watchlist/Weak signal/Trap risk/Regression risk).
- **Data**: `useInsights` → `/api/insights`; `useGWIntel` → `/api/gw-intel`. GW Intel section always renders (GWI-05) with loading/error/empty states.
- **Sub-components**: DecisionSummary (sticky at `var(--nav-height)`), GWIntelSection, CollapsibleSection, InsightCard (5-zone), PositionOpportunityCardView, RotationRiskCardView, DGWBGWCardView, FixtureRunCardView, XptsTrajectoryBar.

### DefCon Analysis (`defcon`, defcon/DefConTables.tsx)
Two sortable defensive-contribution tables: Defenders (threshold 10) and Mid/Forwards (threshold 12). Columns: Player, Team, Hit Rate %, Hits (n/games), Avg DC/90, Distance-to-Threshold (color-coded: green exceeds / red short), Easy-vs-Hard fixture split (or "Insufficient data" under 5 games).

- **Interactions**: column-header sorting (default hit_rate desc); mobile hides hits/distance/fixture-correlation columns; LandscapeTip on mobile portrait.
- **Data**: `useDefCon` → `/api/defcon`.

### Set Pieces (`set-pieces`, set-pieces/SetPieceTakerPanel.tsx)
Set-piece taker assignments per PL team in two views toggled by SetPieceViewToggle: "Takers" card grid (20 teams × {Penalties, Direct FK, Corners} with "Changed" badges and Elite/Good/Weak delivery-quality badges, team-level RotationRiskBadge, crest watermark) and "League Table" (ranked composite delivery score, Corner/FK/n columns with responsive hiding, corner-taker name, plus an Insufficient Data team list). Amber SetPieceChangeAlert banner when taker-order changes detected.

- **Data**: `useSetPieces` → `/api/set-pieces`; `usePlayers` → `/api/players` (team rotation-risk map, Phase 80 GWI-01).
- **Sub-components**: SetPieceTakerCard, TakerRow, DeliveryQualityBadge (native title tooltip with xG sample), SetPieceChangeAlert, SetPieceLeagueTable, TeamCrest fallback.

### Club Form (`club-form`, club-form/ClubFormTab.tsx)
Club fixture analysis with two views (ClubFormViewToggle: Form / Heat Map). **Form**: (1) Fixture Ease Ranking — clubs ranked by fixture ease with EaseBar, ATT/DEF toggle, 1/3/5 GW GwToggle, TARGET badge for 4+ favourable fixtures, expandable rows showing top-3 players by xGI involvement (Player/Pos/xGI%/xPts/Signal/Diff); (2) Fixture Swing Detector — 4 improving + 4 worsening teams (swing ≥ ±0.20), "You own N" badges and expandable owned-player tables when an FPL ID is loaded; (3) Club Form Table — last-5 W/D/L/GS/GC/GD + next-5 FixtureBadges, sortable, default wins desc. **Heat Map** (FixtureHeatMap): teams × GWs difficulty grid, 8/12/16-GW HorizonToggle, ATT/DEF toggle, Owned-rows filter toggle (disabled without team ID), green/amber/red tiers, BGW grey cells, DGW split-gradient cells with † marker, owned-team rows highlighted blue.

- **Data**: `useClubForm` → `/api/club-form`; `usePlayers` → `/api/players`; `useSquad` → `/api/squad/{teamId}` (owned highlighting).
- **Cross-tab/FPL-ID**: receives `submittedId`; gates owned-team highlighting, "You own N", Owned filter.

### Accuracy (`accuracy`, accuracy/AccuracyTab.tsx + accuracy/BackTab.tsx)
Model backtester with 4 inner sub-tabs (Summary / Calibration / Back / Versions) plus an always-visible DataHealthPanel. **Summary**: sortable GW summary table with row-expand drill-down (Haulers + Flagged Misses), sortable season Haulers list (≥10 pts), sortable PlayerDeltaTable (prediction error, default biggest misses first). **Calibration**: position pill filter (All/GK/DEF/MID/FWD), two Recharts calibration charts (decile haul-rate vs y=x; xPts-mean) with custom tooltips and sparse-data overlays. **Back** (FPL-ID-aware): captain regret BarChart + table ("Log in to see" placeholders without ID), transfer regret chart + table, Chip ROI list (BB/TC/FH vs season average), hit break-even tracking table (✓/✗). **Versions**: model formula version history with hit-rate badges, deltas, active-gate pills, "cold start" label.
- **DataHealthPanel** (Phase 82/91/92): expandable status pill (All OK/Warnings/Errors/Unavailable), 7-entry sparkline, sanity-check table, null-count stats, artifact timestamps; refetches every 60s; renders even when accuracy fetch fails.
- **Data**: `useAccuracy` → `/api/accuracy`; `useDataHealth` → `/api/data-health`; `useDecisionHistory(teamId)` → `/api/decision-history?teamId=` (localStorage ring buffer); `useSeasonAnalytics(teamId)` → `/api/season-analytics?teamId=`.
- **FPL-ID gating**: only the Back sub-tab uses `teamId`; main accuracy data is global.

### Season (`season`, season-review/SeasonReviewTab.tsx)
Season scorecard: 6-metric summary grid (Overall Rank, Total Points, Captain Hit Rate, Transfer Net ±, Best GW, Worst GW), Decision Quality grade card (A–D from captain EV 40% / hit break-even 35% / chip ROI 25%, chip component renormalised when no chips played per D-06, with mandatory methodology note), and a Recharts season points line chart (your score solid vs average manager dashed, amber chip-GW dots r=6, custom tooltip with rank + chip name).

- **Data**: `useSeasonReview(teamId)` → `/api/season-review?teamId=`; `useSeasonAnalytics`; `useDecisionHistory`. Shares decision-history/season-analytics caches with Accuracy > Back.
- **FPL-ID gating**: fully gated — "Enter your FPL Team ID to see your Season Review" empty state.

### Summer Window (`window`, news/SummerWindowTab.tsx)
Transfer-news feed with dual AND-logic filter pill groups: classification (All/Confirmed/Rumour/Injury/Rotation, Phase 125 WIN-01) and source tier (All/Official/Reliable/Speculative, Phase 131 SPEC-03, separated by divider). Articles sorted newest-first with external title links, source badges ([SKY]/[BBC]), tier badges, relative timestamps; stale articles (>21d) at 40% opacity; amber stale-feed banner when scrape >24h old; filtered-empty message; "not available yet" envelope handling (`isNotAvailable`).

- **Data**: `useTransferNews` → `/api/transfer-news`.

### Price Reset (`price-reset`, price-reset/PriceResetTab.tsx)
Season-start price reset list: PlayerDeltaRow cards (name, team, current cost, ±£ delta pill green/red) plus conditional "Value Targets" section (price fell AND xPts above position median, with position rank label). "Prices not yet published" seasonal gate. No sort/filter controls.

- **Data**: `usePriceReset` → `/api/price-reset`.

### Price Changes (`price-changes`, price-changes/PriceChangePanel.tsx)
Predicted price risers/fallers in two sections, each sorted by confidence desc. Per-row: name/team/cost, HIGH/MEDIUM/LOW confidence tier badge (suppressed until ≥14 snapshot days, with early-data disclaimer banner, D-06), confidence % + progress bar, ETA label ("Tonight" / "N days").

- **Data**: `usePriceChanges` → `/api/price-changes`.

### Perfect GW (`perfect-gw`, perfect-gw/PerfectGWTab.tsx)
Hindsight best-XI for any settled GW. GW selector with prev/next buttons (bounded by settled GWs, defaults to latest). Two inner tabs (role=tablist): **⚽ Perfect XI** — pitch view (green gradient pitch, formation rows FWD→GK, PlayerCard with shirt image, CAPT marker, price, points; BudgetBanner green within / amber over budget; formation + cost + total-points footer) and **📊 Top Scorers** — 4-column position grid of top-5 by live points with top-player highlight. Guards: "No completed gameweeks yet", "GW in progress" (requires finished + data_checked).

- **Data**: `useBootstrap` → `/api/fpl/bootstrap-static/`; `useLiveGwPoints(gw)` → `/api/fpl/event/{gw}/live/`; `computePerfectXI` client-side.
- **Sub-components**: PerfectGWPitch, TopScorersTable, PlayerCard, BudgetBanner.

---

## Plan section (9 tabs)

All Plan tabs except Value Gems / Next Season / Watchlist consume `submittedId`; Planner, Manual Plan, Route Tree, Rank Sim and Wildcard consume the shared section-level `planHorizon`.

### Planner (`planner`, planner/PlannerTab.tsx + captaincy/CaptainPicksPanel.tsx)
Auto-generated multi-week transfer plan from the loaded squad via greedy engine, with per-step chip toggles and manual overrides. Page renders **CaptainPicksPanel** directly beneath it (captain picks for the next GW; `useCaptainPicks` → `/api/captain-picks`, squad-aware via submittedId).

- **Interactions**: Generate Plan button (disabled until squad + players loaded); TransferPlanTable per-step rows (GW with DGW/BGW hints, chip column hidden on mobile, Out/In, −4 hit cost in red, gain split by chip type); click Out cell → PlayerPickerModal manual swap that recalculates downstream steps; "Restore suggested" revert; per-step ChipToggle (WC/FH regenerate squad via `generateChipStep`, BB adds bench value, TC adds captain premium); SquadSnapshotRow expand/collapse per step (XI grid + bench, 📌 on transferred-in players); help accordion explaining chips.
- **Data**: `usePlayers`, `useSquad(teamId)` → `/api/squad/{teamId}`, `useMyTeam` → `/api/fpl/my-team` (authenticated selling_price), `useAuthStatus` → `/api/auth/status`, `useClubForm`; engines `generatePlan`/`generatePlanFrom`/`generateChipStep` (`@/lib/planning-engine`), `computeAllGemScores`.
- **Sub-components**: TransferPlanTable, ChipStrategyPanel (+BB/TC detail panels), ChipToggle, PlayerPickerModal, SquadSnapshotRow.

### Manual Plan (`manual-plan`, planner/ManualPlanTab.tsx)
User-driven week-by-week transfer builder with 2-stage picker (sell from squad → buy from PlayerPickerModal filtered by position/budget with canAfford flag), live bank + FT-burn tracking, per-hit break-even, summary header (total hits, hit cost, avg break-even or ∞), per-step chip toggles and SquadSnapshotRow accordions. Persists to localStorage `fplx_manual_plan`; receives routes loaded from Route Tree (D-08/D-09 bridge). Unauthenticated caveat banner (approximate sell prices, D-13). Team-ID input form when no squad. Reset Plan (with confirm) and per-row remove buttons. Horizon prop syncs with persisted plan (D-07).

- **Data**: `usePlayers`, `useSquad(submittedId)`, `useMyTeam`, `useAuthStatus`; `deriveStepStates`/`computeManualPlanSummary`/`loadManualPlan`/`persistManualPlan` (`@/lib/manual-plan`).

### Route Tree (`route-tree`, planner/RouteTreeTab.tsx)
2–3 algorithmic transfer routes (paths A/B/C) ranked by net xPts, each row showing transfer count, hit cost, net xPts, chips-consumed pill (or "All preserved"), green "Recommended" badge, and a **"Load into Manual Planner"** button (confirm dialog if a plan with transfers exists; persists via `persistManualPlan` then calls `onSwitchSubTab('manual-plan')` — the app's one programmatic tab navigation). Expandable per-path GW-by-GW breakdown table (GW, sell, buy, FT bank, Free/Hit badge, xPts contribution; em-dash hold steps). Local chip-mode toggle rescopes the tree; empty-state callout; unauth caveat banner; Team-ID form.

- **Data**: same squad/player/auth hooks as Manual Plan; `buildTransferRouteTree` (`@/lib/transfer-route-tree`).

### Rank Sim (`rank-sim`, planner/RankSimTab.tsx)
5-GW rank-trajectory fan chart (Recharts ComposedChart: mean line + p10/p90 confidence band, dark-mode erase-fill) for the current XI, with optional 1-transfer alternative overlay (dashed amber). 3-stat header: current rank, P(rank gain), P(rank drop) via beat-the-average heuristic. Sell dropdown (starting XI) → buy dropdown (same position, excludes squad, xPts-sorted, "(can't afford)" flags); Clear comparison button; custom tooltip hides band series. Horizon prop accepted but fixed at 5 GWs (D-06).

- **Data**: `usePlayers`, `useSquad`, `useMyTeam`, `useAuthStatus`, `useEntryRank(submittedId)` → `/api/fpl/entry/{teamId}/`, `useGwAverage` → `/api/gw-average`; `computeXITrajectory`/`computeXIPerGwStats`/`computeBeatTheAverageProb` (`@/lib/rank-sim`).

### Value Gems (`value-gems`, value-gems/ValueGemsTable.tsx)
Budget-value player table (TanStack) with filter pills — Cheap (<£6m) / Low-owned (<10%) / All — sortable columns with ▲▼ indicators, default gem_score desc, sticky header, mobile hides 6 columns, LastUpdated footer. No FPL-ID dependency.

- **Data**: `usePlayers`; `computeAllGemScores`; `isCheapGem`/`isLowOwned` (`@/lib/value-gems`).

### Rivals (`rivals`, rivals/RivalsTab.tsx)
Mini-league rival tracker. League-ID form (numeric validation with red warning, persists localStorage `fplx_mini_league_id`). Rival summary table (rank, manager name, color-coded rank gap vs you, captain and chips-remaining columns hidden on mobile); click a rival to open detail panel: position-grouped squad list, position-medians comparison (yours vs league median), up to 3 suggested transfers with xPts gain, EO-adjusted captain edge callout. Capped at first 20 rivals with truncation note.

- **Data**: `useRivals(leagueId, submittedId)` — composes FPL proxy calls `/api/fpl/bootstrap-static/`, `/api/fpl/leagues-classic/{leagueId}/standings/`, per-rival `/api/fpl/entry/{id}/event/{gw}/picks/` + `/api/fpl/entry/{id}/history/` (NO dedicated /api/rivals route); `useSquad(submittedId)`; `usePlayers`; `computePositionMedians`/`suggestTransfers`/`computeEOCandidates`.

### Next Season (`next-season`, next-season/NextSeasonPlannerTab.tsx)
Pre-season squad builder. Budget slider £80–120m (0.5m steps, 300ms-debounced commit, feasibility gradient track from `min_feasible_budget_greedy`); Live/Awaiting activation status pill (Phase 128 AUTO-03) + dismissible first-activation banner (localStorage `fplx_nsp_activation_seen_{seasonId}`, D-03); FormationGrid (formation, budget used, ILP/Greedy solver badge, position sections + dimmed bench, ppm title tooltips per D-06); greedy health indicator paragraph (3 variants, D-08); infeasible-budget message; 3 ArchetypeCard squads (label, formation, cost, ranked captain options, position-grouped players); GW1–8 fixture-difficulty section currently a deferred placeholder ("Fixtures not yet published for next season."). Read-only; global (no FPL ID).

- **Data**: `usePreSeasonSquad({includeInputs:true})` → `/api/pre-season-squad?include=inputs`; `usePreSeasonActive` → `/api/pre-season-active`; `buildPreSeasonSquad`/`buildPreSeasonArchetypes` client-side.

### Watchlist (`watchlist`, watchlist/WatchlistTab.tsx)
Grid (2-col mobile / 3-col desktop) of WatchlistPlayerCards for players pinned via the GemTable star. Per card: squad-overlap dot (in pre-season squad, D-12), 48h lineup-news amber border + badge (D-13), confirmed-signing hover tooltip (WATCH-02), departed-player grey state (in watchlist but no longer in /api/players, D-09). Sorted GK→DEF→MID→FWD then alphabetical, departed last. Empty state instructs "Tap ⭐ on any player in Gem Ratings"; skeleton loading; error state.

- **Data**: lifted `watchlistIds`/`toggleWatchlist` (`useWatchlist`, localStorage); `usePlayers`; `useLineupNews` → `/api/lineup-news`; `usePreSeasonSquad`; `useTransferNews` (+ `buildConfirmedSigningMap`).
- **Note**: `toggleWatchlist` is received but voided — unpin-from-card is reserved, not shipped.

### Wildcard (`wildcard`, planner/WildcardBuilderTab.tsx)
Side-by-side wildcard structure builder. Two StructurePanels (A/B), each with: anchor picker (shared PlayerSearchInput, max 3 anchors, blue 📌 badges with ✕ remove, amber conflict callouts e.g. POSITION_LOCK skips), resolved squad grid by position + bench (anchored players bold blue, RiskChip per player, xPts column), formation pill, budget-remaining footer, null-result message. ComparisonTable when both structures resolve: xPts over 1/3/5 GWs, budget remaining, captain options — winning cells highlighted green. Budget = authenticated sell prices + bank, else £100m default. Horizon mapped PlannerHorizon→OptimiserHorizon (1/3/5).

- **Data**: `usePlayers`, `useSquad`, `useMyTeam`, `useAuthStatus`; `buildAnchoredSquad` (`@/lib/anchored-squad`).

---

## Plan-section shared widget

- **HorizonSelector** (`planner/HorizonSelector.tsx`): 1–5 GW planning-horizon selector rendered at section level in page.tsx (see Global chrome).

---

## Squad section (6 tabs)

All Squad tabs are gated on the FPL team ID (`submittedId`).

### Decision (`decision`, squad/DecisionSummaryTab.tsx)
Weekly decision briefing — the squad-aware "what should I do" page, wrapped in DecisionErrorBoundary. Contains the FPL team-ID load form (numeric input + Load Squad button — one of the two ID entry points). Four severity-badged cards (HIGH/MEDIUM/LOW via `computeDecisionSeverity`): **Captain Pick** (top-3 candidates with fixture, projected pts, Safe/Upside CaptainTypeBadge, MinsRiskBadge; pool fallback when no squad per D-16), **Transfer Options** (OpportunityCostTable pinned to 1-GW horizon), **Chip Timing** (unused BB/TC/FH with 5-GW EaseCellBar heatmaps; uses `useChipHistory`), **Risk Flags** (starting-XI lifecycle labels sell/sell_soon/minutes_trap/fixture_trap, urgency-sorted). Plus Team News Alert (doubted/confirmed_absent picks with StatusLabelBadge), CalibrationHealthIndicator (Phase 103 CAL-02), ProseSummaryBlock (LLM prose summary + Refresh button, Phase 67 NLP-02), and a "Connect FPL account" pointer.

- **Data**: `useSquad`, `usePlayers`, `useClubForm`, `useAuthStatus`, `useMyTeam` (sell prices, FT derivation, bank), `useChipHistory` → `/api/fpl/entry/{teamId}/history/`, `useAccuracy` (calibration), `useLineupNews`, `useProseSummary`/`useProseRefresh` → `/api/prose-summary` (GET/POST); engines: gem scores, captaincy, lifecycle, OCS, suggestTransfers, BB/TC/FH scoring, DGW/BGW detection (D-18).

### Transfers (`transfers`, transfers/TransferPanel.tsx)
Transfer opportunity-cost engine + squad viewer + the **FPL auth flow**. Load Squad form (team ID, manual FT dropdown 1–2, bank £ input pre-filled when authenticated). Auth controls: "Connect FPL account" → **AuthModal** (JWT Bearer token paste → `/api/auth/login`; Phase 83 D-09 refresh); when connected shows "FPL connected · valid until HH:MM" with normal/expiring-soon/expired states + Disconnect (→ `/api/auth/logout`). **RejectionSearchCallout** (pre-squad-load, Phase 94 WHY-01-A): PlayerSearchInput autocomplete → lifecycle rejection reasons for any player. **Your Squad**: SquadView 15-player grid (XI + bench) with PlayerAvatar, xPts, start-prob %, VerdictBadge, LifecycleLabelBadge, MinsRiskBadge; CaptaincyPanel. **HighOwnershipCallout** (Phase 65 WHY-02): top-3 >20%-owned players absent from suggestions. **OCS section**: GwToggle 1/3/5 (disabled when target-GW picked, Phase 101 GWT-01), future-only Target GW dropdown (WR-01/WR-02) with "Ranked by GW<N> xPts" sublabel; OpportunityCostTable position-grouped rows (Out→In, FREE/−4 cost pill, xPts gain, break-even GWs), top-3-per-position cap with truncation footnotes (TFR-02 D-07), ConfirmedSigningBadge on buy candidates (WIN-02 D-14..16).

- **Data**: `useSquad`, `usePlayers`, `useAuthStatus`, `useMyTeam`, `useLineupNews`, `useClubForm`, `useTransferNews`; `/api/auth/login` + `/api/auth/logout`. FT derivation: authenticated 3-tier rule vs manual selector (CR-02).

### Optimiser (`optimiser`, optimiser/OptimiserPanel.tsx)
Lineup + chip optimiser. Ready state: GwToggle 1/3/5 (locked to 1 under Free Hit, Phase 101 D-08), ChipModeToggle (None/BB/TC/WC/FH), "Optimise Lineup" CTA. Results for None/BB: headline row (Formation/Changes/xPts gain; BB variant with bench + start + total xPts and bench-order note), desktop ComparisonTable / mobile MobileComparisonCards (position-grouped current→optimised with ±xPts / Promoted / Dropped badges, formation changes highlighted), then transfer-suggestions section with FtToggle (1/2 FT, None/BB only), per-position groups capped 3 + footnotes, single + combo transfer rows. WC/FH: ChipSquadView full 15-man rebuild within sell-prices+bank budget (unauth £100m default), null banner when infeasible. BGW soft (eligible < total) and critical (eligible < 11) warnings. Empty state without team ID.

- **Data**: `useSquad`, `usePlayers`, `useAuthStatus`, `useMyTeam`; engines `optimiseLineup`, `suggestTransfers`+`capByPosition`, `buildOptimalSquad`, `computeBenchBoostXPts`.

### Lineup (`lineup`, squad/LineupTab.tsx)
Interactive pitch editor. Headline (Formation / Captain / Total xPts), Reset button, BGW warnings. PitchRows GK/DEF/MID/FWD/Bench of PlayerCards (kit image via `useTeamBadge` with color fallback, name, xPts_1gw, start-prob %, C/VC badges). Tap-to-swap: arm a starter (amber ring) → legal bench targets ring green, incompatible dim; tap bench to execute position-legal swap; tap pitch background to disarm. Direct-commit "Set C"/"Set VC" pills per card (Phase 76 OPT-01, no arm state); captain auto-shuffles to VC if swapped out; overrides are session-only and cleared on Reset/squad refetch. Footer hint text. Horizon pinned to 1 GW (D-02).

- **Data**: `useSquad`, `usePlayers`; engines `optimiseLineup`, `isLegalSwap`, `applySwap`.

### Review (`review`, squad/GwReviewTab.tsx)
Post-GW retrospective. GwPillToggle over the last 3 settled GWs (default latest; receives `settledGws` from page.tsx, which auto-surfaces this tab once per newly settled GW via `pgw-reviewed:GW<N>`). Stat grid: GW Score (green if beats average), Bench pts left, Captain delta (green when optimal, "Optimal captain — no delta"), Benchmark card (dream-team/FPL-average delta with sentiment, Phase 99 PGW-03 / FIX-05 sign flip). Detail rows: top scorer, captain (+ optimal alternative when delta ≠ 0), best bench player, missed players list. Distinct handling for HTTP 503 (GW not settled), 404/502 (data unavailable), no-squad and no-settled-GWs states.

- **Data**: `useGwReview(submittedId, gw)` → `/api/gw-review?teamId=&gw=`; `useSettledGws` (page level) → `/api/fpl/bootstrap-static/`.

### Live (`live`, squad/LiveGwTab.tsx)
Real-time live GW score, polling every 30s during an active GW (`is_current && !finished`). Header card: GW badge + pulsing LIVE indicator (or grey Final), ChipBadge (BB/TC/FH), large total points, provisional-bonus disclaimer. Starting XI + Bench sections of PlayerRows: name (green ↑ subbed-in / muted ↓ subbed-off), StatPills (⚽🅰🛡🧤🟨🟥), live points, CaptainBadge (C×2 / VC×2 promoted with explanation). Auto-subs log (out → in with minutes). Skeleton loaders; error state with manual Retry; "no active gameweek" and "load your squad" guards. teamId parsed to number in page.tsx.

- **Data**: `useBootstrap`, `usePlayers` (name fallback), `useLiveGw(teamId, gw, isLive)` → `/api/fpl/event/{gw}/live/` + `/api/fpl/entry/{teamId}/event/{gw}/picks/`; `computeLiveScore`.

---

## Shared components

`src/components/shared/` (13):
- **VerdictBadge** — Buy/Hold/Sell pill (green/zinc/red); null-safe.
- **LifecycleLabelBadge** — lifecycle pill (buy_next_week/hold_one_more/sell_soon/minutes_trap/fixture_trap/hold/sell) with tiered colors.
- **TeamBadge** — team crest image with two-letter initials-on-gradient fallback on load error.
- **PlayerAvatar** — player headshot (55×70 default) with initials/team-color gradient fallback; used in GemTable, TransferPanel, LineupTab.
- **PlayerSearchInput** — debounced (150ms) autocomplete, top-6 substring matches, onSelect dropdown; used by RejectionSearchCallout, GemTable ComparisonSearch, Wildcard anchor pickers.
- **FragilityNote** — inline amber "⚠ no longer recommended if: <reasons>" (Phase 64 SENS-02).
- **FragilityBadge** — tristate fragility (robust=null / fragile amber / knife_edge orange) + reasons (Phase 93 SENS-01).
- **RotationRiskBadge** — team-level "⚡ Rotation risk" pill (Phase 80 GWI-01).
- **StatusLabelBadge** — doubted (amber) / confirmed_absent (red) only; silent for clean players (Phase 119).
- **RiskChip** — compact stacked chips: rotation (↻ HIGH/MED) + availability (✕ OUT / ⚠ DOUBT); silent when low/unknown.
- **MinsRiskBadge** — player minutes-risk (nailed/likely_start/rotation_risk/cameo/sub_risk) with 60-min probability tooltip; stacks RiskChip.
- **ConfirmedSigningBadge** — green "Confirmed Signing" pill with headline·source tooltip (Phase 125 WIN-02); GemTable expands + OCS buy cells + Watchlist cards.
- **PlayerInsightSection** — on-demand LLM player insight with idle/loading/cached button states, prose display, structured-guardrail fallback, hard-error message (Phase 105 NLP-02) → `/api/player-insight` (POST).

`src/components/mc/`:
- **MCDistributionBar** — Monte Carlo p10–p90 range bar + conditional "Haul X%" row (≥40%); used in GemTable hover cards and Weekly Picks expands (Phase 102 MC-01).

`src/components/fixtures/`:
- **FixtureBadges** — per-GW opponent badges (H/A, easy/medium/hard tier colors) with DGW grouping label; used in GemTable, Weekly Picks, Club Form.

Cross-tab widgets living in feature folders but reused:
- **GwToggle** (gem-table/) — 1/3/5-GW horizon pills with `disabled` support; used in GemTable, Club Form, TransferPanel, OptimiserPanel.
- **PlayerComparisonModal** (gem-table/) — page-level head-to-head modal: auto-focus search, results list, 4-section grid (xPts projection, gem scores, next fixtures, signals), Escape/backdrop dismiss.
- **OpportunityCostTable** (transfers/) — position-grouped OCS rows; used by Transfers AND Decision.
- **PlayerPickerModal / SquadSnapshotRow / ChipToggle** (planner/) — shared by Planner + Manual Plan.
- **AttDefToggle, HorizonToggle (8/12/16), OwnedFilterToggle, EaseBar, FixtureHeatMap** (club-form/).
- **LandscapeTip** — mobile-portrait rotation hint (GemTable, DefCon).
- **ChipModeToggle, ChipSquadView, FtToggle** (optimiser/).
- **RejectionSearchCallout, HighOwnershipCallout, SquadView, CaptaincyPanel, AuthModal** (transfers/).
- **CalibrationHealthIndicator, ProseSummaryBlock** (used in Decision).
- **GwPillToggle, StatCard** (squad/GwReviewTab internals), **PlayerRow/StatPills/CaptainBadge/ChipBadge/SkeletonRow** (LiveGwTab internals).
- **DataHealthPanel** (accuracy/).
- **WatchlistPlayerCard** (watchlist/).

---

## FPL-ID-gated features

**Capture/storage**: localStorage key `fpl_team_id`. State (`teamId`/`submittedId`) lives in page.tsx; entry forms exist in **DecisionSummaryTab** and **TransferPanel** (identical numeric form, shared callbacks); Manual Plan and Route Tree also render a Team-ID load form when no squad. `handleTeamIdSubmit` trims + persists + sets `submittedId`. The separate **FPL auth** (JWT token via AuthModal → `/api/auth/login`, status via `/api/auth/status`, logout via `/api/auth/logout`) upgrades sell prices/bank/FT-count accuracy through `useMyTeam` → `/api/fpl/my-team`. (`/api/auth/fpl-login` is the dead credential endpoint — returns ENDPOINT_GONE; not used by the UI.)

Gated capabilities (must all survive):
1. **All 6 Squad tabs** — entirely gated (squad load, OCS, optimiser, pitch editor, GW review, live score).
2. **Plan > Planner / Manual Plan / Route Tree / Wildcard** — need squad to plan (Wildcard falls back to £100m default budget without it).
3. **Plan > Rank Sim** — current rank + XI trajectory.
4. **Plan > Rivals** — rank-gap vs you, transfer suggestions baselined on your squad (league ID separately persisted as `fplx_mini_league_id`).
5. **Analyse > Club Form** — heat-map owned-team highlighting, Owned filter, Swing Detector "You own N" + owned-player expands.
6. **Analyse > Accuracy > Back** — captain/transfer regret vs your actual picks, chip ROI, hit tracking ("Log in to see" placeholders otherwise).
7. **Analyse > Season** — fully gated season review + decision grade.
8. **Decision tab chip timing** — `useChipHistory` per team.
9. **Squad-aware captain picks** (CaptainPicksPanel + Decision captain card) — pool fallback when absent.
10. **Auth-only refinements**: exact `selling_price`, real bank, derived FT count, pre-filled bank input, token expiry indicator + disconnect.

Other persistent client state that must survive: `theme`, `fpl_team_id`, `fplx_mini_league_id`, `fplx_manual_plan`, watchlist ids (useWatchlist), `deadline-dismissed:GW<N>`, `pgw-reviewed:GW<N>`, `fplx_nsp_activation_seen_{seasonId}`, decision-history localStorage ring buffer, push subscription + service worker `/sw.js`.

---

## Data hooks / API routes used by the UI

**Hooks (`src/lib/hooks/`, 37)** → routes:

| Hook | Route(s) |
|---|---|
| useAccuracy | `/api/accuracy` |
| useAuthStatus | `/api/auth/status` |
| useBootstrap | `/api/fpl/bootstrap-static/` |
| useCaptainPicks | `/api/captain-picks` |
| useChipHistory | `/api/fpl/entry/{teamId}/history/` |
| useClubForm | `/api/club-form` |
| useDataHealth | `/api/data-health` |
| useDecisionHistory | `/api/decision-history?teamId=` |
| useDefCon | `/api/defcon` |
| useEntryRank | `/api/fpl/entry/{teamId}/` |
| useGWIntel | `/api/gw-intel` |
| useGwAverage | `/api/gw-average` |
| useGwReview | `/api/gw-review?teamId=&gw=` |
| useInsights | `/api/insights` |
| useLastUpdated | `/api/last-updated` |
| useLineupNews | `/api/lineup-news` |
| useLiveGw | `/api/fpl/event/{gw}/live/` + `/api/fpl/entry/{teamId}/event/{gw}/picks/` |
| useLiveGwPoints | `/api/fpl/event/{gw}/live/` |
| useMyTeam | `/api/fpl/my-team` |
| useNextDeadline | `/api/fpl/bootstrap-static/` |
| usePlayerInsight | `/api/player-insight` (POST) |
| usePlayers | `/api/players` |
| usePreSeasonActive | `/api/pre-season-active` |
| usePreSeasonSquad | `/api/pre-season-squad[?include=inputs]` |
| usePriceChanges | `/api/price-changes` |
| usePriceReset | `/api/price-reset` |
| useProseRefresh | `/api/prose-summary` (POST) |
| useProseSummary | `/api/prose-summary` (GET) |
| useRivals | `/api/fpl/bootstrap-static/`, `/api/fpl/leagues-classic/{id}/standings/`, `/api/fpl/entry/{id}/event/{gw}/picks/`, `/api/fpl/entry/{id}/history/` |
| useSeasonAnalytics | `/api/season-analytics?teamId=` |
| useSeasonReview | `/api/season-review?teamId=` |
| useSetPieces | `/api/set-pieces` |
| useSettledGws | `/api/fpl/bootstrap-static/` |
| useSquad | `/api/squad/{teamId}` |
| useTeamBadge | (no fetch — kit image/colors) |
| useTransferNews | `/api/transfer-news` |
| useWatchlist | (no fetch — localStorage) |

**Non-hook fetches**: AuthModal/TransferPanel → `/api/auth/login`, `/api/auth/logout`; push flow → `/api/push/subscribe` (server-side: `/api/push/send`, dev `/api/push/test-send`).

**All API routes (33 `route.ts` files)**: accuracy, auth/login, auth/logout, auth/status, auth/fpl-login (dead — ENDPOINT_GONE), captain-picks, club-form, data-health, decision-history, defcon, fpl/[...proxy] (covers bootstrap-static, entry/*, event/*/live, leagues-classic/*), fpl/my-team, gw-average, gw-intel, gw-review, insights, last-updated, lineup-news, perfect-gw data via fpl proxy, player-insight, players, pre-season-active, pre-season-squad, price-changes, price-reset, prose-summary, push/send, push/subscribe, push/test-send, season-analytics, season-review, set-pieces, squad/[teamId], transfer-news.

**Query-cache sharing contracts** (must survive): identical hook calls across tabs deduplicate via TanStack Query (usePlayers/useSquad/useClubForm/useAccuracy/useDecisionHistory/useSeasonAnalytics); 6h staleTime on pipeline artifacts; 30s polling on live GW; 60s on data-health.

---

## Vestigial / watch items (known oddities, not features to keep)

_Reviewed in the 2026-07 season-readiness audit — several 2026-06 "vestigial" notes were stale; corrected below._

- `/api/auth/fpl-login` — dead credential endpoint (ENDPOINT_GONE by design, Phase 130). **Still dead — genuinely vestigial.**
- WatchlistTab `toggleWatchlist` — **SHIPPED (2026-07)**: unpin-from-card ✕ now wired on every `WatchlistPlayerCard` (present + departed). No longer voided.
- NextSeasonPlannerTab fixture heatmap — **FIXED (2026-07)**: renders the real `FixtureHeatMap` (2026/27 fixtures published; `/api/club-form` computes on demand). No longer a placeholder.
- RankSimTab receives `horizon` but ignores it (fixed 5 GWs, D-06). **NOT vestigial — intentional API parity** so page.tsx threads `planHorizon` uniformly to all Plan tabs. Leave.
- `extractSquad()` (WatchlistTab) — **NOT dead — actively used** compat shim for the legacy vs envelope squad shape. Safe to simplify only once `usePreSeasonSquad` fully returns the envelope; until then, leave.
- TransferPlanTable `unconfirmedFixtures` — **NOT deprecated — live**: computed in `planning-engine.ts`, typed in `types.ts`, rendered as a "no fixture data for this GW" marker. The 2026-06 "deprecated" label was wrong. Leave.
- FtToggle.tsx kept but used only by OptimiserPanel (removed from TransferPanel in Phase 74). Harmless.
- Price Reset tab is seasonally dormant ("Prices not yet published") outside the reset window — intentional, not broken.
