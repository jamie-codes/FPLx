# Phase 117: Scraper Pipeline & Lineup News Artifact - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 7
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `pipeline/lineup_news.py` | service | batch + file-I/O | `pipeline/set_piece_quality.py` | exact |
| `pipeline/run.py` | config/orchestrator | batch | `pipeline/run.py` (self) | exact (insertion) |
| `pipeline/requirements.txt` | config | — | `pipeline/requirements.txt` (self) | exact (append) |
| `src/app/api/lineup-news/route.ts` | controller | request-response | `src/app/api/gw-intel/route.ts` | exact |
| `src/lib/hooks/useLineupNews.ts` | hook | request-response | `src/lib/hooks/useGWIntel.ts` | exact |
| `src/lib/types.ts` | model | — | `src/lib/types.ts` (self) | exact (append) |
| `pipeline/test_lineup_news.py` | test | batch | `pipeline/test_transfer_snapshots.py` | role-match |

---

## Pattern Assignments

### `pipeline/lineup_news.py` (service, batch)

**Analog:** `pipeline/set_piece_quality.py`

**Module docstring pattern** (set_piece_quality.py lines 1-13):
```python
"""Set-piece delivery quality scores for FPL players (Phase 84 SPQ-01/SPQ-02).

Public API:
  run_sp_quality(understat_data: dict, id_map: dict, cache_dir: str) -> int | None
      ...
"""
```
Replicate: one public function signature in docstring, module purpose in opening line.

**Imports pattern** (set_piece_quality.py lines 15-27):
```python
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone, timedelta

import requests
```
For lineup_news.py, replace `requests` block with:
```python
import difflib
import sys
from datetime import datetime, timezone

import feedparser
import requests
from bs4 import BeautifulSoup

from upload import save
```

**Constants pattern** (set_piece_quality.py lines 28-60):
```python
SP_SHOTS_CACHE_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), 'cache', 'sp_shots_cache.json'
)
HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...'
    ),
    'Accept': 'text/html,...',
}
```
For lineup_news.py, declare constants at module top:
```python
SKY_RSS_URL = 'https://www.skysports.com/rss/11095'
BBC_RSS_URL = 'https://feeds.bbci.co.uk/sport/football/rss.xml'
PL_URL = 'https://www.premierleague.com/latest-player-injuries'
FUZZY_CUTOFF = 0.6
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
}
```

**Public function signature** (to create — mirrors set_piece_quality pattern):
```python
def compute_lineup_news(bootstrap: dict) -> None:
    """Derive per-player availability and enrich with web news headlines.

    Writes lineup_news.json via save(). Non-fatal: called from run.py inside
    a try/except block. Does NOT write if players list is empty (SCRP-05).

    Args:
        bootstrap: FPL bootstrap-static JSON (dict with 'elements' key).
    """
```

**Per-source isolation pattern** (RESEARCH.md Pattern 2 — derived from set_piece_quality structure):
```python
source_health = {
    'fpl':          {'ok': False, 'last_success': None, 'last_error': None},
    'premierleague':{'ok': False, 'last_success': None, 'last_error': None},
    'skysports':    {'ok': False, 'last_success': None, 'last_error': None},
    'bbc':          {'ok': False, 'last_success': None, 'last_error': None},
}

try:
    _scrape_fpl(bootstrap, players_map)
    source_health['fpl']['ok'] = True
    source_health['fpl']['last_success'] = scraped_at
except Exception as exc:
    source_health['fpl']['last_error'] = str(exc)[:200]
    print(f"[lineup_news/fpl] error: {exc}", file=sys.stderr)

try:
    _scrape_rss_sky(players_map)
    source_health['skysports']['ok'] = True
    source_health['skysports']['last_success'] = scraped_at
except Exception as exc:
    source_health['skysports']['last_error'] = str(exc)[:200]
    print(f"[lineup_news/skysports] non-fatal: {exc}", file=sys.stderr)
```

**Blob guard before save** (RESEARCH.md / CONTEXT.md SCRP-05):
```python
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
NOTE: `save` is imported from `upload` at the top of the module (not inside the function), consistent with how other pipeline modules import it.

**Private helper naming convention** (set_piece_quality.py — underscore-prefixed):
```python
def _scrape_fpl(bootstrap: dict, players_map: dict) -> None: ...
def _scrape_premierleague(players_map: dict) -> None: ...
def _scrape_rss_sky(players_map: dict) -> None: ...
def _scrape_rss_bbc(players_map: dict) -> None: ...
def _match_player(scraped_name: str, players: list[dict], cutoff: float = FUZZY_CUTOFF) -> dict | None: ...
def _compute_availability(element: dict) -> tuple[float | None, str]: ...
```

---

### `pipeline/run.py` (orchestrator — modification only)

**Analog:** `pipeline/run.py` itself (insertion at line 143)

**Insertion point** (run.py lines 141-143):
```python
# Line 141: bootstrap = get_bootstrap_static()
# Line 142: save('fpl_bootstrap.json', bootstrap)
# INSERT HERE (after line 142):

try:
    from lineup_news import compute_lineup_news
    compute_lineup_news(bootstrap)
    print("Lineup news written.")
except Exception as ln_exc:
    print(f"[lineup_news] non-fatal error: {ln_exc}", file=sys.stderr)
```

**Existing non-fatal block to match exactly** (run.py lines 241-250):
```python
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
The lineup_news block is simpler — no return value needed, no `None` intermediate variable — but follows the same `try/except Exception` shape with `file=sys.stderr` on the error print.

---

### `pipeline/requirements.txt` (config — append only)

**Analog:** `pipeline/requirements.txt` itself

**Current file contents** (requirements.txt lines 1-7):
```
requests>=2.32.0
pandas>=2.2.0
vercel-blob>=0.4.0
python-dotenv>=1.0.0
soccerdata==1.8.8
anthropic>=0.98.1
numpy>=1.26.0
```

**Lines to append:**
```
feedparser>=6.0.12
beautifulsoup4>=4.14.3
lxml>=6.1.0
```
Note: `requests` is already present. `beautifulsoup4` and `lxml` are new entries (currently installed at 4.13.4 and 6.0.2 respectively — bumping to specified minimums). `feedparser` is net-new.

---

### `src/app/api/lineup-news/route.ts` (controller, request-response)

**Analog:** `src/app/api/gw-intel/route.ts` — clone with three substitutions only

**Full analog file** (gw-intel/route.ts lines 1-42):
```typescript
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let data: string

    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'gw_intel.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'GW intel not available' }, { status: 404 })
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
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'gw_intel.json')
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
      return Response.json({ error: 'GW intel not available' }, { status: 404 })
    }
    return Response.json({ error: 'Failed to load GW insights' }, { status: 500 })
  }
}
```

**Three substitutions to apply:**

| Find | Replace |
|------|---------|
| `'gw_intel.json'` | `'lineup_news.json'` |
| `'GW intel not available'` | `'Lineup news not available'` (both occurrences) |
| `'Failed to load GW insights'` | `'Failed to load lineup news'` |
| `'pipeline', 'cache', 'gw_intel.json'` | `'pipeline', 'cache', 'lineup_news.json'` |

No other changes — imports, error handling structure, Cache-Control header, and response shape are identical.

---

### `src/lib/hooks/useLineupNews.ts` (hook, request-response)

**Analog:** `src/lib/hooks/useGWIntel.ts` — clone with three substitutions only

**Full analog file** (useGWIntel.ts lines 1-14):
```typescript
import { useQuery } from '@tanstack/react-query'
import type { GWIntelResponse } from '../types'

export function useGWIntel() {
  return useQuery<GWIntelResponse>({
    queryKey: ['gw-intel'],
    queryFn: async () => {
      const res = await fetch('/api/gw-intel')
      if (!res.ok) throw new Error('Failed to fetch GW insights')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours — same as useInsights
  })
}
```

**Three substitutions to apply:**

| Find | Replace |
|------|---------|
| `GWIntelResponse` | `LineupNews` |
| `useGWIntel` | `useLineupNews` |
| `['gw-intel']` | `['lineup-news']` |
| `'/api/gw-intel'` | `'/api/lineup-news'` |
| `'Failed to fetch GW insights'` | `'Failed to fetch lineup news'` |

`staleTime` remains `6 * 60 * 60 * 1000` (confirmed 6h in D-07). The comment can be updated to reference useLineupNews peers.

---

### `src/lib/types.ts` (model — append only)

**Analog:** `src/lib/types.ts` itself (append after line 997)

**Verified file end** (types.ts lines 995-997):
```typescript
  benchmark_score: number
  benchmark_label: string
  missed_players: { name: string; pts: number }[]
}
```

**Block to append** (after line 997):
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

### `pipeline/test_lineup_news.py` (test, batch)

**Analog:** `pipeline/test_transfer_snapshots.py`

**Test file header pattern** (test_transfer_snapshots.py lines 1-8):
```python
"""Tests for pipeline/transfer_snapshots.py — Phase 113 BACK-02.

TDD RED phase: these tests are written BEFORE transfer_snapshots.py exists.
All tests must fail initially with ModuleNotFoundError.
"""

import importlib
from unittest.mock import patch, call
```
For test_lineup_news.py, replace module reference and phase. Import `sys` and `os` for monkeypatching the pipeline directory.

**Test function signature pattern** (test_transfer_snapshots.py lines 11-17):
```python
def test_write_transfer_slim_snapshot_noop_when_use_blob_unset(monkeypatch):
    """Test 1: No-op when USE_BLOB is unset."""
    monkeypatch.delenv('USE_BLOB', raising=False)
    from transfer_snapshots import write_transfer_slim_snapshot
    with patch('upload.upload_json') as mock_upload:
        write_transfer_slim_snapshot([{'id': 1, 'web_name': 'Salah'}], 30)
        mock_upload.assert_not_called()
```
Pattern: each test uses `monkeypatch` for env vars, `patch('upload.upload_json')` or `patch('upload.save')` to intercept writes, and a descriptive docstring.

**Test cases required** (from RESEARCH.md Validation Architecture):

| Test name | What it tests | Req |
|-----------|---------------|-----|
| `test_fpl_availability_mapping` | All D-08 rows produce correct (factor, label) | SCRP-01 |
| `test_chance_of_playing_wins_over_status_a` | D-09: chance=75 + status='a' → 0.75/doubted | SCRP-01 |
| `test_unknown_status_returns_null_factor` | D-10: unrecognised status → null/'unknown' | SCRP-01 |
| `test_empty_players_guard_skips_save` | `players=[]` → save() never called | SCRP-05 |
| `test_source_health_structure` | Output has all four source keys with ok/last_success/last_error | SCRP-06 |
| `test_fpl_source_failure_sets_ok_false` | Exception in FPL scrape → source_health['fpl'].ok=False | SCRP-06 |

**Mock bootstrap fixture pattern** (adapt from test_transfer_snapshots.py lines 39-53):
```python
MOCK_BOOTSTRAP = {
    'elements': [
        {
            'id': 308,
            'web_name': 'Salah',
            'second_name': 'Salah',
            'status': 'a',
            'chance_of_playing_next_round': 75,
        },
        {
            'id': 1,
            'web_name': 'Raya',
            'second_name': 'Raya',
            'status': 'i',
            'chance_of_playing_next_round': None,
        },
    ]
}
```
Use `monkeypatch.setattr` or `patch('lineup_news.save')` to prevent real file I/O. Always `importlib.reload(lineup_news)` after env changes.

---

## Shared Patterns

### `save()` Call Convention
**Source:** `pipeline/upload.py` lines 25-30
**Apply to:** `pipeline/lineup_news.py`
```python
def save(pathname: str, data):
    """Route save to Blob or local depending on USE_BLOB env var."""
    if os.getenv('USE_BLOB', '').lower() == 'true':
        upload_json(pathname, data)
    else:
        save_local(pathname, data)
```
Import at module top with `from upload import save`. Call as `save('lineup_news.json', payload)`. No arguments beyond pathname and dict — identical to how gw_intel, bootstrap, fixtures are saved.

### Non-Fatal Block in run.py
**Source:** `pipeline/run.py` lines 241-250 (set_piece_quality block)
**Apply to:** The 5-line insertion in run.py at line 143
- Always `from module import function` inside the try block (lazy import)
- Always `except Exception as X_exc:` (not bare `except:`)
- Always `file=sys.stderr` on the error print
- Never use the return value of `compute_lineup_news()` — it returns `None`

### Error Logging Pattern
**Source:** `pipeline/run.py` lines 249-250, set_piece_quality.py
**Apply to:** All `except` blocks in `pipeline/lineup_news.py`
```python
print(f"[lineup_news/source_name] non-fatal: {exc}", file=sys.stderr)
```
Format: `[module_name/source_name]` prefix, space, message, `file=sys.stderr`. Truncate error messages stored in `source_health` dicts to 200 chars: `str(exc)[:200]`.

### Cache-Control Header
**Source:** `src/app/api/gw-intel/route.ts` line 31-33
**Apply to:** `src/app/api/lineup-news/route.ts`
```typescript
headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' }
```
Same header as all other artifact routes — do not change values.

### USE_BLOB Environment Variable
**Source:** `pipeline/upload.py` line 27 and `src/app/api/gw-intel/route.ts` line 5
**Apply to:** Both `pipeline/lineup_news.py` (via `save()`) and `src/app/api/lineup-news/route.ts`
```python
# Python: handled by save() — no direct os.getenv needed in lineup_news.py
```
```typescript
// TypeScript: replicate verbatim
const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'
```

---

## No Analog Found

All files have close analogs in the codebase. No files require falling back to RESEARCH.md-only patterns.

---

## Metadata

**Analog search scope:** `pipeline/`, `src/app/api/`, `src/lib/hooks/`, `src/lib/`
**Files scanned:** 7 analog files read (run.py, set_piece_quality.py, upload.py, gw-intel/route.ts, useGWIntel.ts, types.ts, test_transfer_snapshots.py)
**Pattern extraction date:** 2026-05-17
