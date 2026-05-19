// @vitest-environment node
// Phase 126 (NSP-02): unit tests for buildPreSeasonSquad.
// Wave 0: all tests RED (module does not exist). Wave 1: GREEN.
import { describe, it, expect } from 'vitest'
import { buildPreSeasonSquad } from './pre-season-squad'
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
