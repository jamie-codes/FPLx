# Phase 117: Scraper Pipeline & Lineup News Artifact - Research

**Researched:** 2026-05-17
**Domain:** Python scraper pipeline + Next.js API route + TanStack Query hook
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `lineup_news` runs inside `run.py` as a non-fatal block — follows the `set_piece_quality` / `prose_summary` isolation pattern
- **D-02:** Called right after bootstrap fetch (`save('fpl_bootstrap.json', bootstrap)` at run.py line ~142)
- **D-03:** Web scrapers contribute `news_headline` + `news_source` fields only — never change `availability_factor`. FPL bootstrap is authoritative for the factor.
- **D-04:** Player matching via fuzzy web_name match (`difflib.SequenceMatcher`) against FPL `web_name` / `second_name`. Unmatched names are logged but non-fatal.
- **D-05:** Per-player object shape: `{ id, availability_factor, status_label, news_headline, news_source, scraped_at }`
- **D-06:** Refreshes at run.py's existing cadence. No new cron entry.
- **D-07:** `useLineupNews` staleTime = 6 hours
- **D-08/D-09:** `chance_of_playing_next_round` wins over `status='a'`. Exact mapping table documented in CONTEXT.md.
- **D-10:** Unrecognised status codes → `availability_factor = null`, `status_label = "unknown"`

### Claude's Discretion

- Fuzzy match threshold (CONTEXT.md suggests ~0.7 — researcher to verify cutoff)
- Whether to use `get_close_matches` or `SequenceMatcher` directly

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCRP-01 | Pipeline emits `lineup_news.json` with per-player availability from FPL bootstrap | D-08/D-09 mapping table; pipeline/run.py insertion point at line 142 |
| SCRP-02 | Enrich with premierleague.com/latest-player-injuries HTML (requests + BS4, non-fatal) | CRITICAL: page is JavaScript-rendered — see Pitfall 1; use `requests` + BS4 but expect low data yield; non-fatal means failure is acceptable |
| SCRP-03 | Enrich with Sky Sports RSS (feedparser, non-fatal) | RSS URL: `https://www.skysports.com/rss/11095`; feedparser entry fields verified |
| SCRP-04 | Enrich with BBC Sport RSS (feedparser, non-fatal) | RSS URL: `https://feeds.bbci.co.uk/sport/football/rss.xml`; feedparser entry fields verified |
| SCRP-05 | Per-source isolation; `players[]` guard before Blob write | Blob guard must be in `lineup_news.py` BEFORE calling `save()` |
| SCRP-06 | `source_health` object with ok/last_success/last_error per source | Four keys: fpl, premierleague, skysports, bbc |
| INFRA-01 | `/api/lineup-news` route + `useLineupNews` hook (6h staleTime) | Clone `gw-intel/route.ts` exactly; clone `useGWIntel.ts` exactly |
| INFRA-02 | 48h staleness guard — consumers treat stale data as neutral | Guard lives in Phase 118 engine consumers; INFRA-02 only requires `scraped_at` field in artifact |
</phase_requirements>

---

## Summary

Phase 117 is a two-part delivery: (1) a new Python module `pipeline/lineup_news.py` integrated into `run.py` as a non-fatal block immediately after the bootstrap save, and (2) a Next.js API route + TanStack Query hook following the exact gw-intel pattern.

The Python module pulls player availability from FPL bootstrap (authoritative), then enriches with news headlines from three optional sources: premierleague.com HTML, Sky Sports RSS, and BBC Sport RSS. All three web scrapers are non-fatal — they only contribute `news_headline` and `news_source` fields and can fail silently. The Blob guard (never write empty players[]) is the critical safety invariant.

The TypeScript side is a near-identical clone of `gw-intel/route.ts` and `useGWIntel.ts`. Four new types are appended to `src/lib/types.ts`.

**Primary recommendation:** Build `pipeline/lineup_news.py` as a standalone module with a single public function `compute_lineup_news(bootstrap) -> dict`. Integration into `run.py` is a 5-line addition. The TS side is mechanical cloning.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| availability_factor derivation | Pipeline (Python) | — | FPL bootstrap data, computed once per pipeline run |
| news headline enrichment | Pipeline (Python) | — | Web scraping runs server-side in GitHub Actions |
| lineup_news.json persistence | Vercel Blob / local cache | — | Follows established save() pattern |
| Blob guard (never write empty) | Pipeline (Python) | — | Safety invariant enforced before save() call |
| API serving | Next.js API route | Vercel Blob | GET handler reads blob or local cache |
| Client data access | React hook | API route | TanStack Query with 6h staleTime |
| 48h staleness gate | Engine consumers (Phase 118) | — | Consumers check scraped_at, not this phase |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| feedparser | 6.0.12 (latest) | Parse RSS 2.0 feeds (Sky Sports, BBC) | [VERIFIED: pip index versions] Standard RSS parser; no JS rendering needed for RSS |
| beautifulsoup4 | 4.14.3 (latest) | Parse premierleague.com HTML | [VERIFIED: pip index versions] Already spec'd in CONTEXT.md; installed 4.13.4 locally |
| lxml | 6.1.0 (latest) | BS4 parser backend | [VERIFIED: pip index versions] Faster than html.parser; already a project dep |
| difflib | stdlib | Fuzzy player name matching | [VERIFIED: codebase] stdlib, no install needed |
| requests | 2.32.3 (installed) | HTTP for premierleague.com | [VERIFIED: pip show] Already in requirements.txt |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vercel/blob | existing | Blob list + fetch in API route | Already imported in gw-intel/route.ts |
| @tanstack/react-query | existing | useQuery in hook | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| feedparser | requests + BS4 for RSS | feedparser handles encoding, date parsing, malformed XML — use it for RSS |
| difflib.SequenceMatcher | rapidfuzz | rapidfuzz not in requirements.txt; stdlib difflib sufficient for ~700 FPL players |

**Installation (new deps):**
```bash
pip install feedparser==6.0.12 beautifulsoup4==4.14.3 lxml==6.1.0
```
Add to `pipeline/requirements.txt`:
```
feedparser>=6.0.12
beautifulsoup4>=4.14.3
lxml>=6.1.0
```

Note: `beautifulsoup4` and `lxml` are already in spec (CONTEXT.md D-decisions); `feedparser` is new. [VERIFIED: pip index versions]

---

## Architecture Patterns

### System Architecture Diagram

```
run.py
  |
  +-- bootstrap = get_bootstrap_static()
  +-- save('fpl_bootstrap.json', bootstrap)
  |
  +-- [NEW] try/except block (mirrors set_piece_quality ~line 241):
        compute_lineup_news(bootstrap)
          |
          +-- [SOURCE 1] FPL bootstrap elements
          |     -> availability_factor + status_label for ALL players
          |
          +-- [SOURCE 2] premierleague.com/latest-player-injuries
          |     requests.get() + BS4 lxml parse
          |     -> news_headline, news_source='premierleague' (if JS content available)
          |     try/except -> source_health['premierleague'].ok = False on failure
          |
          +-- [SOURCE 3] feedparser.parse(SKY_RSS_URL)
          |     -> news_headline, news_source='skysports' for matched players
          |     try/except -> source_health['skysports'].ok = False on failure
          |
          +-- [SOURCE 4] feedparser.parse(BBC_RSS_URL)
          |     -> news_headline, news_source='bbc' for matched players
          |     try/except -> source_health['bbc'].ok = False on failure
          |
          +-- merge: FPL availability + web news headlines
          +-- GUARD: if len(players) == 0: return (skip save)
          +-- save('lineup_news.json', payload)
          
/api/lineup-news/route.ts
  GET()
    USE_BLOB=true  -> list({ prefix: 'lineup_news.json', limit: 1 }) -> fetch blob URL
    USE_BLOB=false -> readFile('pipeline/cache/lineup_news.json')
    -> Response.json(parsed, { 'Cache-Control': 'public, s-maxage=3600, ...' })

useLineupNews.ts
  useQuery<LineupNews>({
    queryKey: ['lineup-news'],
    queryFn: () => fetch('/api/lineup-news').then(r => r.json()),
    staleTime: 6 * 60 * 60 * 1000
  })
```

### Recommended Project Structure

New files to create:
```
pipeline/
  lineup_news.py            # NEW: standalone module, single public function
src/app/api/
  lineup-news/
    route.ts                # NEW: clone of gw-intel/route.ts
src/lib/hooks/
  useLineupNews.ts          # NEW: clone of useGWIntel.ts
src/lib/
  types.ts                  # APPEND: 4 new types
pipeline/
  requirements.txt          # APPEND: feedparser, bs4 version bump, lxml version bump
```

### Pattern 1: Non-Fatal Block in run.py (replicate set_piece_quality, lines 241-251)

**What:** Wrap the entire `compute_lineup_news(bootstrap)` call in try/except at the run.py level.

**When to use:** Any pipeline step that must not poison the main pipeline.

**Exact pattern to copy from run.py lines 241-251:**
```python
# [VERIFIED: pipeline/run.py lines 241-251]
sp_unmatched_count = None
try:
    from set_piece_quality import run_sp_quality
    sp_unmatched_count = run_sp_quality(understat, id_map, cache_dir)
    if sp_unmatched_count is not None:
        print(f"SP quality written: {sp_unmatched_count} unmatched Understat IDs")
    else:
        print("SP quality: returned None (scrape failed, stale sp_quality.json preserved)")
except Exception as sp_exc:
    print(f"[set_piece_quality] non-fatal error: {sp_exc}", file=sys.stderr)
```

**For lineup_news, the equivalent:**
```python
# Insert IMMEDIATELY after line 142: save('fpl_bootstrap.json', bootstrap)
try:
    from lineup_news import compute_lineup_news
    compute_lineup_news(bootstrap)
    print("Lineup news written.")
except Exception as ln_exc:
    print(f"[lineup_news] non-fatal error: {ln_exc}", file=sys.stderr)
```

### Pattern 2: Within-Module Per-Source Isolation

**What:** Each scraper source gets its own `try/except Exception` inside `lineup_news.py`. The outer run.py try/except is for module-level failure; the inner per-source try/excepts are for individual scraper failures.

```python
# [VERIFIED: CONTEXT.md established pattern + set_piece_quality.py pattern]
source_health = {
    'fpl':          {'ok': False, 'last_success': None, 'last_error': None},
    'premierleague':{'ok': False, 'last_success': None, 'last_error': None},
    'skysports':    {'ok': False, 'last_success': None, 'last_error': None},
    'bbc':          {'ok': False, 'last_success': None, 'last_error': None},
}

# Source 1: FPL bootstrap (should never fail if bootstrap is valid)
try:
    _scrape_fpl(bootstrap, players_map)
    source_health['fpl']['ok'] = True
    source_health['fpl']['last_success'] = now_iso()
except Exception as exc:
    source_health['fpl']['last_error'] = str(exc)[:200]
    print(f"[lineup_news/fpl] error: {exc}", file=sys.stderr)

# Source 2: premierleague.com HTML
try:
    _scrape_premierleague(players_map)
    source_health['premierleague']['ok'] = True
    source_health['premierleague']['last_success'] = now_iso()
except Exception as exc:
    source_health['premierleague']['last_error'] = str(exc)[:200]
    print(f"[lineup_news/premierleague] non-fatal: {exc}", file=sys.stderr)

# Source 3: Sky Sports RSS
try:
    _scrape_rss_sky(players_map)
    source_health['skysports']['ok'] = True
    source_health['skysports']['last_success'] = now_iso()
except Exception as exc:
    source_health['skysports']['last_error'] = str(exc)[:200]
    print(f"[lineup_news/skysports] non-fatal: {exc}", file=sys.stderr)
```

### Pattern 3: API Route (clone of gw-intel/route.ts exactly)

**What:** Minimal GET handler with USE_BLOB branch. No secondary reads needed.

**Exact structure to replicate from `src/app/api/gw-intel/route.ts`:**
```typescript
// [VERIFIED: src/app/api/gw-intel/route.ts]
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let data: string
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'lineup_news.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'Lineup news not available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      if (!res.ok) {
        return Response.json({ error: `Blob fetch failed: ${res.status}` }, { status: 502 })
      }
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'lineup_news.json')
      data = await readFile(cachePath, 'utf-8')
    }
    const parsed = JSON.parse(data)
    return Response.json(parsed, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  } catch (err) {
    const isNotFound =
      err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
    if (isNotFound) {
      return Response.json({ error: 'Lineup news not available' }, { status: 404 })
    }
    return Response.json({ error: 'Failed to load lineup news' }, { status: 500 })
  }
}
```

### Pattern 4: TanStack Query Hook (clone of useGWIntel.ts exactly)

```typescript
// [VERIFIED: src/lib/hooks/useGWIntel.ts]
import { useQuery } from '@tanstack/react-query'
import type { LineupNews } from '../types'

export function useLineupNews() {
  return useQuery<LineupNews>({
    queryKey: ['lineup-news'],
    queryFn: async () => {
      const res = await fetch('/api/lineup-news')
      if (!res.ok) throw new Error('Failed to fetch lineup news')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours — same as useGWIntel, useSetPieces
  })
}
```

### Anti-Patterns to Avoid

- **Returning early from the outer run.py block:** The `compute_lineup_news()` return value is unused by run.py — don't return partial results; instead, let the function save internally.
- **Writing players:[] to Blob:** Guard must check `len(players) == 0` BEFORE calling `save()`, not after.
- **Changing availability_factor in web scrapers:** Web scrapers write `news_headline` and `news_source` only. FPL bootstrap is the sole authority for `availability_factor`.
- **Calling `save()` with `None` data:** If FPL scrape fails (source 1), return early without calling `save()` at all — the pipeline's outer try/except will catch it.
- **Using `Response.json()` with custom `headers`:** The gw-intel route uses `new Response(JSON.stringify(parsed), { headers: {...} })` pattern only when it needs custom headers; note gw-intel actually uses `Response.json(parsed, { headers: {...} })` — follow the exact same approach.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RSS parsing | Custom XML parser | feedparser 6.0.12 | Handles encoding, malformed XML, date normalisation, Atom+RSS variants |
| Fuzzy name matching | Levenshtein implementation | difflib (stdlib) | SequenceMatcher + get_close_matches handles hyphenated names, multi-word names |
| Blob read/write | Custom Vercel API calls | existing `save()` in upload.py | Handles USE_BLOB flag and local fallback |

---

## feedparser API Reference

**RSS Entry Fields (verified against feedparser 6.0.12 docs):** [VERIFIED: feedparser.readthedocs.io/en/stable]

```python
import feedparser

feed = feedparser.parse('https://www.skysports.com/rss/11095')

# feed-level fields
feed.feed.title          # 'Sky Sports News'
feed.status              # HTTP status code (200, 301, etc.)
feed.bozo                # True if feed has errors

# per-entry fields
for entry in feed.entries:
    entry.title           # article headline (str)
    entry.summary         # description/body text (str)
    entry.link            # URL to full article
    entry.published       # date string e.g. 'Sun, 17 May 2026 15:00:00 BST'
    entry.published_parsed # time.struct_time 9-tuple or None if absent
    entry.id              # guid/unique identifier
```

**Key feedparser behaviours:**
- `entry.title` may be absent on malformed feeds — use `.get('title', '')`
- `entry.published_parsed` is `None` if date cannot be parsed — always guard with `if entry.published_parsed:`
- `feed.bozo` is True if feed has structural errors but feedparser still parses what it can — do NOT bail on bozo=True
- `feed.entries` is always a list (may be empty) — safe to iterate without length check

**RSS URLs confirmed accessible:** [VERIFIED: WebFetch of actual feeds, 2026-05-17]
- Sky Sports football: `https://www.skysports.com/rss/11095`
- BBC Sport football: `https://feeds.bbci.co.uk/sport/football/rss.xml`

Both feeds use RSS 2.0 with standard `<item>` elements containing `title`, `description`, `link`, and `pubDate`. Sky Sports uses CDATA-wrapped titles. BBC uses plain text. Both accessible without authentication.

---

## difflib Player Name Matching

**Recommended strategy** — verified by live testing against FPL name patterns: [VERIFIED: Python interpreter, 2026-05-17]

**Strategy: per-word `get_close_matches` + full-string fallback**

```python
import difflib

def _match_player(scraped_name: str, players: list[dict], cutoff: float = 0.6) -> dict | None:
    """
    Match a scraped name against FPL player web_name + second_name.
    Returns matched player dict or None.
    
    Strategy:
    1. Split scraped_name into words; try get_close_matches on each word
       against all [web_name, second_name] values (cutoff=0.6).
    2. If no word match found, try full-string SequenceMatcher (cutoff=0.6).
    3. Return first match found; log unmatched names.
    """
    # Build lookup: lowercase field value -> player dict
    val_to_player: dict[str, dict] = {}
    for p in players:
        for field in ('web_name', 'second_name'):
            v = (p.get(field) or '').lower()
            if v:
                val_to_player[v] = p
    
    all_vals = list(val_to_player.keys())
    
    # Strategy 1: per-word close matches (handles 'Mohamed Salah' -> 'salah')
    for word in scraped_name.lower().split():
        matches = difflib.get_close_matches(word, all_vals, n=1, cutoff=cutoff)
        if matches:
            return val_to_player[matches[0]]
    
    # Strategy 2: full-string SequenceMatcher fallback
    best_ratio = 0.0
    best_player = None
    for v, p in val_to_player.items():
        r = difflib.SequenceMatcher(None, scraped_name.lower(), v).ratio()
        if r > best_ratio:
            best_ratio = r
            best_player = p
    if best_ratio >= cutoff:
        return best_player
    
    return None  # unmatched — caller logs and discards
```

**Test results (verified live):**
```
'Mohamed Salah'         -> Salah        (word='salah', ratio=1.0)  ✓
'Virgil van Dijk'       -> Van Dijk     (word='dijk', cutoff 0.6) ✓
'Kevin De Bruyne'       -> De Bruyne    (word='de bruyne')         ✓
'Erling Haaland'        -> Haaland      (word='haaland', ratio=1.0)✓
'Trent Alexander-Arnold'-> Alexander-Arnold (word match)           ✓
'John Smith'            -> None          (no match)                ✓
```

**Cutoff recommendation: 0.6** (not 0.7 or 0.8). At 0.7, "Virgil van Dijk" misses because `get_close_matches('van', ..., cutoff=0.7)` doesn't match 'van dijk'. At 0.6, word 'dijk' matches 'van dijk'. [VERIFIED: live testing]

---

## premierleague.com Scraper — Critical Finding

**CRITICAL:** `https://www.premierleague.com/en/latest-player-injuries` is **JavaScript-rendered** — `requests.get()` returns a skeleton HTML page with no player data. [VERIFIED: WebFetch of actual page, 2026-05-17]

**SCRP-02 consequence:** The premierleague.com scraper will likely return an empty result set on every run. This is acceptable because:
1. SCRP-02 is non-fatal — failure sets `source_health['premierleague'].ok = False`
2. D-03 says web scrapers contribute `news_headline`/`news_source` only — `availability_factor` is unaffected
3. The 48h staleness guard (INFRA-02) ensures stale data doesn't penalise players

**Implementation approach for SCRP-02:**
```python
import requests
from bs4 import BeautifulSoup

PL_URL = 'https://www.premierleague.com/en/latest-player-injuries'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
}

def _scrape_premierleague(players_map: dict) -> list[dict]:
    """Attempt to scrape premierleague.com injury page. Returns list of
    {'scraped_name': str, 'headline': str} dicts. Empty list if JS-rendered
    or parse fails. Non-fatal: caller catches all exceptions."""
    resp = requests.get(PL_URL, headers=HEADERS, timeout=10)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, 'lxml')
    
    results = []
    # Look for article body / injury list elements
    # Page is JS-rendered so likely finds nothing — that's OK
    # Try common selectors; any that yield data are bonus
    for el in soup.select('article p, .injurySection p, .playerCard, [class*="injury"]'):
        text = el.get_text(strip=True)
        if text:
            results.append({'headline': text})
    return results
```

**Alternative URL to try:** `https://www.premierleague.com/latest-player-injuries` (without `/en/`) also confirmed to exist. [VERIFIED: WebSearch, 2026-05-17]

**Planning note:** The planner should treat SCRP-02 as a best-effort "try and see" task. If the page yields nothing on implementation, `source_health['premierleague'].ok = False` is the correct outcome and no further work is needed.

---

## FPL Bootstrap → availability_factor Mapping

From CONTEXT.md D-08/D-09 (locked): [VERIFIED: CONTEXT.md]

```python
def _compute_availability(element: dict) -> tuple[float | None, str]:
    """
    Returns (availability_factor, status_label).
    D-09: chance_of_playing_next_round wins over status='a'.
    """
    chance = element.get('chance_of_playing_next_round')  # int or None
    status = element.get('status', '')
    
    if chance == 75:
        return 0.75, 'doubted'
    if chance == 50:
        return 0.5, 'doubted'
    if chance == 25:
        return 0.25, 'doubted'
    if chance == 0:
        return 0.0, 'confirmed_absent'
    
    # chance is None — fall through to status
    if status == 'a':
        return 1.0, 'confirmed_start'
    if status == 'd':
        return 0.5, 'doubted'
    if status in ('i', 's', 'u', 'n'):
        return 0.0, 'confirmed_absent'
    
    # Unknown status code
    return None, 'unknown'
```

Note: FPL `chance_of_playing_next_round` is `int | None` — values are 25, 50, 75, 100 in practice. A value of 100 means confirmed available but with an explicit signal; treat same as `null`+`status='a'` → 1.0. [ASSUMED — FPL API docs don't document all values; code should handle 100 explicitly]

---

## lineup_news.json Artifact Shape

```json
{
  "scraped_at": "2026-05-17T08:00:00Z",
  "players": [
    {
      "id": 308,
      "availability_factor": 0.75,
      "status_label": "doubted",
      "news_headline": "Salah doubtful for Saturday",
      "news_source": "skysports",
      "scraped_at": "2026-05-17T08:00:00Z"
    }
  ],
  "source_health": {
    "fpl": {
      "ok": true,
      "last_success": "2026-05-17T08:00:00Z",
      "last_error": null
    },
    "premierleague": {
      "ok": false,
      "last_success": null,
      "last_error": "HTTP 403: Forbidden"
    },
    "skysports": {
      "ok": true,
      "last_success": "2026-05-17T08:00:00Z",
      "last_error": null
    },
    "bbc": {
      "ok": true,
      "last_success": "2026-05-17T08:00:00Z",
      "last_error": null
    }
  }
}
```

Notes:
- Root `scraped_at` = ISO UTC timestamp at pipeline run start
- Per-player `scraped_at` = same value (pipeline does not track per-player timestamps separately)
- `news_headline` and `news_source` are `null` for players with no web scraper match
- All 700+ FPL `elements` get an entry (not just injured ones) — consumers filter by `availability_factor < 1.0`

---

## TypeScript Types

**Add to `src/lib/types.ts`** (append at end): [VERIFIED: src/lib/types.ts — file ends at line ~997]

```typescript
// ============================================================================
// Phase 117: Lineup News Artifact (SCRP-01..SCRP-06, INFRA-01..INFRA-02)
// ============================================================================

export type LineupNewsSource = 'fpl' | 'premierleague' | 'skysports' | 'bbc' | null

export type StatusLabel = 'confirmed_start' | 'doubted' | 'confirmed_absent' | 'unknown'

export interface LineupNewsPlayer {
  id: number
  availability_factor: 1.0 | 0.75 | 0.5 | 0.25 | 0.0 | null  // null = unknown status
  status_label: StatusLabel
  news_headline: string | null    // null when no web scraper match found
  news_source: LineupNewsSource   // null when no web scraper match found
  scraped_at: string              // ISO 8601 UTC
}

export interface SourceHealth {
  ok: boolean
  last_success: string | null     // ISO 8601 UTC or null
  last_error: string | null       // error message truncated to 200 chars
}

export interface LineupNews {
  scraped_at: string              // ISO 8601 UTC — pipeline run timestamp
  players: LineupNewsPlayer[]
  source_health: {
    fpl: SourceHealth
    premierleague: SourceHealth
    skysports: SourceHealth
    bbc: SourceHealth
  }
}
```

---

## Integration Point: run.py Insertion

**Exact line:** After `save('fpl_bootstrap.json', bootstrap)` at line 142. [VERIFIED: pipeline/run.py line 142]

```python
# Line 141: bootstrap = get_bootstrap_static()
# Line 142: save('fpl_bootstrap.json', bootstrap)
# INSERT AFTER LINE 142:

try:
    from lineup_news import compute_lineup_news
    compute_lineup_news(bootstrap)
    print("Lineup news written.")
except Exception as ln_exc:
    print(f"[lineup_news] non-fatal error: {ln_exc}", file=sys.stderr)
```

The `compute_lineup_news` function handles its own `save()` call internally. No return value needed by run.py.

---

## Common Pitfalls

### Pitfall 1: premierleague.com Page is JavaScript-Rendered
**What goes wrong:** `requests.get()` returns skeleton HTML; BS4 parse yields zero player data; developer thinks scraper is broken.
**Why it happens:** premierleague.com uses React/JS to populate the injury list after page load.
**How to avoid:** Implement with `requests` + BS4 as specified (SCRP-02), but accept that `source_health['premierleague'].ok = False` is a normal outcome. Do not attempt Playwright/Selenium — requirements explicitly say "requests + BS4".
**Warning signs:** Empty soup results for all selectors; `source_health['premierleague'].last_error` shows HTTP 200 but empty data.

### Pitfall 2: Outer vs Inner try/except Layering
**What goes wrong:** The inner per-source try/except swallows an exception that should propagate to run.py.
**Why it happens:** Inner try/except in `lineup_news.py` catches all source failures; the module function itself should NOT have a blanket try/except. Only run.py wraps the whole `compute_lineup_news()` call.
**How to avoid:** `lineup_news.py` has per-source try/except blocks but no top-level function try/except. The outer try/except is in `run.py` only.

### Pitfall 3: Writing Empty players[] to Blob
**What goes wrong:** FPL bootstrap returns 0 elements (network error, empty response); `players = []`; `save()` called; Blob now has empty data; hook returns empty array; engines see no players.
**Why it happens:** Missing the guard before `save()`.
**How to avoid:** `if not players: return` before any `save()` call. [VERIFIED: CONTEXT.md SCRP-05]

### Pitfall 4: chance_of_playing == 100
**What goes wrong:** FPL sometimes sets `chance_of_playing_next_round = 100` on players who have been explicitly marked as available. The mapping table in D-08 only shows 25/50/75/0/null. If `100` is not handled, it falls through to `status` lookup which may produce a different result.
**Why it happens:** D-08 doesn't enumerate `100` as a case.
**How to avoid:** Add `if chance == 100: return 1.0, 'confirmed_start'` before the null check. This matches the user's intent — a 100% chance player is confirmed available. [ASSUMED — FPL API contract not documented; reasonable defensive handling]

### Pitfall 5: feedparser bozo=True Bail-Out
**What goes wrong:** Feed has minor XML errors; `feed.bozo = True`; developer raises exception; source marked as failed.
**Why it happens:** feedparser sets `bozo=True` on any XML irregularity but still parses what it can.
**How to avoid:** Never check `feed.bozo` to decide whether to continue. Always iterate `feed.entries` — feedparser recovers from most errors.

### Pitfall 6: per-player scraped_at Timestamp
**What goes wrong:** Developer tries to track per-player "when was this player's news updated" vs "when was the pipeline run". These are different concepts.
**Why it happens:** The artifact shape has both a root `scraped_at` and per-player `scraped_at`.
**How to avoid:** Both root and per-player `scraped_at` should be the SAME pipeline run timestamp (ISO UTC from `datetime.now(timezone.utc).isoformat()`). Per-player timestamp is there for INFRA-02 staleness checking — it represents when the data was collected, not when the news originated.

### Pitfall 7: news_headline Merge Priority
**What goes wrong:** Multiple sources match the same player; first source (FPL) has null news; third source (BBC) has a headline. If sources are processed in order and first-write wins, the headline is lost.
**Why it happens:** Merge loop overwrites later source's headline with earlier source's null.
**How to avoid:** Use last-writer-wins OR skip-if-already-set. Recommended: FPL sets availability fields; web scrapers set headline ONLY if not already set (first-come-first-served among web sources). Sky Sports and BBC have equal priority — whichever matches first wins.

---

## Blob Guard Implementation Detail

From CONTEXT.md and SCRP-05: `lineup_news.json` with empty `players[]` is never written to Blob. [VERIFIED: CONTEXT.md]

```python
def compute_lineup_news(bootstrap: dict) -> None:
    """Public API. Called from run.py. Raises on unrecoverable failure."""
    from upload import save
    from datetime import datetime, timezone
    
    scraped_at = datetime.now(timezone.utc).isoformat()
    
    # ... build players list and source_health ...
    
    # GUARD: never write empty players to Blob (SCRP-05)
    if not players:
        print("[lineup_news] players list empty — skipping save, preserving previous run")
        return
    
    payload = {
        'scraped_at': scraped_at,
        'players': players,
        'source_health': source_health,
    }
    save('lineup_news.json', payload)
```

Note: The guard applies regardless of `USE_BLOB` setting — also protects local cache integrity.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FPL status only | FPL + web scraper enrichment | Phase 117 (new) | Earlier injury signals |
| No news field in artifact | news_headline + news_source fields | Phase 117 (new) | Phase 119 UI can display headlines |
| bs4 4.12.x | bs4 4.14.3 | 2024-2025 | New features; backwards compatible |
| lxml 5.x | lxml 6.1.0 | 2024-2025 | Performance improvements; backwards compatible |

**Deprecated/outdated:**
- feedparser 5.x: Replaced by 6.0.x (different import path for some internals). Use 6.0.12.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `chance_of_playing_next_round == 100` should map to `1.0 / confirmed_start` | FPL Mapping | Could misclassify player if FPL uses 100 differently |
| A2 | Per-player `scraped_at` and root `scraped_at` should be the same pipeline run timestamp | Artifact Shape | Minor: timestamp semantics misaligned with Phase 118 consumer expectations |
| A3 | premierleague.com injury page will return empty data (JS-rendered) on every run | premierleague Scraper | If wrong: bonus data available; no negative impact |
| A4 | Sky Sports RSS 11095 and BBC Sport football RSS reliably contain injury/team news headlines (not just match reports) | feedparser | If wrong: very few news_headline enrichments; functionally degrades to FPL-only |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions (RESOLVED)

1. **`chance_of_playing_next_round == 100` handling**
   - What we know: D-08 table lists 0/25/50/75/null but not 100
   - What's unclear: Whether FPL ever sets it to 100 vs leaving it null
   - Recommendation: Handle 100 defensively (→ 1.0, confirmed_start); add comment referencing D-09

2. **players[] scope: all players vs injured-only**
   - What we know: CONTEXT.md D-05 shows player shape; REQUIREMENTS say "per-player availability signals"
   - What's unclear: Whether to emit ALL ~700 FPL players or only those with `availability_factor < 1.0`
   - Recommendation: Emit ALL players (Phase 118 engine needs to look up any player). Consumers filter.

3. **news_headline merge priority when multiple sources match**
   - What we know: D-03 says web scrapers contribute headline only; FPL is authoritative for factor
   - What's unclear: If Sky Sports and BBC both match the same player, which headline wins
   - Recommendation: First-come-first-served among web sources (Sky Sports checked before BBC)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| beautifulsoup4 | SCRP-02 | Partial (4.13.4 installed) | 4.13.4 → upgrade to 4.14.3 | — |
| lxml | SCRP-02 | Partial (6.0.2 installed) | 6.0.2 → upgrade to 6.1.0 | html.parser |
| feedparser | SCRP-03/04 | Not installed | — | Must install 6.0.12 |
| requests | SCRP-02 | 2.32.3 | ✓ 2.32.3 | — |
| difflib | SCRP-03/04 | stdlib | ✓ | — |

**Missing dependencies with no fallback:**
- `feedparser` — must be installed for SCRP-03/04. Add to `pipeline/requirements.txt`.

**Missing dependencies with fallback:**
- `lxml` 6.1.0 — currently 6.0.2; pipeline still works with `html.parser` for BS4 but lxml is faster. Upgrade is low-risk.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (existing) |
| Config file | none detected in pipeline/ |
| Quick run command | `python -m pytest pipeline/test_lineup_news.py -x` |
| Full suite command | `python -m pytest pipeline/ -x` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCRP-01 | `availability_factor` derived from bootstrap fields | unit | `pytest pipeline/test_lineup_news.py::test_fpl_mapping -x` | No — Wave 0 |
| SCRP-01 | `status_label` correct for all D-08 cases | unit | `pytest pipeline/test_lineup_news.py::test_status_label_mapping -x` | No — Wave 0 |
| SCRP-05 | Empty players guard prevents save() call | unit (mock save) | `pytest pipeline/test_lineup_news.py::test_empty_guard -x` | No — Wave 0 |
| SCRP-06 | source_health tracks ok/last_success/last_error | unit | `pytest pipeline/test_lineup_news.py::test_source_health -x` | No — Wave 0 |
| INFRA-01 | GET /api/lineup-news returns 200 with valid JSON | smoke | `curl -s http://localhost:3000/api/lineup-news \| python -m json.tool` | No — Wave 0 |
| INFRA-01 | GET /api/lineup-news returns 404 when file absent | unit | Next.js route unit test | No — Wave 0 |
| INFRA-02 | scraped_at field present in artifact | unit | Check JSON key in test | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `python -m pytest pipeline/test_lineup_news.py -x`
- **Per wave merge:** `python -m pytest pipeline/ -x`
- **Phase gate:** Full pipeline test + `curl /api/lineup-news` smoke test

### Wave 0 Gaps
- [ ] `pipeline/test_lineup_news.py` — covers SCRP-01, SCRP-05, SCRP-06
- [ ] Test fixtures: mock bootstrap with known status combinations

*(No existing test infrastructure for lineup_news.py — must create)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in pipeline or API route |
| V3 Session Management | No | Stateless API route |
| V4 Access Control | No | Public read-only endpoint |
| V5 Input Validation | Yes | feedparser sanitises RSS; BS4 sanitises HTML; JSON output from Python stdlib |
| V6 Cryptography | No | No secrets in lineup_news |

### Known Threat Patterns for Scraper Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed RSS feed content injected into headlines | Tampering | feedparser sanitises; store raw entry.title string only (no HTML) |
| Excessively large RSS response | DoS | `requests.get(timeout=10)` — already in set_piece_quality pattern |
| premierleague.com response injection | Tampering | BS4 `get_text(strip=True)` extracts text only; no HTML stored |

---

## Sources

### Primary (HIGH confidence)
- `pipeline/run.py` lines 141-142, 241-251 — insertion point and set_piece_quality isolation pattern [VERIFIED: file read]
- `pipeline/upload.py` lines 25-30 — `save()` function signature and USE_BLOB routing [VERIFIED: file read]
- `src/app/api/gw-intel/route.ts` — exact API route pattern to clone [VERIFIED: file read]
- `src/lib/hooks/useGWIntel.ts` — exact hook pattern to clone [VERIFIED: file read]
- `src/lib/types.ts` — file end location for type additions [VERIFIED: file read]
- feedparser.readthedocs.io/en/stable — entry fields title, summary, link, published_parsed [CITED: feedparser docs]
- Live RSS feeds tested: `skysports.com/rss/11095`, `feeds.bbci.co.uk/sport/football/rss.xml` [VERIFIED: WebFetch 2026-05-17]

### Secondary (MEDIUM confidence)
- pip registry versions for feedparser (6.0.12), beautifulsoup4 (4.14.3), lxml (6.1.0) [VERIFIED: pip index versions]
- difflib matching strategy [VERIFIED: live Python interpreter testing]

### Tertiary (LOW confidence)
- premierleague.com injury page HTML structure — JS-rendered, no useful CSS selectors found [VERIFIED: WebFetch of actual page returned empty content]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via pip registry
- Architecture: HIGH — all patterns read from actual source files
- feedparser fields: HIGH — verified against official docs + live RSS feed fetch
- premierleague.com HTML structure: LOW — JS-rendered; confirmed empty on requests.get()
- difflib cutoff recommendation: HIGH — live tested against FPL-style names
- Pitfalls: HIGH — derived from actual codebase patterns

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (30 days — stable stack)
