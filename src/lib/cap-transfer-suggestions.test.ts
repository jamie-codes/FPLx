// Phase 112 (TFR-02): capByPosition — pure-function unit tests.
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { capByPosition } from './cap-transfer-suggestions'
import type { TransferSuggestion, MergedPlayer } from './types'

function makeMergedPlayer(id: number, element_type: 1 | 2 | 3 | 4): MergedPlayer {
  return {
    id,
    web_name: `P${id}`,
    team: 1,
    team_short_name: 'T1',
    element_type,
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
  } as MergedPlayer
}

function singleSug(
  buyId: number,
  element_type: 1 | 2 | 3 | 4,
  xPtsGain: number,
  cost: 0 | 4 = 0,
): TransferSuggestion {
  return {
    kind: 'single',
    sell: makeMergedPlayer(buyId * 100, element_type),
    buy: makeMergedPlayer(buyId, element_type),
    cost,
    xPtsGain,
    xPtsGainPerGw: xPtsGain,
    breakEvenGws: cost === 0 ? null : Math.max(1, Math.ceil(4 / xPtsGain)),
  }
}

function comboSug(
  buy1Id: number,
  element_type: 1 | 2 | 3 | 4,
  xPtsGain: number,
  cost: 0 | 4 | 8 = 0,
): TransferSuggestion {
  return {
    kind: 'combo',
    transfers: [
      { sell: makeMergedPlayer(buy1Id * 100, element_type), buy: makeMergedPlayer(buy1Id, element_type) },
      { sell: makeMergedPlayer(buy1Id * 200, element_type), buy: makeMergedPlayer(buy1Id + 1, element_type) },
    ],
    cost,
    xPtsGain,
    xPtsGainPerGw: xPtsGain,
    breakEvenGws: cost === 0 ? null : Math.max(1, Math.ceil(cost / xPtsGain)),
  }
}

describe('Phase 112 (TFR-02): capByPosition', () => {
  it('returns empty result when given an empty array', () => {
    const result = capByPosition([], 3)
    expect(result.suggestions).toEqual([])
    expect(result.totalsByPosition.size).toBe(0)
  })

  it('buckets single-kind suggestions by buy.element_type and caps at limit', () => {
    // 4 MID singles (element_type=3) + 2 DEF singles (element_type=2)
    const input: TransferSuggestion[] = [
      singleSug(1, 3, 10.0),
      singleSug(2, 3, 8.0),
      singleSug(3, 3, 6.0),
      singleSug(4, 3, 4.0),
      singleSug(5, 2, 7.0),
      singleSug(6, 2, 5.0),
    ]
    const result = capByPosition(input, 3)
    expect(result.suggestions.length).toBe(5) // 3 MID + 2 DEF
    expect(result.totalsByPosition.get(3)).toBe(4)
    expect(result.totalsByPosition.get(2)).toBe(2)
    expect(result.totalsByPosition.has(1)).toBe(false)
    expect(result.totalsByPosition.has(4)).toBe(false)
  })

  it('buckets combo-kind suggestions by transfers[0].buy.element_type', () => {
    // 5 combo suggestions all with transfers[0].buy.element_type === 4 (FWD)
    const input: TransferSuggestion[] = [
      comboSug(1, 4, 12.0),
      comboSug(3, 4, 10.0),
      comboSug(5, 4, 8.0),
      comboSug(7, 4, 6.0),
      comboSug(9, 4, 4.0),
    ]
    const result = capByPosition(input, 3)
    expect(result.suggestions.length).toBe(3)
    expect(result.totalsByPosition.get(4)).toBe(5)
  })

  it('preserves input order within a bucket — top-3 are the input first 3 elements when input is already sorted desc by xPtsGain', () => {
    // 4 MID singles sorted desc xPtsGain: [10.0, 8.0, 6.0, 4.0]
    const input: TransferSuggestion[] = [
      singleSug(1, 3, 10.0),
      singleSug(2, 3, 8.0),
      singleSug(3, 3, 6.0),
      singleSug(4, 3, 4.0),
    ]
    const result = capByPosition(input, 3)
    const midSugs = result.suggestions.filter(
      s => s.kind === 'single' && (s as Extract<TransferSuggestion, { kind: 'single' }>).buy.element_type === 3,
    )
    expect(midSugs.map(s => s.xPtsGain)).toEqual([10.0, 8.0, 6.0])
  })

  it('when every bucket has length <= limit, output suggestions length equals input length', () => {
    // 2 GK, 3 DEF, 1 MID, 2 FWD — all <= limit 3
    const input: TransferSuggestion[] = [
      singleSug(1, 1, 10.0),
      singleSug(2, 1, 8.0),
      singleSug(3, 2, 9.0),
      singleSug(4, 2, 7.0),
      singleSug(5, 2, 5.0),
      singleSug(6, 3, 6.0),
      singleSug(7, 4, 8.0),
      singleSug(8, 4, 4.0),
    ]
    const result = capByPosition(input, 3)
    expect(result.suggestions.length).toBe(8)
    // Verify no bucket lost any entry
    const countByType = (sugs: TransferSuggestion[], et: number) =>
      sugs.filter(s =>
        s.kind === 'single'
          ? (s as Extract<TransferSuggestion, { kind: 'single' }>).buy.element_type === et
          : (s as Extract<TransferSuggestion, { kind: 'combo' }>).transfers[0].buy.element_type === et,
      ).length
    expect(countByType(result.suggestions, 1)).toBe(2)
    expect(countByType(result.suggestions, 2)).toBe(3)
    expect(countByType(result.suggestions, 3)).toBe(1)
    expect(countByType(result.suggestions, 4)).toBe(2)
  })

  it('mixed singles and combos in the same bucket are both counted toward the cap', () => {
    // 2 single MIDs + 2 combo MIDs, limit=3 → 3 kept, totalsByPosition.get(3) === 4
    const input: TransferSuggestion[] = [
      singleSug(1, 3, 12.0),
      comboSug(2, 3, 10.0),
      singleSug(4, 3, 8.0),
      comboSug(5, 3, 6.0),
    ]
    const result = capByPosition(input, 3)
    expect(result.suggestions.length).toBe(3)
    expect(result.totalsByPosition.get(3)).toBe(4)
    // Top-3 by xPtsGain from presorted input: 12.0, 10.0, 8.0
    expect(result.suggestions.map(s => s.xPtsGain)).toEqual([12.0, 10.0, 8.0])
  })

  it('output suggestions are sorted across buckets by xPtsGain desc, tie-broken by cost asc', () => {
    // Mix: MID=12, DEF=11, MID=10, FWD=9, DEF=8 (interleaved across buckets)
    const input: TransferSuggestion[] = [
      singleSug(1, 3, 12.0),
      singleSug(2, 2, 11.0),
      singleSug(3, 3, 10.0),
      singleSug(4, 4, 9.0),
      singleSug(5, 2, 8.0),
    ]
    const result = capByPosition(input, 3)
    const gains = result.suggestions.map(s => s.xPtsGain)
    // Assert monotonically non-increasing
    for (let i = 1; i < gains.length; i++) {
      expect(gains[i]).toBeLessThanOrEqual(gains[i - 1])
    }
  })

  it('limit=0 yields zero kept suggestions but totalsByPosition still reflects pre-cap counts', () => {
    const input: TransferSuggestion[] = [
      singleSug(1, 3, 10.0),
      singleSug(2, 3, 8.0),
      singleSug(3, 3, 6.0),
      singleSug(4, 3, 4.0),
      singleSug(5, 3, 2.0),
    ]
    const result = capByPosition(input, 0)
    expect(result.suggestions.length).toBe(0)
    expect(result.totalsByPosition.get(3)).toBe(5)
  })
})
