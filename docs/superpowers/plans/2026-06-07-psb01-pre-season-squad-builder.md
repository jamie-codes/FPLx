# PSB-01 Pre-Season Squad Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Next Season tab with a three-archetype squad comparison (Premium Spine, Balanced, Value) so managers can compare GW1 squad structures once FPL publishes 2026/27 prices.

**Architecture:** The pre-season infrastructure (Phases 126–129) is already fully in place: `/api/pre-season-squad`, `usePreSeasonSquad`, `usePreSeasonActive`, `buildPreSeasonSquad`, and `NextSeasonPlannerTab`. This plan adds anchor support to `buildPreSeasonSquad`, a new `buildPreSeasonArchetypes()` function, and a three-column comparison section inside the existing `NextSeasonPlannerTab`. No new API routes, no new page-level tabs, no changes to `OptimiserPanel`.

**Tech Stack:** TypeScript, Vitest, React (client component), TanStack Query (existing hooks), Tailwind CSS.

---

## Design deviation: GW horizon slider

The approved spec called for a GW1–N horizon slider scoring archetypes by `xPts_Ngw`. This is deferred because `xPts_1gw` / `xPts_3gw` / `xPts_5gw` data only exists in `players.json` once the pipeline runs against 2026/27 fixtures — which doesn't happen until August. Pre-season data is last-season `total_points` / `ppm` from `season_archive_gw38.json`.

**What's implemented instead:** Captain options ranked by `total_points` (last season) — a valid proxy for player quality. The horizon slider is a natural follow-up once `players.json` is populated with 2026/27 xPts data.

---

## Codebase orientation (read before starting)

These files are the foundation — read them before writing code:

| File | Why |
|---|---|
| `src/lib/pre-season-squad.ts` | Contains `buildPreSeasonSquad` — you will add anchor support here |
| `src/lib/pre-season-squad.test.ts` | Existing tests — add anchor tests here |
| `src/lib/types.ts` (lines 1113–1172) | `PreSeasonPlayer`, `PreSeasonSquad`, `PreSeasonSquadInputs` types |
| `src/components/next-season/NextSeasonPlannerTab.tsx` | The tab you will extend |
| `src/lib/anchored-squad.ts` | Reference for how anchors are pre-seated — replicate the pattern |

---

## File map

| Action | File | What changes |
|---|---|---|
| Modify | `src/lib/pre-season-squad.ts` | Add optional `anchorIds` param; pre-seat logic before greedy fill |
| Modify | `src/lib/pre-season-squad.test.ts` | Add anchor behaviour tests |
| Create | `src/lib/pre-season-archetypes.ts` | `ArchetypeLabel`, `ArchetypeSquad`, `buildPreSeasonArchetypes()` |
| Create | `src/lib/pre-season-archetypes.test.ts` | Unit tests for the three archetype builders |
| Modify | `src/components/next-season/NextSeasonPlannerTab.tsx` | Add "Squad Archetypes" section |
| Modify | `src/components/next-season/NextSeasonPlannerTab.test.tsx` | Add archetype rendering tests |

---

## Task 1: Add anchor support to `buildPreSeasonSquad`

**Files:**
- Modify: `src/lib/pre-season-squad.ts`
- Modify: `src/lib/pre-season-squad.test.ts`

- [ ] **Step 1: Write the failing anchor tests**

Add these tests to `src/lib/pre-season-squad.test.ts` after the existing `describe('buildPreSeasonSquad', ...)` block. The `makePool` and `makePreSeasonPlayer` helpers are already in the file — reuse them.

```typescript
describe('buildPreSeasonSquad — anchor support', () => {
  it('seats an anchor player regardless of ppm rank', () => {
    const players = makePool()
    // Assign a very LOW ppm to player id=5 (a DEF) so greedy would skip it
    const lowPpmPlayer = players.find(p => p.id === 5)!
    lowPpmPlayer.ppm = 0.01
    const scoreMap = new Map<number, number>(players.map(p => [p.id, p.ppm]))

    const withoutAnchor = buildPreSeasonSquad(players, scoreMap, 1000, 3, [])
    const withAnchor    = buildPreSeasonSquad(players, scoreMap, 1000, 3, [5])

    // Without anchor: player 5 (lowest ppm DEF) likely NOT in squad
    // With anchor: player 5 MUST be in squad
    const withoutIds = new Set([
      ...(withoutAnchor?.starters.map(p => p.id) ?? []),
      ...(withoutAnchor?.bench.map(p => p.id)    ?? []),
    ])
    const withIds = new Set([
      ...(withAnchor?.starters.map(p => p.id) ?? []),
      ...(withAnchor?.bench.map(p => p.id)    ?? []),
    ])
    expect(withoutIds.has(5)).toBe(false)
    expect(withIds.has(5)).toBe(true)
  })

  it('empty anchorIds produces same result as calling without anchorIds', () => {
    const players = makePool()
    const scoreMap = new Map<number, number>(players.map(p => [p.id, p.ppm]))
    const noParam  = buildPreSeasonSquad(players, scoreMap, 1000)
    const emptyArr = buildPreSeasonSquad(players, scoreMap, 1000, 3, [])
    expect(noParam?.starters.map(p => p.id)).toEqual(emptyArr?.starters.map(p => p.id))
    expect(noParam?.bench.map(p => p.id)).toEqual(emptyArr?.bench.map(p => p.id))
  })

  it('silently skips an anchor that violates position_cap (MAX_SLOTS)', () => {
    const players = makePool()
    const scoreMap = new Map<number, number>(players.map(p => [p.id, p.ppm]))
    // GK ids from makePool are 1,2,3,4 — anchor 3 GKs (MAX_SLOTS[1]=2, so id=3 should be skipped)
    const result = buildPreSeasonSquad(players, scoreMap, 1000, 3, [1, 2, 3])
    expect(result).not.toBeNull()
    const allIds = new Set([
      ...(result?.starters.map(p => p.id) ?? []),
      ...(result?.bench.map(p => p.id)    ?? []),
    ])
    // id=1 and id=2 present (2 GK slots filled), id=3 skipped
    expect(allIds.has(1)).toBe(true)
    expect(allIds.has(2)).toBe(true)
    expect(allIds.has(3)).toBe(false)
    expect(result?.starters.length).toBe(11)
    expect(result?.bench.length).toBe(4)
  })

  it('silently skips an anchor not present in scoreMap', () => {
    const players = makePool()
    const scoreMap = new Map<number, number>(players.map(p => [p.id, p.ppm]))
    // anchorId 9999 does not exist
    const result = buildPreSeasonSquad(players, scoreMap, 1000, 3, [9999])
    expect(result).not.toBeNull()
    expect(result?.starters.length).toBe(11)
    expect(result?.bench.length).toBe(4)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx vitest run src/lib/pre-season-squad.test.ts
```

Expected: 4 new tests FAIL (TypeError or assertion errors). The existing tests still pass.

- [ ] **Step 3: Add anchor support to `buildPreSeasonSquad`**

Replace the `export function buildPreSeasonSquad(` signature and the greedy fill section in `src/lib/pre-season-squad.ts`. The complete updated function:

```typescript
export function buildPreSeasonSquad(
  players: PreSeasonPlayer[],
  scoreMap: Map<number, number>,
  budget = 1000,
  teamCap = 3,
  anchorIds: number[] = [],   // pre-seat these players before greedy fill
): PreSeasonSquad | null {
  // Eligibility: present in scoreMap only (D-02 — no status check)
  const eligible = players.filter(p => scoreMap.has(p.id))
  const playerMap = new Map<number, PreSeasonPlayer>(eligible.map(p => [p.id, p]))

  const filledSlots: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const teamCount = new Map<number, number>()
  const squad: PreSeasonPlayer[] = []
  let runningCost = 0
  const seatedIds = new Set<number>()

  // Step 1: Pre-seat anchor players in order. Skip silently on any violation.
  for (const anchorId of anchorIds) {
    if (seatedIds.has(anchorId)) continue           // duplicate
    const player = playerMap.get(anchorId)
    if (!player) continue                           // not in scoreMap / pool
    const pos = player.element_type
    if ((filledSlots[pos] ?? 0) >= MAX_SLOTS[pos]) continue   // position_cap
    if ((teamCount.get(player.team) ?? 0) >= teamCap) continue // team_cap
    if (runningCost + player.now_cost > budget) continue       // over_budget
    squad.push(player)
    filledSlots[pos] = (filledSlots[pos] ?? 0) + 1
    teamCount.set(player.team, (teamCount.get(player.team) ?? 0) + 1)
    runningCost += player.now_cost
    seatedIds.add(anchorId)
  }

  // Step 2: Greedy fill — sort eligible non-seated players by score desc, cost asc
  const remaining = eligible
    .filter(p => !seatedIds.has(p.id))
    .sort((a, b) => {
      const diff = (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0)
      return diff !== 0 ? diff : a.now_cost - b.now_cost
    })

  for (const player of remaining) {
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

  // Return null if squad is incomplete or any MIN_SLOTS position unmet
  if (squad.length < 15) return null
  for (const pos of [1, 2, 3, 4] as const) {
    if ((filledSlots[pos] ?? 0) < MIN_SLOTS[pos]) return null
  }

  // Derive starters (11) and bench (4) via greedy formation selection.
  // 1. Pick starter GK: the GK with higher score (scoreMap value)
  const gks = squad.filter(p => p.element_type === 1)
  const outfield = squad.filter(p => p.element_type !== 1)

  const gksSorted = [...gks].sort(
    (a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0),
  )
  const starterGk = gksSorted[0]
  const benchGk = gksSorted[1]

  // 2. Fill 10 outfield starter slots greedily by score desc
  const outfieldSorted = [...outfield].sort(
    (a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0),
  )

  const OUTFIELD_MIN: Record<number, number> = { 2: 3, 3: 2, 4: 1 }
  const OUTFIELD_MAX: Record<number, number> = { 2: 5, 3: 5, 4: 3 }
  const starterOutfield: PreSeasonPlayer[] = []
  const outfieldFilled: Record<number, number> = { 2: 0, 3: 0, 4: 0 }

  // First pass: fill minimums
  for (const pos of [2, 3, 4] as const) {
    const forPos = outfieldSorted.filter(
      p => p.element_type === pos && !starterOutfield.includes(p),
    )
    const toAdd = forPos.slice(0, OUTFIELD_MIN[pos])
    for (const p of toAdd) {
      starterOutfield.push(p)
      outfieldFilled[pos]++
    }
  }

  // Second pass: fill remaining slots by score desc
  const remainingOutfield = outfieldSorted.filter(p => !starterOutfield.includes(p))
  for (const p of remainingOutfield) {
    if (starterOutfield.length >= 10) break
    const pos = p.element_type
    if ((outfieldFilled[pos] ?? 0) >= OUTFIELD_MAX[pos]) continue
    starterOutfield.push(p)
    outfieldFilled[pos]++
  }

  const starters = [starterGk, ...starterOutfield]
  const starterIds = new Set(starters.map(p => p.id))

  const benchOutfield = squad
    .filter(p => !starterIds.has(p.id) && p.element_type !== 1)
    .sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0))
  const bench = [benchGk, ...benchOutfield]

  const defCount = starters.filter(p => p.element_type === 2).length
  const midCount = starters.filter(p => p.element_type === 3).length
  const fwdCount = starters.filter(p => p.element_type === 4).length
  const formation = `${defCount}-${midCount}-${fwdCount}`

  return { starters, bench, formation, budgetUsed: runningCost }
}
```

Note: also add `const playerMap` import note — `playerMap` is used in the anchor step. Add it right after the `eligible` filter line.

- [ ] **Step 4: Run tests to confirm they pass**

```
npx vitest run src/lib/pre-season-squad.test.ts
```

Expected: ALL tests pass (existing + 4 new).

- [ ] **Step 5: Commit**

```
git add src/lib/pre-season-squad.ts src/lib/pre-season-squad.test.ts
git commit -m "feat(psb-01): add anchorIds support to buildPreSeasonSquad"
```

---

## Task 2: Create `buildPreSeasonArchetypes`

**Files:**
- Create: `src/lib/pre-season-archetypes.ts`
- Create: `src/lib/pre-season-archetypes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/pre-season-archetypes.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildPreSeasonArchetypes } from './pre-season-archetypes'
import type { PreSeasonPlayer } from './types'

function makePlayer(overrides: {
  id: number
  element_type: 1 | 2 | 3 | 4
  team?: number
  now_cost?: number
  total_points?: number
  ppm?: number
}): PreSeasonPlayer {
  return {
    id: overrides.id,
    web_name: `P${overrides.id}`,
    element_type: overrides.element_type,
    team: overrides.team ?? overrides.id,
    team_short_name: `T${overrides.team ?? overrides.id}`,
    now_cost: overrides.now_cost ?? 50,
    total_points: overrides.total_points ?? 100,
    ppm: overrides.ppm ?? 0.5,
  }
}

function makePool(): PreSeasonPlayer[] {
  const pool: PreSeasonPlayer[] = []
  // 4 GKs (team ids spread to avoid 3-per-club cap issues)
  for (let i = 1; i <= 4; i++) pool.push(makePlayer({ id: i, element_type: 1, team: i, total_points: 100 + i }))
  // 10 DEFs
  for (let i = 5; i <= 14; i++) pool.push(makePlayer({ id: i, element_type: 2, team: i, total_points: 100 + i }))
  // 10 MIDs
  for (let i = 15; i <= 24; i++) pool.push(makePlayer({ id: i, element_type: 3, team: i, total_points: 100 + i }))
  // 6 FWDs — give FWDs very high total_points to test Premium Spine selection
  for (let i = 25; i <= 30; i++) pool.push(makePlayer({ id: i, element_type: 4, team: i, total_points: 300 + i }))
  return pool
}

describe('buildPreSeasonArchetypes', () => {
  it('returns exactly 3 archetypes', () => {
    const players = makePool()
    const scoreMap = new Map<number, number>(players.map(p => [p.id, p.ppm]))
    const results = buildPreSeasonArchetypes(players, scoreMap)
    expect(results).toHaveLength(3)
    expect(results.map(r => r.label)).toEqual(['Premium Spine', 'Balanced', 'Value'])
  })

  it('each archetype squad has 15 players within budget', () => {
    const players = makePool()
    const scoreMap = new Map<number, number>(players.map(p => [p.id, p.ppm]))
    const results = buildPreSeasonArchetypes(players, scoreMap)
    for (const r of results) {
      expect(r.squad).not.toBeNull()
      const all = [...r.squad!.starters, ...r.squad!.bench]
      expect(all.length).toBe(15)
      expect(r.squad!.budgetUsed).toBeLessThanOrEqual(1000)
    }
  })

  it('Premium Spine squad contains both top-2 total_points players', () => {
    const players = makePool()
    const scoreMap = new Map<number, number>(players.map(p => [p.id, p.ppm]))
    const results = buildPreSeasonArchetypes(players, scoreMap)
    const premiumResult = results.find(r => r.label === 'Premium Spine')!

    // FWDs 29 and 30 have the highest total_points (329, 330)
    const allIds = new Set([
      ...premiumResult.squad!.starters.map(p => p.id),
      ...premiumResult.squad!.bench.map(p => p.id),
    ])
    expect(allIds.has(29)).toBe(true)
    expect(allIds.has(30)).toBe(true)
  })

  it('Balanced squad contains the top total_points player for each position', () => {
    const players = makePool()
    const scoreMap = new Map<number, number>(players.map(p => [p.id, p.ppm]))
    const results = buildPreSeasonArchetypes(players, scoreMap)
    const balanced = results.find(r => r.label === 'Balanced')!
    const allIds = new Set([
      ...balanced.squad!.starters.map(p => p.id),
      ...balanced.squad!.bench.map(p => p.id),
    ])

    // Top GK by total_points is id=4 (total_points=104)
    expect(allIds.has(4)).toBe(true)
    // Top DEF by total_points is id=14 (total_points=114)
    expect(allIds.has(14)).toBe(true)
    // Top MID by total_points is id=24 (total_points=124)
    expect(allIds.has(24)).toBe(true)
    // Top FWD by total_points is id=30 (total_points=330)
    expect(allIds.has(30)).toBe(true)
  })

  it('topCaptains contains at most 3 entries from starters only', () => {
    const players = makePool()
    const scoreMap = new Map<number, number>(players.map(p => [p.id, p.ppm]))
    const results = buildPreSeasonArchetypes(players, scoreMap)
    for (const r of results) {
      expect(r.topCaptains.length).toBeLessThanOrEqual(3)
      // All captain ids must be in starters
      const starterIds = new Set(r.squad!.starters.map(p => p.id))
      for (const c of r.topCaptains) {
        expect(starterIds.has(c.id)).toBe(true)
      }
    }
  })

  it('all archetypes enforce 3-per-club cap', () => {
    const players = makePool()
    const scoreMap = new Map<number, number>(players.map(p => [p.id, p.ppm]))
    const results = buildPreSeasonArchetypes(players, scoreMap)
    for (const r of results) {
      const all = [...r.squad!.starters, ...r.squad!.bench]
      const teamCounts = new Map<number, number>()
      for (const p of all) {
        teamCounts.set(p.team, (teamCounts.get(p.team) ?? 0) + 1)
      }
      for (const [, count] of teamCounts) {
        expect(count).toBeLessThanOrEqual(3)
      }
    }
  })

  it('returns null squad entries gracefully when budget too tight', () => {
    const players = makePool()
    // Give all players cost 200 so no 15-player squad fits in budget=1000
    players.forEach(p => { p.now_cost = 200 })
    const scoreMap = new Map<number, number>(players.map(p => [p.id, p.ppm]))
    const results = buildPreSeasonArchetypes(players, scoreMap, 1000)
    // At least some (probably all) archetypes should have squad=null
    // (we only assert the shape is correct, not that all are null — budget sensitivity varies)
    expect(results).toHaveLength(3)
    for (const r of results) {
      expect(r.topCaptains).toEqual([])  // null squad → empty captains
    }
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx vitest run src/lib/pre-season-archetypes.test.ts
```

Expected: FAIL with "Cannot find module './pre-season-archetypes'".

- [ ] **Step 3: Create `src/lib/pre-season-archetypes.ts`**

```typescript
// PSB-01: Three-archetype pre-season squad builder.
// No 'use client', no React, no side effects. @vitest-environment node tests.
import type { PreSeasonPlayer, PreSeasonSquad } from './types'
import { buildPreSeasonSquad } from './pre-season-squad'

export type ArchetypeLabel = 'Premium Spine' | 'Balanced' | 'Value'

export interface ArchetypeSquad {
  label: ArchetypeLabel
  squad: PreSeasonSquad | null
  /** Top-3 starters by total_points descending — empty when squad is null */
  topCaptains: Pick<PreSeasonPlayer, 'id' | 'web_name' | 'element_type' | 'total_points'>[]
}

/**
 * buildPreSeasonArchetypes: returns three squad archetypes for GW1 planning.
 *
 * Archetypes:
 *   Premium Spine — anchors the 2 highest total_points players in the eligible pool.
 *   Balanced      — anchors the top total_points player at each position (GK, DEF, MID, FWD).
 *   Value         — no anchors; pure ppm-per-£ greedy (same as default buildPreSeasonSquad).
 *
 * All three respect the same 3-per-club cap and 100m budget.
 * Scoring for topCaptains uses total_points from last season (ppm proxy for quality).
 * When buildPreSeasonSquad returns null for an archetype, squad is null and topCaptains is [].
 */
export function buildPreSeasonArchetypes(
  players: PreSeasonPlayer[],
  scoreMap: Map<number, number>,
  budget = 1000,
): ArchetypeSquad[] {
  const eligible = players.filter(p => scoreMap.has(p.id))

  // --- Premium Spine: top-2 by total_points ---
  const byPoints = [...eligible].sort((a, b) => b.total_points - a.total_points)
  const premiumAnchorIds = byPoints.slice(0, 2).map(p => p.id)

  // --- Balanced: best total_points player per position ---
  const balancedAnchorIds: number[] = []
  for (const pos of [1, 2, 3, 4] as const) {
    const topForPos = eligible
      .filter(p => p.element_type === pos)
      .sort((a, b) => b.total_points - a.total_points)[0]
    if (topForPos) balancedAnchorIds.push(topForPos.id)
  }

  // --- Build all three squads ---
  const archetypeConfigs: Array<{ label: ArchetypeLabel; anchorIds: number[] }> = [
    { label: 'Premium Spine', anchorIds: premiumAnchorIds },
    { label: 'Balanced',      anchorIds: balancedAnchorIds },
    { label: 'Value',         anchorIds: [] },
  ]

  return archetypeConfigs.map(({ label, anchorIds }) => {
    const squad = buildPreSeasonSquad(players, scoreMap, budget, 3, anchorIds)
    const topCaptains = squad === null
      ? []
      : [...squad.starters]
          .sort((a, b) => b.total_points - a.total_points)
          .slice(0, 3)
          .map(p => ({
            id: p.id,
            web_name: p.web_name,
            element_type: p.element_type,
            total_points: p.total_points,
          }))
    return { label, squad, topCaptains }
  })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npx vitest run src/lib/pre-season-archetypes.test.ts
```

Expected: ALL 6 tests PASS.

- [ ] **Step 5: Commit**

```
git add src/lib/pre-season-archetypes.ts src/lib/pre-season-archetypes.test.ts
git commit -m "feat(psb-01): buildPreSeasonArchetypes — Premium Spine, Balanced, Value"
```

---

## Task 3: Extend `NextSeasonPlannerTab` with archetype comparison

**Files:**
- Modify: `src/components/next-season/NextSeasonPlannerTab.tsx`
- Modify: `src/components/next-season/NextSeasonPlannerTab.test.tsx`

- [ ] **Step 1: Write the failing UI tests**

Read `src/components/next-season/NextSeasonPlannerTab.test.tsx` first to understand the existing mock pattern. Then add these tests after the existing `describe` block:

```typescript
describe('NextSeasonPlannerTab — archetype section', () => {
  it('renders three archetype cards when inputs are present', async () => {
    // Minimal valid PreSeasonPlayer pool for archetypes (must fit 15 in £100m)
    const mockPlayers: PreSeasonPlayer[] = [
      // 4 GKs
      ...([1,2,3,4] as const).map(id => ({
        id, web_name: `GK${id}`, element_type: 1 as const, team: id, team_short_name: `T${id}`,
        now_cost: 45, total_points: 100 + id, ppm: 0.5,
      })),
      // 10 DEFs
      ...([5,6,7,8,9,10,11,12,13,14] as const).map(id => ({
        id, web_name: `D${id}`, element_type: 2 as const, team: id, team_short_name: `T${id}`,
        now_cost: 50, total_points: 100 + id, ppm: 0.4,
      })),
      // 10 MIDs
      ...([15,16,17,18,19,20,21,22,23,24] as const).map(id => ({
        id, web_name: `M${id}`, element_type: 3 as const, team: id, team_short_name: `T${id}`,
        now_cost: 55, total_points: 100 + id, ppm: 0.5,
      })),
      // 6 FWDs
      ...([25,26,27,28,29,30] as const).map(id => ({
        id, web_name: `F${id}`, element_type: 4 as const, team: id, team_short_name: `T${id}`,
        now_cost: 60, total_points: 150 + id, ppm: 0.6,
      })),
    ]
    const mockScoreMap: Record<string, number> = Object.fromEntries(
      mockPlayers.map(p => [String(p.id), p.ppm])
    )

    // Mock /api/pre-season-squad with inputs envelope
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/api/pre-season-squad')) {
        return Promise.resolve(new Response(JSON.stringify({
          squad: {
            starters: mockPlayers.slice(0, 11),
            bench: mockPlayers.slice(11, 15),
            formation: '4-3-3',
            budgetUsed: 800,
          },
          health: null,
          solver: 'greedy',
          inputs: { players: mockPlayers, scoreMap: mockScoreMap, budget_default: 1000 },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      }
      if (String(url).includes('/api/pre-season-active')) {
        return Promise.resolve(new Response(JSON.stringify({
          activated_at: '2026-08-01T00:00:00Z', season_id: '2627',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      }
      return Promise.resolve(new Response('{}', { status: 404 }))
    }) as typeof fetch

    const { getAllByTestId } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NextSeasonPlannerTab />
      </QueryClientProvider>
    )

    await waitFor(() => {
      const cards = getAllByTestId('archetype-card')
      expect(cards).toHaveLength(3)
    })
  })

  it('does not render archetype section when inputs are absent', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/api/pre-season-squad')) {
        return Promise.resolve(new Response(JSON.stringify({
          squad: null, health: null, solver: null,
          // No inputs key
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      }
      return Promise.resolve(new Response('{}', { status: 404 }))
    }) as typeof fetch

    const { queryAllByTestId } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NextSeasonPlannerTab />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(queryAllByTestId('archetype-card')).toHaveLength(0)
    })
  })
})
```

Note: `PreSeasonPlayer` type must be imported at the top of the test file.

- [ ] **Step 2: Run tests to confirm they fail**

```
npx vitest run src/components/next-season/NextSeasonPlannerTab.test.tsx
```

Expected: 2 new tests FAIL (archetype-card testid not found). Existing tests still pass.

- [ ] **Step 3: Add archetype imports and `ArchetypeCard` component to `NextSeasonPlannerTab.tsx`**

Add the following import at the top of `src/components/next-season/NextSeasonPlannerTab.tsx`, after existing imports:

```typescript
import { buildPreSeasonArchetypes } from '@/lib/pre-season-archetypes'
import type { ArchetypeSquad } from '@/lib/pre-season-archetypes'
```

Add the `ArchetypeCard` component inside the file (before `NextSeasonPlannerTab`):

```typescript
// ---------------------------------------------------------------------------
// ArchetypeCard — renders one of the three pre-season squad archetypes
// ---------------------------------------------------------------------------
function ArchetypeCard({ archetype }: { archetype: ArchetypeSquad }) {
  const { label, squad, topCaptains } = archetype
  const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
  const POSITION_ORDER = [1, 2, 3, 4] as const

  return (
    <div
      className="rounded border border-zinc-200 dark:border-zinc-700 p-4 space-y-3"
      data-testid="archetype-card"
    >
      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</h4>

      {squad === null ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Could not build squad — try adjusting the budget.
        </p>
      ) : (
        <>
          {/* Budget + formation headline */}
          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex flex-wrap gap-2">
            <span><span className="font-semibold">Formation:</span> {squad.formation}</span>
            <span>│</span>
            <span><span className="font-semibold">Cost:</span> £{(squad.budgetUsed / 10).toFixed(1)}m</span>
          </div>

          {/* Captain candidates */}
          {topCaptains.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase text-zinc-400 dark:text-zinc-500 mb-1">
                Captain options
              </p>
              {topCaptains.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between text-xs py-0.5">
                  <span className={i === 0 ? 'font-semibold text-zinc-800 dark:text-zinc-200' : 'text-zinc-600 dark:text-zinc-400'}>
                    {c.web_name}
                  </span>
                  <span className="text-zinc-400 dark:text-zinc-500">{c.total_points}pts</span>
                </div>
              ))}
            </div>
          )}

          {/* Squad rows by position */}
          {POSITION_ORDER.map(pos => {
            const group = [...squad.starters, ...squad.bench].filter(p => p.element_type === pos)
            const starterIds = new Set(squad.starters.map(p => p.id))
            if (group.length === 0) return null
            return (
              <div key={pos}>
                <p className="text-[10px] font-semibold uppercase text-zinc-400 dark:text-zinc-500 mb-0.5">
                  {POSITION_LABELS[pos]}
                </p>
                {group.map(p => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between text-xs py-0.5 border-b border-zinc-100 dark:border-zinc-800 ${!starterIds.has(p.id) ? 'opacity-50' : ''}`}
                  >
                    <span className="text-zinc-700 dark:text-zinc-300 truncate">{p.web_name}</span>
                    <span className="text-zinc-400 dark:text-zinc-500 shrink-0 ml-2">
                      {p.team_short_name} £{(p.now_cost / 10).toFixed(1)}m
                    </span>
                  </div>
                ))}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add the archetype section inside `NextSeasonPlannerTab`'s return JSX**

In the `return (...)` of `NextSeasonPlannerTab`, after the closing `</div>` of the "Section A: Pre-Season Squad" block and before the "Section B: GW1-8 FDR Heatmap" block, add:

```tsx
{/* Section A2: Squad Archetypes — only when inputs and a valid squad are available */}
{data?.inputs && squad !== null && (() => {
  const scoreMapHydratedLocal = new Map<number, number>(
    Object.entries(data.inputs.scoreMap).map(([k, v]) => [Number(k), v])
  )
  const archetypes = buildPreSeasonArchetypes(
    data.inputs.players,
    scoreMapHydratedLocal,
    data.inputs.budget_default,
  )
  return (
    <div>
      <h3 className="text-xl font-semibold mb-3">Squad Archetypes</h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
        Three squad structures built from the same £{(data.inputs.budget_default / 10).toFixed(0)}m budget.
        Captain options ranked by last-season points.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {archetypes.map(archetype => (
          <ArchetypeCard key={archetype.label} archetype={archetype} />
        ))}
      </div>
    </div>
  )
})()}
```

**Important:** `buildPreSeasonArchetypes` is a pure function — it can be called directly in the render path since it runs synchronously. Do NOT call it inside a `useMemo` if it is placed in the render body like this; the IIFE pattern above keeps it self-contained. If you prefer a `useMemo`, place the call before the `return` statement and remove the IIFE — either approach is acceptable.

Note: `scoreMapHydratedLocal` duplicates the hydration already done for `clientSquad` earlier in the component. To avoid redundancy, replace the IIFE with a `useMemo` at the top of `NextSeasonPlannerTab` that reuses `scoreMapHydrated` (already declared earlier in the component):

```typescript
// Add after the existing scoreMapHydrated useMemo
const archetypes = useMemo(() => {
  if (!data?.inputs || !scoreMapHydrated || squad === null) return null
  return buildPreSeasonArchetypes(
    data.inputs.players,
    scoreMapHydrated,
    data.inputs.budget_default,
  )
}, [data?.inputs, scoreMapHydrated, squad])
```

Then in JSX, replace the IIFE with:

```tsx
{archetypes && (
  <div>
    <h3 className="text-xl font-semibold mb-3">Squad Archetypes</h3>
    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
      Three squad structures built from the same £{(data!.inputs!.budget_default / 10).toFixed(0)}m budget.
      Captain options ranked by last-season points.
    </p>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {archetypes.map(archetype => (
        <ArchetypeCard key={archetype.label} archetype={archetype} />
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 5: Run tests to confirm they pass**

```
npx vitest run src/components/next-season/NextSeasonPlannerTab.test.tsx
```

Expected: ALL tests pass (existing + 2 new).

- [ ] **Step 6: Run full test suite**

```
npx vitest run
```

Expected: ALL tests pass.

- [ ] **Step 7: Commit**

```
git add src/components/next-season/NextSeasonPlannerTab.tsx src/components/next-season/NextSeasonPlannerTab.test.tsx
git commit -m "feat(psb-01): add three-archetype comparison to NextSeasonPlannerTab"
```

---

## Self-review checklist (for implementer)

Before marking all tasks complete, verify:

- [ ] `buildPreSeasonSquad` with `anchorIds=[]` produces identical results to no `anchorIds` param (backward compat)
- [ ] `buildPreSeasonArchetypes` returns exactly 3 entries, always in order: Premium Spine → Balanced → Value
- [ ] `ArchetypeCard` renders `data-testid="archetype-card"` on the outer div
- [ ] The archetype section is only rendered when `data?.inputs` is non-null AND `squad !== null`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Full test suite green: `npx vitest run`
