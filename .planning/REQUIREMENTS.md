# Requirements — FPL Analyst v1.16

**Milestone:** v1.16 Modelling & Trust
**Started:** 2026-05-09
**Status:** Active

---

## v1 Requirements

### Modelling & Trust

- [ ] **MC-01** Per-player Monte Carlo simulation over 5 GWs — samples `xPts_1gw` distributions (Poisson/Bernoulli parameters from existing pipeline), runs ≥1000 iterations, writes `xPts_5gw_p10/p50/p90` and `rank_trajectory` per player to `merged_players.json`; gated by `mc_enabled` flag in `accuracy_backtest.json`
- [x] **CAL-01** AccuracyTab calibration chart — plots predicted xPts decile vs actual points per decile over the last 5 GWs; uses existing recharts; shows per-position breakdown; complements the existing accuracy backtest table

### Sensitivity & Explainability

- [ ] **SENS-01** Per-player fragility badge — 5 perturbations (start_prob −0.15, mins_60 −0.10, fixture +1 tier, cost +0.5m, news flip to "doubt"); ROBUST (nothing reverses ranking) / FRAGILE (1 perturbation reverses) / KNIFE EDGE (2+ reverse); rendered in GemTable and TransferPanel; pure TypeScript, no pipeline changes
- [x] **WHY-01** Rejection explainer — deterministic gate-cascade (≥6 predicates: ownership %, fixture tier, form signal, start_prob, price trend, lifecycle label) explains why the engine ranked a player low; two entry points: search field in TransferPanel ("Why isn't X recommended?") and head-to-head in GemTable expand ("Why is X ranked above Y?")

### Pipeline

- [x] **SCRAPER-01** FPL news flags in UI — surface `news`, `news_added`, and `chance_of_playing_next_round` fields (already in pipeline/merge.py) as a news banner/badge in TransferPanel and a status indicator in GemTable; no new pipeline scraping; gated by `news_flag_enabled` display config
- [x] **REFRESH-01** Event-aware pipeline scheduling — add deadline-guard script `pipeline/refresh_gate.py` that exits early unless within 90-min window of next GW deadline (reads `events[].deadline_time` from FPL bootstrap); add dense `schedule:` cron entries to `.github/workflows/pipeline.yml` for Fri/Sat/Sun GW windows; add `concurrency: cancel-in-progress` guard to prevent race with existing 4×/day cron
- [ ] **DH-04** Cron history sparkline — extend `data_health.json` with a rolling `history` array (last 7 run entries: timestamp + overall_status); render as `DataHealthSparkline` using recharts `<LineChart>` inside existing `DataHealthPanel` in AccuracyTab; zero new API routes or hooks

### Analysis

- [ ] **BACK-01** Captain decision backtester — pipeline saves `captain_picks_gw{N}.json` to Vercel Blob after each run (mirroring existing `predictions_snapshot_gw{N}.json` pattern); `/api/decision-history` + `useDecisionHistory` hook reads snapshots; new "Back" sub-tab in Accuracy section shows GW-by-GW captain regret score (user's pick vs snapshotted top recommendation at decision time — NOT retrospective max); authenticated FPL API `/entry/{id}/event/{gw}/picks/` used to backfill actual captain per GW; localStorage ring buffer stores last 38 GWs
- [ ] **SPQ-04** Set-piece delivery league table — all 20 PL teams ranked by composite delivery quality score (aggregated from `sp_quality.json`); rendered as a toggle within the existing Set Pieces tab; teams with insufficient sample shown in a separate section; zero pipeline changes; client-side aggregation in `src/lib/setPieceLeague.ts`

---

## Previously Shipped (v1.15 / v1.14)

- [x] **DH-01/02/03** Data Health Dashboard — shipped Phase 82 (2026-05-08)
- [x] **SPQ-01/02** Set-Piece Delivery Pipeline — shipped Phase 84 (2026-05-09)
- [x] **SPQ-03** SetPieceTakerPanel delivery-quality badges — shipped Phase 85 (2026-05-09)
- [x] **GK-01/02/03** GK save-point projections — shipped Phase 83 (2026-05-09)

---

## Future Requirements (deferred)

- BACK-02: Transfer regret backtester (requires Python port of `suggestTransfers()` — deferred v1.17)
- SCRAPER-02: External press/injury feed scraping (third-party sources — deferred post-season)
- TC-01: Triple Captain decision engine
- BB-01: Bench Boost readiness score
- FH-01: Free Hit squad builder
- WC-01: Wildcard structure comparison
- SPQ-05: Set-piece taker change alerts across seasons
- GK-04: Penalty-save modelling (< 1 sample/season)
- NLP-01: LLM prose summaries
- ALERT-01: In-app alert system
- DH-05: Cron success history graph beyond 7 runs

---

## Out of Scope

- HTML scraping of `fantasy.premierleague.com` (Cloudflare bot protection; bootstrap JSON sufficient)
- True event-driven GitHub Actions (Actions has no conditional cron — dense cron + guard is the pattern)
- Transfer regret backtester in v1.16 (needs Python port first)
- IndexedDB for decision history (localStorage sufficient for 38-GW season; ~400KB)
- Real-time within-GW updates
- Push notifications or email alerts

---

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| MC-01 | Phase 90 | — | pending |
| CAL-01 | Phase 91 | — | pending |
| SENS-01 | Phase 93 | — | pending |
| WHY-01 | Phase 94 | — | pending |
| SCRAPER-01 | Phase 88 | — | pending |
| REFRESH-01 | Phase 89 | — | pending |
| DH-04 | Phase 92 | — | pending |
| BACK-01 | Phase 96 | — | pending |
| SPQ-04 | Phase 95 | — | pending |
