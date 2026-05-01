# Requirements: FPL Analyst v1.7 Decision Assistant

**Milestone:** v1.7 Decision Assistant
**Goal:** Turn the app from an analytics dashboard into a weekly decision engine — answering "what should I actually do with my team this week?" for transfers, captaincy, chips, and bench.
**Generated:** 2026-05-01

---

## Active Requirements (v1.7)

### Clean Sheet Probability

- [ ] **CS-01**: User can see CS% per fixture for all GK/DEF-relevant teams, derived from rolling xGA (consistent with xPts model — same inputs as `cs_pts` in `xPts_components_1gw`)
- [ ] **CS-02**: CS% for DGW fixtures shows combined probability (formula: `1 - (1-p1)*(1-p2)`) so managers see the full double-gameweek opportunity
- [ ] **CS-03**: CS% is surfaced in a GK/DEF-oriented context (panel or column) — reduces need to cross-reference Club Form tab for defensive picks

### Fixture Swing Detector

- [ ] **SWG-01**: User can see teams with materially improving upcoming fixtures (buy signal), where swing is defined as `upcoming_3gw_ease - past_3gw_ease ≥ threshold` (threshold to be set in phase spec)
- [ ] **SWG-02**: User can see teams with materially worsening upcoming fixtures (sell signal) — symmetric with SWG-01
- [ ] **SWG-03**: Fixture swing view is toggleable across 1/3/5 GW windows (consistent with existing horizon controls)
- [ ] **SWG-04**: User's owned players from high-swing teams are highlighted, personalising the signal to their actual squad

### Player Lifecycle Labels

- [ ] **LCL-01**: Squad players display a lifecycle label that extends beyond Buy/Hold/Sell — labels include: Buy Next Week, Hold One More, Sell Soon, Minutes Trap, Fixture Trap
- [ ] **LCL-02**: Labels are computed as a pure-TS function over existing `MergedPlayer` fields — no new pipeline data required
- [ ] **LCL-03**: When multiple label conditions apply for a player, a priority hierarchy determines which label is shown (prevent conflicting labels)

### Explainable xPts Breakdown

- [ ] **XPT-01**: User can view a component-level breakdown of any player's `xPts_1gw` — components: appearance probability, goal contribution, assist contribution, clean sheet probability, bonus points, minutes risk modifier
- [ ] **XPT-02**: Components displayed sum to the headline `xPts_1gw` value (±0.01 rounding tolerance) — inconsistency between components and total destroys trust
- [ ] **XPT-03**: Breakdown includes fixture-adjusted CS% (uses CS-01 data) so the CS component is grounded in the specific upcoming fixture
- [ ] **XPT-04**: Breakdown is accessible without requiring authentication (public squad data is sufficient)

### Transfer Opportunity Cost Simulator

- [ ] **OCS-01**: User can compare Roll / 1-FT / 2-FT / Hit options in a single table, each row showing xPts gain net of hit cost and per-GW break-even weeks
- [ ] **OCS-02**: Each option shows the specific player-in/player-out pair for 1-FT and 2-FT (grounds the comparison in real names)
- [ ] **OCS-03**: Comparison table is toggleable across 1/3/5 GW horizons
- [ ] **OCS-04**: Simulator operates on user's actual squad (requires squad/team ID loaded); the Roll row explicitly shows 0 gain to make inaction cost visible
- [ ] **OCS-05**: Simulator respects current FT count (1 or 2) — options that incur a hit are labelled as such and show the 4pt cost deducted from net gain

### Weekly Decision Summary

- [ ] **WDS-01**: User sees captain recommendation, transfer recommendation, bench order, chip timing flag, and risk flags on a single screen — no tab-hopping required
- [ ] **WDS-02**: Recommendations are presented in priority order: captain → transfer → bench → chip timing → risks
- [ ] **WDS-03**: Each recommendation carries a severity signal (High / Medium / Low) so the manager knows what to act on urgently
- [ ] **WDS-04**: Screen degrades gracefully when no squad is loaded — shows captain picks and chip timing cards; hides transfer and bench recommendations
- [ ] **WDS-05**: DGW or BGW context flag is shown when the upcoming gameweek is a double or blank, affecting the relevance of chip recommendations

---

## Future Requirements (deferred from v1.7)

- Lifecycle labels for all 600+ players in GemTable (not just squad) — increases scope; squad context is sufficient for v1.7
- xPts breakdown for 3GW and 5GW horizons — pipeline extension needed; 1GW breakdown ships first
- AI/LLM-generated prose for Decision Summary — adds external dependency and hallucination risk; structured data is sufficient
- Fixture swing notifications / alerts — no notification infrastructure in scope
- Automated chip activation — recommendation only; irreversible action out of scope
- Injury probability model for transfer simulator — data not available

---

## Out of Scope (explicit exclusions)

| Exclusion | Reason |
|-----------|--------|
| Multi-week transfer sequence optimiser | Already exists in GW Planner (v1.3); do not duplicate |
| Mini-league or head-to-head analysis | PROJECT.md constraint |
| Live in-match CS% updates | Daily refresh is sufficient |
| Betting odds data feeds | External data source dependency; model inconsistency risk |
| Price rise/fall prediction labels | Requires transfer volume modelling; out of scope |
| Push notifications or deadline reminders | Web-only tool; no notification infrastructure |

---

## Traceability

*Filled by roadmapper — maps REQ-IDs to phases.*

| REQ-ID | Phase | Status |
|--------|-------|--------|
| CS-01, CS-02, CS-03 | — | Pending |
| SWG-01, SWG-02, SWG-03, SWG-04 | — | Pending |
| LCL-01, LCL-02, LCL-03 | — | Pending |
| XPT-01, XPT-02, XPT-03, XPT-04 | — | Pending |
| OCS-01, OCS-02, OCS-03, OCS-04, OCS-05 | — | Pending |
| WDS-01, WDS-02, WDS-03, WDS-04, WDS-05 | — | Pending |
