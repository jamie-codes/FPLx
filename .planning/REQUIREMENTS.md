# Requirements: FPL Analyst v1.22

**Defined:** 2026-05-17
**Core Value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.

## v1.22 Requirements

### Scraper Pipeline (SCRP)

- [ ] **SCRP-01**: Pipeline emits `lineup_news.json` to Vercel Blob, deriving per-player `availability_factor` (1.0 / 0.75 / 0.5 / 0.25 / 0.0) and `status_label` (confirmed_start / doubted / confirmed_absent / unknown) from FPL official bootstrap fields (`status`, `chance_of_playing_next_round`, `news`, `news_added`)
- [ ] **SCRP-02**: Pipeline enriches `lineup_news.json` with premierleague.com/latest-player-injuries HTML (requests + BS4, non-fatal, `source_tier: "reputable"`) — often hours earlier than FPL bootstrap update
- [ ] **SCRP-03**: Pipeline enriches `lineup_news.json` with Sky Sports RSS team news (feedparser preferred, non-fatal, `source_tier: "reputable"`) — Datawrapper interactive page excluded, RSS only
- [ ] **SCRP-04**: Pipeline enriches `lineup_news.json` with BBC Sport RSS team news (feedparser preferred, non-fatal, `source_tier: "reputable"`)
- [ ] **SCRP-05**: Each scraper source is isolated in its own `try/except Exception` block outside the main pipeline try; `merged_players.json` is written regardless of scraper failure; `lineup_news.json` with empty `players[]` is never written to Blob (preserves previous run's valid data)
- [ ] **SCRP-06**: `lineup_news.json` includes a `source_health` object tracking `ok`, `last_success`, and `last_error` per source, enabling silent failure diagnosis without breaking consumers

### Infrastructure (INFRA)

- [ ] **INFRA-01**: `/api/lineup-news` route reads `lineup_news.json` from Vercel Blob; `useLineupNews` TanStack Query hook (6h staleTime) fetches from the route — follows the established gw-intel / set-pieces artifact pattern
- [ ] **INFRA-02**: All engine consumers treat `lineup_news.json` with `scraped_at` older than 48 hours as neutral — no `availability_factor` penalty applied when data is stale

### Engine Integration (ENGN)

- [ ] **ENGN-01**: User sees transfer suggestions penalise doubted (`×0.70`) and confirmed-absent (`×0.01`) buy candidates when lineup news is available — via optional `lineupNewsMap?: Map<number, LineupNewsEntry>` param in `suggestTransfers()`
- [ ] **ENGN-02**: User sees bench order and lineup optimiser treat confirmed-absent players as 0 EV score (sink to last bench slot automatically) when lineup news is available — via optional `lineupNewsMap` param in `optimiseLineup()` / `benchOrder()`

### UI Surfaces (UI)

- [ ] **UI-01**: User sees an availability badge (confirmed_start / doubted / confirmed_absent) on each `CaptainPicksPanel` CandidateRow when lineup news is available for that player
- [ ] **UI-02**: User sees doubted/absent buy candidates visually flagged in `TransferPanel` OCS rows when lineup news is available — inline news confidence badge or news text in the buy-candidate cell
- [ ] **UI-03**: User sees a "Team News Alert" severity card on the Decision Summary tab listing owned squad players with active news (within 14 days, respects existing staleness gate from NEWS-01)
- [ ] **UI-04**: User sees transfer suggestions on the Decision Summary tab factor in lineup news — `DecisionSummaryTab` threads `lineupNewsMap` into its `suggestTransfers()` call so the OCS table reflects availability penalties

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
| Twitter/X scraping | GH Actions Azure IPs permanently blocked since Jan 2025; official API costs USD 100/month; FPL bootstrap + RSS covers same information with acceptable delay |
| GemTable news badges | News is decision-contextual (transfer/captain/bench surfaces); GemTable rows would add noise without changing a weekly decision |
| Real-time / in-match updates | Data refreshes daily; in-match granularity not needed for personal tool |
| Mobile app | Responsive web covers mobile use case |
| Fully automated chip timing | Chip visibility in plan is in-scope; auto-timing remains deferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCRP-01 | TBD | Pending |
| SCRP-02 | TBD | Pending |
| SCRP-03 | TBD | Pending |
| SCRP-04 | TBD | Pending |
| SCRP-05 | TBD | Pending |
| SCRP-06 | TBD | Pending |
| INFRA-01 | TBD | Pending |
| INFRA-02 | TBD | Pending |
| ENGN-01 | TBD | Pending |
| ENGN-02 | TBD | Pending |
| UI-01 | TBD | Pending |
| UI-02 | TBD | Pending |
| UI-03 | TBD | Pending |
| UI-04 | TBD | Pending |

**Coverage:**
- v1.22 requirements: 14 total
- Mapped to phases: TBD (roadmap pending)
- Unmapped: 14

---
*Requirements defined: 2026-05-17*
