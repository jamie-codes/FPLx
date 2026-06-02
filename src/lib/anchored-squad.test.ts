// @vitest-environment node
// WC-01: buildAnchoredSquad unit tests
import { describe, it, expect } from 'vitest'
import { buildAnchoredSquad } from './anchored-squad'
import type { MergedPlayer } from './types'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makePlayer(
  id: number,
  type: 1 | 2 | 3 | 4,
  team: number,
  opts: { xPts?: number; cost?: number; status?: string; ceiling?: number } = {},
): MergedPlayer {
  const baseCost = { 1: 45, 2: 50, 3: 65, 4: 80 }
  const xPts = opts.xPts ?? 5.0
  return {
    id,
    web_name: `P${id}`,
    element_type: type,
    team,
    now_cost: opts.cost ?? baseCost[type],
    status: opts.status ?? 'a',
    xPts_1gw: xPts,
    xPts_3gw: xPts * 2.8,
    xPts_5gw: xPts * 4.5,
    xPts_90th_1gw: opts.ceiling ?? xPts * 1.4,
    start_prob: 0.9,
    fixtures: [],
  } as unknown as MergedPlayer
}

/**
 * Build a pool of 60 players across 6 teams large enough to fill a 15-player
 * squad within a £100m (1000 tenths) budget. Teams 1-6, each with:
 * 2 GK (cost 45), 3 DEF (cost 50), 3 MID (cost 65), 2 FWD (cost 80).
 * Team 1 has highest xPts, Team 6 has lowest.
 */
function makePool(): MergedPlayer[] {
  const players: MergedPlayer[] = []
  let id = 1
  for (let team = 1; team <= 6; team++) {
    const base = (7 - team) * 1.0  // team1=6, team6=1
    players.push(makePlayer(id++, 1, team, { xPts: base + 0.11 }))
    players.push(makePlayer(id++, 1, team, { xPts: base - 0.89 }))
    players.push(makePlayer(id++, 2, team, { xPts: base + 0.22 }))
    players.push(makePlayer(id++, 2, team, { xPts: base - 0.78 }))
    players.push(makePlayer(id++, 2, team, { xPts: base - 1.78 }))
    players.push(makePlayer(id++, 3, team, { xPts: base + 0.33 }))
    players.push(makePlayer(id++, 3, team, { xPts: base - 0.67 }))
    players.push(makePlayer(id++, 3, team, { xPts: base - 1.67 }))
    players.push(makePlayer(id++, 4, team, { xPts: base + 0.44 }))
    players.push(makePlayer(id++, 4, team, { xPts: base - 0.56 }))
  }
  return players
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildAnchoredSquad', () => {
  const BUDGET = 1000  // £100m

  it('returns a valid 15-player squad with no anchors', () => {
    const result = buildAnchoredSquad([], makePool(), BUDGET, 1)
    expect(result).not.toBeNull()
    expect(result!.squad).toHaveLength(15)
  })

  it('0 anchors: anchorConflicts is empty', () => {
    const result = buildAnchoredSquad([], makePool(), BUDGET, 1)
    expect(result!.anchorConflicts).toHaveLength(0)
  })

  it('returns null when player pool is too small to fill 15', () => {
    // Only 5 players — cannot build a valid squad
    const tiny = [
      makePlayer(1, 1, 1), makePlayer(2, 2, 1), makePlayer(3, 3, 1),
      makePlayer(4, 4, 1), makePlayer(5, 1, 2),
    ]
    const result = buildAnchoredSquad([], tiny, BUDGET, 1)
    expect(result).toBeNull()
  })

  it('valid anchor appears in squad', () => {
    const pool = makePool()
    const anchor = pool[0]  // first player in pool
    const result = buildAnchoredSquad([anchor.id], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    expect(result!.squad.map(p => p.id)).toContain(anchor.id)
  })

  it('all 3 valid anchors appear in squad', () => {
    const pool = makePool()
    // Pick one anchor per position type from different teams to avoid cap/slot conflicts
    const gk  = pool.find(p => p.element_type === 1 && p.team === 1)!
    const def = pool.find(p => p.element_type === 2 && p.team === 2)!
    const mid = pool.find(p => p.element_type === 3 && p.team === 3)!
    const ids = (result: ReturnType<typeof buildAnchoredSquad>) => result!.squad.map((p: { id: number }) => p.id)
    const result = buildAnchoredSquad([gk.id, def.id, mid.id], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    expect(ids(result)).toContain(gk.id)
    expect(ids(result)).toContain(def.id)
    expect(ids(result)).toContain(mid.id)
  })

  it('anchor not in pool → not_found conflict, squad still builds', () => {
    const result = buildAnchoredSquad([99999], makePool(), BUDGET, 1)
    expect(result).not.toBeNull()
    expect(result!.anchorConflicts).toEqual([{ playerId: 99999, reason: 'not_found' }])
    expect(result!.squad).toHaveLength(15)
  })

  it('unavailable anchor → unavailable conflict, squad still builds', () => {
    const pool = makePool()
    const injured = makePlayer(999, 2, 5, { status: 'i' })
    pool.push(injured)
    const result = buildAnchoredSquad([injured.id], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    expect(result!.anchorConflicts).toEqual([{ playerId: 999, reason: 'unavailable' }])
  })

  it('4th anchor from same team → team_cap conflict', () => {
    const pool = makePool()
    // Anchor 3 players from team 1 first (valid), then a 4th from team 1
    const team1Players = pool.filter(p => p.team === 1)
    const [a, b, c, d] = team1Players
    const result = buildAnchoredSquad([a.id, b.id, c.id, d.id], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    const conflicts = result!.anchorConflicts
    expect(conflicts.some(c => c.playerId === d.id && c.reason === 'team_cap')).toBe(true)
    // First 3 are in squad, 4th is not
    const squadIds = result!.squad.map(p => p.id)
    expect(squadIds).toContain(a.id)
    expect(squadIds).toContain(b.id)
    expect(squadIds).toContain(c.id)
    expect(squadIds).not.toContain(d.id)
  })

  it('anchor filling 3rd GK → position_cap conflict', () => {
    const pool = makePool()
    // Each from a distinct team → no team_cap possible; 3rd GK must hit position_cap
    const gk_t1 = pool.find(p => p.element_type === 1 && p.team === 1)!
    const gk_t2 = pool.find(p => p.element_type === 1 && p.team === 2)!
    const gk_t3 = pool.find(p => p.element_type === 1 && p.team === 3)!
    const result = buildAnchoredSquad([gk_t1.id, gk_t2.id, gk_t3.id], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    const conflicts = result!.anchorConflicts
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toEqual({ playerId: gk_t3.id, reason: 'position_cap' })
  })

  it('anchor over budget → over_budget conflict', () => {
    const pool = makePool()
    const expensive = makePlayer(999, 3, 5, { cost: 2000 })  // costs more than entire budget
    pool.push(expensive)
    const result = buildAnchoredSquad([expensive.id], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    expect(result!.anchorConflicts).toEqual([{ playerId: 999, reason: 'over_budget' }])
  })

  it('xPts1gw/3gw/5gw are sums of XI only, not all 15', () => {
    const pool = makePool()
    const result = buildAnchoredSquad([], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    const { bestXI, squad } = result!
    expect(bestXI).toHaveLength(11)
    expect(squad).toHaveLength(15)
    // xPts1gw must equal the sum of bestXI players' xPts_1gw
    const playerMap = new Map(pool.map(p => [p.id, p]))
    const expectedXPts1 = bestXI.reduce((s, id) => s + (playerMap.get(id)?.xPts_1gw ?? 0), 0)
    expect(result!.xPts1gw).toBeCloseTo(expectedXPts1, 5)
    const expectedXPts3 = bestXI.reduce((s, id) => s + ((playerMap.get(id)?.xPts_3gw as number | undefined) ?? 0), 0)
    expect(result!.xPts3gw).toBeCloseTo(expectedXPts3, 5)
    const expectedXPts5 = bestXI.reduce((s, id) => s + ((playerMap.get(id)?.xPts_5gw as number | undefined) ?? 0), 0)
    expect(result!.xPts5gw).toBeCloseTo(expectedXPts5, 5)
    // Must be less than sum of all 15
    const allXPts1 = squad.reduce((s, p) => s + (playerMap.get(p.id)?.xPts_1gw ?? 0), 0)
    expect(result!.xPts1gw).toBeLessThan(allXPts1)
  })

  it('captainCandidates are ordered by ceiling descending, max 3', () => {
    const result = buildAnchoredSquad([], makePool(), BUDGET, 1)
    expect(result).not.toBeNull()
    const caps = result!.captainCandidates
    expect(caps.length).toBeGreaterThan(0)
    expect(caps.length).toBeLessThanOrEqual(3)
    for (let i = 1; i < caps.length; i++) {
      expect(caps[i - 1].ceiling).toBeGreaterThanOrEqual(caps[i].ceiling)
    }
  })

  it('budgetUsed + budgetRemaining === budget', () => {
    const result = buildAnchoredSquad([], makePool(), BUDGET, 1)
    expect(result).not.toBeNull()
    expect(result!.budgetUsed + result!.budgetRemaining).toBe(BUDGET)
  })

  it('formation string is non-empty and matches GK-DEF-MID-FWD pattern', () => {
    const result = buildAnchoredSquad([], makePool(), BUDGET, 1)
    expect(result).not.toBeNull()
    expect(result!.formation).toMatch(/^\d-\d-\d$/)
  })

  it('GK anchor is included; greedy does not add a second GK from same team', () => {
    const pool = makePool()
    const gk = pool.find(p => p.element_type === 1 && p.team === 1)!
    const result = buildAnchoredSquad([gk.id], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    const squadIds = result!.squad.map(p => p.id)
    expect(squadIds).toContain(gk.id)
    // Only one GK from team 1 in final squad (team cap respected)
    const team1Gks = result!.squad.filter(p => {
      const player = pool.find(q => q.id === p.id)
      return player?.element_type === 1 && player?.team === 1
    })
    expect(team1Gks.length).toBeLessThanOrEqual(1)
  })
})
