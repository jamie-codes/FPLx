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
    expect(results).toHaveLength(3)
    for (const r of results) {
      expect(r.squad).toBeNull()
      expect(r.topCaptains).toEqual([])
    }
  })
})
