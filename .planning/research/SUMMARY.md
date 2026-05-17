# Research Summary: v1.22 Lineup Intelligence

**Synthesized:** 2026-05-17
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Overall confidence:** HIGH (codebase-grounded; MEDIUM on Sky Sports/BBC anti-bot behaviour until tested from GH Actions IP)

---

## Executive Summary

v1.22 adds a multi-source lineup news scraping layer to the existing Python pipeline and surfaces the resulting player availability signals across four frontend features (INTEL-01 through INTEL-04). The core insight from research is that the FPL bootstrap API already covers ~80% of the needed information: the scraper adds enrichment and confidence labelling, not primary data collection. The pipeline emits a new lineup_news.json Blob artifact that downstream TypeScript engines consume via a Map keyed by player ID without touching merged_players.json.

The stack additions are minimal: beautifulsoup4 and lxml for HTML parsing. Playwright is explicitly rejected (adds 1-2 minutes of CI overhead; Sky Sports and BBC use SSR so static HTML is sufficient). The preferred fallback for both sources is their RSS feeds, which avoids Cloudflare challenges and JS-rendering risk. Twitter/X is excluded from scope entirely: unofficial scraping from GitHub Actions Azure IPs has been blocked since January 2025, the official API costs USD 100/month, and the FPL bootstrap news field covers the same information with an acceptable delay for a daily pipeline.

The three-phase build order (pipeline scraper to engine penalties to UI surfaces) follows a clean dependency chain: no frontend work can proceed until lineup_news.json is being written, but all INTEL features can be written against a mock/FPL-only artifact before Sky Sports/BBC scraping is complete.

---

## Stack Additions

| Package | Pinned version | Purpose |
|---------|---------------|---------|
| beautifulsoup4 | 4.14.3 | Parse HTML from Sky Sports / BBC Sport static pages |
| lxml | 6.1.0 | Fast HTML parser backend for BS4; handles malformed HTML; ships pre-compiled manylinux wheels (no C compiler in CI) |

npm additions: None. All INTEL features are TypeScript changes consuming the Blob artifact.

CI impact: +5-10 seconds for pip install. No other workflow changes needed.

Do not add: Playwright, Selenium, twscrape, ntscraper, Twint, snscraper, curl-cffi (only if 403s appear in production), Scrapy, httpx/aiohttp, official X API, or any third-party paid sports data API.

---

## Source Priority

Ordered by confidence, highest to lowest. Higher priority wins when sources conflict. Within equal tiers, the more pessimistic availability wins.

| Priority | Source | Method | Confidence tier | Notes |
|----------|--------|--------|----------------|-------|
| 1 | FPL official bootstrap-static | Already in pipeline (merge.py lines 992-995) | confirmed | Structured status, chance_of_playing_next_round integer, news text, news_added timestamp. Updated multiple times/day by FPL editorial. No new data-fetch code needed. |
| 2 | premierleague.com/en/latest-player-injuries | requests + BS4, browser UA | high | Static HTML. Same data pipeline as FPL API but often hours earlier. Most structurally stable secondary source. |
| 3 | Sky Sports RSS (skysports.com/rss/0,20514,11661,00.xml) | feedparser preferred; requests + BS4 for static article fallback | high | RSS preferred: no JS rendering, no Cloudflare. Datawrapper interactive table is NOT scrapable via requests. |
| 4 | BBC Sport RSS (feeds.bbci.co.uk/sport/football/rss.xml) | feedparser preferred; requests + BS4 for static article fallback | high | RSS preferred. Team-news prose is less structurally reliable than PL official or Sky Sports. |
| -- | Twitter/X | EXCLUDED | n/a | See Explicit Exclusions. |

Aggregation rule: FPL official always wins when it has data. Scraping failures are non-fatal; fall back to FPL official data alone.

---

## Player Status Schema

### lineup_news.json top-level structure

```json
{
  "generated_at": "2026-05-17T08:00:00Z",
  "gameweek": 37,
  "players": [],
  "source_health": {
    "fpl_bootstrap":  { "ok": true,  "last_success": "2026-05-17T08:00:00Z" },
    "sky_sports_rss": { "ok": true,  "last_success": "2026-05-17T08:01:00Z" },
    "bbc_sport_rss":  { "ok": false, "last_success": "2026-05-16T08:00:00Z", "last_error": "HTTP 503" }
  }
}
```

### Per-player entry fields

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| player_id | number | FPL element ID | Join key to MergedPlayer |
| web_name | string | e.g. Salah | For display without player lookup |
| availability_factor | number | 1.0 / 0.75 / 0.5 / 0.25 / 0.0 | Derived from chance_of_playing_next_round; absent = 0.0; healthy = 1.0 |
| status_label | string | confirmed_start / confirmed_absent / doubted / unknown | Structured status for engine consumption |
| source_tier | string | official / reputable / community | Confidence tier of the winning source |
| source_name | string | e.g. fpl_official, sky_sports, bbc_sport | For UI attribution |
| news_text | string | Display text | FPL news field or scraped snippet; empty string if no supplementary source |
| news_added | string | ISO 8601 UTC | FPL news_added or scraped_at of the winning source |
| scraped_at | string | ISO 8601 UTC | When this entry was last fetched; used for staleness gating |

availability_factor derivation:

| source_tier | status_label | availability_factor |
|-------------|-------------|---------------------|
| Any | confirmed_start | 1.0 |
| Any | unknown | 1.0 (no penalty without evidence) |
| official | from chance_of_playing_next_round | 0.75 / 0.5 / 0.25 / 0.0 per FPL integer |
| reputable | doubted | 0.75 (unless FPL official has a more specific value) |
| reputable | confirmed_absent | 0.0 |

TypeScript interface (target: src/lib/types.ts):

```typescript
export interface LineupNewsEntry {
  player_id: number
  web_name: string
  team_id: number
  status_label: "confirmed_start" | "confirmed_absent" | "doubted" | "unknown"
  availability_factor: number
  source_tier: "official" | "reputable" | "community"
  source_name: string
  news_text: string
  news_added: string
  scraped_at: string
}

export interface LineupNewsResponse {
  generated_at: string
  gameweek: number
  players: LineupNewsEntry[]
  source_health: Record<string, { ok: boolean; last_success: string; last_error?: string }>
}
```

---

## Build Order (3 Phases)

### Phase 1: SCRAPER-01 -- Pipeline scraper + artifact + API route + hook

Deliverables:
- pipeline/lineup_news.py with compute_lineup_news(bootstrap, finished_gws) -> list[dict]
- pipeline/cache/lineup_news.json seed file (generated_at, gameweek 0, empty players array)
- pipeline/run.py wired via non-fatal try/except after gw_intel save (follow set_piece_quality pattern at lines 241-251)
- src/app/api/lineup-news/route.ts (mirrors gw-intel/route.ts verbatim)
- src/lib/hooks/useLineupNews.ts (mirrors useGWIntel.ts verbatim)
- LineupNewsEntry / LineupNewsResponse types added to src/lib/types.ts

Implementation order within the phase: FPL official fields first (zero scraping risk, unblocks Phases 2 and 3 immediately), then Sky Sports RSS, then BBC Sport RSS. Each source is additive and wrapped in its own try/except.

### Phase 2: INTEL-01 + INTEL-03 -- Engine penalty integration

Deliverables:
- src/lib/suggest-transfers.ts: add optional lineupNewsMap parameter to SuggestTransfersParams; in scorePlayer() multiply by availability_factor (confirmed absent = x0.01, doubted = x0.70, unknown = x1.0)
- src/lib/optimise-lineup.ts: add same optional param; apply multiplier to evScore before bench enumeration (absent bench player scores 0, sinks to last slot -- consistent with BGW treatment)
- Unit tests with mocked lineupNewsMap for confirmed-absent and doubted cases

Why second: pure-function changes to pure-function engines. TDD-safe with mock data. No component changes required.

### Phase 3: INTEL-02 + INTEL-04 -- Component integration

Deliverables:
- src/components/squad/TeamNewsAlertCard.tsx (new; renders only when squadNewsAlerts.length > 0; severity-sorted; owned squad only)
- src/components/squad/DecisionSummaryTab.tsx: add useLineupNews(), derive lineupNewsMap, thread into suggestTransfers(), render TeamNewsAlertCard full-width below 4-card grid
- src/components/captaincy/CaptainPicksPanel.tsx: add useLineupNews(), thread confirmed-status badge into CandidateRow; do NOT alter ranking order
- src/components/transfers/TransferPanel.tsx: thread lineupNewsMap into suggestTransfers() call

Why last: depends on Phase 1 (hook) and Phase 2 (engine params). All modifications are additive.

---

## Key Pitfalls

### 1. Pipeline isolation pattern (CRITICAL)

Every scraper call in run.py must live in its own isolated try/except Exception block, not inside the main try. An unhandled scraper exception inside the main try block kills the pipeline run and loses merged_players.json for that day. Follow set_piece_quality at lines 241-251 exactly.

### 2. Silent empty-result failures (CRITICAL)

requests + BS4 on a JS-shell page returns zero results with no exception -- the scraper appears to succeed but would write players: []. Mitigations: add minimum-result count warnings; include source_health in the schema; never write an empty players array to Blob. Skip the write and preserve the previous run.

### 3. Source-tier confidence model (CRITICAL for all INTEL phases)

All engines must treat missing or stale lineup_news.json (>48 hours by scraped_at) as no news (neutral), not no doubts (optimistic). Default: p.availability_factor ?? 1.0. Gate penalty application on a staleness check before applying any multiplier.

### 4. HTML structure changes

Prefer RSS over HTML for Sky Sports and BBC. Use semantic selectors (article, section) not generated class names. Log a specific warning when result count falls below expected threshold. The scraped_at field and source_health object surface scraper health without breaking consumers.

### 5. Datacenter IP rate limiting

GitHub Actions uses Azure IPs that may be Cloudflare-challenged by Sky Sports. Test each URL with curl before committing to HTML scraping. RSS feeds are the preferred mitigation. Add time.sleep(random.uniform(2, 5)) between HTML scraper calls.

---

## Explicit Exclusions

### Twitter/X: permanently excluded from v1.22 scope

X permanently banned GitHub Actions Azure datacenter IP ranges in January 2025. All unofficial scraping tools (twscrape, Scweet, ntscraper, Twint, snscraper, Nitter) require authenticated account sessions that terminate within days on datacenter IPs. The official X API starts at USD 100/month. X disabled RSS profile feeds in 2023.

The information gap is acceptable: FPL bootstrap news is updated multiple times per day directly from press conferences and physio reports. Sky Sports and BBC RSS publish the same information within hours. For a once-daily pipeline, Twitter speed advantage (minutes vs hours) does not justify the authentication complexity, maintenance burden (~10-15 hours/month), or legal exposure from X Corp. v. Bright Data (2024).

Do not revisit unless a verified, stable, zero-credential mechanism becomes available for datacenter IPs.

