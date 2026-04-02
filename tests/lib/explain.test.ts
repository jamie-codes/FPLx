import { describe, it, expect } from 'vitest'
import { computeExplanations } from '@/lib/explain'
import type { ScoredPlayer } from '@/lib/types'

// ---------------------------------------------------------------------------
// Threshold constants (must match implementation in src/lib/explain.ts)
// ---------------------------------------------------------------------------
const FORM_POSITIVE_THRESHOLD = 5.0
const FORM_NEGATIVE_THRESHOLD = 3.0
const START_PROB_HIGH = 0.85
const START_PROB_LOW = 0.65
const XG_HIGH = 0.30
const XG_LOW = 0.05
const XA_HIGH = 0.15
const DIFFERENTIAL_THRESHOLD = 10.0
const EASY_FIXTURE_MIN = 2
const HARD_FIXTURE_MIN = 3

// ---------------------------------------------------------------------------
// Test factory (copied exactly from tests/lib/recommend.test.ts)
// ---------------------------------------------------------------------------
function makeScoredPlayer(overrides: Partial<ScoredPlayer> = {}): ScoredPlayer {
  return {
    id: 1,
    web_name: 'Test',
    team: 1,
    team_short_name: 'TST',
    element_type: 3,
    now_cost: 70,
    selected_by_percent: '10.0',
    form: '5.0',
    status: 'a',
    minutes: 900,
    starts: 10,
    total_points: 50,
    goals_scored: 5,
    assists: 3,
    pts_last3gw: 15,
    pts_last5gw: 25,
    pts_gw_count: 30,
    defensive_contribution: null,
    clearances_blocks_interceptions: null,
    direct_freekicks_order: null,
    penalties_order: null,
    corners_and_indirect_freekicks_order: null,
    news: '',
    cost_change_event: 0,
    cost_change_start: 0,
    understat_id: 100,
    xg_per90: 0.3,
    xa_per90: 0.15,
    minutes_per90: 85,
    form_pts_per90: 5.0,
    fixtures: [
      { opponent_team: 'ARS', is_home: true, event_id: 10, difficulty_score: 0.3, difficulty_tier: 'easy' },
      { opponent_team: 'BUR', is_home: false, event_id: 11, difficulty_score: 0.3, difficulty_tier: 'easy' },
      { opponent_team: 'NEW', is_home: true, event_id: 12, difficulty_score: 0.5, difficulty_tier: 'medium' },
    ],
    proj_pts_1gw: 4.5,
    proj_pts_3gw: 12.0,
    proj_pts_5gw: 18.5,
    xmins: 78.0,
    start_prob: 0.87,
    mins_risk: 'nailed' as const,
    gem_score: 0.5,
    fdr_score: 0.5,
    form_score: 0.5,
    xg_score: 0.5,
    xa_score: 0.5,
    ownership_score: 0.5,
    minutes_score: 0.5,
    set_piece_score: 0.5,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Fixture reason tests
// ---------------------------------------------------------------------------
describe('fixture reasons', () => {
  it(`player with ${EASY_FIXTURE_MIN}+ easy fixtures returns "Strong fixture run" reason`, () => {
    const player = makeScoredPlayer({
      fixtures: [
        { opponent_team: 'BUR', is_home: true, event_id: 10, difficulty_score: 0.2, difficulty_tier: 'easy' },
        { opponent_team: 'LEI', is_home: true, event_id: 11, difficulty_score: 0.2, difficulty_tier: 'easy' },
        { opponent_team: 'WOL', is_home: false, event_id: 12, difficulty_score: 0.2, difficulty_tier: 'easy' },
        { opponent_team: 'ARS', is_home: false, event_id: 13, difficulty_score: 0.7, difficulty_tier: 'hard' },
      ],
    })
    const reasons = computeExplanations(player)
    const match = reasons.find(r => r.includes('Strong fixture run'))
    expect(match).toBeDefined()
    expect(match).toContain('3 easy games next 5 GWs')
  })

  it(`player with ${HARD_FIXTURE_MIN}+ hard fixtures returns "Difficult fixtures" reason`, () => {
    const player = makeScoredPlayer({
      fixtures: [
        { opponent_team: 'MCI', is_home: false, event_id: 10, difficulty_score: 0.9, difficulty_tier: 'hard' },
        { opponent_team: 'LIV', is_home: false, event_id: 11, difficulty_score: 0.85, difficulty_tier: 'hard' },
        { opponent_team: 'ARS', is_home: false, event_id: 12, difficulty_score: 0.8, difficulty_tier: 'hard' },
        { opponent_team: 'BUR', is_home: true, event_id: 13, difficulty_score: 0.2, difficulty_tier: 'easy' },
      ],
    })
    const reasons = computeExplanations(player)
    const match = reasons.find(r => r.includes('Difficult fixtures'))
    expect(match).toBeDefined()
    expect(match).toContain('3 hard games next 5 GWs')
  })
})

// ---------------------------------------------------------------------------
// Form reason tests
// ---------------------------------------------------------------------------
describe('form reasons', () => {
  it(`player with form_pts_per90=${FORM_POSITIVE_THRESHOLD + 1.2} returns "In form" reason`, () => {
    const player = makeScoredPlayer({ form_pts_per90: 6.2 })
    const reasons = computeExplanations(player)
    const match = reasons.find(r => r.includes('In form'))
    expect(match).toBeDefined()
    expect(match).toContain('6.2 pts/90 last 5 GWs')
  })

  it(`player with form_pts_per90=${FORM_NEGATIVE_THRESHOLD - 0.9} returns "Poor form" reason`, () => {
    const player = makeScoredPlayer({ form_pts_per90: 2.1 })
    const reasons = computeExplanations(player)
    const match = reasons.find(r => r.includes('Poor form'))
    expect(match).toBeDefined()
    expect(match).toContain('2.1 pts/90 last 5 GWs')
  })
})

// ---------------------------------------------------------------------------
// Projected pts test
// ---------------------------------------------------------------------------
describe('projected pts', () => {
  it('player with proj_pts_1gw=7.5 returns "Projected 7.5 pts next GW" reason', () => {
    const player = makeScoredPlayer({ proj_pts_1gw: 7.5 })
    const reasons = computeExplanations(player)
    const match = reasons.find(r => r.includes('Projected'))
    expect(match).toBeDefined()
    expect(match).toContain('7.5 pts next GW')
  })
})

// ---------------------------------------------------------------------------
// Start probability tests
// ---------------------------------------------------------------------------
describe('start probability', () => {
  it(`player with start_prob=${START_PROB_HIGH + 0.07} returns "High start probability" reason`, () => {
    const player = makeScoredPlayer({ start_prob: 0.92 })
    const reasons = computeExplanations(player)
    const match = reasons.find(r => r.includes('High start probability'))
    expect(match).toBeDefined()
    expect(match).toContain('92%')
  })

  it(`player with start_prob=${START_PROB_LOW - 0.10} returns "Low start probability" reason`, () => {
    const player = makeScoredPlayer({ start_prob: 0.55 })
    const reasons = computeExplanations(player)
    const match = reasons.find(r => r.includes('Low start probability'))
    expect(match).toBeDefined()
    expect(match).toContain('55%')
  })
})

// ---------------------------------------------------------------------------
// xG/xA reason tests
// ---------------------------------------------------------------------------
describe('xG/xA reasons', () => {
  it(`player with xg_per90=${XG_HIGH + 0.15} returns "High xG" reason`, () => {
    const player = makeScoredPlayer({ xg_per90: 0.45 })
    const reasons = computeExplanations(player)
    const match = reasons.find(r => r.includes('High xG'))
    expect(match).toBeDefined()
    expect(match).toContain('0.45/90')
  })

  it(`MID player with xg_per90=${XG_LOW - 0.03} (element_type=3) returns "Low xG" reason`, () => {
    const player = makeScoredPlayer({ xg_per90: 0.02, element_type: 3 })
    const reasons = computeExplanations(player)
    const match = reasons.find(r => r.includes('Low xG'))
    expect(match).toBeDefined()
    expect(match).toContain('0.02/90')
  })

  it(`DEF player with xg_per90=${XG_LOW - 0.03} (element_type=2) does NOT return "Low xG" reason`, () => {
    const player = makeScoredPlayer({ xg_per90: 0.02, element_type: 2 })
    const reasons = computeExplanations(player)
    const match = reasons.find(r => r.includes('Low xG'))
    expect(match).toBeUndefined()
  })

  it(`player with xa_per90=${XA_HIGH + 0.10} returns "Creative" reason`, () => {
    const player = makeScoredPlayer({ xa_per90: 0.25 })
    const reasons = computeExplanations(player)
    const match = reasons.find(r => r.includes('Creative'))
    expect(match).toBeDefined()
    expect(match).toContain('0.25 xA/90')
  })

  it('player with xg_per90=null does NOT return any xG reason', () => {
    const player = makeScoredPlayer({ xg_per90: null, xg_score: null })
    const reasons = computeExplanations(player)
    const xgReasons = reasons.filter(r => r.includes('xG'))
    expect(xgReasons).toHaveLength(0)
  })

  it('player with xa_per90=null does NOT return any xA reason', () => {
    const player = makeScoredPlayer({ xa_per90: null, xa_score: null })
    const reasons = computeExplanations(player)
    const xaReasons = reasons.filter(r => r.includes('xA'))
    expect(xaReasons).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Set piece role tests
// ---------------------------------------------------------------------------
describe('set piece roles', () => {
  it('player with penalties_order=1 returns "Primary penalty taker"', () => {
    const player = makeScoredPlayer({ penalties_order: 1 })
    const reasons = computeExplanations(player)
    expect(reasons).toContain('Primary penalty taker')
  })

  it('player with direct_freekicks_order=1 returns "Direct free-kick taker"', () => {
    const player = makeScoredPlayer({ direct_freekicks_order: 1 })
    const reasons = computeExplanations(player)
    expect(reasons).toContain('Direct free-kick taker')
  })

  it('player with corners_and_indirect_freekicks_order=1 returns "Corner/set piece taker"', () => {
    const player = makeScoredPlayer({ corners_and_indirect_freekicks_order: 1 })
    const reasons = computeExplanations(player)
    expect(reasons).toContain('Corner/set piece taker')
  })
})

// ---------------------------------------------------------------------------
// Ownership / differential tests
// ---------------------------------------------------------------------------
describe('ownership', () => {
  it(`player with selected_by_percent="${DIFFERENTIAL_THRESHOLD - 4.7}" returns "Differential" reason`, () => {
    const player = makeScoredPlayer({ selected_by_percent: '5.3' })
    const reasons = computeExplanations(player)
    const match = reasons.find(r => r.includes('Differential'))
    expect(match).toBeDefined()
    expect(match).toContain('5.3% owned')
  })

  it(`player with selected_by_percent="${DIFFERENTIAL_THRESHOLD + 5.0}" does NOT return "Differential"`, () => {
    const player = makeScoredPlayer({ selected_by_percent: '15.0' })
    const reasons = computeExplanations(player)
    const match = reasons.find(r => r.includes('Differential'))
    expect(match).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Exclusion tests
// ---------------------------------------------------------------------------
describe('exclusions', () => {
  it('no reason string contains "mins_risk" (excluded per D-03)', () => {
    const player = makeScoredPlayer()
    const reasons = computeExplanations(player)
    const forbidden = reasons.filter(r => r.toLowerCase().includes('mins_risk'))
    expect(forbidden).toHaveLength(0)
  })

  it('no reason string contains "rotation" (excluded per D-03)', () => {
    const player = makeScoredPlayer()
    const reasons = computeExplanations(player)
    const forbidden = reasons.filter(r => r.toLowerCase().includes('rotation'))
    expect(forbidden).toHaveLength(0)
  })
})
