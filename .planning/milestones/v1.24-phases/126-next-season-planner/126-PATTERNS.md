# Phase 126: Next Season Planner - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 12 (8 new, 4 modified)
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `pipeline/archive_season.py` | pipeline-step | batch / file-I/O | `pipeline/lineup_news.py` | role-match |
| `pipeline/suggest_squad.py` | pipeline-step | batch / transform | `pipeline/lineup_news.py` | role-match |
| `pipeline/requirements.txt` | config | — | `pipeline/requirements.txt` (existing) | exact |
| `pipeline/run.py` (modify) | pipeline-entry | event-driven | `pipeline/run.py` IS_OFF_SEASON gate block | exact |
| `src/lib/pre-season-squad.ts` | utility / lib | transform | `src/lib/chip-modes.ts` | exact |
| `src/lib/pre-season-squad.test.ts` | test | — | `src/lib/chip-modes.test.ts` | exact |
| `src/lib/hooks/usePreSeasonSquad.ts` | hook | request-response | `src/lib/hooks/useTransferNews.ts` | exact |
| `src/app/api/pre-season-squad/route.ts` | API route | request-response | `src/app/api/transfer-news/route.ts` | exact |
| `src/components/club-form/FixtureHeatMap.tsx` (modify) | component | — | itself (export HeatMapRow) | exact |
| `src/components/next-season/NextSeasonPlannerTab.tsx` | component | request-response | `src/components/optimiser/ChipSquadView.tsx` | role-match |
| `src/components/next-season/NextSeasonPlannerTab.test.tsx` | test | — | `src/components/optimiser/OptimiserPanel.test.tsx` | role-match |
| `src/app/page.tsx` (modify) | config / routing | — | `src/app/page.tsx` lines 57-98, 287 | exact |

---

## Pattern Assignments

### `pipeline/archive_season.py` (pipeline-step, batch/file-I/O)

**Analog:** `pipeline/lineup_news.py` (non-fatal isolation pattern), `pipeline/upload.py` (save()), `pipeline/run.py` (IS_OFF_SEASON gate structure)

**Imports pattern** (`pipeline/upload.py` lines 1-4; `pipeline/lineup_news.py` lines 20-28):
```python
import sys
import json
import concurrent.futures
import vercel_blob
from upload import save
```

**Idempotency check — run FIRST in archive_season():**
```python
# Source: pipeline/upload.py + vercel_blob SDK; must be the FIRST statement in archive_season()
import vercel_blob

def _blob_exists(pathname: str) -> bool:
    """Return True if pathname exists in Vercel Blob."""
    result = vercel_blob.list({'prefix': pathname, 'limit': 1})
    return len(result.get('blobs', [])) > 0

def archive_season(bootstrap: dict) -> None:
    if _blob_exists('season_archive_gw38.json'):
        print("[archive_season] already exists — skipping.")
        return
    # ... rest of fetch loop
```

**Concurrent fetch pattern** (new in Phase 126; stdlib only):
```python
# Source: Python stdlib concurrent.futures (ThreadPoolExecutor — requests already in requirements.txt)
# aiohttp is NOT available; use ThreadPoolExecutor wrapping synchronous requests calls.
MAX_WORKERS = 10

def _fetch_one(player_id: int) -> tuple:
    """Fetch element-summary for one player. Returns (id, data_or_None)."""
    try:
        from fpl_client import get_element_summary
        return (player_id, get_element_summary(player_id))
    except Exception as exc:
        print(f"[archive_season] player {player_id} failed: {exc}", file=sys.stderr)
        return (player_id, None)

def _fetch_all_summaries(elements: list) -> dict:
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(_fetch_one, el['id']): el['id'] for el in elements}
        for future in concurrent.futures.as_completed(futures):
            pid, data = future.result()
            if data is not None:
                results[pid] = data
    return results
```

**Partial-write guard (>= 50% success threshold):**
```python
# Source: D-10 decision; mirrors per-source isolation in lineup_news.py lines 152-160
total = len(elements)
if len(results) < total * 0.5:
    print(f"[archive_season] < 50% players fetched ({len(results)}/{total}) — skipping Blob write.", file=sys.stderr)
    return
save('season_archive_gw38.json', results)
print(f"Season archive written: {len(results)}/{total} players.")
```

**Non-fatal outer wrapper (called from run.py):**
```python
# Source: pipeline/run.py lines 153-158 (lineup_news non-fatal block pattern — exact)
try:
    from archive_season import archive_season
    archive_season(bootstrap)
    print("Season archive written.")
except Exception as arc_exc:
    print(f"[archive_season] non-fatal error: {arc_exc}", file=sys.stderr)
```

---

### `pipeline/run.py` (modify — add GW38 gate)

**Analog:** `pipeline/run.py` lines 144-151 (IS_OFF_SEASON gate block)

**GW38 detection + gate insertion point:**
```python
# Source: pipeline/run.py lines 144-151 (IS_OFF_SEASON pattern — exact)
# CRITICAL: Place the GW38 block BEFORE the IS_OFF_SEASON block.
# During GW38, is_current IS set (IS_OFF_SEASON=False). After rollover,
# is_current is unset (IS_OFF_SEASON=True) and the opportunity is gone.

events = bootstrap.get('events', [])
IS_OFF_SEASON = not any(e.get('is_current') for e in events)  # existing line 148

# --- INSERT THIS BLOCK before the IS_OFF_SEASON block at line 202 ---
current_event_entry = next((e for e in events if e.get('is_current')), None)
last_event_id = max((e['id'] for e in events), default=0)
CURRENT_GW = current_event_entry['id'] if current_event_entry else 0
IS_GW38 = (CURRENT_GW > 0) and (CURRENT_GW == last_event_id)

if IS_GW38:
    try:
        from archive_season import archive_season
        archive_season(bootstrap)
        print("Season archive written.")
    except Exception as arc_exc:
        print(f"[archive_season] non-fatal error: {arc_exc}", file=sys.stderr)
# --- END INSERT ---

# Existing IS_OFF_SEASON block follows immediately after (line 202 onward)
if not IS_OFF_SEASON:
    ...
```

---

### `pipeline/suggest_squad.py` (pipeline-step, batch/transform)

**Analog:** `pipeline/lineup_news.py` (module structure: public function + upload.py save()); `pipeline/run.py` (non-fatal invocation)

**Module structure pattern** (`pipeline/lineup_news.py` lines 1-30):
```python
"""ILP fallback squad builder for pre-season planning (Phase 126 NSP-02).

Public API:
  suggest_squad(bootstrap: dict, archive: dict) -> None
      Reads season_archive_gw38.json player data, applies PuLP ILP solver,
      writes pre_season_squad.json to Vercel Blob or local cache.
      Non-fatal: errors logged, pipeline continues.
"""

import sys
import json
from upload import save

# pulp must be in pipeline/requirements.txt: pulp>=2.7.0
import pulp
```

**PuLP ILP pattern (new):**
```python
# PuLP is not in requirements.txt yet — add `pulp>=2.7.0` before implementing.
# PuLP bundles COIN-BC solver. See: https://coin-or.github.io/pulp/
import pulp

def _solve_ilp(players: list, score_map: dict, budget: int = 1000, team_cap: int = 3) -> list | None:
    """Return list of 15 selected player dicts, or None if infeasible."""
    prob = pulp.LpProblem("PreSeasonSquad", pulp.LpMaximize)
    x = {p['id']: pulp.LpVariable(f"x_{p['id']}", cat='Binary') for p in players}

    # Objective: maximise total ppm
    prob += pulp.lpSum(score_map.get(p['id'], 0) * x[p['id']] for p in players)

    # Budget constraint (tenths of £1m)
    prob += pulp.lpSum(p['now_cost'] * x[p['id']] for p in players) <= budget

    # Squad size = 15
    prob += pulp.lpSum(x[p['id']] for p in players) == 15

    # Position quotas
    MIN_SLOTS = {1: 2, 2: 3, 3: 2, 4: 1}
    MAX_SLOTS = {1: 2, 2: 5, 3: 5, 4: 3}
    for pos in [1, 2, 3, 4]:
        pos_players = [p for p in players if p['element_type'] == pos]
        prob += pulp.lpSum(x[p['id']] for p in pos_players) >= MIN_SLOTS[pos]
        prob += pulp.lpSum(x[p['id']] for p in pos_players) <= MAX_SLOTS[pos]

    # Team cap
    teams = {p['team'] for p in players}
    for team in teams:
        team_players = [p for p in players if p['team'] == team]
        prob += pulp.lpSum(x[p['id']] for p in team_players) <= team_cap

    prob.solve(pulp.PULP_CBC_CMD(msg=0))

    if pulp.LpStatus[prob.status] != 'Optimal':
        return None
    return [p for p in players if pulp.value(x[p['id']]) == 1]
```

---

### `src/lib/pre-season-squad.ts` (utility/lib, transform)

**Analog:** `src/lib/chip-modes.ts` (exact — greedy squad builder pattern)

**Imports pattern** (`src/lib/chip-modes.ts` lines 1-6):
```typescript
// No 'use client', no React, no side effects. @vitest-environment node tests.
import type { PositionCode } from './types'  // or define inline — check existing types.ts
```

**Core greedy pattern** (`src/lib/chip-modes.ts` lines 37-108):
```typescript
// Source: src/lib/chip-modes.ts lines 12-108 — adapt for scoreMap eligibility
// KEY DIFFERENCES from buildOptimalSquad():
//   1. Eligibility = scoreMap.has(p.id) — NOT status === 'a' (off-season status unreliable)
//   2. Score = scoreMap.get(p.id) — NOT p[horizonField]
//   3. Budget always 1000 (100m); no horizon parameter
//   4. Return type is PreSeasonSquad | null, not ChipSquadResult | null

const MIN_SLOTS: Record<number, number> = { 1: 2, 2: 3, 3: 2, 4: 1 }  // line 15
const MAX_SLOTS: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 }  // line 16

export function buildPreSeasonSquad(
  players: PreSeasonPlayer[],
  scoreMap: Map<number, number>,  // id -> ppm (only players with >= 500 min)
  budget = 1000,
  teamCap = 3,
): PreSeasonSquad | null {
  const eligible = players.filter(p => scoreMap.has(p.id))

  const sorted = [...eligible].sort((a, b) => {
    const diff = (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0)
    return diff !== 0 ? diff : a.now_cost - b.now_cost  // tie-break: cheaper wins
  })

  const filledSlots: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const teamCount = new Map<number, number>()
  const squad: PreSeasonPlayer[] = []
  let runningCost = 0

  for (const player of sorted) {
    if (squad.length >= 15) break
    const pos = player.element_type
    if ((filledSlots[pos] ?? 0) >= MAX_SLOTS[pos]) continue
    if ((teamCount.get(player.team) ?? 0) >= teamCap) continue
    if (runningCost + player.now_cost > budget) continue
    squad.push(player)
    filledSlots[pos]++
    teamCount.set(player.team, (teamCount.get(player.team) ?? 0) + 1)
    runningCost += player.now_cost
  }

  if (squad.length < 15) return null
  for (const pos of [1, 2, 3, 4] as const) {
    if ((filledSlots[pos] ?? 0) < MIN_SLOTS[pos]) return null
  }

  // Derive starters via optimiseLineup() or a simple position-max XI derivation
  // ... return { starters, bench, formation, budgetUsed: runningCost }
}
```

**Type definitions (new — add to `src/lib/types.ts` or define inline):**
```typescript
// Source: RESEARCH.md Pattern 4 — new types needed
export interface PreSeasonPlayer {
  id: number
  web_name: string
  element_type: 1 | 2 | 3 | 4  // PositionCode
  team: number
  team_short_name: string
  now_cost: number       // tenths of £1m (GW38 archive price)
  total_points: number   // last-season total (display field on card)
  ppm: number            // points_per_minute (tooltip signal)
}

export interface PreSeasonSquad {
  starters: PreSeasonPlayer[]  // 11 in best XI
  bench: PreSeasonPlayer[]     // 4
  formation: string
  budgetUsed: number           // tenths of £1m
}
```

---

### `src/lib/pre-season-squad.test.ts` (test)

**Analog:** `src/lib/chip-modes.test.ts` (exact — same greedy function test pattern)

**File header + environment directive** (`src/lib/chip-modes.test.ts` lines 1-5):
```typescript
// @vitest-environment node
// Phase 126 (NSP-02): unit tests for buildPreSeasonSquad.
// Wave 0: all tests RED (skeleton). Wave 1: GREEN.
import { describe, it, expect } from 'vitest'
import { buildPreSeasonSquad } from './pre-season-squad'
```

**Player factory pattern** (`src/lib/chip-modes.test.ts` lines 9-64):
```typescript
// Minimal PreSeasonPlayer factory — only fields used by buildPreSeasonSquad
function makePreSeasonPlayer(overrides: {
  id: number
  element_type: 1 | 2 | 3 | 4
  team?: number
  now_cost?: number
  ppm?: number
  total_points?: number
}): PreSeasonPlayer {
  return {
    id: overrides.id,
    web_name: `P${overrides.id}`,
    element_type: overrides.element_type,
    team: overrides.team ?? 1,
    team_short_name: 'T1',
    now_cost: overrides.now_cost ?? 50,
    total_points: overrides.total_points ?? 100,
    ppm: overrides.ppm ?? 0.5,
  }
}
```

**Test cases to cover** (from RESEARCH.md Validation Architecture):
- `buildPreSeasonSquad()` returns valid 15-player squad at 100m budget
- `buildPreSeasonSquad()` returns null when budget insufficient
- `buildPreSeasonSquad()` excludes players not in scoreMap (< 500 min proxy)

---

### `src/lib/hooks/usePreSeasonSquad.ts` (hook, request-response)

**Analog:** `src/lib/hooks/useTransferNews.ts` (exact match — same staleTime, same Blob-backed API pattern)

**Full pattern** (`src/lib/hooks/useTransferNews.ts` lines 1-14):
```typescript
import { useQuery } from '@tanstack/react-query'
import type { PreSeasonSquad } from '../types'

export function usePreSeasonSquad() {
  return useQuery<PreSeasonSquad | null>({
    queryKey: ['pre-season-squad'],
    queryFn: async () => {
      const res = await fetch('/api/pre-season-squad')
      if (res.status === 404) return null   // archive absent → "Prices pending"
      if (!res.ok) throw new Error('Failed to fetch pre-season squad')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000,  // 6h — mirrors useTransferNews.ts line 12
  })
}
```

Note: `useTransferNews.ts` throws on non-ok; `usePreSeasonSquad` must return `null` on 404 specifically (not throw) to enable the "Prices pending" state distinction.

---

### `src/app/api/pre-season-squad/route.ts` (API route, request-response)

**Analog:** `src/app/api/transfer-news/route.ts` (exact — same Blob list + fetch + local fallback pattern)

**Full structure** (`src/app/api/transfer-news/route.ts` lines 1-42 — adapt blob key and processing):
```typescript
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { buildPreSeasonSquad } from '@/lib/pre-season-squad'
import type { PreSeasonPlayer } from '@/lib/types'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let data: string

    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'season_archive_gw38.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'Archive not available' }, { status: 404 })
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
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'season_archive_gw38.json')
      data = await readFile(cachePath, 'utf-8')
    }

    const archive = JSON.parse(data)
    // Compute scoreMap (ppm) from archive; exclude players with < 500 total_minutes
    // Build squad via buildPreSeasonSquad(); 404 on null (ILP fallback not yet computed)
    return Response.json(squad, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  } catch (err) {
    const isNotFound =
      err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
    if (isNotFound) {
      return Response.json({ error: 'Archive not available' }, { status: 404 })
    }
    return Response.json({ error: 'Failed to load pre-season squad' }, { status: 500 })
  }
}
```

---

### `src/components/club-form/FixtureHeatMap.tsx` (modify — export HeatMapRow)

**Change:** Add `export` to `HeatMapRow` function declaration (line 54) and `HeatMapRowProps` interface (line 42).

**Before** (`FixtureHeatMap.tsx` lines 42 and 54):
```typescript
interface HeatMapRowProps {          // line 42 — currently unexported
  ...
}

function HeatMapRow({ t, grid, mode, tierMap, ownedTeamIds }: HeatMapRowProps) {  // line 54
```

**After:**
```typescript
export interface HeatMapRowProps {   // add `export`
  ...
}

export function HeatMapRow({ t, grid, mode, tierMap, ownedTeamIds }: HeatMapRowProps) {  // add `export`
```

Both the interface and the function must be exported (Pitfall 5 in RESEARCH.md: TypeScript error if only the function is exported).

---

### `src/components/next-season/NextSeasonPlannerTab.tsx` (component, request-response)

**Analog:** `src/components/optimiser/ChipSquadView.tsx` (formation grid layout) + `src/components/club-form/FixtureHeatMap.tsx` (heatmap reuse)

**File header + imports pattern** (`src/components/optimiser/ChipSquadView.tsx` lines 1-7):
```typescript
'use client'

// Phase 126 (NSP-04): NextSeasonPlannerTab — read-only pre-season squad display.
import { Fragment } from 'react'
import { usePreSeasonSquad } from '@/lib/hooks/usePreSeasonSquad'
import { HeatMapRow } from '@/components/club-form/FixtureHeatMap'
import type { HeatMapRowProps } from '@/components/club-form/FixtureHeatMap'
import type { PreSeasonSquad, PreSeasonPlayer } from '@/lib/types'
```

**Graceful empty state pattern** (`src/components/club-form/FixtureHeatMap.tsx` lines 258-274):
```typescript
// "Prices pending" state when archive is absent (usePreSeasonSquad returns null)
if (!data) {
  return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4">
      Pre-season squad builder will be available once the season archive is ready.
      Check back after GW38.
    </p>
  )
}
```

**Formation grid display pattern** (`src/components/optimiser/ChipSquadView.tsx` lines 13-106):
```typescript
// Source: ChipSquadView.tsx lines 13-106 — adapt for PreSeasonPlayer (no xPts field; show total_points)
const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
const POSITION_ORDER = [1, 2, 3, 4]

// XI rows (position-grouped, D-05):
{POSITION_ORDER.map(pos => {
  const group = startersByPosition[pos] ?? []
  if (group.length === 0) return null
  return (
    <Fragment key={pos}>
      <div className="text-[10px] font-semibold uppercase text-zinc-500 dark:text-zinc-400 pt-2 pb-0.5 bg-zinc-50 dark:bg-zinc-800/40 px-1">
        {POSITION_LABELS[pos]}
      </div>
      {group.map(p => (
        <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800 pl-2 text-sm">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{p.web_name}</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            <span>{p.team_short_name}</span>
            <span className="ml-2">£{(p.now_cost / 10).toFixed(1)}m</span>
            <span className="ml-2">{p.total_points}pts</span>
            {/* ppm shown as tooltip only — D-06 */}
          </span>
        </div>
      ))}
    </Fragment>
  )
})}

{/* Bench section — same dimmed style as ChipSquadView.tsx lines 89-104 */}
<div className="text-[10px] font-semibold uppercase text-zinc-500 dark:text-zinc-400 pt-2 pb-0.5 bg-zinc-50 dark:bg-zinc-800/40 px-1">
  Bench
</div>
{data.bench.map(p => (
  <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800 opacity-60 pl-2 text-sm">
    ...
  </div>
))}
```

**FDR heatmap "Fixtures not yet published" empty state:**
```typescript
// Detection: fixtures.length === 0 || fixtures.every(f => f.finished)
// When next-season fixtures not yet published, show:
<p className="text-sm text-zinc-500 dark:text-zinc-400 py-2">
  Fixtures not yet published for next season.
</p>
```

---

### `src/components/next-season/NextSeasonPlannerTab.test.tsx` (test)

**Analog:** `src/components/optimiser/OptimiserPanel.test.tsx` (hook-mock + RTL render pattern)

**File header + mock setup** (`src/components/optimiser/OptimiserPanel.test.tsx` lines 1-51):
```typescript
// @vitest-environment jsdom
// Phase 126 (NSP-03, NSP-04): NextSeasonPlannerTab RTL integration tests.
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// Mock usePreSeasonSquad hook
const usePreSeasonSquadMock = vi.fn()
vi.mock('@/lib/hooks/usePreSeasonSquad', () => ({
  usePreSeasonSquad: () => usePreSeasonSquadMock(),
}))

// Test cases:
// - renders "Prices pending" when hook returns null (D-03)
// - renders formation grid when data is present (D-04, D-05)
// - renders "Fixtures not yet published" when no next-season fixtures (D-12)
```

---

### `src/app/page.tsx` (modify — add 'next-season' SubTab)

**Analog:** `src/app/page.tsx` lines 57-102, 287 (Phase 125 'window' tab is the exact recent example)

**Step 1 — extend SubTab union** (`src/app/page.tsx` line 58):
```typescript
// Current (line 58):
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'manual-plan' | 'route-tree' | 'club-form' | 'value-gems' | 'accuracy' | 'season' | 'window' | 'decision' | 'transfers' | 'optimiser' | 'price-changes' | 'rivals' | 'lineup' | 'review' | 'rank-sim'
// After (append 'next-season' at end):
export type SubTab = ... | 'rank-sim' | 'next-season'
```

**Step 2 — add to Plan SECTIONS subTabs** (`src/app/page.tsx` lines 80-87 — after 'rivals'):
```typescript
// Current Plan subTabs ends with (line 86):
{ id: 'rivals' as SubTab, label: 'Rivals', mobileLabel: 'Rivals' },
// Add after:
{ id: 'next-season' as SubTab, label: 'Next Season', mobileLabel: 'Pre-Season' },
```

**Step 3 — add render condition** (`src/app/page.tsx` line 290-292, same structure as 'rivals' block):
```typescript
// Source: src/app/page.tsx line 290-291 (rivals pattern — exact)
{activeSection === 'plan' && activeSubTab === 'rivals' && (
  <RivalsTab submittedId={submittedId} />
)}
// Add after:
{activeSection === 'plan' && activeSubTab === 'next-season' && (
  <NextSeasonPlannerTab />
)}
```

---

## Shared Patterns

### Non-fatal Pipeline Step
**Source:** `pipeline/run.py` lines 153-158 (lineup_news block)
**Apply to:** `archive_season.py` invocation in `run.py`; `suggest_squad.py` invocation in `run.py`
```python
try:
    from archive_season import archive_season
    archive_season(bootstrap)
    print("Season archive written.")
except Exception as arc_exc:
    print(f"[archive_season] non-fatal error: {arc_exc}", file=sys.stderr)
```

### Blob Read + 404 Fallback (API Routes)
**Source:** `src/app/api/transfer-news/route.ts` lines 1-42 AND `src/app/api/lineup-news/route.ts` lines 1-42 (identical structure)
**Apply to:** `src/app/api/pre-season-squad/route.ts`
```typescript
// Both transfer-news and lineup-news use identical structure:
// - USE_BLOB env flag
// - list({ prefix: 'file.json', limit: 1 }) → 404 if absent
// - fetch(blobs[0].url) → 502 on failure
// - readFile local fallback
// - Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400
// - ENOENT catch → 404
```

### TanStack Query Hook (6h staleTime)
**Source:** `src/lib/hooks/useTransferNews.ts` lines 1-14
**Apply to:** `src/lib/hooks/usePreSeasonSquad.ts`
```typescript
staleTime: 6 * 60 * 60 * 1000,  // 6h — archive only written once per season
```

### upload.py save() — Sole Blob Write Path
**Source:** `pipeline/upload.py` lines 25-30
**Apply to:** `pipeline/archive_season.py`, `pipeline/suggest_squad.py`
```python
# NEVER call vercel_blob.put() directly. Always use:
from upload import save
save('season_archive_gw38.json', data)
```

### Formation Grid Position Display
**Source:** `src/components/optimiser/ChipSquadView.tsx` lines 13-106
**Apply to:** `src/components/next-season/NextSeasonPlannerTab.tsx` (formation grid section)
```typescript
const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
const POSITION_ORDER = [1, 2, 3, 4]
// Bench: GK first, then by score desc — lines 30-33
const benchSorted = [
  ...benchPlayers.filter(p => p.element_type === 1),
  ...benchPlayers.filter(p => p.element_type !== 1).sort((a, b) => b.ppm - a.ppm),
]
```

---

## No Analog Found

All files have close analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `pipeline/`, `src/lib/`, `src/lib/hooks/`, `src/app/api/`, `src/components/optimiser/`, `src/components/club-form/`, `src/app/page.tsx`
**Files scanned:** 16 source files read directly
**Pattern extraction date:** 2026-05-19
