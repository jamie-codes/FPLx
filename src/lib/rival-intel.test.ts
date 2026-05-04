// Phase 58 (ML-03..ML-07) — rival-intel pure functions test suite.
// Source: .planning/phases/058-mini-league-rival-tracker/058-CONTEXT.md §decisions D-07, D-08, D-10
// Pattern: mirrors src/lib/eo-candidates.test.ts pure-function test style.
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  computeShared,
  computeUserAdvantage,
  computePositionMedians,
  computeRivalThreats,
  computeBlockingMoves,
  computeCaptainEdge,
} from './rival-intel'
import type { MergedPlayer, PositionCode, TransferSuggestion } from './types'

function mp(id: number, element_type: PositionCode, xPts_1gw?: number, xPts_90th_1gw?: number): MergedPlayer {
  // Minimal MergedPlayer fixture — only fields rival-intel reads.
  return {
    id,
    web_name: `P${id}`,
    team: 1,
    team_short_name: 'XXX',
    element_type,
    now_cost: 50,
    selected_by_percent: '0',
    form: '0',
    status: 'a',
    minutes: 90,
    starts: 1,
    total_points: 0,
    goals_scored: 0,
    assists: 0,
    expected_goals: 0,
    expected_assists: 0,
    pts_last3gw: 0,
    pts_last5gw: 0,
    pts_gw_count: 0,
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
    minutes_per90: 0,
    form_pts_per90: 0,
    fixtures: [],
    xmins: 0,
    start_prob: 0,
    mins_risk: 'nailed',
    xPts_1gw,
    xPts_90th_1gw,
  } as MergedPlayer
}

describe('rival-intel: computeShared (ML-03)', () => {
  it('returns intersection in user-set order', () => {
    expect(computeShared(new Set([1, 2, 3]), new Set([2, 3, 4]))).toEqual([2, 3])
  })
  it('empty rival set → empty result', () => {
    expect(computeShared(new Set([1, 2]), new Set())).toEqual([])
  })
  it('empty user set → empty result', () => {
    expect(computeShared(new Set(), new Set([1, 2]))).toEqual([])
  })
})

describe('rival-intel: computeUserAdvantage (ML-04)', () => {
  it('returns user IDs not in rival set', () => {
    expect(computeUserAdvantage(new Set([1, 2, 3]), new Set([2, 3, 4]))).toEqual([1])
  })
  it('disjoint sets → all user IDs', () => {
    expect(computeUserAdvantage(new Set([1, 2]), new Set([3, 4]))).toEqual([1, 2])
  })
  it('identical sets → []', () => {
    expect(computeUserAdvantage(new Set([1, 2]), new Set([1, 2]))).toEqual([])
  })
})

describe('rival-intel: computePositionMedians', () => {
  it('empty input → all positions 0', () => {
    const m = computePositionMedians([])
    expect(m.get(1)).toBe(0); expect(m.get(2)).toBe(0)
    expect(m.get(3)).toBe(0); expect(m.get(4)).toBe(0)
  })
  it('odd count → middle value', () => {
    const m = computePositionMedians([mp(1, 3, 1), mp(2, 3, 3), mp(3, 3, 5)])
    expect(m.get(3)).toBe(3)
  })
  it('even count → average of two middles', () => {
    const m = computePositionMedians([mp(1, 3, 2), mp(2, 3, 4), mp(3, 3, 6), mp(4, 3, 8)])
    expect(m.get(3)).toBe(5)
  })
  it('excludes players with undefined xPts_1gw', () => {
    const m = computePositionMedians([mp(1, 3, undefined), mp(2, 3, 5), mp(3, 3, 7)])
    expect(m.get(3)).toBe(6)  // median of [5, 7]
  })
  it('excludes players with xPts_1gw === 0', () => {
    const m = computePositionMedians([mp(1, 3, 0), mp(2, 3, 4), mp(3, 3, 6)])
    expect(m.get(3)).toBe(5)  // median of [4, 6]
  })
})

describe('rival-intel: computeRivalThreats (ML-05, D-08)', () => {
  const players: MergedPlayer[] = [
    mp(10, 3, 8),  // rival-owned, xPts above median → threat
    mp(20, 3, 9),  // user-owned → excluded
    mp(30, 3, 4),  // rival-owned but BELOW median → excluded
  ]
  const playerById = new Map(players.map(p => [p.id, p]))
  const medians = new Map<PositionCode, number>([[1, 0], [2, 0], [3, 5], [4, 0]])

  it('returns rival-only above-median players', () => {
    const out = computeRivalThreats(new Set([10, 20, 30]), new Set([20]), playerById, medians)
    const ids = out.map(p => p.id)
    expect(ids).toEqual([10])
  })
  it('strict > median: equal-to-median is excluded', () => {
    const equal = mp(40, 3, 5)
    const m = new Map([...playerById, [40, equal]])
    const out = computeRivalThreats(new Set([40]), new Set(), m, medians)
    expect(out).toEqual([])
  })
  it('player missing xPts_1gw is excluded', () => {
    const noX = mp(50, 3, undefined)
    const m = new Map([...playerById, [50, noX]])
    const out = computeRivalThreats(new Set([50]), new Set(), m, medians)
    expect(out).toEqual([])
  })
})

describe('rival-intel: computeBlockingMoves (ML-06, D-10)', () => {
  function ts(buyId: number, xPts_1gw: number, position: PositionCode = 3): TransferSuggestion {
    return {
      kind: 'single',
      sell: mp(900 + buyId, position, 1),
      buy: mp(buyId, position, xPts_1gw),
      cost: 0,
      xPtsGain: xPts_1gw - 1,
      xPtsGainPerGw: xPts_1gw - 1,
      breakEvenGws: null,
    }
  }
  const medians = new Map<PositionCode, number>([[1, 0], [2, 0], [3, 5], [4, 0]])

  it('returns suggestions whose buy is non-rival-owned AND above median', () => {
    const sugs: TransferSuggestion[] = [ts(100, 8), ts(200, 9), ts(300, 4)]
    const rivalIds = new Set([200])
    const out = computeBlockingMoves(sugs, rivalIds, medians)
    const buyIds = out.map(s => s.kind === 'single' ? s.buy.id : -1)
    expect(buyIds).toEqual([100])  // 200 rival-owned excluded; 300 below median excluded
  })
  it('combo suggestion: included when ANY leg buy qualifies', () => {
    const combo: TransferSuggestion = {
      kind: 'combo',
      transfers: [
        { sell: mp(901, 3, 1), buy: mp(101, 3, 8) },  // qualifies
        { sell: mp(902, 3, 1), buy: mp(202, 3, 9) },  // rival-owned
      ],
      cost: 0, xPtsGain: 15, xPtsGainPerGw: 15, breakEvenGws: null,
    }
    const out = computeBlockingMoves([combo], new Set([202]), medians)
    expect(out).toHaveLength(1)
  })
  it('combo suggestion: excluded when no leg qualifies', () => {
    const combo: TransferSuggestion = {
      kind: 'combo',
      transfers: [
        { sell: mp(901, 3, 1), buy: mp(202, 3, 9) },  // rival-owned
        { sell: mp(902, 3, 1), buy: mp(303, 3, 4) },  // below median
      ],
      cost: 0, xPtsGain: 11, xPtsGainPerGw: 11, breakEvenGws: null,
    }
    const out = computeBlockingMoves([combo], new Set([202]), medians)
    expect(out).toEqual([])
  })
  it('empty suggestions → []', () => {
    expect(computeBlockingMoves([], new Set([1]), medians)).toEqual([])
  })
})

describe('rival-intel: computeCaptainEdge (ML-07)', () => {
  it('returns numeric difference when both captains have xPts_90th_1gw', () => {
    const user = mp(1, 3, 7, 9.5)
    const rival = mp(2, 3, 6, 7.0)
    expect(computeCaptainEdge(user, rival)).toBeCloseTo(2.5, 5)
  })
  it('returns null when user xPts_90th_1gw missing', () => {
    const user = mp(1, 3, 7, undefined)
    const rival = mp(2, 3, 6, 7.0)
    expect(computeCaptainEdge(user, rival)).toBeNull()
  })
  it('returns null when rival xPts_90th_1gw missing', () => {
    const user = mp(1, 3, 7, 9.5)
    const rival = mp(2, 3, 6, undefined)
    expect(computeCaptainEdge(user, rival)).toBeNull()
  })
  it('returns null when rival is null (pre-deadline)', () => {
    const user = mp(1, 3, 7, 9.5)
    expect(computeCaptainEdge(user, null)).toBeNull()
  })
  it('returns null when user is null (no squad)', () => {
    const rival = mp(2, 3, 6, 7.0)
    expect(computeCaptainEdge(null, rival)).toBeNull()
  })
})
