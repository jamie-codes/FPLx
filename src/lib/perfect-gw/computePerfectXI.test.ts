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
