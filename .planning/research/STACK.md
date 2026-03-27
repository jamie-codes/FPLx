# Technology Stack

**Project:** FPL Analyst
**Researched:** 2026-03-25
**Overall confidence:** MEDIUM-HIGH

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 16.x (latest stable ~16.2) | Full-stack framework | Server-side FPL API proxying (bypasses CORS), Route Handlers act as the backend, Vercel-native deployment, no separate server needed |
| React | 19.x | UI rendering | Required by Next.js 16; concurrent features, no legacy baggage |
| TypeScript | 5.x | Type safety | Catches shape mismatches between FPL API response and UI; FPL API schema changes are frequent |

**Why Next.js over Vite + separate API server:**
The FPL API blocks direct browser requests via CORS. You must proxy through a server. Next.js Route Handlers give you a server for free — you don't need a separate Express/FastAPI process. For a personal tool this eliminates infra complexity entirely.

**Why Next.js 16 over 15:**
Both are production-stable. Next.js 16 ships Turbopack as default (faster builds), stable React Compiler, and stable PPR. No meaningful migration risk from 15 → 16 for a greenfield project.

### Styling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x (v4.2+) | Utility-first CSS | Pairs with shadcn/ui; v4 Oxide engine is dramatically faster; CSS-first config removes the tailwind.config.js complexity |
| shadcn/ui | current (CLI-based, no package version) | Component primitives | Copy-paste component model means you own the code; React 19 + Tailwind v4 compatible as of 2026; data-table pattern built on TanStack Table is exactly what FPL tables need |

### Data Tables (Critical for this project)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TanStack Table | v8 (via shadcn/ui data-table) | Sortable/filterable tables | The FPL gem rating, DefCon, and value tables all need client-side sort/filter; TanStack Table is the standard; shadcn/ui's data-table recipe wraps it cleanly |

### Client-Side Data Fetching and Caching

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TanStack Query (React Query) | v5 | Server state management | Handles staleTime, background refetch, loading/error states out of the box; avoids hand-rolling useState + useEffect fetch patterns |

**Configuration for daily-refresh data:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60 * 6, // 6 hours — data refreshes daily server-side
      gcTime: 1000 * 60 * 60 * 12,   // keep in memory for 12 hours
    },
  },
})
```

### Charting

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Recharts | ^2.x | Form trend lines, fixture heatmaps | Lightweight, idiomatic React JSX API, widely documented; Tremor is built on top of it but adds weight this project does not need. Direct Recharts is preferred for control. |

Note: Tremor is explicitly NOT recommended here. It layers abstraction on top of Recharts without adding value for a table-heavy analytics tool. Pick Recharts directly.

### Data Pipeline (Python)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Python | 3.11+ | Data pipeline runtime | soccerdata is Python-native; no JS equivalent for Understat scraping |
| soccerdata | 1.8.8 | Understat xG/xA scraper | Official library, maintained, extracts JS variables embedded in Understat HTML pages, returns Pandas DataFrames; last release January 2026 |
| requests | ^2.31 | FPL API HTTP calls (in pipeline) | Simple, well-understood; handles session cookies for authenticated FPL endpoints |
| pandas | ^2.x | Data transformation | Required by soccerdata; normalise Understat DataFrames into JSON for Next.js consumption |

**Why a Python pipeline instead of Node.js scraping:**
soccerdata's Understat scraper handles the non-trivial JS variable extraction Understat uses (data is embedded in `<script>` tags, not JSON endpoints). There is no maintained equivalent in the Node.js ecosystem. The pipeline runs on a schedule (daily) and writes JSON files — it does not need to be a live service.

### Caching Strategy

**Architecture: File-based JSON cache, no database.**

```
[Python pipeline] → writes → /cache/fpl_data.json
                            /cache/understat_data.json
                            /cache/last_updated.json
[Next.js Route Handlers] → reads from cache files → serve to frontend
```

| Layer | Approach | Why |
|-------|----------|-----|
| Server cache | JSON files on disk, refreshed by daily cron | No Redis/DB needed for single-user; files survive process restarts; human-readable for debugging |
| Route Handler | Reads cache file, adds Cache-Control headers | `stale-while-revalidate` lets Vercel edge cache serve stale data instantly |
| Client cache | TanStack Query staleTime: 6h | Avoids redundant API calls within a session |

### Infrastructure / Deployment

| Technology | Purpose | Why |
|------------|---------|-----|
| Vercel Hobby (free) | Next.js hosting | Free tier: 100 GB bandwidth/month, 150K function invocations/month — massively sufficient for personal use. First-class Next.js support. |
| GitHub Actions (or local cron) | Daily pipeline trigger | Runs Python data pipeline once daily; writes JSON cache to a persistent store |
| Vercel Blob / GitHub repo /tmp | Cache storage | See note below |

**Cache storage decision (important):**
Vercel serverless functions are stateless — `/tmp` is ephemeral and wiped between cold starts. For the cache to persist, options are:
1. **Vercel Blob** (recommended for Vercel-native): Object storage, free tier available, works with Route Handlers natively
2. **Commit cache to GitHub repo**: Simple but pollutes git history; acceptable for personal tool
3. **Separate persistent storage** (e.g., Cloudflare R2 free tier): More robust but more setup

Recommendation: **Vercel Blob** for cache storage. It is the simplest Vercel-native solution, has a free tier adequate for ~2 MB of daily FPL JSON, and integrates with Next.js Route Handlers without additional packages.

---

## FPL API Specifics

### CORS Constraint

The FPL API at `https://fantasy.premierleague.com/api/` does not allow direct browser fetch calls. All calls must be made server-side.

**Solution:** Next.js Route Handlers act as the proxy. The browser calls `/api/fpl/bootstrap-static` which the Route Handler forwards to `https://fantasy.premierleague.com/api/bootstrap-static/` server-side. CORS is irrelevant server-to-server.

### Auth (FPL Login — Optional Feature)

FPL login uses session-cookie authentication, not OAuth:

```
POST https://users.premierleague.com/accounts/login/
Payload: { login, password, redirect_uri, app }
Response: Sets pl_profile, sessionid cookies
```

**Handling in this app:**
- The Python pipeline handles authenticated calls (fetching squad bank balance, transfer count) using `requests.Session()` which persists cookies automatically
- Credentials are passed via environment variables (`FPL_EMAIL`, `FPL_PASSWORD`) — never stored in code or cache files
- For the UI flow: user enters FPL Team ID (public, no auth) OR optionally provides credentials via the UI which are POSTed to a Next.js Route Handler, used once for the session, and never persisted to disk

### Key Public Endpoints (No Auth Required)

| Endpoint | Data |
|----------|------|
| `/api/bootstrap-static/` | All players, teams, gameweek info, prices, ownership, flags |
| `/api/fixtures/` | All fixtures with difficulty ratings |
| `/api/element-summary/{player_id}/` | Per-player history, upcoming fixtures |
| `/api/entry/{team_id}/` | Public team info |
| `/api/entry/{team_id}/event/{gw}/picks/` | Team picks for a gameweek |

### Key Auth-Gated Endpoints

| Endpoint | Data |
|----------|------|
| `/api/me/` | Bank balance, remaining transfers (requires login) |
| `/api/my-team/{team_id}/` | Current squad with selling prices |

---

## Understat Scraping

### Approach

Use soccerdata's `Understat` class. It extracts JavaScript variables embedded in Understat HTML (not a REST API), returns Pandas DataFrames, and caches locally by default.

```python
import soccerdata as sd

understat = sd.Understat()
# Returns DataFrame with player xG, xA, shots per season/league
player_stats = understat.read_player_season_stats(
    leagues=["EFL Championship"],  # Premier League = "EPL"
    seasons=["2425"]
)
```

**Rate limiting:** soccerdata includes built-in delays. Understat does not publish a rate limit policy, but the community practice is 1-2 requests/second with randomised delays. Running once daily with a warm cache means negligible request volume — unlikely to be blocked.

**Fragility:** soccerdata relies on scraping; Understat HTML changes will break it. Pin to `soccerdata==1.8.8` and test at season start each year. This is a known maintenance cost.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 16 | Vite + Express | Vite has no server — you need a separate Express process to proxy FPL API. Next.js collocates frontend + API in one deploy. |
| Framework | Next.js 16 | Remix | Remix is excellent but ecosystem maturity for data-table patterns (shadcn/TanStack) is more Next.js-centric. Adds learning curve with no benefit here. |
| Styling | Tailwind + shadcn/ui | Mantine / Chakra UI | Mantine/Chakra are full component libraries with opinionated styles; harder to theme for a data-forward FPL aesthetic. shadcn/ui gives full ownership. |
| Charts | Recharts | Tremor | Tremor wraps Recharts — using it means less control over chart internals. For simple bar/line charts in FPL context, direct Recharts is sufficient. |
| Charts | Recharts | D3.js | D3 is lower-level; engineering overhead not justified for simple fixture heatmaps and form lines |
| Data pipeline | Python (soccerdata) | Node.js + Playwright | No maintained Node.js Understat library. Playwright scraping is more brittle and harder to maintain than soccerdata's approach. |
| Cache storage | Vercel Blob | Redis / Upstash | Redis adds cost and infrastructure complexity. Upstash free tier is viable but Vercel Blob is simpler and natively integrated. |
| Cache storage | Vercel Blob | SQLite (Turso/libSQL) | SQLite is appropriate if data becomes relational. For v1 daily JSON dumps, it is over-engineering. |
| Client state | TanStack Query v5 | SWR | Both are fine. TanStack Query has more control over staleTime/gcTime and better DevTools. SWR is simpler but less expressive for complex caching. |
| Deployment | Vercel | Railway / Render | Railway/Render are better for always-on Node servers. For Next.js + serverless, Vercel is unambiguously better. |

---

## Installation

```bash
# Create Next.js app
npx create-next-app@latest fplx --typescript --tailwind --app --src-dir

# shadcn/ui init (Tailwind v4 mode)
npx shadcn@latest init

# Core runtime deps
npm install @tanstack/react-query @tanstack/react-table recharts

# Dev deps
npm install -D @tanstack/react-query-devtools

# Vercel Blob (for cache storage)
npm install @vercel/blob
```

```bash
# Python pipeline (separate venv)
pip install soccerdata==1.8.8 requests pandas python-dotenv
```

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Next.js as framework choice | HIGH | CORS constraint makes server-side proxy mandatory; Next.js is the obvious single-deploy solution |
| Next.js 16 version | MEDIUM | 16.2.1 confirmed latest stable March 2026; minor version details from WebSearch only |
| FPL API CORS constraint | HIGH | Confirmed by multiple community sources and FPL API documentation |
| FPL auth mechanism | MEDIUM | Session-cookie flow documented by community; FPL may change it without notice |
| soccerdata for Understat | HIGH | PyPI v1.8.8 confirmed Jan 2026; Understat support explicitly listed |
| Tailwind v4 + shadcn/ui | HIGH | shadcn/ui changelog confirms React 19 + Tailwind v4 support as of 2026 |
| TanStack Query v5 / Table v8 | HIGH | Current stable; widely used; API stable |
| Recharts | MEDIUM | Widely used; no breaking changes in recent releases; training data-era knowledge |
| Vercel Blob for cache | MEDIUM | Verified via Vercel docs as free-tier product; free tier limits not confirmed |
| Vercel Hobby limits | HIGH | Confirmed: 100 GB bandwidth, 150K function invocations/month |

---

## Sources

- FPL API CORS constraint: [FPL APIs Explained — Oliver Looney](https://www.oliverlooney.com/blogs/FPL-APIs-Explained)
- FPL API endpoints: [Complete Guide to FPL API — UK Retro Gaming](https://ukretrogaming.co.uk/blogs/blog/a-complete-guide-to-the-fantasy-premier-league-fpl-api)
- FPL auth: [FPL API Authentication Guide — Medium](https://medium.com/@bram.vanherle1/fantasy-premier-league-api-authentication-guide-2f7aeb2382e4)
- soccerdata PyPI: [soccerdata 1.8.8 — PyPI](https://pypi.org/project/soccerdata/) (v1.8.8, released January 16, 2026)
- soccerdata Understat: [Understat and Sofascore Scrapers — DeepWiki](https://deepwiki.com/probberechts/soccerdata/3.5-understat-and-sofascore-scrapers)
- Next.js versions: [Next.js 16.1 — nextjs.org](https://nextjs.org/blog/next-16-1); [Upgrading to v16 — nextjs.org](https://nextjs.org/docs/app/guides/upgrading/version-16)
- Next.js as FPL proxy: [Building APIs with Next.js — nextjs.org](https://nextjs.org/blog/building-apis-with-nextjs)
- shadcn/ui React 19 + Tailwind v4: [shadcn/ui changelog](https://ui.shadcn.com/docs/changelog)
- shadcn/ui data-table: [Data Table — shadcn/ui](https://ui.shadcn.com/docs/components/radix/data-table)
- TanStack Query v5 caching: [Caching Examples — TanStack](https://tanstack.com/query/v5/docs/react/guides/caching)
- Tailwind CSS v4.2: [Tailwind CSS v4.0 — tailwindcss.com](https://tailwindcss.com/blog/tailwindcss-v4)
- Recharts vs Tremor: [Best React Chart Libraries 2025 — LogRocket](https://blog.logrocket.com/best-react-chart-libraries-2025/)
- Vercel Hobby limits: [Vercel Hobby Plan — vercel.com](https://vercel.com/docs/plans/hobby)
- Vite vs Next.js for analytics: [Vite vs Next.js 2025 — Strapi](https://strapi.io/blog/vite-vs-nextjs-2025-developer-framework-comparison)
