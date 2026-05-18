# Project Research Summary

**Project:** FPL Analyst v1.24 - End of Season and Off-Season Intelligence
**Domain:** FPL analytics web app - season review, off-season planning, transfer news intelligence
**Researched:** 2026-05-18
**Confidence:** HIGH

## Executive Summary

v1.24 is an extension milestone, not a ground-up build. The four major features (Season Review, SCRAPER-02 transfer news pipeline, Summer Window Tracker, Next Season Planner) all integrate cleanly into the established Python pipeline to Vercel Blob to Next.js Route Handler to TanStack Query to React stack. The stack requires at most one new Python package (twikit==2.3.3 - and only if Twitter/X scraping is pursued, which two independent research threads recommend against). All TypeScript work uses existing recharts, TanStack Table, and Zod. The architecture pattern is identical to every prior phase: pipeline writes JSON artifacts to Blob, API routes proxy them, hooks cache them, components render them. There is no new architectural category to introduce.

The recommended delivery sequence is: polish carry-forwards first (clean CI baseline, zero new infrastructure), then SCRAPER-02 pipeline and Season Review in parallel (independent of each other), then Summer Window Tracker (consumes SCRAPER-02 output), then Next Season Planner (completes the milestone with the highest-complexity feature last). The Decision Quality Process Score is co-located with Season Review - they share the same aggregation data layer and must ship together. The full-pool squad builder is a new algorithm (buildPreSeasonSquad()) but stays client-side greedy over existing usePlayers() data, consistent with v1.6 decisions to keep computation browser-side when combinatorics allow.

The highest-risk item is the off-season FPL API state: after GW38, is_current is false for all events, xPts_1gw is zero for all players, and element-summary per-GW history collapses to season-summary format. Every feature must gate on this condition or degrade gracefully. The second-highest risk is the greedy optimizer returning null for a cold-start full-pool build at the 100m budget ceiling - a known failure mode of buildOptimalSquad() that the new buildPreSeasonSquad() must not inherit. Twitter/X scraping from GitHub Actions (Azure datacenter IPs) is permanently blocked and must be excluded from SCRAPER-02 scope; RSS feeds cover 90% of the same signal with higher reliability.

---

## Key Findings

### Recommended Stack

The stack is already correct. Zero npm changes are needed. The Python pipeline adds twikit==2.3.3 only if Twitter/X is in SCRAPER-02 scope (both STACK and PITFALLS research independently recommend excluding it). PuLP (>=3.3.1) is an upgrade path for the squad optimiser if the greedy heuristic proves insufficient - start without it.

SCRAPER-02 is a content and source extension of the existing feedparser-based lineup_news.py. The two new RSS URLs (Sky Sports transfer channel skysports.com/rss/12040, Transfermarkt transfermarkt.co.uk/rss/news) require no new library. Season Review, Summer Window Tracker, and Next Season Planner all render from existing recharts, TanStack Table, and the @vercel/blob client.

**Core technologies - net new:**
- twikit==2.3.3 (Python): Twitter/X scraping via session cookies - hard-pin, non-fatal gate, exclude from SCRAPER-02 unless explicitly scoped in
- pulp>=3.3.1 (Python): ILP squad optimiser backup - add only if greedy heuristic fails on 100m full-pool build

**Existing stack that covers all v1.24 needs:**
- feedparser>=6.0.12: Handles all new RSS sources (no new library)
- recharts^3.8.1: Season review charts, fixture heatmap
- @tanstack/react-query^5.95.2: New hooks (useTransferNews, existing usePlayers, useSeasonAnalytics)
- @tanstack/react-table^8.21.3: Squad tables, season review tables
- zod^4.3.6: Validates new JSON artifacts

### Expected Features

**Must have (table stakes for v1.24):**
- Season Review summary card - total rank, captain hit rate, chip ROI, transfer net gain/loss; data already exists in pipeline artifacts
- Decision Quality Process Score - composite A-D grade (40% captain EV rate + 35% hit break-even rate + 25% chip ROI positive rate); must ship with Season Review
- SCRAPER-02 (Sky Sports + BBC Sport RSS) - automated ingestion of summer transfer/fitness news; extends existing pipeline as a separate transfer_news.py module
- Summer Window Tracker - article feed of confirmed PL signings matched to FPL IDs; read-only intelligence in Analyse section
- Next Season Planner squad builder - greedy 15-player team from full 700+ player pool at 100m budget

**Should have (v1.24.x after validation):**
- GW1-8 next-season fixture heatmap - reuses existing HEAT-01 component; blocked on FPL publishing new-season fixtures (typically July)
- Early differential targeting overlay - ownership overlay on squad builder; depends on GW1-8 heatmap
- Transfer timing quality grading - foresight ratio as third process score component; higher complexity

**Defer (v2+):**
- Twitter/X monitoring - Azure datacenter IP permanent block from GitHub Actions; unworkable
- Multi-season trend view - requires season-over-season data persistence; out of scope
- Next-season xPts projections before fixture data exists - fabricated projections erode trust

**Carry-forward polish (v1.24, any order):**
- TRT-06: ChipToggle in RouteTreeTab
- TRT-02: Hits column cosmetic label fix in RouteTreeTab
- MinsRiskBadge: Wire onto SquadView, DecisionSummaryTab, GemTable column, PlayerComparisonModal

### Architecture Approach

The established architecture pattern (pipeline module to Blob artifact to Route Handler to TanStack hook to React component) applies uniformly to all four new features. SCRAPER-02 becomes transfer_news.py, called non-fatally from run.py mirroring the lineup_news.py pattern. Season Review aggregates entirely client-side from two existing hooks with no new Blob artifact. Next Season Planner adds buildPreSeasonSquad() to chip-modes.ts running client-side over the shared usePlayers() TanStack cache. Summer Window Tracker consumes a new useTransferNews() hook backed by transfer_news.json.

**Major components:**
1. pipeline/transfer_news.py - RSS-only scraper (Sky Sports, BBC Sport, optional Transfermarkt); writes transfer_news.json to Blob; non-fatal, no FPL bootstrap dependency, runs year-round
2. pipeline/player_matching.py - extracted shared utility (_match_player, _build_name_lookup) shared by both lineup_news.py and transfer_news.py
3. src/lib/decision-quality.ts - pure TypeScript computeDecisionQuality() function; grades process score A-D over already-fetched hook data; no new API route
4. src/components/accuracy/SeasonReviewTab.tsx - Season Review tab in Analyse section; sibling to BackTab.tsx
5. src/components/summer-window/SummerWindowTab.tsx - Summer Window tab in Analyse section; article feed grouped by tag
6. src/components/planner/NextSeasonPlannerTab.tsx - Next Season Planner tab in Plan section; buildPreSeasonSquad() + GW1-8 FDR heatmap

**Key type extensions needed in src/lib/types.ts:**
- Extend SeasonAnalytics with overallRank?, totalPoints?, seasonAvgPoints?
- Add DecisionQualityReport interface
- Add TransferNewsArticle, TransferNews interfaces
- Add new SubTab IDs (season-review, summer-window, next-season) - must be atomic with SECTIONS constant update in page.tsx

### Critical Pitfalls

1. **Full-pool greedy optimizer returns null at 100m ceiling (C-01)** - buildOptimalSquad() greedy does not backtrack; cold-start from 700+ players with tight budget frequently hits dead ends. Use buildPreSeasonSquad() with relaxed budget tolerance or, if null rate exceeds 20%, switch to Python-side ILP (PuLP) writing optimal_squad_next_season.json to Blob. Never reuse buildOptimalSquad() for this use case.

2. **FPL API is empty/structurally different off-season (C-02)** - After GW38: is_current false for all events; xPts_1gw is 0 for all players; element-summary per-GW history collapses to season-summary format. Add IS_OFF_SEASON gate in run.py; archive per-player element-summary in pipeline/archive_season.py before GW38 deadline (data permanently lost after rollover); gate all FDR-dependent components with placeholder.

3. **Season review early-GW data gaps (C-03)** - Blob snapshots only exist from the GW the pipeline first ran. Backfill from entry history picks API on first Season Review load; show data-available-from notice on header; mark all metrics with coverage range when backfill is incomplete.

4. **Twitter/X scraping impossible from GitHub Actions (C-04)** - Azure datacenter IPs permanently blocked by X (January 2025). No unofficial scraping approach works from CI runners. Exclude X from SCRAPER-02 scope entirely; RSS feeds cover the same signal with higher reliability.

5. **Decision quality score misleading without explicit methodology (C-06)** - Single-number actual_pts/xPts_pts is gameable, dominated by one triple-captain haul, and conflates model error with outcome variance. Frame as a process checklist, separate chip GWs from normal captain decisions, and label any numerical score as season variance with a visible methodology note.

---

## Implications for Roadmap

Architecture research defines a clear dependency-first build order. Phase 1 is free-standing; Phases 2 and 3 are parallel-eligible; Phase 4 depends on Phase 2; Phase 5 depends on Phase 2 for signing badges but core squad builder is independent.

### Phase 1: Polish Carry-Forwards
**Rationale:** Zero new infrastructure, no new types or routes. Establishes a clean CI baseline before larger changes. TRT-06, TRT-02, and MinsRiskBadge are UI-only changes that cannot regress off-season (no fixture dependency).
**Delivers:** ChipToggle in RouteTreeTab (TRT-06), Hits column label fix (TRT-02), MinsRiskBadge wired on 4 surfaces (SquadView, DecisionSummaryTab, GemTable column, PlayerComparisonModal)
**Avoids:** Introducing complexity before CI is green and scope is locked
**Research flag:** Skip - standard UI wiring patterns, no research needed

### Phase 2: SCRAPER-02 Pipeline + API Infrastructure
**Rationale:** Summer Window Tracker (Phase 4) and Next Season Planner signing badges (Phase 5) both depend on useTransferNews(). Season Review (Phase 3) is independent and can be built in parallel. Building the data layer before consumers avoids rework.
**Delivers:** pipeline/transfer_news.py, pipeline/player_matching.py, run.py wiring, GET /api/transfer-news, useTransferNews() hook, TransferNewsArticle/TransferNews types, seed pipeline/cache/transfer_news.json
**Uses:** feedparser>=6.0.12 (existing), Sky Sports RSS and BBC Sport RSS (no new library)
**Avoids:** Twitter/X scraping (C-04); merging into lineup_news.py (different schema, different off-season behaviour, different consumers)
**Research flag:** Skip - lineup_news.py is the direct implementation template; feedparser RSS integration is established

### Phase 3: Season Review + Decision Quality Score (parallel with Phase 2)
**Rationale:** No dependency on SCRAPER-02. Reuses useDecisionHistory and useSeasonAnalytics directly. Decision Quality Process Score must ship in the same phase as Season Review - they share the same data aggregation layer.
**Delivers:** SeasonAnalytics type extension, /api/season-analytics extended response (zero new HTTP calls), computeDecisionQuality() in decision-quality.ts, SeasonReviewTab component, SubTab + SECTIONS wiring in page.tsx
**Avoids:** Pre-computing process score pipeline-side (requires team ID; violates v1.0 No database decision); single-number luck/skill score (C-06); missing early-GW data gaps without explanation (C-03)
**Research flag:** Skip - extends existing hooks and types; methodology fully specified in FEATURES.md and ARCHITECTURE.md

### Phase 4: Summer Window Tracker
**Rationale:** Hard dependency on useTransferNews() from Phase 2. Low implementation cost once the data layer exists.
**Delivers:** SummerWindowTab component in src/components/summer-window/, wired into Analyse section SECTIONS constant
**Avoids:** Price speculation with no ownership denominator (C-05 - cap all off-season price signals at MEDIUM confidence); treating new signings as registered before FPL confirms them
**Research flag:** Skip - article-feed UI over structured JSON; standard component pattern

### Phase 5: Next Season Planner
**Rationale:** Core squad builder is independent of SCRAPER-02; signing badges are an optional enhancement. Placed last because it contains the highest-complexity new algorithm. Phases 2-4 confirm CI is stable before this phase begins.
**Delivers:** buildPreSeasonSquad() in chip-modes.ts, NextSeasonPlannerTab component, GW1-8 FDR heatmap (with not-yet-available empty state), signing badges from useTransferNews(), SubTab + SECTIONS wiring in page.tsx
**Uses:** usePlayers() (existing, shared TanStack cache - no new API route for core builder)
**Avoids:** Reusing buildOptimalSquad() for cold-start full-pool build (C-01); loading 700+ full MergedPlayer objects into browser state; showing current-season FDR fixtures for next-season GW1-8
**Research flag:** Needs research - greedy optimizer null rate on 100m full-pool build is the key unknown. Verify before writing UI layer. Design pipeline/suggest_squad.py (PuLP) fallback in advance.

### Phase Ordering Rationale

- Phase 1 first: free-standing, confirms CI green before introducing new types/routes/hooks
- Phases 2 and 3 parallel: Season Review has zero dependency on SCRAPER-02; both can progress without blocking each other
- Phase 4 after Phase 2: hard data dependency on useTransferNews(); low effort once data layer exists
- Phase 5 last: highest complexity, benefits from signing badge data from Phase 2, completes milestone after simpler features are validated

### Research Flags

**Needs phase research:**
- **Phase 5 (Next Season Planner):** The buildPreSeasonSquad() greedy algorithm failure rate on a 700-player 100m cold-start is unmeasured. Research must verify: (a) does relaxed-tolerance greedy return a valid squad reliably? (b) if not, what PuLP pipeline output schema is needed? Do not write the UI layer without confirming this.

**Standard patterns (skip phase research):**
- **Phase 1 (Polish):** UI-only changes; existing component patterns apply directly
- **Phase 2 (SCRAPER-02):** lineup_news.py is the direct template; feedparser + RSS is established
- **Phase 3 (Season Review):** Extends existing hooks and types; methodology fully specified
- **Phase 4 (Summer Window Tracker):** Article-feed UI over structured JSON; standard component pattern

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct requirements.txt and package.json inspection; all new libraries verified on PyPI with confirmed release dates |
| Features | MEDIUM-HIGH | FPL mechanics and API endpoints well-documented; decision quality grading methodology is novel and self-defined (no external standard) |
| Architecture | HIGH | All findings from direct codebase inspection of run.py, lineup_news.py, chip-modes.ts, types.ts, hooks, and routes; no inference required |
| Pitfalls | HIGH (pipeline/API), MEDIUM (Twitter/X) | Pipeline patterns and FPL API off-season behavior grounded in codebase + community docs; Twitter/X IP block volatile but multiple independent sources confirm it |

**Overall confidence:** HIGH

### Gaps to Address

- **Greedy optimizer null rate on full-pool 100m build:** buildOptimalSquad() failure mode documented (C-01) but actual null rate with 2025/26 player data is not measured. Phase 5 must validate this before UI work begins. If null rate exceeds 20%, switch to pipeline/suggest_squad.py (PuLP) serving a pre-computed Blob artifact.
- **GW1-8 fixture data availability timing:** Next-season fixtures typically released June/July. GW1-8 FDR heatmap and early differential targeting are blocked on FPL publishing new-season fixtures. Build empty-state handling first; fixture-dependent features self-activate once MergedPlayer.fixtures[] is populated.
- **Season archive window is time-sensitive:** pipeline/archive_season.py must run during the GW38 pipeline execution. If this phase ships after GW38 has already concluded, per-GW element-summary data becomes unavailable from the FPL API and cannot be recovered. This is the single time-sensitive delivery constraint in the milestone.
- **Decision quality grading thresholds are untested:** The A/B/C/D cutoffs (A >= 0.65, B >= 0.50, C >= 0.35, D < 0.35) and composite weighting are proposed by research but not validated against real data. Flag in the UI that the methodology is v1 and may be recalibrated after initial feedback.

---

## Sources

### Primary (HIGH confidence)
- pipeline/requirements.txt - confirmed existing Python library versions
- pipeline/lineup_news.py - Sky Sports/BBC RSS confirmed scraped; non-fatal wrapper pattern; player matching utilities
- pipeline/run.py - orchestration pattern; non-fatal module call structure; off-season baseline
- src/lib/types.ts - type union patterns; SubTab union; SeasonAnalytics structure
- src/lib/chip-modes.ts - buildOptimalSquad() greedy implementation; eligibility gate; null-on-failure behavior
- package.json - confirmed npm dependency set; no ILP solver present
- twikit PyPI v2.3.3 (pypi.org/project/twikit/) - Feb 2025; session-cookie auth pattern
- PuLP PyPI v3.3.1 (pypi.org/project/PuLP/) - May 2026; CBC bundled in wheel
- feedparser PyPI v6.0.12 (pypi.org/project/feedparser/) - Sep 2025; already in requirements.txt
- FPL ILP arxiv 2505.02170 (arxiv.org/html/2505.02170v1) - binary ILP formulation for FPL squad selection
- apply-maths.com: Linear Programming for Fantasy PL - ILP constraint reference

### Secondary (MEDIUM confidence)
- FPLOptimized: Season Highlights - foresight/hindsight optimal ratio; process vs outcome framework
- PLOS ONE: Identification of skill in FPL (pmc.ncbi.nlm.nih.gov/articles/PMC7928501/) - skill = 22.1 pts/year; variance dominates rank
- AlpsCode: Hindsight Optimization - ghost-ship team experiment; process vs outcome
- FPL Copilot luck/skill methodology - xPts replay approach; limitations of single-manager assessment
- FPL Core Blog: Price Algorithm 7-part series - ownership-denominator threshold; sell-on tax math
- scrapfly.io: How to Scrape X.com in 2026 - Azure datacenter IP permanent ban confirmed
- eirikur.dev: FPL and DP - greedy vs ILP approaches compared
- FPL API community guides (Oliver Looney, GameChange) - off-season API changes; element-summary structure

### Tertiary (LOW confidence - validate during implementation)
- DEV.to: Scraping Twitter in 2025 - X API pricing tiers
- FPL API community note on element-summary season rollover - per-GW history unavailable after season end; undocumented by FPL officially

---

*Research completed: 2026-05-18*
*Ready for roadmap: yes*
