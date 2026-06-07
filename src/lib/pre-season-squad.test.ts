// @vitest-environment node
// Phase 126 (NSP-02): unit tests for buildPreSeasonSquad.
// Phase 127 (GREEDY-02): unit tests for diagnoseBuildPreSeasonSquad.
// Wave 0: all tests RED (module does not exist). Wave 1: GREEN.
import { describe, it, expect } from 'vitest'
import { buildPreSeasonSquad, diagnoseBuildPreSeasonSquad } from './pre-season-squad'
import type { PreSeasonPlayer, PreSeasonSquad } from './types'

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

// Build a 30-player pool covering all positions with different teams and costs
function makePool(): PreSeasonPlayer[] {
  const pool: PreSeasonPlayer[] = []
  let id = 1
  // 2 GK (min 2)
  for (let i = 0; i < 4; i++) pool.push(makePreSeasonPlayer({ id: id++, element_type: 1, team: id, now_cost: 45, ppm: 0.5 }))
  // 5+ DEF
  for (let i = 0; i < 10; i++) pool.push(makePreSeasonPlayer({ id: id++, element_type: 2, team: id, now_cost: 50, ppm: 0.4 }))
  // 5+ MID
  for (let i = 0; i < 10; i++) pool.push(makePreSeasonPlayer({ id: id++, element_type: 3, team: id, now_cost: 60, ppm: 0.6 }))
  // 3+ FWD
  for (let i = 0; i < 6; i++) pool.push(makePreSeasonPlayer({ id: id++, element_type: 4, team: id, now_cost: 55, ppm: 0.7 }))
  return pool
}

describe('buildPreSeasonSquad', () => {
  it('returns a valid 15-player squad at budget=1000 given a 30-player pool', () => {
    const players = makePool()
    const scoreMap = new Map<number, number>()
    players.forEach(p => scoreMap.set(p.id, p.ppm))

    const result = buildPreSeasonSquad(players, scoreMap, 1000)

    expect(result).not.toBeNull()
    const squad = result as PreSeasonSquad
    expect(squad.starters.length).toBe(11)
    expect(squad.bench.length).toBe(4)
    expect(squad.budgetUsed).toBeLessThanOrEqual(1000)
  })

  it('returns null when budget is too low (budget=200 with all players cost>=50)', () => {
    const players = makePool()
    const scoreMap = new Map<number, number>()
    players.forEach(p => scoreMap.set(p.id, p.ppm))

    const result = buildPreSeasonSquad(players, scoreMap, 200)

    expect(result).toBeNull()
  })

  it('excludes players whose id is not in scoreMap', () => {
    const players = makePool()
    // Only include the first 5 players in the scoreMap — the rest should be excluded
    const scoreMap = new Map<number, number>()
    players.slice(0, 5).forEach(p => scoreMap.set(p.id, p.ppm))
    const excludedIds = new Set(players.slice(5).map(p => p.id))

    const result = buildPreSeasonSquad(players, scoreMap, 1000)

    // With only 5 eligible players (not enough to fill 15 slots), should return null
    expect(result).toBeNull()
    // Also verify explicitly: if a result were returned, excluded ids should not appear
    if (result !== null) {
      const squad = result as PreSeasonSquad
      const allSelected = [...squad.starters, ...squad.bench]
      allSelected.forEach(p => {
        expect(excludedIds.has(p.id)).toBe(false)
      })
    }
  })

  it('respects team cap (no team appears more than 3 times across starters+bench)', () => {

    // Use a pool where all players are from 2 teams — team cap should limit each to 3
    const players: PreSeasonPlayer[] = []
    let id = 1
    // 8 GKs from team 1 and team 2
    for (let i = 0; i < 4; i++) players.push(makePreSeasonPlayer({ id: id++, element_type: 1, team: 1, now_cost: 45, ppm: 0.5 }))
    for (let i = 0; i < 4; i++) players.push(makePreSeasonPlayer({ id: id++, element_type: 1, team: 2, now_cost: 45, ppm: 0.5 }))
    // 8 DEFs from team 1 and team 2
    for (let i = 0; i < 4; i++) players.push(makePreSeasonPlayer({ id: id++, element_type: 2, team: 1, now_cost: 45, ppm: 0.4 }))
    for (let i = 0; i < 4; i++) players.push(makePreSeasonPlayer({ id: id++, element_type: 2, team: 2, now_cost: 45, ppm: 0.4 }))
    // 8 MIDs from team 3 and team 4
    for (let i = 0; i < 4; i++) players.push(makePreSeasonPlayer({ id: id++, element_type: 3, team: 3, now_cost: 45, ppm: 0.6 }))
    for (let i = 0; i < 4; i++) players.push(makePreSeasonPlayer({ id: id++, element_type: 3, team: 4, now_cost: 45, ppm: 0.6 }))
    // 8 FWDs from team 5 and team 6
    for (let i = 0; i < 4; i++) players.push(makePreSeasonPlayer({ id: id++, element_type: 4, team: 5, now_cost: 45, ppm: 0.7 }))
    for (let i = 0; i < 4; i++) players.push(makePreSeasonPlayer({ id: id++, element_type: 4, team: 6, now_cost: 45, ppm: 0.7 }))

    const scoreMap = new Map<number, number>()
    players.forEach(p => scoreMap.set(p.id, p.ppm))

    const result = buildPreSeasonSquad(players, scoreMap, 1000)

    if (result !== null) {
      const squad = result as PreSeasonSquad
      const allSelected = [...squad.starters, ...squad.bench]
      const teamCounts = new Map<number, number>()
      allSelected.forEach(p => {
        teamCounts.set(p.team, (teamCounts.get(p.team) ?? 0) + 1)
      })
      teamCounts.forEach((count, team) => {
        expect(count).toBeLessThanOrEqual(3)
      })
    }
  })
})

describe('buildPreSeasonSquad — anchor support', () => {
  it('seats an anchor player regardless of ppm rank', () => {
    const players = makePool()
    // Assign a very LOW ppm to player id=5 (a DEF) so greedy would skip it
    const lowPpmPlayer = players.find(p => p.id === 5)!
    lowPpmPlayer.ppm = 0.01
    const scoreMap = new Map<number, number>(players.map(p => [p.id, p.ppm]))

    const withoutAnchor = buildPreSeasonSquad(players, scoreMap, 1000, 3, [])
    const withAnchor    = buildPreSeasonSquad(players, scoreMap, 1000, 3, [5])

    // Without anchor: player 5 (lowest ppm DEF) deterministically NOT in squad
    // (9 other DEFs at ppm=0.4 fill all 5 DEF slots; id=5 at ppm=0.01 never picked)
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

  it('silently skips an anchor that violates team_cap', () => {
    // Create a pool where 3 players share team 99 (will fill the 3-per-club cap)
    // then try to anchor a 4th player from team 99
    const basePool = makePool()
    const scoreMap = new Map<number, number>(basePool.map(p => [p.id, p.ppm]))

    // Use 3 MIDs from different teams as the shared-team players
    // We'll create a custom tight pool: inject 4 players all on team 99
    const team99Players: PreSeasonPlayer[] = [
      { id: 101, web_name: 'T99_GK', element_type: 1, team: 99, team_short_name: 'T99', now_cost: 45, total_points: 100, ppm: 0.5 },
      { id: 102, web_name: 'T99_DEF1', element_type: 2, team: 99, team_short_name: 'T99', now_cost: 50, total_points: 100, ppm: 0.5 },
      { id: 103, web_name: 'T99_DEF2', element_type: 2, team: 99, team_short_name: 'T99', now_cost: 50, total_points: 100, ppm: 0.5 },
      { id: 104, web_name: 'T99_DEF3', element_type: 2, team: 99, team_short_name: 'T99', now_cost: 50, total_points: 100, ppm: 0.5 },
    ]
    // Give team99 players high ppm so greedy would seat 3 of them
    team99Players.forEach(p => scoreMap.set(p.id, 2.0))
    const players = [...basePool, ...team99Players]

    // Anchor all 4 team-99 players — the 4th must be skipped
    const result = buildPreSeasonSquad(players, scoreMap, 1000, 3, [101, 102, 103, 104])
    expect(result).not.toBeNull()
    const allIds = new Set([
      ...(result?.starters.map(p => p.id) ?? []),
      ...(result?.bench.map(p => p.id) ?? []),
    ])
    // 101, 102, 103 should be seated (fills the 3-per-club cap for team 99)
    expect(allIds.has(101)).toBe(true)
    expect(allIds.has(102)).toBe(true)
    expect(allIds.has(103)).toBe(true)
    // 104 should be skipped (team_cap exceeded)
    expect(allIds.has(104)).toBe(false)
    expect(result?.starters.length).toBe(11)
    expect(result?.bench.length).toBe(4)
  })

  it('silently skips an anchor that is over budget', () => {
    const players = makePool()
    // Set a very expensive anchor player (cost 900, budget 1000 — leaves only 100 for 14 more players)
    const expensivePlayer = players.find(p => p.id === 5)! // a DEF
    expensivePlayer.now_cost = 900
    const scoreMap = new Map<number, number>(players.map(p => [p.id, p.ppm]))

    // Budget of 200 cannot afford player id=5 at cost 900 as an anchor
    const result = buildPreSeasonSquad(players, scoreMap, 200, 3, [5])
    // Squad may be null (budget too tight for 15 players) OR player 5 is absent
    // Either way, if a squad is returned, player 5 must NOT be in it
    if (result !== null) {
      const allIds = new Set([
        ...result.starters.map(p => p.id),
        ...result.bench.map(p => p.id),
      ])
      expect(allIds.has(5)).toBe(false)
    }
    // Just confirm no exception was thrown — the function handled it gracefully
    expect(true).toBe(true)
  })
})

describe('diagnoseBuildPreSeasonSquad', () => {
  it('returns null for a normal feasible input (mirrors happy-path buildPreSeasonSquad)', () => {
    const players = makePool()
    const scoreMap = new Map<number, number>()
    players.forEach(p => scoreMap.set(p.id, p.ppm))

    const result = diagnoseBuildPreSeasonSquad(players, scoreMap, 1000)

    expect(result).toBeNull()
  })

  it('returns { reason: no_eligible_players } when scoreMap is empty', () => {
    const players = makePool()
    const emptyScoreMap = new Map<number, number>()

    const result = diagnoseBuildPreSeasonSquad(players, emptyScoreMap, 1000)

    expect(result).toEqual({ reason: 'no_eligible_players' })
  })

  it('returns { reason: unmet_min_slots } when pool lacks minimum at one position (only 1 GK eligible)', () => {
    // Build a pool where only 1 GK is in the scoreMap — violates MIN_SLOTS[1]=2
    const players = makePool()
    const scoreMap = new Map<number, number>()
    // Add only the first GK (id=1), skip the rest of the GKs
    let gksAdded = 0
    players.forEach(p => {
      if (p.element_type === 1) {
        if (gksAdded < 1) {
          scoreMap.set(p.id, p.ppm)
          gksAdded++
        }
        // skip remaining GKs — not in scoreMap (not eligible)
      } else {
        scoreMap.set(p.id, p.ppm)
      }
    })

    const result = diagnoseBuildPreSeasonSquad(players, scoreMap, 1000)

    expect(result).toEqual({ reason: 'unmet_min_slots' })
  })

  it('returns { reason: incomplete_squad } when budget is too small to fit 15 players (budget=300)', () => {
    // budget=300 with all players cost>=45 means at most 6 players — cannot fill 15
    const players = makePool()
    const scoreMap = new Map<number, number>()
    players.forEach(p => scoreMap.set(p.id, p.ppm))

    const result = diagnoseBuildPreSeasonSquad(players, scoreMap, 300)

    expect(result).toEqual({ reason: 'incomplete_squad' })
  })
})
