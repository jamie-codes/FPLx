import { describe, it, expect } from 'vitest'
import { computeNextFTState, computeHitCost, snapshotSquad } from '@/lib/free-transfer-engine'

// ---------------------------------------------------------------------------
// computeNextFTState
// ---------------------------------------------------------------------------

describe('computeNextFTState', () => {
  describe('normal GW (no chip or bboost/3xc)', () => {
    it('banks 1 unused FT when 1 available and 0 used → available: 2', () => {
      const result = computeNextFTState(1, 0, null)
      expect(result).toEqual({ available: 2, banked: 1 })
    })

    it('resets to 1 FT when 2 available and 2 used (no unused)', () => {
      const result = computeNextFTState(2, 2, null)
      expect(result).toEqual({ available: 1, banked: 0 })
    })

    it('resets to 1 FT when 1 available and 3 used (extra transfers taken)', () => {
      const result = computeNextFTState(1, 3, null)
      expect(result).toEqual({ available: 1, banked: 0 })
    })

    it('banks 1 FT when 1 available and 1 used exactly', () => {
      // used exactly available — no unused, no hits
      const result = computeNextFTState(1, 1, null)
      expect(result).toEqual({ available: 1, banked: 0 })
    })

    it('banks 1 FT (capped) when 2 available and 0 used — cap at 1 banked', () => {
      // unused = 2, banked = min(1, 2) = 1, available = 2
      const result = computeNextFTState(2, 0, null)
      expect(result).toEqual({ available: 2, banked: 1 })
    })
  })

  describe('wildcard chip', () => {
    it('preserves bank when entering with 2 available (banked 1) → next GW also 2', () => {
      const result = computeNextFTState(2, 5, 'wildcard')
      expect(result).toEqual({ available: 2, banked: 1 })
    })

    it('preserves bank when entering with 1 available (banked 0) → next GW stays 1', () => {
      const result = computeNextFTState(1, 5, 'wildcard')
      expect(result).toEqual({ available: 1, banked: 0 })
    })

    it('preserves bank with 0 transfers used and 2 available', () => {
      const result = computeNextFTState(2, 0, 'wildcard')
      expect(result).toEqual({ available: 2, banked: 1 })
    })
  })

  describe('free hit chip', () => {
    it('passes FT bank through unchanged when entering with 2 available (banked 1)', () => {
      // 2 available entering → banked was 1 → next GW also gets 1+1=2
      const result = computeNextFTState(2, 5, 'freehit')
      expect(result).toEqual({ available: 2, banked: 1 })
    })

    it('passes FT bank through unchanged when entering with 1 available (banked 0)', () => {
      // 1 available entering → banked was 0 → next GW gets 1+0=1
      const result = computeNextFTState(1, 5, 'freehit')
      expect(result).toEqual({ available: 1, banked: 0 })
    })
  })

  describe('bench boost chip', () => {
    it('does not affect FTs — same as normal GW', () => {
      const result = computeNextFTState(1, 0, 'bboost')
      expect(result).toEqual({ available: 2, banked: 1 })
    })
  })

  describe('triple captain chip', () => {
    it('does not affect FTs — same as normal GW', () => {
      const result = computeNextFTState(1, 0, '3xc')
      expect(result).toEqual({ available: 2, banked: 1 })
    })
  })

  describe('D-08 regression: multi-GW FT banking sequences', () => {
    it('rolling 1 FT → 2 available next GW', () => {
      const next = computeNextFTState(1, 0, null)
      expect(next).toEqual({ available: 2, banked: 1 })
    })

    it('rolling 2 GWs → still 2 (cap respected)', () => {
      const after1 = computeNextFTState(1, 0, null)   // { available: 2, banked: 1 }
      const after2 = computeNextFTState(after1.available, 0, null)
      expect(after2).toEqual({ available: 2, banked: 1 })
    })

    it('Wildcard mid-plan preserves bank when entering with 2 available', () => {
      const afterWC = computeNextFTState(2, 11, 'wildcard')
      expect(afterWC).toEqual({ available: 2, banked: 1 })
    })

    it('Wildcard mid-plan preserves bank when entering with 1 available', () => {
      const afterWC = computeNextFTState(1, 11, 'wildcard')
      expect(afterWC).toEqual({ available: 1, banked: 0 })
    })

    it('FH mid-plan preserves bank when entering with 2 available', () => {
      const afterFH = computeNextFTState(2, 11, 'freehit')
      expect(afterFH).toEqual({ available: 2, banked: 1 })
    })

    it('FH mid-plan preserves bank when entering with 1 available', () => {
      const afterFH = computeNextFTState(1, 11, 'freehit')
      expect(afterFH).toEqual({ available: 1, banked: 0 })
    })
  })
})

// ---------------------------------------------------------------------------
// computeHitCost
// ---------------------------------------------------------------------------

describe('computeHitCost', () => {
  it('returns -8 for 2 extra transfers (1 available, 3 used)', () => {
    const result = computeHitCost(1, 3, null)
    expect(result).toBe(-8)
  })

  it('returns 0 when transfers used exactly equals available', () => {
    const result = computeHitCost(2, 2, null)
    expect(result).toBe(0)
  })

  it('returns 0 when transfers used equals available (1 FT, 1 used)', () => {
    const result = computeHitCost(1, 1, null)
    expect(result).toBe(0)
  })

  it('returns 0 when transfers used is less than available (no hit)', () => {
    const result = computeHitCost(2, 1, null)
    expect(result).toBe(0)
  })

  it('returns 0 for wildcard even with many transfers', () => {
    const result = computeHitCost(2, 5, 'wildcard')
    expect(result).toBe(0)
  })

  it('returns 0 for free hit even with many transfers', () => {
    const result = computeHitCost(2, 5, 'freehit')
    expect(result).toBe(0)
  })

  it('returns -4 for exactly 1 extra transfer', () => {
    const result = computeHitCost(1, 2, null)
    expect(result).toBe(-4)
  })

  it('returns -12 for 3 extra transfers', () => {
    const result = computeHitCost(1, 4, null)
    expect(result).toBe(-12)
  })
})

// ---------------------------------------------------------------------------
// Full 6-GW example sequence from CONTEXT.md
// ---------------------------------------------------------------------------

describe('full example sequence (6-GW chain from CONTEXT.md)', () => {
  it('GW1: 1 FT available, use 0 → bank 1 → GW2 has 2 FTs', () => {
    const result = computeNextFTState(1, 0, null)
    expect(result.available).toBe(2)
  })

  it('GW2: 2 FTs available, use 2 → GW3 has 1 FT (cap resets)', () => {
    const result = computeNextFTState(2, 2, null)
    expect(result.available).toBe(1)
  })

  it('GW3: 1 FT available, use 3 → hit cost = -8, GW4 has 1 FT', () => {
    expect(computeHitCost(1, 3, null)).toBe(-8)
    const result = computeNextFTState(1, 3, null)
    expect(result.available).toBe(1)
  })

  it('GW4: Wildcard played → 0 hit cost, GW5 has 1 FT', () => {
    expect(computeHitCost(1, 5, 'wildcard')).toBe(0)
    const result = computeNextFTState(1, 5, 'wildcard')
    expect(result.available).toBe(1)
  })

  it('GW5: 1 FT available, use 0 → bank 1 → GW6 has 2 FTs', () => {
    const result = computeNextFTState(1, 0, null)
    expect(result.available).toBe(2)
  })

  it('GW6: Free Hit played → 0 hit cost, GW7 has 2 FTs (bank unchanged from GW5 carry)', () => {
    expect(computeHitCost(2, 5, 'freehit')).toBe(0)
    const result = computeNextFTState(2, 5, 'freehit')
    expect(result.available).toBe(2)
  })

  it('runs the full sequence end-to-end correctly', () => {
    // GW1 start: 1 FT available, use 0
    const gw2 = computeNextFTState(1, 0, null)
    expect(gw2).toEqual({ available: 2, banked: 1 })

    // GW2: 2 FTs, use 2
    const gw3 = computeNextFTState(gw2.available, 2, null)
    expect(gw3).toEqual({ available: 1, banked: 0 })

    // GW3: 1 FT, use 3 (2 hits)
    expect(computeHitCost(gw3.available, 3, null)).toBe(-8)
    const gw4 = computeNextFTState(gw3.available, 3, null)
    expect(gw4).toEqual({ available: 1, banked: 0 })

    // GW4: wildcard
    expect(computeHitCost(gw4.available, 5, 'wildcard')).toBe(0)
    const gw5 = computeNextFTState(gw4.available, 5, 'wildcard')
    expect(gw5).toEqual({ available: 1, banked: 0 })

    // GW5: 1 FT, use 0
    const gw6 = computeNextFTState(gw5.available, 0, null)
    expect(gw6).toEqual({ available: 2, banked: 1 })

    // GW6: free hit
    expect(computeHitCost(gw6.available, 5, 'freehit')).toBe(0)
    const gw7 = computeNextFTState(gw6.available, 5, 'freehit')
    expect(gw7).toEqual({ available: 2, banked: 1 })
  })
})

// ---------------------------------------------------------------------------
// snapshotSquad
// ---------------------------------------------------------------------------

describe('snapshotSquad', () => {
  it('returns an array with the same values as the original', () => {
    const original = [{ name: 'Salah', id: 1 }, { name: 'Haaland', id: 2 }]
    const copy = snapshotSquad(original)
    expect(copy).toEqual(original)
  })

  it('editing the copy does not mutate the original (deep copy isolation)', () => {
    const original = [{ name: 'Salah', id: 1 }]
    const copy = snapshotSquad(original)
    copy[0].name = 'Mutated'
    expect(original[0].name).toBe('Salah')
  })

  it('the returned array is a new reference (not the same object)', () => {
    const original = [{ name: 'Salah', id: 1 }]
    const copy = snapshotSquad(original)
    expect(copy).not.toBe(original)
  })

  it('elements in the copy are new references (not same objects)', () => {
    const original = [{ name: 'Salah', id: 1 }]
    const copy = snapshotSquad(original)
    expect(copy[0]).not.toBe(original[0])
  })

  it('handles empty arrays', () => {
    const result = snapshotSquad([])
    expect(result).toEqual([])
  })
})
