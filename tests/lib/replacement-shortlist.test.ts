import { describe, it, expect } from 'vitest'
import { computeReplacementShortlist } from '@/lib/replacement-shortlist'
import type { ShortlistEntry } from '@/lib/replacement-shortlist'
import type { ScoredPlayer } from '@/lib/types'

// ---------------------------------------------------------------------------
// Test factory helper (matches pattern from recommend.test.ts)
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

// ---------------------------------------------------------------------------
// Test data setup:
//   sellPlayer: element_type=3 (MID), now_cost=70 (GBP7.0m), proj_pts_1gw=3.0
//   bankBalance=15 (GBP1.5m), available_budget = 1.5 + 7.0 = GBP8.5m
//   candidate at now_cost=80 (GBP8.0m) => budget_sufficient=true
//   candidate at now_cost=90 (GBP9.0m) => budget_sufficient=false
// ---------------------------------------------------------------------------

describe('computeReplacementShortlist', () => {
  it('returns up to 5 same-position alternatives sorted by pts_delta descending', () => {
    const sellPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 70, proj_pts_1gw: 3.0 })
    const squadIds = new Set([1])
    const bankBalance = 15 // GBP1.5m in tenths

    // Create 6 candidates — function should return top 5 by pts_delta
    const candidates = [
      makeScoredPlayer({ id: 10, element_type: 3, now_cost: 80, proj_pts_1gw: 7.0 }), // delta +4.0
      makeScoredPlayer({ id: 11, element_type: 3, now_cost: 80, proj_pts_1gw: 6.5 }), // delta +3.5
      makeScoredPlayer({ id: 12, element_type: 3, now_cost: 80, proj_pts_1gw: 6.0 }), // delta +3.0
      makeScoredPlayer({ id: 13, element_type: 3, now_cost: 80, proj_pts_1gw: 5.5 }), // delta +2.5
      makeScoredPlayer({ id: 14, element_type: 3, now_cost: 80, proj_pts_1gw: 5.0 }), // delta +2.0
      makeScoredPlayer({ id: 15, element_type: 3, now_cost: 80, proj_pts_1gw: 4.5 }), // delta +1.5
    ]
    const allPlayers = [sellPlayer, ...candidates]

    const result = computeReplacementShortlist(sellPlayer, allPlayers, squadIds, bankBalance)

    expect(result).toHaveLength(5)
    // Verify sorted by pts_delta descending
    expect(result[0].pts_delta).toBeGreaterThan(result[1].pts_delta)
    expect(result[1].pts_delta).toBeGreaterThan(result[2].pts_delta)
    expect(result[2].pts_delta).toBeGreaterThan(result[3].pts_delta)
    expect(result[3].pts_delta).toBeGreaterThan(result[4].pts_delta)
  })

  it('pts_delta equals candidate.proj_pts_1gw minus sellPlayer.proj_pts_1gw', () => {
    const sellPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 70, proj_pts_1gw: 3.0 })
    const candidate = makeScoredPlayer({ id: 2, element_type: 3, now_cost: 75, proj_pts_1gw: 7.0 })
    const squadIds = new Set([1])

    const result = computeReplacementShortlist(sellPlayer, [sellPlayer, candidate], squadIds, 15)

    expect(result).toHaveLength(1)
    expect(result[0].pts_delta).toBeCloseTo(7.0 - 3.0)
  })

  it('excludes players in squadIds', () => {
    const sellPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 70, proj_pts_1gw: 3.0 })
    const squadMember = makeScoredPlayer({ id: 2, element_type: 3, now_cost: 75, proj_pts_1gw: 7.0 })
    // squadIds includes both sellPlayer and squadMember
    const squadIds = new Set([1, 2])

    const result = computeReplacementShortlist(sellPlayer, [sellPlayer, squadMember], squadIds, 15)

    expect(result).toHaveLength(0)
  })

  it('excludes players with proj_pts_1gw <= 0', () => {
    const sellPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 70, proj_pts_1gw: 3.0 })
    const zeroPts = makeScoredPlayer({ id: 2, element_type: 3, now_cost: 75, proj_pts_1gw: 0.0 })
    const negativePts = makeScoredPlayer({ id: 3, element_type: 3, now_cost: 75, proj_pts_1gw: -1.0 })
    const squadIds = new Set([1])

    const result = computeReplacementShortlist(sellPlayer, [sellPlayer, zeroPts, negativePts], squadIds, 15)

    expect(result).toHaveLength(0)
  })

  it('only returns players with same element_type as sellPlayer', () => {
    const sellPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 70, proj_pts_1gw: 3.0 })
    const defCandidate = makeScoredPlayer({ id: 2, element_type: 2, now_cost: 75, proj_pts_1gw: 7.0 })
    const fwdCandidate = makeScoredPlayer({ id: 3, element_type: 4, now_cost: 75, proj_pts_1gw: 7.0 })
    const midCandidate = makeScoredPlayer({ id: 4, element_type: 3, now_cost: 75, proj_pts_1gw: 7.0 })
    const squadIds = new Set([1])

    const result = computeReplacementShortlist(
      sellPlayer,
      [sellPlayer, defCandidate, fwdCandidate, midCandidate],
      squadIds,
      15,
    )

    expect(result).toHaveLength(1)
    expect(result[0].player.id).toBe(4)
  })

  it('budget_sufficient is true when candidate.now_cost/10 <= bankBalance/10 + sellPlayer.now_cost/10', () => {
    // bankBalance=15 (GBP1.5m), sellPlayer.now_cost=70 (GBP7.0m), available=GBP8.5m
    // candidate at now_cost=80 (GBP8.0m) => 8.0 <= 8.5 => true
    const sellPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 70, proj_pts_1gw: 3.0 })
    const affordable = makeScoredPlayer({ id: 2, element_type: 3, now_cost: 80, proj_pts_1gw: 6.0 })
    const squadIds = new Set([1])

    const result = computeReplacementShortlist(sellPlayer, [sellPlayer, affordable], squadIds, 15)

    expect(result).toHaveLength(1)
    expect(result[0].budget_sufficient).toBe(true)
  })

  it('budget_sufficient is false when candidate exceeds available budget', () => {
    // bankBalance=15 (GBP1.5m), sellPlayer.now_cost=70 (GBP7.0m), available=GBP8.5m
    // candidate at now_cost=90 (GBP9.0m) => 9.0 > 8.5 => false
    const sellPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 70, proj_pts_1gw: 3.0 })
    const tooExpensive = makeScoredPlayer({ id: 2, element_type: 3, now_cost: 90, proj_pts_1gw: 6.0 })
    const squadIds = new Set([1])

    const result = computeReplacementShortlist(sellPlayer, [sellPlayer, tooExpensive], squadIds, 15)

    expect(result).toHaveLength(1)
    expect(result[0].budget_sufficient).toBe(false)
  })

  it('returns fewer than 5 if fewer candidates qualify', () => {
    const sellPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 70, proj_pts_1gw: 3.0 })
    const candidate1 = makeScoredPlayer({ id: 2, element_type: 3, now_cost: 75, proj_pts_1gw: 5.0 })
    const candidate2 = makeScoredPlayer({ id: 3, element_type: 3, now_cost: 75, proj_pts_1gw: 6.0 })
    const squadIds = new Set([1])

    const result = computeReplacementShortlist(
      sellPlayer,
      [sellPlayer, candidate1, candidate2],
      squadIds,
      15,
    )

    expect(result).toHaveLength(2)
  })

  it('returns empty array when no candidates qualify', () => {
    const sellPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 70, proj_pts_1gw: 3.0 })
    // Only different-position players available
    const defCandidate = makeScoredPlayer({ id: 2, element_type: 2, now_cost: 75, proj_pts_1gw: 5.0 })
    const squadIds = new Set([1])

    const result = computeReplacementShortlist(sellPlayer, [sellPlayer, defCandidate], squadIds, 15)

    expect(result).toHaveLength(0)
  })

  it('count parameter limits results', () => {
    const sellPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 70, proj_pts_1gw: 3.0 })
    const squadIds = new Set([1])

    const candidates = Array.from({ length: 8 }, (_, i) =>
      makeScoredPlayer({ id: i + 10, element_type: 3, now_cost: 75, proj_pts_1gw: 5.0 + i }),
    )
    const allPlayers = [sellPlayer, ...candidates]

    const result = computeReplacementShortlist(sellPlayer, allPlayers, squadIds, 15, 3)

    expect(result).toHaveLength(3)
  })

  it('does not include sellPlayer themselves in results', () => {
    const sellPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 70, proj_pts_1gw: 3.0 })
    const candidate = makeScoredPlayer({ id: 2, element_type: 3, now_cost: 75, proj_pts_1gw: 6.0 })
    // squadIds does NOT include sellPlayer (edge case — verify id exclusion works without relying on squadIds)
    const squadIds = new Set<number>([])

    const result = computeReplacementShortlist(sellPlayer, [sellPlayer, candidate], squadIds, 15)

    const resultIds = result.map(e => e.player.id)
    expect(resultIds).not.toContain(1) // sellPlayer.id
    expect(resultIds).toContain(2)
  })
})
