# Roadmap: FPL Analyst

## Overview

Six phases build up from the data foundation that gates everything to the polished analytics surface. Phases 1 and 2 are strictly sequential — no UI is possible until the Python pipeline is writing scored JSON to Blob. Phase 3 (Gem table) and Phase 4 (DefCon) are independent of each other and can proceed in parallel, since DefCon is FPL-native and does not touch Understat. Phase 5 (squad and transfers) is the highest-complexity phase and depends on Gem scores existing. Phase 6 adds supporting analytics and UI polish. The architecture is intentionally minimal: no database, no auth complexity in v1, one daily data refresh.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Foundation** - Next.js scaffold, FPL Route Handler proxy, Zod adapter, Vercel Blob cache, and player ID mapping — gates everything (completed 2026-03-27)
- [ ] **Phase 2: Understat Pipeline + Merged Data API** - Python pipeline (soccerdata xG/xA + FPL fetch), FPL/Understat merge, custom FDR, Blob upload, `/api/players` endpoint
- [ ] **Phase 3: Gem Rating Table** - Composite scoring (7 dimensions, per-90), scored pipeline output, sortable/filterable GemTable UI — core product value
- [ ] **Phase 4: DefCon Analysis** - Per-match hit rate from element-summary history, position-split tables (DEF=10, MID/FWD=12), DefConTable UI
- [ ] **Phase 5: Squad View + Transfer Suggestions** - Team ID input, squad fetch, transfer-engine.ts (position lock + approximate budget), transfer suggestions ranked by Gem delta
- [ ] **Phase 6: Club Form, Value Gems and Polish** - Club form table, cheap gems / low-owned views, fixture difficulty badges, last-updated display, price trend

## Phase Details

### Phase 1: Data Foundation
**Goal**: The infrastructure layer is in place so every subsequent phase can build on reliable, validated FPL data without CORS issues, field name fragility, or silent player ID mismatches
**Depends on**: Nothing (first phase)
**Requirements**: DAT-01, PPS-01, PPS-02, PPS-03, PPS-04
**Success Criteria** (what must be TRUE):
  1. A Next.js Route Handler proxies FPL API requests server-side — any FPL endpoint can be fetched from the browser via `/api/fpl/[...proxy]` with no CORS error
  2. `lib/fpl-adapter.ts` validates raw FPL responses with Zod — if a required field is missing or renamed, validation returns a structured failure and aborts the pipeline refresh, serving the previous cache with `stale: true`
  3. `player_id_map.json` exists with FPL-to-Understat ID mappings — zero unmatched players for top-6 first-choice starters when the map is applied
  4. `pipeline/fpl_client.py` fetches `bootstrap-static` and `fixtures` data and writes them to Vercel Blob with a `last_updated.json` timestamp (element-summary fetching added in Phase 4)
  5. Promoted-team players with no Understat history are represented as null xG/xA (not zero) in the schema from day one
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Next.js scaffold, shared types, Vitest setup
- [x] 01-02-PLAN.md — Zod adapter, FPL proxy Route Handler, test suite
- [x] 01-03-PLAN.md — Python pipeline, player ID map, GitHub Actions cron

### Phase 2: Understat Pipeline + Merged Data API
**Goal**: A daily-run Python pipeline produces a single merged player dataset combining FPL and Understat data, with custom FDR and per-90 normalisation, accessible via `/api/players`
**Depends on**: Phase 1
**Requirements**: GEM-03, FFA-01, FFA-02, FFA-04, UIX-03, UIX-04
**Success Criteria** (what must be TRUE):
  1. `pipeline/understat_client.py` fetches current-season EPL xG and xA per player via soccerdata and merges on `player_id_map.json` — all top-6 first-choice starters have non-null xG/xA
  2. All form metrics in `merged_players.json` are normalised per 90 minutes — a player in a Double Gameweek does not appear twice as strong as an equally-performing single-fixture player
  3. Custom FDR is computed from rolling xGA (not the official `team_h_difficulty` integer) and stored per player's upcoming fixtures in the merged dataset
  4. `GET /api/players` returns the merged dataset from Blob — a browser request completes in under 500ms on a warm cache
  5. `usePlayers()` TanStack Query hook fetches from `/api/players` with a 6-hour stale time — the network tab shows a single request per session on page load
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Understat client, merge module with per-90/FDR/fixtures, pipeline integration
- [ ] 02-02-PLAN.md — MergedPlayer TypeScript types, /api/players Route Handler
- [ ] 02-03-PLAN.md — usePlayers() TanStack Query hook, QueryClientProvider wiring

### Phase 3: Gem Rating Table
**Goal**: The manager can see every FPL player ranked by a composite Gem score that combines seven dimensions, filterable by position, so the best targets are immediately visible
**Depends on**: Phase 2
**Requirements**: GEM-01, GEM-02, FFA-01, FFA-02, PPS-01, PPS-02, PPS-03, PPS-04, UIX-01, UIX-02
**Success Criteria** (what must be TRUE):
  1. Every player in the merged dataset has a Gem score computed from all seven dimensions: custom FDR, per-90 form, xG/xA, ownership percentage, minutes reliability, DefCon likelihood, and set piece role
  2. The GemTable renders at `/` (default route) showing all players sortable by any column — clicking "xG per 90" sorts the table by that column without a page reload
  3. The table can be filtered to a single position (GK / DEF / MID / FWD) — selecting "MID" shows only midfielders and the row count updates accordingly
  4. Each row surfaces the component scores (not just the composite) so the manager can see why a player ranked where they did
  5. Players with missing Understat data show a dash (not zero) in xG/xA columns and their Gem score is computed on available dimensions only
**Plans**: TBD
**UI hint**: yes

### Phase 4: DefCon Analysis
**Goal**: The manager can see per-player DefCon hit rates and distance-to-threshold for DEF and MID/FWD separately, enabling identification of reliable +2 point earners
**Depends on**: Phase 1
**Requirements**: DEF-01, DEF-02, DEF-03, DEF-04, UIX-01, UIX-02
**Success Criteria** (what must be TRUE):
  1. DefCon hit rate per player is calculated from per-match `element-summary` history — the threshold check is per-match (DEF: 10 contributions, MID/FWD: 12), not season aggregate divided by games
  2. Two separate tables render: one for DEF players (threshold=10), one for MID/FWD players (threshold=12) — they are never combined and each is sortable by hit rate
  3. Each row shows: hit rate (%), average contributions per 90, and distance-to-threshold for the current season
  4. MID/FWD hit rates use the `defensive_contributions` field (not `clearances_blocks_interceptions`) — known box-to-box midfielders show non-zero hit rates
**Plans**: TBD
**UI hint**: yes

### Phase 5: Squad View + Transfer Suggestions
**Goal**: The manager can enter their FPL Team ID and receive ranked transfer suggestions that respect position rules, their approximate budget, and their actual squad
**Depends on**: Phase 3
**Requirements**: TIS-01, TIS-02, TIS-03, TRF-01, TRF-02, TRF-03, TRF-04, TRF-05, TRF-06, TRF-07
**Success Criteria** (what must be TRUE):
  1. Entering a valid FPL Team ID loads the user's current squad split by position (GK/DEF/MID/FWD) with price, ownership, minutes played, and injury flag displayed for each player
  2. Transfer suggestions appear ranked by Gem score improvement (delta) — the top suggestion is the single swap that most improves the squad's overall Gem rating
  3. Every transfer suggestion enforces position lock — no suggestion ever recommends a MID as replacement for a DEF
  4. Budget enforcement uses `now_cost` labelled as approximate — each suggestion shows the estimated cost and labels prices as "approx" when no FPL login is provided
  5. When Free Hit (`active_chip == "freehit"`) or Wildcard is detected, the panel shows a chip warning instead of normal suggestions
  6. If no transfer improves the squad's Gem rating, the panel explicitly recommends saving the transfer rather than showing a forced suggestion
**Plans**: TBD
**UI hint**: yes

### Phase 6: Club Form, Value Gems and Polish
**Goal**: Supporting analytics (club form, value gems, price trends) and UI polish (fixture badges, last-updated timestamp) are in place, making the app complete for daily use
**Depends on**: Phase 3
**Requirements**: FFA-03, VAL-01, VAL-02, VAL-03, UIX-01, UIX-02, UIX-03, UIX-04, DAT-02
**Success Criteria** (what must be TRUE):
  1. A club form table shows wins, goals scored, and goals conceded over a rolling N-game window for all 20 Premier League clubs, sortable by any column
  2. A "Value Gems" view lists players with ownership below a threshold who rank highly by Gem score — each row shows price, ownership percentage, and recent points
  3. Price trend (rising/falling/stable) is displayed for all players in the gem table and value view
  4. Fixture difficulty badges on every player row use the custom FDR (not official FDR integers) and clearly distinguish home from away
  5. A "Last updated" timestamp is visible on every data view and reflects the most recent pipeline run timestamp from `last_updated.json`
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order. Phases 3 and 4 are independent and can run in parallel; Phase 5 requires Phase 3 complete; Phase 6 requires Phase 3 complete.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 3/3 | Complete   | 2026-03-27 |
| 2. Understat Pipeline + Merged Data API | 0/3 | Not started | - |
| 3. Gem Rating Table | 0/? | Not started | - |
| 4. DefCon Analysis | 0/? | Not started | - |
| 5. Squad View + Transfer Suggestions | 0/? | Not started | - |
| 6. Club Form, Value Gems and Polish | 0/? | Not started | - |
