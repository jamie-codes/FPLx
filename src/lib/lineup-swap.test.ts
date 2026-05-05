// Phase 72 (LINEUP-01): unit tests for lineup-swap pure helpers.
// Mirrors src/lib/optimise-lineup.test.ts pattern: node env, no React, no jsdom.
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { isLegalSwap, applySwap } from './lineup-swap'
import type { MergedPlayer, OptimisedLineup } from './types'

type PlayerOverrides = Partial<MergedPlayer> & { id: number; element_type: 1 | 2 | 3 | 4 }
function makePlayer(overrides: PlayerOverrides): MergedPlayer {
  return {
    web_name: `P${overrides.id}`,
    team: 1,
    team_short_name: 'T1',
    now_cost: 50,
    selected_by_percent: '5.0',
    form: '0.0',
    status: 'a',
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
    xPts_1gw: 5.0,
    xPts_3gw: 14.0,
    xPts_5gw: 22.0,
    xPts_90th_1gw: 7.0,
    ...overrides,
  } as MergedPlayer
}

// Build a 15-player fixture with the standard 4-3-3 formation:
// ids 1 = GK starter, 2-5 = DEF starters, 6-8 = MID starters, 9-11 = FWD starters
// ids 12 = GK bench, 13 = DEF bench, 14 = MID bench, 15 = FWD bench
// captainKey overrides allow tests to force specific captain/vc orderings.
function buildFixture(overrides: Record<number, Partial<MergedPlayer>> = {}): {
  lineup: OptimisedLineup
  playerMap: Map<number, MergedPlayer>
} {
  const elementTypes: Record<number, 1 | 2 | 3 | 4> = {
    1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 3, 7: 3, 8: 3, 9: 4, 10: 4, 11: 4,
    12: 1, 13: 2, 14: 3, 15: 4,
  }
  const players: MergedPlayer[] = []
  for (let id = 1; id <= 15; id++) {
    players.push(makePlayer({ id, element_type: elementTypes[id], ...(overrides[id] ?? {}) }))
  }
  const playerMap = new Map<number, MergedPlayer>(players.map(p => [p.id, p]))
  const lineup: OptimisedLineup = {
    starters: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    bench: [12, 13, 14, 15],
    captainId: 9,
    vcId: 10,
    formation: '4-3-3',
  }
  return { lineup, playerMap }
}

describe('isLegalSwap', () => {
  it('GK only swaps with GK', () => {
    const { lineup, playerMap } = buildFixture()
    // GK starter (id 1) ↔ GK bench (id 12) → legal
    expect(isLegalSwap(lineup, 1, 12, playerMap)).toBe(true)
    // GK starter (id 1) ↔ DEF bench (id 13) → illegal
    expect(isLegalSwap(lineup, 1, 13, playerMap)).toBe(false)
    // GK starter (id 1) ↔ MID bench (id 14) → illegal
    expect(isLegalSwap(lineup, 1, 14, playerMap)).toBe(false)
    // GK starter (id 1) ↔ FWD bench (id 15) → illegal
    expect(isLegalSwap(lineup, 1, 15, playerMap)).toBe(false)
    // DEF starter (id 2) ↔ GK bench (id 12) → illegal
    expect(isLegalSwap(lineup, 2, 12, playerMap)).toBe(false)
  })

  it('accepts same-position outfield swap unconditionally', () => {
    const { lineup, playerMap } = buildFixture()
    expect(isLegalSwap(lineup, 2, 13, playerMap)).toBe(true)   // DEF↔DEF
    expect(isLegalSwap(lineup, 6, 14, playerMap)).toBe(true)   // MID↔MID
    expect(isLegalSwap(lineup, 9, 15, playerMap)).toBe(true)   // FWD↔FWD
  })

  it('accepts legal cross-position swap (4-3-3 → 3-4-3)', () => {
    const { lineup, playerMap } = buildFixture()
    // Swap DEF starter (id 2) with MID bench (id 14) → 3 DEF / 4 MID / 3 FWD = legal
    expect(isLegalSwap(lineup, 2, 14, playerMap)).toBe(true)
  })

  it('rejects illegal formation cross-position swap', () => {
    const { lineup, playerMap } = buildFixture()
    // 4-3-3 swap DEF (id 2) with FWD bench (id 15) → 3 DEF / 3 MID / 4 FWD → FWD>3 illegal
    expect(isLegalSwap(lineup, 2, 15, playerMap)).toBe(false)

    // From a 3-5-2 lineup, swapping DEF→MID would produce 2-6-2 (DEF<3 AND MID>5) — illegal
    const fixture352: OptimisedLineup = {
      starters: [1, 2, 3, 4, 6, 7, 8, 14, 15, 9, 10],   // 1 GK + 3 DEF + 5 MID + 2 FWD
      bench: [12, 5, 11, 13],                            // GK + DEF + FWD + DEF on bench
      captainId: 9, vcId: 10, formation: '3-5-2',
    }
    // Swap DEF starter (id 2) with bench id 11 (FWD) → 2-5-3 — DEF<3 illegal.
    expect(isLegalSwap(fixture352, 2, 11, playerMap)).toBe(false)
  })

  it('rejects swap when starter or bench id missing from playerMap', () => {
    const { lineup, playerMap } = buildFixture()
    expect(isLegalSwap(lineup, 999, 12, playerMap)).toBe(false)
    expect(isLegalSwap(lineup, 1, 999, playerMap)).toBe(false)
  })
})

describe('applySwap', () => {
  it('does not mutate the input lineup', () => {
    const { lineup, playerMap } = buildFixture()
    const originalStarters = [...lineup.starters]
    const originalBench = [...lineup.bench]
    const originalCaptain = lineup.captainId
    const originalFormation = lineup.formation
    applySwap(lineup, 2, 13, playerMap)
    expect(lineup.starters).toEqual(originalStarters)
    expect(lineup.bench).toEqual(originalBench)
    expect(lineup.captainId).toBe(originalCaptain)
    expect(lineup.formation).toBe(originalFormation)
  })

  it('swaps starter and bench ids at correct indices (same-position)', () => {
    const { lineup, playerMap } = buildFixture()
    const result = applySwap(lineup, 2, 13, playerMap)
    // starter id 2 was at starters[1] → now id 13 there
    expect(result.starters[1]).toBe(13)
    expect(result.starters).not.toContain(2)
    // bench id 13 was at bench[1] → now id 2 there
    expect(result.bench[1]).toBe(2)
    expect(result.bench).not.toContain(13)
  })

  it('applySwap recomputes captain after swap', () => {
    // Force ordering: ids 9, 10 are FWD starters with captainKey 9 > 10. id 14 is bench MID.
    // After swap-out captain (id 9) ↔ MID bench (id 14): MID id 14 now starts.
    // Override id 14 with very high xPts_90th_1gw so it becomes the new captain.
    const { lineup, playerMap } = buildFixture({
      9:  { xPts_90th_1gw: 10.0 },   // old captain
      10: { xPts_90th_1gw: 8.0 },    // old VC
      11: { xPts_90th_1gw: 7.0 },
      14: { xPts_90th_1gw: 15.0 },   // bench MID — will become new captain after swap
    })
    // Old lineup is 4-3-3; swap FWD starter id 9 with MID bench id 14 → 4-4-2.
    const result = applySwap(lineup, 9, 14, playerMap)
    expect(result.captainId).toBe(14)   // new captain (highest xPts_90th_1gw on new starters)
    expect(result.vcId).toBe(10)        // second-highest captainKey on new starters
    expect(result.captainId).not.toBe(9)   // old captain no longer wears the C
    expect(result.starters).not.toContain(9)   // old captain is now benched
  })

  it('formation string update after cross-position swap', () => {
    const { lineup, playerMap } = buildFixture()
    expect(lineup.formation).toBe('4-3-3')
    // Swap DEF starter (id 2) with MID bench (id 14): 4-3-3 → 3-4-3
    const result = applySwap(lineup, 2, 14, playerMap)
    expect(result.formation).toBe('3-4-3')
  })

  it('formation string unchanged on same-position swap', () => {
    const { lineup, playerMap } = buildFixture()
    const result = applySwap(lineup, 2, 13, playerMap)   // DEF↔DEF
    expect(result.formation).toBe('4-3-3')
  })
})
