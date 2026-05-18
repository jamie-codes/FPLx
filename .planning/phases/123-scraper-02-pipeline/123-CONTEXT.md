# Phase 123: SCRAPER-02 Pipeline - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the transfer news pipeline layer: `transfer_news.py` scrapes Sky Sports and BBC Sport RSS feeds, `player_matching.py` resolves FPL element IDs via fuzzy surname matching, and `run.py` gains an `IS_OFF_SEASON` gate. The TypeScript layer follows: `/api/transfer-news` Route Handler + `useTransferNews()` TanStack Query hook. Zero UI in this phase — the feed is consumed by Phase 125 (Summer Window Tracker).

</domain>

<decisions>
## Implementation Decisions

### Player Matching (player_matching.py)
- **D-01:** Fuzzy surname matching using `rapidfuzz` `token_sort_ratio ≥ 85` against `merged_players.json`. Ambiguous or low-confidence matches → `element_id = null` (unmatched, not an error). Multi-player article mentions leave the primary entity matched; secondary mentions are not extracted.
- **D-02:** Name normalization mirrors Phase 117's existing approach in `lineup_news.py`. No new normalization library needed — reuse the existing pattern.

### Article Classification
- **D-03:** Rule-based keyword matching in article title + summary. No LLM. Keyword sets per class:
  - `confirmed_signing` — "signs", "joins", "completes", "agreed", "confirmed", "done deal"
  - `rumour` — "linked", "interest", "bid", "target", "wants", "considers"
  - `injury_return` — "returns", "fit", "back in training", "recovered"
  - `rotation_signal` — "rotation", "bench", "rested", "squad player"
  - `general` — catch-all for anything that doesn't match the above
- **D-04:** Classification applied in `transfer_news.py` at parse time, stored in the artifact. Deterministic and zero cost per run.

### IS_OFF_SEASON Gate
- **D-05:** `transfer_news.py` runs **year-round** — it is explicitly not GW-dependent and is most valuable when there is no current GW. The IS_OFF_SEASON gate only skips GW-dependent steps (e.g. `gw_intel`, `bonus`, `captain_snapshots`, `merge` steps that require a current event).
- **D-06:** Detection: `IS_OFF_SEASON = not any(e.get('is_current') for e in events)`. Skipped steps log a single `[pipeline] IS_OFF_SEASON: skipping {step}` line. No exception raised.

### TypeScript Layer
- **D-07:** `useTransferNews()` `staleTime = 6h` — matches pipeline run cadence and the `useLineupNews` pattern. No shorter polling needed; extra fetches during off-season would return identical data.
- **D-08:** Route Handler at `/api/transfer-news` follows the established `gw-intel` / `set-pieces` artifact pattern: read Blob key `transfer_news.json`, return JSON directly. No transformation in the route.

### Claude's Discretion
- Exact keyword lists beyond the examples above (case-insensitive matching, stemming strategy)
- Whether to deduplicate identical articles appearing in both Sky Sports and BBC feeds (by URL or by title similarity — Claude's call)
- Article age cutoff for what gets written to Blob (e.g. last 30 days vs unlimited)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 117 Analog (primary pattern source)
- `pipeline/lineup_news.py` — canonical RSS scraper and player-name normalization pattern
- `src/app/api/lineup-news/route.ts` — canonical Route Handler artifact pattern to follow
- `src/hooks/useLineupNews.ts` — canonical TanStack Query hook pattern (staleTime, error handling)

### Existing Infrastructure
- `pipeline/upload.py` — ONLY Blob write path; `save(key, data)` — must use this, never call Vercel Blob SDK directly
- `pipeline/run.py` — integration point for `transfer_news.py` call + IS_OFF_SEASON gate
- `pipeline/merge.py` — example of a GW-dependent step that should be skipped under IS_OFF_SEASON

### Requirements
- `.planning/REQUIREMENTS.md` — SCR-01, SCR-02, SCR-03, SCR-04, SCR-05, WIN-03 requirement text

### Research
- `.planning/phases/v1.24-research/` — v1.24 SCRAPER-02 research (if present): RSS feed URLs, Transfermarkt RSS availability, Azure IP blocking findings

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pipeline/lineup_news.py` — RSS feed parsing with `feedparser`, player name normalization, non-fatal scraper isolation pattern (try/except per source), source_health tracking
- `pipeline/upload.py` `save()` — Blob write abstraction already in use across all pipeline modules
- `pipeline/fpl_client.py` — FPL bootstrap fetch; `events[]` array needed for IS_OFF_SEASON detection
- `src/hooks/useLineupNews.ts` — hook template: TanStack Query, 6h staleTime, error handling

### Established Patterns
- Non-fatal scraper isolation: each RSS source in its own `try/except`; failure logs error and continues
- Empty artifact guard: never write `articles: []` to Blob if scraper produces nothing (mirrors SCRP-05 for lineup_news)
- `TRANSFER_NEWS_ENABLED` env var gate: check at top of `transfer_news.py` module; if unset, return early without fetching
- Phase 117 used `rapidfuzz` for fuzzy matching — already in `requirements.txt`

### Integration Points
- `pipeline/run.py`: add `IS_OFF_SEASON` detection after bootstrap fetch; wrap GW-dependent steps; call `transfer_news.scrape()` outside IS_OFF_SEASON block
- `src/lib/types.ts`: new `TransferNewsArticle` type and `TransferNewsFeed` type needed
- Phase 125 (Summer Window Tracker) consumes `useTransferNews()` — hook contract is the downstream dependency

</code_context>

<specifics>
## Specific Ideas

- "Transfer news runs year-round" — the scraper is most valuable in off-season; this is an explicit design intent, not an oversight
- IS_OFF_SEASON log line format: `[pipeline] IS_OFF_SEASON: skipping {step}` for easy grepping in GitHub Actions logs

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 123-SCRAPER-02 Pipeline*
*Context gathered: 2026-05-18*
