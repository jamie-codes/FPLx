# Requirements — FPL Analyst v1.15

**Milestone:** v1.15 Pipeline Intelligence
**Started:** 2026-05-09
**Status:** Active

---

## v1 Requirements

### Data Health Dashboard (DH)

- [ ] **DH-01** Pipeline writes `pipeline/cache/data_health.json` as the last step in `run.py` (after all other artifacts); JSON contains: per-file write timestamps for each artifact, total player count, missing-player delta vs previous run, `understat_id null count`, `FPL-proxy-fallback count`, `xg_per90 null count`, and a `sanity_checks` array with `id/status/value/threshold` per check; error messages sanitized via `_sanitize_error()` (strips env-var tokens, paths; truncates at 200 chars)
- [ ] **DH-02** AccuracyTab shows a collapsible "Data Health" panel (collapsed by default, rendered at the top); panel header shows a single status pill (green = all OK / amber = warnings / red = errors); body shows signal rows with status icon, label, value, and threshold; reuses existing `TIER_CLASSES` for colour coding
- [ ] **DH-03** `/api/data-health` route reads `data_health.json` from Vercel Blob (USE_BLOB=true) or local cache (USE_BLOB=false), following the same pattern as `/api/accuracy`; `useDataHealth` TanStack Query hook uses `staleTime: 0` and `refetchInterval: 60_000` (NOT 6h — data health must reflect current state)

### Set-Piece Delivery Pipeline (SPQ)

- [ ] **SPQ-01** Pipeline scrapes per-team Understat shot events from `https://understat.com/team/{name}/2025` (primary takers only; ~20 requests; 24h disk cache); aggregates xG from shots where `situation IN ('FromCorner', 'DirectFreekick')` grouped by `player_assisted` to identify the set-piece deliverer; writes `pipeline/cache/sp_quality.json`; entire scrape step wrapped in try/except so a 403 bot-protection response does not poison `merged_players.json`
- [ ] **SPQ-02** Per-taker pipeline output: `corner_danger_score` (mean xG per assisted corner shot, null when < 5 samples), `fk_danger_score` (mean xG per direct-FK shot, null when < 3 samples), `delivery_quality_rank` (composite rank using Empirical-Bayes shrinkage k=20 to position-mean, null when both scores are null), `sp_sample_n` (sample count); unmatched Understat IDs logged and count surfaced in DH-01 sanity checks

---

## Previously Shipped (v1.14)

- [x] **SPQ-03** SetPieceTakerPanel shows delivery-quality tier badges — Elite / Good / Weak / "—"; tooltip shows xG per assisted shot with sample count; `/api/set-pieces` extended with `sp_quality` fields — shipped Phase 85
- [x] **GK-01/02/03** GK save-point projections (Poisson-floor formula, XPtsCell Saves row, gate) — shipped Phase 83

---

## Future Requirements (deferred)

- TC-01: Triple Captain decision engine comparing current GW vs future windows
- BB-01: Bench Boost readiness score (bench xPts × start_prob across all 4 bench players)
- FH-01: Free Hit squad builder from full 700-player pool (greedy + local search)
- WC-01: Wildcard structure comparison (2–3 squad structures scored over 5/8/15 GW horizon)
- SCRAPER-01: Lineup news scraper (FPL official news feed integration)
- SPQ-04: Set-piece quality league-wide table (all 20 teams ranked by delivery quality)
- GK-04: Penalty-save modelling (sample < 1/season; defer to off-season when sample grows)
- NLP-01: LLM prose summaries (weekly plain-English advice grounded in model output)
- ALERT-01: In-app alert system (price/injury/set-piece change banners, deadline reminders)
- REFRESH-01: Event-based pipeline refresh (deadline-aware GitHub Actions triggers)
- BACK-01: Decision history & regret backtester (captain/transfer ROI tracking)
- DH-04: Cron success history graph (sparkline of last 7 pipeline runs)

---

## Out of Scope

- Push notifications or email alerts (in-app only)
- Real-time within-GW probability updates
- Live predicted lineup scraping from third-party sites
- Per-player penalty-save rate modelling (< 1 sample/season for most GKs)
- xT model for set-piece delivery (xG-from-assisted-shots sufficient)

---

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| DH-01  | TBD   | —    | pending |
| DH-02  | TBD   | —    | pending |
| DH-03  | TBD   | —    | pending |
| SPQ-01 | TBD   | —    | pending |
| SPQ-02 | TBD   | —    | pending |
