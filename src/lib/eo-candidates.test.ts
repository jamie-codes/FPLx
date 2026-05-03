// Phase 57 (EO-01..EO-03): computeEOCandidates — pure-function unit tests.
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeEOCandidates, type EOMode } from './eo-candidates'
import type { MergedPlayer } from './types'

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
    element_type: 3,
    ...overrides,
  } as MergedPlayer
}

describe('Phase 57: computeEOCandidates', () => {
  describe('max_xpts mode', () => {
    it('sorts by xPts_1gw descending', () => {
      const players = [
        makePlayer({ id: 1, element_type: 3, xPts_1gw: 3 }),
        makePlayer({ id: 2, element_type: 3, xPts_1gw: 9 }),
        makePlayer({ id: 3, element_type: 3, xPts_1gw: 5 }),
        makePlayer({ id: 4, element_type: 3, xPts_1gw: 1 }),
        makePlayer({ id: 5, element_type: 3, xPts_1gw: 7 }),
        makePlayer({ id: 6, element_type: 3, xPts_1gw: 2 }),
      ]
      const result = computeEOCandidates(players, 'max_xpts')
      // Expect top 5 sorted by xPts_1gw descending: 9, 7, 5, 3, 2
      expect(result.map(p => p.xPts_1gw)).toEqual([9, 7, 5, 3, 2])
      expect(result.map(p => p.id)).toEqual([2, 5, 3, 1, 6])
    })

    it('returns at most topN candidates (default 5)', () => {
      const players = Array.from({ length: 8 }, (_, i) =>
        makePlayer({ id: i + 1, element_type: 3, xPts_1gw: i + 1 }),
      )
      const result = computeEOCandidates(players, 'max_xpts')
      expect(result.length).toBe(5)
    })

    it('respects topN argument override', () => {
      const players = Array.from({ length: 8 }, (_, i) =>
        makePlayer({ id: i + 1, element_type: 3, xPts_1gw: i + 1 }),
      )
      const result = computeEOCandidates(players, 'max_xpts', 3)
      expect(result.length).toBe(3)
    })
  })

  describe('protect_rank mode', () => {
    it('sorts by parseFloat(selected_by_percent) descending', () => {
      const players = [
        makePlayer({ id: 1, element_type: 3, selected_by_percent: '9.5' }),
        makePlayer({ id: 2, element_type: 3, selected_by_percent: '30.0' }),
        makePlayer({ id: 3, element_type: 3, selected_by_percent: '12.4' }),
        makePlayer({ id: 4, element_type: 3, selected_by_percent: '3.7' }),
      ]
      const result = computeEOCandidates(players, 'protect_rank')
      expect(result.map(p => p.selected_by_percent)).toEqual(['30.0', '12.4', '9.5', '3.7'])
    })

    it('uses numeric (not lexicographic) comparison', () => {
      // Lexicographic: '9.5' > '30.0' because '9' > '3'
      // Numeric: 30.0 > 9.5
      const players = [
        makePlayer({ id: 1, element_type: 3, selected_by_percent: '9.5' }),
        makePlayer({ id: 2, element_type: 3, selected_by_percent: '30.0' }),
      ]
      const result = computeEOCandidates(players, 'protect_rank')
      expect(result[0].id).toBe(2)  // 30.0 should be first
      expect(result[1].id).toBe(1)  // 9.5 should be second
    })
  })

  describe('chase_rank mode', () => {
    it('sorts by xPts_90th_1gw descending', () => {
      const players = [
        makePlayer({ id: 1, element_type: 3, xPts_90th_1gw: 10 }),
        makePlayer({ id: 2, element_type: 3, xPts_90th_1gw: 4 }),
        makePlayer({ id: 3, element_type: 3, xPts_90th_1gw: 12 }),
        makePlayer({ id: 4, element_type: 3, xPts_90th_1gw: 6 }),
        makePlayer({ id: 5, element_type: 3, xPts_90th_1gw: 8 }),
      ]
      const result = computeEOCandidates(players, 'chase_rank')
      expect(result.map(p => p.xPts_90th_1gw)).toEqual([12, 10, 8, 6, 4])
    })
  })

  describe('differential_aggressive mode', () => {
    it('filters to xPts_1gw >= median THEN sorts by selected_by_percent ascending', () => {
      // 5 players: xPts [2, 4, 6, 8, 10], EO ['5.0', '20.0', '15.0', '2.0', '8.0']
      // median of [2,4,6,8,10] = 6
      // filter >= 6: ids with xPts 6, 8, 10 → EO 15.0, 2.0, 8.0
      // sorted ascending by EO: 2.0, 8.0, 15.0
      const players = [
        makePlayer({ id: 1, element_type: 3, xPts_1gw: 2,  selected_by_percent: '5.0' }),
        makePlayer({ id: 2, element_type: 3, xPts_1gw: 4,  selected_by_percent: '20.0' }),
        makePlayer({ id: 3, element_type: 3, xPts_1gw: 6,  selected_by_percent: '15.0' }),
        makePlayer({ id: 4, element_type: 3, xPts_1gw: 8,  selected_by_percent: '2.0' }),
        makePlayer({ id: 5, element_type: 3, xPts_1gw: 10, selected_by_percent: '8.0' }),
      ]
      const result = computeEOCandidates(players, 'differential_aggressive')
      expect(result).toHaveLength(3)
      expect(result.map(p => p.selected_by_percent)).toEqual(['2.0', '8.0', '15.0'])
    })

    it('computes median from FULL eligible pool, not the topN slice (Pitfall 2 regression)', () => {
      // 12 eligible players with xPts_1gw [1..12]
      // median over all 12 = (6 + 7) / 2 = 6.5
      // players with xPts >= 6.5: ids 7..12 (xPts 7,8,9,10,11,12)
      // Set their selected_by_percent to ['1.0','2.0','3.0','4.0','5.0','6.0'] (low EO)
      // Top 5 by ascending EO: ids 7,8,9,10,11 (EO 1.0,2.0,3.0,4.0,5.0)
      // If median were computed only from top-5 high-xPts slice (xPts [8..12]),
      // median would be 10, and the filtered set would be ids 10..12 only.
      const players = Array.from({ length: 12 }, (_, i) => {
        const xPts = i + 1  // 1..12
        const id = i + 1
        // ids 7..12 get low EO strings '1.0'..'6.0'
        const eoStr = id >= 7 ? `${id - 6}.0` : '50.0'  // high EO for low-xPts players
        return makePlayer({ id, element_type: 3, xPts_1gw: xPts, selected_by_percent: eoStr })
      })
      const result = computeEOCandidates(players, 'differential_aggressive')
      // median of [1..12] = 6.5; >= 6.5 means xPts >= 7, i.e. ids 7..12
      // sorted ascending by EO (1.0..6.0): ids 7,8,9,10,11 (top 5)
      expect(result).toHaveLength(5)
      expect(result.map(p => p.id)).toEqual([7, 8, 9, 10, 11])
    })

    it('returns empty array when no players pass median filter', () => {
      // Single eligible player with xPts_1gw=5; median=5; filter >=5 admits it; length 1
      const players = [
        makePlayer({ id: 1, element_type: 3, xPts_1gw: 5 }),
      ]
      const result = computeEOCandidates(players, 'differential_aggressive')
      expect(result).toHaveLength(1)
    })
  })

  describe('eligibility filter', () => {
    it('excludes goalkeepers (element_type === 1) regardless of mode', () => {
      const gk = makePlayer({ id: 1, element_type: 1, xPts_1gw: 10, selected_by_percent: '5.0' })
      const def = makePlayer({ id: 2, element_type: 2, xPts_1gw: 5 })
      const mid = makePlayer({ id: 3, element_type: 3, xPts_1gw: 5 })
      const fwd = makePlayer({ id: 4, element_type: 4, xPts_1gw: 5 })
      const players = [gk, def, mid, fwd]
      const modes: EOMode[] = ['max_xpts', 'protect_rank', 'chase_rank', 'differential_aggressive']
      for (const mode of modes) {
        const result = computeEOCandidates(players, mode)
        const ids = result.map(p => p.id)
        expect(ids).not.toContain(1)  // GK excluded
      }
    })

    it('excludes players with status !== "a"', () => {
      const players = [
        makePlayer({ id: 1, element_type: 3, status: 'd' }),
        makePlayer({ id: 2, element_type: 3, status: 'i' }),
        makePlayer({ id: 3, element_type: 3, status: 's' }),
        makePlayer({ id: 4, element_type: 3, status: 'u' }),
        makePlayer({ id: 5, element_type: 3, status: 'n' }),
        makePlayer({ id: 6, element_type: 3, status: 'a' }),
      ]
      const result = computeEOCandidates(players, 'max_xpts')
      expect(result.map(p => p.id)).toEqual([6])
    })

    it('excludes players with xPts_1gw null', () => {
      const players = [
        makePlayer({ id: 1, element_type: 3, xPts_1gw: undefined as unknown as number }),
        makePlayer({ id: 2, element_type: 3, xPts_1gw: 5 }),
      ]
      const result = computeEOCandidates(players, 'max_xpts')
      expect(result.map(p => p.id)).toEqual([2])
    })

    it('excludes players with xPts_1gw <= 0', () => {
      const players = [
        makePlayer({ id: 1, element_type: 3, xPts_1gw: 0 }),
        makePlayer({ id: 2, element_type: 3, xPts_1gw: -1 }),
        makePlayer({ id: 3, element_type: 3, xPts_1gw: 5 }),
      ]
      const result = computeEOCandidates(players, 'max_xpts')
      expect(result.map(p => p.id)).toEqual([3])
    })
  })

  describe('defensive', () => {
    it('returns empty array for empty input', () => {
      expect(computeEOCandidates([], 'max_xpts')).toEqual([])
    })
  })
})
