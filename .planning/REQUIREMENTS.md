# Requirements — FPL Analyst v1.12 Modelling & Refinement

**Milestone:** v1.12 Modelling & Refinement
**Started:** 2026-05-05
**Status:** Planned

---

## v1 Requirements

### Monte Carlo Simulation (MC)

- [ ] **MC-01** Pipeline runs 10,000 Monte Carlo simulations per player per upcoming GW using Poisson goal/assist distributions and Bernoulli CS distributions drawn from existing xPts parameters, writing `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` to each player in `merged_players.json`
- [ ] **MC-02** User can see blank% (probability of ≤2 pts) and haul% (≥10 pts) for any player in GemTable row expand, alongside floor (10th percentile) and ceiling (90th percentile) outcomes; BGW players show blank%=100%, DGW players combine both fixtures
- [ ] **MC-03** User can open a 5-GW rank trajectory simulator showing P(top-10k), P(rank gain), and P(rank drop) for their current XI vs an alternative XI defined by swapping players
- [ ] **MC-04** Each captain candidate in CaptainPicksPanel shows an augmented MC label ("Highest ceiling", "Lowest floor", or "Best P(haul)") with the corresponding simulated value; TC recommendation surfaces the player with highest P(haul)

### Model Versioning & Calibration (VER, CAL)

- [ ] **VER-01** Every pipeline run writes a version record to `accuracy_backtest.json` containing: formula version string, data timestamp, and all active gate flag states (`xmins_v2_enabled`, `bonus_predictor_enabled`, `form_signal_enabled`)
- [ ] **VER-02** AccuracyTab shows a version comparison table with hit rate per model version and a delta indicator so the user can see at a glance whether a model change improved or degraded accuracy
- [ ] **CAL-01** AccuracyTab shows a calibration reliability diagram: for players predicted at each haul% bracket (e.g. 30–40%), the diagram shows the actual observed haul rate — a well-calibrated model produces a near-diagonal line
- [ ] **CAL-02** Calibration diagram is broken out by position (GK / DEF / MID / FWD) so position-specific over- or under-confidence is immediately visible

### Sensitivity Analysis (SENS)

- [ ] **SENS-01** Every transfer candidate row and every captain recommendation row carries a computed fragility flag — "fragile" when the recommendation would reverse if start_prob drops below 70%, fixture difficulty worsens by 1 tier, or the action requires a 4pt hit
- [ ] **SENS-02** Fragile recommendations display an amber indicator visually distinct from the existing severity badge system; each fragile item shows a one-line explanation naming the exact reversing condition ("no longer recommended if: start_prob < 70%"); non-fragile picks show no indicator

### Rejection Explainer (WHY)

- [ ] **WHY-01** User can expand any GemTable row and read a natural-language "why not?" explanation for why that player falls below the transfer or captain recommendation threshold — covering at least: ownership%, xPts ranking, start probability, fixture difficulty, and any active fragility flag
- [ ] **WHY-02** TransferPanel shows a dedicated callout for any player with >20% ownership who is absent from the transfer candidate list — naming the player and giving a one-sentence reason
- [ ] **WHY-03** Squad view row expand for an owned player explains why they are not recommended to hold or captain — distinguishing between "below xPts threshold", "rotation risk", "difficult fixture", and "fragile recommendation"

### Fixture Heat Map v2 (HEAT)

- [ ] **HEAT-04** Each fixture cell in the heat map shows the opponent's abbreviated team name (e.g. "MCI", "ARS") so the user knows who each team is playing in that GW
- [ ] **HEAT-05** User can filter the heat map to show only rows for teams where they own players (requires squad to be loaded; full grid shown otherwise)
- [ ] **HEAT-06** Heat map horizon is user-selectable: 8 GWs (default), 12 GWs, or 16 GWs — grid expands accordingly
- [ ] **HEAT-07** User can toggle between attacking difficulty view and defensive difficulty view (both values already computed in pipeline per team per fixture)
- [ ] **HEAT-08** Heat map rows for teams where the user owns players are visually highlighted (distinct background or border) so owned-team fixtures stand out without filtering

### Accuracy Tab Drill-Down (ACC2)

- [ ] **ACC2-01** User can click any GW row in the GW Accuracy Summary table to expand a drill-down panel showing which players were xPts Flagged (predicted haul, actual blank) and which were Haulers (substantially outperformed xPts) for that GW — with player names and actual vs predicted points

### Routes to Points (RTP)

- [ ] **RTP-01** Pipeline computes a `routes_to_points` score (integer 1–5) per player counting distinct point-scoring routes held: penalty taker, direct FK taker (shots on goal), corner taker, primary goal scorer (above-median xG in team), primary assist provider (above-median xA in team) — written to `merged_players.json`
- [ ] **RTP-02** GemTable shows a "Routes" numeric score column using `routes_to_points` data; column is sortable; hidden on mobile portrait view

### Transfer Engine Fixes & Enhancements (TFX)

- [ ] **TFX-01** Transfer suggestions enforce the FPL 3-player-per-team cap — no player from a team where the user already has 3 players is shown as a buy candidate under any transfer scenario
- [ ] **TFX-02** Multi-transfer suggestions (2FT, hit) never repeat the same player-out or player-in across the 1FT and subsequent transfer suggestions — each additional move involves a different player pair
- [ ] **TFX-03** Transfer panel supports multi-hit selection — user can view 1FT, 2FT, −4 hit, and −8 hit (two simultaneous hits) scenarios simultaneously; panel layout clearly differentiates the scenarios
- [ ] **TFX-04** Each transfer scenario shows the projected bank balance remaining after the move with an explicit financial feasibility check — unaffordable moves are visually disabled or flagged rather than silently shown
- [ ] **TFX-05** Bank balance is auto-populated when the user is authenticated (derived from FPL sell prices and available budget); when unauthenticated, the user can manually enter their bank balance and it is used for all affordability checks

### Optimiser Enhancements (OPT)

- [ ] **OPT-01** User can manually assign captain and vice-captain in the LineupTab pitch view — tapping a player arms captain assignment; tapping again or tapping a second player reassigns; VC available via a distinct secondary interaction
- [ ] **OPT-02** LineupTab pitch renders player kit art (team shirt colours or user-supplied images) alongside the player name to improve visual scannability; graceful fallback to coloured placeholder if image is unavailable

### Mobile & Desktop Polish (POL)

- [ ] **POL-01** Decision tab CaptainPicksPanel renders within its containing card on desktop without content overflow — card expands to fit or uses an internal scroll region
- [ ] **POL-02** GemTable and all sub-tables render without edge overflow on 390–430px viewport widths — xPts column and all sortable columns are fully visible without horizontal scroll unless the table is explicitly designed to scroll
- [ ] **POL-03** Full mobile layout audit across all tabs and sections on Galaxy S26+ (≈430px) — truncated text, misaligned cells, and tap-target violations (<44px) resolved; each tab verified individually

---

## Future Requirements (deferred)

- MC-05: Monte Carlo simulation for bench players (autosub probability scenarios)
- TC-01: Triple Captain decision engine comparing current GW vs future windows (extends computeTCScore already in chip-strategy-engine.ts)
- BB-01: Bench Boost readiness score (bench xPts × start_prob across all 4 bench players)
- FH-01: Free Hit squad builder from full 700-player pool (greedy + local search)
- WC-01: Wildcard structure comparison (2–3 squad structures scored over 5/8/15 GW horizon)
- GK-01: GK save-point projection (opponent xG → expected saves → save pts EV)
- SCRAPER-01: Lineup news scraper (FPL official news feed integration)
- RTP-03: Set-piece quality ranking (delivery quality, not just taker identity)
- OPT-02 extension: full player face/photo integration (requires external image source)
- HEAT-09: Highlight upcoming DGW teams distinctly in the extended heat map grid
- ACC2-02: Export GW accuracy drill-down as CSV

---

## Out of Scope

- Push notifications or email alerts (in-app only)
- Real-time within-GW probability updates
- Automated chip timing recommendations (beyond what chip-strategy-engine.ts already does)
- Multi-device sync beyond Vercel Blob keyed by team ID
- LLM-generated player analysis beyond structured model output (hallucination risk)
- Live predicted lineup scraping from third-party sites (data sourcing complexity)

---

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| MC-01 | Phase 61 | — | pending |
| MC-02 | Phase 61 | — | pending |
| MC-03 | Phase 62 | — | pending |
| MC-04 | Phase 62 | — | pending |
| VER-01 | Phase 63 | — | pending |
| VER-02 | Phase 63 | — | pending |
| CAL-01 | Phase 63 | — | pending |
| CAL-02 | Phase 63 | — | pending |
| SENS-01 | Phase 64 | — | pending |
| SENS-02 | Phase 64 | — | pending |
| WHY-01 | Phase 65 | — | pending |
| WHY-02 | Phase 65 | — | pending |
| WHY-03 | Phase 65 | — | pending |
| HEAT-04 | Phase TBD | — | pending |
| HEAT-05 | Phase TBD | — | pending |
| HEAT-06 | Phase TBD | — | pending |
| HEAT-07 | Phase TBD | — | pending |
| HEAT-08 | Phase TBD | — | pending |
| ACC2-01 | Phase TBD | — | pending |
| RTP-01 | Phase TBD | — | pending |
| RTP-02 | Phase TBD | — | pending |
| TFX-01 | Phase TBD | — | pending |
| TFX-02 | Phase TBD | — | pending |
| TFX-03 | Phase TBD | — | pending |
| TFX-04 | Phase TBD | — | pending |
| TFX-05 | Phase TBD | — | pending |
| OPT-01 | Phase TBD | — | pending |
| OPT-02 | Phase TBD | — | pending |
| POL-01 | Phase TBD | — | pending |
| POL-02 | Phase TBD | — | pending |
| POL-03 | Phase TBD | — | pending |
