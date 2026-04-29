# Roadmap: FPLx

## Milestones

- v1.0 MVP (Phases 1-6) - shipped 2026-03-29
- v1.1 Decision Engine (Phases 7-12) - shipped 2026-03-31
- v1.2 Mobile (Phases 13-18) - shipped 2026-04-01
- v1.3 Gameweek Planner (Phases 19-25) - shipped 2026-04-03
- v1.4 Analytics Engine & Intelligence Layer (Phases 26-35) - shipped 2026-04-29
- v1.5 UX & Polish (Phases 36-41) - in progress

## Phases

### v1.4 Analytics Engine & Intelligence Layer

**Milestone Goal:** Upgrade FPLx from a transfer suggester into a full decision-support platform with data-driven pattern insights, advanced fixture analysis, ownership-aware captaincy, and set-piece/differential intelligence.

- [x] **Phase 26: Quick Wins** - Set-piece intelligence UI, mobile landscape tip, and set-piece pipeline fields *(completed 2026-04-27)*
- [x] **Phase 27: FDR++ Pipeline** - Attacking vs defensive fixture difficulty per team per fixture *(completed 2026-04-28)*
- [x] **Phase 28: xPts Engine** - Expected points per player with component breakdown and variance *(completed 2026-04-28)*
- [x] **Phase 29: Regression Detector** - Per-match xG/xA pipeline and buy/sell signals from form vs underlying (completed 2026-04-28)
- [x] **Phase 30: Differential Tracker** - Template-trap and differential flags based on ownership vs expected value *(completed 2026-04-28)*
- [x] **Phase 31: Captaincy Ceiling** - 90th-percentile and EO-adjusted captain recommendations *(completed 2026-04-28)*
- [x] **Phase 32: Team Target List** - Teams with green fixture runs and top players ranked by xGI involvement *(completed 2026-04-28)*
- [x] **Phase 33: Insights Tab** - Data-driven pattern statements with confidence weights *(completed 2026-04-28)*
- [x] **Phase 34: Chip Strategy** (completed 2026-04-28) - Optimal GW finder for Bench Boost, Triple Captain, and Free Hit
- [x] **Phase 35: Tech Debt Fixes** - Correctness and quality fixes from v1.4 audit (mobile column ID, TRAP logic, TS error, zero-count insights, type annotation) *(completed 2026-04-29)*

### v1.5 UX & Polish

**Milestone Goal:** Make FPLx's data-dense app feel faster and cleaner — consolidate the 9+ tab navigation into a 3-section hierarchy, add GemTable view presets, surface data freshness on every tab, and introduce a player comparison modal.

- [x] **Phase 36: Navigation Consolidation** - Reorganise 9+ tabs into three top-level sections (Analyse / Plan / Squad) with sub-tabs on desktop and mobile *(completed 2026-04-29)*
- [x] **Phase 37: GemTable View Presets** - Add Default / Compact / Analysis toggle that persists across tab switches in a session *(completed 2026-04-29)*
- [x] **Phase 38: Data Freshness UX** - Show human-readable "Updated X ago" on every tab without requiring navigation *(complete 2026-04-29)*
- [ ] **Phase 39: Player Comparison Modal** - Side-by-side xPts, Gem breakdown, fixtures, and signals for any two players from GemTable
- [ ] **Phase 40: Accuracy Pipeline** - Pipeline backtest of proj_pts vs xPts over the last 5 completed gameweeks
- [ ] **Phase 41: Accuracy UI & Model Rationalisation** - GW accuracy table, haulter comparison, player-level delta view, last-GW actuals column in GemTable, and removal of the weaker model

## Phase Details

### Phase 26: Quick Wins
**Goal**: User gets immediate new intelligence -- set-piece taker visibility, set-piece change alerts, and a landscape tip on mobile -- with zero blocking pipeline changes
**Depends on**: Nothing (first phase of v1.4)
**Requirements**: SP-01, SP-02, MOB-LS-01, DATA-04
**Success Criteria** (what must be TRUE):
  1. User can see the penalty taker, direct free kick taker, and corner taker for each Premier League team in a dedicated panel
  2. User is alerted when a set-piece order has changed between the current and previous pipeline run
  3. User sees a subtle landscape tip when viewing Gems or DefCon tabs on a mobile device in portrait orientation
  4. Set-piece text fields from FPL bootstrap-static are present in merged_players.json
**Plans**: 2 plans
Plans:

**Wave 1**
- [x] 26-01-PLAN.md — Pipeline fields (DATA-04) + snapshot diff (SP-02) + types + API route + hook
**Wave 2** *(blocked on Wave 1 completion)*
- [x] 26-02-PLAN.md — Set Pieces tab UI (SP-01) + change alert (SP-02) + landscape tip (MOB-LS-01) + tab wiring
**UI hint**: yes

### Phase 27: FDR++ Pipeline
**Goal**: User benefits from position-aware fixture difficulty -- defenders/GKs rated against opponent attacking strength, attackers against opponent defensive weakness -- replacing the single-number FDR
**Depends on**: Phase 26
**Requirements**: DATA-01, FIX-01, FIX-02
**Success Criteria** (what must be TRUE):
  1. Pipeline output contains attacking_difficulty and defensive_difficulty per team per fixture (existing difficulty_score field unchanged)
  2. User can see all 20 Premier League teams ranked by fixture ease on the Form tab with 1 GW, 3 GW, and 5 GW toggle views
  3. Fixture ease ranking uses the attacking/defensive FDR split appropriate to player position (attacking FDR for MID/FWD, defensive FDR for GK/DEF)
**Plans**: 2 plans
Plans:

**Wave 1**
- [x] 27-01-PLAN.md — Pipeline math (DATA-01) + TS mirror in computeClubForm + types extension + Vitest cases + RTL/jsdom infrastructure
**Wave 2** *(blocked on Wave 1 completion)*
- [x] 27-02-PLAN.md — EaseBar + AttDefToggle + FixtureEaseRankingPanel (FIX-01, FIX-02) + page mount + component tests + human verify
**Cross-cutting constraints:**
- `difficulty_score` field must remain untouched in pipeline/merge.py and merged_players.json (6+ consumers)
- pipeline/merge.py and src/lib/club-form.ts edited as a pair (both re-derive fixture difficulty from raw FPL JSON independently)
- ATT/DEF + GW window state lives only inside FixtureEaseRankingPanel — never hoisted to page.tsx
**UI hint**: yes

### Phase 28: xPts Engine
**Goal**: User can see a statistically grounded expected points projection per player with component breakdown, replacing the heuristic proj_pts
**Depends on**: Phase 27 (FDR++ needed for CS probability and fixture-adjusted scoring rates)
**Requirements**: DATA-02, XPTS-01, XPTS-02
**Success Criteria** (what must be TRUE):
  1. Pipeline computes xPts per player per upcoming GW with goal, assist, clean sheet, and bonus components using Poisson/Bernoulli distributions
  2. User can see per-player xPts with component breakdown in GemTable
  3. User can see an xPts variance indicator distinguishing high-ceiling players from consistent scorers
**Plans**: 2 plans
Plans:

**Wave 1**
- [x] 28-01-PLAN.md — xPts pipeline math (DATA-02) + MergedPlayer type extension + Vitest cache-skip integration tests
**Wave 2** *(blocked on Wave 1 completion)*
- [x] 28-02-PLAN.md — VarianceBadge + XPtsCell + columns swap proj_pts->xPts (XPTS-01, XPTS-02) + GwToggle key map + component tests + human verify
**UI hint**: yes

### Phase 29: Regression Detector
**Goal**: User can spot buy opportunities (underperformers due to regress) and sell signals (overperformers likely to regress) based on actual vs expected goals and assists
**Depends on**: Phase 26 (DATA-04 for pipeline fields); independent of Phases 27-28 since it uses per-match Understat xG/xA, not FDR++
**Requirements**: DATA-03, REG-01, REG-02
**Success Criteria** (what must be TRUE):
  1. Pipeline fetches and stores per-match xG/xA per player from Understat (not just season aggregates)
  2. User can see a buy signal on players whose actual goals/assists are significantly below their xG/xA over the last 5-10 GW (minimum 900 minutes played)
  3. User can see a sell signal on players whose actual goals/assists are significantly above their xG/xA over the last 5-10 GW (minimum 900 minutes played)
**Plans**: 2 plans
Plans:

**Wave 1**
- [x] 29-01-PLAN.md — Wave 0 test stubs + _compute_regression_signal() in merge.py (DATA-03) + MergedPlayer type extension (REG-01, REG-02)
**Wave 2** *(blocked on Wave 1 completion)*
- [x] 29-02-PLAN.md — RegressionSignalBadge + Signal column in columns.tsx (REG-01, REG-02) + GwToggle/GemTable visibility + component tests + human verify
**Cross-cutting constraints:**
- D-01/D-02 from CONTEXT.md superseded: FPL element-summary expected_goals/expected_assists used instead of soccerdata; no understat_per_match.json cache needed
- Signal computation is pure Python in merge.py using existing summaries dict -- zero new HTTP calls, zero new pip dependencies
- regression_signal and actual_vs_xg_delta fields absent (not null) when signal cannot be computed (D-03 graceful fallback)
**UI hint**: yes

### Phase 30: Differential Tracker
**Goal**: User can identify high-value differentials to gain rank and template traps to avoid or sell
**Depends on**: Phase 28 (xPts needed for EV comparison against ownership)
**Requirements**: TMPL-01, TMPL-02
**Success Criteria** (what must be TRUE):
  1. User can see a differential flag on players with above-average xPts and below-average ownership
  2. User can see a template-trap flag on players with below-average xPts and above-average ownership
**Plans**: 2 plans
Plans:

**Wave 1**
- [x] 30-01-PLAN.md — Wave 0 test stubs + _compute_differential_flag() in merge.py + position-relative median pass + MergedPlayer type extension (TMPL-01, TMPL-02) *(complete 2026-04-28)*
**Wave 2** *(blocked on Wave 1 completion)*
- [x] 30-02-PLAN.md — DifferentialBadge + Diff column in columns.tsx (TMPL-01, TMPL-02) + GwToggle/GemTable visibility + component tests + human verify *(complete 2026-04-28)*
**Cross-cutting constraints:**
- xPts threshold is position-relative (D-01: median per element_type), not global — avoids systematic bias against DEFs
- DIFF gate (D-03) requires status='a'; TRAP gate (D-04) is status-agnostic (D-12 asymmetry: injured template player still a sell-trap)
- differential_flag field absent (not null) when neither DIFF nor TRAP fires (D-05 graceful fallback — same convention as regression_signal)
**UI hint**: yes

### Phase 31: Captaincy Ceiling
**Goal**: User gets distribution-aware captain picks -- a ceiling pick for when chasing rank and an EO-adjusted pick for protecting rank
**Depends on**: Phase 28 (xPts variance for 90th percentile) + Phase 30 (ownership data for EO adjustment)
**Requirements**: CAP-03, CAP-04
**Success Criteria** (what must be TRUE):
  1. User can see a ceiling captain recommendation showing the highest 90th-percentile xPts player
  2. User can see an EO-adjusted captain recommendation that accounts for ownership concentration
**Plans**: 2 plans
Plans:

**Wave 1**
- [x] 31-01-PLAN.md — Wave 0 test stubs + _compute_captain_picks() helper in merge.py + xPts_90th_1gw per player + run.py tuple unpack + captain_picks.json write (CAP-03, CAP-04) *(completed 2026-04-28)*
**Wave 2** *(blocked on Wave 1 completion)*
- [x] 31-02-PLAN.md — types + /api/captain-picks route + useCaptainPicks hook + CaptainPicksPanel component + page.tsx mount + component tests + human verify (CAP-03, CAP-04) *(completed 2026-04-28)*
**Cross-cutting constraints:**
- Captain picks block in pipeline/merge.py MUST run between the xPts ceiling tercile block (line ~840) and the sigma strip (line ~842) — _sigma_1gw is deleted at line 844
- merge_players() return signature changes to tuple[list, dict] — single call site in run.py (verified)
- Component lives in existing src/components/captaincy/ directory (CONTEXT D-13 said captain/ but RESEARCH Pitfall 6 recommends reusing captaincy/ to avoid two confusingly-named dirs)
- All Tailwind classes and copy strings in CaptainPicksPanel.tsx are LOCKED by 31-UI-SPEC.md — no hue accents on cards
**UI hint**: yes

### Phase 32: Team Target List
**Goal**: User can identify which teams to target for transfers based on green fixture runs and which specific players to buy from those teams
**Depends on**: Phase 27 (FDR++ for fixture ease) + Phase 28 (xPts for player ranking) + Phase 29 (regression flags for buy signals)
**Requirements**: TGT-01, TGT-02, TGT-03
**Success Criteria** (what must be TRUE):
  1. User can see teams with 4+ favourable upcoming fixtures highlighted on the Club Form tab
  2. User can see top players ranked by xGI involvement percentage for teams with green fixture runs
  3. Buy signals and differential flags are visible alongside team target player data
**Plans**: 2 plans
Plans:

**Wave 1**
- [x] 32-01-PLAN.md — Pipeline expected_goals/expected_assists fields + MergedPlayer type + computeXgiInvolvement utility + unit tests (TGT-02 foundation) ✓ 2026-04-28
**Wave 2** *(blocked on Wave 1 completion)*
- [x] 32-02-PLAN.md — FixtureEaseRankingPanel TARGET badge + expand-on-click player table reusing RegressionSignalBadge/DifferentialBadge (TGT-01, TGT-02, TGT-03) + component tests + human verify ✓ 2026-04-28
**Cross-cutting constraints:**
- expected_goals and expected_assists added to pipeline/merge.py and MergedPlayer in Plan 01 — non-optional, sourced from FPL bootstrap (matches goals_scored/assists convention)
- TARGET qualification always uses 5GW window + attacking_difficulty < 0.5 regardless of GwToggle/AttDefToggle state (CONTEXT D-02)
- All extension lives inside FixtureEaseRankingPanel — no changes to src/app/page.tsx (CONTEXT D-05)
**UI hint**: yes

### Phase 33: Insights Tab
**Goal**: User can browse data-driven pattern statements about this season's FPL data, surfacing non-obvious trends with confidence levels
**Depends on**: Phase 28 (xPts data), Phase 29 (regression data), Phase 30 (ownership data) -- benefits from all prior features as data sources
**Requirements**: INS-01, INS-02, INS-03, INS-04
**Success Criteria** (what must be TRUE):
  1. User can see an Insights tab in the navigation with data-driven statements about patterns from this season
  2. Each statement displays a confidence weight derived from actual season data
  3. Statements span defensive patterns, attacking patterns, and player-specific patterns
  4. Trivially obvious statements are excluded from the Insights tab
**Plans**: 2 plans
Plans:

**Wave 1**
- [x] 33-01-PLAN.md — Wave 0 test stub + pipeline insights.py module (4 category helpers, sample-floor + triviality gates) + run.py wiring + insights.json seed (INS-02, INS-03, INS-04 data layer)
**Wave 2** *(blocked on Wave 1 completion)*
- [x] 33-02-PLAN.md — Insight type + /api/insights route + useInsights hook + InsightsTab component (4 category sections, tier badge, tooltip) + page.tsx + MobileNav wiring + component tests + human verify (INS-01, INS-02, INS-03, INS-04)
**Cross-cutting constraints:**
- Tab union type duplicated in src/app/page.tsx and src/components/nav/MobileNav.tsx — must be updated atomically (RESEARCH Pitfall 3)
- insights.json seeded as [] in Plan 01 so /api/insights cannot 500 on a fresh checkout
- All Tailwind classes and copy strings in InsightsTab.tsx are LOCKED by 33-UI-SPEC.md
**UI hint**: yes

### Phase 34: Chip Strategy
**Goal**: User can see the optimal upcoming gameweek for each remaining chip based on their actual squad and the fixture landscape
**Depends on**: Phase 28 (xPts projections per GW needed for chip value scoring)
**Requirements**: CHIP-01, CHIP-02, CHIP-03
**Success Criteria** (what must be TRUE):
  1. User can see the optimal upcoming GW for Bench Boost based on projected squad xPts across the bench
  2. User can see the optimal upcoming GW for Triple Captain based on player xPts ceiling and fixture ease
  3. User can see the optimal upcoming GW for Free Hit based on upcoming fixture landscape and squad flexibility
**Plans**: 2 plans
Plans:

**Wave 1**
- [x] 34-01-PLAN.md — chip-strategy-engine pure scorers (BB/TC/FH + greedy 15-player squad with formation rules) + useChipHistory hook with numeric teamId guard (T-34-01) + Wave 0 test stubs
**Wave 2** *(blocked on Wave 1 completion)*
- [x] 34-02-PLAN.md — ChipStrategyPanel UI (panel + 3 chip rows + 5-cell ease bar + FH expand-on-click squad table) + PlannerTab mount + component tests + human verify (CHIP-01, CHIP-02, CHIP-03)
**Cross-cutting constraints:**
- All Tailwind classes and copy strings in ChipStrategyPanel.tsx are LOCKED by 34-UI-SPEC.md — no chevron icon library, no accordion, no per-row hue accents
- Ease polarity is `ease = 1 - attacking_difficulty` (RESEARCH Pitfall 1) — applied at the engine boundary, never at the JSX boundary
- BGW (no fixture for target GW) yields BGW_NEUTRAL_EASE = 0.5 in BB/TC and 0× weighted xPts in FH; documented in chip-strategy-engine.ts (RESEARCH Pitfall 2)
- FH greedy enforces formation (2 GK / 3-5 DEF / 2-5 MID / 1-3 FWD), team cap (max 3 per FPL team), and budget = bankBalance + sum(sellPrices ?? now_cost) over current squad (RESEARCH Pitfalls 4-5)
- Used chips remain visible (D-13) — opacity-40 + "Used GW{N}" label, never hidden
**UI hint**: yes

### Phase 35: Tech Debt Fixes
**Goal**: Close 7 audit-flagged tech debt items from v1.4 — two correctness bugs, one mobile UX bug, two quality issues, and one cosmetic type annotation fix
**Depends on**: Phases 26-34 (all complete)
**Requirements**: None (no new requirements; fixes to existing behaviour)
**Gap Closure**: Closes tech debt from v1.4 audit (2026-04-29)
**Items:**
- WR-01 (Phase 29): Fix `signal: false` → `regression_signal: false` in `MOBILE_HIDDEN_COLUMNS` — TanStack column ID mismatch breaks mobile column hiding
- WR-02 (Phase 30): Exclude BGW players (xPts_1gw=0, no fixture) from TRAP median calculation to prevent false TRAP flags during blank gameweeks
- WR-03 (Phase 30): Change TRAP gate from `not above_median` (≤) to strict `<` so exactly-median players are not flagged as template traps
- WR-04 (Phase 33): Fix `data: [] as Insight[]` in InsightsTab.test.tsx (line 166) — TS2352 `never[]` inference in test only
- WR-05 (Phase 33): Add `sample_n > 0` guard in `_player_patterns` insights.py to suppress zero-count insight strings
- WR-06 (cross-phase): Fix `upload.py` type annotation `data: dict` → `data: list | dict` for insights payload accuracy
- WR-07 (Phase 34): Document `bestGw || null` edge-case rationale — safe since FPL GW numbers are always ≥1
**Plans**: 2 plans
Plans:

**Wave 1**
- [x] 35-01-PLAN.md — Python backend fixes: WR-02 (BGW median), WR-03 (TRAP strict <), WR-05 (zero-count guard), WR-06 (upload type)
- [x] 35-02-PLAN.md — TypeScript fixes: WR-01 (mobile column ID), WR-04 (Insight[] cast), WR-07 (bestGw comment)

### Phase 36: Navigation Consolidation
**Goal**: User can navigate the full app through three clearly labelled top-level sections — Analyse, Plan, and Squad — each with grouped sub-tabs, on both desktop and mobile
**Depends on**: Phase 35 (all v1.4 work complete; nav touches every tab)
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05
**Success Criteria** (what must be TRUE):
  1. User sees three top-level navigation sections (Analyse, Plan, Squad) that replace the flat 9-tab bar on desktop
  2. Clicking "Analyse" reveals sub-tabs: Gem Ratings, Insights, DefCon Analysis, Set Pieces
  3. Clicking "Plan" reveals sub-tabs: Planner, Club Form, Value Gems
  4. Clicking "Squad" shows the Squad & Transfers view directly with no further sub-tab selection required
  5. On mobile, the bottom nav reflects the same 3-section grouping with accessible in-section sub-tab navigation
**Plans**: 1 plan
Plans:

**Wave 1**
- [ ] 36-01-PLAN.md — Atomic Tab→Section/SubTab type rename + page.tsx desktop two-tier nav + MobileNav two-row layout + Wave 0 test scaffolds (NAV-01, NAV-02, NAV-03, NAV-04, NAV-05) + manual verify checkpoint
**UI hint**: yes

### Phase 37: GemTable View Presets
**Goal**: User can switch the GemTable between named column presets that reduce visual noise without losing access to full data, and the chosen preset stays active while navigating between tabs
**Depends on**: Phase 36 (nav structure settled before adding preset state that may live at a shared level)
**Requirements**: GEM-01, GEM-02, GEM-03, GEM-04
**Success Criteria** (what must be TRUE):
  1. User can toggle between Default, Compact, and Analysis presets via a control on the GemTable
  2. Compact preset shows only Player, Pos, Gem score, xPts 1GW, and Risk badge — all other columns hidden
  3. Analysis preset reveals xG and xA detail columns alongside the standard set
  4. Switching tabs and returning to Gem Ratings restores the previously selected preset without resetting to Default
**Plans**: 2 plans
Plans:

**Wave 1**
- [x] 37-01-PLAN.md — ViewPreset type + PRESET_COLUMN_VISIBILITY maps + extended getColumnVisibility + preset tests (GEM-01, GEM-02, GEM-03, GEM-04 logic layer)
**Wave 2** *(blocked on Wave 1 completion)*
- [x] 37-02-PLAN.md — PresetToggle component + GemTable prop wiring + page.tsx gemPreset state lift + human verify (GEM-01, GEM-02, GEM-03, GEM-04)
**Cross-cutting constraints:**
- `getColumnVisibility` existing 1-arg and 2-arg call signatures must remain unchanged (backward compat with existing tests)
- Merge order: `{ ...PRESET_COLUMN_VISIBILITY[preset], ...gwVisibility }` — GW columns always win over preset maps
- Mobile path (`isMobile=true`) ignores preset entirely — MOBILE_HIDDEN_COLUMNS path unchanged
- `gemPreset` state lives in `page.tsx`, not GemTable local state — required for GEM-04 session persistence
**UI hint**: yes

### Phase 38: Data Freshness UX
**Goal**: User always knows how stale the data is, on every tab, without navigating to a specific location to find out
**Depends on**: Phase 36 (nav structure determines where the freshness indicator is anchored)
**Requirements**: FRE-01, FRE-02, FRE-03
**Success Criteria** (what must be TRUE):
  1. Every tab displays a "Updated X ago" label that is visible without scrolling or additional interaction
  2. The freshness indicator uses human-readable relative time ("3 hours ago", "2 days ago") rather than an ISO timestamp
  3. The indicator updates in real time within a session as time passes (no stale "0 minutes ago" after an hour)
**Plans**: 2 plans
Plans:

**Wave 1**
- [x] 38-01-PLAN.md — formatRelativeTime utility (FRE-02 logic layer) + Vitest TDD cases for D-01 bands and singular/plural boundaries
**Wave 2** *(blocked on Wave 1 completion)*
- [x] 38-02-PLAN.md — LastUpdated.tsx upgrade (relativeTime prop rename + 30s setInterval tick + cleanup) + RTL tests with fake timers + human verify (FRE-01, FRE-02, FRE-03)
**Cross-cutting constraints:**
- Pure/connected DAT-02 split preserved — LastUpdatedDisplay accepts pre-formatted relativeTime: string, never raw ISO timestamp
- Interval lives in connected component only; effect deps are [data?.last_updated]; clearInterval on unmount is mandatory (T-38-07 mitigation)
- /api/last-updated route, useLastUpdated hook, and src/app/page.tsx mount site are unchanged (CONTEXT D-04, D-07)
**UI hint**: yes

### Phase 39: Player Comparison Modal
**Goal**: User can compare any two players side by side — across xPts projections, Gem score components, upcoming fixtures, and buy/sell signals — before committing to a transfer decision
**Depends on**: Phase 36 (nav stable), Phase 37 (GemTable column structure stable before adding row-level compare icon)
**Requirements**: CMP-01, CMP-02, CMP-03, CMP-04, CMP-05, CMP-06
**Success Criteria** (what must be TRUE):
  1. User can open a comparison modal from any GemTable row using a compare icon on that row
  2. User can search for and select any second player from the full player list within the modal
  3. Modal shows xPts 1GW / 3GW / 5GW and 90th-percentile ceiling for both players side by side
  4. Modal shows all 7 Gem score components for each player side by side
  5. Modal shows next 5 fixtures with colour-coded difficulty for each player, and the BUY/SELL signal, DIFF/TRAP flag, and rotation risk badge for each player
**Plans**: 3 plans
Plans:

**Wave 0**
- [x] 39-01-PLAN.md — Wave 0 test stubs: PlayerComparisonModal.test.tsx (CMP-01..CMP-06 RED), columns.test.tsx (compare-icon cell RED), page.test.tsx (Phase 39 mount RED)
**Wave 1** *(blocked on Wave 0 completion)*
- [ ] 39-02-PLAN.md — PlayerComparisonModal.tsx (native dialog shell + Player B search + xPts/Gem/Fixtures/Signals sections) + columns.tsx fmtScore/fmtScoreNull exports (CMP-02, CMP-03, CMP-04, CMP-05, CMP-06)
**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 39-03-PLAN.md — columns.tsx createColumns(onCompare) factory + GemTable.tsx onCompare prop + mobile action sheet + page.tsx state + modal mount + human verify (CMP-01)
**Cross-cutting constraints:**
- Native `<dialog>` only — no Radix/Headless UI modal libraries (D-07; mirrors PlayerPickerModal.tsx pattern)
- web_name column MUST stay `col.accessor('web_name', ...)` (Pitfall 1: switching to col.display kills auto-sort)
- onCompare stability chain: `useCallback` in page.tsx → `useMemo([handleCompare])` in GemTable for createColumns (Pitfall 2)
- `comparePlayer` state lives in page.tsx (NOT inside GemTable) so the modal overlays the entire app
- Modal mounted as sibling of `<main>`/`<MobileNav>`, OUTSIDE the `activeSubTab === 'gems'` guard (survives sub-tab navigation)
- Single permitted inline style: `style={{ fontSize: '16px' }}` on the search input (Pitfall 5 — iOS zoom guard)
- All Tailwind classes and copy strings in PlayerComparisonModal.tsx are LOCKED by 39-UI-SPEC.md
**UI hint**: yes

### Phase 40: Accuracy Pipeline
**Goal**: Pipeline produces a per-GW backtest record comparing both projection models (proj_pts and xPts) against actual FPL points over the last 5 completed gameweeks, providing the data foundation for accuracy analysis
**Depends on**: Phase 35 (clean pipeline baseline before adding backtest computation)
**Requirements**: ACC-01
**Success Criteria** (what must be TRUE):
  1. Pipeline writes an accuracy backtest file covering the last 5 completed gameweeks, with per-player predicted vs actual points for both proj_pts_1gw and xPts_1gw
  2. Backtest data identifies haulters (players who scored 10+ actual points) and records whether each model ranked them highly before that gameweek
**Plans**: TBD

### Phase 41: Accuracy UI & Model Rationalisation
**Goal**: User can inspect how well each projection model has performed over the last 5 gameweeks, see actual last-GW points alongside xPts in the GemTable, and use only the model that demonstrably outperforms the other
**Depends on**: Phase 40 (backtest data must exist before UI can display it)
**Requirements**: ACC-02, ACC-03, ACC-04, ACC-05, ACC-06
**Success Criteria** (what must be TRUE):
  1. User can view a GW-by-GW accuracy table showing predicted haulters vs actual 10+ scorers with a hit rate percentage per model per GW
  2. User can see a "correctly flagged haulters" list showing players each model got right before the gameweek
  3. User can view a player-level table of predicted vs actual points with prediction error, sortable by biggest miss
  4. GemTable shows a last-GW actual points column next to xPts_1gw for at-a-glance calibration
  5. The weaker projection model is removed from the app; only the better-performing model remains visible to the user
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 26 -> 27 -> 28 -> 29 -> 30 -> 31 -> 32 -> 33 -> 34 -> 35 -> 36 -> 37 -> 38 -> 39 -> 40 -> 41

Note: Phase 38 (Data Freshness) depends on Phase 36 (nav) but not on Phase 37 (presets) — it can run in parallel with Phase 37 if desired. Phase 40 (Accuracy Pipeline) depends only on Phase 35 and can run in parallel with Phases 36-39 if desired.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 26. Quick Wins | 2/2 | Complete | 2026-04-27 |
| 27. FDR++ Pipeline | 2/2 | Complete | 2026-04-28 |
| 28. xPts Engine | 2/2 | Complete | 2026-04-28 |
| 29. Regression Detector | 2/2 | Complete   | 2026-04-28 |
| 30. Differential Tracker | 2/2 | Complete | 2026-04-28 |
| 31. Captaincy Ceiling | 2/2 | Complete | 2026-04-28 |
| 32. Team Target List | 2/2 | Complete | 2026-04-28 |
| 33. Insights Tab | 2/2 | Complete | 2026-04-28 |
| 34. Chip Strategy | 2/2 | Complete | 2026-04-28 |
| 35. Tech Debt Fixes | 2/2 | Complete | 2026-04-29 |
| 36. Navigation Consolidation | 0/1 | Not started | - |
| 37. GemTable View Presets | 2/2 | Complete | 2026-04-29 |
| 38. Data Freshness UX | 0/2 | Not started | - |
| 39. Player Comparison Modal | 0/3 | Not started | - |
| 40. Accuracy Pipeline | 0/? | Not started | - |
| 41. Accuracy UI & Model Rationalisation | 0/? | Not started | - |
