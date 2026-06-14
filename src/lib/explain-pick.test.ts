// PICK-02: unit tests for the explainPick pure function.
// Written FIRST per TDD — no implementation exists yet.
import { describe, it, expect } from 'vitest'
import { explainPick } from './explain-pick'
import type { MergedPlayer } from './types'

function player(over: Partial<MergedPlayer>): MergedPlayer {
  return {
    id: 1,
    web_name: 'P',
    team: 1,
    team_short_name: 'ARS',
    element_type: 4,
    now_cost: 60,
    selected_by_percent: '10.0',
    form: '5.0',
    status: 'a',
    minutes: 900,
    starts: 10,
    total_points: 50,
    goals_scored: 5,
    assists: 3,
    expected_goals: 4.0,
    expected_assists: 2.5,
    pts_last3gw: 15,
    pts_last5gw: 24,
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
    understat_id: 1,
    xg_per90: null,
    xa_per90: null,
    minutes_per90: 1.0,
    form_pts_per90: 5.0,
    fixtures: [],
    xmins: 90,
    start_prob: 0.85,
    mins_risk: 'likely_start',
    ...over,
  } as MergedPlayer
}

// -------------------------------------------------------------------------
// Reasons
// -------------------------------------------------------------------------

describe('explainPick — reasons', () => {
  it('strong xG fires when xg_per90 >= 0.45 with formatted value', () => {
    const { reasons } = explainPick(player({ xg_per90: 0.52 }))
    expect(reasons.some((r) => r.includes('0.52') && /goal threat/i.test(r))).toBe(true)
  })

  it('xA creator fires when xa_per90 >= 0.30 with formatted value', () => {
    const { reasons } = explainPick(player({ xa_per90: 0.33 }))
    expect(reasons.some((r) => r.includes('0.33') && /creator/i.test(r))).toBe(true)
  })

  it('favourable fixtures fires when mean of next 3 difficulty_score <= 0.40', () => {
    const fixtures = [
      { opponent_team: 'A', is_home: true, event_id: 1, difficulty_score: 0.25, difficulty_tier: 'easy' as const },
      { opponent_team: 'B', is_home: false, event_id: 2, difficulty_score: 0.30, difficulty_tier: 'easy' as const },
      { opponent_team: 'C', is_home: true, event_id: 3, difficulty_score: 0.35, difficulty_tier: 'easy' as const },
      { opponent_team: 'D', is_home: false, event_id: 4, difficulty_score: 0.90, difficulty_tier: 'hard' as const },
    ]
    const { reasons } = explainPick(player({ fixtures }))
    expect(reasons.some((r) => /favourable fixture/i.test(r))).toBe(true)
  })

  it('does NOT fire favourable fixtures when mean > 0.40', () => {
    const fixtures = [
      { opponent_team: 'A', is_home: true, event_id: 1, difficulty_score: 0.70, difficulty_tier: 'hard' as const },
      { opponent_team: 'B', is_home: false, event_id: 2, difficulty_score: 0.80, difficulty_tier: 'hard' as const },
    ]
    const { reasons } = explainPick(player({ fixtures }))
    expect(reasons.some((r) => /favourable fixture/i.test(r))).toBe(false)
  })

  it('nailed starter fires when mins_risk === "nailed"', () => {
    const { reasons } = explainPick(player({ mins_risk: 'nailed', start_prob: 0.95 }))
    expect(reasons.some((r) => /nailed starter/i.test(r))).toBe(true)
  })

  it('nailed starter fires when start_prob >= 0.9', () => {
    const { reasons } = explainPick(player({ mins_risk: 'likely_start', start_prob: 0.92 }))
    expect(reasons.some((r) => /nailed starter/i.test(r))).toBe(true)
  })

  it('on penalties fires when penalties_order === 1', () => {
    const { reasons } = explainPick(player({ penalties_order: 1 }))
    expect(reasons.some((r) => /on penalties/i.test(r))).toBe(true)
  })

  it('set-piece taker fires when direct_freekicks_order === 1 (no penalty)', () => {
    const { reasons } = explainPick(player({ direct_freekicks_order: 1, penalties_order: null }))
    expect(reasons.some((r) => /set.piece taker/i.test(r))).toBe(true)
  })

  it('set-piece taker fires when corners_and_indirect_freekicks_order === 1 (no penalty or direct FK)', () => {
    const { reasons } = explainPick(player({
      corners_and_indirect_freekicks_order: 1,
      direct_freekicks_order: null,
      penalties_order: null,
    }))
    expect(reasons.some((r) => /set.piece taker/i.test(r))).toBe(true)
  })

  it('bonus magnet fires when bonus_ev >= 0.8 with formatted EV', () => {
    const { reasons } = explainPick(player({ bonus_ev: 1.1 }))
    expect(reasons.some((r) => /bonus magnet/i.test(r) && r.includes('1.1'))).toBe(true)
  })

  it('DefCon fires when xPts_components_1gw.defcon >= 0.5', () => {
    const { reasons } = explainPick(player({
      xPts_components_1gw: {
        goal_pts: 1.0, assist_pts: 0.5, cs_pts: 0.3, bonus_pts: 0.5,
        appearance_pts: 2.0, defcon: 0.6,
      },
    }))
    expect(reasons.some((r) => /defcon/i.test(r))).toBe(true)
  })

  it('differential fires when differential_flag === "diff" with ownership', () => {
    const { reasons } = explainPick(player({
      differential_flag: 'diff',
      selected_by_percent: '3.8',
    }))
    expect(reasons.some((r) => /differential/i.test(r) && r.includes('3.8'))).toBe(true)
  })

  it('haul_prob fires when >= 0.30 with formatted percentage', () => {
    const { reasons } = explainPick(player({ haul_prob: 0.35 }))
    // spec: haul_prob*100|0 => 35
    expect(reasons.some((r) => /high ceiling/i.test(r) && r.includes('35'))).toBe(true)
  })

  it('reasons are capped at 4 even when all rules fire', () => {
    const { reasons } = explainPick(player({
      xg_per90: 0.60,
      xa_per90: 0.40,
      fixtures: [
        { opponent_team: 'A', is_home: true, event_id: 1, difficulty_score: 0.20, difficulty_tier: 'easy' as const },
      ],
      mins_risk: 'nailed',
      start_prob: 0.98,
      penalties_order: 1,
      bonus_ev: 1.2,
      xPts_components_1gw: {
        goal_pts: 2.0, assist_pts: 1.0, cs_pts: 0.3, bonus_pts: 0.8,
        appearance_pts: 2.0, defcon: 0.7,
      },
      differential_flag: 'diff',
      selected_by_percent: '2.0',
      haul_prob: 0.45,
    }))
    expect(reasons.length).toBeLessThanOrEqual(4)
  })
})

// -------------------------------------------------------------------------
// Risks
// -------------------------------------------------------------------------

describe('explainPick — risks', () => {
  it('doubtful risk fires when status === "d"', () => {
    const { risks } = explainPick(player({ status: 'd', news: '' }))
    expect(risks.some((r) => /doubtful/i.test(r))).toBe(true)
  })

  it('includes news text in the risk when news is present', () => {
    const { risks } = explainPick(player({ status: 'd', news: 'Knock — 50% chance' }))
    expect(risks.some((r) => r.includes('Knock — 50% chance'))).toBe(true)
  })

  it('status "i" renders Injured', () => {
    const { risks } = explainPick(player({ status: 'i' }))
    expect(risks.some((r) => /injured/i.test(r))).toBe(true)
  })

  it('status "s" renders Suspended', () => {
    const { risks } = explainPick(player({ status: 's' }))
    expect(risks.some((r) => /suspended/i.test(r))).toBe(true)
  })

  it('rotation_risk fires when mins_risk === "rotation_risk"', () => {
    const { risks } = explainPick(player({ mins_risk: 'rotation_risk' }))
    expect(risks.some((r) => /rotation risk/i.test(r))).toBe(true)
  })

  it('rotation_risk fires when mins_risk === "cameo"', () => {
    const { risks } = explainPick(player({ mins_risk: 'cameo' }))
    expect(risks.some((r) => /rotation risk/i.test(r))).toBe(true)
  })

  it('rotation_risk fires when rotation_risk === true', () => {
    const { risks } = explainPick(player({ mins_risk: 'likely_start', rotation_risk: true }))
    expect(risks.some((r) => /rotation risk/i.test(r))).toBe(true)
  })

  it('tough fixtures fires when mean next 3 difficulty_score >= 0.66', () => {
    const fixtures = [
      { opponent_team: 'X', is_home: false, event_id: 1, difficulty_score: 0.80, difficulty_tier: 'hard' as const },
      { opponent_team: 'Y', is_home: false, event_id: 2, difficulty_score: 0.70, difficulty_tier: 'hard' as const },
    ]
    const { risks } = explainPick(player({ fixtures }))
    expect(risks.some((r) => /tough fixture/i.test(r))).toBe(true)
  })

  it('mins_60_prob fires when present and < 0.6', () => {
    const { risks } = explainPick(player({ mins_60_prob: 0.45 }))
    expect(risks.some((r) => /60 min/i.test(r))).toBe(true)
  })

  it('blank_prob fires when >= 0.45 with formatted percentage', () => {
    const { risks } = explainPick(player({ blank_prob: 0.50 }))
    expect(risks.some((r) => /blank/i.test(r) && r.includes('50'))).toBe(true)
  })

  it('template trap fires when differential_flag === "trap"', () => {
    const { risks } = explainPick(player({
      differential_flag: 'trap',
      selected_by_percent: '25.0',
    }))
    expect(risks.some((r) => /trap/i.test(r) && r.includes('25.0'))).toBe(true)
  })

  it('limited minutes sample fires when minutes < 270', () => {
    const { risks } = explainPick(player({ minutes: 200 }))
    expect(risks.some((r) => /limited minutes/i.test(r))).toBe(true)
  })

  it('risks are capped at 3 even when all risk rules fire', () => {
    const fixtures = [
      { opponent_team: 'X', is_home: false, event_id: 1, difficulty_score: 0.80, difficulty_tier: 'hard' as const },
      { opponent_team: 'Y', is_home: false, event_id: 2, difficulty_score: 0.75, difficulty_tier: 'hard' as const },
    ]
    const { risks } = explainPick(player({
      status: 'd',
      news: 'Touch and go',
      mins_risk: 'rotation_risk',
      rotation_risk: true,
      fixtures,
      mins_60_prob: 0.4,
      blank_prob: 0.55,
      differential_flag: 'trap',
      selected_by_percent: '22.0',
      minutes: 100,
    }))
    expect(risks.length).toBeLessThanOrEqual(3)
  })
})

// -------------------------------------------------------------------------
// Fallback / empty player
// -------------------------------------------------------------------------

describe('explainPick — fallback and empty', () => {
  it('empty player returns the fallback reason', () => {
    const { reasons } = explainPick(player({
      xg_per90: null,
      xa_per90: null,
      fixtures: [],
      mins_risk: 'likely_start',
      start_prob: 0.5,
      penalties_order: null,
      direct_freekicks_order: null,
      corners_and_indirect_freekicks_order: null,
      bonus_ev: null,
      xPts_components_1gw: null,
      differential_flag: null,
      haul_prob: undefined,
    }))
    expect(reasons.length).toBeGreaterThanOrEqual(1)
    // When no reasons fire, fallback text appears
    expect(reasons[0]).toMatch(/ranked on overall xpts/i)
  })

  it('empty player has empty risks array', () => {
    const { risks } = explainPick(player({
      status: 'a',
      mins_risk: 'likely_start',
      rotation_risk: false,
      fixtures: [],
      mins_60_prob: undefined,
      blank_prob: undefined,
      differential_flag: null,
      minutes: 1000,
    }))
    expect(risks).toHaveLength(0)
  })
})

// -------------------------------------------------------------------------
// Number formatting
// -------------------------------------------------------------------------

describe('explainPick — number formatting', () => {
  it('xg_per90 shows exactly 2 decimal places', () => {
    const { reasons } = explainPick(player({ xg_per90: 0.5 }))
    const r = reasons.find((s) => /goal threat/i.test(s))
    expect(r).toBeTruthy()
    expect(r).toMatch(/0\.50/)
  })

  it('xa_per90 shows exactly 2 decimal places', () => {
    const { reasons } = explainPick(player({ xa_per90: 0.3 }))
    const r = reasons.find((s) => /creator/i.test(s))
    expect(r).toBeTruthy()
    expect(r).toMatch(/0\.30/)
  })

  it('haul_prob is shown as integer percent (truncated, not rounded)', () => {
    const { reasons } = explainPick(player({ haul_prob: 0.399 }))
    // 0.399 * 100 | 0 = 39
    const r = reasons.find((s) => /high ceiling/i.test(s))
    expect(r).toBeTruthy()
    expect(r).toMatch(/39%/)
  })

  it('blank_prob is shown as integer percent (truncated)', () => {
    const { risks } = explainPick(player({ blank_prob: 0.499 }))
    // 0.499 * 100 | 0 = 49
    const r = risks.find((s) => /blank/i.test(s))
    expect(r).toBeTruthy()
    expect(r).toMatch(/49%/)
  })

  it('bonus_ev is formatted to 1 decimal place', () => {
    const { reasons } = explainPick(player({ bonus_ev: 1.16 }))
    const r = reasons.find((s) => /bonus magnet/i.test(s))
    expect(r).toBeTruthy()
    expect(r).toMatch(/1\.2/)   // (1.16).toFixed(1) === "1.2"
  })
})
