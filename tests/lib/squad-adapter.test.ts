import { describe, it, expect } from 'vitest'
import { parseSquadResponse } from '@/lib/squad-adapter'

function makeValidPicksResponse() {
  const picks = Array.from({ length: 15 }, (_, i) => ({
    element: i + 1,
    position: i + 1,
    multiplier: i < 11 ? 1 : 0,
    is_captain: i === 0,
    is_vice_captain: i === 1,
  }))

  return {
    active_chip: null,
    picks,
    entry_history: {
      event: 20,
      bank: 15,
      event_transfers: 0,
      event_transfers_cost: 0,
      value: 1050,
    },
  }
}

describe('parseSquadResponse', () => {
  it('valid response with 15 picks passes validation', () => {
    const data = makeValidPicksResponse()
    const result = parseSquadResponse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.picks).toHaveLength(15)
      expect(result.data.entry_history.event).toBe(20)
      expect(result.data.entry_history.bank).toBe(15)
      expect(result.data.active_chip).toBeNull()
    }
  })

  it('response missing picks field fails validation', () => {
    const { picks: _picks, ...withoutPicks } = makeValidPicksResponse()
    const result = parseSquadResponse(withoutPicks)
    expect(result.success).toBe(false)
  })

  it('pick with non-integer element (string) fails validation', () => {
    const data = makeValidPicksResponse()
    const badData = {
      ...data,
      picks: [
        { element: 'not-a-number', position: 1, multiplier: 1, is_captain: false, is_vice_captain: false },
        ...data.picks.slice(1),
      ],
    }
    const result = parseSquadResponse(badData)
    expect(result.success).toBe(false)
  })

  it('active_chip: null passes validation', () => {
    const data = { ...makeValidPicksResponse(), active_chip: null }
    const result = parseSquadResponse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.active_chip).toBeNull()
    }
  })

  it('active_chip: "freehit" passes validation', () => {
    const data = { ...makeValidPicksResponse(), active_chip: 'freehit' }
    const result = parseSquadResponse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.active_chip).toBe('freehit')
    }
  })
})
