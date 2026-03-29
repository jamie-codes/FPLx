# Requirements — FPL Analyst v1.1 Decision Engine

*Last updated: 2026-03-29*

## v1.1 Requirements

### Projected Points (PROJ)

- [ ] **PROJ-01**: User can see projected points for next 1 GW per player (absolute FPL pts, not normalised)
- [ ] **PROJ-02**: User can see projected points for next 3 GWs per player
- [ ] **PROJ-03**: User can see projected points for next 5 GWs per player
- [ ] **PROJ-04**: User can view projected points columns in GemTable and Transfer Panel UI

### Minutes Risk (MINS)

- [ ] **MINS-01**: User can see expected minutes and start probability per player
- [ ] **MINS-02**: User can see rotation risk badge per player (Nailed / Likely start / Rotation risk / Cameo risk)
- [ ] **MINS-03**: Transfer suggestions de-prioritise rotation risk players relative to gem score

### Recommendations (REC)

- [ ] **REC-01**: User can see Buy / Hold / Sell label for each player in their squad
- [ ] **REC-02**: User can see replacement shortlist (3–5 alternatives with projected pts delta) for Sell candidates

### Captaincy (CAP)

- [ ] **CAP-01**: User can see top-5 captaincy candidates for next GW with projected captain points
- [ ] **CAP-02**: User can distinguish safe captain (nailed, high-floor) from upside captain (differential, high-ceiling)

### Explainability (EXP)

- [ ] **EXP-01**: User can see natural-language "why this player" reasons per recommendation
- [ ] **EXP-02**: User can see risk flags per player (rotation concern / fixture swing / regression risk / poor form)

### Authentication (AUTH)

- [ ] **AUTH-01**: User can log in with FPL credentials to unlock exact bank balance and sell prices
- [ ] **AUTH-02**: User can see exact selling price from my-team endpoint when authenticated

---

## Future Requirements (deferred to v1.2+)

- Fixture swing / fixture turn ticker (teams whose fixtures are about to improve or worsen)
- Opponent weakness profiles (why a fixture is good, tied to player type)
- Differential finder (low-ownership filter with projected pts + xMins threshold)
- Transfer scenario planner (compare 1T vs roll vs 2T -4 pts)
- Watchlist + price/flag/role alerts
- DAT-01: Verified automated daily pipeline refresh (GitHub Actions cron operational)

---

## Out of Scope (v1.1)

- Chip planner (Wildcard / Bench Boost / Free Hit / TC) — needs mature projection engine first
- Backtesting / model calibration — v1.3+ once sufficient historical data exists
- Effective ownership / rank-risk view — v1.2+
- Bench optimizer — v1.2+
- Predicted role changes — v1.2+
- Live in-match updates — accepted constraint, daily refresh only
- Mini-league / head-to-head analysis — out of scope for personal tool
- Mobile app — web only
- Multi-tenancy / database — single-user, no infra overhead

---

## Traceability

| REQ-ID | Description | Phase |
|--------|-------------|-------|
| PROJ-01 | Projected pts 1 GW | Phase 7 |
| PROJ-02 | Projected pts 3 GW | Phase 7 |
| PROJ-03 | Projected pts 5 GW | Phase 7 |
| PROJ-04 | Projected pts UI columns | Phase 9 |
| MINS-01 | Expected minutes + start prob | Phase 7 |
| MINS-02 | Rotation risk badge | Phase 8 |
| MINS-03 | xMins in transfer suggestions | Phase 8 |
| REC-01 | Buy / Hold / Sell labels | Phase 10 |
| REC-02 | Replacement shortlist + delta | Phase 11 |
| CAP-01 | Captain top-5 rankings | Phase 10 |
| CAP-02 | Safe vs upside captain | Phase 10 |
| EXP-01 | Why-this-player reasons | Phase 11 |
| EXP-02 | Risk flags | Phase 11 |
| AUTH-01 | FPL login | Phase 12 |
| AUTH-02 | Exact sell price | Phase 12 |
