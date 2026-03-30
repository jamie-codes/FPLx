import { describe, it, expect } from 'vitest'
import {
  MyTeamPickSchema,
  MyTeamResponseSchema,
  parseMyTeamResponse,
} from './squad-adapter'

const validPick = {
  element: 1,
  position: 1,
  multiplier: 1,
  is_captain: false,
  is_vice_captain: false,
  selling_price: 55,
}

const validEntryHistory = {
  event: 30,
  bank: 15,
  event_transfers: 1,
  event_transfers_cost: 0,
  value: 1005,
}

describe('MyTeamPickSchema', () => {
  it('accepts a valid pick with selling_price', () => {
    const result = MyTeamPickSchema.safeParse(validPick)
    expect(result.success).toBe(true)
  })

  it('rejects a pick missing selling_price', () => {
    const { selling_price, ...pickWithout } = validPick
    const result = MyTeamPickSchema.safeParse(pickWithout)
    expect(result.success).toBe(false)
  })
})

describe('MyTeamResponseSchema', () => {
  it('parses a valid my-team response', () => {
    const fixture = {
      picks: [validPick],
      entry_history: validEntryHistory,
    }
    const result = MyTeamResponseSchema.safeParse(fixture)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.picks[0].selling_price).toBe(55)
      expect(result.data.entry_history.bank).toBe(15)
    }
  })

  it('rejects response where picks lack selling_price', () => {
    const { selling_price, ...pickWithout } = validPick
    const fixture = {
      picks: [pickWithout],
      entry_history: validEntryHistory,
    }
    const result = MyTeamResponseSchema.safeParse(fixture)
    expect(result.success).toBe(false)
  })
})

describe('parseMyTeamResponse', () => {
  it('returns success for valid input', () => {
    const fixture = {
      picks: [validPick],
      entry_history: validEntryHistory,
    }
    const result = parseMyTeamResponse(fixture)
    expect(result.success).toBe(true)
  })

  it('returns failure for malformed input', () => {
    const result = parseMyTeamResponse({ bad: 'data' })
    expect(result.success).toBe(false)
  })
})
