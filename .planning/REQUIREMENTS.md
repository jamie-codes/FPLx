# Requirements — v1.4 Analytics Engine & Intelligence Layer

*Generated: 2026-04-27*
*Milestone: v1.4*

---

## In Scope

### Data Pipeline

- [ ] **DATA-01**: System stores `attacking_difficulty` and `defensive_difficulty` per team per fixture in pipeline output (additive — existing `difficulty_score` field unchanged to preserve 6+ consumers)
- [ ] **DATA-02**: System computes `xPts` per player per upcoming GW with component breakdown (goals, assists, CS, bonus) using Poisson distribution for goals/assists and Bernoulli for CS/minutes (scipy>=1.14.0)
- [ ] **DATA-03**: System fetches and stores per-match xG/xA per player from Understat (pipeline currently only has season-aggregate xG/xA; per-match data required for regression detector)
- [ ] **DATA-04**: System extracts set-piece text fields from FPL bootstrap-static (`penalties_text`, `direct_freekicks_text`, `corners_and_indirect_freekicks_text`) into merged_players.json

### Expected Points Display

- [ ] **XPTS-01**: User can see per-player xPts with component breakdown (goal pts, assist pts, CS pts, bonus pts) in GemTable
- [ ] **XPTS-02**: User can see an xPts variance indicator distinguishing high-ceiling vs consistent scorers

### Regression Detector

- [x] **REG-01**: User can see a buy signal on players whose actual goals/assists are below their xG/xA over the last 5–10 GW (minimum 900 minutes played to avoid small-sample noise)
- [x] **REG-02**: User can see a sell signal on players whose actual goals/assists are above their xG/xA over the last 5–10 GW (minimum 900 minutes played)

### Differential / Template Tracker

- [ ] **TMPL-01**: User can see a differential flag on players with above-average xPts and below-average ownership (high-EV low-EO)
- [ ] **TMPL-02**: User can see a template-trap flag on players with below-average xPts and above-average ownership (low-EV high-EO)

### Captaincy Enhancements

- [x] **CAP-03**: User can see a ceiling captain recommendation showing the highest 90th-percentile xPts player (best pick when chasing in a mini-league)
- [x] **CAP-04**: User can see an EO-adjusted captain recommendation that accounts for ownership concentration (reduces expected rank variance vs the template)

### Chip Strategy

- [ ] **CHIP-01**: User can see the optimal upcoming GW for Bench Boost based on projected squad xPts across the bench
- [ ] **CHIP-02**: User can see the optimal upcoming GW for Triple Captain based on player xPts ceiling and fixture ease
- [ ] **CHIP-03**: User can see the optimal upcoming GW for Free Hit based on upcoming fixture landscape and squad flexibility

### Fixture Ranking

- [ ] **FIX-01**: User can see all 20 Premier League teams ranked by fixture ease on the Form tab with 1 GW, 3 GW, and 5 GW toggle views
- [ ] **FIX-02**: Fixture ease ranking uses FDR++ attacking/defensive split where available (attacking FDR for attack players, defensive FDR for defenders/goalkeepers)

### Set-Piece Intelligence

- [ ] **SP-01**: User can see the penalty taker, direct free kick taker, and corner taker for each team in a dedicated panel
- [ ] **SP-02**: User is alerted when a set-piece order change is detected between the current and previous pipeline run

### Insights Tab

- [ ] **INS-01**: User can see an Insights tab with data-driven statements about patterns from this season's FPL data
- [ ] **INS-02**: Each statement displays a confidence weight derived from actual season data (e.g. "True in 67% of matches analysed")
- [ ] **INS-03**: Statements span defensive patterns (CS rates by opponent rank, home/away), attacking patterns (returns by fixture difficulty), and player-specific patterns (e.g. a player who scores in tough games)
- [ ] **INS-04**: Trivially obvious statements are excluded from the Insights tab (e.g. "suspended players score 0 points")

### Team Target List

- [ ] **TGT-01**: User can see teams with 4+ favourable upcoming fixtures highlighted on the Club Form tab
- [ ] **TGT-02**: User can see top players ranked by xGI involvement % (share of team xG+xA) for teams with green fixture runs
- [ ] **TGT-03**: Buy signals (REG-01) and differential flags (TMPL-01) are visible alongside team target player data

### Mobile UX

- [ ] **MOB-LS-01**: User sees a subtle landscape mode tip on data-heavy tabs (Gems, DefCon) when using a mobile device in portrait orientation

---

## Future Requirements

- Bookmaker odds integration (anytime scorer, CS odds) — deferred to v1.5
- FBref/StatsBomb progressive carries, touches in box — deferred to v1.5
- Mini-league mode (rival squad analysis) — previously out of scope; revisit for v1.5
- Live match-day dashboard (BPS table, auto-sub simulator) — previously out of scope; revisit for v1.5
- Backtesting harness — deferred to v1.5
- Injury/news NLP scraper — deferred to v1.5
- Top-10k EO data — no official API; revisit if third-party scraper becomes viable

---

## Out of Scope (v1.4)

- Live in-match updates — daily refresh is sufficient
- Mobile app — responsive web covers the use case
- Automated chip timing (fully auto) — chip analysis finder is in scope; push-button auto-timing is not
- Offline mode — daily refresh is sufficient
- Multi-tenancy / user accounts — single-user personal tool

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| DATA-01 | Phase 27 | Pending |
| DATA-02 | Phase 28 | Pending |
| DATA-03 | Phase 29 | Pending |
| DATA-04 | Phase 26 | Pending |
| XPTS-01 | Phase 28 | Pending |
| XPTS-02 | Phase 28 | Pending |
| REG-01 | Phase 29 | Complete |
| REG-02 | Phase 29 | Complete |
| TMPL-01 | Phase 30 | Pending |
| TMPL-02 | Phase 30 | Pending |
| CAP-03 | Phase 31 | Complete (2026-04-28) |
| CAP-04 | Phase 31 | Complete (2026-04-28) |
| CHIP-01 | Phase 34 | Pending |
| CHIP-02 | Phase 34 | Pending |
| CHIP-03 | Phase 34 | Pending |
| FIX-01 | Phase 27 | Pending |
| FIX-02 | Phase 27 | Pending |
| SP-01 | Phase 26 | Pending |
| SP-02 | Phase 26 | Pending |
| INS-01 | Phase 33 | Pending |
| INS-02 | Phase 33 | Pending |
| INS-03 | Phase 33 | Pending |
| INS-04 | Phase 33 | Pending |
| TGT-01 | Phase 32 | Pending |
| TGT-02 | Phase 32 | Pending |
| TGT-03 | Phase 32 | Pending |
| MOB-LS-01 | Phase 26 | Pending |
