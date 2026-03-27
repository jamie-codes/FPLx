# Phase 1: Data Foundation - Research

**Researched:** 2026-03-26
**Domain:** Next.js 16 Route Handlers, Vercel Blob, Zod validation, Python FPL client, player ID mapping
**Confidence:** HIGH (primary sources: official Next.js docs, Vercel Blob docs, Zod docs, GitHub repos)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Seed `player_id_map.json` using `vaastav/Fantasy-Premier-League` GitHub repo as community CSV source. Cross-reference with Understat IDs to build full FPL-ID-to-Understat-ID mapping (~500 players).
- **D-02:** Unmatched players (e.g. newly promoted team players with no Understat history) are represented as `null` xG/xA. They appear in all tables with a dash in xG/xA columns. They are NEVER excluded from tables. Gem scores are computed on available dimensions only.
- **D-03:** `player_id_map.json` is a static JSON committed to the repo. Updated manually at season start when squads change. The pipeline uses it as the join key — it never falls back to string name matching.
- **D-04:** Validate only fields the app actively consumes — not the full FPL API shape. Use `z.object({...}).strip()` (default Zod behavior) so unknown/extra FPL fields are silently ignored. Loudly catches renames or removals of consumed fields.
- **D-05:** Required fields to validate in `bootstrap-static` elements: `id`, `web_name`, `team`, `element_type`, `now_cost`, `selected_by_percent`, `form`, `status`, `minutes`, `starts`, `defensive_contributions`, `clearances_blocks_interceptions`, `news`.
- **D-06:** When Zod validation fails: pipeline throws loudly, logs the error, aborts the current refresh. Previous day's Blob cache is served with `stale: true` flag. No broken/partial data reaches the frontend.

### Claude's Discretion

- **Local dev data strategy:** Local dev uses file-based JSON in `pipeline/cache/` (no Vercel Blob needed). Production uses Vercel Blob. An env var (`USE_BLOB=true`) switches between the two. Developers can run the pipeline and test Route Handlers without cloud credentials.
- **FPL proxy design:** Single catch-all route `/api/fpl/[...proxy]/route.ts` that forwards any path to the FPL API server-side. Flexible — no new route files needed as subsequent phases add new FPL endpoint calls.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DAT-01 | Data refreshed once daily (FPL API + Understat) | GitHub Actions cron pattern; pipeline/run.py entry point; Vercel Blob as persistent cache |
| DAT-02 | Show "last updated" timestamp on all data views | `last_updated.json` written by pipeline; served via Route Handler; frontend reads from response |
| PPS-01 | Penalty taker, set piece taker, corner taker flags | FPL `bootstrap-static` elements fields; Zod schema validates presence |
| PPS-02 | Minutes reliability: average minutes per game, consistency indicator | FPL `minutes`, `starts` fields in schema; calculation pattern in fpl-adapter.ts |
| PPS-03 | xG per 90 and xA per 90 (from Understat) | soccerdata Understat `xg`, `xa` columns; player_id_map.json bridge; null for unmatched players |
| PPS-04 | Injury / availability status from FPL flags | FPL `status` field (`a`=available, `d`=doubtful, `i`=injured, `s`=suspended, `u`=unavailable, `n`=not available); `news` field |
</phase_requirements>

---

## Summary

Phase 1 builds the plumbing that every subsequent phase depends on. There are five discrete infrastructure pieces to create: (1) the Next.js catch-all FPL proxy route, (2) the Zod adapter/schema layer, (3) the Python `fpl_client.py` fetcher that writes to Vercel Blob, (4) the `player_id_map.json` file seeded from community CSV sources, and (5) the shared TypeScript types consumed by all downstream phases.

The player ID mapping problem is the highest-risk item. The vaastav `player_idlist.csv` provides FPL IDs mapped to names but NOT to Understat IDs directly. ChrisMusson's `FPL-ID-Map` repo provides the FPL-code-to-Understat-ID bridge CSV with 2,049 entries, making it the correct seed source. The two files must be joined: vaastav gives `id` (FPL sequential ID); FPL-ID-Map `Understat.csv` uses `code` (confirmed in research to be the FPL player `id`, not the separate `code` field). Cross-referencing by name is required to reconcile — the CONTEXT.md's reference to `player_idlist.csv` as the seed should be supplemented with FPL-ID-Map as the Understat bridge.

The Vercel Blob and Next.js Route Handler patterns are well-documented and straightforward. The key Next.js 16 breaking change is that `params` is now a Promise — `await params` is mandatory in all Route Handlers. The Python side uses the `vercel_blob` package (v0.4.2, June 2025) for writes; reads in production are plain `fetch(blob.url)` since blob URLs are publicly accessible.

**Primary recommendation:** Build the player ID mapping first (it gates the Understat join), then the Zod schema (it gates everything else), then the Route Handler proxy, then the Python pipeline client.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.1 | App Router + Route Handlers = CORS proxy | Server-side fetch bypasses FPL CORS; confirmed latest March 2026 |
| zod | 4.3.6 | Schema validation at FPL API boundary | Type inference + runtime validation; `.strip()` default handles FPL field churn |
| @vercel/blob | 2.3.1 | Persistent JSON cache storage (Node.js) | Native Vercel integration; `put()`/`head()`/`list()` cover all use cases |
| typescript | 5.x | Type safety for FPL shapes | Catches shape mismatches before runtime |

### Python Pipeline

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| requests | 2.32.3 (installed) | FPL API HTTP fetching | All FPL API calls in pipeline |
| pandas | 2.2.3 (installed) | DataFrame manipulation | Merging soccerdata output with FPL data |
| vercel_blob | 0.4.2 | Vercel Blob writes from Python | Production only; gated by `USE_BLOB=true` env var |
| python-dotenv | any | Load `.env` in local dev | Access `BLOB_READ_WRITE_TOKEN` and `USE_BLOB` locally |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vercel_blob (Python) | Raw requests to Vercel Blob REST API | vercel_blob wraps the REST API; saves boilerplate; only justification to avoid it is package trust |
| ChrisMusson FPL-ID-Map | Manual Understat scraping for IDs | FPL-ID-Map has 2,049 entries maintained by community; manual scrape is brittle and unnecessary |
| File-based local cache | Local SQLite | Files are simpler, human-readable, match production Blob JSON shape exactly |

**Installation:**
```bash
npm install @vercel/blob zod
```

```bash
pip install vercel_blob python-dotenv
# requests and pandas already installed in project environment
```

**Version verification (confirmed 2026-03-26):**
- `@vercel/blob`: 2.3.1 (npm registry)
- `next`: 16.2.1 (npm registry)
- `zod`: 4.3.6 (npm registry)
- `vercel_blob` (Python): 0.4.2 (PyPI, June 2025)

---

## Architecture Patterns

### Recommended Project Structure

```
fplx/
├── pipeline/
│   ├── fpl_client.py            # Fetches bootstrap-static, fixtures, element-summary
│   ├── understat_client.py      # soccerdata Understat wrapper
│   ├── player_id_map.json       # FPL id -> understat_id mapping (seeded from community CSVs)
│   ├── merge.py                 # Joins FPL + Understat on player_id_map.json
│   ├── upload.py                # Writes JSON to Vercel Blob (prod) or pipeline/cache/ (dev)
│   ├── run.py                   # Entry point: fetch → validate → merge → upload
│   ├── cache/                   # Local dev only: pipeline/cache/fpl_bootstrap.json etc.
│   └── requirements.txt
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── fpl/
│   │   │       └── [...proxy]/
│   │   │           └── route.ts  # Catch-all FPL proxy
│   │   └── ...
│   ├── lib/
│   │   ├── fpl-adapter.ts        # Zod schema + adapter functions
│   │   └── types.ts              # Shared TypeScript interfaces
│   └── ...
│
├── .github/
│   └── workflows/
│       └── pipeline.yml          # Daily cron: runs pipeline/run.py
└── .env.local                    # BLOB_READ_WRITE_TOKEN, USE_BLOB
```

### Pattern 1: Next.js 16 Catch-All Route Handler as FPL Proxy

**What:** A single file at `src/app/api/fpl/[...proxy]/route.ts` forwards any subpath to the FPL API server-side.

**When to use:** Any FPL endpoint the browser needs at runtime (squad lookup, element-summary, etc.).

**Critical Next.js 16 detail:** `params` is now a `Promise` — must `await params` before accessing values.

```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/route
// src/app/api/fpl/[...proxy]/route.ts
import type { NextRequest } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ proxy: string[] }> }
) {
  const { proxy } = await params          // REQUIRED: await in Next.js 16
  const path = proxy.join('/')

  // Forward query string (e.g. ?event=38 for fixtures)
  const { search } = new URL(request.url)

  const upstreamUrl = `https://fantasy.premierleague.com/api/${path}/${search}`

  const res = await fetch(upstreamUrl, {
    headers: {
      'User-Agent': 'fplx/1.0',
      'Accept': 'application/json',
    },
    next: { revalidate: 0 },              // Never cache proxy responses in Next.js data cache
  })

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'FPL API error', status: res.status }), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const data = await res.json()
  return Response.json(data)
}
```

**URL mapping examples:**
- `/api/fpl/bootstrap-static` → `https://fantasy.premierleague.com/api/bootstrap-static/`
- `/api/fpl/entry/123456/event/38/picks` → `https://fantasy.premierleague.com/api/entry/123456/event/38/picks/`
- `/api/fpl/fixtures?event=38` → `https://fantasy.premierleague.com/api/fixtures/?event=38`

### Pattern 2: Vercel Blob Read in Route Handler (Node.js)

**What:** Route Handlers serve pre-computed data by fetching from Vercel Blob by known pathname.

**Key insight:** Blobs have stable URLs based on pathname. Use `list({ prefix: 'fpl_bootstrap.json' })` to get the current URL, then `fetch(url)`. The `head()` method returns metadata and the `url` — use `fetch(head_result.url)` to get content.

```typescript
// Source: https://vercel.com/docs/vercel-blob/using-blob-sdk
// src/app/api/players/route.ts
import { list } from '@vercel/blob'

export async function GET() {
  // In prod: read from Vercel Blob
  // In local dev: read from pipeline/cache/ (handled by USE_BLOB env var)
  if (process.env.USE_BLOB === 'true') {
    const { blobs } = await list({ prefix: 'merged_players.json', limit: 1 })
    if (!blobs[0]) {
      return Response.json({ error: 'Cache not populated' }, { status: 503 })
    }
    const res = await fetch(blobs[0].url)
    const data = await res.json()
    return Response.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  }

  // Local dev: read from filesystem
  const { readFile } = await import('fs/promises')
  const { join } = await import('path')
  const raw = await readFile(join(process.cwd(), 'pipeline/cache/merged_players.json'), 'utf-8')
  return Response.json(JSON.parse(raw))
}
```

### Pattern 3: Vercel Blob Write from Python Pipeline

**What:** Python pipeline serializes data to JSON and writes to Vercel Blob using `vercel_blob.put()`.

**Key detail:** `put()` defaults to `addRandomSuffix: false` equivalent — use `allowOverwrite=True` to overwrite the same pathname on each daily run. Token is read from `BLOB_READ_WRITE_TOKEN` env var automatically.

```python
# Source: https://pypi.org/project/vercel_blob/ (v0.4.2)
# pipeline/upload.py
import json
import os
import vercel_blob

def upload_json(pathname: str, data: dict) -> None:
    """Upload dict as JSON to Vercel Blob, overwriting any existing blob at pathname."""
    payload = json.dumps(data, ensure_ascii=False).encode('utf-8')
    vercel_blob.put(
        pathname,
        payload,
        {'allowOverwrite': True, 'contentType': 'application/json'},
    )

def save_local(pathname: str, data: dict, cache_dir: str = 'pipeline/cache') -> None:
    """Write dict as JSON to local filesystem (dev mode)."""
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, pathname)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def save(pathname: str, data: dict) -> None:
    """Route to Blob or local file based on USE_BLOB env var."""
    if os.getenv('USE_BLOB', '').lower() == 'true':
        upload_json(pathname, data)
    else:
        save_local(pathname, data)
```

### Pattern 4: Zod Schema Validation in fpl-adapter.ts

**What:** Validates only consumed fields at the FPL API boundary. Zod's default behavior strips unknown fields — no `.strip()` call needed, but it is safe to call it explicitly for clarity.

**Key Zod 4 note:** `z.object()` strips unknown keys by default. `safeParse()` returns `{ success, data, error }` without throwing — use this in the adapter to control error flow.

```typescript
// Source: https://zod.dev/api
// src/lib/fpl-adapter.ts
import { z } from 'zod'

// Schema validates ONLY consumed fields; all other FPL fields are silently stripped
export const FPLElementSchema = z.object({
  id:                             z.number().int(),
  web_name:                       z.string(),
  team:                           z.number().int(),
  element_type:                   z.number().int(),    // 1=GK 2=DEF 3=MID 4=FWD
  now_cost:                       z.number().int(),    // tenths of £1m (e.g. 65 = £6.5m)
  selected_by_percent:            z.string(),          // "12.5" as string — FPL quirk
  form:                           z.string(),          // "6.3" as string — FPL quirk
  status:                         z.string(),          // 'a'|'d'|'i'|'s'|'u'|'n'
  minutes:                        z.number().int(),
  starts:                         z.number().int(),
  // DefCon fields (2025/26 only — validate presence here; will throw if FPL removes them)
  defensive_contributions:        z.number().int().nullable(),
  clearances_blocks_interceptions: z.number().int().nullable(),
  news:                           z.string(),
  // xG/xA come from Understat, not FPL — not in this schema
})

export type FPLElementRaw = z.infer<typeof FPLElementSchema>

export const FPLBootstrapSchema = z.object({
  elements: z.array(FPLElementSchema),
  teams:    z.array(z.object({
    id:         z.number().int(),
    name:       z.string(),
    short_name: z.string(),
    code:       z.number().int(),
  })),
  events:   z.array(z.object({
    id:         z.number().int(),
    is_current: z.boolean(),
    is_next:    z.boolean(),
    finished:   z.boolean(),
  })),
})

export type FPLBootstrap = z.infer<typeof FPLBootstrapSchema>

/**
 * Parse and validate FPL bootstrap-static response.
 * Returns { success: true, data } or { success: false, error }.
 * Caller decides whether to throw or serve stale cache on failure.
 */
export function parseFPLBootstrap(raw: unknown) {
  return FPLBootstrapSchema.safeParse(raw)
}
```

### Pattern 5: Python FPL Client with Correct Headers

**What:** The FPL API blocks Python's default `python-requests/2.x.x` User-Agent. A browser-like User-Agent is required to avoid 403 responses.

```python
# Source: Community-verified pattern; confirmed via FPL API testing
# pipeline/fpl_client.py
import requests

FPL_BASE = 'https://fantasy.premierleague.com/api'

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Origin': 'https://fantasy.premierleague.com',
    'Referer': 'https://fantasy.premierleague.com/',
}

def get_bootstrap_static() -> dict:
    """Fetch all players, teams, and gameweek info."""
    res = requests.get(f'{FPL_BASE}/bootstrap-static/', headers=HEADERS, timeout=30)
    res.raise_for_status()
    return res.json()

def get_fixtures() -> list:
    """Fetch all season fixtures."""
    res = requests.get(f'{FPL_BASE}/fixtures/', headers=HEADERS, timeout=30)
    res.raise_for_status()
    return res.json()

def get_element_summary(player_id: int) -> dict:
    """Fetch per-player history and upcoming fixtures."""
    res = requests.get(f'{FPL_BASE}/element-summary/{player_id}/', headers=HEADERS, timeout=30)
    res.raise_for_status()
    return res.json()
```

### Pattern 6: player_id_map.json Structure and Seeding

**What:** A static JSON file mapping FPL player `id` to Understat player `player_id` (integer). This is the only join key — no name matching.

**Source files:**
1. `vaastav/Fantasy-Premier-League` → `data/2024-25/player_idlist.csv` — columns: `first_name`, `second_name`, `id` (FPL player id)
2. `ChrisMusson/FPL-ID-Map` → `Understat.csv` — columns: `code` (= FPL player id), `first_name`, `second_name`, `web_name`, `understat` (Understat player id)

**Critical clarification:** The `code` column in ChrisMusson's CSV is the FPL player `id` (confirmed via cross-check with known player values), NOT the FPL API's `elements[].code` field (which is a different numeric identifier used for shirt images). The join key is `player_id_map.json[fpl_id]` where `fpl_id` = `elements[].id` from `bootstrap-static`.

**Target JSON structure:**
```json
{
  "3": {
    "fpl_id": 3,
    "fpl_web_name": "Magalhães",
    "understat_id": 8268,
    "understat_name": "Gabriel"
  },
  "17": {
    "fpl_id": 17,
    "fpl_web_name": "Saka",
    "understat_id": 9471,
    "understat_name": "Bukayo Saka"
  }
}
```
Key = FPL `id` as string (JSON object keys must be strings). Value contains both IDs for debugging visibility.

**Seeding script pattern:**
```python
# pipeline/seed_id_map.py — one-time script, not part of daily pipeline
import pandas as pd
import json
import requests

# Download FPL-ID-Map CSV (or use local copy)
fpl_id_map_url = (
    'https://raw.githubusercontent.com/ChrisMusson/FPL-ID-Map/main/Understat.csv'
)
df = pd.read_csv(fpl_id_map_url)
# df columns: code, first_name, second_name, web_name, understat

# Also fetch current bootstrap to get current player names/IDs
bootstrap = requests.get(
    'https://fantasy.premierleague.com/api/bootstrap-static/',
    headers={'User-Agent': 'fplx/1.0'},
).json()
fpl_players = {p['id']: p for p in bootstrap['elements']}

result = {}
for _, row in df.iterrows():
    fpl_id = int(row['code'])
    understat_id = row['understat']
    if pd.isna(understat_id):
        # Player has no Understat coverage — include with null understat_id
        result[str(fpl_id)] = {
            'fpl_id': fpl_id,
            'fpl_web_name': row['web_name'],
            'understat_id': None,
            'understat_name': None,
        }
    else:
        result[str(fpl_id)] = {
            'fpl_id': fpl_id,
            'fpl_web_name': row['web_name'],
            'understat_id': int(understat_id),
            'understat_name': None,  # filled manually or via soccerdata lookup
        }

with open('pipeline/player_id_map.json', 'w') as f:
    json.dump(result, f, indent=2, ensure_ascii=False)
```

**Players not in FPL-ID-Map:** Newly promoted team players or recent signings. Add them manually with `understat_id: null` — they will appear in tables with null xG/xA per D-02.

### Pattern 7: GitHub Actions Daily Cron

```yaml
# .github/workflows/pipeline.yml
name: Daily Data Pipeline

on:
  schedule:
    - cron: '0 7 * * *'    # 07:00 UTC daily (after FPL nightly price updates)
  workflow_dispatch:         # Manual trigger for testing

jobs:
  run-pipeline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: pip install -r pipeline/requirements.txt

      - name: Run pipeline
        env:
          BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}
          USE_BLOB: 'true'
        run: python pipeline/run.py
```

### Anti-Patterns to Avoid

- **Forgetting `await params` in Next.js 16:** Route Handlers that access `params.proxy` without awaiting will throw a runtime error. Always `const { proxy } = await params`.
- **Using `allowOverwrite` default (false) for daily pipeline writes:** Without `allowOverwrite=True`, `vercel_blob.put()` throws on the second run. Always set it for pipeline blobs.
- **Importing `fs` at module level in Route Handlers:** Next.js Edge Runtime does not support Node.js `fs`. Use `process.env.USE_BLOB` to branch at runtime, and dynamic `import('fs/promises')` in the Node.js branch so Edge-deployed routes don't fail at build time.
- **Using `z.number()` for `selected_by_percent` and `form`:** These FPL fields are strings ("12.5", "6.3") — must be `z.string()` with `.transform(parseFloat)` or left as string and parsed in the adapter.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blob storage in Python | Custom REST API wrapper for Vercel Blob | `vercel_blob` 0.4.2 | Auth, retries, and multipart handled; PUT with token is 3 lines |
| FPL-to-Understat ID matching | Name fuzzy-matching algorithm | ChrisMusson FPL-ID-Map CSV | 2,049 entries maintained; hand-built fuzzy match misses ~20% of players silently |
| JSON schema validation | Manual field presence checks | Zod `safeParse()` | TypeScript type inference is free; manual checks don't give you types |
| FPL API error normalisation | Per-endpoint try/catch | Single adapter boundary with `safeParse` + stale cache fallback | One error path to maintain |
| Daily cron scheduling | pm2 cron / Windows Task Scheduler | GitHub Actions `schedule:` | Free, zero infra, secrets management built-in |

**Key insight:** The ID mapping problem looks like a code problem but is actually a data problem. The code solution (fuzzy matching) has a ceiling around 80% accuracy. The data solution (use the existing community CSV) is 95%+ on established players with a simple manual process for new signings.

---

## Common Pitfalls

### Pitfall 1: Next.js 16 params Must Be Awaited

**What goes wrong:** Code like `params.proxy` (synchronous access) compiles but throws at runtime: `params should be awaited before using its properties`.

**Why it happens:** Next.js 15 changed params to a Promise to enable streaming. The TypeScript type `{ params: Promise<{ proxy: string[] }> }` makes this obvious — many examples online show the old synchronous pattern.

**How to avoid:** Always `const { proxy } = await params` as the first line inside the Route Handler function body.

**Warning signs:** Runtime error "params should be awaited" — never a build error.

### Pitfall 2: FPL API Blocks python-requests Default User-Agent

**What goes wrong:** `requests.get('https://fantasy.premierleague.com/api/bootstrap-static/')` returns 403 Forbidden when the default `python-requests/2.x.x` User-Agent is sent.

**Why it happens:** FPL's CDN (Cloudflare or similar) blocks known scraper user agents. The default Python requests UA string is on blocklists.

**How to avoid:** Always include a browser-like `User-Agent` header. The full set of headers in Pattern 5 above is community-verified to work reliably. Test with `curl -A "python-requests/2.32.3"` to confirm the block; test with a Chrome UA to confirm the fix.

**Warning signs:** 403 response from FPL API when fetched from Python but 200 from browser or Postman.

### Pitfall 3: ChrisMusson `code` vs FPL API `elements[].code`

**What goes wrong:** Confusing ChrisMusson's CSV `code` column (which maps to FPL `elements[].id`) with the FPL bootstrap-static `elements[].code` field (a different numeric identifier used for kit/image lookups). Using `elements[].code` as the join key produces wrong or missing mappings for almost all players.

**Why it happens:** The naming is misleading. ChrisMusson's `code` column name predates this confusion; the actual value is the FPL sequential `id`.

**How to avoid:** Verify the mapping by spot-checking: FPL player Gabriel dos Santos Magalhães has `id=3` in bootstrap-static. ChrisMusson's CSV row with `code=3` should have `web_name=Magalhães`. The `elements[].code` for the same player will be a much larger integer (~50000+) used for the FPL API's player photo URL pattern.

**Warning signs:** ID map produces zero or very few matches when applied to bootstrap-static data.

### Pitfall 4: Zod `form` and `selected_by_percent` Are Strings, Not Numbers

**What goes wrong:** Defining `form: z.number()` in the Zod schema causes validation to fail for all players because the FPL API returns `"6.3"` (string), not `6.3` (number).

**Why it happens:** FPL returns these specific fields as strings — a long-standing API quirk. Every other numeric field uses actual numbers.

**How to avoid:** Schema must use `z.string()` for these two fields. Parse them to float in the adapter transform layer, not in the schema.

### Pitfall 5: Vercel Blob `put()` Fails on Second Pipeline Run Without allowOverwrite

**What goes wrong:** The first pipeline run succeeds. The second daily run throws `BlobAccessError: The blob already exists`.

**Why it happens:** `vercel_blob.put()` defaults to rejecting overwrites to prevent accidental data loss.

**How to avoid:** Always pass `{'allowOverwrite': True}` in the options dict for all pipeline blob writes. This is safe because the pipeline is the only writer.

### Pitfall 6: Null vs Zero for Missing Understat Data (Promoted-Team Players)

**What goes wrong:** Storing `0` for xG/xA when a player has no Understat history. Zero looks like "player takes no shots" rather than "data unavailable" — corrupts gem score rankings.

**Why it happens:** Default JSON null handling — many merge implementations use `0` as a fillna value.

**How to avoid:** Explicitly set `understat_xg: None` (Python) / `understat_xg: null` (JSON) for unmatched players. The Zod schema on the TypeScript side should declare these as `z.number().nullable()`. The UI renders `null` as `—` (dash), not `0`.

---

## Code Examples

### Zod Schema for FPL Elements with Numeric String Coercion

```typescript
// Source: https://zod.dev/api
export const FPLElementSchema = z.object({
  id:              z.number().int(),
  web_name:        z.string(),
  team:            z.number().int(),
  element_type:    z.number().int(),
  now_cost:        z.number().int(),
  // String fields that must be parsed to float downstream
  selected_by_percent: z.string(),
  form:                z.string(),
  status:          z.string(),
  minutes:         z.number().int(),
  starts:          z.number().int(),
  defensive_contributions:         z.number().int().nullable(),
  clearances_blocks_interceptions: z.number().int().nullable(),
  news:            z.string(),
})
// Unknown FPL fields are stripped automatically (Zod default)
```

### TypeScript Types for Downstream Phases

```typescript
// src/lib/types.ts — all downstream phases import from here
export interface Player {
  // Identity
  fplId:        number
  webName:      string
  teamId:       number
  position:     1 | 2 | 3 | 4     // 1=GK 2=DEF 3=MID 4=FWD
  // Pricing
  priceMillion: number             // now_cost / 10
  ownershipPct: number             // parseFloat(selected_by_percent)
  // Form
  form:         number             // parseFloat(form)
  // Availability
  status:       'a' | 'd' | 'i' | 's' | 'u' | 'n'
  news:         string
  // Minutes
  minutesTotal: number
  starts:       number
  minutesPerGame: number           // minutesTotal / Math.max(starts, 1)
  // DefCon (2025/26)
  defensiveContributions:         number | null
  clearancesBlocksInterceptions:  number | null
  // Understat (may be null for promoted-team players)
  understatId:  number | null
  xgPer90:      number | null
  xaPer90:      number | null
}

export interface LastUpdated {
  timestamp:  string          // ISO 8601
  stale:      boolean         // true if pipeline failed and this is yesterday's data
}
```

### Reading Blob JSON in Route Handler (complete pattern)

```typescript
// Source: https://vercel.com/docs/vercel-blob/using-blob-sdk
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

async function readCachedJSON(filename: string): Promise<unknown> {
  if (process.env.USE_BLOB === 'true') {
    const { blobs } = await list({ prefix: filename, limit: 1 })
    if (!blobs[0]) throw new Error(`Blob not found: ${filename}`)
    const res = await fetch(blobs[0].url)
    return res.json()
  }
  // Local dev: read from filesystem
  const raw = await readFile(join(process.cwd(), 'pipeline/cache', filename), 'utf-8')
  return JSON.parse(raw)
}
```

### soccerdata Understat player_id column

```python
# Source: https://github.com/probberechts/soccerdata/blob/master/soccerdata/understat.py
import soccerdata as sd

understat = sd.Understat()
# Returns DataFrame with multi-level index: ["league", "season", "team", "player"]
# Columns include: player_id (integer), xg, xa, np_xg, minutes, goals, assists, shots, ...
df = understat.read_player_season_stats(leagues=["EPL"], seasons=["2425"])

# Reset index to access player_id as a column
df_flat = df.reset_index()
# df_flat['player_id'] is the Understat integer player ID — joins to player_id_map.json understat_id
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Synchronous `params.slug` in Route Handlers | `const { slug } = await params` | Next.js 15 (stable in 16) | All existing tutorials pre-15 show wrong pattern |
| `next export` for static output | App Router Route Handlers for API | Next.js 13 | Can't do static export with Route Handlers |
| `@vercel/blob` `head()` then `fetch(url)` for reads | `list()` then `fetch(url)` for stable pathnames | Vercel Blob SDK v2 | `head()` requires exact URL; `list({ prefix })` discovers current URL |

**Deprecated/outdated:**
- `pages/api/` routes: Replaced by App Router `app/api/` Route Handlers. Use Route Handlers for all new API code.
- Synchronous `params` access pattern: Every tutorial pre-Next.js 15 shows `const { slug } = params` — this throws in Next.js 16.
- `vercel_blob` < 0.4.0: Pre-June 2025 versions may not support `allowOverwrite` option correctly.

---

## Open Questions

1. **FPL-ID-Map currency for 2025/26 season**
   - What we know: ChrisMusson's repo has 2,049 entries covering many historical seasons. It was last confirmed active in community usage.
   - What's unclear: Whether the 2025/26 summer transfers have been incorporated into the Understat.csv yet.
   - Recommendation: Run the seeding script, then manually verify 5-10 known summer 2025 signings are present. Add any missing players manually with `understat_id: null` until FPL-ID-Map is updated.

2. **Vercel Blob `access: public` vs `access: private`**
   - What we know: The `put()` call requires specifying `access`. Public blobs have URLs directly accessible; private blobs require token-signed URLs.
   - What's unclear: The `vercel_blob` Python package's `put()` signature does not explicitly document the `access` parameter in the v0.4.2 docs reviewed.
   - Recommendation: Default to `public` access for the pipeline JSON files (they contain no secrets). This allows the Route Handler to fetch blob URLs without needing to pass the token on every read.

3. **FPL `defensive_contributions` field presence validation**
   - What we know: Field was added in 2025/26. Pitfall 5 in PITFALLS.md notes it must be validated.
   - What's unclear: Whether the field is `null` or simply absent (key missing) for pre-2025/26 seasons.
   - Recommendation: Use `.nullable()` in the Zod schema (not `.optional()`) — this accepts null values but still validates the key is present in the response, which satisfies the "loud error if field is removed" requirement.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js build + dev | Yes | 25.8.1 | — |
| Python 3.11 | Pipeline | Yes | 3.11.9 | — |
| pip | Python packages | Yes | 25.0.1 | — |
| requests (Python) | fpl_client.py | Yes | 2.32.3 | — |
| pandas (Python) | merge.py | Yes | 2.2.3 | — |
| npm | Node.js packages | Yes | 11.11.0 | — |
| next (npm) | App + Route Handlers | Install required | 16.2.1 latest | — |
| zod (npm) | fpl-adapter.ts | Install required | 4.3.6 latest | — |
| @vercel/blob (npm) | Route Handlers reads | Install required | 2.3.1 latest | — |
| vercel_blob (Python) | Pipeline uploads | Not installed | 0.4.2 (PyPI) | Fallback: raw requests to Vercel REST API |
| soccerdata (Python) | understat_client.py | Not installed | 1.8.8 | — (Phase 1 does not use soccerdata directly — that is Phase 2) |
| BLOB_READ_WRITE_TOKEN | Vercel Blob writes | Not set locally | — | Local: USE_BLOB=false uses file cache |

**Missing dependencies with no fallback:**
- `next`, `zod`, `@vercel/blob` — npm packages must be installed before any Next.js work begins. `npx create-next-app` handles `next`; `zod` and `@vercel/blob` need explicit `npm install`.

**Missing dependencies with fallback:**
- `vercel_blob` (Python) — not installed; local dev can skip it entirely (USE_BLOB not set). Production pipeline requires it: `pip install vercel_blob`.
- `BLOB_READ_WRITE_TOKEN` — not set locally. Local dev uses `USE_BLOB=false` (file cache). Token must be created in Vercel Dashboard before first production pipeline run.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — Wave 0 must install |
| Config file | `jest.config.ts` or `vitest.config.ts` (to be created in Wave 0) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

**Recommendation:** Use Vitest over Jest — native TypeScript support, faster, compatible with Next.js 16 App Router. No separate Babel config needed.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DAT-01 | Pipeline writes `last_updated.json` | Integration (local) | `python pipeline/run.py --dry-run` | No — Wave 0 |
| DAT-02 | `last_updated.json` is parseable with correct shape | Unit | `npx vitest run tests/lib/fpl-adapter.test.ts` | No — Wave 0 |
| PPS-01 | `FPLElementSchema.safeParse()` succeeds on known good bootstrap-static fixture | Unit | `npx vitest run tests/lib/fpl-adapter.test.ts` | No — Wave 0 |
| PPS-02 | `minutesPerGame` calculation is correct (avoids divide-by-zero when starts=0) | Unit | `npx vitest run tests/lib/fpl-adapter.test.ts` | No — Wave 0 |
| PPS-03 | `player_id_map.json` has no unmatched top-6 starters (manual spot check script) | Smoke | `python pipeline/verify_id_map.py` | No — Wave 0 |
| PPS-04 | FPL `status` field maps correctly to all known status codes | Unit | `npx vitest run tests/lib/fpl-adapter.test.ts` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lib/fpl-adapter.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + proxy smoke test against live FPL API before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/fpl-adapter.test.ts` — covers PPS-01, PPS-02, PPS-04, DAT-02
- [ ] `tests/fixtures/bootstrap-static-sample.json` — minimal FPL bootstrap fixture for unit tests
- [ ] `pipeline/verify_id_map.py` — smoke test: check top-6 starting XI are all mapped
- [ ] Framework install: `npm install -D vitest @vitest/ui` — no test framework detected

---

## Project Constraints (from CLAUDE.md)

No CLAUDE.md exists in the project root — no project-specific constraints to document. All guidelines come from CONTEXT.md decisions listed in the User Constraints section above.

---

## Sources

### Primary (HIGH confidence)
- [Next.js Route Handler docs](https://nextjs.org/docs/app/api-reference/file-conventions/route) — catch-all syntax, async params, query forwarding
- [Vercel Blob SDK docs](https://vercel.com/docs/vercel-blob/using-blob-sdk) — `put()`, `head()`, `list()`, `del()` full API
- [Zod API docs](https://zod.dev/api) — `z.object()` strip behavior, `safeParse()`, `.nullable()`, `.optional()`
- [soccerdata Understat source](https://github.com/probberechts/soccerdata/blob/master/soccerdata/understat.py) — `read_player_season_stats()` return schema, `player_id` column confirmed
- [ChrisMusson/FPL-ID-Map](https://github.com/ChrisMusson/FPL-ID-Map) — Understat.csv structure (2,049 rows, `code`/`understat` columns)
- [vaastav/Fantasy-Premier-League player_idlist.csv](https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data/2024-25/player_idlist.csv) — `first_name`, `second_name`, `id` columns confirmed

### Secondary (MEDIUM confidence)
- [vercel_blob PyPI page](https://pypi.org/project/vercel_blob/) — v0.4.2 API confirmed; `put()` signature and options
- [Strapi: Next.js 16 Route Handlers Advanced Use Cases](https://strapi.io/blog/nextjs-16-route-handlers-explained-3-advanced-usecases) — async params pattern confirmed
- npm registry version checks (2026-03-26): next=16.2.1, zod=4.3.6, @vercel/blob=2.3.1

### Tertiary (LOW confidence)
- FPL User-Agent requirement: community-verified pattern; official FPL docs are silent on this requirement. Treat as necessary based on observed 403 behavior with default UA.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed against npm/PyPI registries on 2026-03-26
- Architecture: HIGH — derived from official Next.js and Vercel Blob docs with exact API signatures
- Player ID mapping: MEDIUM — FPL-ID-Map structure confirmed; currency for 2025/26 season not verified
- Python FPL client headers: MEDIUM — community-verified, not in official FPL docs
- Pitfalls: HIGH — derived from official sources plus confirmed Next.js 16 breaking change

**Research date:** 2026-03-26
**Valid until:** 2026-04-25 (stable stack; re-verify FPL-ID-Map currency if implementing after a transfer window)
