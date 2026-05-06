// Phase 64 (SENS-01): computeFragility — pure-function unit tests.
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeFragility } from '../sensitivity'
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

describe('computeFragility — Phase 64 SENS-01', () => {
  it('case 1: non-fragile baseline — high start_prob, easy fixture, xPtsGain above threshold', () => {
    const player = makePlayer({ id: 1, element_type: 3, start_prob: 0.9, fixtures: [easyFixture], xPts_1gw: 6.0 })
    const result = computeFragility(player, true, 5.0)
    expect(result).toEqual({ fragile: false, reasons: [] })
  })

  it('case 2: fragile on rotation — start_prob below 0.70 threshold', () => {
    const player = makePlayer({ id: 2, element_type: 3, start_prob: 0.65, fixtures: [easyFixture], xPts_1gw: 6.0 })
    const result = computeFragility(player, true, 5.0)
    expect(result).toEqual({ fragile: true, reasons: ['start_prob < 70%'] })
  })

  it('case 3: fragile on fixture — difficulty_tier is medium', () => {
    const player = makePlayer({ id: 3, element_type: 3, start_prob: 0.9, fixtures: [mediumFixture], xPts_1gw: 6.0 })
    const result = computeFragility(player, true, 5.0)
    expect(result).toEqual({ fragile: true, reasons: ['harder fixture'] })
  })

  it('case 4: fragile on hit — isTransfer=true and xPtsGain < 4.0', () => {
    const player = makePlayer({ id: 4, element_type: 3, start_prob: 0.9, fixtures: [easyFixture], xPts_1gw: 6.0 })
    const result = computeFragility(player, true, 2.5)
    expect(result).toEqual({ fragile: true, reasons: ['taken as a hit (-4pt)'] })
  })

  it('case 5: hit condition ignored when isTransfer=false (captain path)', () => {
    const player = makePlayer({ id: 5, element_type: 3, start_prob: 0.9, fixtures: [easyFixture], xPts_1gw: 6.0 })
    const result = computeFragility(player, false, 2.5)
    expect(result).toEqual({ fragile: false, reasons: [] })
  })

  it('case 6: multiple conditions — rotation + fixture, reasons in correct order', () => {
    const player = makePlayer({ id: 6, element_type: 3, start_prob: 0.5, fixtures: [mediumFixture], xPts_1gw: 6.0 })
    const result = computeFragility(player, true, 5.0)
    expect(result).toEqual({ fragile: true, reasons: ['start_prob < 70%', 'harder fixture'] })
  })

  it('case 7: BGW guard — empty fixtures array does not throw and fixture condition is not triggered', () => {
    const player = makePlayer({ id: 7, element_type: 3, start_prob: 0.9, fixtures: [] })
    expect(() => computeFragility(player, false)).not.toThrow()
    const result = computeFragility(player, false)
    expect(result).toEqual({ fragile: false, reasons: [] })
  })
})
