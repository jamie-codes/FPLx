# Phase 123: SCRAPER-02 Pipeline — Research

**Researched:** 2026-05-18
**Domain:** Python pipeline (RSS scraping, fuzzy player matching) + Next.js Route Handler + TanStack Query hook
**Confidence:** HIGH (all core claims verified against live codebase and live feeds)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Fuzzy surname matching using `rapidfuzz` `token_sort_ratio ≥ 85` against `merged_players.json`. Ambiguous or low-confidence matches → `element_id = null`. Multi-player articles: primary entity matched only.
- **D-02:** Name normalization mirrors Phase 117's existing approach in `lineup_news.py`. No new normalization library.
- **D-03:** Rule-based keyword classification in article title + summary. No LLM. Keyword sets: `confirmed_signing`, `rumour`, `injury_return`, `rotation_signal`, `general`.
- **D-04:** Classification applied in `transfer_news.py` at parse time, stored in artifact. Deterministic, zero cost.
- **D-05:** `transfer_news.py` runs year-round (NOT GW-dependent). IS_OFF_SEASON gate only skips GW-dependent steps.
- **D-06:** `IS_OFF_SEASON = not any(e.get('is_current') for e in events)`. Skipped steps log `[pipeline] IS_OFF_SEASON: skipping {step}`.
- **D-07:** `useTransferNews()` `staleTime = 6h`.
- **D-08:** Route Handler at `/api/transfer-news` follows gw-intel / set-pieces artifact pattern: read Blob key `transfer_news.json`, return JSON directly.

### Claude's Discretion

- Exact keyword lists beyond the examples above (case-insensitive matching, stemming strategy)
- Whether to deduplicate identical articles from both feeds (by URL or title similarity)
- Article age cutoff (e.g. last 30 days vs unlimited)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCR-01 | `pipeline/transfer_news.py` scrapes Sky Sports RSS, BBC Sport RSS, and Transfermarkt RSS; writes `transfer_news.json` to Vercel Blob | Sky Sports RSS and BBC Sport RSS verified working. Transfermarkt has no official RSS — see Critical Finding below. |
| SCR-02 | `pipeline/player_matching.py` shared utility matches player name mentions to FPL element IDs; used by transfer_news.py | `rapidfuzz` not in `requirements.txt` — must be added. API confirmed via official docs. |
| SCR-03 | Each article classified as one of five classes; classification field present in transfer_news.json | Keyword-based approach verified against established codebase pattern. |
| SCR-04 | `/api/transfer-news` Route Handler and `useTransferNews()` TanStack Query hook expose the feed | Canonical patterns in `route.ts` and `useGWIntel.ts`/`useLineupNews.ts` fully verified. |
| SCR-05 | Scraper runs behind `TRANSFER_NEWS_ENABLED` env var gate; non-fatal if errors | Pattern established in `lineup_news.py`; env-var guard is new addition. |
| WIN-03 | IS_OFF_SEASON gate detects no current GW; all GW-dependent steps degrade gracefully | `run.py` structure verified; IS_OFF_SEASON is NOT currently active (GW35 is_current=True, but needed after GW38). |

</phase_requirements>

---

## Summary

Phase 123 builds the transfer news pipeline layer: a new `pipeline/transfer_news.py` RSS scraper, a new `pipeline/player_matching.py` fuzzy-match shared utility, an IS_OFF_SEASON gate in `pipeline/run.py`, a `/api/transfer-news` Route Handler, and a `useTransferNews()` TanStack Query hook. The implementation is heavily patterned on Phase 117's `lineup_news.py`, which is already deployed and fully verified. All canonical references are in the codebase — this phase extends an established pattern rather than inventing new infrastructure.

**Critical finding:** Transfermarkt does NOT have an official RSS feed. Multiple URL variants (`/rss/transfers_rumours/...`, `/statistik/sommer-transfers/...`) all return `bozo=True, entries=0` when polled with `feedparser`. SCR-01 lists Transfermarkt RSS as a requirement, but CONTEXT.md locks Sky Sports and BBC only. The planner must decide whether to attempt Transfermarkt via HTML scraping, omit it, or treat it as a skip-on-failure source with a documented caveat.

**Critical finding:** `rapidfuzz` (D-01) is NOT in `pipeline/requirements.txt`. The existing `lineup_news.py` uses stdlib `difflib` instead. `rapidfuzz 3.14.5` is available via pip. `requirements.txt` must be updated as part of this phase.

**Primary recommendation:** Follow `lineup_news.py` as the exact structural template for `transfer_news.py`. Use `rapidfuzz.fuzz.token_sort_ratio ≥ 85` in `player_matching.py` as decided. Omit Transfermarkt RSS (or add it as skip-silently if unavailable). Route Handler and hook copy the `gw-intel` pattern verbatim, substituting the blob key and endpoint name.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| RSS scraping + classification | Python pipeline | — | Runs in GitHub Actions; no browser/Next.js involvement |
| Player name → element_id matching | Python pipeline | — | Shared utility accessed at scrape time, not at request time |
| Blob artifact write (`transfer_news.json`) | Python pipeline via `upload.py` | — | `save()` abstraction is the ONLY write path |
| IS_OFF_SEASON gate logic | Python pipeline (`run.py`) | — | Detects bootstrap `events[]` state; orchestrates step skipping |
| HTTP data serving | API / Backend (Next.js Route Handler) | — | Reads Blob → returns JSON; no transformation |
| Client data fetching and caching | Browser / Client (TanStack Query hook) | — | `staleTime=6h` prevents redundant fetches |
| Type definitions (`TransferNewsArticle`, `TransferNewsFeed`) | Frontend Server (shared `src/lib/types.ts`) | Browser | Used by hook and downstream UI consumers |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `feedparser` | 6.0.12 | RSS/Atom feed parsing | Already in `requirements.txt`; used in `lineup_news.py`; handles malformed feeds without crash |
| `rapidfuzz` | 3.14.5 | Fuzzy player name matching | D-01 locked decision; `token_sort_ratio` handles name variants better than stdlib `difflib` |
| `@tanstack/react-query` | ^5.95.2 | Client-side data fetching/caching | Established project standard; `useQuery` hook pattern in all existing hooks |
| `@vercel/blob` | (project version) | Blob storage read (Route Handler) | `list()` + `fetch(blobs[0].url)` pattern used in all artifact routes |

[VERIFIED: `requirements.txt` for feedparser; `pip install rapidfuzz --dry-run` for rapidfuzz 3.14.5; `package.json` for @tanstack/react-query ^5.95.2]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| stdlib `difflib` | — | Name normalization reference only | `lineup_news.py` uses this; `player_matching.py` uses `rapidfuzz` instead per D-01 |
| `python-dotenv` | >=1.0.0 | Env var loading in pipeline | Already in `requirements.txt`; `TRANSFER_NEWS_ENABLED` check uses `os.getenv()` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `rapidfuzz token_sort_ratio` | stdlib `difflib.SequenceMatcher` | difflib already in lineup_news.py; rapidfuzz is faster and D-01 locks it — must use rapidfuzz |
| Rule-based classification | LLM batch (like batch_insights.py) | D-03 locks rule-based; LLM adds latency and cost |
| Transfermarkt RSS | HTML scraping or omission | No official RSS exists (verified); HTML scraping adds fragile dependency |

**Installation:**
```bash
pip install rapidfuzz>=3.0.0
```

Add to `pipeline/requirements.txt`:
```
rapidfuzz>=3.0.0
```

**Version verification:** rapidfuzz 3.14.5 confirmed via `pip install rapidfuzz --dry-run`. [VERIFIED: pip dry-run 2026-05-18]

---

## Architecture Patterns

### System Architecture Diagram

```
GitHub Actions (pipeline/run.py)
    │
    ├─ get_bootstrap_static()           ← fpl_client.py
    │       │
    │       └─ IS_OFF_SEASON check      ← D-06: not any(e.get('is_current'))
    │               │
    │         IS_OFF_SEASON=True        IS_OFF_SEASON=False
    │               │                        │
    │         skip GW steps            run GW steps (merge, gw_intel, etc.)
    │
    ├─ transfer_news.scrape()           ← RUNS YEAR-ROUND (D-05)
    │       │
    │       ├─ try: fetch Sky Sports RSS (feedparser)
    │       ├─ try: fetch BBC Sport RSS (feedparser)
    │       ├─ classify each article (keyword match on title+summary)
    │       ├─ player_matching.match_players(articles, bootstrap.elements)
    │       │       └─ rapidfuzz token_sort_ratio ≥ 85 → element_id or null
    │       ├─ deduplicate (URL-based, Claude's discretion)
    │       ├─ [age cutoff filter, Claude's discretion]
    │       └─ save('transfer_news.json', payload)   ← upload.py
    │
    └─ [other pipeline steps]

Next.js Route Handler  /api/transfer-news
    │
    ├─ USE_BLOB=true  → list({ prefix: 'transfer_news.json' }) → fetch(blobs[0].url)
    └─ USE_BLOB=false → readFile('pipeline/cache/transfer_news.json')
            │
            └─ Response.json(parsed, { Cache-Control: 's-maxage=3600, ...' })

Browser
    └─ useTransferNews() [TanStack Query, staleTime=6h]
            └─ fetch('/api/transfer-news')
                    └─ TransferNewsFeed (typed)
```

### Recommended Project Structure

```
pipeline/
├── transfer_news.py       # NEW — RSS scraper + classifier (SCR-01, SCR-03, SCR-05)
├── player_matching.py     # NEW — shared fuzzy match utility (SCR-02)
├── run.py                 # MODIFIED — IS_OFF_SEASON gate + transfer_news call (WIN-03)
└── requirements.txt       # MODIFIED — add rapidfuzz>=3.0.0

src/
├── app/api/transfer-news/
│   └── route.ts           # NEW — Route Handler (SCR-04)
└── lib/
    ├── types.ts            # MODIFIED — add TransferNewsArticle, TransferNewsFeed (SCR-04)
    └── hooks/
        └── useTransferNews.ts  # NEW — TanStack Query hook (SCR-04)
```

### Pattern 1: Non-fatal RSS Source Isolation (from lineup_news.py)

**What:** Each RSS source wrapped in its own `try/except`; failure logs and continues.
**When to use:** Every external network call in `transfer_news.py`.

```python
# Source: pipeline/lineup_news.py (verified)
source_health = {
    'skysports': {'ok': False, 'last_success': None, 'last_error': None},
    'bbc':       {'ok': False, 'last_success': None, 'last_error': None},
}

try:
    articles += _scrape_rss_sky()
    source_health['skysports']['ok'] = True
    source_health['skysports']['last_success'] = scraped_at
except Exception as exc:
    source_health['skysports']['last_error'] = str(exc)[:200]
    print(f"[transfer_news/skysports] non-fatal: {exc}", file=sys.stderr)
```

### Pattern 2: rapidfuzz token_sort_ratio Player Matching (D-01)

**What:** Match article text against FPL `web_name` and `second_name` using rapidfuzz.
**When to use:** In `player_matching.py`, called from `transfer_news.py`.

```python
# Source: rapidfuzz official docs (fuzz.html), D-01 decision
from rapidfuzz import fuzz

def match_player(text: str, name_lookup: dict, cutoff: int = 85) -> int | None:
    """Returns FPL element_id or None if no match above cutoff."""
    text_lower = text.lower().strip()
    best_score = 0
    best_id = None
    for name, element_id in name_lookup.items():
        score = fuzz.token_sort_ratio(text_lower, name)
        if score > best_score:
            best_score = score
            best_id = element_id
    return best_id if best_score >= cutoff else None
```

**Key difference from lineup_news.py:** `lineup_news.py` uses `difflib.get_close_matches` (cutoff 0.6 on 0–1 scale). `player_matching.py` uses `rapidfuzz.fuzz.token_sort_ratio` (cutoff 85 on 0–100 scale). These are different APIs — do not mix them.

### Pattern 3: IS_OFF_SEASON Gate in run.py (D-05, D-06, WIN-03)

**What:** After bootstrap fetch, detect whether any GW is current; gate GW-dependent steps.
**When to use:** In `run.py`, after `bootstrap = get_bootstrap_static()`.

```python
# Source: CONTEXT.md D-06 (locked decision)
events = bootstrap.get('events', [])
IS_OFF_SEASON = not any(e.get('is_current') for e in events)

if IS_OFF_SEASON:
    print("[pipeline] IS_OFF_SEASON: skipping merge")
    print("[pipeline] IS_OFF_SEASON: skipping gw_intel")
    print("[pipeline] IS_OFF_SEASON: skipping bonus")
    # ... other GW-dependent steps
else:
    # existing GW-dependent pipeline steps

# transfer_news runs OUTSIDE the IS_OFF_SEASON block (D-05)
try:
    from transfer_news import scrape
    scrape(bootstrap)
    print("Transfer news written.")
except Exception as tn_exc:
    print(f"[transfer_news] non-fatal error: {tn_exc}", file=sys.stderr)
```

**Currently not active:** GW35 is `is_current=True` as of 2026-05-18. Gate activates after GW38 season close. [VERIFIED: live `fpl_bootstrap.json` cache]

### Pattern 4: Route Handler (canonical gw-intel pattern)

**What:** Read Blob or local cache, return JSON.
**When to use:** `src/app/api/transfer-news/route.ts`.

```typescript
// Source: src/app/api/gw-intel/route.ts (verified canonical)
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
        return Response.json({ error: `Blob fetch failed: ${res.status}` }, { status: 502 })
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

### Pattern 5: TanStack Query Hook (canonical useGWIntel pattern)

**What:** `useQuery` with 6h staleTime.
**When to use:** `src/lib/hooks/useTransferNews.ts`.

```typescript
// Source: src/lib/hooks/useGWIntel.ts and CONTEXT.md D-07 (verified)
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
    staleTime: 6 * 60 * 60 * 1000, // 6h — D-07, matches pipeline cadence
  })
}
```

Note: `useLineupNews` has a `select` transform for 48h staleness. `useTransferNews` does NOT need this — the 6h `staleTime` is sufficient and transfer news does not have the same staleness-gate semantics as availability data. [ASSUMED — based on CONTEXT.md D-07 not mentioning a select transform]

### Pattern 6: TRANSFER_NEWS_ENABLED Env Var Gate (SCR-05)

**What:** Early-return if env var not set.
**When to use:** Top of `transfer_news.py` `scrape()` function.

```python
# Source: CONTEXT.md code_context section (locked pattern)
import os

def scrape(bootstrap: dict) -> None:
    if os.getenv('TRANSFER_NEWS_ENABLED', '').lower() != 'true':
        print("[transfer_news] TRANSFER_NEWS_ENABLED not set — skipping")
        return
    # ... proceed with scraping
```

### Pattern 7: Empty Artifact Guard (mirrors SCRP-05 from lineup_news.py)

**What:** Never write `articles: []` to Blob.
**When to use:** In `transfer_news.py` before calling `save()`.

```python
# Source: pipeline/lineup_news.py SCRP-05 guard (verified)
if not articles:
    print("[transfer_news] articles list empty — skipping save, preserving previous run")
    return
save('transfer_news.json', payload)
```

### Anti-Patterns to Avoid

- **Calling Blob SDK directly:** Always use `save()` from `upload.py`. Never import `vercel_blob` directly in scraper modules.
- **Calling merge step under IS_OFF_SEASON:** `merge_players()` requires a current GW in `events[]` — calling it off-season causes KeyError or None crashes.
- **Writing rapidfuzz score as 0–1 float:** `token_sort_ratio` returns 0–100 int; threshold is `≥ 85`, not `≥ 0.85`. Confusing with difflib's 0.0–1.0 scale is the most likely bug.
- **Running transfer_news inside the IS_OFF_SEASON block:** It must run outside — D-05 is explicit.
- **Assuming Transfermarkt has RSS:** It does not. Any Transfermarkt scraping requires HTML parsing, not feedparser. [VERIFIED: live test 2026-05-18 — bozo=True, entries=0 for all URL variants]
- **Raising on empty RSS feed:** `feedparser` sets `bozo=True` on malformed feeds but still parses what it can. Never bail on `bozo=True` — always iterate `feed.entries`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy string matching | Custom edit-distance algorithm | `rapidfuzz.fuzz.token_sort_ratio` | Handles token reordering ("Salah Mohamed" vs "Mohamed Salah"); battle-tested against football player name variants |
| RSS feed parsing | HTTP + XML parsing | `feedparser` | Handles malformed RSS, bozo recovery, date parsing, encoding — all the edge cases |
| Blob artifact write | Direct `vercel_blob.put()` call | `upload.py save()` | Single abstraction; local dev cache handled transparently |
| Route Handler boilerplate | Custom streaming | Copy `gw-intel/route.ts` verbatim | Identical pattern for all artifact routes; Cache-Control headers already correct |

**Key insight:** This phase is almost entirely wiring existing patterns. The only genuinely new logic is: (1) article classification keyword matching, and (2) `rapidfuzz token_sort_ratio` in `player_matching.py`. Everything else is a direct copy-and-substitute from `lineup_news.py` and `gw-intel/route.ts`.

---

## Critical Findings

### CF-01: Transfermarkt Has No RSS Feed

SCR-01 (REQUIREMENTS.md) mentions Transfermarkt RSS alongside Sky Sports and BBC. This is incorrect — Transfermarkt does not publish an official RSS feed.

**Verified:** Multiple URL patterns tested with `feedparser` on 2026-05-18, all returning `bozo=True, entries=0`:
- `https://www.transfermarkt.com/rss/transfers_rumours/...` — no content
- `https://www.transfermarkt.co.uk/transfers/sommer-transfers/...` — no content

**CONTEXT.md** (the locked decisions document) only mentions Sky Sports and BBC — not Transfermarkt. This supersedes the REQUIREMENTS.md wording.

**Recommendation for planner:** Implement `transfer_news.py` with Sky Sports RSS and BBC Sport RSS only. If Transfermarkt coverage is desired in a future phase, it would require HTML scraping (similar to the premierleague.com scraper in `lineup_news.py`). This is out of scope per CONTEXT.md boundary.

### CF-02: rapidfuzz Not in requirements.txt

`rapidfuzz` is referenced in D-01 (locked decision) but is NOT in `pipeline/requirements.txt`. The existing `lineup_news.py` uses stdlib `difflib`.

**Verified:** `pip show rapidfuzz` fails; `requirements.txt` contains no rapidfuzz entry.
**Available:** rapidfuzz 3.14.5 confirmed via `pip install --dry-run`.

**Plan must include:** Adding `rapidfuzz>=3.0.0` to `pipeline/requirements.txt` as a Wave 0 task.

### CF-03: IS_OFF_SEASON Not Currently Active

GW35 has `is_current=True` as of 2026-05-18. The gate will activate after GW38 closes (late May 2026). Implementation can be tested now by temporarily patching the events list or using a test bootstrap with no `is_current` events.

---

## Common Pitfalls

### Pitfall 1: rapidfuzz vs difflib Score Scale Confusion

**What goes wrong:** Developer tests threshold `≥ 0.85` (difflib scale) instead of `≥ 85` (rapidfuzz scale) — every match passes, garbage results.
**Why it happens:** `lineup_news.py` uses `difflib` with 0.0–1.0 scale; `player_matching.py` uses `rapidfuzz` with 0–100 scale. They look similar but are not.
**How to avoid:** Document the scale difference clearly in `player_matching.py` docstring. Test with known player names.
**Warning signs:** All articles matching any player, or zero matches despite obvious name presence.

### Pitfall 2: transfer_news.py Inside IS_OFF_SEASON Block

**What goes wrong:** `transfer_news.scrape()` is guarded by the `IS_OFF_SEASON` check, making it unavailable when it's most valuable.
**Why it happens:** Developer sees a conditional block and adds all new pipeline steps inside it.
**How to avoid:** D-05 is explicit — `transfer_news` runs year-round. Place the call OUTSIDE the IS_OFF_SEASON conditional.

### Pitfall 3: feedparser bozo=True Causing Bail

**What goes wrong:** Developer adds `if feed.bozo: return` guard — BBC or Sky feed occasionally sets bozo=True on parse warning but still has valid entries.
**Why it happens:** `bozo=True` sounds like a fatal error but means "parse had non-fatal issues."
**How to avoid:** Never bail on `feed.bozo`. Always iterate `feed.entries`. Established in `lineup_news.py` line 214 comment.

### Pitfall 4: Calling save() with Empty articles List

**What goes wrong:** A pipeline run where both RSS sources are unavailable writes `{"articles": []}` to Blob, wiping out the previous valid artifact.
**Why it happens:** Forgetting the SCRP-05 empty-guard pattern.
**How to avoid:** Check `if not articles: return` before calling `save()`. Mirror the `lineup_news.py` guard exactly.

### Pitfall 5: IS_OFF_SEASON log format inconsistency

**What goes wrong:** Log lines don't match the specified format, making grep-based CI monitoring fail.
**Why it happens:** Developer writes `"Skipping {step} (off-season)"` instead of the locked format.
**How to avoid:** D-06 specifies exact format: `[pipeline] IS_OFF_SEASON: skipping {step}`. Use it verbatim.

### Pitfall 6: Keyword Classification — Case Sensitivity

**What goes wrong:** Keyword `"Signs"` doesn't match article text `"signs"` — classification always returns `general`.
**Why it happens:** String `in` check without `.lower()` normalization.
**How to avoid:** Normalize both the keyword set and the article text to lowercase before matching. Documented in CONTEXT.md as "case-insensitive matching" under Claude's Discretion.

### Pitfall 7: Duplicate Articles from Both Feeds

**What goes wrong:** The same transfer article appears twice in `transfer_news.json` (one from each feed), confusing the Phase 125 UI.
**Why it happens:** Sky Sports and BBC both cover the same news; no deduplication.
**How to avoid:** Deduplicate by URL (exact match first) then by title similarity (e.g. token_sort_ratio ≥ 90 on titles). URL deduplication is simpler and sufficient for most cases. [ASSUMED — Claude's Discretion area]

### Pitfall 8: player_matching.py Matches to Wrong Player (Short Names)

**What goes wrong:** Article about "Son" matches "Jonson" or "Wilson" via partial token match.
**Why it happens:** `token_sort_ratio` on very short strings can produce spurious matches.
**How to avoid:** Skip words shorter than 4 characters in the matching corpus (same pattern as `lineup_news.py` line 160: `if len(word) < 3: continue`). Consider raising threshold for names shorter than 5 characters.

---

## Code Examples

Verified patterns from live codebase:

### lineup_news.py _build_name_lookup Pattern (reuse in player_matching.py)

```python
# Source: pipeline/lineup_news.py lines 122-136 (verified)
def _build_name_lookup(elements: list) -> dict:
    """Build name → element_id lookup for fuzzy matching."""
    lookup = {}
    for element in elements:
        web_name = element.get('web_name', '')
        second_name = element.get('second_name', '')
        if web_name:
            lookup[web_name.lower()] = element['id']
        if second_name and second_name.lower() != web_name.lower():
            lookup[second_name.lower()] = element['id']
    return lookup
```

Note: `player_matching.py` maps name → `element_id` (int), whereas `lineup_news.py` maps to the full element dict. The `transfer_news.py` use case only needs element_id.

### TransferNewsArticle TypeScript Type (new addition to types.ts)

```typescript
// Pattern: mirrors LineupNewsPlayer and LineupNews in src/lib/types.ts lines 1003-1031
// Source: existing types.ts structure (verified)

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
  published: string | null     // ISO 8601 or null if feed doesn't provide
  source: 'skysports' | 'bbc'
  classification: TransferClass
  element_id: number | null    // null = unmatched player or no player mentioned
  scraped_at: string           // ISO 8601 UTC
}

export interface TransferNewsFeed {
  scraped_at: string           // ISO 8601 UTC — pipeline run timestamp
  articles: TransferNewsArticle[]
  source_health: {
    skysports: SourceHealth    // reuse existing SourceHealth type
    bbc: SourceHealth
  }
}
```

### transfer_news.json Artifact Structure

```json
{
  "scraped_at": "2026-05-18T12:00:00+00:00",
  "articles": [
    {
      "title": "Arsenal sign striker from Bundesliga",
      "summary": "Arsenal complete deal for...",
      "url": "https://www.skysports.com/...",
      "published": "2026-05-18T10:30:00Z",
      "source": "skysports",
      "classification": "confirmed_signing",
      "element_id": 42,
      "scraped_at": "2026-05-18T12:00:00+00:00"
    }
  ],
  "source_health": {
    "skysports": {"ok": true, "last_success": "...", "last_error": null},
    "bbc": {"ok": true, "last_success": "...", "last_error": null}
  }
}
```

### Keyword Classification Function

```python
# Source: CONTEXT.md D-03 keyword sets (locked decision)
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

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `difflib.SequenceMatcher` for fuzzy matching | `rapidfuzz.fuzz.token_sort_ratio` | This phase (D-01) | Better handling of token reordering; faster on large name lists |
| No off-season resilience in pipeline | IS_OFF_SEASON gate with graceful skip | This phase (WIN-03) | Pipeline survives GW38 rollover without null crashes |

**Deprecated/outdated:**
- Transfermarkt RSS: No official feed exists. RSS.app and similar third-party wrappers are unreliable and not officially supported.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `useTransferNews` does not need a staleness `select` transform (unlike `useLineupNews` with its 48h gate) | Architecture Patterns → Pattern 5 | If Phase 125 UI needs to handle stale data differently, the hook contract will need revision — but this is an additive change |
| A2 | URL-based deduplication (removing exact-duplicate URLs across Sky/BBC) is sufficient for the artifact | Pitfall 7 | Duplicate articles could appear in Phase 125 UI if two feeds publish the same story with different URLs (uncommon) |
| A3 | Article age cutoff of 30 days is a reasonable default for what gets written to Blob | Claude's Discretion | If transfer window is quiet, a 30-day window may be mostly empty; if active, it may be noisy — Claude's call per CONTEXT.md |

---

## Open Questions

1. **Transfermarkt RSS requirement**
   - What we know: SCR-01 lists it but CONTEXT.md locks only Sky Sports + BBC. Transfermarkt has no RSS feed (verified).
   - What's unclear: Does the user consider SCR-01 satisfied by Sky + BBC only, or is Transfermarkt coverage expected?
   - Recommendation: Implement Sky + BBC only (per CONTEXT.md decisions). Document in PLAN.md that Transfermarkt RSS is unavailable and the requirement is met by the two working feeds. Do not block implementation on this.

2. **player_matching.py integration with lineup_news.py**
   - What we know: CONTEXT.md says player_matching.py should be "used by both transfer_news.py and the existing lineup_news.py (no duplication of name-matching logic)."
   - What's unclear: Should `lineup_news.py` be refactored NOW to use player_matching.py, or does this happen in a later phase?
   - Recommendation: Refactor `lineup_news.py` to import from `player_matching.py` in this phase. SCR-02 says "used by both" — this is a phase deliverable, not a future idea. However, `lineup_news.py` uses `difflib` (not `rapidfuzz`) for its matching. `player_matching.py` will use `rapidfuzz`. The refactor should replace `lineup_news.py`'s `_match_player()` with an import from `player_matching.py` — but note this changes the matching algorithm for lineup news (which currently works). If this is risky, it could be made additive (both modules call `player_matching.py` but lineup_news.py keeps its existing logic). Safest: make `player_matching.py` support both rapidfuzz AND difflib internally, or let lineup_news.py continue using its existing `_match_player` and only transfer_news.py calls player_matching.py.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| feedparser | RSS scraping | Yes | 6.0.12 | — |
| rapidfuzz | Player matching (D-01) | No (not installed) | 3.14.5 available via pip | None — must install |
| Python | pipeline/run.py | Yes | 3.11 | — |
| Sky Sports RSS | SCR-01 | Yes | live | — |
| BBC Sport RSS | SCR-01 | Yes | live | — |
| Transfermarkt RSS | SCR-01 (text) | No | — | Omit (no official feed) |
| Vercel Blob | Artifact write | Yes (project infra) | — | local cache (USE_BLOB=false) |

**Missing dependencies with no fallback:**
- `rapidfuzz` — must be added to `requirements.txt` and installed; no fallback for D-01

**Missing dependencies with fallback:**
- Transfermarkt RSS — no official feed; omit from implementation, satisfy SCR-01 with Sky + BBC

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Python tests | pytest (matches `test_lineup_news.py` pattern) |
| TS/TSX tests | Vitest (`vitest run`), configured in `vitest.config.ts` |
| Quick Python run | `cd pipeline && python -m pytest test_transfer_news.py -x` |
| Quick TS run | `npx vitest run src/lib/hooks/useTransferNews.test.ts` |
| Full suite | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCR-01 | transfer_news.py scrapes Sky + BBC, writes artifact | unit (mock feedparser) | `cd pipeline && python -m pytest test_transfer_news.py::test_scrape_writes_artifact -x` | Wave 0 |
| SCR-02 | player_matching.py maps name to element_id via rapidfuzz | unit | `cd pipeline && python -m pytest test_player_matching.py -x` | Wave 0 |
| SCR-03 | Article classification returns correct class per keyword | unit | `cd pipeline && python -m pytest test_transfer_news.py::test_classification -x` | Wave 0 |
| SCR-04 | Route Handler returns 200 with JSON; hook fetches from it | TS unit (mock fetch) | `npx vitest run src/lib/hooks/useTransferNews.test.ts` | Wave 0 |
| SCR-05 | Non-fatal on RSS failure; TRANSFER_NEWS_ENABLED gate works | unit (mock feedparser raise) | `cd pipeline && python -m pytest test_transfer_news.py::test_non_fatal_isolation -x` | Wave 0 |
| WIN-03 | IS_OFF_SEASON skips GW steps; transfer_news still runs | unit (mock bootstrap events) | `cd pipeline && python -m pytest test_run_is_off_season.py -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd pipeline && python -m pytest test_transfer_news.py test_player_matching.py -x`
- **Per wave merge:** `npx vitest run && cd pipeline && python -m pytest test_transfer_news.py test_player_matching.py test_run_is_off_season.py`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `pipeline/test_transfer_news.py` — covers SCR-01, SCR-03, SCR-05
- [ ] `pipeline/test_player_matching.py` — covers SCR-02
- [ ] `pipeline/test_run_is_off_season.py` — covers WIN-03
- [ ] `src/lib/hooks/useTransferNews.test.ts` — covers SCR-04 (hook)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes | Article title/summary truncated to prevent oversized artifacts; element_id validated as int or null |
| V6 Cryptography | No | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| RSS feed containing oversized title/summary | Tampering | Truncate title to 280 chars, summary to 500 chars before writing to Blob (mirrors `HEADLINE_MAX_LEN` in `lineup_news.py`) |
| Malformed RSS injecting non-JSON-safe chars | Tampering | `feedparser` sanitizes input; `json.dumps` with `ensure_ascii=False` handles encoding |

---

## Sources

### Primary (HIGH confidence)

- `pipeline/lineup_news.py` — canonical RSS scraper, non-fatal isolation pattern, name lookup builder, name matching logic [VERIFIED: read live file]
- `pipeline/run.py` — canonical pipeline entry point structure, non-fatal scraper call pattern [VERIFIED: read live file]
- `src/app/api/gw-intel/route.ts` — canonical Route Handler pattern for artifact serving [VERIFIED: read live file]
- `src/lib/hooks/useGWIntel.ts`, `src/lib/hooks/useLineupNews.ts` — canonical TanStack Query hook patterns [VERIFIED: read live files]
- `pipeline/upload.py` — `save()` abstraction [VERIFIED: read live file]
- `pipeline/requirements.txt` — dependency inventory (rapidfuzz absence confirmed) [VERIFIED: read live file]
- `pipeline/cache/fpl_bootstrap.json` — IS_OFF_SEASON state (GW35 is_current=True) [VERIFIED: live cache]
- `package.json` — Next.js 16.2.1, @tanstack/react-query ^5.95.2 [VERIFIED: read live file]

### Secondary (MEDIUM confidence)

- rapidfuzz 3.14.5 available version confirmed via `pip install --dry-run` [VERIFIED: 2026-05-18]
- `rapidfuzz.fuzz.token_sort_ratio` function signature from official docs [CITED: rapidfuzz.github.io/RapidFuzz/Usage/fuzz.html]
- feedparser 6.0.12 installed [VERIFIED: `pip show feedparser` output]

### Tertiary (LOW confidence)

- Transfermarkt RSS unavailability — confirmed by live feedparser tests on multiple URL variants AND by WebSearch finding no official feed URL [VERIFIED: live test 2026-05-18]
- Sky Sports RSS URL `https://www.skysports.com/rss/11095` returns 20 entries [VERIFIED: live feedparser test]
- BBC Sport RSS URL `https://feeds.bbci.co.uk/sport/football/rss.xml` returns 82 entries [VERIFIED: live feedparser test]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via requirements.txt, pip, package.json
- Architecture: HIGH — all patterns verified from live codebase files
- Pitfalls: HIGH — most derived directly from `lineup_news.py` code comments and structure
- Transfermarkt RSS finding: HIGH — verified by live feedparser test + WebSearch corroboration
- rapidfuzz API: MEDIUM — function signature from official docs; not yet installed in project

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (stable domain; RSS feed URLs are low-churn)
