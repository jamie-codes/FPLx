// Phase 62 (MC-04): computeMCLabels — pure-function unit tests.
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeMCLabels } from './mc-labels'
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
    // MC fields default to undefined (absent)
    haul_prob: undefined,
    p10_pts: undefined,
    p90_pts: undefined,
    blank_prob: undefined,
    ...overrides,
  } as MergedPlayer
}

describe('Phase 62: computeMCLabels', () => {
  describe('when MC fields absent', () => {
    it('returns [] for empty input', () => {
      const result = computeMCLabels([])
      expect(result).toEqual([])
    })

    it('returns [] when no candidate has haul_prob defined', () => {
      // 5 players with p10/p90 but NO haul_prob — D-17 gate fires
      const players = [
        makePlayer({ id: 1, element_type: 3, p10_pts: 3.0, p90_pts: 12.0 }),
        makePlayer({ id: 2, element_type: 3, p10_pts: 4.0, p90_pts: 14.0 }),
        makePlayer({ id: 3, element_type: 3, p10_pts: 3.5, p90_pts: 11.0 }),
        makePlayer({ id: 4, element_type: 3, p10_pts: 2.0, p90_pts: 10.0 }),
        makePlayer({ id: 5, element_type: 3, p10_pts: 5.0, p90_pts: 15.0 }),
      ]
      const result = computeMCLabels(players)
      expect(result).toEqual([])
    })
  })

  describe('priority cascade (D-16)', () => {
    it('assigns "Best P(haul)" to highest haul_prob player', () => {
      const players = [
        makePlayer({ id: 1, element_type: 3, haul_prob: 0.25, p10_pts: 3.0, p90_pts: 10.0 }),
        makePlayer({ id: 2, element_type: 3, haul_prob: 0.45, p10_pts: 4.0, p90_pts: 12.0 }),
        makePlayer({ id: 3, element_type: 3, haul_prob: 0.30, p10_pts: 5.0, p90_pts: 14.0 }),
      ]
      const result = computeMCLabels(players)
      const haulLabel = result.find(l => l.dimension === 'haul')
      expect(haulLabel).toBeDefined()
      expect(haulLabel!.playerId).toBe(2) // id:2 has highest haul_prob (0.45)
      expect(haulLabel!.label).toBe('Best P(haul)')
    })

    it('assigns "Highest ceiling" to highest p90_pts among unlabelled players', () => {
      // id:1 has highest haul_prob → gets haul label
      // id:3 has highest p90_pts → gets ceiling label
      const players = [
        makePlayer({ id: 1, element_type: 3, haul_prob: 0.45, p10_pts: 3.0, p90_pts: 10.0 }),
        makePlayer({ id: 2, element_type: 3, haul_prob: 0.25, p10_pts: 4.0, p90_pts: 12.0 }),
        makePlayer({ id: 3, element_type: 3, haul_prob: 0.30, p10_pts: 5.0, p90_pts: 16.0 }),
      ]
      const result = computeMCLabels(players)
      const ceilingLabel = result.find(l => l.dimension === 'ceiling')
      expect(ceilingLabel).toBeDefined()
      expect(ceilingLabel!.playerId).toBe(3) // id:3 has highest p90_pts (16.0) and is unlabelled
      expect(ceilingLabel!.label).toBe('Highest ceiling')
    })

    it('assigns "Lowest floor" to highest p10_pts among unlabelled players', () => {
      // id:1 → haul label (highest haul_prob)
      // id:3 → ceiling label (highest p90_pts)
      // id:2 → floor label (highest p10_pts among remaining)
      const players = [
        makePlayer({ id: 1, element_type: 3, haul_prob: 0.45, p10_pts: 3.0, p90_pts: 10.0 }),
        makePlayer({ id: 2, element_type: 3, haul_prob: 0.25, p10_pts: 6.0, p90_pts: 12.0 }),
        makePlayer({ id: 3, element_type: 3, haul_prob: 0.30, p10_pts: 5.0, p90_pts: 16.0 }),
      ]
      const result = computeMCLabels(players)
      const floorLabel = result.find(l => l.dimension === 'floor')
      expect(floorLabel).toBeDefined()
      expect(floorLabel!.playerId).toBe(2) // id:2 has highest p10_pts (6.0) and is unlabelled
      expect(floorLabel!.label).toBe('Lowest floor')
    })

    it('assigns at most one label per player (greedy — player winning multiple dimensions gets only highest-priority label)', () => {
      // id:1 wins ALL three dimensions (best haul_prob, best p90_pts, best p10_pts)
      // id:1 should ONLY get haul label; id:2 gets ceiling; id:3 gets floor
      const players = [
        makePlayer({ id: 1, element_type: 3, haul_prob: 0.50, p10_pts: 7.0, p90_pts: 18.0 }),
        makePlayer({ id: 2, element_type: 3, haul_prob: 0.30, p10_pts: 5.0, p90_pts: 15.0 }),
        makePlayer({ id: 3, element_type: 3, haul_prob: 0.20, p10_pts: 4.0, p90_pts: 12.0 }),
        makePlayer({ id: 4, element_type: 3, haul_prob: 0.10, p10_pts: 3.0, p90_pts: 10.0 }),
        makePlayer({ id: 5, element_type: 3, haul_prob: 0.05, p10_pts: 2.0, p90_pts: 8.0 }),
      ]
      const result = computeMCLabels(players)
      // id:1 should have exactly 1 label (haul)
      const labelsForPlayer1 = result.filter(l => l.playerId === 1)
      expect(labelsForPlayer1).toHaveLength(1)
      expect(labelsForPlayer1[0].dimension).toBe('haul')
      // id:2 should get ceiling (next-best p90_pts among unlabelled)
      const labelsForPlayer2 = result.filter(l => l.playerId === 2)
      expect(labelsForPlayer2).toHaveLength(1)
      expect(labelsForPlayer2[0].dimension).toBe('ceiling')
      // id:3 should get floor (next-best p10_pts among unlabelled: id:3 vs id:4 vs id:5 → id:3 wins at 4.0)
      const labelsForPlayer3 = result.filter(l => l.playerId === 3)
      expect(labelsForPlayer3).toHaveLength(1)
      expect(labelsForPlayer3[0].dimension).toBe('floor')
    })

    it('assigns at most 3 labels total across all candidates', () => {
      // 5 candidates all with full MC fields — should still get at most 3 labels
      const players = [
        makePlayer({ id: 1, element_type: 3, haul_prob: 0.45, p10_pts: 3.0, p90_pts: 10.0 }),
        makePlayer({ id: 2, element_type: 3, haul_prob: 0.35, p10_pts: 6.0, p90_pts: 14.0 }),
        makePlayer({ id: 3, element_type: 3, haul_prob: 0.30, p10_pts: 5.0, p90_pts: 16.0 }),
        makePlayer({ id: 4, element_type: 3, haul_prob: 0.20, p10_pts: 4.0, p90_pts: 12.0 }),
        makePlayer({ id: 5, element_type: 3, haul_prob: 0.10, p10_pts: 2.0, p90_pts: 8.0 }),
      ]
      const result = computeMCLabels(players)
      expect(result.length).toBeLessThanOrEqual(3)
      expect(result.length).toBe(3)
    })
  })

  describe('defensive', () => {
    it('returns [] when candidates.length === 0', () => {
      expect(computeMCLabels([])).toEqual([])
    })

    it('returns fewer than 3 labels when input has fewer than 3 candidates', () => {
      // 2 candidates — can produce at most 2 labels; no errors thrown
      const players = [
        makePlayer({ id: 1, element_type: 3, haul_prob: 0.45, p10_pts: 3.0, p90_pts: 12.0 }),
        makePlayer({ id: 2, element_type: 3, haul_prob: 0.30, p10_pts: 5.0, p90_pts: 10.0 }),
      ]
      const result = computeMCLabels(players)
      expect(result.length).toBeLessThanOrEqual(2)
      expect(() => computeMCLabels(players)).not.toThrow()
    })
  })

  describe('value formatting (D-17)', () => {
    it('formats haul value as integer percent: "41%"', () => {
      const players = [
        makePlayer({ id: 1, element_type: 3, haul_prob: 0.412, p10_pts: 3.0, p90_pts: 10.0 }),
      ]
      const result = computeMCLabels(players)
      const haulLabel = result.find(l => l.dimension === 'haul')
      expect(haulLabel).toBeDefined()
      expect(haulLabel!.value).toBe('41%')
    })

    it('formats ceiling value as one-decimal pts: "14.2 pts"', () => {
      const players = [
        makePlayer({ id: 1, element_type: 3, haul_prob: 0.30, p10_pts: 3.0, p90_pts: 10.0 }),
        makePlayer({ id: 2, element_type: 3, haul_prob: 0.20, p10_pts: 4.0, p90_pts: 14.23 }),
      ]
      const result = computeMCLabels(players)
      const ceilingLabel = result.find(l => l.dimension === 'ceiling')
      expect(ceilingLabel).toBeDefined()
      expect(ceilingLabel!.value).toBe('14.2 pts')
    })

    it('formats floor value as one-decimal pts: "4.8 pts"', () => {
      const players = [
        makePlayer({ id: 1, element_type: 3, haul_prob: 0.40, p10_pts: 3.0, p90_pts: 14.0 }),
        makePlayer({ id: 2, element_type: 3, haul_prob: 0.25, p10_pts: 6.5, p90_pts: 12.0 }),
        makePlayer({ id: 3, element_type: 3, haul_prob: 0.20, p10_pts: 4.78, p90_pts: 10.0 }),
      ]
      const result = computeMCLabels(players)
      const floorLabel = result.find(l => l.dimension === 'floor')
      // id:1 gets haul (highest haul_prob=0.40)
      // id:2 gets ceiling (highest p90_pts among unlabelled: 12.0 > 10.0)
      // id:3 gets floor (highest p10_pts among remaining: 4.78) → "4.8 pts"
      expect(floorLabel).toBeDefined()
      expect(floorLabel!.value).toBe('4.8 pts')
    })
  })
})
