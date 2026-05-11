# Phase 96: Captain Decision Backtester - Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** 7 (5 new, 2 modified)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `pipeline/run.py` (modify — side-write) | pipeline entry | batch | `pipeline/run.py` lines 339–342 | exact (self-referential) |
| `src/lib/types.ts` (modify — add 3 types) | model | — | `src/lib/types.ts` lines 639–657 (`CaptainPick`/`CaptainPicks`) | exact |
| `src/app/api/decision-history/route.ts` (new) | route handler | request-response | `src/app/api/accuracy/route.ts` + `src/app/api/gw-review/route.ts` | role-match (blob read + FPL upstream fetch) |
| `src/lib/hooks/useDecisionHistory.ts` (new) | hook | request-response | `src/lib/hooks/useGwReview.ts` + `src/lib/hooks/useAccuracy.ts` | role-match |
| `src/lib/regret.ts` (new) | utility | transform | `src/lib/setPieceLeague.ts` | exact |
| `src/components/accuracy/BackTab.tsx` (new) | component | request-response | `src/components/accuracy/AccuracyTab.tsx` §CalibrationSection | role-match |
| `src/components/accuracy/AccuracyTab.tsx` (modify — restructure) | component | request-response | `src/components/set-pieces/SetPieceViewToggle.tsx` (pill nav) | exact (tab nav pattern) |

---

## Pattern Assignments

### `pipeline/run.py` (modify — add captain snapshot side-write)

**Analog:** `pipeline/run.py` lines 330–342 (predictions snapshot blob side-write)

**Insertion point** (after line 227, immediately after `save('captain_picks.json', captain_picks)`):
```python
# Phase 96 BACK-01: captain snapshot side-write — one immutable Blob object per GW.
# Mirrors predictions_snapshot_gw{N}.json side-write at lines 339-342.
if os.getenv('USE_BLOB', '').lower() == 'true':
    from upload import upload_json
    upload_json(f'captain_picks_gw{current_gw}.json', captain_picks)
    print(f"Captain snapshot uploaded to Blob: captain_picks_gw{current_gw}.json")
```

**Note:** `current_gw` is assigned at line 333 (`current_gw = finished_gws + 1`). The side-write must go AFTER line 333, not after line 227 (where `captain_picks` is produced). Adjust insertion point accordingly — place after the existing predictions snapshot block (lines 339–342), not after line 227.

**Exact model** (lines 338–342 of `pipeline/run.py`):
```python
# Blob accumulation (D-12): per-GW named copy so multiple snapshots survive
if os.getenv('USE_BLOB', '').lower() == 'true':
    from upload import upload_json
    upload_json(f'predictions_snapshot_gw{current_gw}.json', snapshot_data)
    print(f"Predictions snapshot uploaded to Blob: predictions_snapshot_gw{current_gw}.json")
```

**What changes:** swap `predictions_snapshot_gw{current_gw}.json` / `snapshot_data` for `captain_picks_gw{current_gw}.json` / `captain_picks`. The `captain_picks` variable is already in scope (produced at line 213).

---

### `src/lib/types.ts` (modify — add 3 new types)

**Analog:** `src/lib/types.ts` lines 639–657 — existing `CaptainPick` / `CaptainPicks` interfaces

**Existing types to understand** (lines 639–657):
```typescript
// Captain picks data (Phase 31 CAP-03/CAP-04 — pipeline writes pipeline/cache/captain_picks.json)
export interface CaptainPick {
  id: number
  name: string
  team: string                 // team_short_name (e.g. "ARS")
  position: string             // GK | DEF | MID | FWD
  now_cost: number             // tenths of £m (91 = £9.1m)
  xPts_1gw: number
  xPts_90th_1gw: number        // xPts_1gw + 1.28 * sigma_1gw (D-05)
  selected_by_percent: string  // FPL returns string ("12.4")
  eo_threshold_used?: number   // present only on eo_adjusted when a threshold (25.0 or 35.0) succeeded
}

export interface CaptainPicks {
  generated_at: string
  gameweek: number | null
  ceiling: CaptainPick | null
  eo_adjusted: CaptainPick | null
}
```

**New types to add** (append after line 657, before the Insights block at line 659):
```typescript
// Phase 96 BACK-01: Captain decision backtester types
// CaptainPickSnapshot = captain_picks_gw{N}.json payload (same schema as CaptainPicks)
export type CaptainPickSnapshot = CaptainPicks

// One entry in the regret timeline — one per GW
export interface RegretEntry {
  gw: number
  // User's actual captain (from FPL picks API — null when not authenticated)
  userCaptainId: number | null
  userCaptainName: string | null
  userCaptainPts: number | null       // raw player points (regret formula doubles this)
  // Model's ceiling pick (from captain_picks_gw{N}.json — null when no snapshot)
  modelCeilingId: number | null
  modelCeilingName: string | null
  modelCeilingPts: number | null      // raw player points (regret formula doubles this)
  hasSnapshot: boolean                // false = pre-deployment GW (D-10)
  // Signed regret in captain points: ceiling_pts×2 − user_capt_pts×2 (D-06)
  // null when either side is unavailable
  regret: number | null
}

// Full response shape from /api/decision-history
export interface DecisionHistory {
  teamId: number
  gwsWithData: number           // count of GWs with both user pick + model snapshot
  entries: RegretEntry[]        // ordered GW ascending; includes pre-deployment rows
}
```

---

### `src/app/api/decision-history/route.ts` (new)

**Primary analog:** `src/app/api/accuracy/route.ts` (blob read pattern)
**Secondary analog:** `src/app/api/gw-review/route.ts` lines 1–55 + 99–120 (FPL upstream fetch + param validation)

**Imports pattern** (from `accuracy/route.ts` lines 1–5 + `gw-review/route.ts` lines 1–9):
```typescript
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { NextRequest } from 'next/server'
import type { DecisionHistory, CaptainPickSnapshot, RegretEntry } from '@/lib/types'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'
const FPL_BASE = 'https://fantasy.premierleague.com/api'
```

**Blob read pattern** (from `accuracy/route.ts` lines 11–27 — copy this structure for each per-GW captain snapshot):
```typescript
// For each GW snapshot: list({ prefix: `captain_picks_gw${gw}.json`, limit: 1 })
if (USE_BLOB) {
  const { blobs } = await list({ prefix: 'captain_picks_gw42.json', limit: 1 })
  if (!blobs.length) {
    // hasSnapshot = false — D-10 pre-deployment row
  }
  const res = await fetch(blobs[0].url)
  if (!res.ok) {
    return Response.json({ error: `Blob fetch failed: ${res.status}` }, { status: 502 })
  }
  data = await res.text()
} else {
  const cachePath = join(process.cwd(), 'pipeline', 'cache', `captain_picks_gw${gw}.json`)
  // readFile with try/catch — ENOENT = hasSnapshot false
  data = await readFile(cachePath, 'utf-8')
}
```

**FPL picks fetch pattern** (from `gw-review/route.ts` lines 99–120 — follow exactly):
```typescript
// No fpl_session cookie needed — /entry/{teamId}/event/{gw}/picks/ is public
try {
  const picksRes = await fetch(`${FPL_BASE}/entry/${teamId}/event/${gw}/picks/`, {
    headers: { 'User-Agent': 'fplx/1.11 (+https://fplx.app)' },
  })
  if (!picksRes.ok) {
    return Response.json(
      { error: `FPL picks fetch failed: ${picksRes.status}` },
      { status: picksRes.status === 404 ? 404 : 502 }
    )
  }
  const picksJson = (await picksRes.json()) as FPLPicksResponse
  if (!picksJson || !Array.isArray(picksJson.picks) || !picksJson.entry_history) {
    return Response.json({ error: 'FPL picks: unexpected response shape' }, { status: 502 })
  }
  picks = picksJson.picks
} catch {
  return Response.json({ error: 'FPL picks unreachable' }, { status: 502 })
}
```

**Param validation pattern** (from `gw-review/route.ts` lines 44–55):
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const teamIdParam = searchParams.get('teamId')

  if (!teamIdParam || !/^\d+$/.test(teamIdParam)) {
    return Response.json({ error: 'Invalid teamId parameter' }, { status: 400 })
  }
  const teamId = parseInt(teamIdParam, 10)
  // ...
}
```

**Response pattern** (from `accuracy/route.ts` lines 30–36):
```typescript
return Response.json(parsed, {
  status: 200,
  headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
})
// Error catch-all:
return Response.json({ error: 'Failed to load captain history' }, { status: 500 })
```

**Route responsibility summary:** Accepts `?teamId=N`. For each finished GW up to the current one: (1) attempt to fetch `captain_picks_gw{N}.json` from Blob/local, (2) fetch user's FPL picks for that GW, (3) identify user's captain (`is_captain: true`), (4) compute regret. Returns a `DecisionHistory` response.

---

### `src/lib/hooks/useDecisionHistory.ts` (new)

**Primary analog:** `src/lib/hooks/useAccuracy.ts` (simple TanStack Query hook)
**Secondary analog:** `src/lib/hooks/useGwReview.ts` (hook with param, enabled guard, numeric validation)

**Imports pattern** (from `useAccuracy.ts` lines 1–2 + `useGwReview.ts` lines 1–2):
```typescript
import { useQuery } from '@tanstack/react-query'
import type { DecisionHistory } from '../types'
```

**Core hook pattern** (from `useGwReview.ts` lines 27–39 — use enabled guard like this):
```typescript
export function useDecisionHistory(teamId: string | null) {
  return useQuery<DecisionHistory>({
    queryKey: ['decision-history', teamId],
    queryFn: async () => {
      if (!teamId) throw new Error('teamId is required')
      const res = await fetch(`/api/decision-history?teamId=${teamId}`)
      if (!res.ok) throw new Error(`Decision history fetch failed: ${res.status}`)
      return res.json()
    },
    enabled: !!teamId && /^\d+$/.test(teamId),
    staleTime: 6 * 60 * 60 * 1000, // 6 hours — per-GW data is immutable once settled
    retry: 1,
  })
}
```

**localStorage ring buffer pattern** (from `src/lib/manual-plan.ts` lines 218–265 — copy the guard shape):
```typescript
// Key: 'decisionHistory:teamId:{id}' (ROADMAP spec)
const RING_BUFFER_KEY = (teamId: string) => `decisionHistory:teamId:${teamId}`
const MAX_GWS = 38

export function loadCachedHistory(teamId: string): DecisionHistory | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(RING_BUFFER_KEY(teamId))
    if (!raw) return null
    return JSON.parse(raw) as DecisionHistory
  } catch {
    return null
  }
}

export function persistHistory(teamId: string, history: DecisionHistory): void {
  if (typeof window === 'undefined') return
  try {
    // Ring buffer: keep only last MAX_GWS entries
    const trimmed: DecisionHistory = {
      ...history,
      entries: history.entries.slice(-MAX_GWS),
    }
    window.localStorage.setItem(RING_BUFFER_KEY(teamId), JSON.stringify(trimmed))
  } catch {
    // Silently ignore storage errors (private mode, quota exceeded)
  }
}
```

**Whether the ring buffer lives in the hook or a separate utility** is left to Claude's discretion (CONTEXT.md). The pattern above shows both approaches — co-locate in the hook for simplicity, or extract to `src/lib/decisionHistory.ts` for testability.

---

### `src/lib/regret.ts` (new)

**Analog:** `src/lib/setPieceLeague.ts` (pure computation utility — exported functions, no React, typed interfaces, inline JSDoc)

**File shape** (mirror `setPieceLeague.ts` structure):
```typescript
// Phase 96 BACK-01: captain regret computation.
// Sources of truth:
//   - .planning/phases/96-captain-decision-backtester/96-CONTEXT.md §D-06
//   - .planning/phases/96-captain-decision-backtester/096-UI-SPEC.md §BackTab Season Summary Header
import type { RegretEntry, DecisionHistory } from './types'

/** D-06: signed regret in captain points. Positive = model better, negative = user beat it. */
export function computeRegret(
  ceilingPts: number | null,
  userCaptPts: number | null,
): number | null {
  if (ceilingPts === null || userCaptPts === null) return null
  return ceilingPts * 2 - userCaptPts * 2
}

export interface SeasonSummary {
  totalRegret: number         // sum of all non-null regret values
  gwsWithData: number         // count of GWs where both sides available
  modelBetter: number         // regret > 0
  userWon: number             // regret < 0
  tied: number                // regret === 0
}

/** Aggregate season-level summary from RegretEntry array. */
export function computeSeasonSummary(entries: RegretEntry[]): SeasonSummary {
  // ... filter entries with non-null regret, accumulate counts
}
```

**Pure function conventions** (from `setPieceLeague.ts`):
- No default exports — named exports only
- JSDoc on every exported function
- `null` as the explicit "no data" sentinel (not `undefined`)
- No side effects, no React imports

---

### `src/components/accuracy/BackTab.tsx` (new)

**Analog:** `src/components/accuracy/AccuracyTab.tsx` §CalibrationSection (lines 253–392) for recharts chart pattern, plus `AccuracyTab` main component (lines 995–1045) for the three-guard loading/error/empty pattern.

**Imports pattern** (derive from `AccuracyTab.tsx` lines 1–28):
```typescript
'use client'

import { useMemo } from 'react'
import { useDecisionHistory } from '@/lib/hooks/useDecisionHistory'
import { computeSeasonSummary } from '@/lib/regret'
import type { DecisionHistory, RegretEntry } from '@/lib/types'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
```

**Three-guard loading/error/empty pattern** (from `AccuracyTab.tsx` lines 1001–1033 — copy this structure exactly):
```typescript
export function BackTab({ teamId }: { teamId: string | null }) {
  const { data, isLoading, error } = useDecisionHistory(teamId)

  if (isLoading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
        Loading captain history…
      </p>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400 py-4">
        Failed to load captain history. Check your connection and refresh.
      </p>
    )
  }

  if (!data || data.entries.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
        No captain history yet — data accumulates each GW after this version is deployed. Log in to see your actual captain picks.
      </p>
    )
  }

  // render SeasonSummaryHeader + RegretChart + DetailRows
}
```

**Custom tooltip pattern** (from `AccuracyTab.tsx` lines 253–271 — copy this structure for `RegretTooltip`):
```typescript
function RegretTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as RegretEntry
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">GW{p.gw}</p>
      <p className="text-zinc-700 dark:text-zinc-300">
        Your captain: {p.userCaptainName ?? 'Log in to see'} ({p.userCaptainPts !== null ? `${p.userCaptainPts * 2}pts` : '—'})
      </p>
      <p className="text-zinc-700 dark:text-zinc-300">
        Model pick: {p.modelCeilingName ?? 'No snapshot'} ({p.modelCeilingPts !== null ? `${p.modelCeilingPts * 2}pts` : '—'})
      </p>
      <p className={p.regret !== null && p.regret > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
        Regret: {p.regret !== null ? (p.regret > 0 ? `+${p.regret}pts` : `${p.regret}pts`) : '—'}
      </p>
    </div>
  )
}
```

**BarChart pattern** (from `AccuracyTab.tsx` lines 346–390 — copy `ResponsiveContainer` + chart container wrapper):
```typescript
<div
  aria-label="Captain regret per gameweek"
  className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-3 relative mb-4"
>
  <ResponsiveContainer width="100%" height={288}>
    <BarChart data={entries}>
      <XAxis
        dataKey="gw"
        type="number"
        tickFormatter={(v) => `GW${v}`}
        tick={{ fontSize: 12, fill: 'currentColor' }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        tickFormatter={(v) => v >= 0 ? `+${v}` : `${v}`}
        tick={{ fontSize: 12, fill: 'currentColor' }}
        axisLine={false}
        tickLine={false}
        width={40}
      />
      <ReferenceLine y={0} stroke="rgba(161,161,170,0.5)" strokeWidth={1} />
      <Tooltip content={RegretTooltip} />
      <Bar dataKey="regret" isAnimationActive={false}>
        {entries.map((entry, i) => (
          <Cell
            key={i}
            fill={
              entry.regret === null ? 'rgba(161,161,170,0.5)'
              : entry.regret > 0 ? '#ef4444'
              : entry.regret < 0 ? '#22c55e'
              : 'rgba(161,161,170,0.5)'
            }
          />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
</div>
```

**Per-GW detail table pattern** (from `AccuracyTab.tsx` lines 101–104 + table usages at lines 546–592 — use the same constants, do NOT redefine):
```typescript
// TABLE_CLS, TH_CLS, TR_CLS, TD_CLS are defined in AccuracyTab.tsx lines 101-104.
// BackTab.tsx cannot import them from AccuracyTab (causes circular/re-export issues).
// Solution: duplicate the 4 constant definitions at top of BackTab.tsx with same values.
const TH_CLS = 'text-left font-semibold text-zinc-600 dark:text-zinc-400 pb-1 border-b border-zinc-200 dark:border-zinc-700'
const TR_CLS = 'even:bg-zinc-50 dark:even:bg-zinc-800/50'
const TD_CLS = 'py-1'
const TABLE_CLS = 'w-full text-sm border-collapse'
```

**Regret cell rendering pattern** (from UI-SPEC §Per-GW Detail Rows):
```typescript
function RegretCell({ regret }: { regret: number | null }) {
  if (regret === null) return <td className={`${TD_CLS} text-zinc-400 dark:text-zinc-500`}>—</td>
  if (regret > 0) return <td className={`${TD_CLS} text-right text-red-600 dark:text-red-400`}>+{regret}pts (model better)</td>
  if (regret < 0) return <td className={`${TD_CLS} text-right text-green-600 dark:text-green-400`}>{regret}pts (you beat it)</td>
  return <td className={`${TD_CLS} text-right text-zinc-500 dark:text-zinc-400`}>0pts (tied)</td>
}
```

**Table wrapper** (from UI-SPEC §Row overflow — mirrors VersionHistoryTable):
```typescript
<div className="overflow-x-auto">
  <table className={TABLE_CLS}>
    {/* ... */}
  </table>
</div>
```

---

### `src/components/accuracy/AccuracyTab.tsx` (modify — restructure into tabbed sections)

**Sub-tab toggle analog:** `src/components/set-pieces/SetPieceViewToggle.tsx` (full file, 39 lines) — the Phase 95 segmented pill is the exact model to extend to 3 options.

**SetPieceViewToggle exact structure** (lines 15–39 of `SetPieceViewToggle.tsx`):
```typescript
export function SetPieceViewToggle({ view, onViewChange }: SetPieceViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Set-piece view"
      className="flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600"
    >
      {(['takers', 'league'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onViewChange(v)}
          aria-pressed={view === v}
          className={`px-3 py-2 sm:py-1 text-sm font-medium transition-all cursor-pointer active:scale-95 min-h-[44px] sm:min-h-0 ${
            view === v
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
          }`}
        >
          {VIEW_LABELS[v]}
        </button>
      ))}
    </div>
  )
}
```

**Adapted AccuracySubTabNav** (extend to 3 options, inline in `AccuracyTab.tsx` per UI-SPEC):
```typescript
type AccuracySubTab = 'summary' | 'calibration' | 'back'

const ACCURACY_SUB_TABS: ReadonlyArray<{ value: AccuracySubTab; label: string }> = [
  { value: 'summary', label: 'Summary' },
  { value: 'calibration', label: 'Calibration' },
  { value: 'back', label: 'Back' },
]

function AccuracySubTabNav({
  value,
  onChange,
}: {
  value: AccuracySubTab
  onChange: (v: AccuracySubTab) => void
}) {
  return (
    <div
      role="group"
      aria-label="Accuracy section"
      className="flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600"
    >
      {ACCURACY_SUB_TABS.map(({ value: v, label }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`px-3 py-2 sm:py-1 text-sm font-medium transition-all cursor-pointer active:scale-95 min-h-[44px] sm:min-h-0 ${
            value === v
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
```

**State declaration** (from CONTEXT.md D-04 — mirrors Phase 95 `useState<SetPieceView>('takers')`):
```typescript
// Inside AccuracyTab() function body, after existing hooks:
const [subTab, setSubTab] = useState<AccuracySubTab>('summary')
```

**Restructured AccuracyTab return** (existing flat layout at lines 1035–1045 becomes tab-conditional):
```typescript
// Current flat layout (lines 1035–1045) to be restructured:
return (
  <section className="mt-6 space-y-8" aria-label="Projection accuracy">
    {panel}
    {/* NEW: sub-tab nav placed immediately after DataHealthPanel */}
    <AccuracySubTabNav value={subTab} onChange={setSubTab} />
    {/* Tab content — conditional on subTab */}
    {subTab === 'summary' && (
      <>
        <GwSummaryTable data={data} />
        <HaulterList data={data} />
        <PlayerDeltaTable data={data} />
      </>
    )}
    {subTab === 'calibration' && (
      <>
        {data.versions && data.versions.length >= 1 && <VersionHistoryTable data={data} />}
        {data.calibration && <CalibrationSection data={data} />}
      </>
    )}
    {subTab === 'back' && (
      <BackTab teamId={teamId} />
    )}
  </section>
)
```

**`teamId` source for BackTab** (from `src/app/page.tsx` lines 125–133 — read from localStorage, passed as prop):
```typescript
// page.tsx already reads localStorage.getItem('fpl_team_id')
// AccuracyTab receives teamId as a prop OR reads it internally via the same pattern:
try { return localStorage.getItem('fpl_team_id') ?? '' } catch { return '' }
```

---

## Shared Patterns

### Blob Read (USE_BLOB guard)
**Source:** `src/app/api/accuracy/route.ts` lines 5–36
**Apply to:** `src/app/api/decision-history/route.ts`
```typescript
const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

// Blob path:
const { blobs } = await list({ prefix: 'captain_picks_gw42.json', limit: 1 })
if (!blobs.length) { /* treat as hasSnapshot = false */ }
const res = await fetch(blobs[0].url)
if (!res.ok) { return Response.json({ error: `Blob fetch failed: ${res.status}` }, { status: 502 }) }

// Local fallback:
const cachePath = join(process.cwd(), 'pipeline', 'cache', 'captain_picks_gw42.json')
data = await readFile(cachePath, 'utf-8')
```

### localStorage try/catch Guard
**Source:** `src/lib/manual-plan.ts` lines 218–265 and `src/app/page.tsx` lines 125–133
**Apply to:** `src/lib/hooks/useDecisionHistory.ts` ring-buffer helpers
```typescript
// Always guard with typeof window !== 'undefined' + try/catch:
if (typeof window === 'undefined') return null
try {
  const raw = window.localStorage.getItem(key)
  // ...
} catch {
  return null
}
// On write:
try {
  window.localStorage.setItem(key, JSON.stringify(value))
} catch {
  // Silently ignore storage errors (private mode, quota exceeded, etc.)
}
```

### TanStack Query Hook Shape
**Source:** `src/lib/hooks/useAccuracy.ts` (simple) + `src/lib/hooks/useGwReview.ts` (with enabled guard)
**Apply to:** `src/lib/hooks/useDecisionHistory.ts`
```typescript
// Pattern: enabled guard when teamId param required
enabled: !!teamId && /^\d+$/.test(teamId),
staleTime: 6 * 60 * 60 * 1000, // 6 hours
retry: 1,
```

### Dark Mode Tailwind Pairing
**Source:** `src/components/accuracy/AccuracyTab.tsx` throughout
**Apply to:** All new components (`BackTab.tsx`, `AccuracySubTabNav` in `AccuracyTab.tsx`)
```
text-zinc-600 dark:text-zinc-400    — secondary body text
text-zinc-500 dark:text-zinc-400    — muted/placeholder text
border-zinc-200 dark:border-zinc-700 — borders
bg-zinc-50 dark:bg-zinc-800         — chart/card backgrounds
bg-white dark:bg-zinc-900           — tooltip backgrounds
text-red-600 dark:text-red-400      — negative/loss values
text-green-600 dark:text-green-400  — positive/win values
```

### Three-Guard Loading/Error/Empty Pattern
**Source:** `src/components/accuracy/AccuracyTab.tsx` lines 1001–1033
**Apply to:** `src/components/accuracy/BackTab.tsx`
```typescript
if (isLoading) { return <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">…</p> }
if (error)     { return <p className="text-sm text-red-600 dark:text-red-400 py-4">…</p> }
if (!data)     { return <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">…</p> }
```

### recharts isAnimationActive={false}
**Source:** `src/components/accuracy/AccuracyTab.tsx` CalibrationSection
**Apply to:** Regret `<Bar>` in `BackTab.tsx`
```typescript
<Bar dataKey="regret" isAnimationActive={false}>
```

---

## No Analog Found

All files have close analogs. No files in Phase 96 require purely greenfield pattern invention.

---

## Metadata

**Analog search scope:** `src/app/api/`, `src/lib/hooks/`, `src/lib/`, `src/components/accuracy/`, `src/components/set-pieces/`, `src/components/gem-table/`, `pipeline/`
**Files scanned:** 12 source files read
**Pattern extraction date:** 2026-05-11
