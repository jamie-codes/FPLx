import { describe, it, expect } from 'vitest'
import { rankPicks, underTheRadar, isOffSeason, nextEventsFixtures, haulCaptureLabel, xptsFor } from './picks'
import type { MergedPlayer, FixtureEntry } from './types'

function player(over: Partial<MergedPlayer>): MergedPlayer {
  return {
    id: 1, web_name: 'P', team: 1, team_short_name: 'ARS', element_type: 4,
    now_cost: 60, selected_by_percent: '20.0', status: 'a', fixtures: [],
    ...over,
  } as MergedPlayer
}

describe('rankPicks', () => {
  it('ranks by xPts_1gw desc and takes top n', () => {
    const ps = [player({ id: 1, xPts_1gw: 3 }), player({ id: 2, xPts_1gw: 7 }), player({ id: 3, xPts_1gw: 5 })]
    expect(rankPicks(ps, '1gw', 2).map((p) => p.id)).toEqual([2, 3])
  })
  it('uses xPts_3gw for the 3gw horizon', () => {
    const ps = [player({ id: 1, xPts_1gw: 9, xPts_3gw: 1 }), player({ id: 2, xPts_1gw: 1, xPts_3gw: 9 })]
    expect(rankPicks(ps, '3gw', 1)[0].id).toBe(2)
  })
  it('excludes status u (left league); keeps d/i/s', () => {
    const ps = [player({ id: 1, xPts_1gw: 9, status: 'u' }), player({ id: 2, xPts_1gw: 5, status: 'd' })]
    expect(rankPicks(ps, '1gw', 10).map((p) => p.id)).toEqual([2])
  })
  it('treats missing xPts as 0', () => {
    const ps = [player({ id: 1 }), player({ id: 2, xPts_1gw: 0.1 })]
    expect(rankPicks(ps, '1gw', 1)[0].id).toBe(2)
  })
})

describe('underTheRadar', () => {
  it('keeps only sub-threshold ownership, ranked by xPts_1gw', () => {
    const ps = [
      player({ id: 1, xPts_1gw: 9, selected_by_percent: '45.0' }),
      player({ id: 2, xPts_1gw: 5, selected_by_percent: '4.1' }),
      player({ id: 3, xPts_1gw: 6, selected_by_percent: '9.9' }),
    ]
    expect(underTheRadar(ps, 10, 5).map((p) => p.id)).toEqual([3, 2])
  })
})

describe('isOffSeason', () => {
  it('true when all xPts are zero/undefined', () => {
    expect(isOffSeason([player({}), player({ xPts_1gw: 0 })])).toBe(true)
  })
  it('false when any player has positive xPts', () => {
    expect(isOffSeason([player({}), player({ xPts_1gw: 0.2 })])).toBe(false)
  })
  it('true for empty list (nothing to show)', () => {
    expect(isOffSeason([])).toBe(true)
  })
})

describe('nextEventsFixtures', () => {
  const fx = (event_id: number, opp: string): FixtureEntry => ({
    opponent_team: opp, is_home: true, event_id,
    difficulty_score: 0.5, difficulty_tier: 'medium',
  })
  it('slices by distinct event ids, keeping DGW pairs intact', () => {
    const fixtures = [fx(2, 'A'), fx(2, 'B'), fx(3, 'C'), fx(4, 'D')]
    expect(nextEventsFixtures(fixtures, 1)).toHaveLength(2)   // DGW: both GW2 fixtures
    expect(nextEventsFixtures(fixtures, 2)).toHaveLength(3)
    expect(nextEventsFixtures(fixtures, 3)).toHaveLength(4)
  })
})

describe('haulCaptureLabel', () => {
  it('renders ~1 in N', () => {
    expect(haulCaptureLabel(0.194)).toBe('~1 in 5')
    expect(haulCaptureLabel(0.5)).toBe('~1 in 2')
  })
  it('em-dash for zero/null', () => {
    expect(haulCaptureLabel(0)).toBe('—')
    expect(haulCaptureLabel(null)).toBe('—')
  })
})

describe('xptsFor', () => {
  it('returns 0 fallback', () => {
    expect(xptsFor(player({}), '1gw')).toBe(0)
  })
})
