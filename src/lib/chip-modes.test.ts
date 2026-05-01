// @vitest-environment node
// Phase 46 (CHIP-01..CHIP-03): unit tests for buildOptimalSquad + computeBenchBoostXPts.
// All tests are RED in Wave 0 (skeleton returns null/0). Wave 1 turns them GREEN.
import { describe, it, expect } from 'vitest'
import { buildOptimalSquad, computeBenchBoostXPts, CHIP_DEFAULT_BUDGET_TENTHS } from './chip-modes'
import type { MergedPlayer } from './types'

// Minimal MergedPlayer factory — only fields used by buildOptimalSquad
function makePlayer(overrides: {
  id: number
  element_type: 1 | 2 | 3 | 4
  team?: number
  now_cost?: number
  status?: string
  xPts_1gw?: number
  xPts_3gw?: number
  xPts_5gw?: number
}): MergedPlayer {
  return {
    web_name: `P${overrides.id}`,
    team: overrides.team ?? 1,
    team_short_name: 'T1',
    now_cost: overrides.now_cost ?? 50,
    selected_by_percent: '5.0',
    form: '0.0',
    status: (overrides.status ?? 'a') as MergedPlayer['status'],
    minutes: 900,
    starts: 10,
    total_points: 50,
    goals_scored: 2,
    assists: 1,
    expected_goals: 1.5,
    expected_assists: 1.0,
    pts_last3gw: 12,
    pts_last5gw: 20,
    pts_gw_count: 5,
    defensive_contribution: null,
    clearances_blocks_interceptions: null,
    direct_freekicks_order: null,
    penalties_order: null,
    corners_and_indirect_freekicks_order: null,
    penalties_text: '',
    direct_freekicks_text: '',
    corners_and_indirect_freekicks_text: '',
    news: '',
    cost_change_event: 0,
    cost_change_start: 0,
    understat_id: null,
    xg_per90: null,
    xa_per90: null,
    minutes_per90: 80,
    form_pts_per90: 5.0,
    fixtures: [],
    xmins: 80,
    start_prob: 0.9,
    mins_risk: 'nailed',
    xPts_1gw: overrides.xPts_1gw ?? 5.0,
    xPts_3gw: overrides.xPts_3gw ?? 12.0,
    xPts_5gw: overrides.xPts_5gw ?? 18.0,
    xPts_90th_1gw: (overrides.xPts_1gw ?? 5.0) * 1.5,
    id: overrides.id,
    element_type: overrides.element_type,
  } as MergedPlayer
}

// Build a valid 15-player pool (2 GK, 5 DEF, 5 MID, 3 FWD) from different teams.
// Used as baseline for most tests.
function makeValidPool(budget = 1000): MergedPlayer[] {
  const pool: MergedPlayer[] = []
  let id = 1
  const cost = Math.floor(budget / 15) - 1  // ensure budget fits
  for (let i = 0; i < 2; i++) pool.push(makePlayer({ id: id++, element_type: 1, team: id, now_cost: cost }))
  for (let i = 0; i < 5; i++) pool.push(makePlayer({ id: id++, element_type: 2, team: id, now_cost: cost }))
  for (let i = 0; i < 5; i++) pool.push(makePlayer({ id: id++, element_type: 3, team: id, now_cost: cost }))
  for (let i = 0; i < 3; i++) pool.push(makePlayer({ id: id++, element_type: 4, team: id, now_cost: cost }))
  return pool
}

describe('CHIP_DEFAULT_BUDGET_TENTHS', () => {
  it('equals 1000 (£100m in integer tenths)', () => {
    expect(CHIP_DEFAULT_BUDGET_TENTHS).toBe(1000)
  })
})

describe('buildOptimalSquad — basic shape', () => {
  it('returns a squad of exactly 15 players when sufficient eligible players exist', () => {
    const players = makeValidPool()
    const result = buildOptimalSquad({ players, budget: 1000, horizon: 1 })
    expect(result).not.toBeNull()
    expect(result!.squad).toHaveLength(15)
  })

  it('returns bestXI with exactly 11 element IDs', () => {
    const players = makeValidPool()
    const result = buildOptimalSquad({ players, budget: 1000, horizon: 1 })
    expect(result!.bestXI).toHaveLength(11)
  })

  it('returns a formation string matching DEF-MID-FWD pattern', () => {
    const players = makeValidPool()
    const result = buildOptimalSquad({ players, budget: 1000, horizon: 1 })
    expect(result!.formation).toMatch(/^\d-\d-\d$/)
  })

  it('budgetUsed equals sum of now_cost of all 15 squad players', () => {
    const players = makeValidPool(1000)
    const result = buildOptimalSquad({ players, budget: 1000, horizon: 1 })
    const expectedBudgetUsed = result!.squad.reduce((s, p) => s + p.now_cost, 0)
    expect(result!.budgetUsed).toBe(expectedBudgetUsed)
  })
})

describe('buildOptimalSquad — budget filter (D-12)', () => {
  it('returns null when total budget is too low to fill 15 slots', () => {
    const players = makeValidPool()
    // Budget of 1 (£0.1m) is impossibly low — no player costs less than 40 tenths
    const result = buildOptimalSquad({ players, budget: 1, horizon: 1 })
    expect(result).toBeNull()
  })

  it('excludes players whose now_cost would exceed remaining budget', () => {
    const pool = makeValidPool(1000)
    // Add an expensive player that would bust the budget
    pool.push(makePlayer({ id: 999, element_type: 3, team: 99, now_cost: 999, xPts_1gw: 20 }))
    const result = buildOptimalSquad({ players: pool, budget: 900, horizon: 1 })
    // The expensive player (id=999) must NOT be in the squad
    if (result !== null) {
      expect(result.squad.find(p => p.id === 999)).toBeUndefined()
    }
  })
})

describe('buildOptimalSquad — formation quotas (D-07)', () => {
  it('squad contains exactly 2 GKs', () => {
    const players = makeValidPool()
    const result = buildOptimalSquad({ players, budget: 1000, horizon: 1 })
    const gks = result!.squad.filter(p => p.element_type === 1)
    expect(gks).toHaveLength(2)
  })

  it('squad contains at least 3 and at most 5 DEFs', () => {
    const players = makeValidPool()
    const result = buildOptimalSquad({ players, budget: 1000, horizon: 1 })
    const defs = result!.squad.filter(p => p.element_type === 2)
    expect(defs.length).toBeGreaterThanOrEqual(3)
    expect(defs.length).toBeLessThanOrEqual(5)
  })

  it('squad contains at least 2 and at most 5 MIDs', () => {
    const players = makeValidPool()
    const result = buildOptimalSquad({ players, budget: 1000, horizon: 1 })
    const mids = result!.squad.filter(p => p.element_type === 3)
    expect(mids.length).toBeGreaterThanOrEqual(2)
    expect(mids.length).toBeLessThanOrEqual(5)
  })

  it('squad contains at least 1 and at most 3 FWDs', () => {
    const players = makeValidPool()
    const result = buildOptimalSquad({ players, budget: 1000, horizon: 1 })
    const fwds = result!.squad.filter(p => p.element_type === 4)
    expect(fwds.length).toBeGreaterThanOrEqual(1)
    expect(fwds.length).toBeLessThanOrEqual(3)
  })
})

describe('buildOptimalSquad — team cap (D-06)', () => {
  it('no club has more than 3 players in the returned squad', () => {
    // Give one team (team=1) many great players — ensure cap is enforced
    const pool: MergedPlayer[] = []
    let id = 1
    // 6 GKs from team 1 (cap should limit to 2 since max GK slots = 2)
    for (let i = 0; i < 6; i++) pool.push(makePlayer({ id: id++, element_type: 1, team: 1, now_cost: 50, xPts_1gw: 10 }))
    // Fill remaining positions from other teams
    for (let i = 0; i < 5; i++) pool.push(makePlayer({ id: id++, element_type: 2, team: 2 + i, now_cost: 50 }))
    for (let i = 0; i < 5; i++) pool.push(makePlayer({ id: id++, element_type: 3, team: 10 + i, now_cost: 50 }))
    for (let i = 0; i < 3; i++) pool.push(makePlayer({ id: id++, element_type: 4, team: 20 + i, now_cost: 50 }))
    const result = buildOptimalSquad({ players: pool, budget: 1000, horizon: 1 })
    if (result !== null) {
      const teamCounts = new Map<number, number>()
      for (const p of result.squad) {
        teamCounts.set(p.team, (teamCounts.get(p.team) ?? 0) + 1)
      }
      for (const [, count] of teamCounts) {
        expect(count).toBeLessThanOrEqual(3)
      }
    }
  })
})

describe('buildOptimalSquad — BGW exclusion (D-09)', () => {
  it('excludes players with xPts_1gw === 0 (exact zero = BGW proxy)', () => {
    const pool = makeValidPool()
    // Mark first 3 players (GKs + 1 DEF) as BGW
    pool[0] = makePlayer({ id: pool[0].id, element_type: pool[0].element_type, team: pool[0].team, xPts_1gw: 0 })
    pool[1] = makePlayer({ id: pool[1].id, element_type: pool[1].element_type, team: pool[1].team, xPts_1gw: 0 })
    // Pool no longer has enough GKs after BGW exclusion — should return null
    const result = buildOptimalSquad({ players: pool, budget: 1000, horizon: 1 })
    // With only 0 eligible GKs, can't fill 2 GK slots — result must be null
    expect(result).toBeNull()
  })

  it('does NOT exclude players with xPts_1gw === undefined (missing pipeline data ≠ BGW)', () => {
    const pool = makeValidPool()
    // Set one player's xPts_1gw to undefined — should NOT be excluded
    const withUndefined = { ...pool[2], xPts_1gw: undefined }
    pool[2] = withUndefined as MergedPlayer
    // Should still return a result (undefined != 0 per Pitfall 1 in RESEARCH.md)
    const result = buildOptimalSquad({ players: pool, budget: 1000, horizon: 1 })
    expect(result).not.toBeNull()
  })
})

describe('buildOptimalSquad — Free Hit horizon lock (D-08)', () => {
  it('when called with horizon: 1, scores players by xPts_1gw field', () => {
    // Player A has high xPts_1gw but low xPts_3gw; player B is the reverse.
    // With horizon: 1, player A should be preferred.
    const pool = makeValidPool()
    // Replace first MID with a high-1gw player
    pool[7] = makePlayer({ id: 100, element_type: 3, team: 50, now_cost: 50, xPts_1gw: 99, xPts_3gw: 1 })
    const result = buildOptimalSquad({ players: pool, budget: 1000, horizon: 1 })
    expect(result).not.toBeNull()
    expect(result!.squad.find(p => p.id === 100)).toBeDefined()
  })
})

describe('buildOptimalSquad — null when insufficient eligible players', () => {
  it('returns null when eligible player pool has fewer than 15 valid slots', () => {
    // Only provide 14 players total — can never fill 15 slots
    const pool = makeValidPool().slice(0, 14)
    const result = buildOptimalSquad({ players: pool, budget: 1000, horizon: 1 })
    expect(result).toBeNull()
  })
})

describe('computeBenchBoostXPts', () => {
  it('returns sum of horizon xPts for 4 bench player IDs', () => {
    const players = makeValidPool()
    const benchIds = [players[0].id, players[2].id, players[7].id, players[12].id]
    const result = computeBenchBoostXPts(benchIds, players, 1)
    const expected = benchIds.reduce((s, id) => {
      const p = players.find(pl => pl.id === id)
      return s + (p?.xPts_1gw ?? 0)
    }, 0)
    expect(result).toBeCloseTo(expected, 5)
  })

  it('uses xPts_3gw when horizon is 3', () => {
    const players = makeValidPool()
    const benchIds = [players[0].id, players[2].id, players[7].id, players[12].id]
    const result = computeBenchBoostXPts(benchIds, players, 3)
    const expected = benchIds.reduce((s, id) => {
      const p = players.find(pl => pl.id === id)
      return s + (p?.xPts_3gw ?? 0)
    }, 0)
    expect(result).toBeCloseTo(expected, 5)
  })
})
