# Requirements — FPL Analyst v1.10 Modelling & Trust

**Milestone:** v1.10 Modelling & Trust
**Started:** 2026-05-04
**Status:** Defining

---

## v1 Requirements

### Monte Carlo Simulation (MC)

- [ ] **MC-01** User can see blank probability (≤2 pts) and haul probability (≥10 pts) per player per GW — computed via 10,000 Monte Carlo simulations using Poisson goal/assist distributions and Bernoulli CS distributions from the existing xPts pipeline
- [ ] **MC-02** User can see 10th and 90th percentile outcomes per player per GW (floor and ceiling indicators)
- [ ] **MC-03** User can simulate a 5-GW rank trajectory for current XI vs an alternative XI — shows projected rank movement distribution (P(top-10k), P(rank gain), P(rank drop))
- [ ] **MC-04** Monte Carlo stats surface in captain picker and TC decision engine — "highest ceiling / lowest floor / best P(haul)" labels augment current xPts ranking

### Model Versioning (VER)

- [ ] **VER-01** Pipeline writes a model version tag (formula version, data timestamp, active gate flags) to accuracy_backtest.json on every run
- [ ] **VER-02** User can compare accuracy metrics across ≥2 model versions in AccuracyTab — hit rate per version shown with delta indicator

### Calibration Charts (CAL)

- [ ] **CAL-01** User can see a calibration reliability diagram in AccuracyTab — predicted haul% bracket vs actual haul rate (e.g., players predicted at 30-40% P(haul) should haul ~35% of the time)
- [ ] **CAL-02** Calibration diagram is broken out by position (GK / DEF / MID / FWD) to make position-specific model quality visible

### Sensitivity Analysis (SENS)

- [ ] **SENS-01** Each transfer candidate and captain recommendation carries a fragility flag — "fragile" when the recommendation reverses if start_prob drops below 70%, fixture difficulty worsens by 1 tier, or a 4pt hit is required
- [ ] **SENS-02** Fragile recommendations are visually distinguished (amber indicator) with a one-line "no longer recommended if: X" explanation in the recommendation row

### Rejection Explainer (WHY)

- [ ] **WHY-01** User can see a natural-language "why not?" explanation for any player in GemTable row expand — why they fall below the transfer/captain recommendation threshold
- [ ] **WHY-02** Transfer suggestions panel shows a callout for players with >20% ownership who are not in the transfer candidate list — "Why not [popular player]?" with reason
- [ ] **WHY-03** Squad view explains why an owned player is not recommended to hold or captain — shown in the squad row expand

---

## Future Requirements (deferred)

- MC rank simulation extended to chip decision timing — which chip timing maximises P(top-10k) across a 10-GW simulation horizon (complex; deferred post v1.10)
- Full Brier score and Expected Calibration Error (ECE) metrics in AccuracyTab (CAL extension)
- WHY-01 extension to Bench Boost decision engine — why the bench order suggestion ranks players as it does
- Alert system for fragile recommendations changing overnight (ALERT-01 from backlog)

---

## Out of Scope

- Real-time within-GW probability updates — data refreshes daily, not during matches
- External crowdsourced probability calibration data (e.g., FPL community aggregators)
- Model retraining automation — pipeline formula changes remain manual; gate flags are human-toggled via accuracy_backtest.json
- GK save-point projection (GK-01) — deferred to v1.12 or later

---

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| MC-01 | — | — | pending |
| MC-02 | — | — | pending |
| MC-03 | — | — | pending |
| MC-04 | — | — | pending |
| VER-01 | — | — | pending |
| VER-02 | — | — | pending |
| CAL-01 | — | — | pending |
| CAL-02 | — | — | pending |
| SENS-01 | — | — | pending |
| SENS-02 | — | — | pending |
| WHY-01 | — | — | pending |
| WHY-02 | — | — | pending |
| WHY-03 | — | — | pending |
