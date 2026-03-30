import { describe, it, expect } from 'vitest'
import { computeVerdicts } from '@/lib/recommend'
import type { ScoredPlayer } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

// ---------------------------------------------------------------------------
// Test factory helpers (matches pattern from transfer-engine.test.ts)
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
      { opponent_team: 'ARS', is_home: true, event_id: 10, difficulty_score: 0.6, difficulty_tier: 'medium' },
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

function makeSquadPick(overrides: Partial<SquadPick> = {}): SquadPick {
  return {
    element: 1,
    position: 1,
    multiplier: 1,
    is_captain: false,
    is_vice_captain: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeVerdicts', () => {
  it('returns Buy for a squad MID with gem_score 0.80 when position average is 0.50', () => {
    // 20 background MIDs at avg 0.50 + 1 squad player at 0.80
    const bgPlayers = Array.from({ length: 20 }, (_, i) =>
      makeScoredPlayer({ id: i + 10, element_type: 3, gem_score: 0.50 }),
    )
    const squadPlayer = makeScoredPlayer({ id: 99, element_type: 3, gem_score: 0.80 })
    const allPlayers = [...bgPlayers, squadPlayer]
    const picks = [makeSquadPick({ element: 99, position: 6 })]

    const verdicts = computeVerdicts(picks, allPlayers)
    expect(verdicts.get(99)).toBe('buy')
  })

  it('returns Sell for a squad MID with gem_score 0.30 when position average is 0.50', () => {
    const bgPlayers = Array.from({ length: 20 }, (_, i) =>
      makeScoredPlayer({ id: i + 10, element_type: 3, gem_score: 0.50 }),
    )
    const squadPlayer = makeScoredPlayer({ id: 88, element_type: 3, gem_score: 0.30 })
    const allPlayers = [...bgPlayers, squadPlayer]
    const picks = [makeSquadPick({ element: 88, position: 7 })]

    const verdicts = computeVerdicts(picks, allPlayers)
    expect(verdicts.get(88)).toBe('sell')
  })

  it('returns Hold for a squad MID with gem_score 0.48 when position average is 0.50', () => {
    const bgPlayers = Array.from({ length: 20 }, (_, i) =>
      makeScoredPlayer({ id: i + 10, element_type: 3, gem_score: 0.50 }),
    )
    // 0.48 is below avg (0.50) but above sell threshold (0.50 * 0.90 = 0.45)
    const squadPlayer = makeScoredPlayer({ id: 77, element_type: 3, gem_score: 0.48 })
    const allPlayers = [...bgPlayers, squadPlayer]
    const picks = [makeSquadPick({ element: 77, position: 8 })]

    const verdicts = computeVerdicts(picks, allPlayers)
    expect(verdicts.get(77)).toBe('hold')
  })

  it('excludes bench players (position >= 12) from verdicts', () => {
    const bgPlayers = Array.from({ length: 10 }, (_, i) =>
      makeScoredPlayer({ id: i + 10, element_type: 3, gem_score: 0.50 }),
    )
    const benchPlayer = makeScoredPlayer({ id: 55, element_type: 3, gem_score: 0.90 })
    const allPlayers = [...bgPlayers, benchPlayer]
    const picks = [makeSquadPick({ element: 55, position: 12 })]

    const verdicts = computeVerdicts(picks, allPlayers)
    expect(verdicts.has(55)).toBe(false)
  })

  it('no contradictory verdicts: Sell player gem_score < Buy player gem_score at same position', () => {
    const bgPlayers = Array.from({ length: 20 }, (_, i) =>
      makeScoredPlayer({ id: i + 10, element_type: 3, gem_score: 0.50 }),
    )
    const buyPlayer = makeScoredPlayer({ id: 101, element_type: 3, gem_score: 0.80 })
    const sellPlayer = makeScoredPlayer({ id: 102, element_type: 3, gem_score: 0.30 })
    const allPlayers = [...bgPlayers, buyPlayer, sellPlayer]
    const picks = [
      makeSquadPick({ element: 101, position: 6 }),
      makeSquadPick({ element: 102, position: 7 }),
    ]

    const verdicts = computeVerdicts(picks, allPlayers)
    expect(verdicts.get(101)).toBe('buy')
    expect(verdicts.get(102)).toBe('sell')
    expect(sellPlayer.gem_score).toBeLessThan(buyPlayer.gem_score)
  })

  it('player with null xG/xA still receives a valid verdict', () => {
    const bgPlayers = Array.from({ length: 20 }, (_, i) =>
      makeScoredPlayer({ id: i + 10, element_type: 3, gem_score: 0.50 }),
    )
    // null xg/xa but valid gem_score — gem_score is what the algorithm uses
    const nullXgPlayer = makeScoredPlayer({
      id: 200,
      element_type: 3,
      gem_score: 0.65,
      xg_per90: null,
      xa_per90: null,
      xg_score: null,
      xa_score: null,
    })
    const allPlayers = [...bgPlayers, nullXgPlayer]
    const picks = [makeSquadPick({ element: 200, position: 3 })]

    const verdicts = computeVerdicts(picks, allPlayers)
    const verdict = verdicts.get(200)
    expect(['buy', 'hold', 'sell']).toContain(verdict)
  })

  it('returns empty map when no squad picks provided', () => {
    const allPlayers = [makeScoredPlayer({ id: 1, gem_score: 0.5 })]
    const picks: SquadPick[] = []

    const verdicts = computeVerdicts(picks, allPlayers)
    expect(verdicts.size).toBe(0)
  })

  it('computes position averages from ALL players, not just squad members', () => {
    // 100 DEFs with gem_score 0.40 (full population avg = 0.40)
    // Squad DEF with gem_score 0.60 — above full population avg → Buy
    const bgDefs = Array.from({ length: 100 }, (_, i) =>
      makeScoredPlayer({ id: i + 10, element_type: 2, gem_score: 0.40 }),
    )
    const squadDef = makeScoredPlayer({ id: 300, element_type: 2, gem_score: 0.60 })
    const allPlayers = [...bgDefs, squadDef]
    const picks = [makeSquadPick({ element: 300, position: 2 })]

    const verdicts = computeVerdicts(picks, allPlayers)
    // Full population avg ≈ 0.40 (with squadDef included, still ~0.40)
    // 0.60 > 0.40 → buy
    expect(verdicts.get(300)).toBe('buy')
  })
})
