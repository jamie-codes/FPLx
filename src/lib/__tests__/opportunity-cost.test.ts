import { describe, it, expect } from 'vitest'
import {
  computeOpportunityCostRows,
  MARGINAL_THRESHOLD,
} from '@/lib/opportunity-cost'
import type { OCSRow, OCSRowKind } from '@/lib/opportunity-cost'
import type { TransferSuggestion, MergedPlayer } from '@/lib/types'

function makeMergedPlayer(overrides: Partial<MergedPlayer> = {}): MergedPlayer {
  return {
    id: 1,
    web_name: 'Player',
    element_type: 3,
    now_cost: 80,
    team: 1,
    ...overrides,
  } as MergedPlayer
}

function makeSingleSuggestion(overrides: Partial<Extract<TransferSuggestion, { kind: 'single' }>> = {}): TransferSuggestion {
  return {
    kind: 'single',
    sell: makeMergedPlayer({ id: 1, web_name: 'Sell' }),
    buy: makeMergedPlayer({ id: 2, web_name: 'Buy' }),
    cost: 0,
    xPtsGain: 2.0,
    xPtsGainPerGw: 2.0,
    breakEvenGws: null,
    ...overrides,
  }
}

function makeComboSuggestion(overrides: Partial<Extract<TransferSuggestion, { kind: 'combo' }>> = {}): TransferSuggestion {
  return {
    kind: 'combo',
    transfers: [
      { sell: makeMergedPlayer({ id: 1, web_name: 'SellA' }), buy: makeMergedPlayer({ id: 3, web_name: 'BuyA' }) },
      { sell: makeMergedPlayer({ id: 2, web_name: 'SellB' }), buy: makeMergedPlayer({ id: 4, web_name: 'BuyB' }) },
    ],
    cost: 0,
    xPtsGain: 3.5,
    xPtsGainPerGw: 3.5,
    breakEvenGws: null,
    ...overrides,
  }
}

describe('opportunity-cost constants', () => {
  it('Test 1: MARGINAL_THRESHOLD equals 1.0', () => {
    expect(MARGINAL_THRESHOLD).toBe(1.0)
  })
})

describe('computeOpportunityCostRows — row structure', () => {
  it('Test 2: empty suggestions returns exactly 1 row with kind=roll', () => {
    const rows = computeOpportunityCostRows([], 1)
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('roll')
  })

  it('Test 3: ftCount=1 with 1 FREE single returns [Roll, single-free] (length 2)', () => {
    const rows = computeOpportunityCostRows([makeSingleSuggestion({ cost: 0 })], 1)
    expect(rows).toHaveLength(2)
    expect(rows[0].kind).toBe('roll')
    expect(rows[1].kind).toBe('single-free')
  })

  it('Test 4: ftCount=1 with FREE + HIT singles returns [Roll, single-free, single-hit] (length 3)', () => {
    const suggestions = [
      makeSingleSuggestion({ cost: 0, xPtsGain: 3.0 }),
      makeSingleSuggestion({ cost: 4, xPtsGain: 5.0, breakEvenGws: 1 }),
    ]
    const rows = computeOpportunityCostRows(suggestions, 1)
    expect(rows).toHaveLength(3)
    expect(rows[0].kind).toBe('roll')
    expect(rows[1].kind).toBe('single-free')
    expect(rows[2].kind).toBe('single-hit')
  })

  it('Test 5: ftCount=2 with FREE single + FREE combo returns [Roll, single-free, combo-free] (length 3, no hit)', () => {
    const suggestions = [
      makeSingleSuggestion({ cost: 0 }),
      makeComboSuggestion({ cost: 0 }),
    ]
    const rows = computeOpportunityCostRows(suggestions, 2)
    expect(rows).toHaveLength(3)
    expect(rows[0].kind).toBe('roll')
    expect(rows[1].kind).toBe('single-free')
    expect(rows[2].kind).toBe('combo-free')
  })

  it('Test 6: Roll is always at index 0', () => {
    const suggestions = [
      makeSingleSuggestion({ cost: 0 }),
      makeSingleSuggestion({ cost: 4, xPtsGain: 5.0, breakEvenGws: 1 }),
    ]
    const rows = computeOpportunityCostRows(suggestions, 1)
    expect(rows[0].kind).toBe('roll')
  })
})

describe('computeOpportunityCostRows — correctness', () => {
  it('Test 7: Roll row has correct zero values and no transfers field', () => {
    const rows = computeOpportunityCostRows([], 1)
    const roll = rows[0]
    expect(roll.kind).toBe('roll')
    expect(roll.xPtsGain).toBe(0)
    expect(roll.xPtsGainNet).toBe(0)
    expect(roll.xPtsGainPerGw).toBe(0)
    expect(roll.breakEvenGws).toBeNull()
    expect(roll.cost).toBe(0)
    expect(roll.transfers).toBeUndefined()
  })

  it('Test 8: 1-FT FREE row has xPtsGainNet === xPtsGain, breakEvenGws=null, cost=0', () => {
    const rows = computeOpportunityCostRows([makeSingleSuggestion({ cost: 0, xPtsGain: 2.5, xPtsGainPerGw: 2.5 })], 1)
    const row = rows[1]
    expect(row.xPtsGainNet).toBe(row.xPtsGain)
    expect(row.breakEvenGws).toBeNull()
    expect(row.cost).toBe(0)
  })

  it('Test 9: 1-FT HIT row has xPtsGainNet === xPtsGain - 4 and preserved breakEvenGws', () => {
    const suggestions = [
      makeSingleSuggestion({ cost: 4, xPtsGain: 5.0, xPtsGainPerGw: 5.0, breakEvenGws: 1 }),
    ]
    const rows = computeOpportunityCostRows(suggestions, 1)
    const hitRow = rows.find(r => r.kind === 'single-hit')!
    expect(hitRow.xPtsGainNet).toBe(5.0 - 4)
    expect(hitRow.breakEvenGws).toBe(1)
    expect(hitRow.cost).toBe(4)
  })

  it('Test 10: 2-FT combo row has xPtsGainNet === xPtsGain, transfers length 2', () => {
    const suggestions = [makeComboSuggestion({ cost: 0, xPtsGain: 3.5 })]
    const rows = computeOpportunityCostRows(suggestions, 2)
    const comboRow = rows.find(r => r.kind === 'combo-free')!
    expect(comboRow.xPtsGainNet).toBe(comboRow.xPtsGain)
    expect(comboRow.transfers).toHaveLength(2)
    expect(comboRow.transfers![0].sell.web_name).toBeDefined()
    expect(comboRow.transfers![0].buy.web_name).toBeDefined()
    expect(comboRow.transfers![1].sell.web_name).toBeDefined()
    expect(comboRow.transfers![1].buy.web_name).toBeDefined()
  })
})

describe('computeOpportunityCostRows — player names', () => {
  it('Test 11: 1-FT row carries the best suggestion sell.web_name and buy.web_name', () => {
    const suggestions = [
      makeSingleSuggestion({ cost: 0, xPtsGain: 4.0, sell: makeMergedPlayer({ web_name: 'BestSell' }), buy: makeMergedPlayer({ web_name: 'BestBuy' }) }),
      makeSingleSuggestion({ cost: 0, xPtsGain: 2.0, sell: makeMergedPlayer({ web_name: 'OtherSell' }), buy: makeMergedPlayer({ web_name: 'OtherBuy' }) }),
    ]
    const rows = computeOpportunityCostRows(suggestions, 1)
    const freeRow = rows.find(r => r.kind === 'single-free')!
    expect(freeRow.transfers![0].sell.web_name).toBe('BestSell')
    expect(freeRow.transfers![0].buy.web_name).toBe('BestBuy')
  })

  it('Test 12: 2-FT combo row carries both transfer legs web_names', () => {
    const suggestions = [
      makeComboSuggestion({
        transfers: [
          { sell: makeMergedPlayer({ web_name: 'SellA' }), buy: makeMergedPlayer({ web_name: 'BuyA' }) },
          { sell: makeMergedPlayer({ web_name: 'SellB' }), buy: makeMergedPlayer({ web_name: 'BuyB' }) },
        ],
      }),
    ]
    const rows = computeOpportunityCostRows(suggestions, 2)
    const comboRow = rows.find(r => r.kind === 'combo-free')!
    expect(comboRow.transfers![0].sell.web_name).toBe('SellA')
    expect(comboRow.transfers![0].buy.web_name).toBe('BuyA')
    expect(comboRow.transfers![1].sell.web_name).toBe('SellB')
    expect(comboRow.transfers![1].buy.web_name).toBe('BuyB')
  })
})

describe('computeOpportunityCostRows — marginal flag', () => {
  it('Test 13: 2-FT combo with xPtsGain=0.9 sets isMarginal=true', () => {
    const suggestions = [makeComboSuggestion({ xPtsGain: 0.9, xPtsGainPerGw: 0.9 })]
    const rows = computeOpportunityCostRows(suggestions, 2)
    const comboRow = rows.find(r => r.kind === 'combo-free')!
    expect(comboRow.isMarginal).toBe(true)
  })

  it('Test 14: 2-FT combo with xPtsGain=1.0 sets isMarginal=false (boundary)', () => {
    const suggestions = [makeComboSuggestion({ xPtsGain: 1.0 })]
    const rows = computeOpportunityCostRows(suggestions, 2)
    const comboRow = rows.find(r => r.kind === 'combo-free')!
    expect(comboRow.isMarginal).toBe(false)
  })

  it('Test 15: 2-FT combo with xPtsGain=2.5 sets isMarginal=false', () => {
    const suggestions = [makeComboSuggestion({ xPtsGain: 2.5 })]
    const rows = computeOpportunityCostRows(suggestions, 2)
    const comboRow = rows.find(r => r.kind === 'combo-free')!
    expect(comboRow.isMarginal).toBe(false)
  })

  it('Test 16: single rows do not set isMarginal', () => {
    const suggestions = [
      makeSingleSuggestion({ cost: 4, xPtsGain: 5.0, xPtsGainPerGw: 5.0, breakEvenGws: 1 }),
    ]
    const rows = computeOpportunityCostRows(suggestions, 1)
    const hitRow = rows.find(r => r.kind === 'single-hit')!
    expect(hitRow.isMarginal === undefined || hitRow.isMarginal === false).toBe(true)
  })
})
