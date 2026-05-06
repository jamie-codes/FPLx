// Phase 74 (TFX-03, TFX-04): computeOpportunityCostRows — pure-function unit tests.
// Mirrors src/lib/suggest-transfers.test.ts pattern.
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeOpportunityCostRows } from './opportunity-cost'
import type { TransferSuggestion, MergedPlayer } from './types'

// Minimal MergedPlayer factory for opportunity-cost tests.
// Mirrors makePlayer in suggest-transfers.test.ts; only fields consumed by
// computeOpportunityCostRows are populated. Caller passes overrides.
function makePlayer(overrides: Partial<MergedPlayer> & { id: number }): MergedPlayer {
  return {
    web_name: `Player${overrides.id}`,
    element_type: 3,
    team: 1,
    now_cost: 50,
    xPts_1gw: 5,
    xPts_3gw: 15,
    xPts_5gw: 25,
    ...overrides,
  } as MergedPlayer
}

// Factory for single TransferSuggestion.
// Sell player: now_cost=50 (used as sell value in bankAfter arithmetic).
// Buy player: now_cost=60 (the buy cost).
// bankAfter effect: bank + 50 - 60 = bank - 10.
function makeSingle(opts: {
  sellId: number
  buyId: number
  cost: 0 | 4
  xPtsGain: number
  xPtsGainPerGw: number
}): TransferSuggestion {
  return {
    kind: 'single',
    sell: makePlayer({ id: opts.sellId, now_cost: 50 }),
    buy: makePlayer({ id: opts.buyId, now_cost: 60 }),
    cost: opts.cost,
    xPtsGain: opts.xPtsGain,
    xPtsGainPerGw: opts.xPtsGainPerGw,
    breakEvenGws: opts.cost === 0 ? null : Math.max(1, Math.ceil(opts.cost / opts.xPtsGainPerGw)),
  }
}

// Factory for combo TransferSuggestion.
// Sell players: now_cost=50 and now_cost=60.
// Buy players: now_cost=55 and now_cost=65.
// bankAfter effect: bank + 50 + 60 - 55 - 65 = bank - 10.
function makeCombo(opts: {
  ids: [number, number, number, number]  // [sell1, buy1, sell2, buy2]
  cost: 0 | 4
  xPtsGain: number
  xPtsGainPerGw: number
}): TransferSuggestion {
  const [s1, b1, s2, b2] = opts.ids
  return {
    kind: 'combo',
    transfers: [
      { sell: makePlayer({ id: s1, now_cost: 50 }), buy: makePlayer({ id: b1, now_cost: 55 }) },
      { sell: makePlayer({ id: s2, now_cost: 60 }), buy: makePlayer({ id: b2, now_cost: 65 }) },
    ],
    cost: opts.cost,
    xPtsGain: opts.xPtsGain,
    xPtsGainPerGw: opts.xPtsGainPerGw,
    breakEvenGws: opts.cost === 0 ? null : Math.max(1, Math.ceil(opts.cost / opts.xPtsGainPerGw)),
  }
}

describe('Phase 74: computeOpportunityCostRows', () => {
  it('scaffold loads', () => {
    expect(true).toBe(true)
  })

  describe('Always returns Roll row', () => {
    it('returns at least one row (Roll) when suggestions list is empty', () => {
      const rows = computeOpportunityCostRows([], 1, 100)
      expect(rows.length).toBeGreaterThanOrEqual(1)
      expect(rows[0].kind).toBe('roll')
    })
  })

  describe('TFX-03: always returns 5 rows when suggestions exist', () => {
    it('returns Roll + 1FT + 2FT + −4 Hit + −8 Hit when both single and combo suggestions present', () => {
      const suggestions: TransferSuggestion[] = [
        makeSingle({ sellId: 1, buyId: 2, cost: 0, xPtsGain: 3.0, xPtsGainPerGw: 3.0 }),
        makeSingle({ sellId: 3, buyId: 4, cost: 4, xPtsGain: 5.0, xPtsGainPerGw: 5.0 }),
        makeCombo({ ids: [5, 6, 7, 8], cost: 0, xPtsGain: 6.0, xPtsGainPerGw: 6.0 }),
      ]
      const rows = computeOpportunityCostRows(suggestions, 2, 100)
      expect(rows.length).toBe(5)
      expect(rows.map(r => r.kind)).toEqual(
        expect.arrayContaining(['roll', 'single-free', 'combo-free', 'single-hit', 'combo-hit-8']),
      )
    })

    it('row order is Roll, 1FT, 2FT, −4 Hit, −8 Hit', () => {
      const suggestions: TransferSuggestion[] = [
        makeSingle({ sellId: 1, buyId: 2, cost: 0, xPtsGain: 3.0, xPtsGainPerGw: 3.0 }),
        makeSingle({ sellId: 3, buyId: 4, cost: 4, xPtsGain: 5.0, xPtsGainPerGw: 5.0 }),
        makeCombo({ ids: [5, 6, 7, 8], cost: 0, xPtsGain: 6.0, xPtsGainPerGw: 6.0 }),
      ]
      const rows = computeOpportunityCostRows(suggestions, 2, 100)
      expect(rows[0].kind).toBe('roll')
      expect(rows[rows.length - 1].kind).toBe('combo-hit-8')
    })
  })

  describe('TFX-04: bankAfter and isAffordable', () => {
    it('Roll row bankAfter equals input bank unchanged', () => {
      const rows = computeOpportunityCostRows([], 1, 73)
      const roll = rows.find(r => r.kind === 'roll')!
      expect(roll.bankAfter).toBe(73)
      expect(roll.isAffordable).toBe(true)
      expect(roll.disabledReason).toBeUndefined()
    })

    it('1FT row bankAfter = bank + sellValue - buy.now_cost', () => {
      // makeSingle: sell.now_cost=50, buy.now_cost=60; bank=15
      // expected bankAfter = 15 + 50 - 60 = 5
      const rows = computeOpportunityCostRows(
        [makeSingle({ sellId: 1, buyId: 2, cost: 0, xPtsGain: 3.0, xPtsGainPerGw: 3.0 })],
        2,
        15,
      )
      const single = rows.find(r => r.kind === 'single-free')!
      expect(single.bankAfter).toBe(5)
      expect(single.isAffordable).toBe(true)
    })

    it('2FT row bankAfter subtracts both buys and adds both sells', () => {
      // makeCombo: sell1.now_cost=50, sell2.now_cost=60, buy1.now_cost=55, buy2.now_cost=65; bank=30
      // bankAfter = 30 + 50 + 60 - 55 - 65 = 20
      const rows = computeOpportunityCostRows(
        [makeCombo({ ids: [5, 6, 7, 8], cost: 0, xPtsGain: 6.0, xPtsGainPerGw: 6.0 })],
        2,
        30,
      )
      const combo = rows.find(r => r.kind === 'combo-free')!
      expect(combo.bankAfter).toBe(20)
    })

    it('isAffordable is true when bankAfter >= 0', () => {
      const rows = computeOpportunityCostRows(
        [makeSingle({ sellId: 1, buyId: 2, cost: 0, xPtsGain: 3.0, xPtsGainPerGw: 3.0 })],
        2,
        100,
      )
      const single = rows.find(r => r.kind === 'single-free')!
      expect(single.isAffordable).toBe(true)
    })

    it('isAffordable is false when bankAfter < 0', () => {
      // bank=0, single move: sell.now_cost=50, buy.now_cost=60 → bankAfter = -10 < 0
      const rows = computeOpportunityCostRows(
        [makeSingle({ sellId: 1, buyId: 2, cost: 0, xPtsGain: 3.0, xPtsGainPerGw: 3.0 })],
        2,
        0,
      )
      const single = rows.find(r => r.kind === 'single-free')!
      expect(single.isAffordable).toBe(false)
      expect(single.bankAfter).toBeLessThan(0)
    })

    it('disabledReason format: "Over budget by £X.Xm" when bankAfter < 0', () => {
      // bank=0, bankAfter = -10 → "Over budget by £1.0m"
      const rows = computeOpportunityCostRows(
        [makeSingle({ sellId: 1, buyId: 2, cost: 0, xPtsGain: 3.0, xPtsGainPerGw: 3.0 })],
        2,
        0,
      )
      const single = rows.find(r => r.kind === 'single-free')!
      expect(single.disabledReason).toBe('Over budget by £1.0m')
    })

    it('disabledReason is undefined when bankAfter >= 0', () => {
      const rows = computeOpportunityCostRows(
        [makeSingle({ sellId: 1, buyId: 2, cost: 0, xPtsGain: 3.0, xPtsGainPerGw: 3.0 })],
        2,
        100,
      )
      rows.forEach(r => {
        if (r.bankAfter >= 0) expect(r.disabledReason).toBeUndefined()
      })
    })
  })

  describe('−8 Hit row (combo-hit-8)', () => {
    it('reuses same player pair as 2FT row (D-07)', () => {
      const suggestions: TransferSuggestion[] = [
        makeCombo({ ids: [5, 6, 7, 8], cost: 0, xPtsGain: 6.0, xPtsGainPerGw: 6.0 }),
      ]
      const rows = computeOpportunityCostRows(suggestions, 2, 100)
      const combo = rows.find(r => r.kind === 'combo-free')
      const hit8 = rows.find(r => r.kind === 'combo-hit-8')
      expect(hit8).toBeDefined()
      expect(combo!.transfers!.map(t => t.sell.id).sort()).toEqual(
        hit8!.transfers!.map(t => t.sell.id).sort(),
      )
      expect(combo!.transfers!.map(t => t.buy.id).sort()).toEqual(
        hit8!.transfers!.map(t => t.buy.id).sort(),
      )
    })

    it('xPtsGainNet = xPtsGain - 8', () => {
      const rows = computeOpportunityCostRows(
        [makeCombo({ ids: [5, 6, 7, 8], cost: 0, xPtsGain: 10.0, xPtsGainPerGw: 10.0 })],
        2,
        100,
      )
      const hit8 = rows.find(r => r.kind === 'combo-hit-8')!
      expect(hit8.xPtsGain).toBe(10.0)
      expect(hit8.xPtsGainNet).toBeCloseTo(2.0, 5)
    })

    it('cost field is 8', () => {
      const rows = computeOpportunityCostRows(
        [makeCombo({ ids: [5, 6, 7, 8], cost: 0, xPtsGain: 10.0, xPtsGainPerGw: 10.0 })],
        2,
        100,
      )
      expect(rows.find(r => r.kind === 'combo-hit-8')!.cost).toBe(8)
    })

    it('breakEvenGws = ceil(8 / xPtsGainPerGw) when xPtsGainPerGw > 0', () => {
      const rows = computeOpportunityCostRows(
        [makeCombo({ ids: [5, 6, 7, 8], cost: 0, xPtsGain: 6.0, xPtsGainPerGw: 2.0 })],
        2,
        100,
      )
      expect(rows.find(r => r.kind === 'combo-hit-8')!.breakEvenGws).toBe(4)
    })

    it('breakEvenGws = null when xPtsGainPerGw <= 0', () => {
      const rows = computeOpportunityCostRows(
        [makeCombo({ ids: [5, 6, 7, 8], cost: 0, xPtsGain: 0, xPtsGainPerGw: 0 })],
        2,
        100,
      )
      expect(rows.find(r => r.kind === 'combo-hit-8')!.breakEvenGws).toBeNull()
    })
  })
})
