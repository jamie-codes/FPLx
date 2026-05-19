# Phase 127: Squad Health Diagnostics & Transfer Watchlist — Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 11 (7 new, 4 modified)
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `pipeline/squad_health.py` | pipeline-script | batch / transform | `pipeline/suggest_squad.py` | exact |
| `pipeline/run.py` | config / orchestrator | batch | `pipeline/run.py` (lines 205–236) | self (surgical edit) |
| `src/lib/types.ts` | model | — | `src/lib/types.ts` (lines 1096–1112) | self (additive) |
| `src/app/api/pre-season-squad/route.ts` | route | request-response | itself (lines 34–149) | self (surgical edit) |
| `src/lib/hooks/usePreSeasonSquad.ts` | hook | request-response | `src/lib/hooks/usePlayers.ts` | exact |
| `src/lib/hooks/useWatchlist.ts` | hook | event-driven | `src/app/page.tsx` localStorage patterns (lines 140–150) | role-match |
| `src/components/next-season/NextSeasonPlannerTab.tsx` | component | request-response | itself (153 lines) | self (surgical edit) |
| `src/components/gem-table/GemTable.tsx` | component | request-response | itself (lines 326–437) | self (surgical edit) |
| `src/app/page.tsx` | config / shell | event-driven | itself (lines 59–103, 140–163) | self (surgical edit) |
| `src/components/watchlist/WatchlistTab.tsx` | component | request-response | `src/components/news/SummerWindowTab.tsx` | role-match |
| `src/components/watchlist/WatchlistPlayerCard.tsx` | component | request-response | `src/components/next-season/NextSeasonPlannerTab.tsx` FormationGrid rows | partial-match |

---

## Pattern Assignments

### `pipeline/squad_health.py` (pipeline-script, batch)

**Analog:** `pipeline/suggest_squad.py`

**Imports pattern** (suggest_squad.py lines 25–29):
```python
import sys
from upload import save
import pulp  # not needed for squad_health.py — greedy only
```

For squad_health.py, the import block should be:
```python
import sys
import json
import os
from upload import save
```

**Bootstrap / player-pool loading pattern** (suggest_squad.py `_compute_score_map`, lines 50–80):
```python
def _compute_score_map(bootstrap: dict, archive: dict) -> dict:
    score_map = {}
    for element in bootstrap.get('elements', []):
        pid = element['id']
        player_data = archive.get(str(pid)) or archive.get(pid)
        if player_data is None:
            continue
        history = player_data.get('history', [])
        total_points = sum(gw.get('total_points', 0) for gw in history)
        total_minutes = sum(gw.get('minutes', 0) for gw in history)
        if total_minutes < MIN_MINUTES:
            continue
        ppm = total_points / total_minutes
        score_map[pid] = ppm
    return score_map
```

**Core greedy build pattern** — port from `src/lib/pre-season-squad.ts` lines 21–57:
```python
MIN_SLOTS = {1: 2, 2: 3, 3: 2, 4: 1}
MAX_SLOTS = {1: 2, 2: 5, 3: 5, 4: 3}
TEAM_CAP = 3

def _greedy_build(players: list, score_map: dict, budget: int) -> list | None:
    eligible = [p for p in players if p['id'] in score_map]
    eligible.sort(key=lambda p: (-score_map[p['id']], p['now_cost']))
    filled = {1: 0, 2: 0, 3: 0, 4: 0}
    team_count: dict = {}
    squad = []
    running_cost = 0
    for p in eligible:
        if len(squad) >= 15:
            break
        pos = p['element_type']
        if filled[pos] >= MAX_SLOTS[pos]:
            continue
        if team_count.get(p['team'], 0) >= TEAM_CAP:
            continue
        if running_cost + p['now_cost'] > budget:
            continue
        squad.append(p)
        filled[pos] += 1
        team_count[p['team']] = team_count.get(p['team'], 0) + 1
        running_cost += p['now_cost']
    if len(squad) < 15:
        return None
    for pos in [1, 2, 3, 4]:
        if filled[pos] < MIN_SLOTS[pos]:
            return None
    return squad
```

**Blob write pattern** (upload.py lines 25–30; suggest_squad.py line 331):
```python
save('pre_season_squad_health.json', health_dict)
```

**Error handling pattern** (run.py IS_GW38 block lines 205–236):
```python
try:
    from squad_health import compute_squad_health
    compute_squad_health(bootstrap)
    print("Squad health written.")
except Exception as sh_exc:
    print(f"[squad_health] non-fatal error: {sh_exc}", file=sys.stderr)
```

**Output shape** (from CONTEXT.md D-02, RESEARCH.md):
```python
health_dict = {
    'greedy_null_rate': float,       # count(None results) / 81
    'min_feasible_budget_greedy': float | None,  # £m (divide raw by 10), null if all fail
    'greedy_optimality_gap_avg': None,           # deferred (D-02)
    'budget_sweep_min': 80.0,
    'budget_sweep_max': 120.0,
    'budget_sweep_step': 0.5,
    'sweep_count': 81,
}
```

---

### `pipeline/run.py` (surgical edit — IS_GW38 block)

**Analog:** itself, lines 205–236

**Insertion point** — after `suggest_squad` try/except block (after line 236), inside `if IS_GW38:`:
```python
        try:
            from squad_health import compute_squad_health
            compute_squad_health(bootstrap)
            print("Squad health written.")
        except Exception as sh_exc:
            print(f"[squad_health] non-fatal error: {sh_exc}", file=sys.stderr)
```

The existing block structure to mirror exactly:
```python
if IS_GW38:
    try:
        from archive_season import archive_season
        archive_season(bootstrap)
    except Exception as arc_exc:
        print(f"[archive_season] non-fatal error: {arc_exc}", file=sys.stderr)

    try:
        from suggest_squad import suggest_squad
        # ... archive loading ...
        suggest_squad(bootstrap, _archive)
    except Exception as sq_exc:
        print(f"[suggest_squad] non-fatal error: {sq_exc}", file=sys.stderr)

    # squad_health goes here — same pattern, same block
```

---

### `src/lib/types.ts` (model — additive)

**Analog:** itself, lines 1096–1112 (`PreSeasonSquad`, `PreSeasonPlayer`)

**Existing PreSeasonSquad shape** (types.ts lines 1107–1112):
```typescript
export interface PreSeasonSquad {
  starters: PreSeasonPlayer[]
  bench: PreSeasonPlayer[]
  formation: string
  budgetUsed: number
}
```

**New types to add** (append after `PreSeasonSquad`):
```typescript
export interface SquadHealth {
  greedy_null_rate: number          // 0.0–1.0 fraction of 81 sweeps that returned null
  min_feasible_budget_greedy: number | null  // £m e.g. 83.5, null if all 81 fail
  greedy_optimality_gap_avg: null   // deferred (D-02); always null in Phase 127
  budget_sweep_min: number          // 80.0
  budget_sweep_max: number          // 120.0
  budget_sweep_step: number         // 0.5
  sweep_count: number               // 81
}

export interface PreSeasonSquadResponse {
  squad: PreSeasonSquad | null      // null when archive absent
  health: SquadHealth | null        // null until pipeline runs squad_health.py
  solver: 'ilp' | 'greedy' | null  // null when squad is null
}
```

---

### `src/app/api/pre-season-squad/route.ts` (route, request-response — surgical edit)

**Analog:** itself (lines 1–149)

**Existing readBlobOrLocal helper** (lines 14–32) — reuse directly, no changes:
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

**New import additions** (top of file, after existing imports):
```typescript
import type { PreSeasonPlayer, SeasonArchiveEntry, SquadHealth, PreSeasonSquadResponse } from '@/lib/types'
```

**Health side-read pattern** — replace the single `readBlobOrLocal` call at line 37 with `Promise.all`:
```typescript
// Resolution 1: prefer pre-computed ILP result — side-read health in parallel
const [preComputedData, healthData] = await Promise.all([
  readBlobOrLocal('pre_season_squad.json'),
  readBlobOrLocal('pre_season_squad_health.json'),  // null if absent (D-06)
])
const health: SquadHealth | null = healthData ? JSON.parse(healthData) : null
```

**Envelope response pattern** (replaces each `return Response.json(squad, ...)` call):
```typescript
// Resolution 1 path — was: return Response.json(squad, {...})
return Response.json({ squad, health, solver: 'ilp' } satisfies PreSeasonSquadResponse, {
  status: 200,
  headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
})

// Resolution 2 (greedy) path:
return Response.json({ squad, health, solver: 'greedy' } satisfies PreSeasonSquadResponse, {
  status: 200,
  headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
})

// 404 / 503 paths remain unchanged (no squad → no envelope needed, error object returned)
```

---

### `src/lib/hooks/usePreSeasonSquad.ts` (hook, request-response — modify)

**Analog:** `src/lib/hooks/usePlayers.ts` (exact TanStack Query pattern)

**Current implementation** (full file, 18 lines):
```typescript
import { useQuery } from '@tanstack/react-query'
import type { PreSeasonSquad } from '../types'

export function usePreSeasonSquad() {
  return useQuery<PreSeasonSquad | null>({
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

**After Phase 127 change** — only two lines change (import and generic type):
```typescript
import { useQuery } from '@tanstack/react-query'
import type { PreSeasonSquadResponse } from '../types'  // ← changed

export function usePreSeasonSquad() {
  return useQuery<PreSeasonSquadResponse | null>({       // ← changed
    queryKey: ['pre-season-squad'],
    queryFn: async () => {
      const res = await fetch('/api/pre-season-squad')
      if (res.status === 404) return null
      if (!res.ok) throw new Error('Failed to fetch pre-season squad')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000,
  })
}
```

**usePlayers.ts reference pattern** (full file, for structural alignment):
```typescript
import { useQuery } from '@tanstack/react-query'
import type { MergedPlayer } from '@/lib/types'

export function usePlayers() {
  return useQuery<MergedPlayer[]>({
    queryKey: ['players'],
    queryFn: fetchPlayers,
    staleTime: 1000 * 60 * 60 * 6,
  })
}
```

---

### `src/lib/hooks/useWatchlist.ts` (hook, event-driven — new)

**Analog:** `src/app/page.tsx` localStorage lazy-init pattern (lines 140–151)

**localStorage lazy-init pattern from page.tsx** (lines 140–150):
```typescript
const [teamId, setTeamId] = useState<string>(() => {
  try { return localStorage.getItem('fpl_team_id') ?? '' } catch { return '' }
})
// ...
try { localStorage.setItem('fpl_team_id', teamId.trim()) } catch {}
```

**Full hook implementation** (from RESEARCH.md Pattern 3 — verified against ManualPlanTab):
```typescript
import { useState, useCallback } from 'react'

const STORAGE_KEY = 'fplx_watchlist'

function loadWatchlist(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'number') : []
  } catch {
    return []
  }
}

export function useWatchlist() {
  const [watchlistIds, setWatchlistIds] = useState<number[]>(() => loadWatchlist())

  const toggleWatchlist = useCallback((id: number) => {
    setWatchlistIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  return { watchlistIds, toggleWatchlist }
}
```

Key constraints (D-09): `fplx_watchlist` stores `JSON.stringify(number[])` only — no timestamps, no metadata.

---

### `src/components/next-season/NextSeasonPlannerTab.tsx` (component — surgical edit)

**Analog:** itself (153 lines, read in full)

**Consumer update pattern** — all `data` references must become `data?.squad`:
```typescript
// Before (line 109):
squadSection = <FormationGrid squad={data} />

// After:
squadSection = <FormationGrid squad={data.squad} />

// Before (line 83):
const { data, isLoading, isError } = usePreSeasonSquad()
// data was PreSeasonSquad | null

// After (data is now PreSeasonSquadResponse | null):
const { data, isLoading, isError } = usePreSeasonSquad()
// null check: data === null (archive absent) OR data?.squad === null (envelope present, no squad)
```

**Solver badge pattern** — add to `FormationGrid` headline row (lines 29–33):
```tsx
// Solver badge: add as pill in the headline row div (className="text-sm ... flex flex-wrap items-center gap-2")
{solver === 'ilp' && (
  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">
    ILP
  </span>
)}
{solver === 'greedy' && (
  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
    Greedy
  </span>
)}
```

**Health indicator pattern** — add below `FormationGrid`, after the closing `</>` of the grid:
```tsx
{health && (
  <p className="text-xs text-zinc-500 dark:text-zinc-400 pt-2">
    Greedy success rate: {Math.round((1 - health.greedy_null_rate) * 100)}% across
    £{health.budget_sweep_min}m–£{health.budget_sweep_max}m budget sweep.
    {health.min_feasible_budget_greedy !== null && (
      <> Min feasible budget: £{health.min_feasible_budget_greedy.toFixed(1)}m.</>
    )}
  </p>
)}
```

**Existing loading/error/null state pattern** (lines 88–110) — follow exactly for new null states:
```tsx
} else if (data === null || data === undefined) {
  // null = 404 archive absent
  squadSection = <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4">...</p>
} else {
  // data.squad can still be null if envelope arrived but no squad
  squadSection = data.squad ? <FormationGrid squad={data.squad} /> : <p>...</p>
}
```

---

### `src/components/gem-table/GemTable.tsx` (component — surgical edit)

**Analog:** itself (lines 134–138, 317–437)

**Props interface extension** (lines 134–138):
```typescript
// Current:
interface GemTableProps {
  preset?: ViewPreset
  onPresetChange?: (p: ViewPreset) => void
  onCompare?: (player: ScoredPlayer) => void
}

// Add:
interface GemTableProps {
  preset?: ViewPreset
  onPresetChange?: (p: ViewPreset) => void
  onCompare?: (player: ScoredPlayer) => void
  watchlistIds?: number[]                          // ← new
  toggleWatchlist?: (id: number) => void           // ← new
}
```

**Star button action pattern** — matches existing action-sheet button style (lines 330–353):
```tsx
{/* Action row — FIRST child of both expand row <td> bodies (D-15) */}
<div className="flex items-center gap-2 mb-2">
  <button
    type="button"
    onClick={() => toggleWatchlist?.(row.original.id)}
    className={`text-xs cursor-pointer ${
      watchlistIds?.includes(row.original.id)
        ? 'text-amber-500'
        : 'text-zinc-600 dark:text-zinc-300'
    }`}
  >
    {watchlistIds?.includes(row.original.id) ? '⭐ Pinned' : '⭐ Pin to watchlist'}
  </button>
</div>
```

**Insertion points** (both must receive identical action row):
- Mobile: `<tr className="bg-blue-50 dark:bg-blue-950 sm:hidden">` → `<td ...>` at line 328, as first child before the `{actionSheetPlayer?.id === ...}` block
- Desktop: `<tr className="bg-blue-50 dark:bg-blue-950 hidden sm:table-row">` → `<td ...>` at line 404, as first child before `<RejectionPanelInline>`

---

### `src/app/page.tsx` (shell — surgical edit)

**Analog:** itself (lines 59–103, 140–163)

**SubTab union extension** (line 59):
```typescript
// Current:
export type SubTab = '...' | 'next-season'
// After: add 'watchlist' to the union
export type SubTab = '...' | 'next-season' | 'watchlist'
```

**SECTIONS Plan subTabs extension** (lines 81–89):
```typescript
// After the 'next-season' entry (line 88):
{ id: 'next-season' as SubTab, label: 'Next Season', mobileLabel: 'Pre-Season' },
{ id: 'watchlist' as SubTab,  label: 'Watchlist',    mobileLabel: 'Watchlist'  },  // ← new
```

**localStorage state pattern** (lines 140–163) — useWatchlist follows same shape:
```typescript
// Existing teamId pattern (mirror for watchlistIds):
const [teamId, setTeamId] = useState<string>(() => {
  try { return localStorage.getItem('fpl_team_id') ?? '' } catch { return '' }
})

// useWatchlist goes at the same level, after planHorizon (line 163):
const { watchlistIds, toggleWatchlist } = useWatchlist()
```

**Render block extension** (lines 294–297 pattern):
```tsx
// Existing pattern to mirror:
{activeSection === 'plan' && activeSubTab === 'next-season' && (
  <NextSeasonPlannerTab />
)}

// New block, added after:
{activeSection === 'plan' && activeSubTab === 'watchlist' && (
  <WatchlistTab watchlistIds={watchlistIds} toggleWatchlist={toggleWatchlist} />
)}
```

---

### `src/components/watchlist/WatchlistTab.tsx` (component, request-response — new)

**Analog:** `src/components/news/SummerWindowTab.tsx` (loading/error/empty state structure)

**Imports pattern** (SummerWindowTab.tsx lines 1–11 adapted):
```typescript
'use client'

import { useMemo } from 'react'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useLineupNews } from '@/lib/hooks/useLineupNews'
import { usePreSeasonSquad } from '@/lib/hooks/usePreSeasonSquad'
import { WatchlistPlayerCard } from './WatchlistPlayerCard'
import type { MergedPlayer } from '@/lib/types'
```

**Loading skeleton pattern** (SummerWindowTab.tsx lines 53–71):
```tsx
if (isLoading) {
  return (
    <section className="mt-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
        ))}
      </div>
    </section>
  )
}
```

**Error state pattern** (SummerWindowTab.tsx lines 74–80):
```tsx
if (isError) {
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
      <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">Failed to load players.</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Refresh the page or try again later.</p>
    </div>
  )
}
```

**Empty state pattern** (from CONTEXT.md specifics):
```tsx
if (watchlistIds.length === 0) {
  return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4">
      No players pinned yet. Tap ⭐ on any player in Gem Ratings to add them here.
    </p>
  )
}
```

**Three-hook data assembly pattern** (D-11 — all stale-cached, no extra fetches):
```typescript
const { data: playersData, isLoading, isError } = usePlayers()
const { data: lineupNewsMap } = useLineupNews()
const { data: squadData } = usePreSeasonSquad()

// Departed detection (D-09): IDs in watchlist but not in /api/players response
const playerMap = useMemo(
  () => new Map((playersData ?? []).map(p => [p.id, p])),
  [playersData]
)
const departedIds = new Set(watchlistIds.filter(id => !playerMap.has(id)))

// Squad overlap set (D-12): starters + bench IDs, graceful if squad null
const squadIds = useMemo(() => {
  const sq = squadData?.squad
  if (!sq) return new Set<number>()
  return new Set([...sq.starters, ...sq.bench].map(p => p.id))
}, [squadData])

// Position sort: GK(1) → DEF(2) → MID(3) → FWD(4), departed at end
const sortedPlayers = useMemo(() => {
  const present = watchlistIds
    .filter(id => playerMap.has(id))
    .map(id => playerMap.get(id)!)
    .sort((a, b) => a.element_type - b.element_type)
  return [...present, ...Array.from(departedIds)]
}, [watchlistIds, playerMap, departedIds])
```

**Grid layout** (2-col mobile / 3-col desktop, matching CONTEXT.md):
```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
  {/* cards */}
</div>
```

---

### `src/components/watchlist/WatchlistPlayerCard.tsx` (component — new)

**Analog:** `src/components/next-season/NextSeasonPlannerTab.tsx` FormationGrid player rows (lines 44–58) — partial match; card is self-contained per D-14

**Card structure pattern** (based on FormationGrid row styling):
```tsx
const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

// Amber border (D-13): present when lineupNewsMap has entry with non-null news_headline
// lineupNewsMap is undefined when >48h stale — no border when undefined
const hasNews = lineupNewsMap != null
  && lineupNewsMap.has(player.id)
  && lineupNewsMap.get(player.id)!.news_headline != null

// Overlap dot (D-12): dot shown when player.id in squadIds
const inSquad = squadIds.has(player.id)

// Price trend arrow (D-14): from cost_change_event on MergedPlayer
const trendArrow = player.cost_change_event > 0 ? '▲' : player.cost_change_event < 0 ? '▼' : null
const trendCls = player.cost_change_event > 0
  ? 'text-green-600 dark:text-green-400'
  : 'text-red-500 dark:text-red-400'
```

**Card border and muted state pattern** (Tailwind, from zinc/amber conventions in the codebase):
```tsx
<div
  className={`rounded border p-3 text-sm space-y-1 ${
    departed
      ? 'opacity-50 border-zinc-200 dark:border-zinc-700'
      : hasNews
        ? 'border-amber-400 dark:border-amber-500'
        : 'border-zinc-200 dark:border-zinc-700'
  } bg-white dark:bg-zinc-800`}
>
```

**Departed pill pattern** (consistent with existing status pill styling in the codebase):
```tsx
{departed && (
  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
    Departed
  </span>
)}
```

**Squad overlap dot** (small inline indicator):
```tsx
{inSquad && (
  <span className="inline-block w-2 h-2 rounded-full bg-green-500 ml-1" title="In your pre-season squad" />
)}
```

---

## Test Pattern Assignments

### `pipeline/tests/test_squad_health.py` (new)

**Analog:** `pipeline/tests/test_run_offseason.py` (replica function + contract test pattern)

**Test structure pattern** (test_run_offseason.py lines 1–60):
```python
"""Contract tests for pipeline/squad_health.py (Phase 127 GREEDY-01)."""

# Import style: bare name (conftest.py sys.path injection)
from squad_health import _greedy_build, compute_squad_health  # after file exists

def _make_players(n_gk=2, n_def=5, n_mid=5, n_fwd=3, base_cost=60) -> list:
    """Minimal player factory for sweep tests."""
    players = []
    pid = 1
    for pos, count in [(1, n_gk), (2, n_def), (3, n_mid), (4, n_fwd)]:
        for _ in range(count):
            players.append({'id': pid, 'element_type': pos, 'team': pid, 'now_cost': base_cost})
            pid += 1
    return players

def test_greedy_build_returns_squad_within_budget():
    ...

def test_greedy_null_rate_zero_when_all_succeed():
    ...

def test_min_feasible_budget_null_when_all_fail():
    ...
```

### `src/lib/hooks/useWatchlist.test.ts` (new)

**Analog:** existing hook tests — vitest + jsdom

**Test structure pattern** (from NextSeasonPlannerTab.test.tsx and vitest conventions):
```typescript
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWatchlist } from './useWatchlist'

beforeEach(() => localStorage.clear())

it('initialises empty when localStorage has no key', () => {
  const { result } = renderHook(() => useWatchlist())
  expect(result.current.watchlistIds).toEqual([])
})

it('toggle adds ID when absent', () => {
  const { result } = renderHook(() => useWatchlist())
  act(() => result.current.toggleWatchlist(42))
  expect(result.current.watchlistIds).toContain(42)
})

it('toggle removes ID when present', () => {
  localStorage.setItem('fplx_watchlist', JSON.stringify([42]))
  const { result } = renderHook(() => useWatchlist())
  act(() => result.current.toggleWatchlist(42))
  expect(result.current.watchlistIds).not.toContain(42)
})
```

### `src/components/watchlist/WatchlistPlayerCard.test.tsx` (new)

**Analog:** `src/components/next-season/NextSeasonPlannerTab.test.tsx`

**Test structure pattern** (NextSeasonPlannerTab.test.tsx lines 1–15):
```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { WatchlistPlayerCard } from './WatchlistPlayerCard'

// Factory for MergedPlayer subset
function makePlayer(overrides = {}) { ... }

it('renders Departed pill when departed=true', ...)
it('applies amber border when hasNews=true', ...)
it('renders squad overlap dot when inSquad=true', ...)
it('renders price trend arrow when cost_change_event !== 0', ...)
it('renders normal state when no flags set', ...)
```

### `src/components/watchlist/WatchlistTab.test.tsx` (new)

**Analog:** `src/components/next-season/NextSeasonPlannerTab.test.tsx` (vi.mock pattern for hooks)

**Mock pattern** (NextSeasonPlannerTab.test.tsx lines 9–12):
```typescript
const usePlayers = vi.fn()
const useLineupNews = vi.fn()
const usePreSeasonSquad = vi.fn()
vi.mock('@/lib/hooks/usePlayers', () => ({ usePlayers: () => usePlayers() }))
vi.mock('@/lib/hooks/useLineupNews', () => ({ useLineupNews: () => useLineupNews() }))
vi.mock('@/lib/hooks/usePreSeasonSquad', () => ({ usePreSeasonSquad: () => usePreSeasonSquad() }))
```

---

## Shared Patterns

### TanStack Query hook shape
**Source:** `src/lib/hooks/usePlayers.ts`, `src/lib/hooks/useLineupNews.ts`, `src/lib/hooks/usePreSeasonSquad.ts`
**Apply to:** `useWatchlist.ts` (initialiser shape), all hooks referenced from `WatchlistTab`
```typescript
return useQuery<T>({
  queryKey: ['key'],
  queryFn: async () => { ... },
  staleTime: 6 * 60 * 60 * 1000,  // 6h — project standard
})
```

### localStorage try/catch safe-read/write
**Source:** `src/app/page.tsx` lines 140–150
**Apply to:** `useWatchlist.ts` (init + toggle write)
```typescript
// Read: lazy useState initialiser
useState<T>(() => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? default } catch { return default } })
// Write: fire-and-forget
try { localStorage.setItem(KEY, JSON.stringify(value)) } catch {}
```

### Component loading/error/empty state
**Source:** `src/components/news/SummerWindowTab.tsx` lines 53–80
**Apply to:** `WatchlistTab.tsx`
Three ordered guards: `if (isLoading)` → skeleton, `if (isError)` → error card, `if (empty)` → empty-state text.

### Pipeline non-fatal error wrapper
**Source:** `pipeline/run.py` IS_GW38 block (lines 205–236)
**Apply to:** `pipeline/run.py` squad_health insertion, `pipeline/squad_health.py` internal error handling
```python
try:
    from module import function
    function(bootstrap)
    print("Step complete.")
except Exception as exc:
    print(f"[module] non-fatal error: {exc}", file=sys.stderr)
```

### Python `save()` blob/local routing
**Source:** `pipeline/upload.py` lines 25–30
**Apply to:** `pipeline/squad_health.py` (write `pre_season_squad_health.json`)
```python
from upload import save
save('pre_season_squad_health.json', health_dict)  # routes to blob or local automatically
```

### Pill / badge component styling
**Source:** `src/components/next-season/NextSeasonPlannerTab.tsx` (headline row), `src/components/news/SummerWindowTab.tsx` filter pills
**Apply to:** `WatchlistPlayerCard.tsx` (Departed pill, solver badge in `NextSeasonPlannerTab`)
```tsx
// Zinc muted pill (departed / greedy):
<span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
  Label
</span>
// Teal active pill (ILP):
<span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">
  ILP
</span>
```

### RTL test mock pattern
**Source:** `src/components/next-season/NextSeasonPlannerTab.test.tsx` lines 9–12
**Apply to:** `WatchlistTab.test.tsx`, `WatchlistPlayerCard.test.tsx`
```typescript
const mockFn = vi.fn()
vi.mock('@/lib/hooks/useHook', () => ({ useHook: () => mockFn() }))
// Import component AFTER vi.mock calls
import { Component } from './Component'
```

---

## No Analog Found

All files have analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `src/app/api/`, `src/lib/hooks/`, `src/components/`, `pipeline/`, `pipeline/tests/`
**Files scanned:** 20
**Pattern extraction date:** 2026-05-19
