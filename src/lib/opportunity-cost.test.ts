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
    id: overrides.id,
    web_name: `Player${overrides.id}`,
    element_type: 3,
    team: 1,
    now_cost: 50,
    selling_price: 50,
    purchase_price: 50,
    xPts_1gw: 5,
    xPts_3gw: 15,
    xPts_5gw: 25,
    ...overrides,
  } as MergedPlayer
}

describe('Phase 74: computeOpportunityCostRows', () => {
  it('scaffold loads', () => {
    expect(true).toBe(true)
  })

  describe('Always returns Roll row', () => {
    it.todo('returns at least one row (Roll) when suggestions list is empty')
  })

  describe('TFX-03: always returns 5 rows when suggestions exist', () => {
    it.todo('returns Roll + 1FT + 2FT + −4 Hit + −8 Hit when both single and combo suggestions present')
    it.todo('row order is Roll, 1FT, 2FT, −4 Hit, −8 Hit')
  })

  describe('TFX-04: bankAfter and isAffordable', () => {
    it.todo('Roll row bankAfter equals input bank unchanged')
    it.todo('1FT row bankAfter = bank + sellValue - buy.now_cost')
    it.todo('2FT row bankAfter subtracts both buys and adds both sells')
    it.todo('isAffordable is true when bankAfter >= 0')
    it.todo('isAffordable is false when bankAfter < 0')
    it.todo('disabledReason format: "Over budget by £X.Xm" when bankAfter < 0')
    it.todo('disabledReason is undefined when bankAfter >= 0')
  })

  describe('−8 Hit row (combo-hit-8)', () => {
    it.todo('reuses same player pair as 2FT row (D-07)')
    it.todo('xPtsGainNet = xPtsGain - 8')
    it.todo('cost field is 8')
    it.todo('breakEvenGws = ceil(8 / xPtsGainPerGw) when xPtsGainPerGw > 0')
    it.todo('breakEvenGws = null when xPtsGainPerGw <= 0')
  })
})

// Touched by reference to keep import tree-shake-safe under TS5 strict mode:
void ({} as TransferSuggestion)
// makePlayer referenced to suppress unused-variable lint warnings during scaffold phase:
void makePlayer
