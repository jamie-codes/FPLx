// Phase 65 (WHY-01): computeRejection — pure-function unit tests.
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  computeRejection,
  REJECTION_START_PROB_THRESHOLD,
  REJECTION_OWNERSHIP_THRESHOLD,
  type RejectionResult,
} from '../explain'
import type { ScoredPlayer, FixtureEntry } from '../types'

type PlayerOverrides = Partial<ScoredPlayer> & {
  id: number
  element_type: 1 | 2 | 3 | 4
}

function makePlayer(overrides: PlayerOverrides): ScoredPlayer {
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
    haul_prob: undefined,
    p10_pts: undefined,
    p90_pts: undefined,
    blank_prob: undefined,
    // ScoredPlayer-only field
    gem_score: 0.5,
    ...overrides,
  } as ScoredPlayer
}

const easyFixture: FixtureEntry = {
  opponent_team: 'BUR',
  is_home: true,
  event_id: 28,
  difficulty_score: 0.3,
  difficulty_tier: 'easy',
}

const mediumFixture: FixtureEntry = {
  opponent_team: 'ARS',
  is_home: false,
  event_id: 28,
  difficulty_score: 0.5,
  difficulty_tier: 'medium',
}

const hardFixture: FixtureEntry = {
  opponent_team: 'LIV',
  is_home: false,
  event_id: 28,
  difficulty_score: 0.8,
  difficulty_tier: 'hard',
}

/**
 * Returns a population of ScoredPlayer instances:
 * - target player itself
 * - sameposBetter: N players with xPts_1gw HIGHER than target (ranked above)
 * - sameposWorse: N players with xPts_1gw LOWER than target (ranked below)
 * Players from a different position are NOT included (only same element_type).
 */
function makePopulation(
  target: ScoredPlayer,
  opts: { sameposBetter?: number; sameposWorse?: number } = {},
): ScoredPlayer[] {
  const { sameposBetter = 0, sameposWorse = 0 } = opts
  const baseXpts = target.xPts_1gw ?? 5.0
  const players: ScoredPlayer[] = [target]

  for (let i = 0; i < sameposBetter; i++) {
    players.push(
      makePlayer({
        id: 1000 + i,
        element_type: target.element_type,
        xPts_1gw: baseXpts + (i + 1) * 1.0,
        gem_score: target.gem_score ?? 0.5,
      }),
    )
  }

  for (let i = 0; i < sameposWorse; i++) {
    players.push(
      makePlayer({
        id: 2000 + i,
        element_type: target.element_type,
        xPts_1gw: Math.max(0, baseXpts - (i + 1) * 1.0),
        gem_score: 0.1,
      }),
    )
  }

  return players
}

describe('computeRejection — Phase 65 WHY-01', () => {
  it('returns 1-based rank within position by xPts_1gw descending', () => {
    // target is rank 2 (1 player has higher xPts)
    const target = makePlayer({ id: 10, element_type: 3, xPts_1gw: 5.0 })
    const population = makePopulation(target, { sameposBetter: 1, sameposWorse: 2 })
    const result = computeRejection(target, population)
    expect(result.xPtsRank).toBe(2)
  })

  it('returns empty reasons (positive framing) when gem_score >= posAvg AND no fragility AND start_prob >= 0.70', () => {
    // Create a strong player: gem_score well above average, good start_prob, easy fixture
    // Population has 4 players, target is the top scorer → rank 1
    // All players have gem_score 0.5, so posAvg is 0.5; target has gem_score 0.8 >= 0.5
    const target = makePlayer({
      id: 20,
      element_type: 3,
      xPts_1gw: 8.0,
      start_prob: 0.95,
      fixtures: [easyFixture],
      gem_score: 0.8,
    })
    const population = makePopulation(target, { sameposWorse: 3 })
    const result = computeRejection(target, population)
    expect(result.reasons).toEqual([])
    expect(result.xPtsRank).toBe(1)
  })

  it('returns positive-framing rank label format compatible with UI rendering (xPtsRank is correct integer)', () => {
    const target = makePlayer({
      id: 21,
      element_type: 3,
      xPts_1gw: 8.0,
      start_prob: 0.95,
      fixtures: [easyFixture],
      gem_score: 0.8,
    })
    const population = makePopulation(target, { sameposWorse: 2 })
    const result = computeRejection(target, population)
    // xPtsRank must be a positive integer (compatible with "ranked #X" UI rendering)
    expect(result.xPtsRank).toBeGreaterThanOrEqual(1)
    expect(Number.isInteger(result.xPtsRank)).toBe(true)
  })

  it('includes "Ranked #X at MID by xPts" reason when player below average', () => {
    // target has gem_score 0.2 < posAvg 0.5 → rejection reasons apply
    const target = makePlayer({
      id: 30,
      element_type: 3,
      xPts_1gw: 3.0,
      start_prob: 0.9,
      fixtures: [easyFixture],
      gem_score: 0.2,
      selected_by_percent: '5.0',
    })
    // sameposBetter: 1 → target is rank 2
    const population = makePopulation(target, { sameposBetter: 1, sameposWorse: 0 })
    const result = computeRejection(target, population)
    expect(result.reasons[0]).toBe('Ranked #2 at MID by xPts')
  })

  it('includes "Rotation risk — start probability XX%" when start_prob < 0.70', () => {
    const target = makePlayer({
      id: 40,
      element_type: 3,
      xPts_1gw: 3.0,
      start_prob: 0.65,
      fixtures: [easyFixture],
      gem_score: 0.2,
      selected_by_percent: '5.0',
    })
    const population = makePopulation(target, { sameposBetter: 0 })
    const result = computeRejection(target, population)
    // em-dash U+2014
    expect(result.reasons).toContain('Rotation risk — start probability 65%')
  })

  it('includes "Difficult fixture (FDR medium)" when next fixture difficulty_tier === "medium"', () => {
    const target = makePlayer({
      id: 50,
      element_type: 3,
      xPts_1gw: 3.0,
      start_prob: 0.9,
      fixtures: [mediumFixture],
      gem_score: 0.2,
      selected_by_percent: '5.0',
    })
    const population = makePopulation(target, { sameposBetter: 0 })
    const result = computeRejection(target, population)
    expect(result.reasons).toContain('Difficult fixture (FDR medium)')
  })

  it('includes "Difficult fixture (FDR hard)" when next fixture difficulty_tier === "hard"', () => {
    const target = makePlayer({
      id: 51,
      element_type: 3,
      xPts_1gw: 3.0,
      start_prob: 0.9,
      fixtures: [hardFixture],
      gem_score: 0.2,
      selected_by_percent: '5.0',
    })
    const population = makePopulation(target, { sameposBetter: 0 })
    const result = computeRejection(target, population)
    expect(result.reasons).toContain('Difficult fixture (FDR hard)')
  })

  it('delegates to computeFragility(player, false) — fragility reasons appear with "Fragile: no longer recommended if: " prefix', () => {
    // start_prob < 0.70 triggers computeFragility to return 'start_prob < 70%'
    const target = makePlayer({
      id: 60,
      element_type: 3,
      xPts_1gw: 3.0,
      start_prob: 0.5,
      fixtures: [easyFixture],
      gem_score: 0.2,
      selected_by_percent: '5.0',
    })
    const population = makePopulation(target, { sameposBetter: 0 })
    const result = computeRejection(target, population)
    // computeFragility('start_prob < 70%') should appear with the fragility prefix
    expect(result.reasons.some(r => r.startsWith('Fragile: no longer recommended if: '))).toBe(true)
  })

  it('parses selected_by_percent as float not string ("12.5" → 13 not raw string compare); ownership reason uses Math.round and reads "Owned by 13% of managers"', () => {
    const target = makePlayer({
      id: 70,
      element_type: 3,
      xPts_1gw: 3.0,
      start_prob: 0.9,
      fixtures: [easyFixture],
      gem_score: 0.2,
      selected_by_percent: '12.5',
    })
    const population = makePopulation(target, { sameposBetter: 0 })
    const result = computeRejection(target, population)
    // Ownership always appears last; Math.round(12.5) === 13
    expect(result.reasons[result.reasons.length - 1]).toBe('Owned by 13% of managers')
  })

  it('does not throw on BGW player with empty fixtures array', () => {
    const target = makePlayer({
      id: 80,
      element_type: 3,
      xPts_1gw: 3.0,
      start_prob: 0.9,
      fixtures: [],
      gem_score: 0.2,
    })
    const population = makePopulation(target, { sameposWorse: 2 })
    expect(() => computeRejection(target, population)).not.toThrow()
    const result = computeRejection(target, population)
    expect(result.xPtsRank).toBeGreaterThanOrEqual(1)
  })

  it('positions reasons in order: rank, start_prob, fixture, fragility, ownership (per D-07)', () => {
    // All signals fire: below avg gem, low start_prob (triggers fragility too), medium fixture, owned
    const target = makePlayer({
      id: 90,
      element_type: 3,
      xPts_1gw: 3.0,
      start_prob: 0.5,   // < 0.70 → start_prob reason + fragility
      fixtures: [mediumFixture],  // medium → fixture reason
      gem_score: 0.2,
      selected_by_percent: '25.0',
    })
    // sameposBetter: 1 → rank 2
    const population = makePopulation(target, { sameposBetter: 1 })
    const result = computeRejection(target, population)
    const reasons = result.reasons
    const rankIdx = reasons.findIndex(r => r.startsWith('Ranked #'))
    const startProbIdx = reasons.findIndex(r => r.startsWith('Rotation risk'))
    const fixtureIdx = reasons.findIndex(r => r.startsWith('Difficult fixture'))
    const fragilityIdx = reasons.findIndex(r => r.startsWith('Fragile:'))
    const ownershipIdx = reasons.findIndex(r => r.startsWith('Owned by'))
    expect(rankIdx).toBe(0)
    expect(startProbIdx).toBeGreaterThan(rankIdx)
    expect(fixtureIdx).toBeGreaterThan(startProbIdx)
    expect(fragilityIdx).toBeGreaterThan(fixtureIdx)
    expect(ownershipIdx).toBeGreaterThan(fragilityIdx)
  })

  it('uses POSITION_CODES map: 1→GK, 2→DEF, 3→MID, 4→FWD', () => {
    const cases: Array<{ type: 1 | 2 | 3 | 4; code: string }> = [
      { type: 1, code: 'GK' },
      { type: 2, code: 'DEF' },
      { type: 3, code: 'MID' },
      { type: 4, code: 'FWD' },
    ]
    for (const { type, code } of cases) {
      const target = makePlayer({
        id: 100 + type,
        element_type: type,
        xPts_1gw: 3.0,
        start_prob: 0.9,
        fixtures: [easyFixture],
        gem_score: 0.2,
        selected_by_percent: '5.0',
      })
      const population = makePopulation(target, { sameposBetter: 0 })
      const result = computeRejection(target, population)
      const rankReason = result.reasons.find(r => r.startsWith('Ranked #'))
      expect(rankReason).toBeDefined()
      expect(rankReason).toContain(` at ${code} by xPts`)
    }
  })

  it('exports REJECTION_START_PROB_THRESHOLD === 0.70', () => {
    expect(REJECTION_START_PROB_THRESHOLD).toBe(0.70)
  })

  it('exports REJECTION_OWNERSHIP_THRESHOLD === 20.0', () => {
    expect(REJECTION_OWNERSHIP_THRESHOLD).toBe(20.0)
  })
})
