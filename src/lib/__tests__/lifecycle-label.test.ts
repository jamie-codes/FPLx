import { describe, it, expect } from 'vitest'
import {
  computeLifecycleLabel,
  computeLifecycleLabels,
  SELL_THRESHOLD,
  SELL_SOON_THRESHOLD,
  SWING_THRESHOLD,
  MINUTES_TRAP_MIN_COST,
  MINUTES_TRAP_START_PROB,
} from '@/lib/lifecycle-label'
import type { ScoredPlayer } from '@/lib/types'
import type { ClubForm } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal ScoredPlayer with sensible defaults.
 * gem_score defaults to 0.5 (position average assumed 0.5 for most tests).
 */
function makePlayer(overrides: Partial<ScoredPlayer> = {}): ScoredPlayer {
  return {
    id: 1,
    web_name: 'Test',
    team: 10,
    team_short_name: 'TST',
    element_type: 3,
    now_cost: 65,
    selected_by_percent: '5.0',
    form: '5.0',
    status: 'a',
    minutes: 450,
    starts: 5,
    total_points: 30,
    goals_scored: 3,
    assists: 2,
    expected_goals: 2.5,
    expected_assists: 1.5,
    pts_last3gw: 18,
    pts_last5gw: 30,
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
    xg_per90: 0.3,
    xa_per90: 0.2,
    minutes_per90: 80,
    form_pts_per90: 6.0,
    fixtures: [],
    xmins: 80,
    start_prob: 0.85,
    mins_risk: 'likely_start',
    gem_score: 0.5,
    fdr_score: 0.5,
    form_score: 0.5,
    xg_score: 0.5,
    xa_score: 0.5,
    ownership_score: 0.5,
    minutes_score: 0.5,
    set_piece_score: 0.0,
    ...overrides,
  }
}

/**
 * Build a minimal ClubForm with no swing signals (all null).
 */
function makeClubForm(overrides: Partial<ClubForm> = {}): ClubForm {
  return {
    team_id: 10,
    team_name: 'Test FC',
    team_short_name: 'TST',
    wins: 3,
    draws: 1,
    losses: 1,
    goals_scored: 8,
    goals_conceded: 5,
    upcoming_fixtures: [],
    current_gw_played: [],   // Phase 111 FIX-01
    attacking_ease_1gw: 0.5,
    attacking_ease_3gw: 0.5,
    attacking_ease_5gw: 0.5,
    defensive_ease_1gw: 0.5,
    defensive_ease_3gw: 0.5,
    defensive_ease_5gw: 0.5,
    past_ease_3gw: 0.5,
    swing_1gw: null,
    swing_3gw: null,
    swing_5gw: null,
    ...overrides,
  }
}

/**
 * Build a minimal SquadPick.
 */
function makePick(element: number, position: number): SquadPick {
  return {
    element,
    position,
    multiplier: 1,
    is_captain: false,
    is_vice_captain: false,
  }
}

// ---------------------------------------------------------------------------
// Constant exports
// ---------------------------------------------------------------------------

describe('lifecycle-label constants', () => {
  it('exports SELL_THRESHOLD = 0.85', () => {
    expect(SELL_THRESHOLD).toBe(0.85)
  })

  it('exports SELL_SOON_THRESHOLD = 0.90', () => {
    expect(SELL_SOON_THRESHOLD).toBe(0.90)
  })

  it('exports SWING_THRESHOLD = 0.20', () => {
    expect(SWING_THRESHOLD).toBe(0.20)
  })

  it('exports MINUTES_TRAP_MIN_COST = 70', () => {
    expect(MINUTES_TRAP_MIN_COST).toBe(70)
  })

  it('exports MINUTES_TRAP_START_PROB = 0.65', () => {
    expect(MINUTES_TRAP_START_PROB).toBe(0.65)
  })
})

// ---------------------------------------------------------------------------
// Individual label tests (direct computeLifecycleLabel)
// ---------------------------------------------------------------------------

describe('computeLifecycleLabel — individual labels', () => {
  const posAvg = 0.5

  it('Test 5: Sell fires at 84% of posAvg', () => {
    const player = makePlayer({ gem_score: posAvg * 0.84 })
    expect(computeLifecycleLabel(player, posAvg, null)).toBe('sell')
  })

  it('Test 6: Sell Soon fires at 88% of posAvg (no swing)', () => {
    const player = makePlayer({ gem_score: posAvg * 0.88 })
    expect(computeLifecycleLabel(player, posAvg, null)).toBe('sell_soon')
  })

  it('Test 7: Hold fires at 92% of posAvg with no swing signal', () => {
    const player = makePlayer({ gem_score: posAvg * 0.92 })
    expect(computeLifecycleLabel(player, posAvg, null)).toBe('hold')
  })

  it('Test 7b: Hold fires at 100% of posAvg (average player, no swing)', () => {
    const player = makePlayer({ gem_score: posAvg })
    expect(computeLifecycleLabel(player, posAvg, null)).toBe('hold')
  })

  it('Test 7c: Hold fires above posAvg (above average player)', () => {
    const player = makePlayer({ gem_score: posAvg * 1.2 })
    expect(computeLifecycleLabel(player, posAvg, null)).toBe('hold')
  })

  it('Test 8: Buy Next Week blocked by regression_signal=sell — returns hold', () => {
    const player = makePlayer({
      gem_score: posAvg * 0.95, // in hold band (>= 0.90 * posAvg, <= posAvg)
      regression_signal: 'sell',
    })
    const form = makeClubForm({ swing_1gw: 0.30 })
    expect(computeLifecycleLabel(player, posAvg, form)).toBe('hold')
  })

  it('Test 8b: Hold One More blocked by regression_signal=sell — returns hold', () => {
    const player = makePlayer({
      gem_score: posAvg * 0.95, // in hold band
      regression_signal: 'sell',
    })
    const form = makeClubForm({ swing_1gw: 0.05, swing_3gw: 0.30 })
    expect(computeLifecycleLabel(player, posAvg, form)).toBe('hold')
  })

  it('Test 9: Minutes Trap blocked by price gate — now_cost=65, returns non-minutes_trap', () => {
    const player = makePlayer({
      now_cost: 65,
      mins_risk: 'rotation_risk',
      start_prob: 0.55,
      gem_score: posAvg * 0.92,
    })
    const label = computeLifecycleLabel(player, posAvg, null)
    expect(label).not.toBe('minutes_trap')
  })

  it('Test 10: Fixture Trap blocked without worsening swing — trap flag but swing_3gw=0.00', () => {
    const player = makePlayer({
      differential_flag: 'trap',
      gem_score: posAvg * 0.92,
    })
    const form = makeClubForm({ swing_3gw: 0.00 })
    // Falls through to gem-score-based label (hold at 92%)
    const label = computeLifecycleLabel(player, posAvg, form)
    expect(label).not.toBe('fixture_trap')
    expect(label).toBe('hold')
  })

  it('Test 11: Null clubForm degrades gracefully — gem-score labels still work, no crash', () => {
    const player = makePlayer({ gem_score: posAvg * 0.84 })
    expect(() => computeLifecycleLabel(player, posAvg, null)).not.toThrow()
    expect(computeLifecycleLabel(player, posAvg, null)).toBe('sell')
  })

  it('Test 13: BGW player (swing_1gw=null, swing_3gw=null) → Hold or Sell, no crash', () => {
    const player = makePlayer({ gem_score: posAvg * 0.95 })
    const bgwForm = makeClubForm({ swing_1gw: null, swing_3gw: null })
    expect(() => computeLifecycleLabel(player, posAvg, bgwForm)).not.toThrow()
    // No swing signal → no timing label
    const label = computeLifecycleLabel(player, posAvg, bgwForm)
    expect(label).toBe('hold')
  })
})

// ---------------------------------------------------------------------------
// Priority cascade tests
// ---------------------------------------------------------------------------

describe('computeLifecycleLabel — priority cascade', () => {
  const posAvg = 0.5

  it('Test 1: Minutes Trap wins over Buy Next Week (Priority 1 > Priority 3)', () => {
    // Player is expensive, has rotation_risk, start_prob low, AND has good swing_1gw
    const player = makePlayer({
      now_cost: 80,          // >= 70 (Minutes Trap gate)
      mins_risk: 'rotation_risk',
      start_prob: 0.55,      // < 0.65 (Minutes Trap threshold)
      gem_score: posAvg * 0.95, // in hold band (Buy Next Week candidate)
      regression_signal: undefined,
    })
    const form = makeClubForm({ swing_1gw: 0.30, swing_3gw: 0.30 })
    expect(computeLifecycleLabel(player, posAvg, form)).toBe('minutes_trap')
  })

  it('Test 2: Fixture Trap wins over Hold One More (Priority 2 > Priority 4)', () => {
    // Player has TRAP flag + worsening swing, AND also has improving swing_3gw
    // (impossible in real data but priority cascade must still resolve correctly)
    const player = makePlayer({
      differential_flag: 'trap',
      gem_score: posAvg * 0.95, // in hold band
    })
    const form = makeClubForm({ swing_3gw: -0.25 }) // worsening (Fixture Trap condition)
    expect(computeLifecycleLabel(player, posAvg, form)).toBe('fixture_trap')
  })

  it('Test 3: Buy Next Week wins over Hold One More (Priority 3 > Priority 4)', () => {
    // Both swing_1gw and swing_3gw are strong
    const player = makePlayer({
      gem_score: posAvg * 0.95, // in hold band
    })
    const form = makeClubForm({ swing_1gw: 0.25, swing_3gw: 0.25 })
    expect(computeLifecycleLabel(player, posAvg, form)).toBe('buy_next_week')
  })

  it('Test 4: Hold One More when swing_1gw below threshold but swing_3gw strong', () => {
    const player = makePlayer({
      gem_score: posAvg * 0.95, // in hold band
    })
    const form = makeClubForm({ swing_1gw: 0.10, swing_3gw: 0.30 })
    expect(computeLifecycleLabel(player, posAvg, form)).toBe('hold_one_more')
  })

  it('Minutes Trap fires: now_cost=80, cameo, start_prob=0.50', () => {
    const player = makePlayer({
      now_cost: 80,
      mins_risk: 'cameo',
      start_prob: 0.50,
      gem_score: posAvg,
    })
    expect(computeLifecycleLabel(player, posAvg, null)).toBe('minutes_trap')
  })

  it('Fixture Trap fires: differential_flag=trap + swing_3gw=-0.25', () => {
    const player = makePlayer({
      differential_flag: 'trap',
      gem_score: posAvg * 0.92,
    })
    const form = makeClubForm({ swing_3gw: -0.25 })
    expect(computeLifecycleLabel(player, posAvg, form)).toBe('fixture_trap')
  })

  it('Sell Soon fires in warning band (88% of posAvg, no improving swing)', () => {
    const player = makePlayer({ gem_score: posAvg * 0.88 })
    const form = makeClubForm({ swing_3gw: 0.05 }) // below SWING_THRESHOLD
    expect(computeLifecycleLabel(player, posAvg, form)).toBe('sell_soon')
  })

  it('Buy Next Week fires: hold-band gem_score + swing_1gw >= 0.20, no regression_signal', () => {
    const player = makePlayer({
      gem_score: posAvg * 0.95,
      regression_signal: undefined,
    })
    const form = makeClubForm({ swing_1gw: 0.20, swing_3gw: 0.05 })
    expect(computeLifecycleLabel(player, posAvg, form)).toBe('buy_next_week')
  })

  it('Hold One More fires: hold-band gem_score + swing_3gw >= 0.20, swing_1gw below threshold', () => {
    const player = makePlayer({
      gem_score: posAvg * 0.95,
    })
    const form = makeClubForm({ swing_1gw: 0.10, swing_3gw: 0.20 })
    expect(computeLifecycleLabel(player, posAvg, form)).toBe('hold_one_more')
  })

  it('Minutes Trap fires over Fixture Trap (Priority 1 > Priority 2)', () => {
    const player = makePlayer({
      now_cost: 80,
      mins_risk: 'rotation_risk',
      start_prob: 0.55,
      differential_flag: 'trap',
      gem_score: posAvg * 0.95,
    })
    const form = makeClubForm({ swing_3gw: -0.25 })
    expect(computeLifecycleLabel(player, posAvg, form)).toBe('minutes_trap')
  })
})

// ---------------------------------------------------------------------------
// computeLifecycleLabels — wrapper function tests
// ---------------------------------------------------------------------------

describe('computeLifecycleLabels', () => {
  const posAvg = 0.5

  it('Test 12: Bench player (position=12) excluded from returned map', () => {
    const player = makePlayer({ id: 99, team: 10, gem_score: posAvg * 0.84 }) // would be 'sell'
    const allPlayers = [
      ...Array.from({ length: 5 }, (_, i) =>
        makePlayer({ id: i + 1, element_type: 1, gem_score: 0.5 }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makePlayer({ id: i + 10, element_type: 2, gem_score: 0.5 }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makePlayer({ id: i + 20, element_type: 3, gem_score: 0.5 }),
      ),
      player,
    ]
    const picks: SquadPick[] = [
      makePick(99, 12), // bench position — should be excluded
    ]
    const clubFormMap = new Map<number, ClubForm>()
    const labels = computeLifecycleLabels(picks, allPlayers, clubFormMap)
    expect(labels.has(99)).toBe(false)
  })

  it('Starting XI player (position=1) is included in returned map', () => {
    const player = makePlayer({ id: 5, team: 10, element_type: 3, gem_score: 0.5 })
    const allPlayers = [
      ...Array.from({ length: 3 }, (_, i) =>
        makePlayer({ id: i + 100, element_type: 3, gem_score: 0.5 }),
      ),
      player,
    ]
    const picks: SquadPick[] = [makePick(5, 1)]
    const clubFormMap = new Map<number, ClubForm>()
    const labels = computeLifecycleLabels(picks, allPlayers, clubFormMap)
    expect(labels.has(5)).toBe(true)
  })

  it('Returns empty map for empty squad picks', () => {
    const labels = computeLifecycleLabels([], [], new Map())
    expect(labels.size).toBe(0)
  })

  it('Uses clubFormMap to resolve swing signals for players', () => {
    const player = makePlayer({ id: 7, team: 10, element_type: 3, gem_score: 0.5 * 0.95 })
    const allPlayers = [
      ...Array.from({ length: 5 }, (_, i) =>
        makePlayer({ id: i + 200, element_type: 3, gem_score: 0.5 }),
      ),
      player,
    ]
    const picks: SquadPick[] = [makePick(7, 5)]
    const form = makeClubForm({ team_id: 10, swing_1gw: 0.30 })
    const clubFormMap = new Map<number, ClubForm>([[10, form]])
    const labels = computeLifecycleLabels(picks, allPlayers, clubFormMap)
    expect(labels.get(7)).toBe('buy_next_week')
  })
})
