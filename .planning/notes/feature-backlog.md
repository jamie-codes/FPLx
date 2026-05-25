# FPL Analyst — Feature Backlog

**Last updated:** 2026-05-25
**Source:** Manager-curated feature roadmap document
**Status:** Backlog — not yet scoped into milestones

Features already shipped or in-progress are excluded. v1.7 (phases 47-51) covers: Fixture Swing Detector, CS Probability, Explainable xPts, Lifecycle Labels, Transfer Opportunity Cost Simulator, Weekly Decision Summary.

---

## Delivery Roadmap (agreed 2026-05-25)

| Phase | Window | Features |
|-------|--------|---------|
| A | Now → end June | PERFECT-01, FLOOR-01, ROUTES-01, STREAK-01, BPS-01 |
| B | July | HEAT-01, MIN-01, TREE-01 / PLAN-01 |
| C | Late July (pre-GW1) | PRC-01, BENCH-01 |
| D | Early season GW1–GW5 | LIVE-01, EO-01, TC-01, BB-01 |
| E | Mid-season GW6+ | ML-01, BACK-01, FH-01, WC-01 |

**New features added 2026-05-25** (not in original backlog):
- **PERFECT-01** — Perfect GW Team retrospective (pitch graphic, best XI by position, optimal captain)
- **FLOOR-01** — Consistent Scorer Profile ("safe bet" players with a reliable points floor)
- **ROUTES-01** — Multiple Routes to Points (penalty/set-piece/assist flags, route multiplier on xPts)
- **STREAK-01** — Seasonal Streak / Form Run Detector (identifies players entering a scoring run)

---

## Priority 1 — Highest decision value (build next after v1.7)

### MIN-01: Minutes Confidence Engine
**Problem:** Player projections are unreliable when start probability is uncertain. Rotation-prone players (Pep roulette, Slot rotation, injury ramps) need a probability distribution, not a flat assumption.
**Scope:**
- Classification: Nailed / Likely start / Rotation risk / Sub risk / Returning from injury / Unavailable
- Start probability % and 60+ minute probability % per player
- Inputs: last 5 starts, recent minutes, substitution patterns, fixture congestion, injury flags
- Surfaces everywhere: transfers, captaincy, bench order, chip usage, Free Hit, Wildcard
- Output fields: `start_prob`, `mins_60_prob`, `rotation_label`
**Implementation:** Expand existing `xmins.py` pipeline module. Already has `mins_risk` classification — extend with confidence intervals and sub-risk detection.
**Priority:** Must-have
**Estimated effort:** Medium-High

---

### BPS-01: Bonus Point Predictor
**Problem:** xG/xA alone misses players who regularly collect bonus — defenders, GKs, set-piece takers, and talisman attackers. Bonus can be 2-3 pts per GW for the right players.
**Scope:**
- Historical BPS analysis (goals, assists, CS, key passes, big chances created, saves, defensive actions)
- "Bonus magnet" flag for players who disproportionately collect bonus
- Per-player bonus EV separate from goal/assist xPts
- CS-conditional bonus modelling (defenders get more bonus when they keep CSs)
**Implementation:** New `pipeline/bonus.py` module. Bonus EV added to `xPts_components_1gw` as `bonus_pts` (currently a flat BONUS_RATE — replace with per-player learned rate).
**Priority:** Must-have
**Estimated effort:** Medium

---

### PRC-01: Price Change Predictor
**Problem:** Current app shows price trend (cost_change_event) but has no forward-looking price change signal. Managers need to know whether to move early or wait.
**Scope:**
- Net transfer velocity tracker (transfers in - transfers out per player)
- Rise/fall prediction with confidence % and projected timing (tonight / this week)
- Price rise risk flag for players I don't own (FOMO alert)
- Price fall risk flag for players I own (sell before drop)
- Output: `price_rise_risk`, `price_fall_risk`, `net_transfers_delta`, `price_direction_confidence`
**Data needed:** FPL API `transfers` endpoint (transfers_in_event, transfers_out_event per player)
**Implementation:** New `pipeline/price_changes.py`. FPL already exposes transfer volumes per player per GW.
**Top-3 recommendation:** Yes — identified as highest-priority new feature alongside lineup scraper and mini-league tracker.
**Priority:** Must-have
**Estimated effort:** Medium

---

### BENCH-01: Bench Order Optimiser with Autosub Logic
**Problem:** Current optimiser picks best XI but bench order is set manually. Autosubs depend on formation rules — highest bench xPts ≠ best first sub.
**Scope:**
- Given starting XI + bench 4, compute optimal bench ordering
- Inputs: player xPts, start probability, 60+ minute probability, formation constraints, autosub legality (must maintain valid formation), BGW/DGW data
- Output: ranked bench [1st sub, 2nd sub, 3rd sub, GK] with autosub EV per slot
- Surfaces in: Squad optimiser panel, Weekly Decision Summary (phase 51)
**Implementation:** Pure TypeScript extension of `optimise-lineup.ts`. Autosub EV = P(starter DNP) × P(sub maintains formation) × sub_xPts.
**Priority:** Must-have
**Estimated effort:** Medium

---

## Priority 2 — Strategic edge features

### LIVE-01: Live GW Score Engine
**Problem:** After matches finish, the official FPL app doesn't update until the next morning. Managers can't see: their actual live score (including provisional bonus), which bench player has been auto-subbed in, whether the vice-captain gets the 2× multiplier because the captain didn't play, or their live overall rank. livefpl.net solves this — we should too.
**Scope:**
- FPL ID input (stored in localStorage; one-time entry)
- Fetch live player stats: `event/{gw}/live/` (provisional goals/assists/bonus/CS per player)
- Fetch user picks: `entry/{id}/event/{gw}/picks/` (returns `picks[]`, `automatic_subs[]`, `active_chip`, `entry_history`)
- Compute live XI:
  - Apply `automatic_subs` from the API (FPL already computes which subs occurred — display them)
  - If captain played 0 minutes: show VC with 2× (or 3× if TC chip)
  - If Bench Boost active: all 15 count, no subs needed
  - Sum live points for XI after captain multiplier
- Display:
  - Live squad grid: starters + bench, with sub-in/sub-out indicators
  - Live total (pts), captain/VC indicator, chip active
  - Per-player breakdown: goals/assists/bonus/CS/saves as live provisional values
  - Live overall rank (from `entry_history.overall_rank` if available, or omit until official)
  - Autosub log: "Salah (0 min) → Jota (auto-sub)")
- Note: provisional bonus changes until official processing — label it "provisional"
**FPL API endpoints (all already proxied via `/api/fpl/[...proxy]`):**
  - `bootstrap-static/` — player metadata
  - `event/{gw}/live/` — live stats per player
  - `entry/{id}/event/{gw}/picks/` — user picks + automatic_subs + chip
**Key edge cases:**
  - Captain played 0 mins → VC 2× (or 3× on TC); VC played 0 mins too → no multiplier applied
  - Bench Boost: no subs; all 15 score normally
  - Automatic subs come pre-computed from FPL API — display, don't recompute
  - DGW: players may have 2 fixtures; live endpoint aggregates both
**Implementation:** New panel in Squad section ("Live GW" tab). Pure client-side calculation from API data. FPL ID stored in localStorage. Polling every 60s while a fixture is live (use bootstrap `events[].finished` to detect).
**Priority:** High — most requested GW-day experience gap
**Estimated effort:** Medium

---

### ML-01: Mini-League Rival Tracker
**Problem:** Best FPL move depends on context: protecting rank, chasing rank, or winning a mini-league. App has no rival awareness.
**Scope:**
- Input: league ID → fetch all rival team IDs via FPL API
- Per-rival: squad, captain, transfers in/out, chip status, shared players, gap to user
- Differential opportunity: players I own that rivals don't, and vice versa
- Blocking vs attacking moves: flag when a rival owns a player I'm targeting
- Output table: Rival | Gap | Chips Left | Shared Players | Biggest Threat | Best Counter
**Data needed:** FPL `leagues-classic` and `entry` APIs (already proxied at `/api/fpl/[...proxy]`)
**Privacy:** Personal tool — league ID input by user, data for their league only.
**Top-3 recommendation:** Yes — identified as highest-priority new feature.
**Priority:** Must-have / Strategic edge
**Estimated effort:** High

---

### EO-01: Effective Ownership & Rank Protection Mode
**Problem:** Highest xPts ≠ best strategic move. Captaining the 60% EO pick is rank-protecting; captaining the 5% EO pick is rank-chasing. App has no EO-adjusted decision mode.
**Scope:**
- EO% per player (estimated ownership among top 10k, not overall ownership)
- Captain EV adjusted for EO: expected rank movement from captain pick, not just raw xPts
- Mode toggle: Max xPts / Protect Rank / Chase Rank / Mini-league Leader / Differential Aggressive
- Output: player EO%, ownership impact label (Dangerous to fade / High upside differential / Moderate shield)
**Data needed:** Top-10k ownership requires FPL dream team or community scraping. Approximate via overall `selected_by_percent` weighted for high-ownership skew.
**Priority:** Must-have / Strategic edge
**Estimated effort:** Medium-High

---

### TREE-01: Transfer Route Planner (Multi-Week Tree)
**Problem:** A transfer good this week may block a better path later. Current planner shows 1-week suggestions.
**Scope:**
- Multi-week transfer tree: show 2-3 branching transfer sequences
- Each path: GW-by-GW FT bank, hit cost, projected 3/5/8 GW xPts per path
- Compare paths side-by-side in a tree or table layout
- Chip interaction: which paths preserve/use WC, FH, BB, TC optimally
**Relationship:** Extends existing `planning-engine.ts` and `generatePlan()`. The GW Planner (v1.3) already does 1-5 GW sequences — this adds xPts comparison across paths.
**Priority:** Must-have
**Estimated effort:** High

---

### MC-01: Monte Carlo Gameweek Simulator
**Problem:** Single xPts values hide outcome distribution. P(haul) and P(blank) matter for differential captains and chip decisions.
**Scope:**
- 10,000 simulations per player per GW using goal/assist/CS probability distributions
- Output: mean, median, 10th/90th percentile, blank % (≤2 pts), haul % (≥10 pts), haul15 % (≥15 pts)
- Useful for: TC decision (highest ceiling), BB (bench upside), differential captain (P(haul) vs P(blank))
- Monte Carlo rank simulator: 5-GW sims of rank trajectory given current XI vs alternatives
**Implementation:** Pure TypeScript or Python. Poisson for goals, Bernoulli for CS — same distributions already in xPts model.
**Priority:** Advanced / Strategic edge
**Estimated effort:** High

---

## Priority 3 — Advanced modelling

### TC-01: Triple Captain Decision Engine
**Problem:** TC is often used emotionally. No structured comparison of TC timing vs saving the chip.
**Scope:**
- Rank all upcoming DGW candidates by TC rating (xPts × 2 + ceiling bonus)
- Compare TC this GW vs best projected TC window in next 8 GWs
- Start risk factor (rotation-prone players are penalised heavily)
- Output: GW | Player | Fixtures | TC xPts | 90th Percentile | Start Risk | TC Rating
**Implementation:** Extends chip-strategy-engine.ts TC scoring (`computeTCScore` already exists — add comparison table).
**Priority:** Nice-to-have / Strategic edge
**Estimated effort:** Medium

---

### BB-01: Bench Boost Readiness Score
**Problem:** BB decision should be based on full 15-man squad strength, not just fixture ease. No current readiness signal.
**Scope:**
- Total bench xPts (all 4 bench players)
- Number of doublers in 15-man squad
- Start probability for all 15 (weak bench = low BB score)
- Hit cost to prepare bench (negative modifier)
- Post-BB squad damage (bench players leave after BB — does it damage WC/FH plans?)
- Output: BB readiness score 0-100, recommended GW window
**Implementation:** Extends `computeBBScore` in `chip-strategy-engine.ts` (already exists — add bench xPts signal from BENCH-01).
**Priority:** Must-have
**Estimated effort:** Medium

---

### FH-01: Free Hit Squad Builder (Full Pool)
**Problem:** Current `buildOptimalSquad()` optimises within the squad. FH should solve from the full 700+ player pool cold.
**Scope:**
- Budget: 100m (or current bank + squad value)
- Constraints: 3-per-club cap, formation validity, 1 GK
- Optimise for 1-GW xPts (FH is always single GW)
- Squad styles: Template FH / Differential FH / Ceiling FH / Safe FH / Mini-league chase FH
- Captaincy candidate highlighted
**Implementation:** New `buildFreeHitSquad()` function. Greedy + local search or ILP. 700-player pool makes exhaustive search infeasible — need a smart heuristic.
**Priority:** Strategic edge
**Estimated effort:** High

---

### WC-01: Wildcard Structure Builder
**Problem:** Wildcard is about squad structure for 8-15 GW horizon, not just best 15 now. No long-horizon squad comparison tool.
**Scope:**
- Compare 2-3 squad structures (e.g., Salah+Haaland vs Salah-only-stacked-midfield vs No-Haaland)
- Score each structure over 5/8/15 GW projected xPts
- Captaincy coverage: which weeks each structure has strong captain options
- Transfer flexibility: how easy to upgrade from each structure
- Chip synergy: which structure suits planned BB/TC/FH windows
**Priority:** Strategic edge
**Estimated effort:** High

---

### SENS-01: Sensitivity Analysis
**Problem:** Some recommendations are fragile (only good if one assumption holds); others are robust. Users can't tell which is which.
**Scope:**
- For each recommendation: "Still recommended if start prob drops from 90% to 70%? If fixture worsens? If price rises 0.1?"
- Highlight fragile recommendations (depend on a single assumption) vs robust ones
- Output: "No longer recommended if: he is projected below 70 minutes / you need a -4 / Watkins gets a double"
**Priority:** Advanced
**Estimated effort:** Medium-High

---

### WHY-01: "Why Not?" Rejection Explainer
**Problem:** Users often wonder why a popular player is not recommended. Current app doesn't explain omissions.
**Scope:**
- For any player: explain why they are below the recommendation threshold
- Format: "Strong xGI trend, BUT start probability only 68%, City have 3 matches in 8 days, similar xPts available cheaper"
- Surfaces in: GemTable row expand, Transfer suggestions, Squad view
**Priority:** Nice-to-have
**Estimated effort:** Medium

---

### BACK-01: Transfer Regret Backtester
**Problem:** Past decisions feel random without a structured review. Hard to separate bad process from bad outcome.
**Scope:**
- Log each week: recommended transfer, user's actual decision, xPts difference at decision time, actual outcome
- Verdict: Good process / Bad outcome vs Good process / Good outcome vs Bad process
- Captain history, chip history, hit decisions
- Requires: storing user decisions each week (localStorage or user-triggered save)
**Priority:** Advanced / Personal analytics
**Estimated effort:** Medium

---

### VER-01: Model Versioning
**Problem:** When the model changes, there's no way to know if it actually improved.
**Scope:**
- Store per prediction: model version, data timestamp, xPts formula version, player inputs, actual outcome
- Answer: "Did form signal improve captain picks? Did the new CS model improve defensive picks?"
- Minimum: version tag in `accuracy_backtest.json`, structured comparison across versions
**Implementation:** Extends existing accuracy pipeline (phase 40-42 work).
**Priority:** Must-have for long-term accuracy
**Estimated effort:** Medium

---

### CAL-01: Calibration Charts
**Problem:** Hit rate alone doesn't show if the model is well-calibrated. If model says 30% haul chance, it should happen ~30% of the time.
**Scope:**
- Reliability diagram: predicted haul probability bucket vs actual haul rate
- Check separately for: GKs, DEFs, MIDs, FWDs
- Surfaces in Accuracy tab (phases 40-41 home)
**Priority:** Advanced / Trust
**Estimated effort:** Medium

---

## Priority 4 — UX, infrastructure, and personal analytics

### HIST-01: Personal Decision History & Analytics
**Problem:** No way to see own biases: captain hit rate, transfer ROI, chip ROI, hit break-even success rate.
**Scope:**
- Captain: hit rate, points-over-replacement vs optimal pick
- Transfer: points gained on players bought vs points scored by players sold
- Chip ROI: did BB/TC/FH outperform rolling average?
- Hit decisions: did -4 hits break even within the projected window?
**Priority:** Advanced / Personal analytics
**Estimated effort:** Medium

---

### PGW-01: Post-GW Review
**Problem:** No automated review of what went well/badly each gameweek.
**Scope:**
- "You left X points on bench, captain choice cost you Y vs optimal, your best player scored Z"
- Comparison vs template team (top 10k) and vs optimal captain
- Auto-generated after each GW deadline passes
**Priority:** Nice-to-have
**Estimated effort:** Medium

---

### NLP-01: Natural Language FPL Assistant (LLM-powered)
**Problem:** Tables are useful but before deadline I want plain-English advice, not more numbers.
**Scope:**
- Summarise model output into a weekly recommendation paragraph
- "This week the model recommends rolling the transfer unless Gordon is confirmed out..."
- Uses structured model output as context; LLM generates prose
- Risk: hallucination if LLM adds invented player data — must be grounded in structured output only
**Deferred from v1.7:** AI/LLM-generated prose explicitly deferred (REQUIREMENTS.md future requirements)
**Priority:** Must-have UX / Phase 4
**Estimated effort:** Medium (if using Claude API as prose layer over structured data)

---

### ALERT-01: Alert System
**Problem:** Important FPL information changes close to deadline. No proactive notification system.
**Scope:**
- Price rise/fall risk alerts
- Injury flag changes
- Set-piece taker changes (you have the amber banner — push is more actionable)
- Deadline reminders (2h before)
- Captain recommendation changed
- Player benched in predicted lineups
**Implementation:** Requires web push or email — currently no notification infrastructure.
**Priority:** Nice-to-have / High UX value
**Estimated effort:** Medium

---

### HEAT-01: Schedule Heat Map
**Problem:** Fixture grid for planning is not scannable. No visual 8-GW grid for all 20 teams.
**Scope:**
- Colour-coded fixture grid: all 20 teams × next 8 GWs
- Green=easy, amber=medium, red=hard (using existing `attacking_difficulty`)
- DGW highlighted with double cell; BGW shown as blank
- Scannable at a glance — single screen, no scrolling on desktop
**Priority:** Nice-to-have / Polish
**Estimated effort:** Low-Medium

---

### GK-01: GK Save-Point Projection
**Problem:** GKs get points from saves (each save = 1 pt at 3+ saves). Not currently modelled.
**Scope:**
- Opponent xG → expected saves faced → save points EV
- GK-specific xPts improvement (currently bonus-only)
- Surfaces in GemTable CS% column / xPts breakdown
**Priority:** Nice-to-have
**Estimated effort:** Medium

---

### REFRESH-01: Event-Based Pipeline Refresh
**Problem:** Daily cron is insufficient near deadlines. FPL-relevant info changes rapidly before each GW.
**Scope:**
- Refresh schedule: 6h before deadline, 2h before, 30min before, immediately after deadline, after each match completes
- Requires GitHub Actions workflow trigger (manual dispatch + cron)
- Alert on failed refresh (current: silent failure)
**Priority:** Must-have infrastructure
**Estimated effort:** Medium

---

### DQ-01: Data Quality Dashboard
**Problem:** As the model grows more complex, silent data quality failures can ruin recommendations.
**Scope:**
- Last FPL API pull timestamp
- Last Understat pull timestamp
- Missing players count, duplicate mappings, team-name mismatches
- Number of players with null xG/xA
- Model output sanity checks (e.g., no player with xPts > 25)
- Failed cron run detection
- Surfaces in Accuracy tab or new Data Health tab
**Priority:** Must-have for reliability
**Estimated effort:** Low-Medium

---

### SCRAPER-01: Lineup Confirmation Scraper
**Problem:** Press conference quotes, expected return dates, pre-deadline lineup leaks are not integrated.
**Scope:**
- Scrape trusted sources (FPL official news, Sky Sports, BBC Sport) for team news
- Extract: confirmed starters, injured player expected return date, rotation warnings
- Confidence score per piece of news (Official FPL news = high confidence; Twitter rumour = low)
- Surfaces in: transfer suggestions, captain picks, bench order
**Top-3 recommendation:** Yes — identified alongside price change predictor and mini-league tracker.
**Priority:** Must-have / Phase 2 (requires external scraping infrastructure)
**Estimated effort:** High (data sourcing is the hard part)
**Note:** FPL official news feed is the safe starting point (already in bootstrap response).

---

### SP-QUAL-01: Set-Piece Quality Ranking
**Problem:** App shows who takes set pieces, not how dangerous their deliveries are.
**Scope:**
- Corner xG per delivery (from Understat or StatsBomb)
- Direct FK xG per delivery
- Rank takers by delivery quality, not just frequency
- Surfaces in: SetPieceTakerPanel (phase 26 component)
**Priority:** Nice-to-have
**Estimated effort:** Medium (data availability is the constraint — Understat has xG for shots, not deliveries directly)

---

## Planning Intelligence

### GWT-01: GW-Targeted Transfer Recommendations
**Problem:** The current transfer recommendation system is horizon-agnostic — it doesn't let the manager plan *for a specific upcoming GW*. If GW36 looks great for a particular player, the manager can't currently answer "who should I buy *now* to be set up for GW36?" and intelligently save their free transfer.
**Scope:**
- Input: a target GW number (e.g. GW36)
- Output: ranked list of players who are recommended for that specific GW (based on fixtures, form, xPts projection), with context label showing whether the recommendation is single-GW or multi-GW (e.g. "good for GW36 only" vs "good for GW35–38")
- Surfaces the horizon decision: is this a short-term buy or a longer hold?
- Enables the manager to answer: "I'm in GW33 — who should I target in 3 GWs and how many FTs do I need to save?"
**Files:** Likely a new sub-mode or filter in the existing TransferPanel + ManualPlannerTab
**Priority:** High — enables proactive rather than reactive transfer planning
**Estimated effort:** Medium (uses existing fixture-aware xPts data; mostly UI + filtering logic)

---

## UX Polish

### UX-01: xPts temporal clarity — "Next N GW" labels
**Problem:** The `1 GW / 3 GW / 5 GW` horizon toggle labels don't communicate that xPts is always forward-looking (upcoming fixtures only). Users can mistake a player's 1GW xPts for the gameweek just played rather than the next upcoming one.
**Scope:**
- Rename toggle labels from `1 GW / 3 GW / 5 GW` → `Next 1 GW / Next 3 GWs / Next 5 GWs`
- Optionally surface current GW number in column header (e.g. `xPts GW39`) when pipeline passes `current_event` to the UI
**Files:** `src/components/gem-table/GwToggle.tsx` (toggle labels), `src/components/gem-table/columns.tsx` (column headers)
**Priority:** Nice-to-have / UX polish
**Estimated effort:** Low (label change only; GW number in header requires small pipeline wiring)

---

## Suggested milestone grouping (for /gsd-new-milestone)

| Milestone | Theme | Core features |
|-----------|-------|---------------|
| v1.8 | Predictive Intelligence | MIN-01 (xMins), BPS-01 (bonus), PRC-01 (price changes), BENCH-01 (bench order) |
| v1.9 | Competitive Intelligence | LIVE-01 (live GW score), ML-01 (mini-league), EO-01 (effective ownership), TREE-01 (transfer tree) |
| v1.10 | Advanced Planning | FH-01 (free hit), WC-01 (wildcard), BB-01 (bench boost), TC-01 (triple captain) |
| v1.11 | Modelling & Trust | MC-01 (Monte Carlo), VER-01 (versioning), CAL-01 (calibration), SENS-01, WHY-01 |
| v1.12 | UX & Infrastructure | NLP-01 (LLM prose), ALERT-01, HEAT-01, REFRESH-01, DQ-01 |

---

*Source: Manager feature roadmap document (2026-05-01). Features already in v1.7 are excluded.*
