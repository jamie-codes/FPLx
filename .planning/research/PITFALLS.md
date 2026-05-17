# Pitfalls Research — v1.22 Lineup Intelligence (SCRAPER-01)

**Domain:** Adding multi-source web scraping (Sky Sports, BBC Sport, Twitter/X, FPL bootstrap) to an existing Python pipeline running in GitHub Actions.
**Researched:** 2026-05-17
**Overall confidence:** HIGH for pipeline isolation patterns (grounded in existing codebase); HIGH for Playwright/CI specifics (Playwright official docs); MEDIUM for source-specific anti-bot behaviour (no first-hand testing of skysports.com/bbc.co.uk from GH Actions; patterns from scraping ecosystem reports); LOW for Twitter/X without official API (rapidly-changing target, evidence from community sources only).

---

## Critical Pitfalls

### Pitfall C-01: Scraper Failure Cascading to Kill the Whole Pipeline

**What goes wrong:**
A scraper function raises an unhandled exception — network timeout, HTTP 403, `AttributeError` on a missing HTML element — and the entire `run.py` process exits before writing `merged_players.json`, `captain_picks.json`, or any other core artifact. The Vercel Blob retains the previous day's data; the UI shows "Updated 25 hours ago" in amber; the user gets no FPL intelligence for that day.

This pattern is already documented in the codebase: the `set_piece_quality` scraper at lines 241–251 of `run.py` wraps `run_sp_quality()` in a standalone `try/except Exception as sp_exc` block with `print(f"[set_piece_quality] non-fatal error: {sp_exc}", file=sys.stderr)`. The scraper writes nothing on failure; the previously-cached file is preserved via `save()`'s Blob overwrite-only-on-success behaviour.

**Why it happens:**
Developers add a scraper call inside the main `try` block of `run()` rather than giving it its own isolated try/except. Any exception propagates up, hits the outer `except Exception` at the bottom of `run.py`, writes the stale `last_updated.json` fallback, and exits.

**Consequences:**
- All downstream pipeline outputs (merged players, captain picks, insights, GW intel, accuracy) are lost for that run.
- The UI degrades from "stale data" (recoverable) to "broken pipeline run" (requires investigation).

**Prevention:**
Every scraper call in `run.py` must live in its own isolated try/except block, following the exact pattern used for `set_piece_quality`:

```python
lineup_news = None
try:
    from lineup_news_scraper import scrape_lineup_news
    lineup_news = scrape_lineup_news()
    save('lineup_news.json', lineup_news)
    print(f"Lineup news scraped: {len(lineup_news.get('players', []))} entries")
except Exception as scraper_exc:
    print(f"[lineup_news] non-fatal error: {scraper_exc}", file=sys.stderr)
    # lineup_news remains None; downstream consumers check for None
```

**Detection:**
- GitHub Actions run log shows `[lineup_news] non-fatal error:` lines but no pipeline failure — this is the desired non-fatal outcome.
- If `merged_players.json` is NOT written, the scraper error escalated into the main try block — isolation is broken.

**Phase to address:** SCRAPER-01, before any scraper code is written.

---

### Pitfall C-02: Sky Sports and BBC Sport Pages Are Partially or Fully JavaScript-Rendered

**What goes wrong:**
`requests` + `BeautifulSoup` fetch the initial HTML response, which for major sports news sites may be a skeleton with JavaScript tags. The actual team news content is injected by client-side JavaScript after page load. `requests` never executes JavaScript. `BeautifulSoup` parses the skeleton. The CSS selector or element the scraper expects does not exist. The scraper silently returns no data, or the `find()` call returns `None`, and subsequent attribute access raises `AttributeError`.

**Why it happens:**
Both Sky Sports (`skysports.com`) and BBC Sport (`bbc.co.uk/sport`) use modern React/Vue front ends for their sports pages. The rendered HTML seen by `requests` may contain only `<div id="root"></div>` or equivalent shell containers. The team news content that a browser user sees is not present in the raw HTTP response.

**Consequences:**
The scraper appears to succeed (no exception) but returns empty results. `lineup_news.json` is written with zero players. All downstream consumers that check `lineup_news` find no news, even when real news exists.

**Prevention:**
Before implementing with `requests+BS4`, verify each target URL's rendering behaviour:

1. `curl https://www.skysports.com/football/news/11661 | grep "Injury"` — if content is absent in the raw response, Playwright is required.
2. `curl https://www.bbc.co.uk/sport/football/premier-league | grep "doubt"` — same test.

If static HTML is not sufficient: use `playwright` in headless mode with `page.wait_for_selector()` before extracting content. If static HTML is sufficient: `requests+BS4` is faster and has no CI overhead.

The decision is per-source, not per-milestone. Sky Sports and BBC Sport may differ from each other.

**Detection:**
- Scraper returns 0 players despite a press-conference week (GW before matchday).
- Add a minimum-results assertion: if `len(results) == 0` and the pipeline has never returned 0 before, log a warning.

**Phase to address:** SCRAPER-01, in the RESEARCH task before writing any scraper code. Test each URL with `curl` in GitHub Actions first.

---

### Pitfall C-03: Silent HTML Structure Changes Breaking Scrapers

**What goes wrong:**
The scraper ships targeting `.player-news__status` or `div[data-module="team-news"]`. Sky Sports or BBC Sport redesigns their team news section six weeks later. The CSS class no longer exists. `soup.find('div', class_='player-news__status')` returns `None`. The code does `result = soup.find(...).text` — `AttributeError: 'NoneType' object has no attribute 'text'`. If this exception is caught by the non-fatal wrapper, `lineup_news.json` is preserved from the previous run. But that run's data is now 48 hours old and still serving as "current news."

**Why it happens:**
Sports news sites redesign frequently, particularly before new seasons. HTML class names are implementation details — sites do not version them or announce changes. There is no notification mechanism.

**Consequences:**
The scraper silently serves stale data. The UI shows news that is days old with no indication of staleness. A player marked "Fit — expected to start" may have been ruled out since the last successful scrape.

**Prevention:**
1. Use the most general selectors available — semantic tags (`<article>`, `<section>`) over generated class names.
2. Add explicit result-count validation: if `len(entries) < 3` on a day when team news is expected, log a specific warning: `"[lineup_news_skysports] unexpected result count: 0 entries — possible HTML structure change"`.
3. Include a `scraped_at` ISO timestamp in every `lineup_news.json` write.
4. The `NewsBanner` component should display staleness relative to `scraped_at`, not assume freshness.
5. Introduce a `news_source_health` field in `lineup_news.json`: `{ "sky_sports": { "ok": false, "last_success": "...", "last_error": "..." } }` — surfaces scraper health to monitoring without breaking downstream consumers.

**Detection:**
- `lineup_news.json` `scraped_at` falls more than 48 hours behind wall clock.
- GitHub Actions logs show non-fatal scraper errors two runs in a row.

**Phase to address:** SCRAPER-01 — include `scraped_at` and `news_source_health` in the schema design.

---

### Pitfall C-04: Twitter/X Has No Viable Unauthenticated Scraping Path

**What goes wrong:**
As of January 2025, X requires authenticated sessions to view profile timelines and search results beyond a limited preview. Guest token access (the basis of all pre-2023 unauthenticated scrapers) has been closed. Tools built on guest tokens — including `twint`, `snscrape`, and `nitter` in its original form — are effectively dead for production use.

The currently-working approach (twscrape, Scweet) requires authenticating with real Twitter account credentials and using the same internal GraphQL endpoints the web client uses. X monitors for anomalous session behaviour and terminates sessions from datacenter IPs (GitHub Actions uses Azure/Microsoft datacenter IPs, which X permanently banned in January 2025).

**Why it happens:**
X's product direction since 2023 has been to remove all free data access and force use of the official API (which costs $100/month minimum for Basic access). Unofficial scrapers face a continuously narrowing surface area.

**Consequences:**
- Any unofficial Twitter/X scraper in a GitHub Actions pipeline will fail within days to weeks as sessions are terminated.
- Session recovery requires human intervention (CAPTCHA, email verification).
- The pipeline's non-fatal wrapper catches the exception but leaves the Twitter/X news source permanently returning no data, with no user notification.

**Prevention:**
Do not implement Twitter/X scraping from GitHub Actions with unofficial tools. Use one of these alternatives instead:

1. **FPL bootstrap `news` field** — already available in the pipeline with no scraping required. Contains structured FPL-official availability information. Highest confidence tier. Already being used for v1.21 news badges.
2. **Sky Sports + BBC Sport RSS feeds** — both sites publish RSS/Atom feeds for football news sections. RSS is static XML, requires only `requests`, never JavaScript-renders, and changes structure far less often than HTML pages. Check `https://www.skysports.com/rss/0,20514,11661,00.xml` and `https://feeds.bbci.co.uk/sport/football/rss.xml`.
3. **Third-party FPL news aggregator APIs** — sites like Fantasy Football Scout, Rotowire (Football), and FPL Review publish structured team news. Some have free tiers or RSS.
4. **Manual curation with structured JSON** — for a personal tool, maintaining a small `overrides.json` for key players' availability between scrape runs is more reliable than an unstable scraper.

**Detection:**
Twitter/X scraper failure will be logged as a non-fatal error within hours of deployment if datacenter IPs are blocked.

**Phase to address:** SCRAPER-01 design phase — exclude Twitter/X from the automated scraping scope; rely on FPL bootstrap + RSS feeds.

---

## Pipeline Isolation

### Pitfall P-01: Playwright Added to the Main Pipeline Install Without Caching

**What goes wrong:**
`playwright` is added to `requirements.txt` or `pip install playwright` is added to the GitHub Actions workflow. The first run also requires `playwright install chromium --with-deps`. Without caching:

- Playwright browser binaries are ~150MB for Chromium alone.
- `playwright install --with-deps chromium` takes 8-20 minutes on a cold GitHub Actions runner.
- This adds to the runtime of every daily pipeline run, even on days when the scraper returns no results.
- GitHub Actions free tier has a 2,000 minutes/month budget per repository. Adding 10 minutes per run costs 300 minutes/month for 30 days — 15% of the free budget consumed by browser installation alone.

**Prevention:**
Cache the Playwright browser binaries between runs:

```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v3
  with:
    path: ~/.cache/ms-playwright
    key: playwright-chromium-${{ hashFiles('requirements.txt') }}

- name: Install Playwright browsers (only if cache miss)
  run: python -m playwright install chromium --with-deps
```

Only install Chromium, not all browsers (`--with-deps chromium` not `--with-deps`). Use `--only-shell` if only headless scraping is needed.

**Detection:**
- GitHub Actions run time increases by 8+ minutes on cache misses.
- Monthly Actions minutes consumption increases proportionally.

**Phase to address:** SCRAPER-01, at the point where Playwright is first introduced to the workflow.

---

### Pitfall P-02: Playwright Used When requests+BS4 Is Sufficient

**What goes wrong:**
Playwright is introduced for all scraping targets by default, even for sites that serve their content in the initial HTML response. The pipeline now spins up a headless Chromium browser on every daily cron run, consuming CI minutes, RAM (Chromium uses ~200MB), and time, when a 10ms `requests.get()` would suffice.

**Prevention:**
Use the decision matrix: `requests+BS4` first; upgrade to Playwright only per-source if the static HTML test (see C-02) shows content is absent. Structure the code so sources can be swapped independently:

```python
def scrape_sky_sports_news() -> list[dict]:
    """Try static HTML first; fall back to Playwright if needed."""
    ...

def scrape_bbc_sport_news() -> list[dict]:
    """Static HTML only — verified to not require JS rendering."""
    ...
```

If Playwright is not needed for any source, do not include it in the workflow at all.

**Detection:**
- All scrapers return data correctly with `requests+BS4` after testing.
- Playwright install step appears in workflow but is never exercised in the scraper logic.

**Phase to address:** SCRAPER-01 — make the static/dynamic determination per-source before writing any code.

---

### Pitfall P-03: Scraper Writes to Blob on Every Run Without Stale-Preservation Logic

**What goes wrong:**
The scraper runs, encounters a temporary network error, and returns an empty list. The `save()` call writes `{"players": []}` to Blob, overwriting the previous run's real data. All downstream consumers now see zero player news. The UI shows no news badges on any player for the day.

**Prevention:**
Add a minimum-content guard before calling `save()`:

```python
if lineup_news and len(lineup_news.get('players', [])) > 0:
    save('lineup_news.json', lineup_news)
else:
    print("[lineup_news] skipping Blob write — empty result; preserving previous run")
```

Note: this is already the pattern used by `set_piece_quality`'s `run_sp_quality()` which returns `None` on failure, and `run.py` checks for `None` before saving.

**Detection:**
- `lineup_news.json` in Blob has `players: []` after a pipeline run.
- GitHub Actions log shows a network-level error from the scraper in the same run.

**Phase to address:** SCRAPER-01.

---

### Pitfall P-04: Rate Limiting from Running on a Static Datacenter IP

**What goes wrong:**
GitHub Actions runners share a pool of IP addresses owned by Microsoft Azure. Sports news sites that apply IP reputation scoring may rate-limit or block requests from datacenter IP ranges outright (not just flagging browser fingerprints). A `requests.get()` to `skysports.com` may return HTTP 403 or 429 immediately, not because of header or bot-detection issues, but because the IP range is known to be non-residential.

**Prevention:**
1. Set a `User-Agent` header that matches a real browser (already done in `fpl_client.py` as a model). Include `Accept-Language`, `Accept`, and `Referer` headers.
2. Add a randomised delay (`time.sleep(random.uniform(2, 5))`) between scraper calls.
3. Do not request the same page multiple times per run.
4. If rate limiting is consistently encountered, move to RSS feeds for those sources (see C-04 alternative 2).
5. Do not use proxies (cost-sensitive constraint).

**Detection:**
- Scraper returns HTTP 403 or 429 in pipeline logs.
- Replacing the GitHub Actions runner with a local run succeeds, confirming datacenter IP is the issue.

**Phase to address:** SCRAPER-01.

---

## Source-Specific Risks

### Risk S-01: Sky Sports — Cloudflare Bot Protection

**Evidence:** Cloudflare JavaScript challenges are common on major sports media sites. Sky Sports operates as a high-value media property and is likely to have Cloudflare or equivalent protection. Confidence: MEDIUM (not directly verified by testing skysports.com from GH Actions; Cloudflare patterns confirmed from ecosystem research).

**What happens:**
A `requests.get('https://www.skysports.com/...')` call returns HTTP 403 with a Cloudflare challenge page. The HTML body contains `<title>Just a moment...</title>`. `BeautifulSoup` parses it; no team news elements are found. The scraper silently returns empty results.

**Mitigation options, in preference order:**
1. Use the Sky Sports RSS feed instead of HTML pages: `https://www.skysports.com/rss/0,20514,11661,00.xml` (Premier League news). RSS endpoints are static XML and are typically not behind Cloudflare challenges.
2. Use `cloudscraper` Python library, which emulates a browser TLS handshake and solves simple Cloudflare JavaScript challenges without a full browser.
3. Use `playwright` in headless mode — passes the JavaScript challenge but adds CI overhead (see P-01).

**Detection:**
- Raw HTTP response body contains "cloudflare" or "Just a moment" in the logs.
- HTTP status code 403 or 503 in scraper logs.

---

### Risk S-02: BBC Sport — Dynamic Team News Content

**Evidence:** BBC Sport pages use a React front-end. Simple fixture and score data appears in the initial HTML; detailed team news injury lists may or may not. The BBC has published RSS feeds for sport sections historically. Confidence: MEDIUM.

**What happens:**
`requests.get('https://www.bbc.co.uk/sport/football/premier-league')` may return the page shell but not the team news paragraphs.

**Mitigation options:**
1. Use the BBC Sport RSS feed: `https://feeds.bbci.co.uk/sport/football/rss.xml` — static XML, no JavaScript rendering, contains news headlines.
2. If full team news prose is required (not just headlines), use Playwright with `page.wait_for_load_state('networkidle')` before extraction.
3. Scope the BBC Sport scraper to RSS headlines only; use FPL bootstrap `news` field as the authoritative availability source.

---

### Risk S-03: FPL Bootstrap `news` Field — Parsing Complexity

**Evidence:** The field already exists in `merged_players.json` via `pipeline/merge.py`. The v1.21 `NewsBanner` component reads it. What remains for SCRAPER-01 is structured extraction: parsing the free-text string into `{ status, confidence, source }` rather than showing raw text. Confidence: HIGH (grounded in codebase).

**What goes wrong:**
The `news` field is free text: `"Knee injury - 50% chance of playing"`, `"Expected to be available"`, `"Illness - doubtful"`, `"International duty"`. A regex or keyword match that extracts confidence fails on unusual wordings. A player with `news = "Groin injury - 25% chance of playing"` should yield `confidence: 'low'`; one with `news = "Slight knock - should be fine"` should yield `confidence: 'high'`. Edge cases: `"COVID-19 isolation"`, `"Compassionate leave"`, `"Awaiting scan results"`.

**Prevention:**
- Extract `chance_of_playing_next_round` (an integer, already available) as the primary confidence signal.
- Use `news` as supplementary text label, not as the confidence source.
- Map `chance_of_playing_next_round` to tiers: `null` = no news; `75-100` = low concern; `50` = doubtful; `25` = unlikely; `0` = ruled out.
- Do not attempt to parse `news` free text into structured confidence — the `chance` integer already provides this.

---

### Risk S-04: Twitter/X — Permanent Datacenter IP Blocks and Authentication Arms Race

**Evidence:** X permanently banned datacenter IP ranges in January 2025. All unofficial scraping requires authenticated sessions. twscrape (the leading current tool) requires Twitter account credentials and survives for days to weeks before session termination. Confidence: HIGH (multiple community sources, actively maintained library documentation).

**What goes wrong:**
Even with twscrape + account credentials, GitHub Actions' Azure-owned IPs hit X's datacenter IP block before the session-level rate limit. The scraper fails on the first request. The exception is caught by the non-fatal wrapper. No Twitter/X data is returned. The failure recurs on every pipeline run.

**Mitigation:**
Exclude Twitter/X from automated scraping entirely. The FPL bootstrap `news` field and RSS-sourced news provide sufficient signal for player availability. Twitter/X adds marginal value over these structured sources for a once-daily pipeline: breaking news breaks before the next FPL bootstrap update anyway (FPL updates bootstrap several times per day for injury news).

---

## Prevention Strategies

### Strategy 1: Source Tier Architecture

Structure `lineup_news.json` with explicit source tiers so consumers know how to weight each signal:

```json
{
  "scraped_at": "2026-05-17T03:15:00Z",
  "players": [
    {
      "element_id": 308,
      "web_name": "Salah",
      "status": "confirmed",
      "confidence": "high",
      "source": "fpl_bootstrap",
      "news": "Fit and available",
      "news_added": "2026-05-16T10:00:00Z"
    }
  ],
  "source_health": {
    "fpl_bootstrap": { "ok": true, "last_success": "2026-05-17T03:14:00Z" },
    "sky_sports_rss": { "ok": true, "last_success": "2026-05-17T03:14:30Z" },
    "bbc_sport_rss": { "ok": false, "last_success": "2026-05-16T03:12:00Z", "last_error": "HTTP 503" }
  }
}
```

Tiers by confidence, highest to lowest: `fpl_bootstrap` > `sky_sports_rss` > `bbc_sport_rss`. Downstream consumers (INTEL-01/02/03/04) pick the highest-confidence source per player.

### Strategy 2: Try RSS Before HTML

RSS feeds are the scraping-friendly interface for news sites. They are static XML, never JavaScript-rendered, change structure rarely, and do not trigger bot detection. Always attempt RSS integration before HTML scraping:

- Sky Sports Premier League news RSS: `https://www.skysports.com/rss/0,20514,11661,00.xml`
- BBC Sport football RSS: `https://feeds.bbci.co.uk/sport/football/rss.xml`

RSS parsing in Python: `import feedparser; feed = feedparser.parse(url)` — zero dependencies beyond `feedparser`. If RSS coverage is sufficient, HTML scraping is not needed.

### Strategy 3: Schema-First, Scraper-Second

Define the `lineup_news.json` schema and the `LineupNews` TypeScript type before writing any scraper code. This forces the question: "what minimum data does each INTEL phase need?" rather than "what can we get from Sky Sports?" A schema-first approach prevents scope creep where scrapers grow to accommodate data that is never used.

Minimum viable fields per player entry:
- `element_id` (FPL player ID)
- `web_name`
- `status` (`confirmed_out` | `doubtful` | `likely` | `confirmed_fit`)
- `confidence` (`high` | `medium` | `low`)
- `source` (which scraper provided this)
- `news_added` (ISO timestamp of when the news was first observed)

### Strategy 4: Staleness Gates in All Downstream Consumers

Every INTEL-phase consumer of `lineup_news.json` must check `scraped_at` before applying news penalties. If `scraped_at` is more than 48 hours old, treat the news as stale and do not apply penalisation to transfer scores or captain recommendations:

```python
from datetime import datetime, timezone, timedelta

def is_news_stale(scraped_at_iso: str, threshold_hours: int = 48) -> bool:
    scraped = datetime.fromisoformat(scraped_at_iso.replace('Z', '+00:00'))
    return (datetime.now(timezone.utc) - scraped) > timedelta(hours=threshold_hours)
```

### Strategy 5: Fail-Fast Validation in Local Testing

Before adding any scraper to the GitHub Actions pipeline, run it locally with logging enabled to verify:
1. The target URL returns the expected HTML content type.
2. The CSS selector or RSS path successfully finds at least one result.
3. The output schema matches `lineup_news.json` exactly.

Add an explicit assertion at the end of each scraper function: `assert len(results) > 0, f"No results from {source} — possible structure change"`. In the pipeline, this assertion raises an exception caught by the non-fatal wrapper (acceptable); in local testing, it surfaces the failure immediately.

---

## Twitter/X Access Options

All options assessed for a personal tool running in GitHub Actions on a zero-cost constraint.

| Option | Works in GH Actions | Cost | Stability | Verdict |
|--------|--------------------|----|-----------|---------|
| Official X API (Basic tier) | Yes | $100/month | High | Out of scope (cost constraint) |
| twscrape (account auth) | No — Azure IPs blocked since Jan 2025 | Free but fragile | Very low | Exclude |
| Scweet (cookies + GraphQL) | No — same IP block issue | Free but fragile | Very low | Exclude |
| Nitter self-hosted | Requires separate server | Hosting cost | Low (guest account pools needed) | Out of scope |
| RSS feed from Twitter profile | X disabled RSS feeds in 2023 | Free | N/A — not available | N/A |
| FPL bootstrap `news` field | Yes — already in pipeline | Free | High | Recommended |
| Sky Sports / BBC RSS | Yes | Free | Medium-High | Recommended |
| Manual `overrides.json` | Yes | Free | High (manual effort) | Acceptable fallback |

**Recommendation:** Exclude Twitter/X from SCRAPER-01 scope entirely. Use FPL bootstrap (primary) + Sky Sports RSS + BBC Sport RSS (secondary sources). This gives sufficient player availability signal without the authentication complexity, datacenter IP blocks, or ongoing maintenance burden of unofficial X scraping.

The FPL bootstrap `news` field is already the most reliable source: it is updated multiple times per day by FPL's editorial team from actual press conferences and physio reports. External scraping adds marginal value and material fragility.

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|----------------|------------|
| SCRAPER-01: schema design | Modelling `news` as free text instead of structured tiers | Use `chance_of_playing_next_round` integer as confidence; `news` text as label only |
| SCRAPER-01: source implementation | Using `requests` on a Cloudflare-protected HTML page | Test each source with `curl` first; use RSS feeds as the default |
| SCRAPER-01: pipeline wiring | Adding scraper call inside main `try` block | Wrap each scraper in its own `try/except Exception`; follow `set_piece_quality` pattern at `run.py:241-251` |
| SCRAPER-01: Playwright decision | Adding Playwright to workflow even when `requests` suffices | Per-source static/dynamic determination before writing code |
| SCRAPER-01: Twitter/X | Any unofficial X scraper in GH Actions | Do not implement; FPL bootstrap covers the same information |
| INTEL-01 through INTEL-04 | Consuming stale `lineup_news.json` without staleness check | Check `scraped_at` before applying news penalties; gate on 48-hour threshold |
| All INTEL phases | No data when scraper is down | Treat absent/stale `lineup_news.json` as "no news" (not "no doubts") — neutral, not optimistic |

---

## Sources

- Direct codebase audit: `pipeline/run.py` lines 241-251 — set_piece_quality non-fatal try/except pattern
- Direct codebase audit: `pipeline/fpl_client.py` — existing User-Agent + Referer headers pattern for FPL API requests
- Playwright official docs: `playwright.dev/python/docs/ci-intro` — GitHub Actions setup, browser caching, headless shell mode
- Playwright official docs: `playwright.dev/python/docs/browsers` — chromium headless shell, `--only-shell` install flag
- twscrape GitHub: `github.com/vladkens/twscrape` — authentication requirements, IMAP email verification, cookie-based session management
- Scrapely/ecosystem research: X datacenter IP ban (January 2025), guest token deprecation (August 2023)
- Cloudflare challenge documentation: `developers.cloudflare.com/cloudflare-challenges/` — JavaScript challenge mechanism
- Scraping ecosystem: `dev.to/agenthustler/python-requests-vs-selenium-vs-playwright-for-web-scraping-in-2026-125g` — tool selection guidance
- BBC Sport HTML scraper community projects: `github.com/benedsmith/python-bbcsport-scraper`
- FPL API documentation (community): `oliverlooney.com/blogs/FPL-APIs-Explained` — `news`, `news_added`, `chance_of_playing_next_round`, `chance_of_playing_this_round` field documentation
- Simon Willison TIL: `til.simonwillison.net/github-actions/continue-on-error` — `continue-on-error: true` pattern in GitHub Actions

---

*Pitfalls research for: FPL Analyst v1.22 — SCRAPER-01 Lineup Intelligence*
*Researched: 2026-05-17*
