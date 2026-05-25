# PERFECT-01: Perfect GW Team — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Perfect GW" tab to the Analyse section that shows the highest-scoring legal FPL XI (3-per-club cap, valid formation) for any completed gameweek, plus a top-scorers-per-position table.

**Architecture:** Pure client-side feature — no new backend work. Two new TanStack Query hooks fetch FPL bootstrap (player metadata) and `event/{gw}/live/` (points per player). A pure `computePerfectXI` function tries all 9 valid FPL formations and returns the highest-scoring XI. A tabbed component assembles the pitch and top-scorers views.

**Tech Stack:** Next.js (App Router), React, TanStack Query (`@tanstack/react-query`), Vitest + React Testing Library, Tailwind CSS, TypeScript.

---

## File Map

**New files:**
- `src/lib/perfect-gw/computePerfectXI.ts` — pure optimisation function (no React dependency)
- `src/lib/perfect-gw/computePerfectXI.test.ts` — unit tests for optimiser
- `src/lib/hooks/useBootstrap.ts` — TanStack Query hook for FPL bootstrap-static
- `src/lib/hooks/useBootstrap.test.ts` — hook tests
- `src/lib/hooks/useLiveGwPoints.ts` — TanStack Query hook for event/{gw}/live/
- `src/lib/hooks/useLiveGwPoints.test.ts` — hook tests
- `src/components/perfect-gw/PlayerCard.tsx` — player card (name, club pill, points, price; captain variant)
- `src/components/perfect-gw/PlayerCard.test.tsx`
- `src/components/perfect-gw/BudgetBanner.tsx` — amber/green budget indicator
- `src/components/perfect-gw/BudgetBanner.test.tsx`
- `src/components/perfect-gw/TopScorersTable.tsx` — 4-column top-5-per-position table
- `src/components/perfect-gw/TopScorersTable.test.tsx`
- `src/components/perfect-gw/PerfectGWPitch.tsx` — pitch graphic with formation rows
- `src/components/perfect-gw/PerfectGWPitch.test.tsx`
- `src/components/perfect-gw/PerfectGWTab.tsx` — page shell: GW selector, inner tabs, data fetching
- `src/components/perfect-gw/PerfectGWTab.test.tsx`

**Modified files:**
- `src/app/page.tsx` — add `'perfect-gw'` to SubTab union, add to `SECTIONS.analyse.subTabs`, add render conditional

---

## Task 1: computePerfectXI — pure optimiser

**Files:**
- Create: `src/lib/perfect-gw/computePerfectXI.ts`
- Create: `src/lib/perfect-gw/computePerfectXI.test.ts`

**Background:** `FPLElementRaw` (from `src/lib/fpl-adapter.ts`) is the validated player type returned by `parseFPLBootstrap`. Key fields: `id: number`, `element_type: number` (1=GK, 2=DEF, 3=MID, 4=FWD), `team: number`, `now_cost: number` (tenths of £m, e.g. 132 = £13.2m), `web_name: string`. The budget threshold is 1000 FPL units (= £100m).

- [ ] **Step 1.1: Write failing tests**

Create `src/lib/perfect-gw/computePerfectXI.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computePerfectXI } from './computePerfectXI'
import type { FPLElementRaw } from '@/lib/fpl-adapter'

// Helpers to build minimal test players
function mkPlayer(
  id: number,
  element_type: 1 | 2 | 3 | 4,
  team: number,
  now_cost: number
): FPLElementRaw {
  return {
    id,
    code: id,
    web_name: `Player${id}`,
    team,
    element_type,
    now_cost,
    selected_by_percent: '5.0',
    form: '5.0',
    status: 'a',
    minutes: 90,
    starts: 1,
    defensive_contribution: null,
    defensive_contribution_per_90: null,
    clearances_blocks_interceptions: null,
    direct_freekicks_order: null,
    penalties_order: null,
    corners_and_indirect_freekicks_order: null,
    news: '',
  }
}

// Build a minimal valid pool: 2 GKs, 6 DEFs, 6 MIDs, 4 FWDs from 10 different clubs
function buildPool(): FPLElementRaw[] {
  return [
    // GKs (element_type 1)
    mkPlayer(1, 1, 1, 50),
    mkPlayer(2, 1, 2, 45),
    // DEFs (element_type 2) — clubs 3-8
    mkPlayer(3, 2, 3, 55), mkPlayer(4, 2, 4, 55), mkPlayer(5, 2, 5, 55),
    mkPlayer(6, 2, 6, 55), mkPlayer(7, 2, 7, 55), mkPlayer(8, 2, 8, 55),
    // MIDs (element_type 3) — clubs 9-14
    mkPlayer(9, 3, 9, 80), mkPlayer(10, 3, 10, 80), mkPlayer(11, 3, 11, 80),
    mkPlayer(12, 3, 12, 80), mkPlayer(13, 3, 13, 80), mkPlayer(14, 3, 14, 80),
    // FWDs (element_type 4) — clubs 15-18
    mkPlayer(15, 4, 15, 90), mkPlayer(16, 4, 16, 90),
    mkPlayer(17, 4, 17, 90), mkPlayer(18, 4, 18, 90),
  ]
}

describe('computePerfectXI', () => {
  it('returns an XI of exactly 11 players', () => {
    const players = buildPool()
    const points: Record<number, number> = {}
    players.forEach((p, i) => { points[p.id] = 10 - i })  // decreasing points
    const result = computePerfectXI(players, points)
    expect(result.xi).toHaveLength(11)
  })

  it('picks the highest scorer as captain', () => {
    const players = buildPool()
    const points: Record<number, number> = {}
    players.forEach(p => { points[p.id] = 1 })
    points[9] = 20  // player 9 (MID) has highest points
    const result = computePerfectXI(players, points)
    expect(result.captain.id).toBe(9)
  })

  it('enforces the 3-per-club cap', () => {
    const players = buildPool()
    // Make all top scorers from club 9 (4 MIDs from same club)
    const clubPlayers: FPLElementRaw[] = [
      mkPlayer(20, 3, 9, 80), mkPlayer(21, 3, 9, 80),
      mkPlayer(22, 3, 9, 80), mkPlayer(23, 3, 9, 80),
    ]
    const allPlayers = [...players, ...clubPlayers]
    const points: Record<number, number> = {}
    allPlayers.forEach(p => { points[p.id] = 1 })
    ;[20, 21, 22, 23].forEach(id => { points[id] = 50 })  // club 9 dominates
    const result = computePerfectXI(allPlayers, points)
    const club9Count = result.xi.filter(p => p.team === 9).length
    expect(club9Count).toBeLessThanOrEqual(3)
  })

  it('selects the formation that maximises total points', () => {
    // Give DEFs 15 pts each and FWDs 5 pts each — should prefer 5-DEF formations
    const players = buildPool()
    const points: Record<number, number> = {}
    players.forEach(p => {
      if (p.element_type === 2) points[p.id] = 15   // DEFs high
      else if (p.element_type === 3) points[p.id] = 8  // MIDs medium
      else if (p.element_type === 4) points[p.id] = 3  // FWDs low
      else points[p.id] = 6  // GK
    })
    const result = computePerfectXI(players, points)
    // 5-DEF formation should win: 5×15 + 4×8 + 1×3 = 75+32+3 = 110 (5-4-1)
    // vs 3-DEF: 3×15 + 5×8 + 3×3 = 45+40+9 = 94
    expect(result.formation).toMatch(/^5-/)
  })

  it('sets overBudget=false when squad cost ≤ £100m (≤ 1000 FPL units)', () => {
    // All players cost 90 FPL units (£9.0m) — 11 players = 990 FPL units = £99m
    const players = buildPool().map(p => ({ ...p, now_cost: 90 }))
    const points: Record<number, number> = {}
    players.forEach(p => { points[p.id] = 5 })
    const result = computePerfectXI(players, points)
    expect(result.overBudget).toBe(false)
    expect(result.overBudgetBy).toBe(0)
  })

  it('sets overBudget=true and overBudgetBy correctly when squad cost > £100m', () => {
    // All players cost 100 FPL units (£10.0m) — 11 players = 1100 FPL units = £110m
    const players = buildPool().map(p => ({ ...p, now_cost: 100 }))
    const points: Record<number, number> = {}
    players.forEach(p => { points[p.id] = 5 })
    const result = computePerfectXI(players, points)
    expect(result.overBudget).toBe(true)
    expect(result.overBudgetBy).toBe(result.squadCost - 1000)
  })

  it('treats missing players in livePoints as 0 pts (no crash)', () => {
    const players = buildPool()
    // Pass empty points map — all players have 0 pts
    expect(() => computePerfectXI(players, {})).not.toThrow()
    const result = computePerfectXI(players, {})
    expect(result.totalPts).toBe(0)
  })
})
```

- [ ] **Step 1.2: Run tests — verify they all fail**

```
npx vitest run src/lib/perfect-gw/computePerfectXI.test.ts
```

Expected: 6 tests fail with "Cannot find module './computePerfectXI'"

- [ ] **Step 1.3: Implement computePerfectXI**

Create `src/lib/perfect-gw/computePerfectXI.ts`:

```typescript
import type { FPLElementRaw } from '@/lib/fpl-adapter'

export interface PerfectXIResult {
  xi: FPLElementRaw[]           // 11 players ordered: [GK, ...DEFs, ...MIDs, ...FWDs]
  captain: FPLElementRaw
  formation: string             // e.g. "3-4-3"
  totalPts: number
  squadCost: number             // sum of xi now_cost in FPL units (tenths of £m)
  overBudget: boolean           // squadCost > 1000 (= £100m)
  overBudgetBy: number          // squadCost - 1000, or 0 if not over
}

// All valid FPL formations as [DEF count, MID count, FWD count].
// Invariant: each row sums to 10 (+ 1 GK = 11).
// Constraints: min 3 DEF, min 2 MID, min 1 FWD.
const FORMATIONS: [number, number, number][] = [
  [3, 4, 3], [3, 5, 2], [4, 3, 3], [4, 4, 2],
  [4, 5, 1], [5, 3, 2], [5, 4, 1], [5, 2, 3], [3, 2, 5],
]

/**
 * Greedily pick `count` highest-scoring players from `candidates`,
 * enforcing a max of 3 players per club across all positions (shared clubCounts).
 * `candidates` must already be sorted descending by livePoints.
 */
function pickBest(
  candidates: FPLElementRaw[],
  count: number,
  clubCounts: Map<number, number>,
  livePoints: Record<number, number>,
): FPLElementRaw[] {
  const picked: FPLElementRaw[] = []
  for (const player of candidates) {
    if (picked.length >= count) break
    const clubCount = clubCounts.get(player.team) ?? 0
    if (clubCount >= 3) continue
    picked.push(player)
    clubCounts.set(player.team, clubCount + 1)
  }
  return picked
}

export function computePerfectXI(
  players: FPLElementRaw[],
  livePoints: Record<number, number>,
): PerfectXIResult {
  // Group by position and sort each group descending by live points
  const byPosition: Record<number, FPLElementRaw[]> = { 1: [], 2: [], 3: [], 4: [] }
  for (const player of players) {
    if (player.element_type in byPosition) {
      byPosition[player.element_type].push(player)
    }
  }
  for (const group of Object.values(byPosition)) {
    group.sort((a, b) => (livePoints[b.id] ?? 0) - (livePoints[a.id] ?? 0))
  }

  let best: PerfectXIResult | null = null

  for (const [defCount, midCount, fwdCount] of FORMATIONS) {
    const clubCounts = new Map<number, number>()

    const gks  = pickBest(byPosition[1], 1,        clubCounts, livePoints)
    const defs = pickBest(byPosition[2], defCount,  clubCounts, livePoints)
    const mids = pickBest(byPosition[3], midCount,  clubCounts, livePoints)
    const fwds = pickBest(byPosition[4], fwdCount,  clubCounts, livePoints)

    // Skip formation if we can't fill every slot
    if (
      gks.length < 1 ||
      defs.length < defCount ||
      mids.length < midCount ||
      fwds.length < fwdCount
    ) {
      continue
    }

    const xi = [...gks, ...defs, ...mids, ...fwds]
    const totalPts = xi.reduce((sum, p) => sum + (livePoints[p.id] ?? 0), 0)

    if (!best || totalPts > best.totalPts) {
      const captain = xi.reduce((max, p) =>
        (livePoints[p.id] ?? 0) > (livePoints[max.id] ?? 0) ? p : max,
      )
      const squadCost = xi.reduce((sum, p) => sum + p.now_cost, 0)

      best = {
        xi,
        captain,
        formation: `${defCount}-${midCount}-${fwdCount}`,
        totalPts,
        squadCost,
        overBudget: squadCost > 1000,
        overBudgetBy: Math.max(0, squadCost - 1000),
      }
    }
  }

  if (!best) {
    throw new Error('computePerfectXI: could not fill any valid formation from provided players')
  }

  return best
}
```

- [ ] **Step 1.4: Run tests — verify all 6 pass**

```
npx vitest run src/lib/perfect-gw/computePerfectXI.test.ts
```

Expected: 6 passed

- [ ] **Step 1.5: Commit**

```
git add src/lib/perfect-gw/computePerfectXI.ts src/lib/perfect-gw/computePerfectXI.test.ts
git commit -m "feat(perfect-gw): computePerfectXI pure optimiser with tests"
```

---

## Task 2: useBootstrap hook

**Files:**
- Create: `src/lib/hooks/useBootstrap.ts`
- Create: `src/lib/hooks/useBootstrap.test.ts`

**Background:** No existing hook fetches bootstrap-static in a reusable way. `parseFPLBootstrap` from `src/lib/fpl-adapter.ts` validates the response. Follow the pattern in `useSettledGws.ts` for the hook; the test pattern uses `vi.stubGlobal('fetch', ...)` + `renderHook` with `makeWrapper(QueryClientProvider)`.

- [ ] **Step 2.1: Write failing tests**

Create `src/lib/hooks/useBootstrap.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { useBootstrap } from './useBootstrap'

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

const validBootstrap = {
  elements: [
    {
      id: 1, code: 1, web_name: 'Salah', team: 10, element_type: 3,
      now_cost: 132, selected_by_percent: '40.0', form: '8.0', status: 'a',
      minutes: 90, starts: 1, defensive_contribution: null,
      defensive_contribution_per_90: null, clearances_blocks_interceptions: null,
      direct_freekicks_order: null, penalties_order: null,
      corners_and_indirect_freekicks_order: null, news: '',
    },
  ],
  teams: [{ id: 10, name: 'Liverpool', short_name: 'LIV', code: 14 }],
  events: [
    { id: 38, is_current: false, is_next: false, finished: true, data_checked: true, deadline_time: '2026-05-17T10:00:00Z' },
  ],
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useBootstrap', () => {
  it('returns parsed bootstrap data on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify(validBootstrap), { status: 200 })
    ))
    const { result } = renderHook(() => useBootstrap(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.elements).toHaveLength(1)
    expect(result.current.data?.elements[0].web_name).toBe('Salah')
    expect(result.current.data?.teams[0].short_name).toBe('LIV')
  })

  it('sets isError when fetch returns non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response('bad gateway', { status: 502 })
    ))
    const { result } = renderHook(() => useBootstrap(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('sets isError when bootstrap parse fails (invalid shape)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ unexpected: true }), { status: 200 })
    ))
    const { result } = renderHook(() => useBootstrap(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
```

- [ ] **Step 2.2: Run tests — verify they fail**

```
npx vitest run src/lib/hooks/useBootstrap.test.ts
```

Expected: 3 tests fail with "Cannot find module './useBootstrap'"

- [ ] **Step 2.3: Implement useBootstrap**

Create `src/lib/hooks/useBootstrap.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { parseFPLBootstrap } from '@/lib/fpl-adapter'
import type { FPLBootstrap } from '@/lib/fpl-adapter'

async function fetchBootstrap(): Promise<FPLBootstrap> {
  const res = await fetch('/api/fpl/bootstrap-static/')
  if (!res.ok) {
    throw new Error(`bootstrap fetch failed: ${res.status}`)
  }
  const raw = await res.json()
  const parsed = parseFPLBootstrap(raw)
  if (!parsed.success) {
    throw new Error('bootstrap parse failed: invalid shape')
  }
  return parsed.data
}

export function useBootstrap() {
  return useQuery<FPLBootstrap>({
    queryKey: ['bootstrap'],
    queryFn: fetchBootstrap,
    staleTime: 60 * 60 * 1000, // 1 hour — bootstrap events change at most once per GW
    retry: 1,
  })
}
```

- [ ] **Step 2.4: Run tests — verify all 3 pass**

```
npx vitest run src/lib/hooks/useBootstrap.test.ts
```

Expected: 3 passed

- [ ] **Step 2.5: Commit**

```
git add src/lib/hooks/useBootstrap.ts src/lib/hooks/useBootstrap.test.ts
git commit -m "feat(perfect-gw): useBootstrap hook with tests"
```

---

## Task 3: useLiveGwPoints hook

**Files:**
- Create: `src/lib/hooks/useLiveGwPoints.ts`
- Create: `src/lib/hooks/useLiveGwPoints.test.ts`

**Background:** The FPL `event/{gw}/live/` endpoint response shape:
```json
{ "elements": [{ "id": 123, "stats": { "total_points": 10 } }] }
```
The hook maps this to `Record<number, number>` (playerId → total_points). Historical GWs are immutable so use a very long `staleTime`. The hook is disabled when `gw === null`.

- [ ] **Step 3.1: Write failing tests**

Create `src/lib/hooks/useLiveGwPoints.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { useLiveGwPoints } from './useLiveGwPoints'

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

function livePayload(elements: Array<{ id: number; total_points: number }>) {
  return {
    elements: elements.map(({ id, total_points }) => ({
      id,
      stats: { total_points },
    })),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useLiveGwPoints', () => {
  it('returns a playerId→points map on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify(livePayload([
        { id: 10, total_points: 12 },
        { id: 20, total_points: 6 },
      ])), { status: 200 })
    ))
    const { result } = renderHook(() => useLiveGwPoints(38), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ 10: 12, 20: 6 })
  })

  it('is disabled (no fetch) when gw is null', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useLiveGwPoints(null), { wrapper: makeWrapper() })
    // isPending is true when query is disabled
    expect(result.current.isPending).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches the correct URL for the given GW', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(livePayload([])), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useLiveGwPoints(25), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith('/api/fpl/event/25/live/')
  })

  it('sets isError when fetch returns non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response('not found', { status: 404 })
    ))
    const { result } = renderHook(() => useLiveGwPoints(38), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
```

- [ ] **Step 3.2: Run tests — verify they fail**

```
npx vitest run src/lib/hooks/useLiveGwPoints.test.ts
```

Expected: 4 tests fail with "Cannot find module './useLiveGwPoints'"

- [ ] **Step 3.3: Implement useLiveGwPoints**

Create `src/lib/hooks/useLiveGwPoints.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'

interface FPLLiveElement {
  id: number
  stats: {
    total_points: number
  }
}

interface FPLLiveResponse {
  elements: FPLLiveElement[]
}

async function fetchLiveGwPoints(gw: number): Promise<Record<number, number>> {
  const res = await fetch(`/api/fpl/event/${gw}/live/`)
  if (!res.ok) {
    throw new Error(`live GW fetch failed: ${res.status}`)
  }
  const raw = (await res.json()) as FPLLiveResponse
  const map: Record<number, number> = {}
  for (const el of raw.elements) {
    map[el.id] = el.stats.total_points
  }
  return map
}

export function useLiveGwPoints(gw: number | null) {
  return useQuery<Record<number, number>>({
    queryKey: ['live-gw-points', gw],
    queryFn: () => {
      if (gw === null) throw new Error('gw is required')
      return fetchLiveGwPoints(gw)
    },
    enabled: gw !== null,
    // Historical GWs are immutable — cache for 7 days
    staleTime: 7 * 24 * 60 * 60 * 1000,
    retry: 1,
  })
}
```

- [ ] **Step 3.4: Run tests — verify all 4 pass**

```
npx vitest run src/lib/hooks/useLiveGwPoints.test.ts
```

Expected: 4 passed

- [ ] **Step 3.5: Commit**

```
git add src/lib/hooks/useLiveGwPoints.ts src/lib/hooks/useLiveGwPoints.test.ts
git commit -m "feat(perfect-gw): useLiveGwPoints hook with tests"
```

---

## Task 4: PlayerCard component

**Files:**
- Create: `src/components/perfect-gw/PlayerCard.tsx`
- Create: `src/components/perfect-gw/PlayerCard.test.tsx`

**Background:** Rendered for each player on the pitch. Shows: club pill (coloured badge with short_name), price (now_cost ÷ 10, formatted as "£13.2m"), player web_name, GW points. Captain variant: gold border + "CAPT" badge above card. The `teams` array from bootstrap provides `short_name` for the club pill.

- [ ] **Step 4.1: Write failing tests**

Create `src/components/perfect-gw/PlayerCard.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayerCard } from './PlayerCard'
import type { FPLElementRaw } from '@/lib/fpl-adapter'
import type { FPLTeam } from '@/lib/types'

const salah: FPLElementRaw = {
  id: 1, code: 1, web_name: 'Salah', team: 10, element_type: 3,
  now_cost: 132, selected_by_percent: '40.0', form: '8.0', status: 'a',
  minutes: 90, starts: 1, defensive_contribution: null,
  defensive_contribution_per_90: null, clearances_blocks_interceptions: null,
  direct_freekicks_order: null, penalties_order: null,
  corners_and_indirect_freekicks_order: null, news: '',
}

const liverpool: FPLTeam = { id: 10, name: 'Liverpool', short_name: 'LIV', code: 14 }

describe('PlayerCard', () => {
  it('renders player name, points, and price', () => {
    render(
      <PlayerCard player={salah} points={18} team={liverpool} isCapt={false} />
    )
    expect(screen.getByText('Salah')).toBeTruthy()
    expect(screen.getByText('18')).toBeTruthy()
    expect(screen.getByText('£13.2m')).toBeTruthy()
  })

  it('renders club short name pill', () => {
    render(
      <PlayerCard player={salah} points={18} team={liverpool} isCapt={false} />
    )
    expect(screen.getByText('LIV')).toBeTruthy()
  })

  it('does not render CAPT badge when isCapt=false', () => {
    render(
      <PlayerCard player={salah} points={18} team={liverpool} isCapt={false} />
    )
    expect(screen.queryByText('CAPT')).toBeNull()
  })

  it('renders CAPT badge when isCapt=true', () => {
    render(
      <PlayerCard player={salah} points={18} team={liverpool} isCapt={true} />
    )
    expect(screen.getByText('CAPT')).toBeTruthy()
  })

  it('formats price correctly: now_cost 132 → £13.2m', () => {
    render(
      <PlayerCard player={salah} points={18} team={liverpool} isCapt={false} />
    )
    expect(screen.getByText('£13.2m')).toBeTruthy()
  })

  it('formats price correctly: now_cost 45 → £4.5m', () => {
    const cheapPlayer = { ...salah, now_cost: 45 }
    render(
      <PlayerCard player={cheapPlayer} points={3} team={liverpool} isCapt={false} />
    )
    expect(screen.getByText('£4.5m')).toBeTruthy()
  })
})
```

- [ ] **Step 4.2: Run tests — verify they fail**

```
npx vitest run src/components/perfect-gw/PlayerCard.test.tsx
```

Expected: 6 tests fail with "Cannot find module './PlayerCard'"

- [ ] **Step 4.3: Implement PlayerCard**

Create `src/components/perfect-gw/PlayerCard.tsx`:

```tsx
import type { FPLElementRaw } from '@/lib/fpl-adapter'
import type { FPLTeam } from '@/lib/types'

interface PlayerCardProps {
  player: FPLElementRaw
  points: number
  team: FPLTeam
  isCapt: boolean
}

export function PlayerCard({ player, points, team, isCapt }: PlayerCardProps) {
  const priceLabel = `£${(player.now_cost / 10).toFixed(1)}m`

  return (
    <div className="relative flex flex-col items-center">
      {isCapt && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-[9px] font-bold px-1.5 py-0.5 rounded z-10">
          CAPT
        </span>
      )}
      <div
        className={`relative rounded px-2 py-1.5 text-center min-w-[68px] bg-zinc-900 dark:bg-zinc-800 ${
          isCapt
            ? 'border-2 border-yellow-400'
            : 'border border-zinc-600 dark:border-zinc-500'
        }`}
      >
        <div className="flex items-center justify-between mb-0.5">
          <span className="bg-zinc-700 text-zinc-200 text-[9px] font-bold px-1 rounded">
            {team.short_name}
          </span>
          <span className="text-zinc-400 text-[9px]">{priceLabel}</span>
        </div>
        <p className={`text-xs font-semibold truncate max-w-[64px] ${isCapt ? 'text-yellow-300' : 'text-white'}`}>
          {player.web_name}
        </p>
        <p className={`text-sm font-bold mt-0.5 ${isCapt ? 'text-yellow-300' : 'text-blue-400'}`}>
          {points}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4.4: Run tests — verify all 6 pass**

```
npx vitest run src/components/perfect-gw/PlayerCard.test.tsx
```

Expected: 6 passed

- [ ] **Step 4.5: Commit**

```
git add src/components/perfect-gw/PlayerCard.tsx src/components/perfect-gw/PlayerCard.test.tsx
git commit -m "feat(perfect-gw): PlayerCard component with tests"
```

---

## Task 5: BudgetBanner component

**Files:**
- Create: `src/components/perfect-gw/BudgetBanner.tsx`
- Create: `src/components/perfect-gw/BudgetBanner.test.tsx`

**Background:** Shows green indicator when squadCost ≤ 1000 (≤ £100m), amber warning when over. `squadCost` and `overBudgetBy` are in FPL units (tenths of £m); divide by 10 for display.

- [ ] **Step 5.1: Write failing tests**

Create `src/components/perfect-gw/BudgetBanner.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BudgetBanner } from './BudgetBanner'

describe('BudgetBanner', () => {
  it('shows within-budget message when squadCost ≤ 1000', () => {
    render(<BudgetBanner squadCost={984} overBudget={false} overBudgetBy={0} />)
    expect(screen.getByText(/£98\.4m/)).toBeTruthy()
    expect(screen.getByText(/within budget/i)).toBeTruthy()
  })

  it('shows over-budget warning with correct amount when overBudget=true', () => {
    render(<BudgetBanner squadCost={1074} overBudget={true} overBudgetBy={74} />)
    expect(screen.getByText(/£107\.4m/)).toBeTruthy()
    expect(screen.getByText(/£7\.4m over/i)).toBeTruthy()
  })

  it('applies amber styling when over budget', () => {
    const { container } = render(
      <BudgetBanner squadCost={1074} overBudget={true} overBudgetBy={74} />
    )
    // The banner root should have an amber class
    expect(container.innerHTML).toContain('amber')
  })

  it('applies green styling when within budget', () => {
    const { container } = render(
      <BudgetBanner squadCost={984} overBudget={false} overBudgetBy={0} />
    )
    expect(container.innerHTML).toContain('green')
  })
})
```

- [ ] **Step 5.2: Run tests — verify they fail**

```
npx vitest run src/components/perfect-gw/BudgetBanner.test.tsx
```

Expected: 4 tests fail with "Cannot find module './BudgetBanner'"

- [ ] **Step 5.3: Implement BudgetBanner**

Create `src/components/perfect-gw/BudgetBanner.tsx`:

```tsx
interface BudgetBannerProps {
  squadCost: number     // FPL units (tenths of £m)
  overBudget: boolean
  overBudgetBy: number  // FPL units; 0 when not over
}

export function BudgetBanner({ squadCost, overBudget, overBudgetBy }: BudgetBannerProps) {
  const totalLabel = `£${(squadCost / 10).toFixed(1)}m`
  const overLabel  = `£${(overBudgetBy / 10).toFixed(1)}m over standard budget`

  if (overBudget) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 text-sm">
        <span className="text-amber-700 dark:text-amber-300 font-medium">
          Perfect XI costs {totalLabel} — {overLabel}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-sm">
      <span className="text-green-700 dark:text-green-300 font-medium">
        {totalLabel} — within budget
      </span>
    </div>
  )
}
```

- [ ] **Step 5.4: Run tests — verify all 4 pass**

```
npx vitest run src/components/perfect-gw/BudgetBanner.test.tsx
```

Expected: 4 passed

- [ ] **Step 5.5: Commit**

```
git add src/components/perfect-gw/BudgetBanner.tsx src/components/perfect-gw/BudgetBanner.test.tsx
git commit -m "feat(perfect-gw): BudgetBanner component with tests"
```

---

## Task 6: TopScorersTable component

**Files:**
- Create: `src/components/perfect-gw/TopScorersTable.tsx`
- Create: `src/components/perfect-gw/TopScorersTable.test.tsx`

**Background:** 4 columns (GK | DEF | MID | FWD), top 5 per position, sorted descending by GW points. No squad rules apply — purely the top scorers in each position. The top scorer in each column gets a highlighted background row.

- [ ] **Step 6.1: Write failing tests**

Create `src/components/perfect-gw/TopScorersTable.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { TopScorersTable } from './TopScorersTable'
import type { FPLElementRaw } from '@/lib/fpl-adapter'
import type { FPLTeam } from '@/lib/types'

function mkPlayer(id: number, element_type: 1 | 2 | 3 | 4, team: number): FPLElementRaw {
  return {
    id, code: id, web_name: `P${id}`, team, element_type, now_cost: 50,
    selected_by_percent: '5.0', form: '5.0', status: 'a', minutes: 90,
    starts: 1, defensive_contribution: null, defensive_contribution_per_90: null,
    clearances_blocks_interceptions: null, direct_freekicks_order: null,
    penalties_order: null, corners_and_indirect_freekicks_order: null, news: '',
  }
}

const teams: FPLTeam[] = [
  { id: 1, name: 'Club A', short_name: 'CLA', code: 1 },
  { id: 2, name: 'Club B', short_name: 'CLB', code: 2 },
]

// 2 GKs, 6 DEFs, 6 MIDs, 3 FWDs
const players: FPLElementRaw[] = [
  mkPlayer(1, 1, 1), mkPlayer(2, 1, 2),
  mkPlayer(3, 2, 1), mkPlayer(4, 2, 2), mkPlayer(5, 2, 1),
  mkPlayer(6, 2, 2), mkPlayer(7, 2, 1), mkPlayer(8, 2, 2),
  mkPlayer(9, 3, 1), mkPlayer(10, 3, 2), mkPlayer(11, 3, 1),
  mkPlayer(12, 3, 2), mkPlayer(13, 3, 1), mkPlayer(14, 3, 2),
  mkPlayer(15, 4, 1), mkPlayer(16, 4, 2), mkPlayer(17, 4, 1),
]

const livePoints: Record<number, number> = {
  1: 6, 2: 4,
  3: 9, 4: 7, 5: 5, 6: 3, 7: 1, 8: 1,
  9: 18, 10: 12, 11: 10, 12: 9, 13: 8, 14: 7,
  15: 15, 16: 9, 17: 7,
}

describe('TopScorersTable', () => {
  it('renders 4 position column headers', () => {
    render(<TopScorersTable players={players} livePoints={livePoints} teams={teams} />)
    expect(screen.getByText('GK')).toBeTruthy()
    expect(screen.getByText('DEF')).toBeTruthy()
    expect(screen.getByText('MID')).toBeTruthy()
    expect(screen.getByText('FWD')).toBeTruthy()
  })

  it('shows top scorer first in each column', () => {
    render(<TopScorersTable players={players} livePoints={livePoints} teams={teams} />)
    // GK top scorer = P1 (6 pts), MID top scorer = P9 (18 pts)
    const allP1 = screen.getAllByText('P1')
    expect(allP1.length).toBeGreaterThan(0)
    const allP9 = screen.getAllByText('P9')
    expect(allP9.length).toBeGreaterThan(0)
  })

  it('shows at most 5 players per position column', () => {
    render(<TopScorersTable players={players} livePoints={livePoints} teams={teams} />)
    // There are 6 MID players but only top 5 should appear
    // P14 is ranked 6th (7 pts) — should not appear in MID column
    // Find all cells and count MID entries — tricky to assert count directly,
    // so verify the 6th-ranked player is absent
    expect(screen.queryByTestId('mid-row-P14')).toBeNull()
  })

  it('displays points for each player row', () => {
    render(<TopScorersTable players={players} livePoints={livePoints} teams={teams} />)
    // MID top scorer P9 has 18 pts
    expect(screen.getByTestId('mid-row-P9')).toBeTruthy()
    expect(within(screen.getByTestId('mid-row-P9')).getByText('18')).toBeTruthy()
  })
})
```

- [ ] **Step 6.2: Run tests — verify they fail**

```
npx vitest run src/components/perfect-gw/TopScorersTable.test.tsx
```

Expected: 4 tests fail with "Cannot find module './TopScorersTable'"

- [ ] **Step 6.3: Implement TopScorersTable**

Create `src/components/perfect-gw/TopScorersTable.tsx`:

```tsx
import type { FPLElementRaw } from '@/lib/fpl-adapter'
import type { FPLTeam } from '@/lib/types'

interface TopScorersTableProps {
  players: FPLElementRaw[]
  livePoints: Record<number, number>
  teams: FPLTeam[]
}

const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
const POSITIONS = [1, 2, 3, 4] as const
const TOP_N = 5

export function TopScorersTable({ players, livePoints, teams }: TopScorersTableProps) {
  const teamMap = new Map(teams.map(t => [t.id, t]))

  return (
    <div className="grid grid-cols-4 gap-3">
      {POSITIONS.map(pos => {
        const posPlayers = players
          .filter(p => p.element_type === pos)
          .sort((a, b) => (livePoints[b.id] ?? 0) - (livePoints[a.id] ?? 0))
          .slice(0, TOP_N)

        return (
          <div key={pos} className="bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-center">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                {POSITION_LABELS[pos]}
              </span>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {posPlayers.map((player, idx) => {
                const pts = livePoints[player.id] ?? 0
                const team = teamMap.get(player.team)
                const isTop = idx === 0

                return (
                  <div
                    key={player.id}
                    data-testid={`${POSITION_LABELS[pos].toLowerCase()}-row-${player.web_name}`}
                    className={`flex items-center justify-between px-2 py-1.5 ${
                      isTop ? 'bg-zinc-50 dark:bg-zinc-800/60' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs truncate ${isTop ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        {player.web_name}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {team?.short_name ?? '?'} · £{(player.now_cost / 10).toFixed(1)}m
                      </p>
                    </div>
                    <span className={`text-sm font-bold ml-2 ${isTop ? 'text-green-600 dark:text-green-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {pts}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6.4: Run tests — verify all 4 pass**

```
npx vitest run src/components/perfect-gw/TopScorersTable.test.tsx
```

Expected: 4 passed

- [ ] **Step 6.5: Commit**

```
git add src/components/perfect-gw/TopScorersTable.tsx src/components/perfect-gw/TopScorersTable.test.tsx
git commit -m "feat(perfect-gw): TopScorersTable component with tests"
```

---

## Task 7: PerfectGWPitch component

**Files:**
- Create: `src/components/perfect-gw/PerfectGWPitch.tsx`
- Create: `src/components/perfect-gw/PerfectGWPitch.test.tsx`

**Background:** Renders the football pitch with player cards arranged in formation rows. `result.xi` is ordered `[GK, ...DEFs, ...MIDs, ...FWDs]`; split into rows using the formation string (e.g. "3-4-3" → 1 GK, 3 DEF, 4 MID, 3 FWD). Pitch orientation: FWD at top, GK at bottom (standard FPL app style). Shows formation label, total points, and includes `BudgetBanner`.

- [ ] **Step 7.1: Write failing tests**

Create `src/components/perfect-gw/PerfectGWPitch.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PerfectGWPitch } from './PerfectGWPitch'
import type { PerfectXIResult } from '@/lib/perfect-gw/computePerfectXI'
import type { FPLElementRaw } from '@/lib/fpl-adapter'
import type { FPLTeam } from '@/lib/types'

function mkPlayer(id: number, element_type: 1 | 2 | 3 | 4, team: number): FPLElementRaw {
  return {
    id, code: id, web_name: `Player${id}`, team, element_type, now_cost: 60,
    selected_by_percent: '5.0', form: '5.0', status: 'a', minutes: 90, starts: 1,
    defensive_contribution: null, defensive_contribution_per_90: null,
    clearances_blocks_interceptions: null, direct_freekicks_order: null,
    penalties_order: null, corners_and_indirect_freekicks_order: null, news: '',
  }
}

const teams: FPLTeam[] = Array.from({ length: 11 }, (_, i) => ({
  id: i + 1, name: `Club ${i + 1}`, short_name: `C${i + 1}`, code: i + 1,
}))

// A valid 4-4-2 XI: 1 GK + 4 DEF + 4 MID + 2 FWD = 11
const xi: FPLElementRaw[] = [
  mkPlayer(1,  1, 1),   // GK
  mkPlayer(2,  2, 2), mkPlayer(3,  2, 3), mkPlayer(4,  2, 4), mkPlayer(5,  2, 5),  // DEF
  mkPlayer(6,  3, 6), mkPlayer(7,  3, 7), mkPlayer(8,  3, 8), mkPlayer(9,  3, 9),  // MID
  mkPlayer(10, 4, 10), mkPlayer(11, 4, 11), // FWD
]

const livePoints: Record<number, number> = {
  1: 6, 2: 8, 3: 7, 4: 6, 5: 5, 6: 12, 7: 9, 8: 8, 9: 7, 10: 18, 11: 9
}

const mockResult: PerfectXIResult = {
  xi,
  captain: xi[9], // Player10 has most points (18)
  formation: '4-4-2',
  totalPts: 95,
  squadCost: 660,
  overBudget: false,
  overBudgetBy: 0,
}

describe('PerfectGWPitch', () => {
  it('renders all 11 player names', () => {
    render(<PerfectGWPitch result={mockResult} teams={teams} livePoints={livePoints} />)
    for (let i = 1; i <= 11; i++) {
      expect(screen.getByText(`Player${i}`)).toBeTruthy()
    }
  })

  it('renders the total points', () => {
    render(<PerfectGWPitch result={mockResult} teams={teams} livePoints={livePoints} />)
    expect(screen.getByText('95')).toBeTruthy()
  })

  it('renders the formation label', () => {
    render(<PerfectGWPitch result={mockResult} teams={teams} livePoints={livePoints} />)
    expect(screen.getByText('4-4-2')).toBeTruthy()
  })

  it('renders the CAPT badge on the captain', () => {
    render(<PerfectGWPitch result={mockResult} teams={teams} livePoints={livePoints} />)
    expect(screen.getByText('CAPT')).toBeTruthy()
  })

  it('renders BudgetBanner (within budget text visible)', () => {
    render(<PerfectGWPitch result={mockResult} teams={teams} livePoints={livePoints} />)
    expect(screen.getByText(/within budget/i)).toBeTruthy()
  })
})
```

- [ ] **Step 7.2: Run tests — verify they fail**

```
npx vitest run src/components/perfect-gw/PerfectGWPitch.test.tsx
```

Expected: 5 tests fail with "Cannot find module './PerfectGWPitch'"

- [ ] **Step 7.3: Implement PerfectGWPitch**

Create `src/components/perfect-gw/PerfectGWPitch.tsx`:

```tsx
import { PlayerCard } from './PlayerCard'
import { BudgetBanner } from './BudgetBanner'
import type { PerfectXIResult } from '@/lib/perfect-gw/computePerfectXI'
import type { FPLElementRaw } from '@/lib/fpl-adapter'
import type { FPLTeam } from '@/lib/types'

interface PerfectGWPitchProps {
  result: PerfectXIResult
  teams: FPLTeam[]
  livePoints: Record<number, number>
}

/**
 * Parse a formation string "D-M-F" (e.g. "4-4-2") into slot counts.
 * Returns [defCount, midCount, fwdCount]. GK is always 1.
 */
function parseFormation(formation: string): [number, number, number] {
  const parts = formation.split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid formation string: ${formation}`)
  }
  return [parts[0], parts[1], parts[2]]
}

/**
 * Split the XI array (ordered [GK, ...DEFs, ...MIDs, ...FWDs]) into
 * row groups for rendering.
 */
function splitIntoRows(xi: FPLElementRaw[], formation: string): FPLElementRaw[][] {
  const [defCount, midCount, fwdCount] = parseFormation(formation)
  const gk   = xi.slice(0, 1)
  const defs = xi.slice(1, 1 + defCount)
  const mids = xi.slice(1 + defCount, 1 + defCount + midCount)
  const fwds = xi.slice(1 + defCount + midCount, 1 + defCount + midCount + fwdCount)
  // Render attack at top, keeper at bottom
  return [fwds, mids, defs, gk]
}

export function PerfectGWPitch({ result, teams, livePoints }: PerfectGWPitchProps) {
  const teamMap = new Map(teams.map(t => [t.id, t]))
  const rows = splitIntoRows(result.xi, result.formation)

  return (
    <div className="space-y-3">
      <BudgetBanner
        squadCost={result.squadCost}
        overBudget={result.overBudget}
        overBudgetBy={result.overBudgetBy}
      />

      {/* Pitch */}
      <div className="relative rounded-lg overflow-hidden bg-gradient-to-b from-green-800 to-green-700 p-3">
        {/* Pitch markings */}
        <div className="absolute inset-3 border border-white/20 rounded pointer-events-none" />
        <div className="absolute left-3 right-3 top-1/2 border-t border-white/15 pointer-events-none" />

        <div className="relative space-y-3 py-2">
          {rows.map((rowPlayers, rowIdx) => (
            <div key={rowIdx} className="flex justify-center gap-2 flex-wrap">
              {rowPlayers.map(player => {
                const team = teamMap.get(player.team) ?? {
                  id: player.team, name: '?', short_name: '?', code: 0,
                }
                return (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    points={livePoints[player.id] ?? 0}
                    team={team}
                    isCapt={player.id === result.captain.id}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer: formation + total */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{result.formation}</span>
        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{result.totalPts}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 7.4: Run tests — verify all 5 pass**

```
npx vitest run src/components/perfect-gw/PerfectGWPitch.test.tsx
```

Expected: 5 passed

- [ ] **Step 7.5: Commit**

```
git add src/components/perfect-gw/PerfectGWPitch.tsx src/components/perfect-gw/PerfectGWPitch.test.tsx
git commit -m "feat(perfect-gw): PerfectGWPitch component with tests"
```

---

## Task 8: PerfectGWTab — shell, GW selector, inner tabs, data fetching

**Files:**
- Create: `src/components/perfect-gw/PerfectGWTab.tsx`
- Create: `src/components/perfect-gw/PerfectGWTab.test.tsx`

**Background:** The main component. Fetches bootstrap + live GW points. State: `selectedGw` (null = use latest settled GW), `activeInnerTab` ('pitch' | 'top-scorers'). GW selector: ◀ / ▶ arrows navigating settled GWs in ascending order; disabled at bounds. Handles: loading state, fetch error state, "GW not yet settled" guard.

- [ ] **Step 8.1: Write failing tests**

Create `src/components/perfect-gw/PerfectGWTab.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock hooks BEFORE importing the component (Vitest hoists vi.mock)
const mockUseBootstrap   = vi.fn()
const mockUseLiveGwPoints = vi.fn()
vi.mock('@/lib/hooks/useBootstrap',    () => ({ useBootstrap:    (...a: unknown[]) => mockUseBootstrap(...a) }))
vi.mock('@/lib/hooks/useLiveGwPoints', () => ({ useLiveGwPoints: (...a: unknown[]) => mockUseLiveGwPoints(...a) }))

import { PerfectGWTab } from './PerfectGWTab'

// Minimal bootstrap with 2 settled GWs and enough players to fill an XI
const BOOTSTRAP = {
  elements: [
    // 1 GK
    { id: 1, code: 1, web_name: 'GK1', team: 1, element_type: 1, now_cost: 50, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    // 4 DEFs
    { id: 2, code: 2, web_name: 'DEF1', team: 2, element_type: 2, now_cost: 50, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    { id: 3, code: 3, web_name: 'DEF2', team: 3, element_type: 2, now_cost: 50, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    { id: 4, code: 4, web_name: 'DEF3', team: 4, element_type: 2, now_cost: 50, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    { id: 5, code: 5, web_name: 'DEF4', team: 5, element_type: 2, now_cost: 50, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    // 4 MIDs
    { id: 6, code: 6, web_name: 'MID1', team: 6, element_type: 3, now_cost: 80, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    { id: 7, code: 7, web_name: 'MID2', team: 7, element_type: 3, now_cost: 80, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    { id: 8, code: 8, web_name: 'MID3', team: 8, element_type: 3, now_cost: 80, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    { id: 9, code: 9, web_name: 'MID4', team: 9, element_type: 3, now_cost: 80, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    // 2 FWDs
    { id: 10, code: 10, web_name: 'FWD1', team: 10, element_type: 4, now_cost: 90, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    { id: 11, code: 11, web_name: 'FWD2', team: 11, element_type: 4, now_cost: 90, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
  ],
  teams: Array.from({ length: 11 }, (_, i) => ({
    id: i + 1, name: `Club ${i + 1}`, short_name: `C${i + 1}`, code: i + 1,
  })),
  events: [
    { id: 37, is_current: false, is_next: false, finished: true, data_checked: true, deadline_time: '2026-05-10T10:00:00Z' },
    { id: 38, is_current: false, is_next: false, finished: true, data_checked: true, deadline_time: '2026-05-17T10:00:00Z' },
  ],
}

const LIVE_POINTS: Record<number, number> = {
  1: 6, 2: 8, 3: 7, 4: 6, 5: 5, 6: 18, 7: 10, 8: 9, 9: 8, 10: 15, 11: 9,
}

function mockSuccess() {
  mockUseBootstrap.mockReturnValue({
    data: BOOTSTRAP, isLoading: false, isError: false, error: null,
  })
  mockUseLiveGwPoints.mockReturnValue({
    data: LIVE_POINTS, isLoading: false, isError: false, error: null,
  })
}

beforeEach(() => {
  mockUseBootstrap.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null })
  mockUseLiveGwPoints.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null })
})

describe('PerfectGWTab', () => {
  it('shows loading state while data is fetching', () => {
    render(<PerfectGWTab />)
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })

  it('shows error state when bootstrap fetch fails', () => {
    mockUseBootstrap.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('fail') })
    mockUseLiveGwPoints.mockReturnValue({ data: undefined, isLoading: false, isError: false, error: null })
    render(<PerfectGWTab />)
    expect(screen.getByText(/error/i)).toBeTruthy()
  })

  it('defaults to latest settled GW (GW38) in the header', () => {
    mockSuccess()
    render(<PerfectGWTab />)
    expect(screen.getByText(/GW\s*38/)).toBeTruthy()
  })

  it('renders inner tabs: Perfect XI and Top Scorers', () => {
    mockSuccess()
    render(<PerfectGWTab />)
    expect(screen.getByRole('button', { name: /perfect xi/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /top scorers/i })).toBeTruthy()
  })

  it('switches to Top Scorers tab on click', () => {
    mockSuccess()
    render(<PerfectGWTab />)
    fireEvent.click(screen.getByRole('button', { name: /top scorers/i }))
    // TopScorersTable renders position headers
    expect(screen.getByText('GK')).toBeTruthy()
    expect(screen.getByText('DEF')).toBeTruthy()
  })

  it('prev button is disabled on the first settled GW', () => {
    mockSuccess()
    render(<PerfectGWTab />)
    // Navigate back to GW37 (earliest)
    fireEvent.click(screen.getByRole('button', { name: /previous gameweek/i }))
    // Now prev should be disabled
    expect(screen.getByRole('button', { name: /previous gameweek/i })).toBeDisabled()
  })

  it('next button is disabled on the latest settled GW (default view)', () => {
    mockSuccess()
    render(<PerfectGWTab />)
    expect(screen.getByRole('button', { name: /next gameweek/i })).toBeDisabled()
  })
})
```

- [ ] **Step 8.2: Run tests — verify they fail**

```
npx vitest run src/components/perfect-gw/PerfectGWTab.test.tsx
```

Expected: 7 tests fail with "Cannot find module './PerfectGWTab'"

- [ ] **Step 8.3: Implement PerfectGWTab**

Create `src/components/perfect-gw/PerfectGWTab.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useBootstrap }    from '@/lib/hooks/useBootstrap'
import { useLiveGwPoints } from '@/lib/hooks/useLiveGwPoints'
import { computePerfectXI } from '@/lib/perfect-gw/computePerfectXI'
import { PerfectGWPitch }   from './PerfectGWPitch'
import { TopScorersTable }  from './TopScorersTable'

type InnerTab = 'pitch' | 'top-scorers'

export function PerfectGWTab() {
  const { data: bootstrap, isLoading: bsLoading, isError: bsError } = useBootstrap()
  const [selectedGw, setSelectedGw]   = useState<number | null>(null)
  const [activeTab, setActiveTab]      = useState<InnerTab>('pitch')

  // All settled GWs in ascending order
  const settledGws: number[] = bootstrap?.events
    .filter(e => e.finished && e.data_checked)
    .map(e => e.id) ?? []

  // Default: latest settled GW
  const effectiveGw = selectedGw ?? (settledGws.length > 0 ? settledGws[settledGws.length - 1] : null)

  const { data: livePoints, isLoading: ptLoading, isError: ptError } = useLiveGwPoints(effectiveGw)

  // ─── Loading / error guards ────────────────────────────────────────────────

  if (bsLoading || ptLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (bsError || ptError || !bootstrap || !livePoints || effectiveGw === null) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-red-600 dark:text-red-400 text-sm">Error loading Perfect GW data.</p>
      </div>
    )
  }

  // GW settled guard
  const gwEvent = bootstrap.events.find(e => e.id === effectiveGw)
  if (!gwEvent?.finished || !gwEvent?.data_checked) {
    return (
      <div className="py-16 text-center">
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          GW in progress — results available after all matches complete.
        </p>
      </div>
    )
  }

  const result = computePerfectXI(bootstrap.elements, livePoints)

  // ─── GW selector helpers ───────────────────────────────────────────────────

  const currentIdx = settledGws.indexOf(effectiveGw)
  const canGoPrev  = currentIdx > 0
  const canGoNext  = currentIdx < settledGws.length - 1

  function goPrev() {
    if (canGoPrev) setSelectedGw(settledGws[currentIdx - 1])
  }
  function goNext() {
    if (canGoNext) setSelectedGw(settledGws[currentIdx + 1])
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* GW selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={goPrev}
          disabled={!canGoPrev}
          aria-label="Previous gameweek"
          className="px-3 py-1.5 rounded text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ◀
        </button>
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          GW {effectiveGw} — Perfect XI
        </span>
        <button
          onClick={goNext}
          disabled={!canGoNext}
          aria-label="Next gameweek"
          className="px-3 py-1.5 rounded text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ▶
        </button>
      </div>

      {/* Inner tabs */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700">
        <button
          onClick={() => setActiveTab('pitch')}
          aria-pressed={activeTab === 'pitch'}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'pitch'
              ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
          }`}
        >
          ⚽ Perfect XI
        </button>
        <button
          onClick={() => setActiveTab('top-scorers')}
          aria-pressed={activeTab === 'top-scorers'}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'top-scorers'
              ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
          }`}
        >
          📊 Top Scorers
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'pitch' && (
        <PerfectGWPitch result={result} teams={bootstrap.teams} livePoints={livePoints} />
      )}
      {activeTab === 'top-scorers' && (
        <TopScorersTable players={bootstrap.elements} livePoints={livePoints} teams={bootstrap.teams} />
      )}
    </div>
  )
}
```

- [ ] **Step 8.4: Run tests — verify all 7 pass**

```
npx vitest run src/components/perfect-gw/PerfectGWTab.test.tsx
```

Expected: 7 passed

- [ ] **Step 8.5: Commit**

```
git add src/components/perfect-gw/PerfectGWTab.tsx src/components/perfect-gw/PerfectGWTab.test.tsx
git commit -m "feat(perfect-gw): PerfectGWTab shell with GW selector and inner tabs"
```

---

## Task 9: Wire into page.tsx (Analyse section)

**Files:**
- Modify: `src/app/page.tsx`

**Background:** All tabs live in `src/app/page.tsx`. To add a new tab: (1) add `'perfect-gw'` to the `SubTab` union type, (2) add an entry to `SECTIONS[0].subTabs` (the `'analyse'` section), (3) add a render conditional in the JSX return. The mobile nav derives its tabs automatically from `SECTIONS` — no separate change needed.

- [ ] **Step 9.1: Add `'perfect-gw'` to the SubTab type**

In `src/app/page.tsx`, find:

```typescript
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'manual-plan' | 'route-tree' | 'club-form' | 'value-gems' | 'accuracy' | 'season' | 'window' | 'decision' | 'transfers' | 'optimiser' | 'price-reset' | 'price-changes' | 'rivals' | 'lineup' | 'review' | 'rank-sim' | 'next-season' | 'watchlist'
```

Replace with:

```typescript
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'manual-plan' | 'route-tree' | 'club-form' | 'value-gems' | 'accuracy' | 'season' | 'window' | 'decision' | 'transfers' | 'optimiser' | 'price-reset' | 'price-changes' | 'rivals' | 'lineup' | 'review' | 'rank-sim' | 'next-season' | 'watchlist' | 'perfect-gw'
```

- [ ] **Step 9.2: Add the sub-tab entry to the Analyse section**

In `src/app/page.tsx`, find the `SECTIONS` array's `analyse` entry. It ends with:

```typescript
      { id: 'price-changes' as SubTab, label: 'Price Changes',   mobileLabel: 'Prices'   },
    ],
    defaultSubTab: 'gems' as SubTab,
  },
```

Replace with:

```typescript
      { id: 'price-changes' as SubTab, label: 'Price Changes',   mobileLabel: 'Prices'   },
      { id: 'perfect-gw' as SubTab,    label: 'Perfect GW',      mobileLabel: 'Perfect'  },
    ],
    defaultSubTab: 'gems' as SubTab,
  },
```

- [ ] **Step 9.3: Add the import for PerfectGWTab**

At the top of `src/app/page.tsx`, after the existing imports, add:

```typescript
import { PerfectGWTab } from '@/components/perfect-gw/PerfectGWTab'
```

- [ ] **Step 9.4: Add the render conditional**

In `src/app/page.tsx`, find the block:

```typescript
        {activeSection !== 'squad' && activeSubTab === 'price-changes' && <PriceChangePanel />}
```

After that line, add:

```typescript
        {activeSection !== 'squad' && activeSubTab === 'perfect-gw' && <PerfectGWTab />}
```

- [ ] **Step 9.5: Run full test suite to verify nothing broke**

```
npx vitest run
```

Expected: all existing tests pass; the 6+3+4+6+4+4+5+7 = 39 new tests pass

- [ ] **Step 9.6: Commit**

```
git add src/app/page.tsx
git commit -m "feat(perfect-gw): wire PerfectGWTab into Analyse section nav"
```

---

## Task 10: Final integration check

- [ ] **Step 10.1: Run the full test suite one final time**

```
npx vitest run
```

Expected: all tests pass, 0 failures

- [ ] **Step 10.2: Verify TypeScript compiles cleanly**

```
npx tsc --noEmit
```

Expected: no type errors

- [ ] **Step 10.3: Commit if any fixes were needed, then tag**

```
git commit -m "feat(perfect-gw): PERFECT-01 complete" --allow-empty
```
