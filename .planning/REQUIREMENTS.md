# Requirements: FPL Analyst v1.21

**Defined:** 2026-05-16
**Core Value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.

## v1.21 Requirements

### UAT & Carry-Forward Fixes

- [ ] **UAT-01**: User verifies Transfer Regret Backtester renders correctly — dark mode, multi-transfer GW format, delta colour polarity, and captain view show no regressions
- [ ] **TRT-01**: RouteTreeTab "Hits" column displays total hits (not total transfers) matching the engine's `totalHits` field
- [ ] **TRT-02**: ChipToggle in RouteTreeTab is visibly present as a disabled stub (current null hardcode removed or replaced with a disabled UI state)

### GemTable Sparkline

- [ ] **SPARK-01**: User sees a `rank_trajectory` sparkline in GemTable using the existing `rank_trajectory` field from MergedPlayer — micro-sparkline cell using Recharts or inline SVG

### Team News (SCRAPER-01)

- [x] **NEWS-01**: `NewsBanner` badges older than 14 days (via `news_added` field) are suppressed from zinc-severity display to prevent stale badge fatigue in decision-critical surfaces
- [x] **NEWS-02**: User sees `NewsBanner` in `CaptainPicksPanel` candidate rows — team news shown alongside captain picks (e.g. "75% chance of playing")
- [x] **NEWS-03**: User sees `NewsBanner` in `TransferPanel`/`OpportunityCostTable` buy-candidate rows (staleness suppression from NEWS-01 applies)

### Weekly Prose Summary (NLP-01)

- [ ] **PROSE-01**: User sees `generated_at` displayed as relative time ("Updated 2 hours ago") in `ProseSummaryBlock` so they know when the prose summary was generated
- [ ] **PROSE-02**: Pipeline `generate_weekly_summary()` includes chip timing and lifecycle risk data in the prompt payload, producing a richer weekly narrative

### Model Versioning (VER-01)

- [ ] **VER-01**: `accuracy.py` version records include a `sample_gws` count field so the version comparison UI can label or filter cold-start entries with 0 contributing GWs
- [ ] **VER-02**: User sees a "Versions" pill in `AccuracyTab` alongside "Summary | Calibration | Back", displaying a `VersionHistoryTable` with hit rate, gate flags, and sample_gws per version record

## Future Requirements

### Chip Endgame

- **CHIP-FH-01**: Free Hit squad builder from full 700+ player pool (greedy + local search, 100m budget, 3-per-club cap, 1-GW xPts optimisation)
- **CHIP-WC-01**: Wildcard Structure Builder — 2-3 squad structure comparisons over 5/8/15 GW projected xPts
- **CHIP-TC-01**: Triple Captain decision engine extended comparison table (extend existing `computeTCScore`)
- **CHIP-BB-01**: Bench Boost Readiness Score incorporating bench xPts signal

### Alerts

- **ALERT-01**: Price/injury/set-piece change alerts + GW deadline reminder push notifications

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time / in-match updates | Data refreshes daily; in-match granularity not needed for personal tool |
| Mobile app | Responsive web covers mobile use case |
| News from external scrapers | FPL official news field is sufficient and safe; external scraping adds infra overhead |
| GemTable news badges | News is decision-contextual (transfer/captain surfaces); GemTable news rows would add noise without changing an action |
| Fully automated chip timing | Chip visibility in plan is in-scope; auto-timing remains deferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UAT-01 | Phase 114 | Pending |
| TRT-01 | Phase 114 | Pending |
| TRT-02 | Phase 114 | Pending |
| SPARK-01 | Phase 114 | Pending |
| NEWS-01 | Phase 115 | Complete |
| NEWS-02 | Phase 115 | Complete |
| NEWS-03 | Phase 115 | Complete |
| PROSE-01 | Phase 116 | Pending |
| PROSE-02 | Phase 116 | Pending |
| VER-01 | Phase 116 | Pending |
| VER-02 | Phase 116 | Pending |

**Coverage:**
- v1.21 requirements: 11 total
- Mapped to phases: 11 ✓
- Unmapped: 0

---
*Requirements defined: 2026-05-16*
*Last updated: 2026-05-17 after Phase 115 completion — NEWS-01/02/03 verified*
