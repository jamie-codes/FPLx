# PICK-01: Weekly Picks Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New "Weekly Picks" tab — side-by-side 1GW/3GW top-10 tables, honest-confidence strip, under-the-radar gems row — plus the pipeline block that computes live honest metrics.

**Architecture:** `'use client'` tab in the single-page app (in-page tab state, NOT a new route). Pure selection logic isolated in `src/lib/picks.ts` (unit-tested). Data via existing `usePlayers()`/`useAccuracy()` hooks. Pipeline writes `summary.honest_metrics` via the BT-02 harness.

**Tech Stack:** Next 16.2.1 App Router (client components), React 19, Tailwind v4 (class-based dark mode), TanStack Query, Vitest + React Testing Library (`// @vitest-environment jsdom` per-file pragma), pytest for the pipeline.

---

## Plan deviations from spec (documented)

1. **Hand-rolled table, not TanStack**: the spec's architecture line said "TanStack table idiom from gem-table". The picks tables are *rank-ordered by definition* — no sorting/filtering/column state is needed. Use the simpler hand-rolled `<table>` idiom (AccuracyTab/BackTab convention: local chrome class constants) with a `useState` expanded-row. Less machinery, same look.
2. **Component key is `defcon`, not `defcon_pts`**: the pipeline writes `'defcon'` into `xPts_components_1gw` (merge.py DC-01). types.ts gains `defcon?: number`.

## File map

| File | Change |
|---|---|
| `src/lib/picks.ts` | Create — pure helpers |
| `src/lib/picks.test.ts` | Create — vitest unit tests |
| `src/lib/types.ts` | Modify — `HonestMetrics`, `summary.honest_metrics?`, `defcon?` component |
| `src/components/weekly-picks/ConfidenceStrip.tsx` + `.test.tsx` | Create |
| `src/components/weekly-picks/PicksTable.tsx` | Create |
| `src/components/weekly-picks/UnderTheRadar.tsx` | Create |
| `src/components/weekly-picks/WeeklyPicksTab.tsx` + `.test.tsx` | Create |
| `src/app/page.tsx` | Modify — SubTab union, Analyse subTabs, import, render conditional |
| `pipeline/run.py` | Modify — honest_metrics block |
| `pipeline/tests/test_run.py` | Modify — honest_metrics tests |

**Required reading before any UI code** (AGENTS.md mandate): `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`. (PICK-01 is a client tab; no new routes, so the Next-16 `params`-Promise changes don't apply — but read it anyway.)

UI verification commands (repo root): `npm test` (vitest), `npx tsc --noEmit`, `npm run lint`.

---

## Task 1: `src/lib/picks.ts` — selection logic + types

**Files:** Create `src/lib/picks.ts`, `src/lib/picks.test.ts`; Modify `src/lib/types.ts`

### Step 1: Write the failing tests

Create `src/lib/picks.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { rankPicks, underTheRadar, isOffSeason, nextEventsFixtures, haulCaptureLabel, xptsFor } from './picks'
import type { MergedPlayer, FixtureEntry } from './types'

function player(over: Partial<MergedPlayer>): MergedPlayer {
  return {
    id: 1, web_name: 'P', team: 1, team_short_name: 'ARS', element_type: 4,
    now_cost: 60, selected_by_percent: '20.0', status: 'a', fixtures: [],
    ...over,
  } as MergedPlayer
}

describe('rankPicks', () => {
  it('ranks by xPts_1gw desc and takes top n', () => {
    const ps = [player({ id: 1, xPts_1gw: 3 }), player({ id: 2, xPts_1gw: 7 }), player({ id: 3, xPts_1gw: 5 })]
    expect(rankPicks(ps, '1gw', 2).map((p) => p.id)).toEqual([2, 3])
  })
  it('uses xPts_3gw for the 3gw horizon', () => {
    const ps = [player({ id: 1, xPts_1gw: 9, xPts_3gw: 1 }), player({ id: 2, xPts_1gw: 1, xPts_3gw: 9 })]
    expect(rankPicks(ps, '3gw', 1)[0].id).toBe(2)
  })
  it('excludes status u (left league); keeps d/i/s', () => {
    const ps = [player({ id: 1, xPts_1gw: 9, status: 'u' }), player({ id: 2, xPts_1gw: 5, status: 'd' })]
    expect(rankPicks(ps, '1gw', 10).map((p) => p.id)).toEqual([2])
  })
  it('treats missing xPts as 0', () => {
    const ps = [player({ id: 1 }), player({ id: 2, xPts_1gw: 0.1 })]
    expect(rankPicks(ps, '1gw', 1)[0].id).toBe(2)
  })
})

describe('underTheRadar', () => {
  it('keeps only sub-threshold ownership, ranked by xPts_1gw', () => {
    const ps = [
      player({ id: 1, xPts_1gw: 9, selected_by_percent: '45.0' }),
      player({ id: 2, xPts_1gw: 5, selected_by_percent: '4.1' }),
      player({ id: 3, xPts_1gw: 6, selected_by_percent: '9.9' }),
    ]
    expect(underTheRadar(ps, 10, 5).map((p) => p.id)).toEqual([3, 2])
  })
})

describe('isOffSeason', () => {
  it('true when all xPts are zero/undefined', () => {
    expect(isOffSeason([player({}), player({ xPts_1gw: 0 })])).toBe(true)
  })
  it('false when any player has positive xPts', () => {
    expect(isOffSeason([player({}), player({ xPts_1gw: 0.2 })])).toBe(false)
  })
  it('true for empty list (nothing to show)', () => {
    expect(isOffSeason([])).toBe(true)
  })
})

describe('nextEventsFixtures', () => {
  const fx = (event_id: number, opp: string): FixtureEntry => ({
    opponent_team: opp, is_home: true, event_id,
    difficulty_score: 0.5, difficulty_tier: 'medium',
  })
  it('slices by distinct event ids, keeping DGW pairs intact', () => {
    const fixtures = [fx(2, 'A'), fx(2, 'B'), fx(3, 'C'), fx(4, 'D')]
    expect(nextEventsFixtures(fixtures, 1)).toHaveLength(2)   // DGW: both GW2 fixtures
    expect(nextEventsFixtures(fixtures, 2)).toHaveLength(3)
    expect(nextEventsFixtures(fixtures, 3)).toHaveLength(4)
  })
})

describe('haulCaptureLabel', () => {
  it('renders ~1 in N', () => {
    expect(haulCaptureLabel(0.194)).toBe('~1 in 5')
    expect(haulCaptureLabel(0.5)).toBe('~1 in 2')
  })
  it('em-dash for zero/null', () => {
    expect(haulCaptureLabel(0)).toBe('—')
    expect(haulCaptureLabel(null)).toBe('—')
  })
})

describe('xptsFor', () => {
  it('returns 0 fallback', () => {
    expect(xptsFor(player({}), '1gw')).toBe(0)
  })
})
```

### Step 2: Run to verify failure

Run (repo root): `npx vitest run src/lib/picks.test.ts`
Expected: FAIL — Cannot find module './picks'

### Step 3: Implement `src/lib/picks.ts`

```ts
// PICK-01: pure selection/ranking helpers for the Weekly Picks tab.
// Ranking is by mean xPts — exp04 (2026-06) showed nothing beats it.
import type { MergedPlayer, FixtureEntry } from './types'

export type PicksHorizon = '1gw' | '3gw'

export function xptsFor(p: MergedPlayer, horizon: PicksHorizon): number {
  return (horizon === '1gw' ? p.xPts_1gw : p.xPts_3gw) ?? 0
}

/** Top-n by xPts for the horizon. status 'u' (left the league) excluded;
 * doubtful/injured stay listed (xmins already discounts them) with a ⚠ in the UI. */
export function rankPicks(players: MergedPlayer[], horizon: PicksHorizon, n = 10): MergedPlayer[] {
  return players
    .filter((p) => p.status !== 'u')
    .sort((a, b) => xptsFor(b, horizon) - xptsFor(a, horizon))
    .slice(0, n)
}

/** Highest-xPts players under the ownership threshold ("under the radar"). */
export function underTheRadar(players: MergedPlayer[], maxOwnership = 10, n = 5): MergedPlayer[] {
  return players
    .filter((p) => p.status !== 'u' && Number(p.selected_by_percent) < maxOwnership)
    .sort((a, b) => xptsFor(b, '1gw') - xptsFor(a, '1gw'))
    .slice(0, n)
}

/** Off-season pipeline output has no positive xPts — show an empty state, not zeros. */
export function isOffSeason(players: MergedPlayer[]): boolean {
  return players.every((p) => (p.xPts_1gw ?? 0) <= 0)
}

/** First n DISTINCT gameweeks' fixtures (a DGW keeps both entries).
 * FixtureBadges renders everything it is given — callers slice with this. */
export function nextEventsFixtures(fixtures: FixtureEntry[], nEvents: number): FixtureEntry[] {
  const eventIds = [...new Set(fixtures.map((f) => f.event_id))]
    .sort((a, b) => a - b)
    .slice(0, nEvents)
  return fixtures.filter((f) => eventIds.includes(f.event_id))
}

/** 0.194 -> "~1 in 5" */
export function haulCaptureLabel(v: number | null | undefined): string {
  if (!v || v <= 0) return '—'
  return `~1 in ${Math.round(1 / v)}`
}
```

### Step 4: types.ts additions

In `src/lib/types.ts`:

a) Inside the `xPts_components_1gw` block, after the `save_pts?` line:
```ts
    defcon?: number             // PICK-01/DC-02 — DC-01 DefCon EV component; absent pre-rollout
```

b) New interface near `AccuracySummary` and a new optional summary field:
```ts
// PICK-01: honest pick-quality metrics (BT-02 leakage-free harness, computed in-pipeline)
export interface HonestMetrics {
  top10_mean_pts: number | null
  haul_capture_20: number | null
  captain_return_rate: number | null
  haul_hit_rate?: number | null
  n_gws: number
}
```
and inside `AccuracySummary`:
```ts
  honest_metrics?: HonestMetrics    // PICK-01 — present once the live season has >= 8 finished GWs
```

### Step 5: Verify

`npx vitest run src/lib/picks.test.ts` → all pass. `npx tsc --noEmit` → clean.

### Step 6: Commit

`git add src/lib/picks.ts src/lib/picks.test.ts src/lib/types.ts && git commit -m "feat(pick-01): picks selection helpers + honest-metrics types"`

---

## Task 2: `ConfidenceStrip`

**Files:** Create `src/components/weekly-picks/ConfidenceStrip.tsx`, `ConfidenceStrip.test.tsx`

### Step 1: Failing tests

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfidenceStrip } from './ConfidenceStrip'

describe('ConfidenceStrip — PICK-01', () => {
  it('falls back to last-season constants when no honest metrics', () => {
    render(<ConfidenceStrip honest={undefined} />)
    expect(screen.getByText('5.7')).toBeTruthy()           // 5.66 rounded to 1dp
    expect(screen.getByText('~1 in 5')).toBeTruthy()
    expect(screen.getByText('60%')).toBeTruthy()
    expect(screen.getByText(/2025\/26/)).toBeTruthy()
  })
  it('falls back when honest metrics cover < 8 GWs', () => {
    render(<ConfidenceStrip honest={{ top10_mean_pts: 9.9, haul_capture_20: 0.5, captain_return_rate: 1, n_gws: 4 }} />)
    expect(screen.getByText('5.7')).toBeTruthy()
    expect(screen.queryByText('9.9')).toBeNull()
  })
  it('uses live metrics at >= 8 GWs with live caption', () => {
    render(<ConfidenceStrip honest={{ top10_mean_pts: 6.12, haul_capture_20: 0.25, captain_return_rate: 0.7, n_gws: 12 }} />)
    expect(screen.getByText('6.1')).toBeTruthy()
    expect(screen.getByText('~1 in 4')).toBeTruthy()
    expect(screen.getByText('70%')).toBeTruthy()
    expect(screen.getByText(/12 GWs/)).toBeTruthy()
  })
})
```

### Step 2: Verify failure, then implement

```tsx
'use client'
// PICK-01: honest pick-quality stats. Live (BT-02-in-pipeline) once the season
// has >= 8 finished GWs; until then, the 2025/26 validation numbers (exp05).
import type { HonestMetrics } from '@/lib/types'
import { haulCaptureLabel } from '@/lib/picks'

const LAST_SEASON: HonestMetrics = {
  top10_mean_pts: 5.66,        // exp05 promoted model, validation GW29-38
  haul_capture_20: 0.194,
  captain_return_rate: 0.60,
  n_gws: 10,
}
const MIN_LIVE_GWS = 8

const CARD_CLS = 'rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2'

export function ConfidenceStrip({ honest }: { honest: HonestMetrics | undefined }) {
  const live = honest != null && honest.n_gws >= MIN_LIVE_GWS
  const m = live ? honest : LAST_SEASON
  const caption = live
    ? `measured over this season's ${m.n_gws} GWs`
    : 'measured on 2025/26 — switches to live after GW8'

  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <div className={CARD_CLS}>
        <span className="font-semibold">{m.top10_mean_pts != null ? m.top10_mean_pts.toFixed(1) : '—'}</span> pts/pick
        <div className="text-xs text-zinc-500 dark:text-zinc-400">top-10 weekly avg</div>
      </div>
      <div className={CARD_CLS}>
        <span className="font-semibold">{haulCaptureLabel(m.haul_capture_20)}</span>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">hauls captured in top-20</div>
      </div>
      <div className={CARD_CLS}>
        <span className="font-semibold">{m.captain_return_rate != null ? `${Math.round(m.captain_return_rate * 100)}%` : '—'}</span>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">#1 pick returns 6+</div>
      </div>
      <div className="rounded border border-dashed border-zinc-300 dark:border-zinc-600 px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 self-stretch flex items-center">
        {caption}
      </div>
    </div>
  )
}
```

Note for the test expecting `'60%'` / `'70%'`: `Math.round(0.60*100)` = 60 ✓.

### Step 3: Verify + commit

`npx vitest run src/components/weekly-picks/ConfidenceStrip.test.tsx` → 3 pass; `npx tsc --noEmit` clean.
`git add src/components/weekly-picks/ && git commit -m "feat(pick-01): ConfidenceStrip with live/last-season source logic"`

---

## Task 3: `PicksTable`, `UnderTheRadar`, `WeeklyPicksTab`

**Files:** Create `src/components/weekly-picks/PicksTable.tsx`, `UnderTheRadar.tsx`, `WeeklyPicksTab.tsx`, `WeeklyPicksTab.test.tsx`

### Step 1: Failing tests (`WeeklyPicksTab.test.tsx`)

Component tests mock the hooks (module-level `vi.mock`). Read one existing hook-mocking test for the house style first (`grep -rl "vi.mock" src/components | head -3`); follow it. The tests:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeeklyPicksTab } from './WeeklyPicksTab'
import type { MergedPlayer } from '@/lib/types'

const players: Partial<MergedPlayer>[] = [
  { id: 1, web_name: 'Alpha', team_short_name: 'ARS', element_type: 4, status: 'a',
    selected_by_percent: '40.0', now_cost: 90, xPts_1gw: 7.2, xPts_3gw: 18.0,
    haul_prob: 0.34, differential_flag: null, fixtures: [] },
  { id: 2, web_name: 'Beta', team_short_name: 'CHE', element_type: 3, status: 'd',
    selected_by_percent: '4.1', now_cost: 55, xPts_1gw: 5.5, xPts_3gw: 14.0,
    haul_prob: 0.22, differential_flag: 'diff', fixtures: [] },
]

vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: () => ({ data: players, isLoading: false, error: null }),
}))
vi.mock('@/lib/hooks/useAccuracy', () => ({
  useAccuracy: () => ({ data: { summary: {} } }),
}))

describe('WeeklyPicksTab — PICK-01', () => {
  it('renders both horizon tables with ranked players', () => {
    render(<WeeklyPicksTab />)
    expect(screen.getByText(/next gw/i)).toBeTruthy()
    expect(screen.getByText(/next 3 gws/i)).toBeTruthy()
    expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(2) // both tables
  })
  it('renders under-the-radar chip for low-ownership player', () => {
    render(<WeeklyPicksTab />)
    expect(screen.getByText(/under the radar/i)).toBeTruthy()
    // Beta is 4.1% owned -> appears in radar row as well as tables
    expect(screen.getAllByText('Beta').length).toBeGreaterThanOrEqual(3)
  })
  it('shows status warning for doubtful player', () => {
    render(<WeeklyPicksTab />)
    expect(screen.getAllByTitle('Doubtful').length).toBeGreaterThanOrEqual(1)
  })
})
```

Plus an off-season test in the same file (separate `vi.mock` is module-level, so put the off-season case in `WeeklyPicksTab.offseason.test.tsx` with all-zero players and assert the empty-state text `/picks return when the season starts/i`).

### Step 2: Implement `PicksTable.tsx`

```tsx
'use client'
// PICK-01: one ranked picks table. Rank-ordered by definition — no sorting UI.
// Chrome constants are local copies per PATTERNS.md convention.
import { Fragment, useState } from 'react'
import type { MergedPlayer } from '@/lib/types'
import { xptsFor, nextEventsFixtures, type PicksHorizon } from '@/lib/picks'
import { DifferentialBadge } from '@/components/gem-table/DifferentialBadge'
import { MCDistributionBar } from '@/components/mc/MCDistributionBar'
import { FixtureBadges } from '@/components/fixtures/FixtureBadges'

const TABLE_CLS = 'w-full text-sm border-collapse'
const TH_CLS = 'text-left font-semibold text-zinc-600 dark:text-zinc-400 pb-1 border-b border-zinc-200 dark:border-zinc-700'
const TR_CLS = 'even:bg-zinc-50 dark:even:bg-zinc-800/50 cursor-pointer hover:bg-blue-50 dark:hover:bg-zinc-700'
const TD_CLS = 'py-1 px-1'
const POS_LABEL: Record<number, string> = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' }
const STATUS_WARN: Record<string, string> = { d: 'Doubtful', i: 'Injured', s: 'Suspended', n: 'Not available' }

const COMPONENT_LABELS: [key: string, label: string][] = [
  ['goal_pts', 'Goals'], ['assist_pts', 'Assists'], ['cs_pts', 'Clean sheet'],
  ['bonus_pts', 'Bonus'], ['appearance_pts', 'Appearance'], ['save_pts', 'Saves'],
  ['defcon', 'DefCon'],
]

function ExpandedPanel({ p }: { p: MergedPlayer }) {
  const comps = p.xPts_components_1gw
  const entries = comps
    ? COMPONENT_LABELS.map(([k, label]) => [label, (comps as Record<string, number | undefined>)[k]] as const)
        .filter((e): e is readonly [string, number] => typeof e[1] === 'number' && e[1] > 0)
    : []
  const max = Math.max(...entries.map(([, v]) => v), 0.001)
  return (
    <div className="space-y-2 text-xs">
      {entries.length > 0 && (
        <div className="space-y-0.5">
          {entries.map(([label, v]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-20 text-zinc-500 dark:text-zinc-400">{label}</span>
              <div className="h-2 rounded bg-blue-400 dark:bg-blue-600" style={{ width: `${(v / max) * 120}px` }} />
              <span>{v.toFixed(2)}</span>
            </div>
          ))}
          <div className="text-zinc-400 dark:text-zinc-500">per-GW components</div>
        </div>
      )}
      {p.haul_prob != null && p.p10_pts != null && p.p90_pts != null && (
        <MCDistributionBar blankProb={p.blank_prob ?? 0} haulProb={p.haul_prob} p10Pts={p.p10_pts} p90Pts={p.p90_pts} />
      )}
    </div>
  )
}

export function PicksTable({ title, players, horizon }: {
  title: string
  players: MergedPlayer[]
  horizon: PicksHorizon
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const nEvents = horizon === '1gw' ? 1 : 3

  return (
    <div className="flex-1 min-w-[300px] rounded border border-zinc-200 dark:border-zinc-700 p-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">{title}</h3>
      <table className={TABLE_CLS}>
        <thead>
          <tr>
            <th className={TH_CLS}>#</th>
            <th className={TH_CLS}>Player</th>
            <th className={TH_CLS}>{horizon === '1gw' ? 'Fixture' : 'Fixtures'}</th>
            <th className={`${TH_CLS} text-right`}>xPts</th>
            {horizon === '1gw' && <th className={`${TH_CLS} text-right`}>Haul</th>}
            <th className={TH_CLS}></th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <Fragment key={p.id}>
              <tr className={TR_CLS} onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                <td className={TD_CLS}>{i + 1}</td>
                <td className={TD_CLS}>
                  <span className="font-medium">{p.web_name}</span>{' '}
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {POS_LABEL[p.element_type]} {p.team_short_name}
                  </span>
                  {STATUS_WARN[p.status] && <span title={STATUS_WARN[p.status]}> ⚠</span>}
                </td>
                <td className={TD_CLS}><FixtureBadges fixtures={nextEventsFixtures(p.fixtures ?? [], nEvents)} /></td>
                <td className={`${TD_CLS} text-right font-semibold`}>{xptsFor(p, horizon).toFixed(1)}</td>
                {horizon === '1gw' && (
                  <td className={`${TD_CLS} text-right`}>
                    {p.haul_prob != null ? `${Math.round(p.haul_prob * 100)}%` : '—'}
                  </td>
                )}
                <td className={TD_CLS}>
                  <DifferentialBadge flag={p.differential_flag} ownership={Number(p.selected_by_percent)} />
                </td>
              </tr>
              {expandedId === p.id && (
                <tr className="bg-blue-50 dark:bg-blue-950">
                  <td colSpan={horizon === '1gw' ? 6 : 5} className="px-3 py-2"><ExpandedPanel p={p} /></td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

(If `DifferentialBadge` renders an em-dash for null flags that looks noisy in this context, that matches the gem table — keep it.)

### Step 3: Implement `UnderTheRadar.tsx`

```tsx
'use client'
// PICK-01: low-ownership gems row.
import type { MergedPlayer } from '@/lib/types'

export function UnderTheRadar({ players }: { players: MergedPlayer[] }) {
  if (players.length === 0) return null
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 p-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
        Under the radar
        <span className="ml-2 font-normal normal-case text-xs text-zinc-500 dark:text-zinc-400">
          highest xPts among &lt;10% owned
        </span>
      </h3>
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        {players.map((p) => (
          <span key={p.id} className="rounded-full border border-zinc-300 dark:border-zinc-600 px-3 py-1">
            <span className="font-medium">{p.web_name}</span>
            {' · '}{(p.xPts_1gw ?? 0).toFixed(1)} xPts
            {' · '}{Number(p.selected_by_percent).toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  )
}
```

### Step 4: Implement `WeeklyPicksTab.tsx`

```tsx
'use client'
// PICK-01: Weekly Picks tab — confidence strip, side-by-side 1GW/3GW top-10, gems row.
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useAccuracy } from '@/lib/hooks/useAccuracy'
import { rankPicks, underTheRadar, isOffSeason } from '@/lib/picks'
import { ConfidenceStrip } from './ConfidenceStrip'
import { PicksTable } from './PicksTable'
import { UnderTheRadar } from './UnderTheRadar'

export function WeeklyPicksTab() {
  const { data: players, isLoading, error } = usePlayers()
  const { data: accuracy } = useAccuracy()

  if (isLoading) {
    return <p className="text-gray-500 dark:text-zinc-400">Loading players...</p>
  }
  if (error) {
    return (
      <p className="text-red-500">
        Failed to load players: {error instanceof Error ? error.message : String(error)}
      </p>
    )
  }
  const all = players ?? []

  if (isOffSeason(all)) {
    return (
      <div className="space-y-4">
        <ConfidenceStrip honest={accuracy?.summary?.honest_metrics} />
        <div className="rounded border border-zinc-200 dark:border-zinc-700 p-6 text-center text-zinc-500 dark:text-zinc-400">
          Picks return when the season starts.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ConfidenceStrip honest={accuracy?.summary?.honest_metrics} />
      <div className="flex flex-wrap gap-4">
        <PicksTable title="Next GW" players={rankPicks(all, '1gw')} horizon="1gw" />
        <PicksTable title="Next 3 GWs" players={rankPicks(all, '3gw')} horizon="3gw" />
      </div>
      <UnderTheRadar players={underTheRadar(all)} />
    </div>
  )
}
```

### Step 5: Verify + commit

`npx vitest run src/components/weekly-picks/` → all pass; `npx tsc --noEmit` clean.
`git add src/components/weekly-picks/ && git commit -m "feat(pick-01): PicksTable, UnderTheRadar, WeeklyPicksTab"`

---

## Task 4: wire the tab + full UI verification

**Files:** Modify `src/app/page.tsx`

1. SubTab union (line ~67): add `'picks'` after `'gems'`:
   `export type SubTab = 'gems' | 'picks' | 'insights' | ...`
2. Analyse `subTabs` (line ~74), second entry:
   `{ id: 'picks' as SubTab,         label: 'Weekly Picks',    mobileLabel: 'Picks'    },`
3. Import alongside the other tab imports:
   `import { WeeklyPicksTab } from '@/components/weekly-picks/WeeklyPicksTab'`
4. Render conditional in the chain (after the gems conditional ~line 303):
   `{activeSection !== 'squad' && activeSubTab === 'picks' && <WeeklyPicksTab />}`
5. `MobileNav.tsx` needs no edit (it reads SECTIONS).

Verify, in order:
- `npx tsc --noEmit` → clean
- `npm run lint` → clean
- `npm test` → ALL vitest tests pass (record the total; report it)
- Manual render check with real cached data: `npm run dev`, open http://localhost:3000, Analyse → Weekly Picks. The cached merged_players.json is the GW35 snapshot — the tab should render real ranked players (or, if the cache has been overwritten by an off-season run with zeroed xPts, the empty state — either rendering correctly is a pass; report WHICH you saw and include a screenshot if possible). Stop the dev server after.

Commit: `git add src/app/page.tsx && git commit -m "feat(pick-01): register Weekly Picks tab in Analyse section"`

---

## Task 5: pipeline honest metrics

**Files:** Modify `pipeline/run.py`; Test `pipeline/tests/test_run.py`

### Step 1: Failing tests

Read `pipeline/tests/test_run.py` first — follow its extracted-helper convention (like `_read_tuner_params`). Add a helper `_compute_honest_metrics(bootstrap, fixtures, summaries, tuned_params, run_backtest_fn)` test-double pattern OR test the real logic by extracting it into a small function. **Preferred: extract the logic into `pipeline/run.py` as a module-level function** `compute_honest_metrics(bootstrap, fixtures, summaries, tune_params) -> dict | None` so it is directly importable and testable:

```python
def test_compute_honest_metrics_gate_below_8_gws():
    import run as run_mod
    bootstrap = {'events': [{'id': g, 'finished': g <= 5} for g in range(1, 39)]}
    result = run_mod.compute_honest_metrics(bootstrap, [], {}, {})
    assert result is None


def test_compute_honest_metrics_shape(monkeypatch):
    import run as run_mod
    bootstrap = {'events': [{'id': g, 'finished': g <= 10} for g in range(1, 39)]}
    fake_metrics = {'top10_mean_pts': 5.123, 'haul_capture_20': 0.25,
                    'captain_return_rate': 0.7, 'haul_hit_rate': 0.12, 'n_gws': 6}
    monkeypatch.setattr(run_mod, '_run_backtest_for_picks',
                        lambda archive, params, first_gw, last_gw: fake_metrics)
    result = run_mod.compute_honest_metrics(bootstrap, [], {}, {'fas_slope': 0.4})
    assert result == {'top10_mean_pts': 5.12, 'haul_capture_20': 0.25,
                      'captain_return_rate': 0.7, 'haul_hit_rate': 0.12, 'n_gws': 6}
```

### Step 2: Implement in `run.py`

Module-level (near the top-level helpers, after imports):

```python
def _run_backtest_for_picks(archive: dict, params: dict, first_gw: int, last_gw: int) -> dict:
    """Seam for tests. Runs the BT-02 honest backtest and returns its metrics."""
    from backtest import run_backtest
    return run_backtest(archive=archive, params=params, mode='deploy',
                        first_gw=first_gw, last_gw=last_gw)['metrics']


def compute_honest_metrics(bootstrap: dict, fixtures: list, summaries: dict,
                           tune_params: dict) -> dict | None:
    """PICK-01: honest pick-quality metrics for the Weekly Picks confidence strip.

    Returns None until >= 8 finished GWs (UI falls back to last-season constants).
    """
    finished = sorted(e['id'] for e in bootstrap.get('events', []) if e.get('finished'))
    if len(finished) < 8:
        return None
    from tune import _map_tune_to_bt_params
    bt_params = _map_tune_to_bt_params(tune_params)
    archive = {'bootstrap': bootstrap, 'fixtures': fixtures, 'understat': {},
               'summaries': summaries, 'manifest': {'season': 'live'}}
    m = _run_backtest_for_picks(archive, bt_params, max(5, finished[0]), finished[-1])

    def _r(key, nd):
        v = m.get(key)
        return round(v, nd) if v is not None else None

    return {
        'top10_mean_pts': _r('top10_mean_pts', 2),
        'haul_capture_20': _r('haul_capture_20', 4),
        'captain_return_rate': _r('captain_return_rate', 4),
        'haul_hit_rate': _r('haul_hit_rate', 4),
        'n_gws': m.get('n_gws'),
    }
```

Call site — inside the accuracy-backtest block, immediately BEFORE `save('accuracy_backtest.json', backtest_data)` (line ~574), non-fatal:

```python
            # PICK-01: honest pick-quality metrics (non-fatal)
            try:
                _tune_params_for_picks = {
                    'blend_alpha': blend_alpha_used,
                    'form_window_gws': form_window_gws_used,
                    'cs_prob_base': cs_prob_base_used,
                    'cs_prob_slope': cs_prob_slope_used,
                    'cs_team_form_slope': cs_team_form_slope_used,
                    'cs_def_form_window_gws': cs_def_form_window_gws_used,
                    'atf_slope': atf_slope_used,
                    'atf_window_gws': atf_window_gws_used,
                    'fas_slope': fas_slope_used,
                    'defcon_scale': defcon_scale_used,
                }
                _hm = compute_honest_metrics(bootstrap, fixtures, summaries, _tune_params_for_picks)
                if _hm is not None:
                    backtest_data['summary']['honest_metrics'] = _hm
                    print(f"[picks] honest metrics over {_hm['n_gws']} GWs: top10={_hm['top10_mean_pts']}")
            except Exception as exc:
                print(f"[pipeline] honest metrics failed (non-fatal): {exc}", file=sys.stderr)
```

**Verify variable scope before committing**: all `*_used` variables and `backtest_data` must be in scope at the call site (they are set in the same function — confirm by reading; if the tuner block is conditional, the `*_used` defaults are set unconditionally earlier, which is what we need).

### Step 3: Verify + commit

`cd pipeline && python -m pytest tests/ -q` → 564 expected (562 + 2). Paste the real final line.
`git add pipeline/run.py pipeline/tests/test_run.py && git commit -m "feat(pick-01): compute honest pick-quality metrics in pipeline (>=8 GWs)"`

---

## Self-review notes

- Spec coverage: layout A ✓ (T3/T4), confidence live+fallback ✓ (T2/T5), ranking rules ✓ (T1), status handling ✓, off-season state ✓, expandable components incl. defcon (DC-02) ✓ (T3), under-the-radar ✓, DGW fixture grouping via nextEventsFixtures + FixtureBadges ✓, types ✓, pipeline non-fatal ✓, tests at every layer ✓.
- Deviations documented at top (hand-rolled table; `defcon` key name).
- Type consistency: `HonestMetrics` defined T1, consumed T2 (`ConfidenceStrip honest` prop) and T5 (pipeline dict matches field-for-field); `PicksHorizon` defined T1, used T3; `nextEventsFixtures` defined T1, used T3.
- UI implementers MUST read the Next 16 client-components doc first (AGENTS.md) and follow existing house style over plan code if they conflict (report any such conflict).
