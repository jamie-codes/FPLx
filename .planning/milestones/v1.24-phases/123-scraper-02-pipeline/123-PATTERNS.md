# Phase 123: SCRAPER-02 Pipeline — Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `pipeline/transfer_news.py` | service | file-I/O + request-response | `pipeline/lineup_news.py` | exact |
| `pipeline/player_matching.py` | utility | transform | `pipeline/lineup_news.py` (`_build_name_lookup`, `_match_player`) | role-match |
| `pipeline/run.py` | config / orchestrator | batch | `pipeline/run.py` (self — IS_OFF_SEASON gate is an addition) | exact |
| `pipeline/requirements.txt` | config | — | `pipeline/requirements.txt` (self — add one line) | exact |
| `src/app/api/transfer-news/route.ts` | controller | request-response | `src/app/api/lineup-news/route.ts` and `src/app/api/gw-intel/route.ts` | exact |
| `src/lib/hooks/useTransferNews.ts` | hook | request-response | `src/lib/hooks/useGWIntel.ts` | exact |
| `src/lib/types.ts` | model | transform | `src/lib/types.ts` lines 1000–1031 (LineupNews block) | exact |
| `pipeline/test_transfer_news.py` | test | — | `pipeline/lineup_news.py` structure (no existing test file to copy) | no analog |

---

## Pattern Assignments

### `pipeline/transfer_news.py` (service, file-I/O + request-response)

**Analog:** `pipeline/lineup_news.py`

**Imports pattern** (`lineup_news.py` lines 20–29):
```python
import sys
from datetime import datetime, timezone

import feedparser

from upload import save
```
Note: `transfer_news.py` adds `import os` (for `TRANSFER_NEWS_ENABLED` check) and omits `requests`, `BeautifulSoup` (no HTML scraping). `player_matching` import replaces inline `_match_player`.

**Module-level constants pattern** (`lineup_news.py` lines 34–44):
```python
SKY_RSS_URL = 'https://www.skysports.com/rss/11095'
BBC_RSS_URL = 'https://feeds.bbci.co.uk/sport/football/rss.xml'
HEADLINE_MAX_LEN = 280
ERROR_MAX_LEN = 200
```
`transfer_news.py` reuses same RSS URLs and truncation limits. Add `SUMMARY_MAX_LEN = 500` for the article summary field per RESEARCH.md security domain.

**TRANSFER_NEWS_ENABLED env gate** (D-06, from CONTEXT.md code_context):
```python
import os

def scrape(bootstrap: dict) -> None:
    if os.getenv('TRANSFER_NEWS_ENABLED', '').lower() != 'true':
        print("[transfer_news] TRANSFER_NEWS_ENABLED not set — skipping")
        return
    # proceed
```
Place this at the very top of the public `scrape()` function, before any I/O.

**source_health initialisation pattern** (`lineup_news.py` lines 267–273):
```python
source_health = {
    'skysports': {'ok': False, 'last_success': None, 'last_error': None},
    'bbc':       {'ok': False, 'last_success': None, 'last_error': None},
}
```
`transfer_news.py` uses two sources (Sky + BBC). No `fpl` or `premierleague` keys.

**Non-fatal RSS source isolation pattern** (`lineup_news.py` lines 298–314):
```python
try:
    _scrape_rss_sky(articles)
    source_health['skysports']['ok'] = True
    source_health['skysports']['last_success'] = scraped_at
except Exception as sky_exc:
    source_health['skysports']['last_error'] = str(sky_exc)[:ERROR_MAX_LEN]
    print(f"[transfer_news/skysports] non-fatal: {sky_exc}", file=sys.stderr)

try:
    _scrape_rss_bbc(articles)
    source_health['bbc']['ok'] = True
    source_health['bbc']['last_success'] = scraped_at
except Exception as bbc_exc:
    source_health['bbc']['last_error'] = str(bbc_exc)[:ERROR_MAX_LEN]
    print(f"[transfer_news/bbc] non-fatal: {bbc_exc}", file=sys.stderr)
```

**feedparser loop — never bail on bozo** (`lineup_news.py` lines 212–223):
```python
feed = feedparser.parse(SKY_RSS_URL)
# Pitfall: never bail on feed.bozo — always iterate entries
for entry in feed.entries:
    title = entry.get('title', '')
    summary = entry.get('summary', '')
    url = entry.get('link', '')
    published = entry.get('published', None)
    if not title:
        continue
    # classify + match + append to articles list
```

**Article classification function** (D-03 locked keyword sets):
```python
CLASSIFICATION_KEYWORDS = {
    'confirmed_signing': ['signs', 'joins', 'completes', 'agreed', 'confirmed', 'done deal'],
    'rumour':            ['linked', 'interest', 'bid', 'target', 'wants', 'considers'],
    'injury_return':     ['returns', 'fit', 'back in training', 'recovered'],
    'rotation_signal':   ['rotation', 'bench', 'rested', 'squad player'],
}

def classify_article(title: str, summary: str | None) -> str:
    """Classify article using keyword matching. Returns one of 5 classes."""
    text = (title + ' ' + (summary or '')).lower()
    for cls, keywords in CLASSIFICATION_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return cls
    return 'general'
```
Always lowercase both sides before matching (case-insensitive, per CONTEXT.md Claude's Discretion).

**Empty artifact guard — SCRP-05 mirror** (`lineup_news.py` lines 319–322):
```python
if not articles:
    print("[transfer_news] articles list empty — skipping save, preserving previous run")
    return
save('transfer_news.json', payload)
```

**`_now_iso()` helper** (`lineup_news.py` lines 51–53):
```python
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
```
Copy verbatim.

---

### `pipeline/player_matching.py` (utility, transform)

**Analog:** `pipeline/lineup_news.py` (`_build_name_lookup` lines 122–136, `_match_player` lines 139–176)

**`_build_name_lookup` pattern** (`lineup_news.py` lines 122–136):
```python
def _build_name_lookup(elements: list) -> dict:
    """Build name → element_id lookup for fuzzy matching."""
    lookup = {}
    for element in elements:
        web_name = element.get('web_name', '')
        second_name = element.get('second_name', '')
        if web_name:
            lookup[web_name.lower()] = element['id']   # int, not full element dict
        if second_name and second_name.lower() != web_name.lower():
            lookup[second_name.lower()] = element['id']
    return lookup
```
Key difference from `lineup_news.py`: values are `element['id']` (int) not the full element dict, because `player_matching.py` only needs to return `element_id`.

**`match_player` function using rapidfuzz** (D-01 locked, RESEARCH.md Pattern 2):
```python
from rapidfuzz import fuzz

FUZZY_CUTOFF = 85  # 0-100 scale — NOT 0.0-1.0 like difflib

def match_player(text: str, name_lookup: dict, cutoff: int = FUZZY_CUTOFF) -> int | None:
    """Returns FPL element_id or None if no match above cutoff.

    IMPORTANT: rapidfuzz token_sort_ratio returns 0-100 (int), not 0.0-1.0.
    Threshold is >= 85, not >= 0.85. Confusing with difflib scale is Pitfall 1.
    """
    if not text:
        return None

    query = text.lower().strip()

    # Direct lookup first (exact match)
    if query in name_lookup:
        return name_lookup[query]

    # Per-word matching (mirrors lineup_news.py word-loop, line 156-163)
    words = query.split()
    best_score = 0
    best_id = None
    for word in words:
        if len(word) < 4:   # skip very short tokens (Pitfall 8)
            continue
        for name, element_id in name_lookup.items():
            score = fuzz.token_sort_ratio(word, name)
            if score > best_score:
                best_score = score
                best_id = element_id

    return best_id if best_score >= cutoff else None
```

**Public API contract:**
```python
def build_name_lookup(elements: list) -> dict:
    """Build lowercased name → element_id lookup from bootstrap elements."""
    ...

def match_player(text: str, name_lookup: dict, cutoff: int = 85) -> int | None:
    """Return FPL element_id (int) or None for no-match."""
    ...
```
Both functions exported at module level. Called from `transfer_news.py`.

---

### `pipeline/run.py` (orchestrator, batch — IS_OFF_SEASON gate addition)

**Analog:** `pipeline/run.py` (self — this is an additive modification)

**IS_OFF_SEASON gate placement** (D-05, D-06 — after bootstrap fetch at line 141):

Insert immediately after `bootstrap = get_bootstrap_static()` and `save('fpl_bootstrap.json', bootstrap)`:

```python
# Phase 123 WIN-03: IS_OFF_SEASON gate — detects no current GW.
# D-06: detection via events[] is_current flag.
events = bootstrap.get('events', [])
IS_OFF_SEASON = not any(e.get('is_current') for e in events)
```

**GW-dependent step wrapping pattern** (mirrors the `if os.getenv('INSIGHT_BATCH_ENABLED')` guard at `run.py` lines 442–457):
```python
if IS_OFF_SEASON:
    print("[pipeline] IS_OFF_SEASON: skipping merge")
    print("[pipeline] IS_OFF_SEASON: skipping gw_intel")
    print("[pipeline] IS_OFF_SEASON: skipping bonus")
    # add one print per skipped step — exact format per D-06
else:
    # existing GW-dependent pipeline steps (merge_players, gw_intel, etc.)
    merged, captain_picks = merge_players(...)
    ...
```
Log format is locked by D-06: `[pipeline] IS_OFF_SEASON: skipping {step}` — use verbatim.

**transfer_news call — OUTSIDE IS_OFF_SEASON block** (D-05 — mirrors the `lineup_news` call at `run.py` lines 144–150):
```python
# Phase 123 SCR-01/SCR-05: Transfer news runs YEAR-ROUND (D-05) — outside IS_OFF_SEASON block.
try:
    from transfer_news import scrape
    scrape(bootstrap)
    print("Transfer news written.")
except Exception as tn_exc:
    print(f"[transfer_news] non-fatal error: {tn_exc}", file=sys.stderr)
```
Place this call at the same level as the `lineup_news` call (also outside the IS_OFF_SEASON conditional).

---

### `pipeline/requirements.txt` (config — one-line addition)

**Analog:** `pipeline/requirements.txt` (self)

**Current content** (lines 1–10):
```
requests>=2.32.0
pandas>=2.2.0
vercel-blob>=0.4.0
python-dotenv>=1.0.0
soccerdata==1.8.8
anthropic>=0.98.1
numpy>=1.26.0
feedparser>=6.0.12
beautifulsoup4>=4.14.3
lxml>=6.1.0
```

**Addition:** Append one line (CF-02 from RESEARCH.md — rapidfuzz is NOT currently present):
```
rapidfuzz>=3.0.0
```

---

### `src/app/api/transfer-news/route.ts` (controller, request-response)

**Analog:** `src/app/api/lineup-news/route.ts` (exact structural match) and `src/app/api/gw-intel/route.ts`

**Full pattern — copy `lineup-news/route.ts` verbatim, substitute blob key and error strings** (`src/app/api/lineup-news/route.ts` lines 1–42):

```typescript
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let data: string

    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'transfer_news.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'Transfer news not available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      if (!res.ok) {
        return Response.json(
          { error: `Blob fetch failed: ${res.status}` },
          { status: 502 }
        )
      }
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'transfer_news.json')
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
      return Response.json({ error: 'Transfer news not available' }, { status: 404 })
    }
    return Response.json({ error: 'Failed to load transfer news' }, { status: 500 })
  }
}
```

Substitutions from `lineup-news/route.ts`:
- `'lineup_news.json'` → `'transfer_news.json'`
- `'Lineup news not available'` → `'Transfer news not available'`
- `'Failed to load lineup news'` → `'Failed to load transfer news'`
- `'lineup_news.json'` in cachePath → `'transfer_news.json'`

Cache-Control header is identical — do not change it (D-08 specifies no transformation in the route).

---

### `src/lib/hooks/useTransferNews.ts` (hook, request-response)

**Analog:** `src/lib/hooks/useGWIntel.ts` (simpler — no `select` transform needed per D-07/A1)

**Full pattern** (`src/lib/hooks/useGWIntel.ts` lines 1–14, adapted):
```typescript
import { useQuery } from '@tanstack/react-query'
import type { TransferNewsFeed } from '../types'

export function useTransferNews() {
  return useQuery<TransferNewsFeed>({
    queryKey: ['transfer-news'],
    queryFn: async () => {
      const res = await fetch('/api/transfer-news')
      if (!res.ok) throw new Error('Failed to fetch transfer news')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6h — D-07, matches pipeline run cadence
  })
}
```

Key difference from `useLineupNews.ts`: no `select` transform and no 48h staleness gate. `useTransferNews` returns `TransferNewsFeed` directly (not a `Map`). The `select` in `useLineupNews` is a Phase 118 INFRA-02 addition specific to availability logic — transfer news consumers in Phase 125 can work with the full feed object.

---

### `src/lib/types.ts` (model — additive block at end of file)

**Analog:** `src/lib/types.ts` lines 1000–1031 (LineupNews block, Phase 117)

**Addition pattern** — add a new block after the existing Phase 117 block (after line 1031):

```typescript
// Phase 123: Transfer News Artifact (SCR-01..SCR-05, WIN-03)
// ============================================================================

export type TransferClass =
  | 'confirmed_signing'
  | 'rumour'
  | 'injury_return'
  | 'rotation_signal'
  | 'general'

export interface TransferNewsArticle {
  title: string
  summary: string | null
  url: string
  published: string | null          // ISO 8601 or null if feed doesn't provide
  source: 'skysports' | 'bbc'
  classification: TransferClass
  element_id: number | null         // null = unmatched player or no player mentioned
  scraped_at: string                // ISO 8601 UTC
}

export interface TransferNewsFeed {
  scraped_at: string                // ISO 8601 UTC — pipeline run timestamp
  articles: TransferNewsArticle[]
  source_health: {
    skysports: SourceHealth         // reuses SourceHealth defined at line 1016
    bbc: SourceHealth
  }
}
```

`SourceHealth` is already defined at `src/lib/types.ts` lines 1016–1020 — reuse it directly, no redefinition needed.

**SourceHealth reference** (`src/lib/types.ts` lines 1016–1020):
```typescript
export interface SourceHealth {
  ok: boolean
  last_success: string | null     // ISO 8601 UTC or null
  last_error: string | null       // error message truncated to 200 chars
}
```

---

### Test files (no analog — Wave 0 gaps)

`pipeline/test_transfer_news.py`, `pipeline/test_player_matching.py`, `pipeline/test_run_is_off_season.py`, `src/lib/hooks/useTransferNews.test.ts` have no existing analog in the codebase. RESEARCH.md Validation Architecture section specifies the test framework (pytest for Python, Vitest for TS). Planner should reference RESEARCH.md patterns for test structure.

---

## Shared Patterns

### Non-fatal pipeline step isolation
**Source:** `pipeline/run.py` lines 144–150, `pipeline/lineup_news.py` lines 276–314
**Apply to:** `transfer_news.py` per-source RSS calls, `run.py` transfer_news call

```python
try:
    from transfer_news import scrape
    scrape(bootstrap)
    print("Transfer news written.")
except Exception as tn_exc:
    print(f"[transfer_news] non-fatal error: {tn_exc}", file=sys.stderr)
```

### Blob write abstraction
**Source:** `pipeline/upload.py` lines 25–30
**Apply to:** `transfer_news.py` — must call `save('transfer_news.json', payload)`, never import `vercel_blob` directly

```python
from upload import save
# ...
save('transfer_news.json', payload)
```

### ISO UTC timestamp helper
**Source:** `pipeline/lineup_news.py` lines 51–53
**Apply to:** `transfer_news.py`

```python
from datetime import datetime, timezone

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
```

### Error string truncation
**Source:** `pipeline/lineup_news.py` line 281 (`str(fpl_exc)[:ERROR_MAX_LEN]`)
**Apply to:** All `source_health[...]['last_error']` assignments in `transfer_news.py`

```python
ERROR_MAX_LEN = 200
# ...
source_health['skysports']['last_error'] = str(exc)[:ERROR_MAX_LEN]
```

### Route Handler USE_BLOB pattern
**Source:** `src/app/api/gw-intel/route.ts` lines 5, 11–27
**Apply to:** `src/app/api/transfer-news/route.ts`

```typescript
const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `pipeline/test_transfer_news.py` | test | — | No existing Python test files for pipeline modules |
| `pipeline/test_player_matching.py` | test | — | No existing Python test files for pipeline modules |
| `pipeline/test_run_is_off_season.py` | test | — | No existing Python test files for pipeline modules |
| `src/lib/hooks/useTransferNews.test.ts` | test | — | Hook test files are a Wave 0 gap across the project |

Planner: for these files, use RESEARCH.md Validation Architecture section (lines 620–651) as the specification. pytest + mock feedparser pattern for Python; Vitest + mock fetch for TS.

---

## Critical Constraints (Anti-Patterns)

Extracted from RESEARCH.md — reference these in plan action items:

1. **rapidfuzz scale is 0–100, not 0.0–1.0.** Threshold `>= 85`, never `>= 0.85`. (Pitfall 1)
2. **Never call `vercel_blob` directly** — always use `upload.py save()`. (Anti-Pattern)
3. **`transfer_news.scrape()` must be OUTSIDE the `IS_OFF_SEASON` block.** D-05 is explicit. (Pitfall 2)
4. **Never bail on `feedparser` `bozo=True`.** Always iterate `feed.entries`. (Pitfall 3)
5. **Empty articles guard before `save()`.** Never write `{"articles": []}` to Blob. (Pitfall 4)
6. **IS_OFF_SEASON log format is locked:** `[pipeline] IS_OFF_SEASON: skipping {step}` — use verbatim. (Pitfall 5)
7. **Transfermarkt has no RSS feed.** Verified live 2026-05-18. Sky + BBC only. (CF-01)
8. **`rapidfuzz` is NOT in `requirements.txt`.** Must be added as Wave 0 task. (CF-02)

---

## Metadata

**Analog search scope:** `pipeline/`, `src/app/api/`, `src/lib/hooks/`, `src/lib/types.ts`
**Files read:** 9 source files + 2 context files
**Pattern extraction date:** 2026-05-18
