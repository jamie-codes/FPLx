# Phase 124: Season Review - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/api/season-review/route.ts` | route handler | request-response | `src/app/api/season-analytics/route.ts` | exact |
| `src/lib/season-review.ts` | utility (pure lib) | transform | `src/lib/regret.ts` | exact |
| `src/lib/season-review.test.ts` | test | — | `src/lib/regret.test.ts` | exact |
| `src/lib/hooks/useSeasonReview.ts` | hook | request-response | `src/lib/hooks/useSeasonAnalytics.ts` | exact |
| `src/lib/hooks/useSeasonReview.test.ts` | test | — | `src/lib/hooks/useSeasonAnalytics.test.ts` | exact |
| `src/components/season-review/SeasonReviewTab.tsx` | component | request-response | `src/components/accuracy/BackTab.tsx` + `AccuracyTab.tsx` | role-match |
| `src/components/season-review/SeasonReviewTab.test.tsx` | test | — | `src/components/accuracy/BackTab.test.tsx` | role-match |
| `src/lib/types.ts` (modify) | type definitions | — | existing file — additive only | exact |
| `src/app/page.tsx` (modify) | page | — | existing file — two-line wiring | exact |

---

## Pattern Assignments

### `src/app/api/season-review/route.ts` (route handler, request-response)

**Analog:** `src/app/api/season-analytics/route.ts`

**Imports pattern** (lines 9–10):
```typescript
import type { NextRequest } from 'next/server'
import type { SeasonReview, SeasonGwEntry } from '@/lib/types'
```

**Constants pattern** (lines 12–13):
```typescript
const FPL_BASE = 'https://fantasy.premierleague.com/api'
const FPL_UA = 'fplx/1.X (+https://fplx.app)'
```

**Local interface block pattern** (lines 18–26):
```typescript
// Copy and EXTEND the FPLHistoryCurrent interface from season-analytics/route.ts line 19.
// The existing interface omits overall_rank — the new route MUST add it (RESEARCH Pitfall 1).
interface FPLHistoryChip    { name: string; event: number; time: string }
interface FPLHistoryCurrent {
  event: number
  points: number
  event_transfers_cost: number
  overall_rank: number   // ← NEW field: present in FPL API but absent from existing interface
}
interface FPLHistoryResponse { chips?: FPLHistoryChip[]; current?: FPLHistoryCurrent[] }
// Also add FPLBootstrapEvent interface for bootstrap events[] array:
interface FPLBootstrapEvent { id: number; average_entry_score: number; finished: boolean }
```

**Non-fatal fetch helper pattern** (lines 29–41 of season-analytics):
```typescript
async function fetchHistory(teamId: string): Promise<FPLHistoryResponse | null> {
  try {
    const res = await fetch(`${FPL_BASE}/entry/${teamId}/history/`, {
      headers: { 'User-Agent': FPL_UA },
    })
    if (!res.ok) return null
    const json = (await res.json()) as FPLHistoryResponse
    if (!json || typeof json !== 'object') return null
    return json
  } catch {
    return null
  }
}
// New bootstrap fetch (returns events array or empty array on failure):
async function fetchBootstrapEvents(): Promise<FPLBootstrapEvent[]> {
  try {
    const res = await fetch(`${FPL_BASE}/bootstrap-static/`, { headers: { 'User-Agent': FPL_UA } })
    if (!res.ok) return []
    const json = (await res.json()) as { events?: FPLBootstrapEvent[] }
    return Array.isArray(json?.events) ? json.events : []
  } catch {
    return []
  }
}
```

**GET handler + teamId validation + parallel fetch pattern** (lines 97–118):
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const teamIdParam = searchParams.get('teamId')
  if (!teamIdParam || !/^\d+$/.test(teamIdParam)) {
    return Response.json({ error: 'Invalid teamId parameter' }, { status: 400 })
  }
  const teamId = teamIdParam

  const [history, bootstrapEvents] = await Promise.all([
    fetchHistory(teamId),
    fetchBootstrapEvents(),
  ])

  if (history === null) {
    return Response.json({ error: 'FPL history fetch failed' }, { status: 502 })
  }

  const current = Array.isArray(history.current) ? history.current : []
  const chips   = Array.isArray(history.chips)   ? history.chips   : []

  // ... aggregate into SeasonReview ...
}
```

**Cache-Control response pattern** (line 210 of season-analytics):
```typescript
return Response.json(payload, {
  status: 200,
  headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' },
})
```

---

### `src/lib/season-review.ts` (utility, transform)

**Analog:** `src/lib/regret.ts`

**File header pattern** (lines 1–8 of regret.ts):
```typescript
// Phase 124 REV-02: season review grade computation + helper types.
// Pure module — no React, no fetch. Mirrors src/lib/regret.ts conventions.
//
// Sources of truth:
//   .planning/phases/124-season-review/124-CONTEXT.md §D-05, D-06
import type { GradeLabel } from './types'  // or define locally
```

**Export type + pure function pattern** (regret.ts lines 36–70):
```typescript
export type GradeLabel = 'A' | 'B' | 'C' | 'D'

/**
 * D-05/D-06: weighted composite decision quality grade.
 * D-06: when chipCount === 0, chip ROI component excluded and remaining
 * two renormalized to 100% (captain EV 40/75 ≈ 53.3%, hit BE 35/75 ≈ 46.7%).
 */
export function computeDecisionGrade(
  captainEVRate: number,
  hitBreakEvenRate: number,
  chipROIPositiveRate: number,
  chipCount: number,
): GradeLabel {
  const score = chipCount === 0
    ? captainEVRate * (40 / 75) + hitBreakEvenRate * (35 / 75)
    : captainEVRate * 0.40 + hitBreakEvenRate * 0.35 + chipROIPositiveRate * 0.25
  if (score >= 0.75) return 'A'
  if (score >= 0.50) return 'B'
  if (score >= 0.25) return 'C'
  return 'D'
}
```

Note: `computeSeasonSummary` in `regret.ts` (lines 51–70) is the source of `captainHitRate` — the `SeasonReviewTab` calls `useDecisionHistory(teamId)` and derives `captainHitRate` from `computeSeasonSummary(data.entries)`. No new extraction needed; wire in the component.

---

### `src/lib/season-review.test.ts` (test, pure functions)

**Analog:** `src/lib/regret.test.ts`

**Test file pattern** (lines 1–8 of regret.test.ts):
```typescript
// Phase 124 Wave 0 RED — computeDecisionGrade boundary conditions.
// season-review.ts does not exist yet; this file fails at import. Task N turns it GREEN.
import { describe, it, expect } from 'vitest'
import { computeDecisionGrade } from './season-review'
import type { GradeLabel } from '@/lib/types'
```

**Boundary test pattern** (lines 20–44 of regret.test.ts):
```typescript
describe('computeDecisionGrade — D-05/D-06 grade thresholds', () => {
  it('returns A when composite score >= 0.75', () => { ... })
  it('returns B when composite score >= 0.50 and < 0.75', () => { ... })
  it('returns C when composite score >= 0.25 and < 0.50', () => { ... })
  it('returns D when composite score < 0.25', () => { ... })
  it('D-06: excludes chip ROI when chipCount === 0 and renormalizes', () => { ... })
  it('D-06: does not return NaN when chipCount=0 and chip ROI would be 0/0', () => { ... })
})
```

---

### `src/lib/hooks/useSeasonReview.ts` (hook, request-response)

**Analog:** `src/lib/hooks/useSeasonAnalytics.ts` (entire file, 49 lines)

**Full hook pattern** (useSeasonAnalytics.ts lines 1–49 — copy and substitute):
```typescript
// Phase 124 REV-03: useSeasonReview TanStack Query v5 hook.
// In-memory cache only — settled season data; no ring-buffer persist.
import { useQuery } from '@tanstack/react-query'
import type { SeasonReview } from '../types'

async function fetchSeasonReview(teamId: string): Promise<SeasonReview> {
  const res = await fetch(`/api/season-review?teamId=${teamId}`)
  if (!res.ok) {
    const err = new Error(`Season review fetch failed: ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return (await res.json()) as SeasonReview
}

export function useSeasonReview(teamId: string | null) {
  return useQuery<SeasonReview>({
    queryKey: ['season-review', teamId],
    queryFn: () => {
      if (!teamId) throw new Error('teamId is required')
      return fetchSeasonReview(teamId)
    },
    enabled: !!teamId && /^\d+$/.test(teamId),
    staleTime: 6 * 60 * 60 * 1000,  // 6 hours — settled season data (D-11 pattern)
    retry: 1,
  })
}
```

Key differences from `useDecisionHistory`: NO `placeholderData` (no localStorage cache needed — season data is settled), NO `useEffect` for ring-buffer persistence.

---

### `src/lib/hooks/useSeasonReview.test.ts` (test, hook contract)

**Analog:** `src/lib/hooks/useSeasonAnalytics.test.ts` (entire file, 83 lines)

**Test wrapper + environment pattern** (lines 1–20 of useSeasonAnalytics.test.ts):
```typescript
// @vitest-environment jsdom
// Phase 124 Wave 0 RED — useSeasonReview hook contract.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useSeasonReview } from './useSeasonReview'
import type { SeasonReview } from '../types'

function makeWrapper(retries = 0) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: retries, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}
```

**Three required test cases** (mirroring lines 43–83 of useSeasonAnalytics.test.ts):
1. Disabled when `teamId` is null — `isFetching` is false, fetch not called
2. Disabled when `teamId` is non-numeric — same guard
3. Fetches `/api/season-review?teamId={id}` for valid numeric teamId and returns typed data
4. Surfaces error when route returns 500

---

### `src/components/season-review/SeasonReviewTab.tsx` (component, request-response)

**Analog:** `src/components/accuracy/AccuracyTab.tsx` (empty-state + loading pattern) + `src/components/accuracy/BackTab.tsx` (recharts + multi-hook pattern)

**'use client' directive + imports pattern** (BackTab.tsx lines 1–27):
```typescript
'use client'

import { useMemo } from 'react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { useSeasonReview } from '@/lib/hooks/useSeasonReview'
import { useSeasonAnalytics } from '@/lib/hooks/useSeasonAnalytics'
import { useDecisionHistory } from '@/lib/hooks/useDecisionHistory'
import { computeSeasonSummary } from '@/lib/regret'
import { computeDecisionGrade } from '@/lib/season-review'
import type { SeasonGwEntry } from '@/lib/types'
```

**Empty-state pattern when teamId is null** (AccuracyTab.tsx lines 1054–1097, D-08 pattern):
```typescript
export function SeasonReviewTab({ teamId = null }: { teamId?: string | null }) {
  // ... hooks ...
  if (!teamId) {
    return (
      <section className="mt-6" aria-label="Season review">
        <div className="rounded border border-zinc-200 dark:border-zinc-700 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Enter your FPL Team ID to see your Season Review
        </div>
      </section>
    )
  }
  // ...
}
```

**Multi-hook loading guard pattern** (BackTab.tsx pattern + RESEARCH Pitfall 2):
```typescript
const reviewQuery    = useSeasonReview(teamId)
const analyticsQuery = useSeasonAnalytics(teamId)
const historyQuery   = useDecisionHistory(teamId)

const isLoading = reviewQuery.isLoading || analyticsQuery.isLoading || historyQuery.isLoading
const isError   = reviewQuery.isError || analyticsQuery.isError

if (isLoading) { /* skeleton: animate-pulse, 3 cards */ }
if (isError)   { /* error state */ }
```

**Grade computation gated on all three hooks** (RESEARCH Pitfall 2):
```typescript
// Only compute grade when all three hooks have resolved successfully.
const grade = useMemo(() => {
  if (!reviewQuery.isSuccess || !analyticsQuery.isSuccess || !historyQuery.isSuccess) return null
  const summary = computeSeasonSummary(historyQuery.data.entries)
  if (summary.captainHitRate === null) return null
  const chipRoi = analyticsQuery.data.chipRoi
  const hitTracking = analyticsQuery.data.hitTracking
  const chipCount = reviewQuery.data.gwData.filter(g => g.chipPlayed !== null).length
  // D-06: guard division by zero when hitTracking is empty
  const hitBreakEvenRate = hitTracking.length === 0
    ? 1.0  // vacuously true: no hits taken
    : hitTracking.filter(h => h.brokeEven).length / hitTracking.length
  // D-06: guard when no chips played
  const chipROIPositiveRate = chipRoi.length === 0
    ? 0  // excluded from grade by D-06 chipCount === 0 path
    : chipRoi.filter(c => c.delta > 0).length / chipRoi.length
  return computeDecisionGrade(summary.captainHitRate, hitBreakEvenRate, chipROIPositiveRate, chipCount)
}, [reviewQuery.isSuccess, analyticsQuery.isSuccess, historyQuery.isSuccess,
    reviewQuery.data, analyticsQuery.data, historyQuery.data])
```

**Custom dot renderer pattern** (BackTab.tsx SparklineDot pattern, lines 912–918):
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChipDot(props: any) {
  const { cx, cy, payload } = props
  if (!payload?.chipPlayed) return <circle cx={cx} cy={cy} r={3} fill="currentColor" stroke="none" />
  return <circle cx={cx} cy={cy} r={6} fill="#f59e0b" stroke="none" />
}
```

**Custom tooltip pattern** (BackTab.tsx RegretTooltip lines 62–95):
```typescript
function SeasonChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as SeasonGwEntry
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">GW{p.gw}</p>
      {/* Points, avg manager score, chip name (using CHIP_DISPLAY_NAME map), overall rank */}
    </div>
  )
}
```

**Chip display name map** (BackTab.tsx lines 41–45 — copy verbatim):
```typescript
const CHIP_DISPLAY_NAME: Record<'bboost' | '3xc' | 'freehit' | 'wildcard', string> = {
  bboost:   'Bench Boost',
  '3xc':    'Triple Captain',
  freehit:  'Free Hit',
  wildcard: 'Wildcard',
}
```

**ComposedChart with two Line series** (AccuracyTab.tsx CalibrationSection lines 403–444):
```typescript
<ResponsiveContainer width="100%" height={288}>
  <ComposedChart data={gwData}>
    <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.3)" />
    <XAxis
      dataKey="gw"
      tick={{ fontSize: 12, fill: 'currentColor' }}
      axisLine={false}
      tickLine={false}
    />
    <YAxis
      tick={{ fontSize: 12, fill: 'currentColor' }}
      axisLine={false}
      tickLine={false}
      width={40}
    />
    <Tooltip content={<SeasonChartTooltip />} />
    <Line
      type="monotone"
      dataKey="points"
      stroke="currentColor"
      strokeWidth={2}
      dot={<ChipDot />}
      activeDot={{ r: 5 }}
      isAnimationActive={false}
    />
    <Line
      type="monotone"
      dataKey="avgManagerScore"
      stroke="rgba(161,161,170,0.6)"
      strokeWidth={1.5}
      strokeDasharray="4 4"
      dot={false}
      isAnimationActive={false}
    />
  </ComposedChart>
</ResponsiveContainer>
```

**Table chrome constants** (BackTab.tsx lines 30–33 — copy verbatim for stats grid):
```typescript
const TH_CLS = 'text-left font-semibold text-zinc-600 dark:text-zinc-400 pb-1 border-b border-zinc-200 dark:border-zinc-700'
const TR_CLS = 'even:bg-zinc-50 dark:even:bg-zinc-800/50'
const TD_CLS = 'py-1 px-2'
const TABLE_CLS = 'w-full text-sm border-collapse'
```

---

### `src/components/season-review/SeasonReviewTab.test.tsx` (test, component render)

**Analog:** `src/components/accuracy/BackTab.test.tsx`

**Test setup pattern** — use `@vitest-environment jsdom`, mock both `useSeasonReview`, `useSeasonAnalytics`, and `useDecisionHistory` with `vi.mock`. Required test cases:
1. Renders empty state card when `teamId` is null (REV-04 D-08)
2. Renders skeleton/loading state when hooks are loading
3. Renders grade badge `—` when any hook is still loading (RESEARCH Pitfall 2)
4. Renders grade `A`/`B`/`C`/`D` when all three hooks resolve (REV-02)
5. Renders summary stats card fields (REV-01): total points, rank, best GW, worst GW, transfer net

---

### `src/lib/types.ts` (modify — additive only)

**Analog:** existing types block at lines 745–781

**Insertion point:** After `SeasonAnalytics` interface (line 781), before the `Insights` block (line 783).

**New types to add:**
```typescript
/** Phase 124 REV-03: one GW entry in the season-review chart and tooltip */
export interface SeasonGwEntry {
  gw: number
  points: number             // user's actual GW score
  avgManagerScore: number    // FPL events[].average_entry_score for this GW
  overallRank: number        // user's overall rank after this GW
  chipPlayed: string | null  // chip slug ('bboost'|'3xc'|'freehit'|'wildcard') or null
}

/** Phase 124 REV-01: full response from GET /api/season-review?teamId={id} */
export interface SeasonReview {
  totalPoints: number
  finalRank: number
  bestGw: { gw: number; points: number }
  worstGw: { gw: number; points: number }
  transferNetPoints: number  // sum of -(event_transfers_cost) — negative means hits taken
  gwData: SeasonGwEntry[]    // ordered GW1..GW38 (only GWs that have played)
}
```

Note: `captainHits` / `captainGwsWithData` from RESEARCH type draft are NOT added to `SeasonReview` — the component derives captain hit rate by calling `useDecisionHistory` + `computeSeasonSummary` client-side (D-04 decision). The route only returns raw history stats.

---

### `src/app/page.tsx` (modify — two surgical edits)

**Analog:** existing file — insertion points confirmed by RESEARCH.

**Edit 1 — SubTab union type** (line 56):
```typescript
// BEFORE:
export type SubTab = 'gems' | ... | 'accuracy' | 'price-changes' | ...
// AFTER — add 'season' between 'accuracy' and 'price-changes':
export type SubTab = 'gems' | ... | 'accuracy' | 'season' | 'price-changes' | ...
```

**Edit 2 — SECTIONS Analyse subTabs array** (line 69 — insert after accuracy, before price-changes):
```typescript
{ id: 'accuracy' as SubTab,      label: 'Accuracy',      mobileLabel: 'Acc'    },
{ id: 'season' as SubTab,        label: 'Season',        mobileLabel: 'Season' },  // ← NEW
{ id: 'price-changes' as SubTab, label: 'Price Changes', mobileLabel: 'Prices' },
```

**Edit 3 — content render condition** (after line 281 — insert after the accuracy render block):
```typescript
{activeSection !== 'squad' && activeSubTab === 'accuracy' && <AccuracyTab teamId={submittedId} />}
{activeSection !== 'squad' && activeSubTab === 'season' && <SeasonReviewTab teamId={submittedId} />}  // ← NEW
{activeSection !== 'squad' && activeSubTab === 'price-changes' && <PriceChangePanel />}
```

Also add import at top of file (after `AccuracyTab` import line 26):
```typescript
import { SeasonReviewTab } from '@/components/season-review/SeasonReviewTab'
```

---

## Shared Patterns

### teamId Validation (SSRF guard)
**Source:** `src/app/api/season-analytics/route.ts` lines 100–101
**Apply to:** `src/app/api/season-review/route.ts`, `src/lib/hooks/useSeasonReview.ts`
```typescript
if (!teamIdParam || !/^\d+$/.test(teamIdParam)) {
  return Response.json({ error: 'Invalid teamId parameter' }, { status: 400 })
}
```
```typescript
enabled: !!teamId && /^\d+$/.test(teamId),
```

### Non-fatal Fetch (partial failure fold)
**Source:** `src/app/api/season-analytics/route.ts` lines 29–41 and 43–54
**Apply to:** both fetch helpers in `src/app/api/season-review/route.ts`
```typescript
try {
  const res = await fetch(url, { headers: { 'User-Agent': FPL_UA } })
  if (!res.ok) return null  // or [] for array helpers
  const json = await res.json()
  // ...type cast...
  return json
} catch {
  return null  // or []
}
```

### staleTime Convention
**Source:** `src/lib/hooks/useSeasonAnalytics.ts` line 46
**Apply to:** `src/lib/hooks/useSeasonReview.ts`
```typescript
staleTime: 6 * 60 * 60 * 1000,  // 6 hours — settled season data
```

### TanStack Query v5 Side-effect Pattern
**Source:** `src/lib/hooks/useDecisionHistory.ts` lines 53–59
**Apply to:** `SeasonReviewTab` — any side-effect on query resolution uses `useEffect` on `query.isSuccess`, NOT deprecated v4 `onSuccess` option.

### Cache-Control Header
**Source:** `src/app/api/season-analytics/route.ts` line 210
**Apply to:** `src/app/api/season-review/route.ts`
```typescript
headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' }
```

### Tailwind-only Styling
**Source:** all existing components — no shadcn, no CSS modules
**Apply to:** `SeasonReviewTab.tsx` — use Tailwind classes exclusively; reference AccuracyTab.tsx and BackTab.tsx class patterns for dark mode variants (`dark:bg-zinc-800`, `dark:text-zinc-300`, etc.)

### recharts isAnimationActive={false}
**Source:** `src/components/accuracy/AccuracyTab.tsx` lines 438, 530; `BackTab.tsx` line 966
**Apply to:** All `<Line>` components in `SeasonReviewTab.tsx` — animation causes test flakiness.

---

## Anti-Patterns to Avoid (from RESEARCH.md)

| Anti-Pattern | Why | Where Documented |
|---|---|---|
| Self-calling `/api/*` from another route | Fails on Vercel serverless | RESEARCH Anti-Patterns §1 |
| Reading 38 Blob files for avg score | Too expensive; D-02 locks bootstrap | RESEARCH Anti-Patterns §2 |
| 38 sequential `/entry/{id}/event/{gw}/picks/` calls for captain rate | Too expensive; use `useDecisionHistory` TanStack cache | RESEARCH Pattern 4 |
| TanStack v4 `onSuccess`/`onError` options | Removed in v5 | RESEARCH §State of the Art |
| Copy `FPLHistoryCurrent` from season-analytics without adding `overall_rank` | Rank shows undefined in tooltip | RESEARCH Pitfall 1 |
| Compute grade before all three hooks resolve | Grade flickers D→higher as data loads | RESEARCH Pitfall 2 |
| `chipROIPositiveRate = chipRoi.filter(...).length / 0` when no chips | NaN breaks composite score | RESEARCH Pitfall 3 |
| `hitBreakEvenRate = 0 / 0` when no hits taken | NaN breaks composite score | RESEARCH Pitfall 4 |
| Accessing bootstrap field as `average_score` instead of `average_entry_score` | Avg manager line is all-zero | RESEARCH Pitfall 6 |

---

## No Analog Found

All files have strong analogs. No "no analog" entries.

---

## Metadata

**Analog search scope:** `src/app/api/`, `src/lib/`, `src/lib/hooks/`, `src/components/accuracy/`, `src/app/page.tsx`
**Files scanned:** 9 source files read directly
**Pattern extraction date:** 2026-05-19
