# Requirements: v1.20 Fixes & Decision Quality

## Milestone Goal

Fix 6 data accuracy bugs across GW Review, fixture heatmap, planner, and decision history; add transfer regret backtester; make optimiser on-demand; limit transfer suggestions to top 3 per position.

---

## v1.20 Requirements

### Bug Fixes

- [ ] **FIX-01**: User sees current-GW fixture correctly when a team has already played mid-week — heatmap must not show BGW for a fixture that has been completed
- [ ] **FIX-02**: Transfer planner only suggests buy candidates of the same position as the player being transferred out — no cross-position suggestions (e.g. MID → GK)
- [x] **FIX-03**: GW Review top scorer card displays the player's actual points alongside their name
- [x] **FIX-04**: GW Review best bench card displays actual bench points (not 0)
- [x] **FIX-05**: GW Review dream team delta shows correct sign — positive when dream team outscored the user (e.g. +50 when user=72 and dream team=122)
- [x] **FIX-06**: Decision history captain delta column displays the actual points difference per GW instead of dashes

### Backtester

- [ ] **BACK-02**: User can view a per-GW transfer regret report — what the transfer engine recommended that week vs what was actually done, with hindsight xPts delta (recommended gain vs actual gain)

### Optimiser UX

- [ ] **OPT-01**: Lineup optimiser tab shows an empty state with an "Optimise Lineup" button on load — calculation only runs when the user explicitly triggers it (no auto-calculate on tab mount)

### Transfer Suggestions

- [ ] **TFR-02**: Transfer suggestion list shows at most 3 buy candidates per position slot — ranked by gem delta descending, affordable candidates first

---

## Future Requirements

- TRT-06: ChipToggle UI in RouteTreeTab (chip mode hardcoded null) — deferred post-season
- TRT-02: "Hits" column label cosmetic mismatch in RouteTreeTab — deferred
- RANK-SPARK: rank_trajectory sparkline in GemTable — visual design decision needed

---

## Out of Scope (v1.20)

- Live in-match data — daily refresh remains the model
- BACK-03 / full transfer ROI tracker (requires persistent transfer history store beyond existing blob snapshots)
- Automated chip timing recommendations

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| FIX-01 | Phase 111 | pending |
| FIX-02 | Phase 111 | pending |
| FIX-03 | Phase 110 | Complete |
| FIX-04 | Phase 110 | Complete |
| FIX-05 | Phase 110 | Complete |
| FIX-06 | Phase 110 | Complete |
| BACK-02 | Phase 113 | pending |
| OPT-01 | Phase 112 | pending |
| TFR-02 | Phase 112 | pending |
