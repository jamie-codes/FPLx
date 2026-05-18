# Requirements: FPL Analyst v1.24

**Defined:** 2026-05-18
**Core Value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.

## v1.24 Requirements

### Polish & Carry-Forwards (POL)

- [ ] **POL-01**: User can select a chip mode (None / Bench Boost / Triple Captain) in RouteTreeTab; `chipMode` no longer hardcoded to `null` (TRT-06 carry-forward from Phase 60)
- [ ] **POL-02**: RouteTreeTab displays the correct "Transfer Hits" column label (TRT-02 cosmetic carry-forward from Phase 60)
- [ ] **POL-03**: MinsRiskBadge visible on each player row in SquadView (Transfers tab)
- [ ] **POL-04**: MinsRiskBadge visible in the buy-player badge cluster of OpportunityCostTable (after StatusLabelBadge, before NewsBanner)
- [ ] **POL-05**: MinsRiskBadge visible as a column cell in GemTable (inline with existing signal columns)
- [ ] **POL-06**: MinsRiskBadge visible in PlayerComparisonModal for both compared players

### News Scraper (SCR)

- [ ] **SCR-01**: `pipeline/transfer_news.py` scrapes Sky Sports RSS, BBC Sport RSS, and Transfermarkt RSS; writes `transfer_news.json` to Vercel Blob on each pipeline run
- [ ] **SCR-02**: `pipeline/player_matching.py` shared utility matches player name mentions in article text to FPL player element IDs; used by transfer_news.py
- [ ] **SCR-03**: Each article classified as one of `confirmed_signing` / `rumour` / `injury_return` / `rotation_signal` / `general`; classification field present in transfer_news.json
- [ ] **SCR-04**: `/api/transfer-news` Route Handler and `useTransferNews()` TanStack Query hook expose the article feed to the UI
- [ ] **SCR-05**: Scraper runs behind `TRANSFER_NEWS_ENABLED` env var gate; pipeline continues non-fatally if scraper errors

### Season Review (REV)

- [ ] **REV-01**: Season summary card shows total rank, total points, captain hit rate %, transfer net gain/loss, best GW score, worst GW score — aggregated across all available GWs; N/A for GWs before app deployment
- [ ] **REV-02**: Decision quality A–D grade computed from captain EV rate (40%) + hit break-even rate (35%) + chip ROI positive rate (25%); chip GWs scored separately; methodology note displayed on the card
- [ ] **REV-03**: Season variance chart shows GW-by-GW rank trajectory with xPts expectation overlay; chip GWs highlighted
- [ ] **REV-04**: Season Review surfaces as "Season" sub-tab in the Analyse section, accessible on desktop and MobileNav

### Summer Window Tracker (WIN)

- [ ] **WIN-01**: Summer Window feed displays `transfer_news.json` articles sorted by date, filterable by classification (confirmed / rumour / injury / rotation); depends on SCR-01/SCR-04
- [ ] **WIN-02**: Confirmed signing badge appears on relevant player rows in GemTable and TransferPanel when a `confirmed_signing` article is matched to that player's element ID
- [ ] **WIN-03**: `IS_OFF_SEASON` pipeline gate detects end-of-season (no current GW in `events[]`) and prevents null-crash in `pipeline/run.py`; all off-season pipeline steps degrade gracefully

### Next Season Planner (NSP)

- [ ] **NSP-01**: `pipeline/archive_season.py` archives per-player `element-summary` history to Vercel Blob as `season_archive_gw38.json` before GW38 closes (one-time opportunity; no recovery path if missed)
- [ ] **NSP-02**: `buildPreSeasonSquad()` TypeScript function builds optimal 15-player squad from all 700+ FPL players using a caller-supplied score map; greedy heuristic first; Python-side ILP fallback via `pipeline/suggest_squad.py` + PuLP if greedy returns null
- [ ] **NSP-03**: GW1–8 fixture difficulty heatmap for next season reuses `HeatMapRow`; shows "Fixtures not yet published" empty state until FPL releases next-season data (expected late June/July)
- [ ] **NSP-04**: Next Season Planner surfaces in Plan section with squad builder UI; shows "Prices pending" graceful state when off-season FPL price data is unavailable

## Future Requirements

_(Deferred — not in scope for v1.24)_

- Twitter/X FPL account monitoring — blocked by GitHub Actions Azure datacenter IP policy; revisit if self-hosted runners adopted
- ILP as default squad solver — start greedy; promote PuLP only if greedy null rate is empirically unacceptable
- Decision quality threshold calibration — A–D grade cut-offs are proposed; empirical validation against real data needed next season
- Multi-season analytics — comparing across seasons; requires NSP-01 season archive to accumulate over 2+ seasons
- DH-05: Data health history graph beyond 7-run window — explicitly deferred from v1.14
- SPQ-05: Cross-season set-piece alerts — explicitly deferred from v1.14
- BACK-03: Full transfer ROI tracker (multi-GW persistent store) — out of scope since v1.20
- SETTLED_GWS dynamic bootstrap detection — hardcoded [33,34,35] in page.tsx; deferred from Phase 77

## Out of Scope

- Twitter/X scraping — GitHub Actions Azure IPs permanently blocked since Jan 2025; no fix without self-hosted runners
- Browser-side full-pool optimizer — C(700,15) ≈ 3.7×10^27 is computationally infeasible; Python ILP handles this server-side
- Push/email notifications for signing alerts — no notification infrastructure planned
- Multi-season historical comparison — requires 2+ years of NSP-01 season archive data; pre-condition not yet met
- Live in-match updates — data refreshes daily; no real-time requirement
- Mobile app — responsive web covers mobile use case

## Traceability

| REQ-ID  | Phase   | Status  |
|---------|---------|---------|
| POL-01  | Phase 122 | Pending |
| POL-02  | Phase 122 | Pending |
| POL-03  | Phase 122 | Pending |
| POL-04  | Phase 122 | Pending |
| POL-05  | Phase 122 | Pending |
| POL-06  | Phase 122 | Pending |
| SCR-01  | Phase 123 | Pending |
| SCR-02  | Phase 123 | Pending |
| SCR-03  | Phase 123 | Pending |
| SCR-04  | Phase 123 | Pending |
| SCR-05  | Phase 123 | Pending |
| REV-01  | Phase 124 | Pending |
| REV-02  | Phase 124 | Pending |
| REV-03  | Phase 124 | Pending |
| REV-04  | Phase 124 | Pending |
| WIN-01  | Phase 125 | Pending |
| WIN-02  | Phase 125 | Pending |
| WIN-03  | Phase 123 | Pending |
| NSP-01  | Phase 126 | Pending |
| NSP-02  | Phase 126 | Pending |
| NSP-03  | Phase 126 | Pending |
| NSP-04  | Phase 126 | Pending |
