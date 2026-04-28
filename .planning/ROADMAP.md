# Roadmap: FPLx

## Milestones

- v1.0 MVP (Phases 1-6) - shipped 2026-03-29
- v1.1 Decision Engine (Phases 7-12) - shipped 2026-03-31
- v1.2 Mobile (Phases 13-18) - shipped 2026-04-01
- v1.3 Gameweek Planner (Phases 19-25) - shipped 2026-04-03
- v1.4 Analytics Engine & Intelligence Layer (Phases 26-34) - in progress

## Phases

### v1.4 Analytics Engine & Intelligence Layer

**Milestone Goal:** Upgrade FPLx from a transfer suggester into a full decision-support platform with data-driven pattern insights, advanced fixture analysis, ownership-aware captaincy, and set-piece/differential intelligence.

- [x] **Phase 26: Quick Wins** - Set-piece intelligence UI, mobile landscape tip, and set-piece pipeline fields *(completed 2026-04-27)*
- [x] **Phase 27: FDR++ Pipeline** - Attacking vs defensive fixture difficulty per team per fixture *(completed 2026-04-28)*
- [x] **Phase 28: xPts Engine** - Expected points per player with component breakdown and variance *(completed 2026-04-28)*
- [x] **Phase 29: Regression Detector** - Per-match xG/xA pipeline and buy/sell signals from form vs underlying (completed 2026-04-28)
- [x] **Phase 30: Differential Tracker** - Template-trap and differential flags based on ownership vs expected value *(completed 2026-04-28)*
- [ ] **Phase 31: Captaincy Ceiling** - 90th-percentile and EO-adjusted captain recommendations
- [ ] **Phase 32: Team Target List** - Teams with green fixture runs and top players ranked by xGI involvement
- [ ] **Phase 33: Insights Tab** - Data-driven pattern statements with confidence weights
- [ ] **Phase 34: Chip Strategy** - Optimal GW finder for Bench Boost, Triple Captain, and Free Hit

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
- [ ] 31-01-PLAN.md — Wave 0 test stubs + _compute_captain_picks() helper in merge.py + xPts_90th_1gw per player + run.py tuple unpack + captain_picks.json write (CAP-03, CAP-04)
**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 31-02-PLAN.md — types + /api/captain-picks route + useCaptainPicks hook + CaptainPicksPanel component + page.tsx mount + component tests + human verify (CAP-03, CAP-04)
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
**Plans**: TBD
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
**Plans**: TBD
**UI hint**: yes

### Phase 34: Chip Strategy
**Goal**: User can see the optimal upcoming gameweek for each remaining chip based on their actual squad and the fixture landscape
**Depends on**: Phase 28 (xPts projections per GW needed for chip value scoring)
**Requirements**: CHIP-01, CHIP-02, CHIP-03
**Success Criteria** (what must be TRUE):
  1. User can see the optimal upcoming GW for Bench Boost based on projected squad xPts across the bench
  2. User can see the optimal upcoming GW for Triple Captain based on player xPts ceiling and fixture ease
  3. User can see the optimal upcoming GW for Free Hit based on upcoming fixture landscape and squad flexibility
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 26 -> 27 -> 28 -> 29 -> 30 -> 31 -> 32 -> 33 -> 34

Note: Phase 29 (Regression Detector) can run in parallel with Phases 27-28 if desired, since it depends only on Phase 26 and a separate Understat pipeline. The serial order above is the default.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 26. Quick Wins | 2/2 | Complete | 2026-04-27 |
| 27. FDR++ Pipeline | 2/2 | Complete | 2026-04-28 |
| 28. xPts Engine | 2/2 | Complete | 2026-04-28 |
| 29. Regression Detector | 2/2 | Complete   | 2026-04-28 |
| 30. Differential Tracker | 2/2 | Complete | 2026-04-28 |
| 31. Captaincy Ceiling | 0/2 | Planned | - |
| 32. Team Target List | 0/TBD | Not started | - |
| 33. Insights Tab | 0/TBD | Not started | - |
| 34. Chip Strategy | 0/TBD | Not started | - |
