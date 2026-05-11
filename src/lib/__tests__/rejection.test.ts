// Phase 65 (WHY-01): computeRejection — pure-function unit tests.
// Phase 94 (WHY-01): extended predicates + computeHeadToHead composition tests.
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  computeRejection,
  computeHeadToHead,
  REJECTION_START_PROB_THRESHOLD,
  REJECTION_OWNERSHIP_THRESHOLD,
  REJECTION_FORM_THRESHOLD,
  REJECTION_PRICE_FALLING,
  type RejectionResult,
} from '../explain'
import type { ScoredPlayer, FixtureEntry } from '../types'
import type { LifecycleLabel } from '../lifecycle-label'

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
        // Use a gem_score higher than the target so posAvg is above the target's
        // gem_score when sameposBetter > 0 — this ensures target is "below average"
        // regardless of whether the threshold is > or >= (WR-01 fix).
        gem_score: Math.max((target.gem_score ?? 0.5) + 0.4, 0.9),
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
    const result = computeRejection(target, population, new Map())
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
    const result = computeRejection(target, population, new Map())
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
    const result = computeRejection(target, population, new Map())
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
    const result = computeRejection(target, population, new Map())
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
    const result = computeRejection(target, population, new Map())
    // em-dash U+2014
    expect(result.reasons).toContain('Rotation risk — start probability 65%')
  })

  it('medium fixture produces fragility reason (step 3d), not a standalone "Difficult fixture" message (WR-03)', () => {
    // WR-03 fix: step 3c is restricted to hard only. Medium fixtures are handled by
    // computeFragility in step 3d, producing "Fragile: no longer recommended if: harder fixture".
    const target = makePlayer({
      id: 50,
      element_type: 3,
      xPts_1gw: 3.0,
      start_prob: 0.9,
      fixtures: [mediumFixture],
      gem_score: 0.2,
      selected_by_percent: '5.0',
    })
    // sameposBetter: 1 ensures posAvg > target's gem_score so rejection reasons fire
    const population = makePopulation(target, { sameposBetter: 1 })
    const result = computeRejection(target, population, new Map())
    // Medium no longer produces "Difficult fixture (FDR medium)"; fragility handles it.
    expect(result.reasons).not.toContain('Difficult fixture (FDR medium)')
    expect(result.reasons).toContain('Fragile: no longer recommended if: harder fixture')
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
    // sameposBetter: 1 ensures posAvg > target's gem_score so rejection reasons fire
    const population = makePopulation(target, { sameposBetter: 1 })
    const result = computeRejection(target, population, new Map())
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
    const result = computeRejection(target, population, new Map())
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
    // sameposBetter: 1 ensures posAvg > target's gem_score so rejection reasons fire
    const population = makePopulation(target, { sameposBetter: 1 })
    const result = computeRejection(target, population, new Map())
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
    expect(() => computeRejection(target, population, new Map())).not.toThrow()
    const result = computeRejection(target, population, new Map())
    expect(result.xPtsRank).toBeGreaterThanOrEqual(1)
  })

  it('positions reasons in order: rank, start_prob, fixture, fragility, ownership (per D-07)', () => {
    // All signals fire: below avg gem, low start_prob (triggers fragility too), hard fixture, owned
    // WR-03: step 3c now only fires for hard fixtures; medium is handled by computeFragility in 3d.
    // Using hard fixture here so both 3c (fixture) and 3d (fragility via start_prob) fire.
    const target = makePlayer({
      id: 90,
      element_type: 3,
      xPts_1gw: 3.0,
      start_prob: 0.5,   // < 0.70 → start_prob reason + fragility (start_prob < 70%)
      fixtures: [hardFixture],  // hard → "Difficult fixture (FDR hard)" from step 3c
      gem_score: 0.2,
      selected_by_percent: '25.0',
    })
    // sameposBetter: 1 → rank 2; also makes posAvg > 0.2 so isStrong = false
    const population = makePopulation(target, { sameposBetter: 1 })
    const result = computeRejection(target, population, new Map())
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
      // sameposBetter: 1 ensures posAvg > target's gem_score so rejection reasons fire
      const population = makePopulation(target, { sameposBetter: 1 })
      const result = computeRejection(target, population, new Map())
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

describe('computeRejection — Phase 94 new predicates', () => {
  it('fires form predicate when form_pts_per90 < 3.0', () => {
    const target = makePlayer({ id: 200, element_type: 3, form_pts_per90: 2.5, gem_score: 0.2 })
    const population = makePopulation(target, { sameposBetter: 1 })
    const result = computeRejection(target, population, new Map())
    expect(result.reasons).toContain('Poor form — 2.5 pts/90 last 5 GWs')
  })

  it('fires price predicate when cost_change_event < 0', () => {
    const target = makePlayer({ id: 201, element_type: 3, cost_change_event: -1, gem_score: 0.2 })
    const population = makePopulation(target, { sameposBetter: 1 })
    const result = computeRejection(target, population, new Map())
    expect(result.reasons).toContain('Price falling this GW (-0.1m)')
  })

  it('fires lifecycle "sell" reason when label is sell', () => {
    const target = makePlayer({ id: 202, element_type: 3, gem_score: 0.2 })
    const population = makePopulation(target, { sameposBetter: 1 })
    const labels = new Map<number, LifecycleLabel>([[202, 'sell']])
    const result = computeRejection(target, population, labels)
    expect(result.reasons).toContain('Lifecycle: Sell — significantly below position average')
  })

  it('fires lifecycle "sell_soon" reason when label is sell_soon', () => {
    const target = makePlayer({ id: 203, element_type: 3, gem_score: 0.2 })
    const population = makePopulation(target, { sameposBetter: 1 })
    const labels = new Map<number, LifecycleLabel>([[203, 'sell_soon']])
    const result = computeRejection(target, population, labels)
    expect(result.reasons).toContain('Lifecycle: Sell soon — approaching sell threshold')
  })

  it('does NOT fire lifecycle for hold, buy_next_week, hold_one_more', () => {
    for (const label of ['hold', 'buy_next_week', 'hold_one_more'] as LifecycleLabel[]) {
      const target = makePlayer({ id: 210, element_type: 3, gem_score: 0.2 })
      const population = makePopulation(target, { sameposBetter: 1 })
      const labels = new Map<number, LifecycleLabel>([[210, label]])
      const result = computeRejection(target, population, labels)
      expect(result.reasons.some(r => r.startsWith('Lifecycle:'))).toBe(false)
    }
  })

  it('SC-3 determinism: 8-predicate cascade fires in order rank -> start_prob -> form -> fixture -> price -> fragility -> lifecycle -> ownership', () => {
    const target = makePlayer({
      id: 220,
      element_type: 3,
      xPts_1gw: 3.0,
      start_prob: 0.5,
      form_pts_per90: 2.0,
      fixtures: [hardFixture],
      cost_change_event: -1,
      gem_score: 0.2,
      selected_by_percent: '25.0',
    })
    const population = makePopulation(target, { sameposBetter: 1 })
    const labels = new Map<number, LifecycleLabel>([[220, 'sell']])
    const result = computeRejection(target, population, labels)
    const r = result.reasons
    const rankIdx      = r.findIndex(x => x.startsWith('Ranked #'))
    const startProbIdx = r.findIndex(x => x.startsWith('Rotation risk'))
    const formIdx      = r.findIndex(x => x.startsWith('Poor form'))
    const fixtureIdx   = r.findIndex(x => x.startsWith('Difficult fixture'))
    const priceIdx     = r.findIndex(x => x.startsWith('Price falling'))
    const fragilityIdx = r.findIndex(x => x.startsWith('Fragile:'))
    const lifecycleIdx = r.findIndex(x => x.startsWith('Lifecycle:'))
    const ownershipIdx = r.findIndex(x => x.startsWith('Owned by'))
    expect(rankIdx).toBe(0)
    expect(startProbIdx).toBeGreaterThan(rankIdx)
    expect(formIdx).toBeGreaterThan(startProbIdx)
    expect(fixtureIdx).toBeGreaterThan(formIdx)
    expect(priceIdx).toBeGreaterThan(fixtureIdx)
    expect(fragilityIdx).toBeGreaterThan(priceIdx)
    expect(lifecycleIdx).toBeGreaterThan(fragilityIdx)
    expect(ownershipIdx).toBeGreaterThan(lifecycleIdx)
  })

  it('exports REJECTION_FORM_THRESHOLD === 3.0', () => {
    expect(REJECTION_FORM_THRESHOLD).toBe(3.0)
  })

  it('exports REJECTION_PRICE_FALLING === 0', () => {
    expect(REJECTION_PRICE_FALLING).toBe(0)
  })
})

describe('computeHeadToHead — Phase 94 WHY-01-B (composition per SC-4)', () => {
  it('returns Y rejection reasons that X does NOT have (form predicate fires for Y only)', () => {
    // X is in form (5.0 pts/90) — no Poor form reason for X.
    // Y is poor form (2.0 pts/90) — fires 'Poor form — 2.0 pts/90 last 5 GWs'.
    const x = makePlayer({ id: 300, element_type: 3, form_pts_per90: 5.0, gem_score: 0.2 })
    const y = makePlayer({ id: 301, element_type: 3, form_pts_per90: 2.0, gem_score: 0.2 })
    // Shared population so xPtsRank ordering is identical for both.
    const population = [x, y, ...makePopulation(x, { sameposBetter: 1 }).filter(p => p.id !== x.id)]
    const result = computeHeadToHead(x, y, population, new Map())
    expect(result).toContain('Poor form — 2.0 pts/90 last 5 GWs')
    // X's reasons should NOT appear in the diff — the diff is reasons Y has that X does not.
    const xReasons = computeRejection(x, population, new Map()).reasons
    for (const reason of result) {
      expect(xReasons).not.toContain(reason)
    }
  })

  it('returns empty array when x and y have identical rejection reason sets (D-11 zero-predicate case)', () => {
    // D-11: when both players are "strong" (gem_score >= posAvg, no fragility, start_prob >= 0.70),
    // computeRejection returns reasons=[] for both -> diff is empty -> computeHeadToHead returns [].
    // Using xPts_1gw: 8.0 so both are rank 1 candidates; sameposWorse: 1 so posAvg < both gem_scores.
    const x = makePlayer({ id: 302, element_type: 3, xPts_1gw: 8.0, form_pts_per90: 5.0, gem_score: 0.8, cost_change_event: 0, start_prob: 0.95, fixtures: [easyFixture] })
    const y = makePlayer({ id: 303, element_type: 3, xPts_1gw: 8.0, form_pts_per90: 5.0, gem_score: 0.8, cost_change_event: 0, start_prob: 0.95, fixtures: [easyFixture] })
    // Add a weaker player so posAvg is below x and y's gem_scores (making both "strong").
    const weaker = makePlayer({ id: 304, element_type: 3, xPts_1gw: 2.0, gem_score: 0.1 })
    const population = [x, y, weaker]
    // Both are strong -> reasons=[] for each -> diff is empty.
    const xReasons = computeRejection(x, population, new Map()).reasons
    const yReasons = computeRejection(y, population, new Map()).reasons
    expect(xReasons).toEqual([])
    expect(yReasons).toEqual([])
    expect(yReasons.filter(r => !xReasons.includes(r))).toEqual([])
    expect(computeHeadToHead(x, y, population, new Map())).toEqual([])
  })

  it('SC-4: composes computeRejection(x) and computeRejection(y) — output equals yReasons.filter(r => !xReasons.includes(r))', () => {
    // SC-4 asserts no parallel rejection logic — the diff MUST equal what you would get
    // by independently calling computeRejection on each player and diffing reasons[].
    // This is the case ROADMAP §Phase 94 SC-4 explicitly names.
    const x = makePlayer({ id: 400, element_type: 3, form_pts_per90: 5.0, gem_score: 0.5, cost_change_event: 0, start_prob: 0.95, fixtures: [easyFixture] })
    const y = makePlayer({ id: 401, element_type: 3, form_pts_per90: 2.0, gem_score: 0.2, cost_change_event: -1, start_prob: 0.5, fixtures: [hardFixture] })
    const population = [x, y, ...makePopulation(y, { sameposBetter: 1 }).filter(p => p.id !== x.id && p.id !== y.id)]
    const labels = new Map<number, LifecycleLabel>([[401, 'sell']])

    const xResult = computeRejection(x, population, labels)
    const yResult = computeRejection(y, population, labels)
    const expected = yResult.reasons.filter(r => !xResult.reasons.includes(r))

    const actual = computeHeadToHead(x, y, population, labels)
    expect(actual).toEqual(expected)
    // Sanity: the diff must be non-empty for this fixture (Y triggers many predicates X does not).
    expect(actual.length).toBeGreaterThan(0)
  })
})
