# Phase 41: Accuracy UI & Model Rationalisation - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 9 (3 new, 6 modified)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/accuracy/AccuracyTab.tsx` | component | request-response | `src/components/insights/InsightsTab.tsx` | exact |
| `src/lib/hooks/useAccuracy.ts` | hook | request-response | `src/lib/hooks/useInsights.ts` | exact |
| `src/app/api/accuracy/route.ts` | API route | request-response | `src/app/api/insights/route.ts` | exact |
| `src/app/api/players/route.ts` | API route (modify) | request-response | self — extend with backtest join | self |
| `src/components/gem-table/columns.tsx` | utility (modify) | transform | self — add column entry | self |
| `src/components/gem-table/GwToggle.tsx` | utility (modify) | config | self — add preset entry | self |
| `src/lib/types.ts` | model (modify) | — | self — add field to MergedPlayer | self |
| `src/app/page.tsx` | config (modify) | — | self — add SubTab union member + SECTIONS entry | self |
| `pipeline/merge.py` | pipeline (modify, ACC-06) | batch | self — remove loser model computation block | self |

---

## Pattern Assignments

### `src/lib/hooks/useAccuracy.ts` (hook, request-response)

**Analog:** `src/lib/hooks/useInsights.ts` (lines 1–14) — exact match

**Full file pattern** (copy verbatim, substituting `accuracy` for `insights`):
```typescript
import { useQuery } from '@tanstack/react-query'
import type { AccuracyBacktest } from '../types'

export function useAccuracy() {
  return useQuery<AccuracyBacktest>({
    queryKey: ['accuracy'],
    queryFn: async () => {
      const res = await fetch('/api/accuracy')
      if (!res.ok) throw new Error('Failed to fetch accuracy data')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours — matches useInsights
  })
}
```

**Key differences from analog:** Generic type parameter changes from `Insight[]` to `AccuracyBacktest` (object, not array). `queryKey` is `['accuracy']`. Route is `/api/accuracy`.

---

### `src/app/api/accuracy/route.ts` (API route, request-response)

**Analog:** `src/app/api/insights/route.ts` (lines 1–37) — exact structural match

**Full file pattern** (copy verbatim, substituting `accuracy_backtest.json` for `insights.json`):
```typescript
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let data: string

    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'accuracy_backtest.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'Accuracy data not available' }, { status: 404 })
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
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'accuracy_backtest.json')
      data = await readFile(cachePath, 'utf-8')
    }

    const parsed = JSON.parse(data)
    return Response.json(parsed, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  } catch {
    return Response.json({ error: 'Failed to load accuracy data' }, { status: 500 })
  }
}
```

**Key differences from analog:** Uses `Response.json()` with `parsed` (not `new Response(data, ...)`) — matches `insights/route.ts` pattern, not `defcon/route.ts` which uses `new Response(data, ...)`. The `502` branch from `insights/route.ts` line 18 is included; `defcon/route.ts` omits it. Follow `insights/route.ts` exactly.

---

### `src/components/accuracy/AccuracyTab.tsx` (component, request-response)

**Analog:** `src/components/insights/InsightsTab.tsx` (lines 1–110) — exact loading/error/empty/data state structure

**Imports pattern** (lines 1–4 of InsightsTab):
```typescript
'use client'

import { useAccuracy } from '@/lib/hooks/useAccuracy'
import type { AccuracyBacktest } from '@/lib/types'
```

**TIER_CLASSES constant** (InsightsTab lines 7–11 — copy verbatim, AccuracyTab reuses same classes):
```typescript
const TIER_CLASSES = {
  HIGH:   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  LOW:    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
} as const
```

**Loading / error / empty state pattern** (InsightsTab lines 46–74 — adapt copy per UI-SPEC):
```typescript
export function AccuracyTab() {
  const { data, isLoading, error } = useAccuracy()

  if (isLoading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
        Loading accuracy data…
      </p>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400 py-4">
        Failed to load accuracy data. Run the pipeline and refresh.
      </p>
    )
  }

  if (!data) {
    return (
      <section className="mt-6 space-y-2" aria-label="Accuracy not available">
        <h2 className="text-lg font-semibold">No accuracy data yet</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Run the pipeline to generate backtest data.
        </p>
      </section>
    )
  }

  return (
    <section className="mt-6 space-y-8" aria-label="Projection accuracy">
      {/* GwSummaryTable, HaulterList, PlayerDeltaTable inline below */}
    </section>
  )
}
```

**Table chrome pattern** (reuse for all three sub-tables — derived from InsightsTab and UI-SPEC):
```typescript
// Table wrapper
<table className="w-full text-sm border-collapse">
  <thead>
    <tr>
      <th scope="col" className="text-left font-semibold text-zinc-600 dark:text-zinc-400 pb-1 border-b border-zinc-200 dark:border-zinc-700">
        Column Header
      </th>
    </tr>
  </thead>
  <tbody>
    <tr className="even:bg-zinc-50 dark:even:bg-zinc-800/50">
      <td className="py-1">Cell content</td>
    </tr>
  </tbody>
</table>
```

**Section heading pattern** (InsightsTab line 96):
```typescript
<h2 className="text-lg font-semibold mb-2">Section Title</h2>
```

**Hit-rate badge pattern** (UI-SPEC threshold differs from InsightsTab — use 0.50/0.30, not 70/50):
```typescript
type Tier = keyof typeof TIER_CLASSES

function getHitRateTier(rate: number): Tier {
  if (rate >= 0.50) return 'HIGH'
  if (rate >= 0.30) return 'MEDIUM'
  return 'LOW'
}

// Render:
<span className={`inline-block text-xs rounded px-2 py-0.5 ${TIER_CLASSES[getHitRateTier(rate)]}`}>
  {(rate * 100).toFixed(1)}%
</span>
```

**Overall summary row pattern** (UI-SPEC — visually distinct):
```typescript
<tr className="font-semibold bg-zinc-50 dark:bg-zinc-800">
  <td className="py-1">Overall</td>
  {/* summary.xpts_hit_rate, summary.proj_pts_hit_rate */}
</tr>
```

**Flagged cell pattern** (UI-SPEC + accessibility):
```typescript
function FlaggedCell({ flagged }: { flagged: boolean }) {
  return flagged
    ? <span className="text-green-600 dark:text-green-400" aria-label="Flagged: yes">✓</span>
    : <span className="text-zinc-400 dark:text-zinc-500" aria-label="Flagged: no">✗</span>
}
```

**Delta cell pattern** (UI-SPEC):
```typescript
function DeltaCell({ delta }: { delta: number }) {
  const formatted = delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)
  const cls = delta < 0
    ? 'text-red-600 dark:text-red-400'
    : delta > 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-zinc-500'
  return <span className={cls}>{formatted}</span>
}
```

**Interactive sort pattern for PlayerDeltaTable** (React useState — no TanStack Table):
```typescript
type SortKey = 'player_name' | 'gw' | 'actual_pts' | 'xpts_predicted' | 'xpts_delta' | 'proj_pts_predicted' | 'proj_pts_delta'
type SortDir = 'asc' | 'desc'

const [sortKey, setSortKey] = useState<SortKey>('xpts_delta')
const [sortDir, setSortDir] = useState<SortDir>('asc')

function handleSort(key: SortKey) {
  if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
  else { setSortKey(key); setSortDir('asc') }
}
```

**Sortable column header pattern** (UI-SPEC — active header text colour change, aria-sort):
```typescript
// Active sort column: text-zinc-900 dark:text-white; inactive: text-zinc-600 dark:text-zinc-400
<th
  scope="col"
  className={`text-left font-semibold pb-1 border-b border-zinc-200 dark:border-zinc-700 cursor-pointer ${
    sortKey === 'xpts_delta'
      ? 'text-zinc-900 dark:text-white'
      : 'text-zinc-600 dark:text-zinc-400'
  }`}
  onClick={() => handleSort('xpts_delta')}
  aria-sort={sortKey === 'xpts_delta' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
>
  xPts Δ
</th>
```

---

### `src/app/api/players/route.ts` (API route, modify — ACC-05 join)

**Analog:** Self — extend existing file (`src/app/api/players/route.ts` lines 1–39)

**Current pattern** (lines 1–39 — read before editing):
```typescript
// Dev path already reads: join(process.cwd(), 'pipeline', 'cache', 'merged_players.json')
// Blob path: list({ prefix: 'merged_players.json', limit: 1 })
// Returns: new Response(data, { 'Content-Type': 'application/json', ... })
```

**New join logic to insert** (after reading `merged_players.json`, before returning):
```typescript
// Graceful backtest join — must not throw if accuracy_backtest.json absent
let backtestMap: Map<number, number | null> = new Map()
try {
  const backtestPath = join(process.cwd(), 'pipeline', 'cache', 'accuracy_backtest.json')
  const bt = JSON.parse(await readFile(backtestPath, 'utf-8'))
  const mostRecentGw: number = bt.gws_covered?.[0]
  for (const p of bt.players ?? []) {
    const gwEntry = p.gws?.find((g: { gw: number }) => g.gw === mostRecentGw)
    backtestMap.set(p.player_id, gwEntry?.actual_pts ?? null)
  }
} catch { /* accuracy_backtest.json not yet generated — all players get null */ }

const players = JSON.parse(data) as Array<Record<string, unknown>>
const enriched = players.map(p => ({
  ...p,
  last_gw_actual_pts: backtestMap.get(p.id as number) ?? null,
}))

return Response.json(enriched, {
  status: 200,
  headers: {
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  },
})
```

**Critical:** Replace the final `new Response(data, ...)` with `Response.json(enriched, ...)`. The Blob branch also needs the same parse-and-enrich treatment. Blob path must read `accuracy_backtest.json` from Blob using the same `list({ prefix: 'accuracy_backtest.json', limit: 1 })` pattern used in the new `/api/accuracy` route, but wrapped in a try/catch so the main route does not fail if backtest blob is absent.

**GW number for column header:** The Blob path cannot easily return `gws_covered[0]` to the client without a second roundtrip. The client (`GemTable.tsx`) should pass `gwN` sourced from the `last_gw_actual_pts` data or a separate field. Simplest: add `last_gw_covered: number | null` as a top-level field in the enriched response, or derive it from player data. See Pitfall 6 in RESEARCH.md — `createColumns` gains a `gwN: number | null = null` second parameter.

---

### `src/components/gem-table/columns.tsx` (utility, modify — ACC-05)

**Analog:** Self — pattern is the existing `xPts_1gw` column entry (lines 142–153)

**New column entry to add** (after `xPts_1gw` column, before `xPts_3gw`):
```typescript
col.accessor('last_gw_actual_pts', {
  header: () => (
    <span title={`Actual FPL points scored in GW${gwN ?? '?'} — from backtest data`}>
      {gwN ? `GW${gwN} Pts` : 'GW Pts'}
    </span>
  ),
  cell: (info) => {
    const v = info.getValue()
    return v === null || v === undefined
      ? <span className="text-zinc-400">{'—'}</span>
      : Math.round(v).toString()
  },
  enableSorting: true,
}),
```

**`createColumns` signature change** (line 58 — add `gwN` parameter with default):
```typescript
// Before:
export function createColumns(onCompare: (player: ScoredPlayer) => void) {

// After:
export function createColumns(onCompare: (player: ScoredPlayer) => void, gwN: number | null = null) {
```

**`fmtScoreNull` null pattern** (line 16 — reference for the `—` em-dash convention):
```typescript
export const fmtScoreNull = (v: number | null) => (v === null ? '—' : (v * 100).toFixed(0))
```

**ACC-06 removal (if `proj_pts` loses):** No column to remove from `columns.tsx` — `proj_pts_*` columns do not exist in GemTable. Verified: lines 142–246 contain only `xPts_1gw`, `xPts_3gw`, `xPts_5gw`. No action in `columns.tsx` for proj_pts removal.

**ACC-06 removal (if `xPts` loses):** Remove the three `col.accessor('xPts_1gw', ...)`, `col.accessor('xPts_3gw', ...)`, `col.accessor('xPts_5gw', ...)` entries (lines 142–177). Also remove `XPtsCell` component (lines 23–56) and `VarianceBadge` import (line 5).

---

### `src/components/gem-table/GwToggle.tsx` (utility, modify — ACC-05)

**Analog:** Self — existing `PRESET_COLUMN_VISIBILITY.compact` map (lines 26–44)

**Current compact map** (lines 26–44 — all entries listed for reference):
```typescript
compact: {
  team_short_name: false,
  now_cost: false,
  fdr_score: false,
  form_score: false,
  xg_per90: false,
  xa_per90: false,
  xg_score: false,
  xa_score: false,
  ownership_score: false,
  minutes_score: false,
  set_piece_score: false,
  selected_by_percent: false,
  status: false,
  regression_signal: false,
  differential_flag: false,
  trend: false,
  fixtures: false,
},
```

**New entry to add** (append `last_gw_actual_pts: false` to `compact` map only):
```typescript
compact: {
  // ... all existing entries ...
  last_gw_actual_pts: false,   // ACC-05 D-10: hidden in Compact preset
},
```

**Do NOT add to `default` or `analysis` maps** — absent from those maps means visible (TanStack default behaviour). Do NOT add to `gwVisibility` object (lines 72–76) — this column is not horizon-gated.

**`gwVisibility` object** (lines 72–76 — do not touch):
```typescript
const gwVisibility = {
  xPts_1gw: horizon === 1,
  xPts_3gw: horizon === 3,
  xPts_5gw: horizon === 5,
}
```

**ACC-06 removal (if `xPts` loses):** Remove `xPts_1gw`, `xPts_3gw`, `xPts_5gw` from `gwVisibility` and remove the entire `GwToggle` component or simplify to a no-op (no toggle needed if only one model remains). Also remove xPts entries from `MOBILE_HIDDEN_COLUMNS` if present.

---

### `src/lib/types.ts` (model, modify — ACC-05 + ACC-06)

**Analog:** Self — `MergedPlayer` interface (lines 90–174) and `ScoredPlayer` interface (lines 199–208)

**ACC-05: Add `last_gw_actual_pts` to `MergedPlayer`** (after line 174, before closing brace of MergedPlayer):
```typescript
// ACC-05: last GW actual points from accuracy_backtest.json join (added by /api/players route)
// Optional — absent before Phase 40 pipeline has run; null for players not in backtest
last_gw_actual_pts?: number | null
```

**New AccuracyBacktest type definitions to add** (after `ScoredPlayer` interface, line 208+):
```typescript
// Phase 41 ACC-02/03/04 — accuracy backtest shape from pipeline/cache/accuracy_backtest.json
export interface AccuracyGwSummary {
  gw: number
  haulter_count: number
  xpts_flagged: number
  proj_pts_flagged: number
  xpts_hit_rate: number        // 0.0–1.0
  proj_pts_hit_rate: number
}

export interface AccuracySummary {
  xpts_hit_rate: number
  proj_pts_hit_rate: number
  gws: AccuracyGwSummary[]
}

export interface AccuracyHaulter {
  gw: number
  player_id: number
  player_name: string
  actual_pts: number
  xpts_predicted: number
  xpts_rank: number
  xpts_flagged: boolean
  proj_pts_predicted: number
  proj_pts_rank: number
  proj_pts_flagged: boolean
}

export interface AccuracyPlayerGw {
  gw: number
  actual_pts: number
  xpts_predicted: number
  xpts_delta: number           // actual - predicted; negative = over-prediction
  proj_pts_predicted: number
  proj_pts_delta: number
}

export interface AccuracyPlayer {
  player_id: number
  player_name: string
  team: string
  gws: AccuracyPlayerGw[]
}

export interface AccuracyBacktest {
  generated_at: string
  gws_covered: number[]        // [32, 31, 30, 29, 28] — most recent first
  summary: AccuracySummary
  haulters: AccuracyHaulter[]
  players: AccuracyPlayer[]
}
```

**ACC-06 removal (if `proj_pts` loses):** Remove from `MergedPlayer` (lines 138–140):
```typescript
// DELETE these three lines:
proj_pts_1gw: number
proj_pts_3gw: number
proj_pts_5gw: number
```
Also remove `proj_pts_*` fields from `AccuracyHaulter` and `AccuracyPlayerGw` interfaces.

**ACC-06 removal (if `xPts` loses):** Remove from `MergedPlayer` (lines 147–158): `xPts_1gw?`, `xPts_3gw?`, `xPts_5gw?`, `xPts_ceiling_1gw?`, `xPts_ceiling_3gw?`, `xPts_ceiling_5gw?`, `xPts_components_1gw?`, `xPts_90th_1gw?` (line 173). Also remove `xPts_*` fields from `AccuracyHaulter` and `AccuracyPlayerGw` interfaces.

---

### `src/app/page.tsx` (config, modify — D-01)

**Analog:** Self — `SubTab` union type (line 22) and `SECTIONS` array (lines 24–52)

**Three-location edit pattern** (verified from RESEARCH.md Pitfall 1 and page.tsx lines 22, 29–33, 131–142):

**Edit 1 — SubTab union type** (line 22):
```typescript
// Before:
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'club-form' | 'value-gems'

// After:
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'club-form' | 'value-gems' | 'accuracy'
```

**Edit 2 — SECTIONS `analyse` subTabs array** (after line 33 `set-pieces` entry):
```typescript
{ id: 'accuracy' as SubTab, label: 'Accuracy', mobileLabel: 'Acc' },
```

**Edit 3 — content render guard** (after line 142 `insights` guard):
```typescript
{activeSection !== 'squad' && activeSubTab === 'accuracy' && <AccuracyTab />}
```

**Import to add** (after line 19 `InsightsTab` import):
```typescript
import { AccuracyTab } from '@/components/accuracy/AccuracyTab'
```

**Existing render guard pattern** (line 142 — copy exactly):
```typescript
{activeSection !== 'squad' && activeSubTab === 'insights' && <InsightsTab />}
```

---

### `pipeline/merge.py` (pipeline, modify — ACC-06 conditional removal)

**Analog:** Self — relevant blocks identified via Grep

**ACC-06 removal scope by model:**

**If `proj_pts` is the loser — remove these blocks:**

Block 1: `_proj_pts_ngw` function (line 115 — locate start):
```python
# Remove the entire function _proj_pts_ngw (line 115 through its end)
def _proj_pts_ngw(
    ...
```

Block 2: Computation calls (lines 804, 815–816):
```python
# Remove:
proj_pts_1gw = round(ep_next * availability, 2)   # line 804
proj_pts_3gw = _proj_pts_ngw(ppg, sp, player_fixtures, 3)  # line 815
proj_pts_5gw = _proj_pts_ngw(ppg, sp, player_fixtures, 5)  # line 816
```

Block 3: Player dict assignments (lines 829–831):
```python
# Remove:
player['proj_pts_1gw'] = proj_pts_1gw   # line 829
player['proj_pts_3gw'] = proj_pts_3gw   # line 830
player['proj_pts_5gw'] = proj_pts_5gw   # line 831
```

Also remove upstream variable declarations that are now unreferenced: `ep_next`, `chance`, `availability`, `ppg`, `player_fixtures` — only if not used by other surviving code. Confirm by checking if `sp` (start_prob, line 813) is still needed by xPts engine (it is — lines 837–848 use `player_start_prob`, not `sp` directly).

**If `xPts` is the loser — remove these blocks:**

Block 1: `_cs_prob` function (line 147), `_compute_xpts_fixture` function (line 166), `_xpts_ngw` function (line 228), `_compute_xpts_sigma` function (line 281) — all four helper functions.

Block 2: Computation calls (lines 837–880):
```python
# Remove entirely — the xpts computation block and sigma block:
xpts_1gw, xpts_components_1gw = _xpts_ngw(...)   # line 837
xpts_3gw, _ = _xpts_ngw(...)                      # line 841
xpts_5gw, _ = _xpts_ngw(...)                      # line 845
player['xPts_1gw'] = xpts_1gw                     # line 849
player['xPts_3gw'] = xpts_3gw                     # line 850
player['xPts_5gw'] = xpts_5gw                     # line 851
player['xPts_components_1gw'] = xpts_components_1gw  # line 852
player['_sigma_1gw'] = _compute_xpts_sigma(...)   # line 869
player['_sigma_3gw'] = _compute_xpts_sigma(...)   # line 873
player['_sigma_5gw'] = _compute_xpts_sigma(...)   # line 877
```

Block 3: Any ceiling/90th-percentile computation that reads `_sigma_*` fields (line 932+ — search for `_sigma` usage post-loop).

---

## Shared Patterns

### TanStack Query hook pattern
**Source:** `src/lib/hooks/useInsights.ts` (entire file — 14 lines)
**Apply to:** `useAccuracy.ts`
```typescript
import { useQuery } from '@tanstack/react-query'

export function useXxx() {
  return useQuery<ResponseType>({
    queryKey: ['xxx'],
    queryFn: async () => {
      const res = await fetch('/api/xxx')
      if (!res.ok) throw new Error('Failed to fetch xxx')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000,
  })
}
```

### API route Blob/local branching
**Source:** `src/app/api/insights/route.ts` (lines 1–37)
**Apply to:** `src/app/api/accuracy/route.ts`
```typescript
const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'
// USE_BLOB=true → list({ prefix: 'filename.json', limit: 1 }) → fetch blob URL
// USE_BLOB=false → readFile(join(process.cwd(), 'pipeline', 'cache', 'filename.json'), 'utf-8')
// Cache-Control: 'public, s-maxage=3600, stale-while-revalidate=86400'
```

### Loading / error / empty state copy
**Source:** `src/components/insights/InsightsTab.tsx` (lines 49–74)
**Apply to:** `AccuracyTab.tsx`
```typescript
// Loading: <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">...</p>
// Error:   <p className="text-sm text-red-600 dark:text-red-400 py-4">...</p>
// Empty:   <section className="mt-6 space-y-2" aria-label="..."><h2 ...><p ...></section>
// Data:    <section className="mt-6 space-y-8" aria-label="...">...</section>
```

### Table chrome
**Source:** `src/components/insights/InsightsTab.tsx` (confirmed via UI-SPEC)
**Apply to:** All three AccuracyTab sub-tables (GwSummaryTable, HaulterList, PlayerDeltaTable)
```typescript
// Table:   className="w-full text-sm border-collapse"
// th:      scope="col" className="text-left font-semibold text-zinc-600 dark:text-zinc-400 pb-1 border-b border-zinc-200 dark:border-zinc-700"
// tr body: className="even:bg-zinc-50 dark:even:bg-zinc-800/50"
```

### Test file structure
**Source:** `src/components/insights/InsightsTab.test.tsx` (lines 1–208)
**Apply to:** `src/components/accuracy/AccuracyTab.test.tsx` (new Wave 0 file)
```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@/lib/hooks/useAccuracy', () => ({
  useAccuracy: vi.fn(),
}))

import { AccuracyTab } from '@/components/accuracy/AccuracyTab'
import { useAccuracy } from '@/lib/hooks/useAccuracy'
import type { AccuracyBacktest } from '@/lib/types'

const mockedUseAccuracy = vi.mocked(useAccuracy)

describe('Phase 41: AccuracyTab component', () => {
  beforeEach(() => { mockedUseAccuracy.mockReset() })
  // ...
})
```

---

## No Analog Found

All files have close analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `src/components/`, `src/lib/hooks/`, `src/app/api/`, `src/app/page.tsx`, `pipeline/merge.py`
**Files scanned:** 9 source files read directly
**Pattern extraction date:** 2026-04-30

**Critical constraints carried forward to planner:**
1. `last_gw_actual_pts` must be on `MergedPlayer` (not only `ScoredPlayer`) — the field is added in `/api/players` before `computeAllGemScores` runs; putting it only on `ScoredPlayer` means it won't be in the input the function receives.
2. Do NOT add `last_gw_actual_pts` to the `gwVisibility` object in `GwToggle.tsx` — this would make it vanish when switching GW horizons (Pitfall 2 in RESEARCH.md).
3. `/api/players` graceful fallback: wrap backtest read in try/catch; all-null is the correct fallback state (Pitfall 3).
4. GW number for column header: use `gws_covered[0]` from backtest — only the most recent GW entry per player (Pitfall 4).
5. ACC-06 scope is asymmetric: removing `proj_pts` requires no `columns.tsx` changes (those columns don't exist in GemTable); removing `xPts` requires removing three columns plus four helper functions in `merge.py`.
