# LIVE-01 — Live GW Score Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Live" 5th sub-tab to the Squad section that shows the user's live GW score — including provisional bonus, auto-subs, captain/VC promotion, and chip status — polling every 60 s during active fixtures.

**Architecture:** Three new files do all the work: `src/lib/live-gw.ts` (pure types + `computeLiveScore`), `src/lib/hooks/useLiveGw.ts` (TanStack Query polling hook), and `src/components/squad/LiveGwTab.tsx` (display component). `page.tsx` wires the new sub-tab into the existing Squad section. All FPL endpoints are already proxied via `/api/fpl/[...proxy]`.

**Tech Stack:** TypeScript, Zod, React, TanStack Query (`useQueries`), Tailwind CSS, Vitest + RTL

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `src/lib/live-gw.ts` | **Create** | `LivePlayerStats`, `LiveXIPlayer`, `AutoSubEntry`, `AutoSubRecord`, `LivePicksResponse`, `LiveScore` types; `AutoSubRecordSchema`, `LivePicksResponseSchema`; `computeLiveScore()` pure function |
| `src/lib/live-gw.test.ts` | **Create** | 8 pure-function tests for `computeLiveScore` |
| `src/lib/hooks/useLiveGw.ts` | **Create** | TanStack Query `useQueries` hook — parallel-fetches live stats + picks, 60 s polling when `isLive` |
| `src/lib/hooks/useLiveGw.test.ts` | **Create** | Hook tests (enabled/disabled, polling interval, error state) |
| `src/components/squad/LiveGwTab.tsx` | **Create** | Component + co-located RTL tests (8 cases) |
| `src/app/page.tsx` | **Modify** | Add `'live'` to `SubTab` union, Squad `subTabs` array, render conditional |
| `src/app/page.test.tsx` | **Modify** | Add `vi.mock` for `LiveGwTab`; add Live sub-tab nav test |
| `src/components/nav/MobileNav.test.tsx` | **Modify** | Update Squad pill test to expect 6 pills including "Live" |

---

### Task 1: Types + `computeLiveScore` pure function

**Files:**
- Create: `src/lib/live-gw.ts`
- Create: `src/lib/live-gw.test.ts`

---

- [ ] **Step 1.1: Write the 8 failing tests**

Create `src/lib/live-gw.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeLiveScore } from './live-gw'
import type { LivePlayerStats } from './live-gw'
import type { SquadPick } from './squad-adapter'
import type { AutoSubRecord } from './live-gw'

// ── helpers ────────────────────────────────────────────────────────────────

function makeStats(overrides: Partial<LivePlayerStats> = {}): LivePlayerStats {
  return {
    goals_scored: 0,
    assists: 0,
    bonus: 0,
    clean_sheets: 0,
    saves: 0,
    minutes: 90,
    total_points: 2,
    yellow_cards: 0,
    red_cards: 0,
    ...overrides,
  }
}

function makePick(overrides: Partial<SquadPick> = {}): SquadPick {
  return {
    element: 1,
    position: 1,
    multiplier: 1,
    is_captain: false,
    is_vice_captain: false,
    ...overrides,
  }
}

/** Build a 15-pick squad: positions 1–15, element ids 1–15 */
function makeSquad(): SquadPick[] {
  return Array.from({ length: 15 }, (_, i) => makePick({ element: i + 1, position: i + 1 }))
}

/** Captain on element 2, VC on element 3 */
function makeSquadWithCaptain(): SquadPick[] {
  return makeSquad().map(p => ({
    ...p,
    is_captain:       p.element === 2,
    is_vice_captain:  p.element === 3,
  }))
}

function makeStatsMap(entries: [number, Partial<LivePlayerStats>][]): Map<number, LivePlayerStats> {
  const m = new Map<number, LivePlayerStats>()
  for (const [id, overrides] of entries) {
    m.set(id, makeStats(overrides))
  }
  return m
}

function makeNameMap(ids: number[]): Map<number, { web_name: string; team: number }> {
  const m = new Map<number, { web_name: string; team: number }>()
  for (const id of ids) {
    m.set(id, { web_name: `Player${id}`, team: id * 10 })
  }
  return m
}

const ALL_IDS = Array.from({ length: 15 }, (_, i) => i + 1)
const NAME_MAP = makeNameMap(ALL_IDS)

// ── tests ──────────────────────────────────────────────────────────────────

describe('computeLiveScore', () => {
  it('T1: captain played → ×2 multiplier on captain, total reflects doubled points', () => {
    const picks = makeSquadWithCaptain()
    // element 2 is captain, stats: 6 pts; everyone else 2 pts
    const statsMap = makeStatsMap([[2, { total_points: 6, minutes: 90 }]])
    // fill remaining 14 with default 2 pts
    for (const id of ALL_IDS.filter(id => id !== 2)) {
      statsMap.set(id, makeStats({ total_points: 2, minutes: 90 }))
    }
    const result = computeLiveScore(picks, [], null, statsMap, NAME_MAP)
    expect(result.vc_promoted).toBe(false)
    expect(result.effective_captain_id).toBe(2)
    // Captain row: 6 × 2 = 12; other 10 starters: 2 pts each = 20; total = 32
    expect(result.total_points).toBe(32)
    const captainRow = result.xi.find(p => p.element === 2)!
    expect(captainRow.multiplier).toBe(2)
    expect(captainRow.live_points).toBe(12)
  })

  it('T2: captain 0 min, VC played → VC gets ×2, vc_promoted = true', () => {
    const picks = makeSquadWithCaptain()
    const statsMap = makeStatsMap([[2, { total_points: 0, minutes: 0 }]])
    for (const id of ALL_IDS.filter(id => id !== 2)) {
      statsMap.set(id, makeStats({ total_points: 3, minutes: 90 }))
    }
    const result = computeLiveScore(picks, [], null, statsMap, NAME_MAP)
    expect(result.vc_promoted).toBe(true)
    expect(result.effective_captain_id).toBe(3)
    const vcRow = result.xi.find(p => p.element === 3)!
    expect(vcRow.multiplier).toBe(2)
    expect(vcRow.live_points).toBe(6)
    // Captain 0 pts × 1 multiplier (demoted) — not in XI for total if subbed off? Captain was pos 2
    // Positions 1–11 in XI: elements 1–11; captain (elem 2, pos 2, 0 pts) is in XI
    const captainRow = result.xi.find(p => p.element === 2)!
    expect(captainRow.multiplier).toBe(1)
  })

  it('T3: captain and VC both 0 min → multiplier = 1 for both, vc_promoted = false', () => {
    const picks = makeSquadWithCaptain()
    const statsMap = new Map<number, LivePlayerStats>()
    for (const id of ALL_IDS) {
      statsMap.set(id, makeStats({ total_points: 2, minutes: id <= 2 ? 0 : 90 }))
    }
    const result = computeLiveScore(picks, [], null, statsMap, NAME_MAP)
    expect(result.vc_promoted).toBe(false)
    expect(result.effective_captain_id).toBe(2)
    const captainRow = result.xi.find(p => p.element === 2)!
    expect(captainRow.multiplier).toBe(1)
    const vcRow = result.xi.find(p => p.element === 3)!
    expect(vcRow.multiplier).toBe(1)
  })

  it('T4: TC chip + captain 0 min → VC gets ×3', () => {
    const picks = makeSquadWithCaptain()
    const statsMap = new Map<number, LivePlayerStats>()
    for (const id of ALL_IDS) {
      statsMap.set(id, makeStats({ total_points: 5, minutes: id === 2 ? 0 : 90 }))
    }
    const result = computeLiveScore(picks, [], '3xc', statsMap, NAME_MAP)
    expect(result.vc_promoted).toBe(true)
    const vcRow = result.xi.find(p => p.element === 3)!
    expect(vcRow.multiplier).toBe(3)
    expect(vcRow.live_points).toBe(15)
  })

  it('T5: Bench Boost → all 15 in XI, bench empty, total = sum of all 15', () => {
    const picks = makeSquadWithCaptain()
    const statsMap = new Map<number, LivePlayerStats>()
    for (const id of ALL_IDS) {
      statsMap.set(id, makeStats({ total_points: 4, minutes: 90 }))
    }
    const result = computeLiveScore(picks, [], 'bboost', statsMap, NAME_MAP)
    expect(result.xi).toHaveLength(15)
    expect(result.bench).toHaveLength(0)
    expect(result.auto_subs).toHaveLength(0)
    // captain elem 2 gets ×2, so: 14 × 4 + 1 × 8 = 56 + 8 = 64
    expect(result.total_points).toBe(64)
  })

  it('T6: autosub applied → subbed-out player not in XI total, subbed-in player counted', () => {
    const picks = makeSquad()  // no captain (edge is fine for this test)
    const sub: AutoSubRecord = { entry: 1, element_in: 12, element_out: 5, event: 38 }
    const statsMap = new Map<number, LivePlayerStats>()
    for (const id of ALL_IDS) {
      statsMap.set(id, makeStats({ total_points: 3, minutes: id === 5 ? 0 : 90 }))
    }
    const result = computeLiveScore(picks, [sub], null, statsMap, NAME_MAP)
    // Element 5 subbed out → not in XI
    const subbedOut = result.xi.find(p => p.element === 5)
    expect(subbedOut).toBeUndefined()
    // Element 12 subbed in → in XI
    const subbedIn = result.xi.find(p => p.element === 12)
    expect(subbedIn).not.toBeUndefined()
    expect(subbedIn!.is_subbed_in).toBe(true)
    // Element 5 in bench
    const outOnBench = result.bench.find(p => p.element === 5)
    expect(outOnBench!.is_subbed_out).toBe(true)
    // XI = 11 players (1,2,3,4, [not5], 6,7,8,9,10,11, 12-subbed-in)
    expect(result.xi).toHaveLength(11)
  })

  it('T7: empty liveStatsMap → all stats zero, total = 0, no crash', () => {
    const picks = makeSquadWithCaptain()
    const result = computeLiveScore(picks, [], null, new Map(), NAME_MAP)
    expect(result.total_points).toBe(0)
    expect(result.xi).toHaveLength(11)
    result.xi.forEach(p => {
      expect(p.stats.total_points).toBe(0)
      expect(p.live_points).toBe(0)
    })
  })

  it('T8: auto_subs log lists player_out name and minutes played', () => {
    const picks = makeSquad()
    const sub: AutoSubRecord = { entry: 1, element_in: 13, element_out: 7, event: 38 }
    const statsMap = new Map<number, LivePlayerStats>()
    for (const id of ALL_IDS) {
      statsMap.set(id, makeStats({ total_points: 2, minutes: id === 7 ? 15 : 90 }))
    }
    const result = computeLiveScore(picks, [sub], null, statsMap, NAME_MAP)
    expect(result.auto_subs).toHaveLength(1)
    expect(result.auto_subs[0].player_out).toBe('Player7')
    expect(result.auto_subs[0].player_in).toBe('Player13')
    expect(result.auto_subs[0].minutes_played_by_out).toBe(15)
  })
})
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```
npx vitest run src/lib/live-gw.test.ts
```

Expected: all 8 fail with `Cannot find module './live-gw'`

- [ ] **Step 1.3: Create `src/lib/live-gw.ts` with types and `computeLiveScore`**

```typescript
import { z } from 'zod'
import { SquadPickSchema } from './squad-adapter'
import type { SquadPick } from './squad-adapter'

// ── Zod schemas ─────────────────────────────────────────────────────────────

export const AutoSubRecordSchema = z.object({
  entry:       z.number().int(),
  element_in:  z.number().int(),
  element_out: z.number().int(),
  event:       z.number().int(),
})

export const LivePicksResponseSchema = z.object({
  active_chip:    z.string().nullable(),
  picks:          z.array(SquadPickSchema),
  automatic_subs: z.array(AutoSubRecordSchema).default([]),
})

export type AutoSubRecord    = z.infer<typeof AutoSubRecordSchema>
export type LivePicksResponse = z.infer<typeof LivePicksResponseSchema>

// ── Domain types ─────────────────────────────────────────────────────────────

export interface LivePlayerStats {
  goals_scored:  number
  assists:       number
  bonus:         number
  clean_sheets:  number
  saves:         number
  minutes:       number
  total_points:  number
  yellow_cards:  number
  red_cards:     number
}

export interface LiveXIPlayer {
  element:         number
  position:        number
  player_name:     string
  team_id:         number
  is_captain:      boolean
  is_vice_captain: boolean
  multiplier:      number
  stats:           LivePlayerStats
  live_points:     number
  is_subbed_out:   boolean
  is_subbed_in:    boolean
}

export interface AutoSubEntry {
  player_out:              string
  player_in:               string
  minutes_played_by_out:   number
}

export interface LiveScore {
  total_points:         number
  xi:                   LiveXIPlayer[]
  bench:                LiveXIPlayer[]
  auto_subs:            AutoSubEntry[]
  effective_captain_id: number
  vc_promoted:          boolean
  chip:                 string | null
  is_provisional:       boolean
}

// ── Zero-stats sentinel ───────────────────────────────────────────────────────

const ZERO_STATS: LivePlayerStats = {
  goals_scored: 0,
  assists:      0,
  bonus:        0,
  clean_sheets: 0,
  saves:        0,
  minutes:      0,
  total_points: 0,
  yellow_cards: 0,
  red_cards:    0,
}

// ── Pure function ─────────────────────────────────────────────────────────────

export function computeLiveScore(
  picks: SquadPick[],
  automaticSubs: AutoSubRecord[],
  activeChip: string | null,
  liveStatsMap: Map<number, LivePlayerStats>,
  playerNameMap: Map<number, { web_name: string; team: number }>,
): LiveScore {
  // Step 1: Build base XV
  const baseXV: LiveXIPlayer[] = picks.map(pick => {
    const stats   = liveStatsMap.get(pick.element) ?? { ...ZERO_STATS }
    const nameEntry = playerNameMap.get(pick.element)
    return {
      element:         pick.element,
      position:        pick.position,
      player_name:     nameEntry?.web_name ?? `Player${pick.element}`,
      team_id:         nameEntry?.team ?? 0,
      is_captain:      pick.is_captain,
      is_vice_captain: pick.is_vice_captain,
      multiplier:      1,
      stats,
      live_points:     0,  // computed after multiplier resolution
      is_subbed_out:   false,
      is_subbed_in:    false,
    }
  })

  // Step 2: Captain / VC promotion
  const captainPlayer = baseXV.find(p => p.is_captain)
  const vcPlayer      = baseXV.find(p => p.is_vice_captain)

  let effectiveCaptainId = captainPlayer?.element ?? 0
  let vcPromoted         = false

  const tcMultiplier = activeChip === '3xc' ? 3 : 2

  if (captainPlayer && captainPlayer.stats.minutes === 0) {
    if (vcPlayer && vcPlayer.stats.minutes > 0) {
      // VC steps up
      vcPlayer.multiplier    = tcMultiplier
      vcPromoted             = true
      effectiveCaptainId     = vcPlayer.element
    } else {
      // Both 0 min — no doubling
      captainPlayer.multiplier = 1
    }
  } else if (captainPlayer) {
    captainPlayer.multiplier = tcMultiplier
  }

  // Step 3: Bench Boost — skip autosubs
  if (activeChip === 'bboost') {
    // All 15 count; compute live_points
    const xi = baseXV.map(p => ({
      ...p,
      live_points: p.stats.total_points * p.multiplier,
    }))
    const totalPoints = xi.reduce((sum, p) => sum + p.live_points, 0)
    return {
      total_points:         totalPoints,
      xi,
      bench:                [],
      auto_subs:            [],
      effective_captain_id: effectiveCaptainId,
      vc_promoted:          vcPromoted,
      chip:                 activeChip,
      is_provisional:       true,
    }
  }

  // Step 4: Autosubs
  const subbedOutIds = new Set(automaticSubs.map(s => s.element_out))
  const subbedInIds  = new Set(automaticSubs.map(s => s.element_in))

  for (const p of baseXV) {
    if (subbedOutIds.has(p.element)) p.is_subbed_out = true
    if (subbedInIds.has(p.element))  p.is_subbed_in  = true
  }

  const xi: LiveXIPlayer[] = []
  const bench: LiveXIPlayer[] = []

  for (const p of baseXV) {
    const isStarter = p.position <= 11
    if (p.is_subbed_out) {
      bench.push({ ...p, live_points: p.stats.total_points * p.multiplier })
    } else if (p.is_subbed_in) {
      xi.push({ ...p, live_points: p.stats.total_points * p.multiplier })
    } else if (isStarter) {
      xi.push({ ...p, live_points: p.stats.total_points * p.multiplier })
    } else {
      bench.push({ ...p, live_points: p.stats.total_points * p.multiplier })
    }
  }

  // Step 5: Build autosub log
  const autoSubEntries: AutoSubEntry[] = automaticSubs.map(sub => {
    const outPlayer  = baseXV.find(p => p.element === sub.element_out)
    const inPlayer   = baseXV.find(p => p.element === sub.element_in)
    return {
      player_out:            outPlayer?.player_name ?? `Player${sub.element_out}`,
      player_in:             inPlayer?.player_name  ?? `Player${sub.element_in}`,
      minutes_played_by_out: outPlayer?.stats.minutes ?? 0,
    }
  })

  // Step 6: Total = sum of XI live_points
  const totalPoints = xi.reduce((sum, p) => sum + p.live_points, 0)

  return {
    total_points:         totalPoints,
    xi:                   xi.sort((a, b) => a.position - b.position),
    bench:                bench.sort((a, b) => a.position - b.position),
    auto_subs:            autoSubEntries,
    effective_captain_id: effectiveCaptainId,
    vc_promoted:          vcPromoted,
    chip:                 activeChip,
    is_provisional:       true,
  }
}
```

- [ ] **Step 1.4: Run tests to confirm all 8 pass**

```
npx vitest run src/lib/live-gw.test.ts
```

Expected: 8 tests pass

- [ ] **Step 1.5: Commit**

```
git add src/lib/live-gw.ts src/lib/live-gw.test.ts
git commit -m "feat(live-01): add computeLiveScore pure function + types"
```

---

### Task 2: `useLiveGw` polling hook

**Files:**
- Create: `src/lib/hooks/useLiveGw.ts`
- Create: `src/lib/hooks/useLiveGw.test.ts`

---

- [ ] **Step 2.1: Write the failing hook tests**

Create `src/lib/hooks/useLiveGw.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { useLiveGw } from './useLiveGw'

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

function makeLivePayload(elements: Array<{ id: number; stats: Record<string, number> }>) {
  return { elements }
}

function makePicksPayload() {
  return {
    active_chip: null,
    picks: [
      { element: 1, position: 1, multiplier: 1, is_captain: true,  is_vice_captain: false },
      { element: 2, position: 2, multiplier: 1, is_captain: false, is_vice_captain: true  },
    ],
    automatic_subs: [],
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useLiveGw', () => {
  it('is disabled when teamId is null', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(
      () => useLiveGw(null, 38, true),
      { wrapper: makeWrapper() },
    )
    expect(result.current.isLoading).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is disabled when currentGw is null', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(
      () => useLiveGw(12345, null, true),
      { wrapper: makeWrapper() },
    )
    expect(result.current.isLoading).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches both endpoints and returns parsed data', async () => {
    const liveResponse  = makeLivePayload([{ id: 1, stats: { total_points: 12, goals_scored: 2, assists: 0, bonus: 3, clean_sheets: 0, saves: 0, minutes: 90, yellow_cards: 0, red_cards: 0 } }])
    const picksResponse = makePicksPayload()

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/live/'))   return new Response(JSON.stringify(liveResponse),  { status: 200 })
      if (url.includes('/picks/'))  return new Response(JSON.stringify(picksResponse), { status: 200 })
      return new Response('not found', { status: 404 })
    }))

    const { result } = renderHook(
      () => useLiveGw(12345, 38, false),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isError).toBe(false)
    expect(result.current.liveStats).not.toBeNull()
    expect(result.current.picksData).not.toBeNull()
    // liveStats should be a Map keyed by player id
    expect(result.current.liveStats?.get(1)?.total_points).toBe(12)
  })

  it('isError true when live endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/live/')) return new Response('error', { status: 500 })
      return new Response(JSON.stringify(makePicksPayload()), { status: 200 })
    }))
    const { result } = renderHook(
      () => useLiveGw(12345, 38, false),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('returns null liveStats and picksData while loading', () => {
    // fetch never resolves
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const { result } = renderHook(
      () => useLiveGw(12345, 38, false),
      { wrapper: makeWrapper() },
    )
    expect(result.current.liveStats).toBeNull()
    expect(result.current.picksData).toBeNull()
    expect(result.current.isLoading).toBe(true)
  })
})
```

- [ ] **Step 2.2: Run tests to confirm they fail**

```
npx vitest run src/lib/hooks/useLiveGw.test.ts
```

Expected: all 4 fail with `Cannot find module './useLiveGw'`

- [ ] **Step 2.3: Create `src/lib/hooks/useLiveGw.ts`**

```typescript
import { useQueries } from '@tanstack/react-query'
import { LivePicksResponseSchema } from '@/lib/live-gw'
import type { LivePlayerStats, LivePicksResponse } from '@/lib/live-gw'

// ── Fetch helpers ─────────────────────────────────────────────────────────────

interface FPLLiveElement {
  id: number
  stats: {
    total_points:  number
    goals_scored:  number
    assists:       number
    bonus:         number
    clean_sheets:  number
    saves:         number
    minutes:       number
    yellow_cards:  number
    red_cards:     number
  }
}

async function fetchLiveStats(gw: number): Promise<Map<number, LivePlayerStats>> {
  const res = await fetch(`/api/fpl/event/${gw}/live/`)
  if (!res.ok) {
    const err = new Error(`live GW fetch failed: ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const raw = (await res.json()) as { elements: FPLLiveElement[] }
  const map = new Map<number, LivePlayerStats>()
  for (const el of raw.elements) {
    map.set(el.id, {
      goals_scored:  el.stats.goals_scored,
      assists:       el.stats.assists,
      bonus:         el.stats.bonus,
      clean_sheets:  el.stats.clean_sheets,
      saves:         el.stats.saves,
      minutes:       el.stats.minutes,
      total_points:  el.stats.total_points,
      yellow_cards:  el.stats.yellow_cards,
      red_cards:     el.stats.red_cards,
    })
  }
  return map
}

async function fetchPicks(teamId: number, gw: number): Promise<LivePicksResponse> {
  const res = await fetch(`/api/fpl/entry/${teamId}/event/${gw}/picks/`)
  if (!res.ok) {
    const err = new Error(`picks fetch failed: ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const raw = await res.json()
  const parsed = LivePicksResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error('picks parse failed: invalid shape')
  }
  return parsed.data
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseLiveGwResult {
  liveStats:  Map<number, LivePlayerStats> | null
  picksData:  LivePicksResponse | null
  isLoading:  boolean
  isError:    boolean
  refetch:    () => void
}

export function useLiveGw(
  teamId:    number | null,
  currentGw: number | null,
  isLive:    boolean,
): UseLiveGwResult {
  const enabled = teamId !== null && currentGw !== null

  const results = useQueries({
    queries: [
      {
        queryKey:       ['live-gw-stats', currentGw],
        queryFn:        () => fetchLiveStats(currentGw!),
        enabled,
        refetchInterval: isLive ? 60_000 : false,
        staleTime:      30_000,
      },
      {
        queryKey:       ['live-gw-picks', teamId, currentGw],
        queryFn:        () => fetchPicks(teamId!, currentGw!),
        enabled,
        refetchInterval: isLive ? 60_000 : false,
        staleTime:      30_000,
      },
    ],
  })

  const [statsQuery, picksQuery] = results

  const isLoading = enabled && (statsQuery.isLoading || picksQuery.isLoading)
  const isError   = statsQuery.isError || picksQuery.isError

  function refetch() {
    void statsQuery.refetch()
    void picksQuery.refetch()
  }

  return {
    liveStats:  (statsQuery.data as Map<number, LivePlayerStats> | undefined) ?? null,
    picksData:  (picksQuery.data as LivePicksResponse | undefined) ?? null,
    isLoading,
    isError,
    refetch,
  }
}
```

- [ ] **Step 2.4: Run tests to confirm all 4 pass**

```
npx vitest run src/lib/hooks/useLiveGw.test.ts
```

Expected: 4 tests pass

- [ ] **Step 2.5: Commit**

```
git add src/lib/hooks/useLiveGw.ts src/lib/hooks/useLiveGw.test.ts
git commit -m "feat(live-01): add useLiveGw polling hook"
```

---

### Task 3: `LiveGwTab` component

**Files:**
- Create: `src/components/squad/LiveGwTab.tsx` (component + co-located tests)

---

- [ ] **Step 3.1: Write the 8 failing RTL tests**

Create `src/components/squad/LiveGwTab.test.tsx` (or co-locate in `LiveGwTab.tsx` test file):

Create `src/components/squad/LiveGwTab.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// ── module mocks (set up BEFORE importing the component) ────────────────────

vi.mock('@/lib/hooks/useBootstrap', () => ({
  useBootstrap: vi.fn(),
}))
vi.mock('@/lib/hooks/useLiveGw', () => ({
  useLiveGw: vi.fn(),
}))
vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: vi.fn(() => ({ data: [] })),
}))

import { useBootstrap } from '@/lib/hooks/useBootstrap'
import { useLiveGw }    from '@/lib/hooks/useLiveGw'
import { LiveGwTab }    from './LiveGwTab'
import type { LivePlayerStats, LivePicksResponse } from '@/lib/live-gw'

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function makeStats(overrides: Partial<LivePlayerStats> = {}): LivePlayerStats {
  return {
    goals_scored: 0, assists: 0, bonus: 0, clean_sheets: 0,
    saves: 0, minutes: 90, total_points: 6, yellow_cards: 0, red_cards: 0,
    ...overrides,
  }
}

function makePicksData(overrides: Partial<LivePicksResponse> = {}): LivePicksResponse {
  return {
    active_chip: null,
    picks: [
      { element: 1,  position: 1,  multiplier: 1, is_captain: true,  is_vice_captain: false },
      { element: 2,  position: 2,  multiplier: 1, is_captain: false, is_vice_captain: true  },
      { element: 3,  position: 3,  multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 4,  position: 4,  multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 5,  position: 5,  multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 6,  position: 6,  multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 7,  position: 7,  multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 8,  position: 8,  multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 9,  position: 9,  multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 10, position: 10, multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 11, position: 11, multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 12, position: 12, multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 13, position: 13, multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 14, position: 14, multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 15, position: 15, multiplier: 1, is_captain: false, is_vice_captain: false },
    ],
    automatic_subs: [],
    ...overrides,
  }
}

function makeLiveStats(): Map<number, LivePlayerStats> {
  const m = new Map<number, LivePlayerStats>()
  for (let id = 1; id <= 15; id++) {
    m.set(id, makeStats({ total_points: id === 1 ? 14 : 4 }))
  }
  return m
}

function makeBootstrap(overrides: { is_current?: boolean; finished?: boolean } = {}) {
  return {
    data: {
      events: [{
        id:           38,
        is_current:   overrides.is_current ?? true,
        is_next:      false,
        finished:     overrides.finished ?? false,
        deadline_time:'2026-05-15T10:00:00Z',
        data_checked: false,
      }],
      elements: [],
      teams:    [],
    },
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('LiveGwTab', () => {
  it('T1: renders "load your squad" prompt when teamId is null', () => {
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap() as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats: null, picksData: null, isLoading: false, isError: false, refetch: vi.fn(),
    })
    render(<LiveGwTab teamId={null} />, { wrapper: makeWrapper() })
    expect(screen.getByText(/load your squad/i)).toBeInTheDocument()
  })

  it('T2: renders live total points from computed score', () => {
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap() as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats:  makeLiveStats(),
      picksData:  makePicksData(),
      isLoading:  false,
      isError:    false,
      refetch:    vi.fn(),
    })
    render(<LiveGwTab teamId={12345} />, { wrapper: makeWrapper() })
    // captain elem 1 gets ×2: 14×2=28; 10 other starters ×4=40; total = 68
    expect(screen.getByText('68')).toBeInTheDocument()
  })

  it('T3: "LIVE" badge present when GW is_current and not finished', () => {
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap({ is_current: true, finished: false }) as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats: makeLiveStats(), picksData: makePicksData(),
      isLoading: false, isError: false, refetch: vi.fn(),
    })
    render(<LiveGwTab teamId={12345} />, { wrapper: makeWrapper() })
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('T4: "Final" badge present when GW finished = true', () => {
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap({ is_current: true, finished: true }) as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats: makeLiveStats(), picksData: makePicksData(),
      isLoading: false, isError: false, refetch: vi.fn(),
    })
    render(<LiveGwTab teamId={12345} />, { wrapper: makeWrapper() })
    expect(screen.getByText('Final')).toBeInTheDocument()
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument()
  })

  it('T5: VC promotion — "VC×2" label rendered when vc_promoted', () => {
    // Captain element 1 has 0 minutes, VC element 2 plays
    const statsMap = new Map<number, LivePlayerStats>()
    for (let id = 1; id <= 15; id++) {
      statsMap.set(id, makeStats({ total_points: 6, minutes: id === 1 ? 0 : 90 }))
    }
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap() as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats: statsMap, picksData: makePicksData(),
      isLoading: false, isError: false, refetch: vi.fn(),
    })
    render(<LiveGwTab teamId={12345} />, { wrapper: makeWrapper() })
    expect(screen.getByText(/VC×2/)).toBeInTheDocument()
  })

  it('T6: auto-subs section rendered when auto_subs non-empty', () => {
    const picks = makePicksData({
      automatic_subs: [{ entry: 12345, element_in: 12, element_out: 5, event: 38 }],
    })
    const statsMap = makeLiveStats()
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap() as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats: statsMap, picksData: picks,
      isLoading: false, isError: false, refetch: vi.fn(),
    })
    render(<LiveGwTab teamId={12345} />, { wrapper: makeWrapper() })
    expect(screen.getByText(/auto.sub/i)).toBeInTheDocument()
  })

  it('T7: provisional bonus disclaimer always rendered', () => {
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap() as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats: makeLiveStats(), picksData: makePicksData(),
      isLoading: false, isError: false, refetch: vi.fn(),
    })
    render(<LiveGwTab teamId={12345} />, { wrapper: makeWrapper() })
    expect(screen.getByText(/bonus points are provisional/i)).toBeInTheDocument()
  })

  it('T8: loading state renders skeleton placeholders, no player names', () => {
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap() as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats: null, picksData: null,
      isLoading: true, isError: false, refetch: vi.fn(),
    })
    render(<LiveGwTab teamId={12345} />, { wrapper: makeWrapper() })
    // Skeleton rows present, no actual player names
    expect(screen.queryByText('Player1')).not.toBeInTheDocument()
    const skeletons = document.querySelectorAll('[data-testid="skeleton-row"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 3.2: Run tests to confirm they fail**

```
npx vitest run src/components/squad/LiveGwTab.test.tsx
```

Expected: all 8 fail with `Cannot find module './LiveGwTab'`

- [ ] **Step 3.3: Create `src/components/squad/LiveGwTab.tsx`**

```tsx
'use client'

import { useMemo } from 'react'
import { useBootstrap } from '@/lib/hooks/useBootstrap'
import { useLiveGw }    from '@/lib/hooks/useLiveGw'
import { usePlayers }   from '@/lib/hooks/usePlayers'
import { computeLiveScore } from '@/lib/live-gw'
import type { LiveXIPlayer } from '@/lib/live-gw'

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatPills({ stats }: { stats: LiveXIPlayer['stats'] }) {
  const items: string[] = []
  if (stats.goals_scored > 0)  items.push(`⚽ ×${stats.goals_scored}`)
  if (stats.assists > 0)       items.push(`🅰 ×${stats.assists}`)
  if (stats.clean_sheets > 0)  items.push('🛡 CS')
  if (stats.saves >= 3)        items.push(`🧤 ${stats.saves}`)
  if (stats.yellow_cards > 0)  items.push('🟨')
  if (stats.red_cards > 0)     items.push('🟥')
  if (items.length === 0) return null
  return (
    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
      {items.join('  ')}
    </p>
  )
}

function CaptainBadge({ player, vcPromoted }: { player: LiveXIPlayer; vcPromoted: boolean }) {
  if (player.is_captain && !vcPromoted) {
    return <span className="text-xs font-bold text-amber-500 ml-1">C×{player.multiplier}</span>
  }
  if (player.is_vice_captain && vcPromoted) {
    return (
      <>
        <span className="text-xs font-bold text-amber-500 ml-1">VC×{player.multiplier}</span>
        <span className="text-xs text-zinc-400 ml-1">(captain didn't play)</span>
      </>
    )
  }
  return null
}

function PlayerRow({ player, vcPromoted }: { player: LiveXIPlayer; vcPromoted: boolean }) {
  const muted = player.is_subbed_out
  return (
    <li className={`flex items-start justify-between py-2 ${muted ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {player.is_subbed_in && <span className="text-green-500 mr-1">↑</span>}
          {player.player_name}
          <CaptainBadge player={player} vcPromoted={vcPromoted} />
        </p>
        <StatPills stats={player.stats} />
      </div>
      <div className="ml-4 flex-shrink-0 text-right">
        <p className="text-sm font-bold tabular-nums">{player.live_points}</p>
        {player.is_subbed_out && (
          <p className="text-xs text-zinc-400">↓ subbed off</p>
        )}
      </div>
    </li>
  )
}

function SkeletonRow() {
  return (
    <li data-testid="skeleton-row" className="flex items-center justify-between py-2 animate-pulse">
      <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-32" />
      <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-8" />
    </li>
  )
}

function ChipBadge({ chip }: { chip: string | null }) {
  if (!chip) return null
  const labels: Record<string, string> = {
    bboost:     'Bench Boost',
    '3xc':      'Triple Captain',
    freehit:    'Free Hit',
  }
  return (
    <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
      {labels[chip] ?? chip}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface LiveGwTabProps {
  teamId: number | null
}

export function LiveGwTab({ teamId }: LiveGwTabProps) {
  const { data: bootstrap } = useBootstrap()
  const { data: players }   = usePlayers()

  const currentEvent = bootstrap?.events.find(e => e.is_current) ?? null
  const isLive       = currentEvent != null && !currentEvent.finished
  const currentGw    = currentEvent?.id ?? null

  const { liveStats, picksData, isLoading, isError, refetch } = useLiveGw(
    teamId,
    currentGw,
    isLive,
  )

  // Build playerNameMap from bootstrap elements or players
  const playerNameMap = useMemo(() => {
    const m = new Map<number, { web_name: string; team: number }>()
    if (bootstrap) {
      for (const el of bootstrap.elements) {
        m.set(el.id, { web_name: el.web_name, team: el.team })
      }
    }
    if (players) {
      for (const p of players) {
        m.set(p.id, { web_name: p.web_name, team: p.team })
      }
    }
    return m
  }, [bootstrap, players])

  // No team loaded
  if (!teamId) {
    return (
      <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
        <p>Load your squad to see your live score</p>
      </div>
    )
  }

  // No current GW
  if (!currentGw) {
    return (
      <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
        <p>No active gameweek — check back on a matchday</p>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="py-8 text-center space-y-3">
        <p className="text-zinc-500 dark:text-zinc-400">Couldn't load live data — will retry</p>
        <button
          onClick={refetch}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
        >
          Retry
        </button>
      </div>
    )
  }

  // Loading state
  if (isLoading || !liveStats || !picksData) {
    return (
      <div className="space-y-4 mt-4">
        <ul className="divide-y divide-border">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
        </ul>
      </div>
    )
  }

  // Compute live score
  const liveScore = computeLiveScore(
    picksData.picks,
    picksData.automatic_subs,
    picksData.active_chip,
    liveStats,
    playerNameMap,
  )

  return (
    <div className="space-y-4 mt-2">
      {/* Header card */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            GW{currentGw}
          </span>
          {isLive && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              LIVE
            </span>
          )}
          {currentEvent?.finished && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
              Final
            </span>
          )}
          <ChipBadge chip={liveScore.chip} />
        </div>
        <p className="text-4xl font-bold tabular-nums">{liveScore.total_points}</p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          ⚠ Bonus points are provisional
        </p>
      </div>

      {/* Starting XI */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
          Starting XI ({liveScore.xi.length})
        </h3>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
          {liveScore.xi.map(player => (
            <PlayerRow key={player.element} player={player} vcPromoted={liveScore.vc_promoted} />
          ))}
        </ul>
      </section>

      {/* Bench */}
      {liveScore.bench.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
            Bench
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
            {liveScore.bench.map(player => (
              <PlayerRow key={player.element} player={player} vcPromoted={liveScore.vc_promoted} />
            ))}
          </ul>
        </section>
      )}

      {/* Auto-subs log */}
      {liveScore.auto_subs.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
            Auto-subs
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
            {liveScore.auto_subs.map((sub, i) => (
              <li key={i} className="py-2 text-sm text-zinc-600 dark:text-zinc-400">
                {sub.player_out} ({sub.minutes_played_by_out} min) → {sub.player_in} (auto-sub)
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3.4: Run tests to confirm all 8 pass**

```
npx vitest run src/components/squad/LiveGwTab.test.tsx
```

Expected: 8 tests pass

- [ ] **Step 3.5: Commit**

```
git add src/components/squad/LiveGwTab.tsx src/components/squad/LiveGwTab.test.tsx
git commit -m "feat(live-01): add LiveGwTab component"
```

---

### Task 4: Wire into `page.tsx` and update nav tests

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/components/nav/MobileNav.test.tsx`

---

- [ ] **Step 4.1: Write the failing tests first**

In `src/app/page.test.tsx`, add the mock and test. Locate the existing squad mock section (after the GwReviewTab mock on line ~66) and add:

```typescript
// Add to the existing vi.mock block at the top of page.test.tsx
vi.mock('@/components/squad/LiveGwTab', () => ({
  LiveGwTab: (_props: { teamId: number | null }) => <div data-testid="live-gw-tab" />,
}))
```

Then add a new test at the end of the `describe('Phase 36: page.tsx state', ...)` block:

```typescript
it('Squad > Live sub-tab renders LiveGwTab', () => {
  const { container } = render(<Home />)
  // Navigate to Squad section
  const squadBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Squad')
  fireEvent.click(squadBtn!)
  // Navigate to Live sub-tab
  const liveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Live')
  expect(liveBtn).not.toBeUndefined()
  fireEvent.click(liveBtn!)
  expect(container.querySelector('[data-testid="live-gw-tab"]')).not.toBeNull()
})
```

In `src/components/nav/MobileNav.test.tsx`, update the Squad pill test (line 84):

Find this test:
```typescript
it('Squad active: pill row shows 5 pills Decision, Transfers, Optimiser, Lineup, Review; total 8 buttons in DOM (NAV-04 / NAV-01, updated Phase73)', () => {
```

Replace with:
```typescript
it('Squad active: pill row shows 6 pills Decision, Transfers, Optimiser, Lineup, Review, Live; total 10 buttons in DOM (NAV-04 / NAV-01, LIVE-01)', () => {
  const { container } = render(
    <MobileNav {...makeProps({ activeSection: 'squad' as Section, activeSubTab: 'transfers' as SubTab })} />,
    { wrapper: makeWrapper() }
  )
  const allButtons = Array.from(container.querySelectorAll('button'))
  // 1 ThemeToggle + 3 section buttons + 6 Squad pills (Decision/Transfers/Optimiser/Lineup/Review/Live) = 10 total
  expect(allButtons).toHaveLength(10)
  const pillButtons = allButtons.filter(b =>
    ['Decision', 'Transfers', 'Optimiser', 'Lineup', 'Review', 'Live'].includes(b.textContent ?? '')
  )
  expect(pillButtons).toHaveLength(6)
  expect(pillButtons[0].textContent).toBe('Decision')
  expect(pillButtons[1].textContent).toBe('Transfers')
  expect(pillButtons[2].textContent).toBe('Optimiser')
  expect(pillButtons[3].textContent).toBe('Lineup')
  expect(pillButtons[4].textContent).toBe('Review')
  expect(pillButtons[5].textContent).toBe('Live')
  expect(pillButtons[1].getAttribute('aria-current')).toBe('page')
})
```

- [ ] **Step 4.2: Run tests to confirm they fail**

```
npx vitest run src/app/page.test.tsx src/components/nav/MobileNav.test.tsx
```

Expected: the new `Live sub-tab renders LiveGwTab` test fails and the Squad pill count test fails.

- [ ] **Step 4.3: Update `src/app/page.tsx`**

**a) Add `'live'` to the `SubTab` union** (line 65 in current file):

Find:
```typescript
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'manual-plan' | 'route-tree' | 'club-form' | 'value-gems' | 'accuracy' | 'season' | 'window' | 'decision' | 'transfers' | 'optimiser' | 'price-reset' | 'price-changes' | 'rivals' | 'lineup' | 'review' | 'rank-sim' | 'next-season' | 'watchlist' | 'perfect-gw'
```

Replace with:
```typescript
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'manual-plan' | 'route-tree' | 'club-form' | 'value-gems' | 'accuracy' | 'season' | 'window' | 'decision' | 'transfers' | 'optimiser' | 'price-reset' | 'price-changes' | 'rivals' | 'lineup' | 'review' | 'rank-sim' | 'next-season' | 'watchlist' | 'perfect-gw' | 'live'
```

**b) Add `'live'` entry to Squad `subTabs` array** (after the `review` entry around line 109):

Find:
```typescript
      { id: 'review' as SubTab,    label: 'Review',    mobileLabel: 'Review'    },
    ],
    defaultSubTab: 'decision' as SubTab,
  },
```

Replace with:
```typescript
      { id: 'review' as SubTab,    label: 'Review',    mobileLabel: 'Review'    },
      { id: 'live' as SubTab,      label: 'Live',      mobileLabel: 'Live'      },
    ],
    defaultSubTab: 'decision' as SubTab,
  },
```

**c) Add import for `LiveGwTab`** (after the existing squad imports around line 40):

Find:
```typescript
import { GwReviewTab } from '@/components/squad/GwReviewTab'
import { DecisionSummaryTab } from '@/components/squad/DecisionSummaryTab'
```

Replace with:
```typescript
import { GwReviewTab } from '@/components/squad/GwReviewTab'
import { DecisionSummaryTab } from '@/components/squad/DecisionSummaryTab'
import { LiveGwTab } from '@/components/squad/LiveGwTab'
```

**d) Add render conditional for Live tab** (after the `review` conditional around line 291):

Find:
```typescript
        {activeSection === 'squad' && activeSubTab === 'review' && (
          <GwReviewTab teamId={submittedId ?? ''} settledGws={settledGws} />
        )}
```

Replace with:
```typescript
        {activeSection === 'squad' && activeSubTab === 'review' && (
          <GwReviewTab teamId={submittedId ?? ''} settledGws={settledGws} />
        )}
        {activeSection === 'squad' && activeSubTab === 'live' && (
          <LiveGwTab teamId={submittedId ? parseInt(submittedId, 10) : null} />
        )}
```

- [ ] **Step 4.4: Run all affected tests to confirm they pass**

```
npx vitest run src/app/page.test.tsx src/components/nav/MobileNav.test.tsx
```

Expected: all tests pass

- [ ] **Step 4.5: Run the full test suite to catch any regressions**

```
npx vitest run
```

Expected: all tests pass

- [ ] **Step 4.6: Commit**

```
git add src/app/page.tsx src/app/page.test.tsx src/components/nav/MobileNav.test.tsx
git commit -m "feat(live-01): wire LiveGwTab as 5th Squad sub-tab"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| `computeLiveScore` pure function | Task 1 |
| `LivePlayerStats`, `LiveXIPlayer`, `AutoSubEntry`, `AutoSubRecord`, `LivePicksResponse`, `LiveScore` types | Task 1 |
| `AutoSubRecordSchema`, `LivePicksResponseSchema` in `live-gw.ts` (not squad-adapter.ts) | Task 1 |
| 8 pure-function tests | Task 1 |
| `useLiveGw` hook with `useQueries`, polling at 60s, staleTime 30s | Task 2 |
| `enabled` guard: skip when `!teamId \|\| !currentGw` | Task 2 |
| `LiveGwTab` component with header card, XI, bench, auto-subs log | Task 3 |
| All 8 component states (no teamId, live total, LIVE badge, Final badge, VC promotion, auto-subs, provisional disclaimer, loading skeleton) | Task 3 |
| 5th Squad sub-tab wired in `page.tsx` | Task 4 |
| `MobileNav.test.tsx` updated pill count | Task 4 |
| `page.test.tsx` mock + Live sub-tab nav test | Task 4 |

All spec sections covered. ✓

**Placeholder scan:** No TBD, TODO, or vague steps. All code blocks are complete. ✓

**Type consistency:**
- `AutoSubRecord` defined in Task 1, imported in Task 1 tests ✓
- `LivePicksResponse` defined in Task 1, used in Task 2 and Task 3 ✓
- `LivePlayerStats` defined in Task 1, used throughout ✓
- `useLiveGw` return type matches usage in `LiveGwTab` ✓
- `LiveGwTab` props `{ teamId: number | null }` consistent across all usages ✓
- `submittedId` in `page.tsx` is `string | null`; converted with `parseInt` before passing to `LiveGwTab` ✓
