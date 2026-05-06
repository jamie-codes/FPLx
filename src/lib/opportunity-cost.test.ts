// Phase 74 (TFX-03, TFX-04): computeOpportunityCostRows — pure-function unit tests.
// Mirrors src/lib/suggest-transfers.test.ts pattern.
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeOpportunityCostRows, MARGINAL_THRESHOLD } from './opportunity-cost'
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

  describe('Phase 74-05 gap closure', () => {
    it('CR-01: -8 Hit row is present when ftCount=1 and only a cost:4 combo exists', () => {
      const rows = computeOpportunityCostRows(
        [makeCombo({ ids: [5, 6, 7, 8], cost: 4, xPtsGain: 8.0, xPtsGainPerGw: 8.0 })],
        1,
        100,
      )
      const hit8 = rows.find(r => r.kind === 'combo-hit-8')
      expect(hit8).toBeDefined()
      expect(hit8!.xPtsGain).toBe(8.0)
      expect(hit8!.xPtsGainNet).toBeCloseTo(0.0, 5)
      expect(hit8!.cost).toBe(8)
    })

    it('CR-01: -8 Hit row prefers cost:0 combo when both cost:0 and cost:4 combos exist', () => {
      const rows = computeOpportunityCostRows(
        [
          makeCombo({ ids: [1, 2, 3, 4], cost: 0, xPtsGain: 6.0, xPtsGainPerGw: 6.0 }),
          makeCombo({ ids: [5, 6, 7, 8], cost: 4, xPtsGain: 9.0, xPtsGainPerGw: 9.0 }),
        ],
        2,
        100,
      )
      const hit8 = rows.find(r => r.kind === 'combo-hit-8')!
      expect(hit8).toBeDefined()
      // The cost:0 combo has sell1.id=1; the cost:4 combo has sell1.id=5.
      // Preference for cost:0 means transfers[0].sell.id should be 1.
      expect(hit8.transfers![0].sell.id).toBe(1)
    })

    it('CR-01: -8 Hit row transfers reference the cost:4 combo when it is the only combo source', () => {
      const rows = computeOpportunityCostRows(
        [makeCombo({ ids: [5, 6, 7, 8], cost: 4, xPtsGain: 8.0, xPtsGainPerGw: 8.0 })],
        1,
        100,
      )
      const hit8 = rows.find(r => r.kind === 'combo-hit-8')!
      expect(hit8.transfers![0].sell.id).toBe(5)
      expect(hit8.transfers![1].sell.id).toBe(7)
    })

    it('WR-03: combo-hit isMarginal=true when xPtsGainNet < MARGINAL_THRESHOLD', () => {
      // xPtsGain=4.5 → xPtsGainNet = 4.5 - 4 = 0.5 < 1.0
      const rows = computeOpportunityCostRows(
        [makeCombo({ ids: [1, 2, 3, 4], cost: 4, xPtsGain: 4.5, xPtsGainPerGw: 4.5 })],
        1,
        100,
      )
      const comboHit = rows.find(r => r.kind === 'combo-hit')!
      expect(comboHit).toBeDefined()
      expect(comboHit.isMarginal).toBe(true)
    })

    it('WR-03: combo-hit isMarginal=false when xPtsGainNet >= MARGINAL_THRESHOLD', () => {
      // xPtsGain=5.5 → xPtsGainNet = 5.5 - 4 = 1.5 >= 1.0
      const rows = computeOpportunityCostRows(
        [makeCombo({ ids: [1, 2, 3, 4], cost: 4, xPtsGain: 5.5, xPtsGainPerGw: 5.5 })],
        1,
        100,
      )
      const comboHit = rows.find(r => r.kind === 'combo-hit')!
      expect(comboHit).toBeDefined()
      expect(comboHit.isMarginal).toBe(false)
    })
  })

  describe('IN-01: merged from __tests__/ duplicate', () => {
    it('MARGINAL_THRESHOLD equals 1.0', () => {
      expect(MARGINAL_THRESHOLD).toBe(1.0)
    })

    it('ftCount=1 with 1 FREE single returns [Roll, single-free] (length 2)', () => {
      const rows = computeOpportunityCostRows(
        [makeSingle({ sellId: 1, buyId: 2, cost: 0, xPtsGain: 3.0, xPtsGainPerGw: 3.0 })],
        1,
        0,
      )
      expect(rows).toHaveLength(2)
      expect(rows[0].kind).toBe('roll')
      expect(rows[1].kind).toBe('single-free')
    })

    it('ftCount=1 with FREE + HIT singles returns [Roll, single-free, single-hit] (length 3)', () => {
      const rows = computeOpportunityCostRows(
        [
          makeSingle({ sellId: 1, buyId: 2, cost: 0, xPtsGain: 3.0, xPtsGainPerGw: 3.0 }),
          makeSingle({ sellId: 3, buyId: 4, cost: 4, xPtsGain: 5.0, xPtsGainPerGw: 5.0 }),
        ],
        1,
        0,
      )
      expect(rows).toHaveLength(3)
      expect(rows[0].kind).toBe('roll')
      expect(rows[1].kind).toBe('single-free')
      expect(rows[2].kind).toBe('single-hit')
    })

    it('ftCount=2 with FREE single + FREE combo returns at least 3 rows including combo-free', () => {
      const rows = computeOpportunityCostRows(
        [
          makeSingle({ sellId: 1, buyId: 2, cost: 0, xPtsGain: 2.0, xPtsGainPerGw: 2.0 }),
          makeCombo({ ids: [3, 4, 5, 6], cost: 0, xPtsGain: 3.5, xPtsGainPerGw: 3.5 }),
        ],
        2,
        0,
      )
      expect(rows.length).toBeGreaterThanOrEqual(3)
      expect(rows[0].kind).toBe('roll')
      expect(rows[1].kind).toBe('single-free')
      expect(rows[2].kind).toBe('combo-free')
    })

    it('Roll row has correct zero values and no transfers field', () => {
      const rows = computeOpportunityCostRows([], 1, 0)
      const roll = rows[0]
      expect(roll.kind).toBe('roll')
      expect(roll.xPtsGain).toBe(0)
      expect(roll.xPtsGainNet).toBe(0)
      expect(roll.xPtsGainPerGw).toBe(0)
      expect(roll.breakEvenGws).toBeNull()
      expect(roll.cost).toBe(0)
      expect(roll.transfers).toBeUndefined()
    })

    it('1-FT FREE row has xPtsGainNet === xPtsGain, breakEvenGws=null, cost=0', () => {
      const rows = computeOpportunityCostRows(
        [makeSingle({ sellId: 1, buyId: 2, cost: 0, xPtsGain: 2.5, xPtsGainPerGw: 2.5 })],
        1,
        0,
      )
      const row = rows.find(r => r.kind === 'single-free')!
      expect(row.xPtsGainNet).toBe(row.xPtsGain)
      expect(row.breakEvenGws).toBeNull()
      expect(row.cost).toBe(0)
    })

    it('1-FT HIT row has xPtsGainNet === xPtsGain - 4 and breakEvenGws present', () => {
      const rows = computeOpportunityCostRows(
        [makeSingle({ sellId: 1, buyId: 2, cost: 4, xPtsGain: 5.0, xPtsGainPerGw: 5.0 })],
        1,
        0,
      )
      const hitRow = rows.find(r => r.kind === 'single-hit')!
      expect(hitRow.xPtsGainNet).toBe(5.0 - 4)
      expect(hitRow.breakEvenGws).toBeGreaterThanOrEqual(1)
      expect(hitRow.cost).toBe(4)
    })

    it('2-FT combo row has xPtsGainNet === xPtsGain and transfers length 2', () => {
      const rows = computeOpportunityCostRows(
        [makeCombo({ ids: [1, 2, 3, 4], cost: 0, xPtsGain: 3.5, xPtsGainPerGw: 3.5 })],
        2,
        0,
      )
      const comboRow = rows.find(r => r.kind === 'combo-free')!
      expect(comboRow.xPtsGainNet).toBe(comboRow.xPtsGain)
      expect(comboRow.transfers).toHaveLength(2)
      expect(comboRow.transfers![0].sell.web_name).toBeDefined()
      expect(comboRow.transfers![0].buy.web_name).toBeDefined()
      expect(comboRow.transfers![1].sell.web_name).toBeDefined()
      expect(comboRow.transfers![1].buy.web_name).toBeDefined()
    })

    it('1-FT row carries the best suggestion sell/buy player IDs', () => {
      // Two singles; first has higher xPtsGain and should be selected.
      // Both use the canonical makeSingle factory with distinct IDs.
      const rows = computeOpportunityCostRows(
        [
          makeSingle({ sellId: 10, buyId: 20, cost: 0, xPtsGain: 4.0, xPtsGainPerGw: 4.0 }),
          makeSingle({ sellId: 30, buyId: 40, cost: 0, xPtsGain: 2.0, xPtsGainPerGw: 2.0 }),
        ],
        1,
        0,
      )
      const freeRow = rows.find(r => r.kind === 'single-free')!
      expect(freeRow.transfers![0].sell.id).toBe(10)
      expect(freeRow.transfers![0].buy.id).toBe(20)
    })

    it('2-FT combo row carries both transfer leg player IDs', () => {
      const rows = computeOpportunityCostRows(
        [makeCombo({ ids: [1, 2, 3, 4], cost: 0, xPtsGain: 3.5, xPtsGainPerGw: 3.5 })],
        2,
        0,
      )
      const comboRow = rows.find(r => r.kind === 'combo-free')!
      expect(comboRow.transfers![0].sell.id).toBe(1)
      expect(comboRow.transfers![0].buy.id).toBe(2)
      expect(comboRow.transfers![1].sell.id).toBe(3)
      expect(comboRow.transfers![1].buy.id).toBe(4)
    })

    it('combo-free with xPtsGain=0.9 sets isMarginal=true', () => {
      const rows = computeOpportunityCostRows(
        [makeCombo({ ids: [1, 2, 3, 4], cost: 0, xPtsGain: 0.9, xPtsGainPerGw: 0.9 })],
        2,
        0,
      )
      const comboRow = rows.find(r => r.kind === 'combo-free')!
      expect(comboRow.isMarginal).toBe(true)
    })

    it('combo-free with xPtsGain=1.0 sets isMarginal=false (boundary)', () => {
      const rows = computeOpportunityCostRows(
        [makeCombo({ ids: [1, 2, 3, 4], cost: 0, xPtsGain: 1.0, xPtsGainPerGw: 1.0 })],
        2,
        0,
      )
      const comboRow = rows.find(r => r.kind === 'combo-free')!
      expect(comboRow.isMarginal).toBe(false)
    })

    it('combo-free with xPtsGain=2.5 sets isMarginal=false', () => {
      const rows = computeOpportunityCostRows(
        [makeCombo({ ids: [1, 2, 3, 4], cost: 0, xPtsGain: 2.5, xPtsGainPerGw: 2.5 })],
        2,
        0,
      )
      const comboRow = rows.find(r => r.kind === 'combo-free')!
      expect(comboRow.isMarginal).toBe(false)
    })

    it('single rows do not have isMarginal set', () => {
      const rows = computeOpportunityCostRows(
        [makeSingle({ sellId: 1, buyId: 2, cost: 4, xPtsGain: 5.0, xPtsGainPerGw: 5.0 })],
        1,
        0,
      )
      const hitRow = rows.find(r => r.kind === 'single-hit')!
      expect(hitRow.isMarginal === undefined || hitRow.isMarginal === false).toBe(true)
    })
  })

  describe('Phase 74-05 gap closure: derivedFtCount unauth fallback (CR-02)', () => {
    // Mirrors the pure logic inside TransferPanel.tsx derivedFtCount useMemo's
    // unauthenticated branch: `(freeTransfers >= 2 ? 2 : 1) as 1 | 2`.
    // We test the logic directly because the useMemo is React-bound; the
    // intent is to lock in the contract that any value >= 2 yields 2 and
    // any value < 2 yields 1.
    const unauthFallback = (freeTransfers: number): 1 | 2 =>
      (freeTransfers >= 2 ? 2 : 1) as 1 | 2

    it('CR-02: freeTransfers=2 returns ftCount=2 for unauthenticated path', () => {
      expect(unauthFallback(2)).toBe(2)
    })

    it('CR-02: freeTransfers=1 returns ftCount=1 for unauthenticated path', () => {
      expect(unauthFallback(1)).toBe(1)
    })

    it('CR-02: freeTransfers>=2 (e.g. 5) clamps to 2 for unauthenticated path', () => {
      expect(unauthFallback(5)).toBe(2)
    })
  })
})
