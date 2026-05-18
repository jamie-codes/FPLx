# Feature Research

**Domain:** FPL analytics web app — end-of-season review, off-season planning, summer window intelligence
**Researched:** 2026-05-18
**Confidence:** MEDIUM-HIGH (FPL mechanics well-documented; decision quality grading is emergent/community-defined rather than standardised)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the FPL manager community treats as baseline for any season-review or planning tool. Missing these makes the feature feel incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Total points + final rank display | Every season-review product shows this — it is the primary success metric | LOW | Already available from FPL API `/api/entry/{team_id}/history/` |
| Captain points summary (total, hit rate) | Captain accounts for ~25% of total season score per FPL Statistico data; every manager wants to know how well they captained | LOW | Already computed per-GW in existing `captain_snapshots.py`; needs season aggregation |
| Chip timeline (when played, points return vs GW average) | Standard FPL wrap feature — official FPL season review includes it; chip ROI is universally tracked | MEDIUM | Chip history in FPL API `entry_history`; ROI = manager GW score vs GW average when chip played |
| Transfer net gain/loss | Captures whether active management helped or hurt across a full season | MEDIUM | `transfer_snapshots.py` pipeline already exists (v1.20); needs season aggregation across all GWs |
| Rank trajectory (GW-by-GW) | Managers care about trend not just final rank; "did I recover from the bad GW?" | LOW | SPARK-01 rank sparklines already shipped in v1.21; season aggregation is an extension |
| GW1–8 fixture heatmap for new season | Standard pre-season planning surface — managers need fixture difficulty before committing £100m | MEDIUM | Existing heatmap engine covers current season; next-season fixture data is a dependency (available ~July) |
| Full-pool squad builder (100m, 15 players, 3-per-club cap) | Any serious pre-season planning tool does this; FPL Review, FPLOptimized both offer it | HIGH | Constraint-based optimisation with 700+ players is infeasible brute-force; ILP algorithm required |
| News feed for confirmed new signings | Off-season value requires knowing who has signed where before planning a squad | MEDIUM | No structured FPL API source for rumours; requires scraping Sky Sports / BBC Sport RSS |

### Differentiators (Competitive Advantage)

Features that go beyond existing tools and align with the app's analytical identity — grounded in the app's existing xPts model rather than raw points.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Decision quality process score (xPts-based, not rank-based) | Separates luck from skill — tells the manager whether decisions were +EV independent of outcomes; no standard industry tool does this for personal accounts | HIGH | Must define own methodology; key inputs are captain EV rate, transfer foresight ratio, chip timing ROI |
| Captain decision grading per GW | Specific, actionable version of decision quality — was this GW's captain the model's top pick at deadline time? | MEDIUM | Requires joining captain snapshot data with xPts model predictions at the time of the decision; existing BackTab captain backtester (BACK-01) already shows per-GW regret — season aggregate is the grading component |
| Transfer timing quality (foresight ratio) | Did the transfer produce value in the next 5 GWs? Foresight optimal ratio used by FPLOptimized but rare in personal tools | HIGH | Requires joining `transfer_snapshots.py` data with actual GW points outcomes post-transfer; conflates luck and skill somewhat (injury can nullify a good process pick) |
| Composite process score grading (A–D letter grade) | Gives the manager a single memorable number representing decision quality across a season; letter grades are more emotionally legible than percentages | MEDIUM | Scoring function: 40% captain EV rate + 40% transfer foresight ratio + 20% chip timing ROI |
| Summer signing early-mover flags | Signals which newly arrived players are likely early price risers based on ownership velocity + fixtures + role confirmation | HIGH | Requires integrating transfer news (SCRAPER-02) with existing price-change prediction signals (PRC-01, v1.8); news scraping is upstream dependency |
| GW1–8 early differential targeting in squad builder | Surfaces low-ownership players with good early fixtures as value picks inside budget constraint | MEDIUM | Adds ownership overlay to fixture heatmap; depends on Next Season Planner data being available |
| Bench points left over full season | Shows whether bench ordering decisions were systematically costing points; a known pain point for most managers | MEDIUM | Pipeline already computes bench points left per GW in GW Review; needs season aggregation into summary |

### Anti-Features (Commonly Requested, Often Problematic)

| Anti-Feature | Why Requested | Why Problematic | Better Alternative |
|--------------|---------------|-----------------|--------------------|
| Twitter/X scraping for team news | FPL community accounts (@BenCrellin, @FPL_Rockstar, @FFScout) have high signal-to-noise ratio for injury updates | Twitter API costs $100+/month; Nitter is dead (X shut down public instances); twscrape requires credential account pools with high maintenance and ToS violation risk; X Corp. v. Bright Data (2024) establishes legal exposure | RSS feeds from Sky Sports and BBC Sport cover 90%+ of the same news within hours; use these as primary sources instead |
| Full hindsight season reconstruction | "What if I had made perfect picks every GW?" is satisfying to compute | Academic research (AlpsCode hindsight study) shows a ghost-ship team (same squad all season, optimal captain only) can rank in top ~6%; hindsight tells the manager nothing actionable about future decisions | Show decision quality deltas (was your decision better than a random pick from the same player pool?) rather than perfect hindsight reconstruction |
| Real-time price tracking (in-season duplicate) | Managers want to know when to buy before a price rise | In-season price change prediction already covered by PRC-01 (v1.8); building a parallel summer-window version duplicates functionality | Extend PRC-01 with a "season start" mode flag; do not build a separate price tracker |
| Next-season xPts projections before season data exists | Managers want projections when building their GW1 squad | No Understat data, no fixture difficulty, no minutes history for new signings before July; projections would be fabricated | Use previous season xPts as proxy for established players; flag new signings as "pre-season unknown" with price + rumoured role only |
| Automated transfer recommendations for next season | Natural extension of current transfer engine | No fixture data, no team news, no price changes to react to during the off-season; the engine has no useful input signal | Reserve transfer engine for in-season; Next Season Planner is a standalone squad-building tool, not a transfer engine |

---

## Feature Dependencies

```
Season Review (summary card)
    └──requires──> FPL API entry history endpoint (/api/entry/{team_id}/history/)
    └──requires──> captain_snapshots.py (existing, v1.16)
    └──requires──> transfer_snapshots.py (existing, v1.20)
    └──requires──> GW Review API (existing, v1.17)

Decision Quality Process Score
    └──requires──> Season Review (same GW-by-GW data layer)
    └──requires──> xPts model predictions at decision time (existing pipeline output)
    └──enhances──> Captain Backtester BACK-01 (existing, v1.16) — reuses same snapshot trail
    └──enhances──> Transfer Regret Backtester BACK-02 (existing, v1.20) — reuses transfer delta data

SCRAPER-02 (multi-source news scraper)
    └──requires──> Sky Sports Football RSS (https://www.skysports.com/rss/12040)
    └──requires──> BBC Sport Football RSS (https://feeds.bbci.co.uk/sport/football/rss.xml)
    └──optional──> Twitter/X (fragile, ToS risk — do not block on this)
    └──extends──> existing lineup_news.py pipeline (v1.22) — seasonal mode extension, not ground-up rebuild

Summer Window Tracker UI
    └──requires──> SCRAPER-02 (no news feed = no content)
    └──requires──> FPL bootstrap-static (to match player names to FPL element IDs)
    └──enhances──> Next Season Planner — confirms confirmed role + price for new arrivals
    └──enhances──> PRC-01 price change predictor — feeds "new signing hype" signal

Next Season Planner (squad builder)
    └──requires──> FPL bootstrap-static (player pool + prices — available year-round)
    └──requires──> Next-season fixture list (typically released ~July; show "fixtures pending" empty state)
    └──requires──> ILP optimisation algorithm — new, not in existing greedy engine
    └──does NOT reuse──> buildOptimalSquad() greedy engine (incorrect for global optimisation)

GW1–8 Next-Season Fixture Heatmap
    └──requires──> Next-season fixture data from FPL API
    └──reuses──> Existing HeatMapRow component (HEAT-01, v1.17) with new data source
    └──enhances──> Next Season Planner — surfaces differential targets inside squad builder
```

### Dependency Notes

- **Decision Quality Process Score is co-located with Season Review:** Both consume the same per-GW aggregation layer; building them in separate phases creates redundant data-fetching work. Ship in the same phase.
- **SCRAPER-02 must precede Summer Window Tracker:** The tracker has no content without a news pipeline. Both can ship in the same phase if SCRAPER-02 is built first within the phase.
- **Next Season Planner has a data availability constraint:** `bootstrap-static` is available year-round but next-season prices are typically released late June. Squad builder UI should handle "prices not yet confirmed" gracefully with a dated note rather than blocking launch.
- **SCRAPER-02 is an extension of lineup_news.py, not a replacement:** The v1.22 scraper already handles Sky Sports and BBC Sport for in-season team news. SCRAPER-02 adds a summer/transfer-window mode that captures signing confirmations, pre-season fitness updates, and club-level rotation signals — same sources, different content filters.

---

## MVP Definition

### Launch With (v1.24)

Minimum viable feature set to make the milestone meaningful.

- [ ] **Season Review summary card** — total rank, captain hit rate, chip ROI, transfer net gain/loss — answers "how did I do this season?" in one screen; data is already available
- [ ] **Decision quality process score** — composite A–D grade separating process from outcome; this is the differentiating feature that elevates the season review from a stats dump
- [ ] **SCRAPER-02 (Sky Sports + BBC Sport RSS)** — automated ingestion of summer transfer and fitness news; RSS feeds are stable and structured; extends existing lineup_news.py pipeline
- [ ] **Summer Window Tracker** — feed of confirmed PL signings matched to FPL IDs, early-mover flag based on ownership velocity + fixtures
- [ ] **Next Season Planner — squad builder** — ILP-optimised 15-player team from full 700+ player pool at 100m budget; most-requested pre-season feature across FPL tools ecosystem

### Add After Validation (v1.24.x)

- [ ] **GW1–8 next-season fixture heatmap** — can reuse existing component; add when fixture data becomes available (July); low implementation cost once data is ready
- [ ] **Early differential targeting overlay** — annotates squad builder results with low-ownership options that have excellent early fixtures; depends on GW1–8 heatmap being available
- [ ] **Transfer timing quality grading** — more sophisticated than hit-rate; requires historical xPts snapshot comparison at transfer date; medium complexity addition to the process score

### Future Consideration (v2+)

- [ ] **Twitter/X monitoring** — only viable if X API pricing changes or a stable free alternative emerges; current risk is too high for a personal tool
- [ ] **Multi-season trend view** — requires season-over-season data persistence; out of scope for this architecture

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Season Review summary card | HIGH | LOW (data already exists in pipeline) | P1 |
| Decision quality process score | HIGH | MEDIUM (methodology novel; data layer shared with season review) | P1 |
| SCRAPER-02 (RSS-based) | HIGH | MEDIUM (extends existing scraper) | P1 |
| Summer Window Tracker UI | HIGH | LOW (UI over SCRAPER-02 data; match name to FPL ID) | P1 |
| Next Season Planner — squad builder | HIGH | HIGH (ILP algorithm is new) | P1 |
| GW1–8 next-season heatmap | MEDIUM | LOW (reuses existing heatmap component) | P2 |
| Early differential targeting | MEDIUM | MEDIUM (ownership overlay on squad builder) | P2 |
| Transfer timing quality grading | MEDIUM | HIGH (historical snapshot comparison needed) | P3 |
| Twitter/X monitoring | LOW | HIGH (fragile, ToS risk, maintenance cost) | P3 |

**Priority key:** P1 = must have for v1.24 launch; P2 = add in v1.24.x after core validated; P3 = future consideration

---

## Decision Quality Process Score — Methodology Detail

This is the most novel feature; a clear methodology is essential to avoid building something unmeasurable.

### The core problem: rank conflates luck and skill

Final rank is dominated by variance. Academic research (PLOS ONE, n=~1M managers) found each additional year of FPL experience is worth only 22.1 additional points — skill exists but is small relative to variance. A "ghost-ship" team (same squad all season, only captain changed) can rank top 6% in some seasons. Therefore rank alone cannot grade decision quality.

### Three measurable process proxies

**1. Captain EV Rate (MEDIUM confidence)**

Per GW: Was the captain the highest-xPts candidate in the model at deadline time?
- Season score: % of GWs where captain was the model's top pick, or within the top-2 (acknowledging that #1 vs #2 is often within the model's uncertainty margin)
- Data source: `captain_picks_gw{N}.json` snapshots (existing pipeline, v1.16) joined with `merged_players.json` xPts at the same pipeline run
- Existing BACK-01 captain backtester already shows per-GW regret; season aggregate of "was this an EV-positive pick?" is the captain process score component
- Ceiling: Only computable for GWs where a snapshot was captured; sparse coverage in early season

**2. Transfer Foresight Ratio (LOW-MEDIUM confidence)**

Did the player brought in outperform the player sold over the following 5 GWs?
- Season score: Number of transfers where (bought player next-5-GW points > sold player next-5-GW points) / total transfers made
- Mirrors the "Foresight Optimal Ratio" used by FPLOptimized — the closest thing to a community standard for transfer decision quality
- Data source: `transfer_snapshots.py` (existing, v1.20) joined with actual GW points from FPL API element-summary history
- Honest caveat: conflates luck and skill somewhat — a good process pick can underperform due to injury after the transfer. Flag this in the UI.

**3. Chip Timing ROI (MEDIUM confidence)**

For each chip played: did the manager's score exceed the expected benchmark?
- Triple Captain: (manager's TC return) / (average TC return among all TC users in that GW, from FPL API chip stats)
- Bench Boost: bench points scored vs. average bench points in that GW (FPL API provides GW averages)
- Wildcard: compare the week-1 squad built post-WC against the GW average squad score for the following 4 GWs
- Free Hit: manager's FH week score vs. GW average
- Score: average ROI across all chips played; normalised to 0–1

**Composite grading function:**

```
ProcessScore = (0.40 × CaptainEVRate) + (0.40 × TransferForesightRatio) + (0.20 × ChipROI)
```

Grade tiers:
- A (80–100): Consistently +EV decisions, chips well-timed
- B (60–79): More good than bad; some luck dependence
- C (40–59): Mixed — some positive processes, some reactive decisions
- D (<40): Outcomes driven primarily by variance, not process

**What NOT to include in process score:**
- Final rank: dominated by variance
- Total points: dominated by template ownership and price
- Transfer count: volume is not quality

---

## Full-Pool Squad Optimiser — Algorithm Detail

### Why brute-force is infeasible

Selecting 15 from ~700 players: C(700, 15) ≈ 3.7 × 10^27 combinations. Even filtering to ~200 realistic candidates, C(200, 15) ≈ 6.6 × 10^23. The existing `optimiseLineup()` C(15,11) = 1,365 subsets works because it operates on the manager's 15-player squad, not the full pool.

### Recommended approach: Integer Linear Programming (ILP)

FPL community consensus across multiple open-source solvers (`fpl-solver`, `FPL-Optimization-Tools`, `fpl-optimiser` on GitHub) is ILP, not greedy and not DP.

Why ILP over the existing greedy `buildOptimalSquad()`:
- Greedy does not guarantee global optimum under simultaneously binding constraints (budget + formation + club cap)
- ILP with CBC backend (via PuLP) finds the provably optimal solution in under 5 seconds for this problem size — no WASM solver needed

Why ILP over dynamic programming:
- DP (6-dimensional cache key: budget × index × goalies × defenders × midfielders × forwards) is theoretically correct but memory-intensive at 1000 budget units precision with 700 players
- ILP is cleaner to express, easier to maintain, and equally fast in practice

**Python implementation via PuLP (already in the ecosystem; add as pipeline dependency):**

```python
from pulp import LpProblem, LpVariable, LpMaximize, lpSum, value, PULP_CBC_CMD

# Decision variables: x[i] = 1 if player i selected
x = [LpVariable(f"x_{i}", cat="Binary") for i in range(len(players))]

prob = LpProblem("fpl_squad", LpMaximize)
prob += lpSum(players[i]["xPts_5gw"] * x[i] for i in range(n))  # objective

# Constraints
prob += lpSum(x) == 15                           # squad size
prob += lpSum(x[i] for i in GK_indices) == 2    # 2 goalkeepers
prob += lpSum(x[i] for i in DEF_indices) == 5   # 5 defenders
prob += lpSum(x[i] for i in MID_indices) == 5   # 5 midfielders
prob += lpSum(x[i] for i in FWD_indices) == 3   # 3 forwards
prob += lpSum(players[i]["now_cost"] * x[i]) <= 1000  # 100.0m budget in 0.1m units
for club_id, club_players in by_club.items():
    prob += lpSum(x[i] for i in club_players) <= 3    # 3-per-club cap
```

**Objective function options:**
- Pre-season (July+): Maximise `xPts_5gw` using fixture data from new season bootstrap-static
- Pre-season (before fixtures released): Maximise previous season total points as proxy ranking
- For new signings without history: flag as "no history — price-only estimate"

**Formation validity:** The squad builder selects 15 players. Starting 11 / bench ordering is a subsequent step using the existing `optimiseLineup()` engine — no change needed there.

---

## Summer Window Tracker — Source Details

### Sky Sports RSS
- URL: `https://www.skysports.com/rss/12040` (Football news feed)
- Format: Standard RSS 2.0 with `<title>`, `<description>`, `<pubDate>`, `<link>` fields
- Coverage: Transfer news, confirmed signings, injury/fitness updates, pre-season team news
- Update frequency: Multiple times daily during transfer windows
- Reliability: HIGH — Sky Sports has maintained this RSS feed for years; no authentication required
- FPL-relevant filter: Keywords include player names, "signs", "agrees", "completes", "pre-season", "injury", "fitness"

### BBC Sport Football RSS
- URL: `https://feeds.bbci.co.uk/sport/football/rss.xml`
- Format: Standard RSS 2.0
- Coverage: Confirmed transfers, Premier League player news, fitness updates
- Update frequency: Multiple times daily
- Reliability: HIGH — BBC maintains these feeds as public infrastructure

### Twitter/X
- Status: NOT recommended as primary source
- Nitter is dead (X shut down all public instances)
- Official X API: Basic tier costs $100+/month; Elevated $5,000+/month
- twscrape (authenticated scraping): Requires credential pools, high maintenance, ToS violation exposure
- Recommendation: Defer entirely to post-v1.24; document as a known gap in the feature
- If ever added: Target only official Premier League club Twitter accounts via a managed scraping service (Apify), not individual FPL community accounts

### FPL API (new signing confirmation)
- When FPL registers a new signing, the player appears in `bootstrap-static` elements array with `status`, `team`, `now_cost`, `element_type`
- This is the authoritative source for confirming FPL registration and initial price
- Summer Window Tracker cross-references RSS news entities against `bootstrap-static` to confirm FPL ID match and current price

### Early-mover price signal
The app already has the component parts. Early-mover flag = conjunction of:
1. FPL registration confirmed (player in bootstrap-static)
2. Ownership climbing rapidly (net transfers above threshold — existing PRC-01 logic)
3. Favourable GW1-4 fixtures (depends on next-season fixture data)
4. Role confirmation signal from scraped news ("first choice", "starter", "handed #9 shirt")

Components 1, 2, 3 already exist. Component 4 is new (news-derived role signal from SCRAPER-02).

---

## Competitor Feature Analysis

| Feature | FPL Review | FPL Statistico | FPLOptimized | This App's Approach |
|---------|------------|----------------|--------------|---------------------|
| Season summary card | Yes (full suite) | Yes (comprehensive stats) | Yes (highlights page) | Tied to existing xPts model — more analytically grounded than raw-points view |
| Decision quality grade | No formal grade | Implicit in captain % only | Foresight/hindsight ratio shown | Composite process score (A–D) — novel; no existing personal tool does this |
| Squad builder (full pool) | Yes (ILP-based) | No | Yes | ILP via PuLP; first time this app enters full-pool territory |
| Summer news feed / signing tracker | No | No | No | Differentiator — integrates with price prediction pipeline |
| GW1–8 fixture heatmap | External FDR tool | No | Yes (fixture page) | Reuse existing HEAT-01 component with next-season data |

---

## Carry-Forward Items (v1.24 also includes)

The milestone also includes carry-forward polish items that are NOT new features but must be scheduled:

| Item | Description | Complexity |
|------|-------------|------------|
| TRT-06 | ChipToggle in RouteTreeTab (deferred from v1.9) | LOW |
| TRT-02 | Hits column cosmetic fix in RouteTreeTab | LOW |
| MinsRiskBadge | Wire onto SquadView, DecisionSummaryTab, GemTable column, PlayerComparisonModal | MEDIUM |

These are independent of the four main features and can be shipped in any order.

---

## Sources

- [AlpsCode: Intro to FPL Analytics](https://alpscode.com/blog/intro-to-fpl-analytics/) — EV framework for decision quality in FPL
- [AlpsCode: Hindsight Optimization for FPL](https://alpscode.com/blog/hindsight-optimization/) — process vs. outcome analysis; ghost-ship team experiment
- [FPLOptimized: Season Highlights](https://fploptimized.com/highlights.html) — foresight/hindsight optimal ratio metrics; predicted vs. realized points framework
- [FPL Statistico](https://www.anewpla.net/fpl/report/lander.php) — captain %, chip performance, bench analysis reference
- [PLOS ONE: Identification of skill in FPL](https://pmc.ncbi.nlm.nih.gov/articles/PMC7928501/) — academic evidence that experience = 22.1 pts/year; skill exists but is small relative to variance
- [LiveFPL: FPL Price Changes](https://livefpl.com/blog/fpl-price-changes) — price change algorithm: net transfer velocity, ownership threshold mechanics
- [eirikur.dev: FPL and DP](https://eirikur.dev/blog/2024-08-05-fpl-and-dp/) — dynamic programming approach; brute-force infeasibility analysis
- [GitHub: FPL-Optimization-Tools (sertalpbilal)](https://github.com/sertalpbilal/FPL-Optimization-Tools) — ILP as community standard approach
- [apply-maths.com: Linear Programming for Fantasy PL](https://apply-maths.com/en/linear-programming-for-fantasy-pl) — ILP constraints reference (2 GK, 5 DEF, 5 MID, 3 FWD, 100m, 3-per-club)
- [Sky Sports RSS Feeds](https://rss.feedspot.com/sky_sports_rss_feeds/) — RSS feed availability confirmation
- [BBC Sport Football RSS](https://feeds.bbci.co.uk/sport/football/rss.xml) — direct BBC feed URL (public, no auth)
- [FPLGameweek: Twitter accounts for FPL](https://www.fplgameweek.com/articles/fpl-twitter-accounts-and-use/) — key accounts and Twitter signal value
- [scrapfly.io: How to Scrape X.com in 2026](https://scrapfly.io/blog/posts/how-to-scrape-twitter) — current Twitter scraping status; Nitter dead; account pools required
- [FPL Basics: How to pick a squad](https://www.premierleague.com/en/news/2174419/fpl-basics-how-to-pick-a-squad) — official 100m budget, 3-per-club, squad composition constraints
- [FPL API Guide](https://www.game-change.co.uk/2023/02/10/a-complete-guide-to-the-fantasy-premier-league-fpl-api/) — bootstrap-static as pre-season player data source

---

*Feature research for: FPL Analyst v1.24 — End of Season & Off-Season Intelligence*
*Researched: 2026-05-18*
