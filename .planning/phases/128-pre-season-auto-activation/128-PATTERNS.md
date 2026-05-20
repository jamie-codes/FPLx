# Phase 128: Pre-Season Auto-Activation — Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 9 (6 new, 3 modified)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `pipeline/suggest_squad.py` | service | batch | `pipeline/suggest_squad.py` (self-refactor) | exact |
| `pipeline/run.py` | orchestrator | batch | `pipeline/run.py` (self-extension) | exact |
| `src/lib/types.ts` | model | transform | `src/lib/types.ts` lines 1138–1142 (`PreSeasonSquadResponse`) | exact |
| `src/app/api/pre-season-active/route.ts` | route/controller | request-response | `src/app/api/pre-season-squad/route.ts` | exact |
| `src/lib/hooks/usePreSeasonActive.ts` | hook | request-response | `src/lib/hooks/usePreSeasonSquad.ts` | exact |
| `src/components/next-season/NextSeasonPlannerTab.tsx` | component | request-response | `src/components/next-season/NextSeasonPlannerTab.tsx` (self-extension) | exact |
| `pipeline/tests/test_suggest_squad.py` | test | batch | `pipeline/tests/test_run_offseason.py` | role-match |
| `pipeline/tests/test_run_offseason.py` | test | batch | `pipeline/tests/test_run_offseason.py` (self-extension) | exact |
| `src/lib/hooks/usePreSeasonActive.test.ts` | test | request-response | `src/lib/hooks/useWatchlist.test.ts` | role-match |

---

## Pattern Assignments

### `pipeline/suggest_squad.py` — MODIFY (service, batch)

**Analog:** `pipeline/suggest_squad.py` lines 253–278 (self-refactor)

**Current signature** (line 253):
```python
def suggest_squad(bootstrap: dict, archive: dict) -> None:
```

**New signature** (D-04):
```python
def suggest_squad(bootstrap: dict, archive: dict, force: bool = False) -> None:
```

**Idempotency check to wrap in `if not force:`** (lines 263–278):
```python
    import os as _os
    if not force:
        # Blob path
        if _os.getenv('USE_BLOB', '').lower() == 'true':
            try:
                import vercel_blob
                result = vercel_blob.list({'prefix': SQUAD_KEY, 'limit': 1})
                if len(result.get('blobs', [])) > 0:
                    print("[suggest_squad] already exists — skipping.")
                    return
            except Exception as _exc:
                print(f"[suggest_squad] _blob_exists check failed ({_exc}); assuming not present.", file=sys.stderr)
        else:
            # Local path
            local_path = _os.path.join('pipeline', 'cache', SQUAD_KEY)
            if _os.path.exists(local_path):
                print("[suggest_squad] already exists — skipping.")
                return
    # ... rest of function unchanged
```

**Critical rule:** Both the blob path AND the local path checks must be inside `if not force:`. Wrapping only one means `force=True` still aborts early on local development.

---

### `pipeline/run.py` — MODIFY (orchestrator, batch)

**Analog:** `pipeline/run.py` lines 196–245 (IS_GW38 block as structural reference; IS_OFF_SEASON block as insertion context)

**IS_OFF_SEASON block structure** (lines 148–253, insertion point at ~line 246):
- `IS_OFF_SEASON = not any(e.get('is_current') for e in events)` (line 148)
- IS_GW38 block ends at line 245 (inside `if IS_GW38:`)
- `if not IS_OFF_SEASON:` block starts at line 253 — activation block goes BEFORE this, still inside the outer `if IS_OFF_SEASON:` implied context

**Non-fatal try/except wrapper pattern** (lines 213–235 — GW38 suggest_squad wrapper to mirror):
```python
        try:
            from suggest_squad import suggest_squad
            archive_path = os.path.join(cache_dir, 'season_archive_gw38.json')
            _archive = None
            if os.path.exists(archive_path):
                with open(archive_path, 'r', encoding='utf-8') as _f:
                    _archive = json.load(_f)
            elif os.getenv('USE_BLOB', '').lower() == 'true':
                import vercel_blob
                import requests as _requests
                _blob_list = vercel_blob.list({'prefix': 'season_archive_gw38.json', 'limit': 1})
                _blobs = _blob_list.get('blobs', [])
                if _blobs:
                    _url = _blobs[0].get('url', '')
                    if _url:
                        _archive = _requests.get(_url, timeout=30).json()
            if _archive is not None:
                suggest_squad(bootstrap, _archive)
                print("Pre-season squad written.")
            else:
                print("[suggest_squad] archive not available — skipping ILP.", file=sys.stderr)
        except Exception as sq_exc:
            print(f"[suggest_squad] non-fatal error: {sq_exc}", file=sys.stderr)
```

**`save()` usage pattern** (lines 141–142):
```python
        bootstrap = get_bootstrap_static()
        save('fpl_bootstrap.json', bootstrap)
```

**Artifact existence check pattern** (blob + local dual-path, lines 220–229):
```python
            elif os.getenv('USE_BLOB', '').lower() == 'true':
                import vercel_blob
                import requests as _requests
                _blob_list = vercel_blob.list({'prefix': 'season_archive_gw38.json', 'limit': 1})
                _blobs = _blob_list.get('blobs', [])
```

**Activation block insertion point:** After IS_GW38 block closes (line ~245), before `if not IS_OFF_SEASON:` (line ~253). Predicate must keep `len(events) >= 38` as first clause for short-circuit safety.

---

### `src/lib/types.ts` — MODIFY (model, transform)

**Analog:** `src/lib/types.ts` lines 1138–1142 (`PreSeasonSquadResponse` — append after this)

**Existing type to append after** (lines 1138–1142):
```typescript
export interface PreSeasonSquadResponse {
  squad: PreSeasonSquad | null
  health: SquadHealth | null
  solver: 'ilp' | 'greedy' | null
}
```

**New type to add** (D-08):
```typescript
export interface PreSeasonActiveResponse {
  activated_at: string  // ISO 8601
  season_id: string     // e.g. "2526"
}
```

---

### `src/app/api/pre-season-active/route.ts` — NEW (route, request-response)

**Analog:** `src/app/api/pre-season-squad/route.ts` lines 1–33, 35–57, 146–155

**Imports pattern** (lines 7–13):
```typescript
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { PreSeasonActiveResponse } from '@/lib/types'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'
```

**`readBlobOrLocal` helper — copy verbatim** (lines 15–33):
```typescript
async function readBlobOrLocal(filename: string): Promise<string | null> {
  try {
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: filename, limit: 1 })
      if (!blobs.length) return null
      const res = await fetch(blobs[0].url)
      if (!res.ok) throw new Error(`Blob fetch failed: ${res.status}`)
      return await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', filename)
      return await readFile(cachePath, 'utf-8')
    }
  } catch (err) {
    const isNotFound =
      err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
    if (isNotFound) return null
    throw err
  }
}
```

**GET handler pattern — 404 when absent, 200 with typed payload** (lines 35–57, adapted):
```typescript
export async function GET() {
  try {
    const data = await readBlobOrLocal('pre_season_active.json')
    if (data === null) {
      return Response.json({ error: 'Pre-season not yet activated' }, { status: 404 })
    }
    const payload = JSON.parse(data) as PreSeasonActiveResponse
    return Response.json(payload, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('[pre-season-active] Unexpected error:', err)
    return Response.json({ error: 'Failed to load activation status' }, { status: 500 })
  }
}
```

**Note:** Use `Response.json()` not `NextResponse.json()` — this is the project pattern (Next.js 16.2.1). Cache-Control uses `s-maxage=300` (5 min) rather than the 3600s used by pre-season-squad, since activation state may change during the pre-season window.

---

### `src/lib/hooks/usePreSeasonActive.ts` — NEW (hook, request-response)

**Analog:** `src/lib/hooks/usePreSeasonSquad.ts` lines 1–19

**Full file pattern — mirror verbatim, substituting endpoint and type** (lines 1–19):
```typescript
// src/lib/hooks/usePreSeasonSquad.ts — mirror this exactly
import { useQuery } from '@tanstack/react-query'
import type { PreSeasonSquadResponse } from '../types'

export function usePreSeasonSquad() {
  return useQuery<PreSeasonSquadResponse | null>({
    queryKey: ['pre-season-squad'],
    queryFn: async () => {
      const res = await fetch('/api/pre-season-squad')
      if (res.status === 404) return null  // archive absent → "Prices pending"
      if (!res.ok) throw new Error('Failed to fetch pre-season squad')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000,
  })
}
```

**Substitutions for new hook:**
- `PreSeasonSquadResponse` → `PreSeasonActiveResponse`
- `queryKey: ['pre-season-squad']` → `queryKey: ['pre-season-active']`
- `fetch('/api/pre-season-squad')` → `fetch('/api/pre-season-active')`
- `staleTime: 6 * 60 * 60 * 1000` → `staleTime: 60_000` (60s, per CONTEXT.md Claude's Discretion)
- Error message string updated accordingly
- Return type: `PreSeasonActiveResponse | null`

---

### `src/components/next-season/NextSeasonPlannerTab.tsx` — MODIFY (component, request-response)

**Analog:** `src/components/next-season/NextSeasonPlannerTab.tsx` (self-extension)

**Existing solver badge pill classes** (lines 36–44 — reuse for status pill):
```tsx
// "ILP" / green pill — maps to "Live" state:
"text-xs font-normal text-green-800 dark:text-green-200 bg-green-100 dark:bg-green-900 rounded px-2 py-1"

// "Greedy" / zinc pill — maps to "Awaiting" state:
"text-xs font-normal text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1"
```

**Existing return block structure** (lines 179–196 — insertion point):
```tsx
  return (
    <div className="space-y-4">
      {/* Section A: Pre-Season Squad */}
      <div>
        <h3 className="text-xl font-semibold">Pre-Season Squad</h3>   {/* ← pill + banner go BEFORE this h3 */}
        {squadSection}
        {health !== null && <HealthIndicator health={health} />}
      </div>
      {/* Section B: GW1-8 FDR Heatmap */}
      ...
    </div>
  )
```

**New imports to add at top of file:**
```tsx
import { useState } from 'react'
import { usePreSeasonActive } from '@/lib/hooks/usePreSeasonActive'
```

**Hook call + derived state (inside component body, after existing `usePreSeasonSquad` call):**
```tsx
const { data: activeData } = usePreSeasonActive()
const isActive = activeData !== null && activeData !== undefined
const seasonId = activeData?.season_id ?? ''
```

**`dismissed` state — use reactive derivation to avoid stale-init hazard (Pitfall 3 in RESEARCH.md):**
```tsx
// Do NOT use useState lazy init for localStorage — seasonId is empty on first render.
// Derive inline inside render condition (see banner conditional below).
```

**Status pill placement — first element inside `<div className="space-y-4">`, before Section A:**
```tsx
{/* Phase 128 AUTO-03: Status pill — only render when activeData is not undefined (loaded) */}
{activeData !== undefined && (
  <div className="flex items-center gap-2">
    <span className={
      isActive
        ? "text-xs font-normal text-green-800 dark:text-green-200 bg-green-100 dark:bg-green-900 rounded px-2 py-1"
        : "text-xs font-normal text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1"
    }>
      {isActive ? 'Live' : 'Awaiting'}
    </span>
  </div>
)}
```

**Banner placement — between pill and Section A `<div>`, conditional on activation + localStorage key:**
```tsx
{/* Phase 128 AUTO-03: First-activation banner */}
{isActive && seasonId !== '' && typeof window !== 'undefined' &&
  localStorage.getItem(`fplx_nsp_activation_seen_${seasonId}`) !== 'true' && (
  <BannerDismissible seasonId={seasonId} />
)}
```

**Banner Tailwind classes (from 128-UI-SPEC.md):**
```tsx
// Banner container:
"rounded border border-green-400 bg-green-50 dark:bg-green-950 p-4 text-sm text-green-800 dark:text-green-200 mb-4 flex items-start justify-between"
// Dismiss button:
"ml-4 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
```

**Note on localStorage key:** Use `fplx_nsp_activation_seen_${seasonId}` to match the project's `fplx_` prefix convention (see RESEARCH.md Pitfall 5 and Open Question 1). This is permitted by the UI-SPEC and aligns with `fplx_watchlist`, `fplx_manual_plan`, `fplx_mini_league_id`.

---

### `pipeline/tests/test_suggest_squad.py` — NEW (test, batch)

**Analog:** `pipeline/tests/test_run_offseason.py` lines 1–60

**File header + replica-function pattern** (lines 1–49):
```python
"""Contract tests for pipeline/run.py IS_OFF_SEASON detection logic (Phase 123 WIN-03).
...
"""

# Replica functions (mirrors what Task 02 adds to run.py)

def _detect_is_off_season(bootstrap: dict) -> bool:
    """Replica of the run.py IS_OFF_SEASON detection — D-06 contract test."""
    events = bootstrap.get('events', [])
    return not any(e.get('is_current') for e in events)
```

**Test structure to mirror** (lines 57–106):
```python
def test_is_off_season_true_when_events_empty():
    """D-06: empty events list means no current GW — IS_OFF_SEASON is True."""
    result = _detect_is_off_season({'events': []})
    assert result is True
```

**New file should contain:**
- Module docstring referencing AUTO-02, D-03/D-04
- Replica function for idempotency check logic (separate from run.py)
- Test: `force=False` + artifact exists → skips (returns early)
- Test: `force=False` + artifact absent → proceeds (no early return)
- Test: `force=True` + artifact exists → proceeds (bypasses idempotency)
- Test: `force=True` + artifact absent → proceeds
- Tests for both blob path and local path branches
- Uses `unittest.mock.patch` on `os.path.exists` and `vercel_blob.list` (follow conftest.py sys.path pattern)

---

### `pipeline/tests/test_run_offseason.py` — MODIFY (test, batch)

**Analog:** `pipeline/tests/test_run_offseason.py` lines 1–106 (self-extension)

**Existing replica-function pattern to extend** (lines 28–49):
```python
def _detect_is_off_season(bootstrap: dict) -> bool:
    events = bootstrap.get('events', [])
    return not any(e.get('is_current') for e in events)
```

**Add new replica function for activation predicate:**
```python
def _evaluate_activation_predicate(events: list) -> bool:
    """Replica of Phase 128 AUTO-01 tri-state predicate in run.py.

    Production: (inside IS_OFF_SEASON block)
        len(events) >= 38
        and not any(e.get('finished') for e in events)
        and bool(events[0].get('deadline_time') if events else None)
    """
    return (
        len(events) >= 38
        and not any(e.get('finished') for e in events)
        and bool(events[0].get('deadline_time') if events else None)
    )
```

**Test cases to add (from RESEARCH.md Validation Architecture):**
- Predicate true when 38 events, none finished, events[0] has deadline_time
- Predicate false when events has any finished event
- Predicate false when len(events) < 38
- Predicate false when events[0].deadline_time absent
- Predicate false when events is empty (no IndexError — short-circuit guards this)

---

### `src/lib/hooks/usePreSeasonActive.test.ts` — NEW (test, request-response)

**Analog:** `src/lib/hooks/useWatchlist.test.ts` lines 1–60

**File header pattern** (lines 1–9):
```typescript
// @vitest-environment jsdom
// Phase 127 WATCH-01: Contract tests for useWatchlist hook.
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWatchlist } from './useWatchlist'

beforeEach(() => {
  localStorage.clear()
})
```

**New file header:**
```typescript
// @vitest-environment jsdom
// Phase 128 AUTO-03: Contract tests for usePreSeasonActive hook.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePreSeasonActive } from './usePreSeasonActive'
```

**TanStack Query wrapper pattern (needed for hooks using useQuery):**
```typescript
function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
```

**Test cases to implement (from RESEARCH.md Validation Architecture):**
- `usePreSeasonActive` returns `null` on 404 response (→ "Awaiting")
- `usePreSeasonActive` returns `PreSeasonActiveResponse` on 200 response
- `staleTime` is 60 000 ms (queryClient cache test)
- Banner localStorage key uses `fplx_nsp_activation_seen_{seasonId}` format

---

## Shared Patterns

### save() — Pipeline artifact write
**Source:** `pipeline/upload.py` lines 25–30
**Apply to:** `run.py` activation block (writing `pre_season_active.json`)
```python
def save(pathname: str, data):
    """Route save to Blob or local depending on USE_BLOB env var."""
    if os.getenv('USE_BLOB', '').lower() == 'true':
        upload_json(pathname, data)
    else:
        save_local(pathname, data)
```

### Non-fatal try/except wrapper
**Source:** `pipeline/run.py` lines 213–236 (IS_GW38 suggest_squad wrapper)
**Apply to:** `run.py` activation block
```python
        try:
            # ... activation logic
        except Exception as _pa_exc:
            print(f"[pipeline] Pre-season activation non-fatal error: {_pa_exc}", file=sys.stderr)
```

### readBlobOrLocal + 404 response
**Source:** `src/app/api/pre-season-squad/route.ts` lines 15–33, 53–57
**Apply to:** `src/app/api/pre-season-active/route.ts` (copy verbatim)
```typescript
// readBlobOrLocal: lines 15-33 (full function — copy verbatim)
// 404 pattern: return Response.json({ error: '...' }, { status: 404 })
```

### TanStack Query 404→null hook
**Source:** `src/lib/hooks/usePreSeasonSquad.ts` lines 8–19
**Apply to:** `src/lib/hooks/usePreSeasonActive.ts` (mirror, substitute endpoint + type + staleTime)

### Solver badge pill Tailwind classes
**Source:** `src/components/next-season/NextSeasonPlannerTab.tsx` lines 36–44
**Apply to:** Status pill in `NextSeasonPlannerTab.tsx` (green = "Live", zinc = "Awaiting")

### `@vitest-environment jsdom` + localStorage test setup
**Source:** `src/lib/hooks/useWatchlist.test.ts` lines 1–9
**Apply to:** `src/lib/hooks/usePreSeasonActive.test.ts`

### Replica-function contract test pattern
**Source:** `pipeline/tests/test_run_offseason.py` lines 23–49
**Apply to:** `pipeline/tests/test_suggest_squad.py` and new test class in `test_run_offseason.py`

---

## No Analog Found

None — every file in this phase has a direct analog or is a surgical extension of an existing file.

---

## Metadata

**Analog search scope:** `pipeline/`, `src/app/api/`, `src/lib/hooks/`, `src/components/next-season/`, `src/lib/types.ts`, `pipeline/tests/`
**Files scanned:** 9 analog files read
**Pattern extraction date:** 2026-05-20
