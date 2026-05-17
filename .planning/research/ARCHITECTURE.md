# Architecture Research — v1.22 Lineup Intelligence

**Domain:** FPL Analyst — subsequent milestone adding multi-source lineup news scraping and intelligence surfaces to the existing Python pipeline → Vercel Blob → Next.js 16 Route Handlers → TanStack Query → React stack.
**Researched:** 2026-05-17
**Confidence:** HIGH — all findings derived from direct codebase reads of `pipeline/run.py`, `pipeline/merge.py`, `pipeline/upload.py`, `pipeline/gw_intel.py`, `src/lib/types.ts`, `src/lib/suggest-transfers.ts`, `src/lib/optimise-lineup.ts`, `src/components/squad/DecisionSummaryTab.tsx`, `src/components/captaincy/CaptainPicksPanel.tsx`, `src/components/news/NewsBanner.tsx`, `src/lib/newsSeverity.ts`, and `src/app/api/gw-intel/route.ts`.

---

## Integration Points

### Where lineup news data enters the existing system

The existing `news`, `news_added`, and `chance_of_playing_next_round` fields already flow from FPL bootstrap into `merged_players.json` via `pipeline/merge.py` (lines 992–995). The `NewsBanner` component and `computeNewsSeverity` classifier already consume them. **v1.22 does not change these fields** — it creates a separate `lineup_news.json` artifact that enriches confidence signals and drives new UI surfaces.

**The six integration points for v1.22:**

1. **`pipeline/run.py`** — call `compute_lineup_news()` from the new module, `save('lineup_news.json', lineup_news)`, wrapped in a non-fatal try/except block (same pattern as `prose_summary` at line 361 and `set_piece_quality` at line 243). Insert after `gw_intel` but before `last_updated.json`.

2. **`src/lib/suggest-transfers.ts`** — `suggestTransfers()` currently scores players on xPts with tier adjustments for rotation risk and DGW/BGW. Add an optional `lineupNewsMap?: Map<number, LineupNewsEntry>` parameter; inside the filter loop, apply a penalty multiplier to `scorePlayer()` for players whose news entry has `confidence === 'confirmed'` and `status === 'absent'`, and a lighter penalty for `confidence === 'high'` with `status === 'doubted'`. This is an additive scoring adjustment, not a hard filter.

3. **`src/lib/optimise-lineup.ts`** — `optimiseLineup()` uses `xPts_1gw === 0` as its BGW filter. Add a parallel downweight for confirmed-absent players: before the enumeration step, apply a multiplier (e.g., `× 0.0`) to the score of picks whose `lineupNewsMap` entry has `confidence === 'confirmed'` and `status === 'absent'`. Practically, this makes them score below any active player and pushes them to bench. Do NOT hard-exclude — the FPL constraint solver still needs 15 picks and formation validity.

4. **`src/components/captaincy/CaptainPicksPanel.tsx`** — `CandidateRow` already renders `<NewsBanner>` (Phase 115 NEWS-02). The new `confirmed_status` badge (e.g., a green "CONFIRMED" pill when a source verifies the player is starting) inserts alongside the existing badge cluster. This requires no hook change if `lineupNewsMap` is threaded from `useLineupNews()` in the parent `CaptainPicksPanel`.

5. **`src/components/squad/DecisionSummaryTab.tsx`** — currently has a 4-card grid (Captain Pick, Transfer Options, Chip Timing, Risk Flags) followed by `<CalibrationHealthIndicator>` and `<ProseSummaryBlock>`. The new "Team News Alert" card renders **inside the 4-card grid as a 5th conditional card** (only when the user's squad has players with active news at amber/red severity). Alternatively, it renders as a full-width card below the grid — this avoids breaking the 2-column desktop layout of the existing 4-card grid.

6. **`/api/lineup-news` route** — new route following the exact `gw-intel` pattern: reads `lineup_news.json` from Blob (USE_BLOB) or `pipeline/cache/lineup_news.json` (local), returns JSON with `Cache-Control: s-maxage=3600`.

---

## New Files

| File | Purpose |
|------|---------|
| `pipeline/lineup_news.py` | Scraper module: fetches FPL news (structured), Sky Sports, BBC Sport; normalises to `LineupNewsEntry` list; returns list, never writes (caller `run.py` handles `save()`). |
| `src/app/api/lineup-news/route.ts` | Route handler: Blob or local read of `lineup_news.json`, returns JSON. Follows `gw-intel/route.ts` verbatim structure. |
| `src/lib/hooks/useLineupNews.ts` | TanStack Query hook: `queryKey: ['lineup-news']`, `staleTime: 6h`, fetches `/api/lineup-news`, returns `LineupNewsResponse`. Follows `useGWIntel.ts` verbatim structure. |
| `src/components/squad/TeamNewsAlertCard.tsx` | New component: renders squad players with active amber/red news entries as a severity card. Receives `playerIds: number[]`, `lineupNewsMap: Map<number, LineupNewsEntry>`, and `players: ScoredPlayer[]` as props. |
| `pipeline/cache/lineup_news.json` | Seed file: `{ "generated_at": "...", "gameweek": 0, "players": [] }` — prevents 404/ENOENT on fresh checkout. |

---

## Modified Files

| File | What Changes | Scope |
|------|-------------|-------|
| `pipeline/run.py` | Import `compute_lineup_news` from `lineup_news`; add non-fatal try/except block after `gw_intel` save, calling `compute_lineup_news()` and `save('lineup_news.json', ...)`. | ~12 lines added |
| `src/lib/types.ts` | Add `LineupNewsEntry` interface and `LineupNewsResponse` type. Add optional `lineup_news_status?: 'confirmed_start' \| 'confirmed_absent' \| 'doubted' \| 'unknown'` field to `MergedPlayer` (pipeline-populated path) — OR keep it entirely in the separate `lineup_news.json` artifact and resolve via `Map<number, LineupNewsEntry>` in the hook consumers. **Recommend the Map approach** — avoids bloating `merged_players.json` schema and keeps the scraper non-fatal path clean. | ~20 lines added |
| `src/lib/suggest-transfers.ts` | Add optional `lineupNewsMap?: Map<number, LineupNewsEntry>` to `SuggestTransfersParams`. In `scorePlayer()`, multiply score by `ABSENT_PENALTY` (0.01) for confirmed-absent players and `DOUBTED_PENALTY` (0.7) for high-confidence doubted players. | ~25 lines added |
| `src/lib/optimise-lineup.ts` | Add optional `lineupNewsMap?: Map<number, LineupNewsEntry>` to `optimiseLineup()` signature. Before enumeration, apply same penalty multipliers to the effective score. | ~20 lines added |
| `src/components/squad/DecisionSummaryTab.tsx` | Import `useLineupNews`; derive `lineupNewsMap`; compute `squadNewsAlerts` (squad players with amber/red news from the map); render `<TeamNewsAlertCard>` below the 4-card grid (full-width, conditional on `squadNewsAlerts.length > 0`). Thread `lineupNewsMap` into `suggestTransfers()` call. | ~40 lines added |
| `src/components/captaincy/CaptainPicksPanel.tsx` | Import `useLineupNews`; derive `lineupNewsMap`; thread `confirmedStatus` prop into `CandidateRow` from the map lookup; render "CONFIRMED" green pill or "DOUBT" amber pill alongside existing badge cluster. | ~25 lines added |
| `src/components/transfers/TransferPanel.tsx` | Thread `lineupNewsMap` into `suggestTransfers()` call (same as `DecisionSummaryTab`). | ~15 lines added |

---

## Data Flow

```
GitHub Actions cron (daily)
  └─ pipeline/run.py
       ├─ compute_lineup_news()               [pipeline/lineup_news.py — NEW]
       │    ├─ FPL bootstrap news fields      [structured, no scraping needed]
       │    ├─ Sky Sports scrape              [requests + BeautifulSoup, rate-limited]
       │    ├─ BBC Sport scrape               [requests + BeautifulSoup, rate-limited]
       │    └─ Returns: List[LineupNewsEntry]
       └─ save('lineup_news.json', result)    [Vercel Blob / pipeline/cache/]

Vercel Blob: lineup_news.json
  └─ /api/lineup-news (route.ts)             [NEW — mirrors gw-intel pattern]
       └─ useLineupNews() hook               [NEW — mirrors useGWIntel pattern]
            └─ lineupNewsMap = Map<id, entry>
                 ├─ suggestTransfers({ ..., lineupNewsMap })   [MODIFIED]
                 ├─ optimiseLineup({ ..., lineupNewsMap })     [MODIFIED]
                 ├─ DecisionSummaryTab → TeamNewsAlertCard     [NEW component]
                 └─ CaptainPicksPanel → CandidateRow badge     [MODIFIED]
```

### `LineupNewsEntry` schema (proposed for `src/lib/types.ts`)

```typescript
export interface LineupNewsEntry {
  player_id: number           // FPL element id
  web_name: string            // for display without player lookup
  team_id: number
  status: 'confirmed_start' | 'confirmed_absent' | 'doubted' | 'unknown'
  confidence: 'confirmed' | 'high' | 'low'   // source tier
  source: string              // e.g. "fpl_official", "sky_sports", "bbc_sport"
  headline: string            // short news text for display
  scraped_at: string          // ISO timestamp
}

export interface LineupNewsResponse {
  generated_at: string        // ISO timestamp of scrape run
  gameweek: number
  players: LineupNewsEntry[]
}
```

### Python schema (proposed for `pipeline/lineup_news.py`)

```python
@dataclass
class LineupNewsEntry:
    player_id: int
    web_name: str
    team_id: int
    status: str          # 'confirmed_start' | 'confirmed_absent' | 'doubted' | 'unknown'
    confidence: str      # 'confirmed' | 'high' | 'low'
    source: str
    headline: str
    scraped_at: str      # ISO timestamp
```

---

## Suggested Build Order

The dependency chain is pipeline → artifact → API route → hook → engine integration → component integration. Each step has a clean testable boundary.

### Phase A: Pipeline Scraper (no frontend dependencies)

1. Write `pipeline/lineup_news.py` with `compute_lineup_news(bootstrap, finished_gws) -> list[dict]`.
   - Start with FPL official fields only (`news`, `news_added`, `chance_of_playing_next_round` from bootstrap). This is structured data — no scraping, zero risk.
   - Add Sky Sports scraper with `requests` + `BeautifulSoup`. Rate-limit at 1s between requests. Wrap in try/except — scrape failure returns empty list, FPL-only data still writes.
   - Add BBC Sport scraper using same pattern.
   - Write `pipeline/cache/lineup_news.json` seed file.
2. Wire into `pipeline/run.py` in the non-fatal try/except block.
3. Run pipeline locally, verify `lineup_news.json` is written.

### Phase B: API Route and Hook (no engine/component dependencies)

4. Write `src/app/api/lineup-news/route.ts` (verbatim `gw-intel/route.ts` structure, just different filename and error message).
5. Write `src/lib/hooks/useLineupNews.ts` (verbatim `useGWIntel.ts` structure).
6. Add `LineupNewsEntry` and `LineupNewsResponse` types to `src/lib/types.ts`.

### Phase C: Engine Integration (depends on B; no component dependencies)

7. Modify `src/lib/suggest-transfers.ts` — add `lineupNewsMap` optional param and penalty scoring. TDD: unit tests with mock `lineupNewsMap` entries for confirmed-absent and doubted players.
8. Modify `src/lib/optimise-lineup.ts` — add `lineupNewsMap` optional param and score multipliers. TDD: unit tests verifying confirmed-absent bench preference.

### Phase D: Component Integration (depends on B and C)

9. Write `src/components/squad/TeamNewsAlertCard.tsx`. TDD first.
10. Modify `src/components/squad/DecisionSummaryTab.tsx` — add `useLineupNews()`, derive map, thread into `suggestTransfers()`, render `<TeamNewsAlertCard>`.
11. Modify `src/components/captaincy/CaptainPicksPanel.tsx` — add `useLineupNews()`, thread confirmed status badge into `CandidateRow`.
12. Modify `src/components/transfers/TransferPanel.tsx` — thread `lineupNewsMap` into `suggestTransfers()`.

---

## Phase Breakdown Suggestion

### Phase 1: SCRAPER-01 — `pipeline/lineup_news.py` + artifact + API route + hook

**Deliverables:** `pipeline/lineup_news.py`, `pipeline/cache/lineup_news.json` seed, `run.py` wiring, `src/app/api/lineup-news/route.ts`, `src/lib/hooks/useLineupNews.ts`, `LineupNewsEntry`/`LineupNewsResponse` types.

**Why first:** The entire frontend stack has nothing to consume until the artifact exists. FPL official fields alone (no scraping) are sufficient to unblock Phase 2 and 3 — the Sky Sports / BBC scraper layers can be additive within this phase or deferred.

**Risk note:** Twitter/X API is rate-limited and requires credentials. De-risk by treating it as an additive scraper that silently no-ops when the `TWITTER_BEARER_TOKEN` env var is absent. Do not block the phase on X integration.

**Test boundary:** `pytest pipeline/lineup_news.py` — mock bootstrap fixture, assert returned list shape and field completeness.

### Phase 2: INTEL-01 and INTEL-03 — Engine integrations (`suggestTransfers` + `benchOrder`/`optimiseLineup`)

**Deliverables:** Modified `suggest-transfers.ts` with `lineupNewsMap` penalty scoring, modified `optimise-lineup.ts` with `lineupNewsMap` downweight, corresponding unit tests.

**Why second:** Pure-function changes to pure-function engines. No component changes needed. TDD-safe with mocked `lineupNewsMap`. Can be written and tested without the live `useLineupNews` hook in place.

**Note on `benchOrder`:** The existing `benchOrder()` function lives in `src/lib/optimise-lineup.ts` (used via `OptimiserPanel`). Confirmed-absent players should rank to bench position 4 (GK slot excluded). Apply the same `lineupNewsMap` multiplier.

### Phase 3: INTEL-02 and INTEL-04 — Component integrations (CaptainPicksPanel + DecisionSummaryTab)

**Deliverables:** `TeamNewsAlertCard.tsx` (new), modified `CaptainPicksPanel.tsx` (confirmed status badge), modified `DecisionSummaryTab.tsx` (useLineupNews + TeamNewsAlertCard + suggestTransfers threading), modified `TransferPanel.tsx` (suggestTransfers threading).

**Why last:** Depends on Phase 1 (hook) and Phase 2 (engine params). All component modifications are additive — existing tests remain valid. Each component receives `lineupNewsMap` as a memo-derived prop or is computed from `useLineupNews()` directly inside the component.

---

## Key Architectural Decisions

### Separate artifact, not merged_players.json enrichment

`lineup_news.json` is a separate Vercel Blob artifact, not merged into `merged_players.json`. Rationale:
- Scraper failure must never poison `merged_players.json` (non-fatal run.py pattern)
- `merged_players.json` already contains `news`/`news_added`/`chance_of_playing_next_round` from FPL official — the scraper adds *confidence* from external sources, not replacing existing fields
- Separate artifact means the frontend can show stale scraper data without affecting the core player data

### Map not array for frontend consumption

`useLineupNews()` returns a `LineupNewsResponse`, but `DecisionSummaryTab` and `CaptainPicksPanel` derive a `Map<number, LineupNewsEntry>` via `useMemo`. This mirrors the existing `clubFormMap` pattern in `DecisionSummaryTab` (line 188).

### Non-fatal pipeline wrapping

The `compute_lineup_news()` call in `run.py` is wrapped in the same non-fatal try/except pattern as `prose_summary` (line 361) and `set_piece_quality` (line 243). A scraping failure writes nothing and logs a warning — the rest of the pipeline completes normally.

### Confidence tiers map to scoring penalties

```
confidence: 'confirmed', status: 'absent'  → scorePlayer × 0.01  (effectively removed from transfer pool)
confidence: 'high',      status: 'doubted' → scorePlayer × 0.70  (demoted but not excluded)
confidence: 'low',       any               → scorePlayer × 0.90  (minimal adjustment)
confidence: 'confirmed', status: 'confirmed_start' → scorePlayer × 1.10  (slight upweight)
```

These multipliers apply only to `suggestTransfers()` and `optimiseLineup()`. The `TeamNewsAlertCard` and `CaptainPicksPanel` badge display all severity levels regardless of confidence tier.

### Twitter/X treated as optional enrichment

X integration is gated on `TWITTER_BEARER_TOKEN` env var presence. When absent, `compute_lineup_news()` returns FPL official + web scraper results without X signals. This prevents the pipeline from requiring Twitter API credentials on first deploy.
