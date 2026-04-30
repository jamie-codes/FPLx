# Requirements — v1.6 Squad Optimiser

**Milestone:** v1.6 Squad Optimiser
**Status:** Active
**Last updated:** 2026-04-30

---

## v1.6 Requirements

### Lineup Optimiser (OPT)

- [ ] **OPT-01**: User sees the best starting 11 + bench order + auto-selected formation from their current 15-player squad, scored by xPts
- [ ] **OPT-02**: User can select a 1 / 3 / 5 GW horizon; the optimiser scores and ranks players by the corresponding xPts window
- [ ] **OPT-03**: Captain and vice-captain are identified within the optimised lineup (captain = highest xPts_90th_1gw starter; VC = second)
- [ ] **OPT-04**: Bench order respects FPL rules: GK isolated at bench slot 0; outfield bench positions ordered by xPts descending
- [ ] **OPT-05**: BGW players are hard-excluded from the starting XI; a warning is shown if fewer than 11 eligible players exist in the squad

### Comparison Output (CMP)

- [ ] **CMP-01**: User sees current lineup vs optimised lineup side-by-side, with xPts delta shown per slot
- [ ] **CMP-02**: A diff headline summarises the delta: "Changes: N players | +X.X xPts gain"
- [ ] **CMP-03**: On mobile (< 640px), current and optimised lineups stack vertically with a Changes badge; only changed rows are highlighted

### Transfer-Aware Mode (TFR)

- [ ] **TFR-01**: User can enable transfer-aware mode that factors in 1–2 available free transfers when optimising
- [ ] **TFR-02**: Transfer suggestions are shown alongside the optimised lineup (Out | In | Cost | xPts gain per suggestion)
- [ ] **TFR-03**: A hit break-even indicator is shown for each -4pt hit: "Breaks even in X GWs based on xPts gain"

### Chip Modes (CHIP)

- [ ] **CHIP-01**: Wildcard mode removes transfer constraints entirely and selects the best 15 from all available players, then shows the best XI from that squad
- [ ] **CHIP-02**: Free Hit mode optimises for the current GW only from the full player pool; output is clearly labelled as this-GW-only / reverts next GW
- [ ] **CHIP-03**: Bench Boost mode surfaces the optimised bench order with expected bench xPts, shown as a dedicated view

### Navigation (NAV)

- [ ] **NAV-01**: Squad section gains sub-tabs (Transfers | Optimiser); MobileNav updated to show Squad sub-tab pills when Squad section is active

### xPts Accuracy (ACC)

- [ ] **ACC-01**: A form/momentum signal is added to the pipeline: recency-weighted xG+xA over the last 3–5 GWs that surfaces in-form players alongside fixture-based xPts
- [ ] **ACC-02**: Any new signal is backtested against the existing 5-GW accuracy pipeline (`compute_accuracy_backtest`) before being incorporated into xPts scoring
- [ ] **ACC-03**: A new signal only ships if backtesting shows it improves hit rate above the current 16.7% baseline on the backtest window
- [ ] **ACC-04**: Mid-tier scorer detection: the model reliably surfaces 6–8 pt scorers (clean sheet defenders, assist/bonus accumulators), not only 10+ point haulters

---

## Future Requirements

- **Standalone squad builder**: Budget-only squad construction from scratch (greedy over ~650 players within £100m, 3-per-club cap, positional quotas) — deferred to v1.7
- **Formation preference picker**: User locks a preferred formation before optimisation — deferred
- **Player locking**: User pins specific players as must-start before optimising — deferred
- **Captain swap what-if**: "What if my captain doesn't play?" simulation — deferred
- **Time-decay weighting on xG/xA**: Historical data weighted by recency beyond 3–5 GW window — deferred
- **Monte Carlo xPts simulation**: Stochastic simulation over point outcomes — explicitly anti-feature for v1.6 (latency cost, negligible accuracy gain over existing analytical model)

---

## Out of Scope

- **MILP/ILP solver in browser**: Not needed. Best-11 selection from 15 players = C(15,11) = 1,365 subsets, solved by TypeScript enumeration in <1ms. glpk.js ruled out (WASM issues in Next.js, ~1MB bundle)
- **Automated chip activation**: Chips must never be activated without explicit user action (irreversible FPL rule)
- **Live in-match optimisation**: Data refreshes daily; no real-time requirements
- **Mini-league / head-to-head EO optimisation**: Single-manager tool
- **Separate pipeline JSON for per-manager optimal squad**: Optimiser is user-specific, computed client-side only

---

## Traceability

*(Filled by roadmapper)*

| REQ-ID | Phase |
|--------|-------|
| OPT-01 | — |
| OPT-02 | — |
| OPT-03 | — |
| OPT-04 | — |
| OPT-05 | — |
| CMP-01 | — |
| CMP-02 | — |
| CMP-03 | — |
| TFR-01 | — |
| TFR-02 | — |
| TFR-03 | — |
| CHIP-01 | — |
| CHIP-02 | — |
| CHIP-03 | — |
| NAV-01 | — |
| ACC-01 | — |
| ACC-02 | — |
| ACC-03 | — |
| ACC-04 | — |
