# Stack Research — v1.22 Lineup Intelligence (SCRAPER-01 / INTEL-01–04)

**Domain:** FPL Analyst — adding multi-source lineup news scraping and player intelligence surfaces
**Researched:** 2026-05-17
**Confidence:** HIGH — grounded in direct file inspection, official documentation, and verified library pages on PyPI/GitHub

---

## Bottom Line Up Front

**Net new Python packages: 2 (beautifulsoup4, lxml)**
**Net new npm packages: 0**
**Playwright: DO NOT ADD — adds 1-2 minutes to every CI run for minimal gain**
**Twitter/X: DO NOT SCRAPE — all unofficial approaches require persistent auth credentials and break silently**
**FPL official source covers ~80% of what's needed; Sky Sports and BBC are supplementary**

The FPL `bootstrap-static` `news` and `news_added` fields already flow through `merge.py` into `merged_players.json`. The v1.22 scraper adds an enrichment layer: a new `pipeline/news_scraper.py` that reads those fields and optionally enriches with Sky Sports / BBC HTML via `requests` + `beautifulsoup4`. No headless browser needed for those two sources. Twitter/X scraping is explicitly ruled out.

---

## New Dependencies

### Python (pipeline only)

| Package | Version | Purpose | Why This One |
|---------|---------|---------|-------------|
| `beautifulsoup4` | `>=4.12.0` | Parse HTML from Sky Sports / BBC Sport team news pages | Battle-tested HTML parser; already used in the ecosystem (BBC Sport scrapers confirmed working with BS4); `4.14.3` is current (Nov 2025) |
| `lxml` | `>=4.9.0` | Fast HTML parser backend for BS4; required for `BeautifulSoup(html, 'lxml')` | Ranked first by BS4 docs for performance and correctness; handles malformed HTML well; `6.1.0` current |

**Pin versions for CI reproducibility:**
```
beautifulsoup4==4.14.3
lxml==6.1.0
```

### npm

None. All four INTEL features (INTEL-01 through INTEL-04) are TypeScript engine changes that consume `lineup_news.json` from Vercel Blob — no frontend dependency additions.

---

## GitHub Actions Compatibility

### Current CI environment (from `.github/workflows/pipeline.yml`)

- Runner: `ubuntu-latest`
- Python: `3.11`
- Install step: explicit `pip install` list with pinned versions
- Runtime: typically under 2 minutes including FPL API fetches + Monte Carlo sims

### Adding beautifulsoup4 + lxml

Both packages install in under 5 seconds from PyPI on `ubuntu-latest`. `lxml` ships pre-compiled `manylinux` wheels — no C compiler needed. Impact on CI runtime: negligible (<10s total).

**CI install step addition:**
```bash
pip install beautifulsoup4==4.14.3 lxml==6.1.0
```

Add to the existing `pip install` line in `pipeline.yml`. These are pure install-and-run packages with no additional system dependencies.

### Why NOT Playwright in Python

Playwright `1.59.0` (current as of April 2026) adds:

1. **Install overhead:** `playwright install --with-deps chromium` downloads ~200-400 MB of Chromium binaries plus system dependencies. Even cached, the restore step takes ~55 seconds (comparable to a cold download). The official Playwright docs explicitly state: *"Caching browser binaries is not recommended, since the amount of time it takes to restore the cache is comparable to the time it takes to download the binaries."*

2. **Runtime cost:** Each headless browser launch adds ~500ms-1s startup time per scrape target. For 20 PL teams across 2 sources = ~40 pages, this is a material addition.

3. **Sky Sports and BBC Sport do not require JavaScript execution.** Both sites use server-side rendering (SSR). HTML content — including team news — is present in the static HTTP response. Confirmed via WebFetch inspection: Sky Sports match preview pages render full team news in the initial HTML; BBC Sport uses React SSR with content in the initial HTML payload.

4. **`playwright install --with-deps` has a history of timing out (>40 minutes in some CI runs per GitHub issue #23388) when apt-get dependency resolution is slow.**

**Verdict: requests + beautifulsoup4 is sufficient and preferred for Sky Sports and BBC Sport.**

---

## Recommended Approach per Source

### Source 1: FPL Official (bootstrap-static `news` / `news_added` fields)

**Method:** Already implemented. No new code needed in the data-fetch layer.

The FPL API `bootstrap-static` endpoint returns per-player:
- `news`: string — injury/doubt description (e.g. "Hamstring injury - 25% chance of playing")
- `news_added`: ISO 8601 timestamp (e.g. "2026-05-15T14:22:00Z")
- `status`: `'a'` (available), `'d'` (doubtful), `'i'` (injured), `'s'` (suspended), `'u'` (unavailable)
- `chance_of_playing_next_round`: integer 0-100 or null

These fields are already extracted in `pipeline/merge.py` (lines 992-995) and flow into `merged_players.json`. The pipeline already uses them in `xmins.py` (availability weighting), `prose_summary.py` (prompts), and the `NewsBanner` component.

**Confidence tier for `lineup_news.json`:** `"confirmed"` — official FPL source, structured data, updated whenever FPL scouts update.

**v1.22 work:** Write `pipeline/news_scraper.py` that reads from `merged_players.json` (already in memory during run) and emits `lineup_news.json` as an enriched news artifact.

---

### Source 2: Sky Sports (team news articles)

**Method:** `requests` + `beautifulsoup4` with browser-like headers

**Target URL pattern:** `https://www.skysports.com/football/news/{article-id}` for pre-match team news articles, and `https://www.skysports.com/{team-name}-news` for club news feeds.

**Rendering:** Server-side rendered HTML. Content is present in the static HTTP response — no JavaScript execution needed (confirmed via scraping evidence: the `jchadwick92/Skysports-lineup-scraper` project uses BeautifulSoup successfully; WebFetch confirmed team news text in Sky Sports match preview HTML).

**Anti-bot protection:** Sky Sports does not use Cloudflare's JS challenge layer for basic article pages. However, browser-like headers are required. The existing `fpl_client.py` `HEADERS` dict (with Chrome user-agent, `Accept-Language`, `Referer`) is the pattern to replicate.

**TLS fingerprinting risk:** Sky Sports article pages are typically not behind fingerprint-aware WAF rules that block Python `requests`. If 403 responses emerge, upgrade to `curl-cffi` (see below under What NOT to Add).

**Confidence tier:** `"high"` — human-written editorial content; updated 1-2 days before each matchday.

**Rate limit:** Add `time.sleep(1)` between team page requests (20 teams × 1s = 20s overhead — acceptable in daily pipeline context).

---

### Source 3: BBC Sport (team news)

**Method:** `requests` + `beautifulsoup4`

**Target URL pattern:** `https://www.bbc.com/sport/football/premier-league/team-news`

**Rendering:** BBC uses React SSR via AWS Lambda. The initial HTML payload contains the content (confirmed by BBC's own architecture documentation: "AWS Lambda functions perform server-side rendering of dynamic content using React... client-side JavaScript hydrates the initial response"). The key insight: the full text content is in the initial HTTP response; JavaScript only handles interactive hydration. `requests` + BS4 extracts the text without needing hydration.

**Anti-bot protection:** BBC does not use aggressive bot detection on its sport pages (they're high-traffic public pages with accessibility requirements). Browser user-agent headers are sufficient.

**Confidence tier:** `"high"` — BBC editorial team news, updated close to kickoff.

---

### Source 4: Twitter/X (FPL scout accounts)

**Method:** DO NOT SCRAPE. See "What NOT to Add" below.

**Fallback:** Consume the FPL official `news` field — it aggregates scout reports within 24-48 hours of official club communication. For the speed premium that Twitter provides (minutes vs hours), the complexity cost is not justified for a personal once-daily pipeline.

---

## lineup_news.json — Recommended Format

```json
{
  "generated_at": "2026-05-17T08:00:00Z",
  "gw": 37,
  "players": [
    {
      "element_id": 328,
      "web_name": "Salah",
      "team_short_name": "LIV",
      "sources": [
        {
          "source": "fpl_official",
          "confidence": "confirmed",
          "status": "d",
          "chance_of_playing_next_round": 75,
          "news": "Hamstring concern - 75% chance of playing",
          "news_added": "2026-05-16T14:00:00Z"
        },
        {
          "source": "sky_sports",
          "confidence": "high",
          "headline": "Salah doubtful for GW37",
          "snippet": "Liverpool boss Slot confirmed Salah is being assessed...",
          "url": "https://www.skysports.com/...",
          "scraped_at": "2026-05-17T08:01:00Z"
        }
      ],
      "aggregated_confidence": "confirmed",
      "aggregated_status": "d",
      "aggregated_chance": 75,
      "has_news": true
    }
  ]
}
```

**Confidence tier hierarchy (for `aggregated_confidence`):**
1. `"confirmed"` — FPL official `status != 'a'` OR `chance_of_playing_next_round < 100`
2. `"high"` — FPL official news text present but status is 'a' (pre-injury scouting report); OR secondary source (Sky/BBC) corroborates
3. `"low"` — secondary source only, not corroborated by FPL official

**Aggregation rule:** take the highest-confidence source per player. FPL official always wins when it has data.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Playwright (Python)** | Adds 1-2 minutes to every CI run; Sky Sports and BBC use SSR — content is in static HTML; playwright install has CI reliability issues (documented GitHub issue #23388 with 40-min timeouts) | `requests` + `beautifulsoup4` — sufficient and already proven for both targets |
| **Selenium / webdriver-manager** | Same reasons as Playwright but worse: larger dependency tree, flakier in headless mode, slower page loads | `requests` + `beautifulsoup4` |
| **twscrape (Twitter/X)** | Requires storing a real Twitter/X account's `auth_token` + `ct0` cookies as GitHub secrets; brittle against X platform API changes (library updated April 2025, but X makes breaking changes without notice); personal account ban risk if scraping detected; session expires and requires manual re-authentication | FPL official `news` field covers the same information with a 24-48h delay — acceptable for a daily pipeline |
| **ntscraper / nitter-scraper** | Most public Nitter instances are shut down (X blocked guest tokens); self-hosting Nitter requires separate server infra; PyPI package `ntscraper` 0.4.4 still on PyPI but reliability is low | FPL official `news` field |
| **Twint** | Deprecated and non-functional against X's updated anti-scraping systems as of 2024-2025 | FPL official `news` field |
| **snscraper** | No longer maintained; unmaintained against current X API | FPL official `news` field |
| **curl-cffi** | Only needed if `requests` fails due to TLS fingerprint blocking; Sky Sports and BBC don't have fingerprint-aware WAF. Add only if 403s appear in production — not upfront | `requests` with browser-like headers (already proven in `fpl_client.py`) |
| **Scrapy** | Overkill for 2-3 target pages per pipeline run; adds async complexity that doesn't integrate cleanly with the existing synchronous `pipeline/run.py` | `requests` + `beautifulsoup4` in simple synchronous scraper module |
| **httpx / aiohttp** | Async HTTP adds complexity without benefit for 20 sequential team pages; existing pipeline is synchronous | `requests` — consistent with all other pipeline HTTP calls |
| **Official X/Twitter API (Basic tier: $100/mo)** | Not justified for personal-use tool; FPL official covers the same data | FPL official `news` field |
| **Premier League official API (premierleague.com)** | No public JSON injury API; web scraping premierleague.com requires handling of more aggressive anti-bot measures than Sky/BBC | FPL official `news` field |
| **Third-party sports data APIs (Enetpulse, Statorium, Apify)** | Paid subscriptions; adds external service dependency; FPL official + Sky/BBC provides equivalent data | FPL + BS4 scraper |

---

## Final pip install delta

```bash
# Add to pipeline.yml "Install dependencies" step:
pip install beautifulsoup4==4.14.3 lxml==6.1.0
```

```txt
# Add to pipeline/requirements.txt:
beautifulsoup4>=4.12.0
lxml>=4.9.0
```

Total CI time impact: +5-10 seconds. No other changes to build or deploy configuration.

---

## Sources

- `C:\Users\jamie\fplx\pipeline\requirements.txt` — current Python dependencies confirmed
- `C:\Users\jamie\fplx\pipeline\fpl_client.py` — browser-like header pattern confirmed
- `C:\Users\jamie\fplx\.github\workflows\pipeline.yml` — CI runner (ubuntu-latest, Python 3.11) confirmed
- `C:\Users\jamie\fplx\pipeline\merge.py` lines 992-995 — `news`, `news_added`, `chance_of_playing_next_round` extraction confirmed
- `C:\Users\jamie\fplx\pipeline\xmins.py` lines 79-94 — `news` used for availability weighting confirmed
- PyPI: playwright 1.59.0 (April 2026) — version and Python support confirmed
- PyPI: beautifulsoup4 4.14.3 (November 2025) — current version confirmed
- PyPI: lxml 6.1.0 — current version confirmed
- PyPI: twscrape 0.17.0 (April 2025) — requires X account credentials, confirmed
- PyPI: curl-cffi 0.15.0 (April 2026) — beta-stability, Python >=3.10, confirmed
- Playwright Python docs (playwright.dev/python/docs/ci) — `playwright install --with-deps` caching advice: "not recommended, restore time comparable to download time"
- GitHub issue microsoft/playwright#23388 — documented 40-minute CI timeouts for `playwright install --with-deps`
- BBC/simorgh repo + Register article (2020) — BBC uses React SSR via AWS Lambda; content in initial HTML
- WebFetch of Sky Sports match preview pages — content in static HTML confirmed, no JS required
- GitHub: jchadwick92/Skysports-lineup-scraper — BS4 confirmed sufficient for Sky Sports scraping
- WebSearch: nitter instance status 2025 — most public instances shut down, guest token blocking confirmed
- Confidence: HIGH — claims grounded in direct file inspection + official documentation; no training-data-only claims

---

*Stack research for: FPL Analyst v1.22 — SCRAPER-01 / INTEL-01 / INTEL-02 / INTEL-03 / INTEL-04*
*Researched: 2026-05-17*
