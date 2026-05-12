# Requirements — FPL Analyst v1.17

**Milestone:** v1.17 End-of-Season Intelligence
**Started:** 2026-05-11
**Status:** Active

---

## v1 Requirements

### Visualisation

- [x] **HEAT-01**: User can view all 20 PL teams' next 8 GWs as a colour-coded grid (green/amber/red by `attacking_difficulty`), with DGW highlighted as a double-cell and BGW shown as blank, accessible as a toggle within the Club Form tab
- [x] **HEAT-02**: User can hover any heat-map cell to see the specific opponent name and H/A designation

### Post-GW Review

- [ ] **PGW-01**: User can see a post-GW bench summary — highest-scoring bench player's points highlighted, showing how many points were left on the bench that GW
- [ ] **PGW-02**: User can see captain comparison — actual captain points vs the highest-scoring player in their squad that GW
- [x] **PGW-03**: User can see their GW score compared to the top-10k average, including which template players they didn't own
- [ ] **PGW-04**: Post-GW review card auto-surfaces when the user visits the app after a GW deadline has passed (uses FPL bootstrap `events[].deadline_time`)

### Decision History

- [x] **HIST-01**: User can see a season-level captain hit rate — percentage of GWs where their captain outscored the field (computed from existing `useDecisionHistory` / BackTab data, no new pipeline work)
- [x] **HIST-02**: User can see chip ROI — actual points in BB/TC/FH gameweeks vs the user's season average GW score
- [x] **HIST-03**: User can see hit break-even tracking — for each -4pt transfer hit taken, whether the points gained broke even within the expected window (uses authenticated FPL transfer history)

### Transfer Intelligence

- [x] **GWT-01**: User can select a target GW in TransferPanel and see transfer recommendations re-ranked by xPts for that specific GW's fixtures only (not the current horizon average)

### UX Polish

- [x] **UX-01**: Horizon toggle labels renamed from "1 GW / 3 GW / 5 GW" to "Next 1 GW / Next 3 GWs / Next 5 GWs" in `GwToggle.tsx` and all column headers that reference the horizon

---

## Future Requirements (deferred)

- BACK-02: Transfer regret backtester (requires Python port of `suggestTransfers()` — deferred from v1.16)
- TC-01: Triple Captain decision engine
- BB-01: Bench Boost readiness score
- FH-01: Free Hit squad builder from full player pool
- WC-01: Wildcard structure comparison
- VER-01: Model versioning
- NLP-01: LLM prose summaries
- ALERT-01: In-app alert system

---

## Out of Scope

- Transfer ROI backtester (BACK-02) — needs Python port of `suggestTransfers()` first
- Push notifications or email alerts
- Real-time within-GW updates
- External press/injury feed scraping (third-party sources)

---

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| HEAT-01 | Phase 97 | 97-01, 97-02 | planned |
| HEAT-02 | Phase 97 | 97-01, 97-02 | planned |
| PGW-01 | Phase 98 | — | pending |
| PGW-02 | Phase 98 | — | pending |
| PGW-04 | Phase 98 | — | pending |
| PGW-03 | Phase 99 | 99-01, 99-02 | planned |
| HIST-01 | Phase 100 | — | pending |
| HIST-02 | Phase 100 | — | pending |
| HIST-03 | Phase 100 | — | pending |
| GWT-01 | Phase 101 | — | pending |
| UX-01 | Phase 101 | — | pending |
