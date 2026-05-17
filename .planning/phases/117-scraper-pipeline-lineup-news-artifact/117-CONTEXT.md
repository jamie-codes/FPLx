# Phase 117: Scraper Pipeline & Lineup News Artifact - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a Python scraper pipeline that emits `lineup_news.json` to Vercel Blob with per-player availability signals derived from four sources (FPL official bootstrap, premierleague.com HTML, Sky Sports RSS, BBC Sport RSS), plus the Next.js API route (`/api/lineup-news`) and TanStack Query hook (`useLineupNews`) to serve the artifact — following the established gw-intel / set-pieces pattern. No UI surfaces (Phase 119). No engine integration (Phase 118).

</domain>

<decisions>
## Implementation Decisions

### Pipeline Integration
- **D-01:** `lineup_news` runs **inside `run.py`** as a non-fatal block, not as a standalone script. Follows the `set_piece_quality` / `prose_summary` isolation pattern — wrapped in its own `try/except Exception` so it cannot poison `run.py` on failure.
- **D-02:** Called **right after bootstrap fetch** (not after `merged_players`). `lineup_news` only needs `bootstrap` — positioning it early means scrapers fire while the rest of the pipeline computes xmins/bonus/defcon, reducing wall-clock impact.

### Scraper Merge Semantics
- **D-03:** Web scrapers (premierleague.com, Sky Sports RSS, BBC Sport RSS) contribute **news_headline + news_source fields only** — they NEVER change `availability_factor`. FPL official bootstrap is always authoritative for the factor value. No conflict resolution needed.
- **D-04:** Player matching via **fuzzy web_name match** (e.g. `difflib.SequenceMatcher`) against FPL `web_name` / `second_name`. Unmatched names are logged but non-fatal — a scraper mention that can't be mapped to an FPL player ID is silently dropped from player entries.
- **D-05:** Per-player object shape in `lineup_news.json`:
  ```json
  {
    "id": 308,
    "availability_factor": 0.75,
    "status_label": "doubted",
    "news_headline": "Salah doubtful for Saturday",
    "news_source": "skysports",
    "scraped_at": "2026-05-17T08:00:00Z"
  }
  ```
  `news_headline` and `news_source` are `null` when no scraped match found. `news_source` values: `"fpl"` | `"premierleague"` | `"skysports"` | `"bbc"` | `null`.

### Refresh Schedule
- **D-06:** `lineup_news.json` refreshes at **run.py's existing cadence** (already runs multiple times per day). No new cron entry needed. The 48h staleness guard (INFRA-02) provides safety net for any gap.
- **D-07:** `useLineupNews` staleTime = **6 hours** (consistent with `useGWIntel`, `useSetPieces` — confirmed in discussion).

### FPL Status → availability_factor Mapping
- **D-08:** `chance_of_playing_next_round` is the **primary signal**; `status` is the fallback. Exact rules:

  | chance_of_playing | status     | availability_factor | status_label       |
  |-------------------|------------|---------------------|--------------------|
  | null              | 'a'        | 1.0                 | confirmed_start    |
  | 75                | any        | 0.75                | doubted            |
  | 50                | any        | 0.5                 | doubted            |
  | 25                | any        | 0.25                | doubted            |
  | 0                 | any        | 0.0                 | confirmed_absent   |
  | null              | 'd'        | 0.5                 | doubted (safe default) |
  | null              | 'i','s','u'| 0.0                 | confirmed_absent   |
  | null              | 'n'        | 0.0                 | confirmed_absent   |
  | null              | unknown    | null                | unknown            |

- **D-09:** `chance_of_playing_next_round` **wins over** `status='a'` — if FPL sets chance to 75 on a player, treat as 0.75 doubted even if status is still 'a'. FPL sometimes updates chance before status; this avoids false confirmed_start signals.
- **D-10:** Unrecognised status codes → `availability_factor = null`, `status_label = "unknown"`. Forward-compatible, defensive. `status='n'` (not in squad) → `0.0` confirmed_absent.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Scraper Pipeline (SCRP-01–SCRP-06) — per-player field spec, scraper isolation rules, source_health schema, empty-players[] guard
- `.planning/REQUIREMENTS.md` §Infrastructure (INFRA-01, INFRA-02) — API route + hook spec, 48h staleness guard
- `.planning/ROADMAP.md` Phase 117 — success criteria (5 SC items)

### Existing Pipeline Pattern (replicate this)
- `pipeline/run.py` — non-fatal block pattern (see `set_piece_quality` block ~line 241 and `prose_summary` block ~line 361); `lineup_news` follows this exact structure
- `pipeline/run.py` — bootstrap fetch sequence; `lineup_news` is called immediately after `save('fpl_bootstrap.json', bootstrap)`

### Existing API Route Pattern (replicate this)
- `src/app/api/gw-intel/route.ts` — minimal blob-or-local route pattern to clone
- `src/app/api/set-pieces/route.ts` — `readJsonArtifact()` helper with `USE_BLOB` branch; can be extracted or replicated

### Existing Hook Pattern (replicate this)
- `src/lib/hooks/useGWIntel.ts` — minimal TanStack Query hook to clone (6h staleTime)
- `src/lib/hooks/useSetPieces.ts` — alternate hook reference with same pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pipeline/upload.py` `save()` function: handles both local cache write and Vercel Blob upload based on `USE_BLOB` env var — call `save('lineup_news.json', payload)` exactly as other modules do
- `USE_BLOB` env var: already present in all pipeline code; no new env setup needed
- `pipeline/run.py` `try/except Exception` isolation blocks: copy structure verbatim from `set_piece_quality` block
- `src/app/api/set-pieces/route.ts` `readJsonArtifact()` helper: reads from Blob or local `pipeline/cache/` with consistent error handling — replicate for `/api/lineup-news`

### Established Patterns
- Non-fatal scraper isolation: each scraper in its own `try/except Exception` block; failure sets `source_health[source].ok = False`, logs to stderr, continues
- API routes: `GET()` handler with `USE_BLOB` branch, `Cache-Control: public, s-maxage=3600` response header, `Response.json()` returns
- TanStack Query hooks: `useQuery` with 6h staleTime, `queryKey: ['lineup-news']`, fetch to `/api/lineup-news`
- Blob guard pattern (SCRP-05): read existing blob before writing; only write if `players.length > 0`; preserve previous run on failure

### Integration Points
- `pipeline/run.py`: `lineup_news` module called as `compute_lineup_news(bootstrap)` right after line ~142 (`save('fpl_bootstrap.json', bootstrap)`)
- New file: `pipeline/lineup_news.py` — standalone module, imported into `run.py`
- New file: `src/app/api/lineup-news/route.ts`
- New file: `src/lib/hooks/useLineupNews.ts`
- New types: `LineupNewsPlayer`, `LineupNews`, `LineupNewsSource`, `SourceHealth` in `src/lib/types.ts` or `src/lib/types/lineup-news.ts`

</code_context>

<specifics>
## Specific Ideas

- `news_source` field uses string literals matching source keys in `source_health`: `"fpl"` | `"premierleague"` | `"skysports"` | `"bbc"`
- The `source_health` root object in `lineup_news.json` tracks `ok: bool`, `last_success: ISO|null`, `last_error: str|null` per source — same four keys as `news_source` values
- Root-level `lineup_news.json` shape: `{ scraped_at: ISO, players: LineupNewsPlayer[], source_health: { fpl: {...}, premierleague: {...}, skysports: {...}, bbc: {...} } }`
- Fuzzy match threshold for player name matching: researcher to determine appropriate `difflib` cutoff (suggest ~0.7) based on FPL web_name patterns

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 117-Scraper Pipeline & Lineup News Artifact*
*Context gathered: 2026-05-17*
