import { describe, it, expect } from 'vitest'
import {
  DEFCON_THRESHOLD,
  splitByPosition,
  formatHitRate,
  getDefConStatus,
  formatCorrelation,
} from '@/lib/defcon'
import type { DefConPlayer } from '@/lib/defcon'

function makeDefConPlayer(overrides: Partial<DefConPlayer> = {}): DefConPlayer {
  return {
    id: 1,
    web_name: 'Test',
    element_type: 2,
    team: 1,
    team_short_name: 'TST',
    threshold: 10,
    hit_rate: 0.5,
    hits: 5,
    games_played: 10,
    avg_per90: 9.0,
    distance_to_threshold: 1.0,
    fixture_correlation: {
      insufficient_data: true,
      easy_n: 3,
      hard_n: 2,
    },
    ...overrides,
  }
}

describe('DEFCON_THRESHOLD', () => {
  it('DEF threshold is 10 (element_type 2)', () => {
    expect(DEFCON_THRESHOLD[2]).toBe(10)
  })

  it('MID threshold is 12 (element_type 3)', () => {
    expect(DEFCON_THRESHOLD[3]).toBe(12)
  })

  it('FWD threshold is 12 (element_type 4)', () => {
    expect(DEFCON_THRESHOLD[4]).toBe(12)
  })
})

describe('splitByPosition', () => {
  it('returns empty def and midFwd arrays for empty input', () => {
    const result = splitByPosition([])
    expect(result.def).toEqual([])
    expect(result.midFwd).toEqual([])
  })

  it('DEF array contains only element_type 2', () => {
    const players = [
      makeDefConPlayer({ id: 1, element_type: 2 }),
      makeDefConPlayer({ id: 2, element_type: 3 }),
      makeDefConPlayer({ id: 3, element_type: 4 }),
    ]
    const result = splitByPosition(players)
    expect(result.def.length).toBe(1)
    expect(result.def[0].element_type).toBe(2)
  })

  it('MID/FWD array contains only element_type 3 or 4', () => {
    const players = [
      makeDefConPlayer({ id: 1, element_type: 2 }),
      makeDefConPlayer({ id: 2, element_type: 3 }),
      makeDefConPlayer({ id: 3, element_type: 4 }),
    ]
    const result = splitByPosition(players)
    expect(result.midFwd.length).toBe(2)
    for (const p of result.midFwd) {
      expect([3, 4]).toContain(p.element_type)
    }
  })

  it('all DEF players end up in def, none in midFwd', () => {
    const players = [
      makeDefConPlayer({ id: 1, element_type: 2 }),
      makeDefConPlayer({ id: 2, element_type: 2 }),
    ]
    const result = splitByPosition(players)
    expect(result.def.length).toBe(2)
    expect(result.midFwd.length).toBe(0)
  })

  it('all MID/FWD players end up in midFwd, none in def', () => {
    const players = [
      makeDefConPlayer({ id: 1, element_type: 3 }),
      makeDefConPlayer({ id: 2, element_type: 4 }),
    ]
    const result = splitByPosition(players)
    expect(result.def.length).toBe(0)
    expect(result.midFwd.length).toBe(2)
  })
})

describe('formatHitRate', () => {
  it('formats 0.516 as "51.6%"', () => {
    expect(formatHitRate(0.516)).toBe('51.6%')
  })

  it('formats 0 as "0.0%"', () => {
    expect(formatHitRate(0)).toBe('0.0%')
  })

  it('formats 1 as "100.0%"', () => {
    expect(formatHitRate(1)).toBe('100.0%')
  })

  it('formats 0.333 as "33.3%"', () => {
    expect(formatHitRate(0.333)).toBe('33.3%')
  })
})

describe('getDefConStatus', () => {
  it('returns "above" when distance_to_threshold < 0 (player is above threshold)', () => {
    const player = makeDefConPlayer({ distance_to_threshold: -1.5 })
    expect(getDefConStatus(player)).toBe('above')
  })

  it('returns "at" when distance_to_threshold === 0', () => {
    const player = makeDefConPlayer({ distance_to_threshold: 0 })
    expect(getDefConStatus(player)).toBe('at')
  })

  it('returns "below" when distance_to_threshold > 0 (player is below threshold)', () => {
    const player = makeDefConPlayer({ distance_to_threshold: 2.3 })
    expect(getDefConStatus(player)).toBe('below')
  })
})

describe('formatCorrelation', () => {
  it('returns label with insufficient data message when insufficient_data is true', () => {
    const result = formatCorrelation({
      insufficient_data: true,
      easy_n: 3,
      hard_n: 2,
    })
    expect(result.label).toBe('Insufficient data (3 easy, 2 hard games)')
  })

  it('returns easy and hard percentages when sufficient data', () => {
    const result = formatCorrelation({
      insufficient_data: false,
      easy_hit_rate: 0.6,
      hard_hit_rate: 0.4,
      easy_n: 10,
      hard_n: 8,
    })
    expect(result.easy).toBe('60.0%')
    expect(result.hard).toBe('40.0%')
  })

  it('handles zero easy_n and hard_n in insufficient data label', () => {
    const result = formatCorrelation({
      insufficient_data: true,
      easy_n: 0,
      hard_n: 0,
    })
    expect(result.label).toBe('Insufficient data (0 easy, 0 hard games)')
  })

  it('does not return label when sufficient data', () => {
    const result = formatCorrelation({
      insufficient_data: false,
      easy_hit_rate: 0.5,
      hard_hit_rate: 0.5,
      easy_n: 10,
      hard_n: 10,
    })
    expect(result.label).toBeUndefined()
  })
})
