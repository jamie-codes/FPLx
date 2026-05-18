# Stack Research — v1.24 End of Season & Off-Season Intelligence

**Domain:** FPL Analyst v1.24 — SCRAPER-02, Season Review, Next Season Planner, Summer Window Tracker, polish carry-forwards
**Researched:** 2026-05-18
**Confidence:** HIGH — grounded in direct file inspection of existing pipeline code + requirements.txt, official PyPI pages, and verified documentation

---

## Bottom Line Up Front

**Net new Python packages: 1–2 (twikit; PuLP only if greedy heuristic is insufficient)**
**Net new npm packages: 0**
**Sky Sports / BBC RSS: already implemented — no new library needed**
**Twitter/X: add twikit==2.3.3 with non-fatal gate; pin version strictly**
**Full-pool squad optimiser: greedy heuristic first (zero dependencies); PuLP as upgrade path**

Most of the Python scraping infrastructure for SCRAPER-02 already exists from Phase 117 (v1.22). The `pipeline/lineup_news.py` module already reads Sky Sports RSS and BBC Sport RSS via `feedparser`, and `pipeline/requirements.txt` already pins `feedparser>=6.0.12`, `beautifulsoup4>=4.14.3`, and `lxml>=6.1.0`.

SCRAPER-02 is a **content and source extension** (different Sky Sports RSS channel for transfers, Transfermarkt RSS for signings, Twikit for Twitter/X), not a new library introduction for the Sky/BBC path.

---

## Existing Stack: No Changes Required

### Python Pipeline (already in requirements.txt — confirmed)

| Package | Pinned Version | What It Covers |
|---------|---------------|----------------|
| `requests` | `>=2.32.0` | HTTP client for all pipeline fetches |
| `pandas` | `>=2.2.0` | Data manipulation |
| `feedparser` | `>=6.0.12` | RSS parsing — Sky Sports, BBC Sport (already in lineup_news.py) |
| `beautifulsoup4` | `>=4.14.3` | HTML scraping fallback |
| `lxml` | `>=6.1.0` | HTML/XML parser backend for BS4 |
| `anthropic` | `>=0.98.1` | Claude API for batch insights |
| `soccerdata` | `==1.8.8` | Understat xG/xA data |
| `numpy` | `>=1.26.0` | Numeric operations |
| `vercel-blob` | `>=0.4.0` | Blob storage writes |
| `python-dotenv` | `>=1.0.0` | Environment variables |

### TypeScript / npm (already in package.json — no changes)

| Package | Version | Covers |
|---------|---------|--------|
| `recharts` | `^3.8.1` | Season review charts, fixture heatmap |
| `@tanstack/react-query` | `^5.95.2` | Data fetching for new API routes |
| `@tanstack/react-table` | `^8.21.3` | Squad tables, season review tables |
| `zod` | `^4.3.6` | Validation of new JSON artifacts |
| `@vercel/blob` | `^2.3.1` | Reading new pipeline artifacts |

All Season Review, Next Season Planner, and Summer Window Tracker TypeScript features read JSON artifacts from Vercel Blob and render using existing libraries.

---

## New Stack Additions

### Python: SCRAPER-02 — Twitter/X

**Situation:** Twitter/X official API v2 makes read access cost-prohibitive.

| Tier | Cost | Read access | Verdict |
|------|------|-------------|---------|
| Free | $0/month | Write-only (apps/bots) | Not viable for reading |
| Basic | $100/month | ~10k reads/month | Not justified for personal tool |
| Pro | $5,000/month | ~1M reads/month | Completely out of scope |

**Recommendation:** `twikit==2.3.3` — scrapes X's internal API without an API key.

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `twikit` | `==2.3.3` (hard pin) | Scrape tweets from key accounts (e.g. @SkySportsNews, @BBCSport, @FabrizioRomano) | Only viable free Python option. Uses X's internal (non-documented) API via session cookies. 4.2k GitHub stars. Last release Feb 7, 2025. No API key needed. |

**Hard-pin rationale:** Twikit uses X's internal API. X makes undocumented changes without notice. An uncontrolled `>=` upgrade can break the scraper silently between pipeline runs. Pin `==2.3.3` and upgrade deliberately.

**Gate requirement:** Wrap the entire Twitter block in an `TWITTER_SCRAPER_ENABLED` env var gate (same pattern as `INSIGHT_BATCH_ENABLED` in run.py). Store `TWITTER_USERNAME`, `TWITTER_EMAIL`, `TWITTER_PASSWORD` as GitHub Actions secrets. The scraper is **non-fatal** — if it fails (session expired, rate-limited, X API change), the pipeline continues and writes `lineup_news.json` without Twitter content.

**Usage pattern:**
```python
import asyncio
from twikit import Client

async def scrape_accounts(usernames: list[str]) -> list[dict]:
    client = Client('en-US')
    await client.login(
        auth_info_1=os.environ['TWITTER_USERNAME'],
        auth_info_2=os.environ['TWITTER_EMAIL'],
        password=os.environ['TWITTER_PASSWORD'],
    )
    results = []
    for username in usernames:
        user = await client.get_user_by_screen_name(username)
        tweets = await user.get_tweets('Tweets', count=10)
        results.extend(tweets)
    return results
```

**Accounts to scrape** (narrow scope reduces detection risk):
- `@SkySportsNews` — transfer news
- `@BBCSport` — injury/fitness news
- `@FabrizioRomano` — confirmed transfer deals ("here we go")
- `@David_Ornstein` — reliable transfer/injury sourcing

**Risk acknowledgement:** Twikit is a grey-area tool. X's ToS prohibits automated scraping; the project has no explicit API licence. For a personal daily tool with low request volume (<50 tweets/day), the practical detection risk is low. The non-fatal gate means a ban or rate-limit does not break the pipeline.

---

### Python: Next Season Planner — Full-Pool Squad Optimiser

**Problem:** C(700, 15) ≈ 5 × 10^30 combinations — brute-force is completely infeasible. The existing `optimiseLineup` TypeScript function (C(15,11) = 1,365 for a 15-player squad) cannot be extended to a full pool.

**Solution path: greedy heuristic first, PuLP as upgrade**

#### Option A: Greedy Heuristic (zero new libraries — recommended starting point)

Algorithm:
1. Sort all ~700 players by `xPts_1gw / now_cost` (value ratio) descending
2. Greedily pick players enforcing: position quotas (2GK/5DEF/5MID/3FWD), budget ≤ 100m, club cap ≤ 3
3. On budget overrun: backtrack and try next candidate for that position
4. Result: valid 15-player squad in O(n log n) time

**Accuracy:** Greedy produces near-optimal squads (typically within 2–5% of ILP optimum) because FPL player values cluster tightly and the constraints rarely produce counterintuitive selections. For a planning tool this is entirely acceptable.

**No new library.** Implemented as `pipeline/suggest_squad.py`, writes `suggested_squad.json` to Vercel Blob.

#### Option B: PuLP ILP (precise optimum — add only if greedy is insufficient)

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `PuLP` | `>=3.3.1` | Integer Linear Programming — exact optimal 15-player squad from full pool | Formulates as binary ILP with budget/position/club constraints. CBC solver bundled in wheel. Solves 700-player problem in <100ms. Widely used for FPL optimisation. |

ILP model:
```
Maximise: sum(xPts_i * x_i)  for i in all_players
Subject to:
  sum(cost_i * x_i) <= 100.0
  sum(x_i for pos==GK) == 2
  sum(x_i for pos==DEF) == 5
  sum(x_i for pos==MID) == 5
  sum(x_i for pos==FWD) == 3
  sum(x_i for club==c) <= 3   for each club c
  x_i in {0, 1}               binary decision variables
```

PuLP 3.3.1 (released May 5, 2026) bundles the CBC solver — `pip install pulp` is sufficient.

**When to use PuLP over greedy:** If greedy produces squads where the budget is consistently underutilised (e.g. finishing 2m under budget with clearly better available options), switch to PuLP. The ILP guarantees the global optimum.

**Why not TypeScript ILP (highs-js)?**
The existing Key Decisions log already documents: "Pure TS enumeration for optimiser (C(15,11)=1,365 subsets, <1ms) — No WASM solver needed; `glpk.js` ruled out (WASM issues in Next.js, ~1MB bundle)." highs-js v1.8.0 ships a ~4MB WASM binary with the same Next.js loading complexities. The daily pipeline is the correct home for heavy computation — the TypeScript side only renders the pre-computed result.

---

## RSS Feed Sources for SCRAPER-02 (No New Library)

The existing `feedparser` handles all of these. Only the URLs are new.

| Source | RSS URL | Content | Already Scraped? |
|--------|---------|---------|-----------------|
| Sky Sports (general football) | `https://www.skysports.com/rss/11095` | Team news, injuries | Yes — lineup_news.py |
| BBC Sport (football) | `https://feeds.bbci.co.uk/sport/football/rss.xml` | Team news, injuries | Yes — lineup_news.py |
| Sky Sports (transfer news) | `https://www.skysports.com/rss/12040` | Transfers, signings, rumours | No — add for SCRAPER-02 |
| Transfermarkt (UK) | `https://www.transfermarkt.co.uk/rss/news` | Confirmed transfers, valuations | No — add for Summer Window Tracker |

**No new Python library required for any of these.** Feedparser 6.0.12 handles RSS 2.0 and Atom formats including malformed feeds (`bozo=True` is non-fatal per existing lineup_news.py pattern).

---

## Season Review: No New Libraries

The Season Review feature aggregates existing artifacts already written to Vercel Blob:
- `captain_picks_gw{N}.json` — per-GW captain selections (pipeline already writes these)
- `accuracy_backtest.json` — model calibration, predicted vs actual hit rate
- `transfer_snapshots/` — weekly transfer history

Computation is pure TypeScript (or Python pipeline pre-aggregation writing `season_review.json`). UI renders with existing `recharts` and TanStack Table.

**No new npm packages.** No new Python packages.

---

## Summer Window Tracker: No New Libraries

Uses Transfermarkt RSS (feedparser already handles it) + potential Twikit tweets from @FabrizioRomano. Writes `transfer_window.json` to Vercel Blob. TypeScript reads via new `/api/transfer-window` route.

---

## Polish Carry-Forwards: No New Libraries

- **TRT-06** (ChipToggle in RouteTreeTab) — TypeScript component work
- **TRT-02** (Hits column cosmetic label) — TypeScript component work
- **MinsRiskBadge on 4 surfaces** (SquadView/DecisionSummaryTab/GemTable column/PlayerComparisonModal) — TypeScript component work using existing badge logic

---

## Final pip install delta

```bash
# Add to pipeline/requirements.txt:
twikit==2.3.3
pulp>=3.3.1        # only if greedy heuristic proves insufficient
```

No changes to package.json.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Official X API v2** | $100-5,000/month for read access | `twikit` for personal use |
| **snscrape** | Effectively abandoned (200+ open GitHub issues, last meaningful commit 2023) | `twikit` |
| **twint** | Non-functional against current X anti-scraping systems | `twikit` |
| **tweepy** | Free tier is write-only; read access requires paid subscription | `twikit` |
| **highs-js (npm)** | ~4MB WASM binary; Next.js WASM loading requires non-trivial webpack config; already ruled out for existing optimiser; daily pipeline is the right home | PuLP in Python pipeline |
| **glpk.js (npm)** | Already ruled out in Key Decisions (WASM issues in Next.js, ~1MB bundle) | PuLP in Python pipeline |
| **Playwright (Python)** | Already ruled out in v1.22 research: adds 1-2 minutes to CI per run; Sky Sports and BBC use SSR — content is in static HTML | `requests` + `beautifulsoup4` |
| **Scrapy** | Overkill for 2-4 target pages per pipeline run; async complexity doesn't fit synchronous pipeline/run.py | `requests` + `beautifulsoup4` |
| **requests-cache** | Pipeline runs once daily; caching adds complexity with minimal benefit | None — HTTP caching not needed for daily cron |
| **python-dateutil** | Already available via pandas transitive dependency; no direct use case in v1.24 | pandas built-in datetime handling |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `twikit==2.3.3` | Python >=3.9, `requests>=2.32.0` | Hard pin — internal X API changes cause silent breakage on uncontrolled upgrades |
| `pulp>=3.3.1` | Python >=3.9 | CBC solver bundled in wheel since 3.x; no `pulp[cbc]` extras install needed |
| `feedparser>=6.0.12` | Python >=3.8 | Already pinned in requirements.txt; latest is 6.0.12 (Sep 2025) |

---

## Sources

- `C:\Users\jamie\fplx\pipeline\requirements.txt` — confirmed existing library versions (HIGH confidence)
- `C:\Users\jamie\fplx\pipeline\lineup_news.py` — confirmed Sky Sports RSS (`skysports.com/rss/11095`) and BBC RSS already scraped via feedparser (HIGH confidence)
- `C:\Users\jamie\fplx\package.json` — confirmed npm dependency set, no ILP solver present (HIGH confidence)
- [twikit PyPI](https://pypi.org/project/twikit/) — v2.3.3, Feb 7, 2025, actively maintained (HIGH confidence)
- [twikit GitHub](https://github.com/d60/twikit) — 4.2k stars, MIT license, session-cookie auth pattern confirmed (HIGH confidence)
- [PuLP PyPI](https://pypi.org/project/PuLP/) — v3.3.1, May 5, 2026, CBC bundled in wheel (HIGH confidence)
- [feedparser PyPI](https://pypi.org/project/feedparser/) — v6.0.12, Sep 10, 2025 (HIGH confidence)
- [highs-js GitHub](https://github.com/lovasoa/highs-js) — v1.8.0, WASM binary approach confirmed (HIGH confidence)
- [Transfermarkt RSS guide](https://www.transfermarkt.us/intern/rssguide) — `transfermarkt.co.uk/rss/news` URL confirmed (HIGH confidence)
- [DEV.to: Scraping Twitter in 2025](https://dev.to/sivarampg/scraping-twitter-in-2025-a-developers-guide-to-surviving-the-api-apocalypse-5bbd) — X API pricing, twitterapi.io cost confirmed (MEDIUM confidence)
- [DEV.to: Twitter/X Scraping Frameworks 2026](https://dev.to/ashish_soni08/comprehensive-guide-to-twitterx-scraping-frameworks-and-tools-in-2026-37p2) — snscrape/twint deprecation confirmed (MEDIUM confidence)
- [FPL ILP arxiv 2505.02170](https://arxiv.org/html/2505.02170v1) — binary ILP formulation for FPL squad selection confirmed (HIGH confidence)
- [eirikur.dev FPL ILP 2024](https://eirikur.dev/blog/2024-08-05-fpl-and-dp/) — greedy + ILP approaches compared (MEDIUM confidence)
- BBC Sport RSS URL `feeds.bbci.co.uk/sport/football/rss.xml` — confirmed via multiple aggregator sources (HIGH confidence)

---

*Stack research for: FPL Analyst v1.24 — End of Season & Off-Season Intelligence*
*Researched: 2026-05-18*
