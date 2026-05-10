// Phase 64+93 (SENS-01): computeFragility — pure-function unit tests.
// @vitest-environment node
import { describe, it, expect } from 'vitest'
// RED phase: FRAGILITY_MINS60 + FRAGILITY_NEWS_DOUBT are not yet exported from sensitivity.ts.
// They will be added in 093-02. Vitest transpiles with esbuild (no TS type-check) so the
// import resolves at runtime — the symbols are undefined until 093-02 ships.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — named exports FRAGILITY_MINS60/FRAGILITY_NEWS_DOUBT missing until 093-02
import {
  computeFragility,
  FRAGILITY_START_PROB,
  FRAGILITY_HARDER_FIXTURE,
  FRAGILITY_MINS60,
  FRAGILITY_NEWS_DOUBT,
} from '../sensitivity'
import type { MergedPlayer, FixtureEntry } from '../types'

type PlayerOverrides = Partial<MergedPlayer> & {
  id: number
  element_type: 1 | 2 | 3 | 4
}

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
    // MC fields default to undefined (absent)
    haul_prob: undefined,
    p10_pts: undefined,
    p90_pts: undefined,
    blank_prob: undefined,
    ...overrides,
  } as MergedPlayer
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
  opponent_team: 'MCI',
  is_home: false,
  event_id: 28,
  difficulty_score: 0.9,
  difficulty_tier: 'hard',
}

describe('computeFragility — Phase 64+93 SENS-01', () => {
  // ─── Migrated Phase 64 cases (shape: { fragile: boolean } → { tier: FragilityTier }) ───

  it('case 1: non-fragile baseline — high start_prob, easy fixture, xPtsGain above threshold', () => {
    const player = makePlayer({ id: 1, element_type: 3, start_prob: 0.9, fixtures: [easyFixture], xPts_1gw: 6.0 })
    const result = computeFragility(player, true, 5.0)
    expect(result).toEqual({ tier: 'robust', reasons: [] })
  })

  it('case 2: fragile on rotation — start_prob below 0.70 threshold', () => {
    const player = makePlayer({ id: 2, element_type: 3, start_prob: 0.65, fixtures: [easyFixture], xPts_1gw: 6.0 })
    const result = computeFragility(player, true, 5.0)
    expect(result).toEqual({ tier: 'fragile', reasons: [FRAGILITY_START_PROB] })
  })

  it('case 3: fragile on fixture — difficulty_tier is medium', () => {
    const player = makePlayer({ id: 3, element_type: 3, start_prob: 0.9, fixtures: [mediumFixture], xPts_1gw: 6.0 })
    const result = computeFragility(player, true, 5.0)
    expect(result).toEqual({ tier: 'fragile', reasons: [FRAGILITY_HARDER_FIXTURE] })
  })

  it('case 4: fragile on hit — isTransfer=true and xPtsGain=4.5 (below Phase 93 threshold 5.0)', () => {
    const player = makePlayer({ id: 4, element_type: 3, start_prob: 0.9, fixtures: [easyFixture], xPts_1gw: 6.0 })
    const result = computeFragility(player, true, 4.5)
    expect(result).toEqual({ tier: 'fragile', reasons: ['taken as a hit (-4pt)'] })
  })

  it('case 5: hit condition ignored when isTransfer=false (captain path)', () => {
    const player = makePlayer({ id: 5, element_type: 3, start_prob: 0.9, fixtures: [easyFixture], xPts_1gw: 6.0 })
    const result = computeFragility(player, false, 2.5)
    expect(result).toEqual({ tier: 'robust', reasons: [] })
  })

  it('case 6: multiple conditions — rotation + fixture, 2 reversals → knife_edge (D-06)', () => {
    const player = makePlayer({ id: 6, element_type: 3, start_prob: 0.5, fixtures: [mediumFixture], xPts_1gw: 6.0 })
    const result = computeFragility(player, true, 5.0)
    expect(result).toEqual({ tier: 'knife_edge', reasons: [FRAGILITY_START_PROB, FRAGILITY_HARDER_FIXTURE] })
  })

  it('case 7: BGW guard — empty fixtures array does not throw and fixture condition is not triggered', () => {
    const player = makePlayer({ id: 7, element_type: 3, start_prob: 0.9, fixtures: [] })
    expect(() => computeFragility(player, false)).not.toThrow()
    const result = computeFragility(player, false)
    expect(result).toEqual({ tier: 'robust', reasons: [] })
  })

  // ─── Phase 93 NEW cases (perturbations a–e, tristate tier, skip rules, knife_edge accumulation) ───

  it('case 8: perturbation a — start_prob borderline reversal (0.84 - 0.15 = 0.69 < 0.70)', () => {
    const player = makePlayer({ id: 8, element_type: 3, start_prob: 0.84, fixtures: [easyFixture] })
    const result = computeFragility(player, false)
    expect(result).toEqual({ tier: 'fragile', reasons: [FRAGILITY_START_PROB] })
  })

  it('case 9: perturbation a — start_prob does NOT reverse (0.86 - 0.15 = 0.71 ≥ 0.70)', () => {
    const player = makePlayer({ id: 9, element_type: 3, start_prob: 0.86, fixtures: [easyFixture] })
    const result = computeFragility(player, false)
    expect(result).toEqual({ tier: 'robust', reasons: [] })
  })

  it('case 10: perturbation b — mins_60_prob present and reverses (0.65 - 0.10 = 0.55 < 0.60)', () => {
    const player = makePlayer({
      id: 10,
      element_type: 3,
      start_prob: 0.95,
      mins_60_prob: 0.65,
      fixtures: [easyFixture],
    })
    const result = computeFragility(player, false)
    expect(result).toEqual({ tier: 'fragile', reasons: [FRAGILITY_MINS60] })
  })

  it('case 11: perturbation b — mins_60_prob undefined SKIPS the perturbation → robust', () => {
    // mins_60_prob is absent from overrides → undefined in makePlayer → perturbation (b) skipped
    const player = makePlayer({
      id: 11,
      element_type: 3,
      start_prob: 0.95,
      fixtures: [easyFixture],
    })
    const result = computeFragility(player, false)
    expect(result).toEqual({ tier: 'robust', reasons: [] })
  })

  it('case 12: perturbation b — mins_60_prob does not reverse (0.75 - 0.10 = 0.65 ≥ 0.60)', () => {
    const player = makePlayer({
      id: 12,
      element_type: 3,
      start_prob: 0.95,
      mins_60_prob: 0.75,
      fixtures: [easyFixture],
    })
    const result = computeFragility(player, false)
    expect(result).toEqual({ tier: 'robust', reasons: [] })
  })

  it('case 13: perturbation c — easy fixture perturbed to medium triggers reversal', () => {
    const player = makePlayer({
      id: 13,
      element_type: 3,
      start_prob: 0.95,
      fixtures: [easyFixture],
    })
    const result = computeFragility(player, false)
    expect(result).toEqual({ tier: 'fragile', reasons: [FRAGILITY_HARDER_FIXTURE] })
  })

  it('case 14: perturbation c — medium fixture perturbed to hard also triggers reversal', () => {
    const player = makePlayer({
      id: 14,
      element_type: 3,
      start_prob: 0.95,
      fixtures: [mediumFixture],
    })
    const result = computeFragility(player, false)
    expect(result).toEqual({ tier: 'fragile', reasons: [FRAGILITY_HARDER_FIXTURE] })
  })

  it('case 15: perturbation c — hard fixture cannot increment, perturbation skipped → robust', () => {
    const player = makePlayer({
      id: 15,
      element_type: 3,
      start_prob: 0.95,
      fixtures: [hardFixture],
    })
    const result = computeFragility(player, false)
    expect(result).toEqual({ tier: 'robust', reasons: [] })
  })

  it('case 16: perturbation d — captain path skips cost perturbation (isTransfer=false)', () => {
    const player = makePlayer({
      id: 16,
      element_type: 3,
      start_prob: 0.95,
      fixtures: [easyFixture],
    })
    const result = computeFragility(player, false, 2.0)
    expect(result).toEqual({ tier: 'robust', reasons: [] })
  })

  it('case 17: perturbation d — xPtsGain=4.99 triggers reversal (4.99 < 5.0)', () => {
    const player = makePlayer({
      id: 17,
      element_type: 3,
      start_prob: 0.95,
      fixtures: [easyFixture],
    })
    const result = computeFragility(player, true, 4.99)
    expect(result).toEqual({ tier: 'fragile', reasons: ['taken as a hit (-4pt)'] })
  })

  it('case 18: perturbation d — xPtsGain=5.0 exactly does NOT reverse (5.0 < 5.0 is false)', () => {
    const player = makePlayer({
      id: 18,
      element_type: 3,
      start_prob: 0.95,
      fixtures: [easyFixture],
    })
    const result = computeFragility(player, true, 5.0)
    expect(result).toEqual({ tier: 'robust', reasons: [] })
  })

  it('case 19: perturbation e — healthy player (chance=null → 100 > 50), news flip is a reversal', () => {
    const player = makePlayer({
      id: 19,
      element_type: 3,
      start_prob: 0.95,
      fixtures: [easyFixture],
      chance_of_playing_next_round: null,
    })
    const result = computeFragility(player, false)
    expect(result).toEqual({ tier: 'fragile', reasons: [FRAGILITY_NEWS_DOUBT] })
  })

  it('case 20: perturbation e — already doubtful (chance=50 ≤ 50) skips news perturbation → robust', () => {
    const player = makePlayer({
      id: 20,
      element_type: 3,
      start_prob: 0.95,
      fixtures: [easyFixture],
      chance_of_playing_next_round: 50,
    })
    const result = computeFragility(player, false)
    expect(result).toEqual({ tier: 'robust', reasons: [] })
  })

  it('case 21: perturbation e — chance=75 (> 50) triggers news reversal', () => {
    const player = makePlayer({
      id: 21,
      element_type: 3,
      start_prob: 0.95,
      fixtures: [easyFixture],
      chance_of_playing_next_round: 75,
    })
    const result = computeFragility(player, false)
    expect(result).toEqual({ tier: 'fragile', reasons: [FRAGILITY_NEWS_DOUBT] })
  })

  it('case 22: knife_edge — exactly 2 reversals: start_prob + mins_60_prob; BGW skips (c), chance=50 skips (e)', () => {
    // start_prob=0.84: 0.84 - 0.15 = 0.69 < 0.70 → reversal (a)
    // mins_60_prob=0.65: 0.65 - 0.10 = 0.55 < 0.60 → reversal (b)
    // fixtures=[]: BGW guard → perturbation (c) skipped
    // chance_of_playing_next_round=50: already doubtful → perturbation (e) skipped
    // isTransfer=false: perturbation (d) skipped
    // Total: 2 reversals → knife_edge
    const player = makePlayer({
      id: 22,
      element_type: 3,
      start_prob: 0.84,
      mins_60_prob: 0.65,
      fixtures: [],
      chance_of_playing_next_round: 50,
    })
    const result = computeFragility(player, false)
    expect(result).toEqual({ tier: 'knife_edge', reasons: [FRAGILITY_START_PROB, FRAGILITY_MINS60] })
  })

  it('case 23: knife_edge — 3 reversals: start_prob + mins_60_prob + medium fixture; chance=50 skips (e)', () => {
    // start_prob=0.84: 0.84 - 0.15 = 0.69 < 0.70 → reversal (a)
    // mins_60_prob=0.65: 0.65 - 0.10 = 0.55 < 0.60 → reversal (b)
    // mediumFixture: medium → hard → reversal (c)
    // chance_of_playing_next_round=50: already doubtful → perturbation (e) skipped
    // isTransfer=false: perturbation (d) skipped
    // Total: 3 reversals → knife_edge; reasons ordered (a)→(b)→(c)
    const player = makePlayer({
      id: 23,
      element_type: 3,
      start_prob: 0.84,
      mins_60_prob: 0.65,
      fixtures: [mediumFixture],
      chance_of_playing_next_round: 50,
    })
    const result = computeFragility(player, false)
    expect(result).toEqual({
      tier: 'knife_edge',
      reasons: [FRAGILITY_START_PROB, FRAGILITY_MINS60, FRAGILITY_HARDER_FIXTURE],
    })
  })

  it('case 24: engine is callable in node environment — result has string tier and array reasons (SC-5)', () => {
    const player = makePlayer({ id: 24, element_type: 3, start_prob: 0.9, fixtures: [easyFixture] })
    const result = computeFragility(player, false)
    expect(typeof result.tier).toBe('string')
    expect(Array.isArray(result.reasons)).toBe(true)
  })
})
