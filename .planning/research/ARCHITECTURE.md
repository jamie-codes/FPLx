# Architecture Research

**Domain:** Personal FPL analytics web app (Next.js + Python pipeline)
**Researched:** 2026-03-26
**Confidence:** HIGH (derived from confirmed STACK.md decisions)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATA PIPELINE (Python)                       │
│                     Runs once daily via cron                     │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ FPL API fetcher  │  │  Understat via   │                     │
│  │ (requests)       │  │  soccerdata 1.8.8│                     │
│  └────────┬─────────┘  └────────┬─────────┘                     │
│           │                     │                               │
│           ▼                     ▼                               │
│  ┌──────────────────────────────────────────┐                   │
│  │         Data merger + scorer              │                   │
│  │   (merge on player ID, compute scores)    │                   │
│  └─────────────────┬────────────────────────┘                   │
│                    │                                             │
│                    ▼                                             │
│  ┌─────────────────────────────────────────┐                    │
│  │   Vercel Blob (persistent JSON cache)    │                    │
│  │   fpl_bootstrap.json                     │                    │
│  │   understat_players.json                 │                    │
│  │   merged_players.json                    │                    │
│  │   last_updated.json                      │                    │
│  └─────────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                    reads at request time
                              │
┌─────────────────────────────────────────────────────────────────┐
│                   NEXT.JS APP (Vercel)                           │
│                                                                  │
│  ROUTE HANDLERS (server-side)                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ /api/players │  │ /api/squad/  │  │ /api/fpl/[...proxy]  │   │
│  │ (serves      │  │ [teamId]     │  │ (live FPL proxy —    │   │
│  │  merged JSON)│  │ (squad data) │  │  bypasses CORS)      │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘   │
│         │                 │                                      │
│         ▼                 ▼                                      │
│  REACT COMPONENTS (client-side, via TanStack Query)              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ GemTable    │  │ TransferPanel│  │ DefConTable            │  │
│  │ (sortable)  │  │              │  │                        │  │
│  └─────────────┘  └──────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Python pipeline | Fetch, merge, score, cache all player data | `pipeline/` dir, runs via GitHub Actions cron |
| FPL fetcher | Pull bootstrap-static, fixtures, element-summary | `pipeline/fpl_client.py` using `requests` |
| Understat fetcher | Pull xG/xA per player | `pipeline/understat_client.py` using `soccerdata` |
| Data merger | Join FPL + Understat on player ID mapping | `pipeline/merge.py` |
| Scorer | Compute Gem rating, DefCon hit rate, value scores | `pipeline/scoring.py` |
| Vercel Blob | Persist daily JSON output between pipeline runs | External service (no code to own) |
| Route Handlers | Serve cached JSON, proxy live FPL calls | `src/app/api/` |
| React pages | Tabs/views per feature area | `src/app/(dashboard)/` |
| TanStack Query | Client-side data fetching + caching (staleTime=6h) | Provider in root layout |
| shadcn/ui + TanStack Table | Sortable/filterable player tables | Component-level |

---

## Recommended Project Structure

```
fplx/
├── pipeline/                    # Python data pipeline
│   ├── fpl_client.py            # FPL API fetching (requests)
│   ├── understat_client.py      # soccerdata Understat wrapper
│   ├── player_id_map.json       # FPL ID ↔ Understat ID mapping
│   ├── merge.py                 # Joins FPL + Understat data
│   ├── scoring.py               # Gem rating, DefCon, value scores
│   ├── upload.py                # Writes JSON to Vercel Blob
│   ├── run.py                   # Entry point: fetch → merge → score → upload
│   └── requirements.txt
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── players/
│   │   │   │   └── route.ts     # Serves merged_players.json from Blob
│   │   │   ├── squad/
│   │   │   │   └── [teamId]/
│   │   │   │       └── route.ts # Fetches squad picks (FPL proxy)
│   │   │   └── fpl/
│   │   │       └── [...proxy]/
│   │   │           └── route.ts # Generic FPL API proxy (bypasses CORS)
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx         # Default: Gem ratings table
│   │   │   ├── defcon/
│   │   │   │   └── page.tsx
│   │   │   ├── transfers/
│   │   │   │   └── page.tsx
│   │   │   ├── form/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx       # Tab navigation
│   │   ├── layout.tsx           # Root layout: QueryClientProvider, theme
│   │   └── providers.tsx        # TanStack Query provider (client component)
│   │
│   ├── components/
│   │   ├── ui/                  # shadcn/ui copies (owned, not imported)
│   │   ├── GemTable.tsx         # Main gem rating table (TanStack Table)
│   │   ├── DefConTable.tsx      # DefCon analysis table
│   │   ├── TransferPanel.tsx    # Transfer suggestions UI
│   │   ├── SquadView.tsx        # Current squad display
│   │   ├── FixtureDifficultyBadge.tsx
│   │   └── LastUpdated.tsx
│   │
│   ├── lib/
│   │   ├── fpl-adapter.ts       # Isolates FPL API shapes — change here when API changes
│   │   ├── scoring.ts           # TS port of scoring logic for client-side use if needed
│   │   ├── transfer-engine.ts   # Transfer suggestion algorithm
│   │   └── types.ts             # Shared TypeScript types (Player, Squad, GemScore, etc.)
│   │
│   └── hooks/
│       ├── usePlayers.ts        # TanStack Query: GET /api/players
│       └── useSquad.ts          # TanStack Query: GET /api/squad/[teamId]
│
├── .github/
│   └── workflows/
│       └── pipeline.yml         # Daily cron: runs pipeline/run.py
│
└── .env.local                   # FPL_EMAIL, FPL_PASSWORD, BLOB_READ_WRITE_TOKEN
```

### Structure Rationale

- **`pipeline/`**: Entirely separate from Next.js — different runtime (Python), different deploy target (GitHub Actions). Keeping it top-level avoids confusion with the Next.js `src/` tree.
- **`src/app/api/`**: Route Handlers are the only server logic in Next.js. They read from Blob cache and proxy FPL calls. No business logic here — just data retrieval and shape transformation.
- **`src/lib/`**: All analytics logic that needs to be shared or used in Route Handlers. The FPL adapter is critical — centralises all FPL API shape knowledge so a field rename only needs fixing in one place.
- **`src/components/`**: Flat structure for now (personal tool). No need for feature-folder organisation at this scale.
- **`src/hooks/`**: Thin TanStack Query wrappers. Keeps data-fetching concerns out of components.

---

## Architectural Patterns

### Pattern 1: Route Handler as FPL Proxy

**What:** A catch-all Next.js Route Handler forwards browser requests to the FPL API server-side, bypassing CORS.

**When to use:** Any FPL endpoint the frontend needs to call at runtime (e.g. fetching a user's squad by Team ID).

**Trade-offs:** +Simple, no separate server needed. −Adds one network hop. For daily-cached data this is negligible.

```typescript
// src/app/api/fpl/[...proxy]/route.ts
export async function GET(req: Request, { params }: { params: { proxy: string[] } }) {
  const path = params.proxy.join('/')
  const res = await fetch(`https://fantasy.premierleague.com/api/${path}/`, {
    headers: { 'User-Agent': 'fplx/1.0' },
  })
  const data = await res.json()
  return Response.json(data)
}
```

### Pattern 2: Blob Cache Read in Route Handler

**What:** Route Handlers read from Vercel Blob rather than calling FPL API directly on each request. The Python pipeline writes the blob; Route Handlers serve it.

**When to use:** All data that is pre-computed by the pipeline (player list, gem scores, DefCon stats).

**Trade-offs:** +Fast (blob read < 50ms). +No FPL API rate limit risk on the server. −Data is at most 24h stale (acceptable for this use case).

```typescript
// src/app/api/players/route.ts
import { head } from '@vercel/blob'

export async function GET() {
  const blob = await head('merged_players.json')
  const res = await fetch(blob.url)
  const data = await res.json()
  return Response.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  })
}
```

### Pattern 3: FPL Adapter Layer

**What:** A thin module (`lib/fpl-adapter.ts`) maps raw FPL API shapes to internal typed interfaces. No component ever imports a raw FPL type.

**When to use:** Everywhere that consumes FPL data.

**Trade-offs:** +Isolates breakage when FPL API changes (happens at season start). −Small upfront cost to write.

```typescript
// src/lib/fpl-adapter.ts
import type { FPLElement, FPLTeam } from './types'

export function adaptPlayer(raw: Record<string, unknown>): FPLElement {
  return {
    id: raw.id as number,
    name: raw.web_name as string,
    team: raw.team as number,
    position: raw.element_type as number,   // 1=GK 2=DEF 3=MID 4=FWD
    price: (raw.now_cost as number) / 10,
    ownership: parseFloat(raw.selected_by_percent as string),
    form: parseFloat(raw.form as string),
    minutesPerGame: (raw.minutes as number) / Math.max(raw.starts as number, 1),
    status: raw.status as string,           // 'a'=available, 'd'=doubtful, etc.
    // DefCon fields (2025/26)
    defensiveContributions: raw.defensive_contributions as number ?? null,
  }
}
```

---

## Data Flow

### Daily Pipeline Flow

```
GitHub Actions cron (daily)
    ↓
pipeline/run.py
    ↓ parallel
    ├── fpl_client.py → GET /api/bootstrap-static/ + /api/fixtures/
    └── understat_client.py → soccerdata.Understat().read_player_season_stats()
    ↓
merge.py → join on player_id_map.json (FPL id ↔ Understat id)
    ↓
scoring.py → compute gem_score, defcon_hit_rate, value_score per player
    ↓
upload.py → write to Vercel Blob:
    merged_players.json   (~500 players × ~40 fields)
    last_updated.json     (ISO timestamp)
```

### Request-Time Flow (Page Load)

```
Browser → GET /gems page
    ↓
GemTable component mounts
    ↓
usePlayers() hook → TanStack Query checks cache (staleTime=6h)
    ↓ (if stale or first load)
GET /api/players → Route Handler
    ↓
Route Handler reads merged_players.json from Vercel Blob
    ↓
Returns JSON with Cache-Control headers
    ↓
TanStack Query caches in-memory for session
    ↓
GemTable renders sortable rows
```

### Transfer Suggestion Flow

```
User enters FPL Team ID (or logged in)
    ↓
useSquad(teamId) → GET /api/squad/[teamId] → FPL proxy → /api/entry/{id}/event/{gw}/picks/
    ↓
TransferPanel receives: squad picks + bank balance + free transfers
    ↓
transfer-engine.ts (client-side):
    for each player in squad:
        score current player's upcoming gem rating
        find top 3 replacements (same position, affordable, higher gem rating)
    rank by improvement delta
    filter to available free transfers
    ↓
Render suggestions with sell/buy price, gem improvement, and affordability
```

---

## Phase-by-Phase Architecture Build-Up

| Phase | What Gets Built | Architectural Boundary Added |
|-------|----------------|------------------------------|
| 1: Foundation | Next.js scaffold, Route Handler FPL proxy, Blob read/write, fpl-adapter.ts | FPL proxy layer; Blob cache layer |
| 2: Python Pipeline | Python pipeline: FPL fetch + Understat + merge + upload to Blob | Pipeline ↔ Blob interface established |
| 3: Player Data API | `/api/players` serving merged JSON; TypeScript types; usePlayers hook | Data API surface defined |
| 4: Gem Rating UI | Scoring logic in scoring.py + lib/scoring.ts; GemTable component | Scoring layer; UI table pattern |
| 5: DefCon Analysis | DefCon scoring in pipeline; DefConTable component | Position-specific analysis tables |
| 6: Squad & Transfers | Squad fetch via proxy; transfer-engine.ts; TransferPanel | Transfer suggestion engine |
| 7: Polish | Last-updated display, fixture difficulty badges, form trends | Visual layer complete |

---

## Anti-Patterns

### Anti-Pattern 1: Calling FPL API from Route Handler on Every Request

**What people do:** Skip the Blob cache — fetch from FPL API directly in the Route Handler on each page load.

**Why it's wrong:** FPL API has undocumented rate limits. A popular personal tool hitting FPL on every request will get IP-blocked. Also slow (~200-500ms) vs a Blob read (~20-50ms).

**Do this instead:** Python pipeline writes to Blob once daily. Route Handler reads from Blob. Add `Cache-Control: stale-while-revalidate` so Vercel edge cache further reduces origin hits.

### Anti-Pattern 2: Scoring Logic in React Components

**What people do:** Compute gem rating, DefCon thresholds, value scores inside the component render.

**Why it's wrong:** Makes components hard to test, mixes concerns, and runs expensively on every render. Scoring logic involves 7+ dimensions — it belongs in a dedicated module.

**Do this instead:** Scoring runs in the Python pipeline and is persisted in merged_players.json. A TypeScript port in `lib/scoring.ts` exists for client-side re-ranking (e.g. when user filters by position), but the heavy pre-computation is pipeline-side.

### Anti-Pattern 3: String-Matching FPL and Understat Player Names

**What people do:** Join FPL and Understat data using `player.web_name === understat.player_name`.

**Why it's wrong:** Names differ (diacritics, transliterations, format differences). Silent null xG/xA for ~20% of players. You won't notice until you look at the data carefully.

**Do this instead:** Maintain `player_id_map.json` — a static file mapping FPL player IDs to Understat player IDs. Update at season start when squads change. This is a one-time manual task per season, not a code problem.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| FPL API (public) | Route Handler proxy (server-side fetch) | CORS blocked client-side; all calls must be server-side |
| FPL API (auth) | Python requests.Session() with cookie jar | Credentials via env vars; never persisted to disk |
| Understat | soccerdata Python library | Scraping, not REST API; brittle if site HTML changes |
| Vercel Blob | `@vercel/blob` SDK in Route Handlers; `requests` in pipeline | Pipeline writes; Next.js reads |
| GitHub Actions | Cron schedule runs `python pipeline/run.py` | Needs `BLOB_READ_WRITE_TOKEN` env var |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Pipeline → Next.js | Vercel Blob JSON files | Async; pipeline writes, Next.js reads independently |
| Route Handler → Client | JSON REST responses | TanStack Query handles caching client-side |
| lib/fpl-adapter.ts → everywhere | TypeScript interfaces | Adapter is the only place that knows FPL field names |
| transfer-engine.ts ↔ usePlayers | Plain TS function call | Engine is pure function: (squad, allPlayers, budget) → suggestions |

---

## Scaling Considerations

| Scale | Architecture |
|-------|-------------|
| Single user (current) | File-based Blob cache, one pipeline run/day, no auth complexity needed |
| Multi-user (future) | Add user auth, store team IDs per user in a DB, run pipeline per user or share public data cache |
| Real-time updates | Replace daily pipeline with webhook/polling on FPL gameweek events; add Redis for sub-second cache |

This is a single-user personal tool. The current architecture is exactly the right level of complexity — do not add a database, auth system, or real-time pipeline unless the use case genuinely requires it.

---

*Architecture research for: FPL Analytics Web App*
*Researched: 2026-03-26*
