// OCS-06 (2026-09-02): rows for plans that spend ROLLED free transfers.
//
// The table compared roll / 1 FT / 2 FT and their hits. With banked transfers
// (FPL allows five) a manager could act on three or more, but the comparison
// stopped at two — so the option they were actually choosing between never
// appeared.
import { describe, it, expect } from 'vitest'
import { computeOpportunityCostRows } from '@/lib/opportunity-cost'
import type { TransferSuggestion, MergedPlayer } from '@/lib/types'

const pl = (id: number, cost: number): MergedPlayer =>
  ({ id, web_name: `P${id}`, element_type: 3, team: id, now_cost: cost,
     status: 'a', fixtures: [] } as unknown as MergedPlayer)

const leg = (n: number) => ({ sell: pl(n, 50), buy: pl(n + 100, 50) })

function multi(legs: number, gain: number, cost: number): TransferSuggestion {
  return {
    kind: 'multi',
    transfers: Array.from({ length: legs }, (_, i) => leg(i + 1)),
    cost,
    xPtsGain: gain,
    xPtsGainPerGw: gain / 3,
    breakEvenGws: cost > 0 ? 2 : null,
  } as TransferSuggestion
}

describe('computeOpportunityCostRows with rolled transfers', () => {
  it('adds a row for a 3-transfer plan when three are banked', () => {
    const rows = computeOpportunityCostRows([multi(3, 9, 0)], 3, 100)
    const row = rows.find(r => r.kind === 'multi-free')
    expect(row).toBeDefined()
    expect(row!.label).toBe('3 FT')
    expect(row!.transfers).toHaveLength(3)
    expect(row!.cost).toBe(0)
  })

  it('nets the hit off a plan that exceeds the transfers banked', () => {
    const rows = computeOpportunityCostRows([multi(3, 12, 8)], 1, 100)
    const row = rows.find(r => r.kind === 'multi-hit')!
    expect(row.cost).toBe(8)
    expect(row.xPtsGainNet).toBe(12 - 8)
    expect(row.label).toContain('3')
  })

  it('keeps the roll row first so the comparison still starts from doing nothing', () => {
    const rows = computeOpportunityCostRows([multi(4, 10, 0)], 4, 100)
    expect(rows[0].kind).toBe('roll')
  })

  it('reports affordability from the whole plan, not one leg', () => {
    const dear = {
      ...multi(3, 9, 0),
      transfers: [
        { sell: pl(1, 50), buy: pl(101, 200) },
        { sell: pl(2, 50), buy: pl(102, 200) },
        { sell: pl(3, 50), buy: pl(103, 200) },
      ],
    } as TransferSuggestion
    const rows = computeOpportunityCostRows([dear], 3, 0)
    const row = rows.find(r => r.kind === 'multi-free')!
    expect(row.isAffordable).toBe(false)
    expect(row.disabledReason).toBeTruthy()
  })

  it('adds nothing when no multi-leg plan exists', () => {
    const rows = computeOpportunityCostRows([], 5, 100)
    expect(rows.some(r => r.kind.startsWith('multi'))).toBe(false)
  })
})
