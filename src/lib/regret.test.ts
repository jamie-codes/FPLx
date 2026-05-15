// Phase 96 BACK-01 Wave 1 RED — regret formula + season summary contract.
// regret.ts does not exist yet; this file fails at import. Plan 03 turns it GREEN.
// Sources of truth:
//   .planning/phases/96-captain-decision-backtester/96-CONTEXT.md §D-06
//   .planning/phases/96-captain-decision-backtester/096-PATTERNS.md §src/lib/regret.ts
import { describe, it, expect } from 'vitest'
import { computeRegret, computeSeasonSummary, computeTransferDelta, computeTransferSeasonSummary } from './regret'
import type { RegretEntry, TransferRegretEntry } from '@/lib/types'

function entry(gw: number, regret: number | null): RegretEntry {
  return {
    gw,
    userCaptainId: 1, userCaptainName: 'U', userCaptainPts: regret === null ? null : 0,
    modelCeilingId: 2, modelCeilingName: 'M', modelCeilingPts: regret === null ? null : 0,
    hasSnapshot: true,
    regret,
  }
}

describe('computeRegret — D-06 signed captain regret formula', () => {
  it('returns +4 when model 8pts beats user 6pts (regret = (8-6)*2)', () => {
    expect(computeRegret(8, 6)).toBe(4)
  })

  it('returns -8 when user 9pts beats model 5pts (regret = (5-9)*2)', () => {
    expect(computeRegret(5, 9)).toBe(-8)
  })

  it('returns 0 when ceiling and user are equal (tied)', () => {
    expect(computeRegret(7, 7)).toBe(0)
  })

  it('returns null when model ceiling points are null (no snapshot)', () => {
    expect(computeRegret(null, 6)).toBeNull()
  })

  it('returns null when user captain points are null (unauthenticated — SC-5)', () => {
    expect(computeRegret(8, null)).toBeNull()
  })

  it('returns null when both sides are null', () => {
    expect(computeRegret(null, null)).toBeNull()
  })
})

describe('computeSeasonSummary — aggregates RegretEntry array', () => {
  it('returns zeros for an empty array (captainHitRate is null per D-02)', () => {
    expect(computeSeasonSummary([])).toEqual({
      totalRegret: 0, gwsWithData: 0, modelBetter: 0, userWon: 0, tied: 0,
      captainHitRate: null, captainHits: 0,
    })
  })

  it('skips null-regret entries and classifies the rest by sign', () => {
    const entries: RegretEntry[] = [
      entry(1, 4),    // model better
      entry(2, -8),   // user won
      entry(3, 0),    // tied
      entry(4, null), // skipped
    ]
    expect(computeSeasonSummary(entries)).toEqual({
      totalRegret: -4,    // 4 + (-8) + 0 = -4 (sum of non-null regrets)
      gwsWithData: 3,     // entries 1, 2, 3 count
      modelBetter: 1,
      userWon: 1,
      tied: 1,
      // D-02: hits = userWon + tied = 1 + 1 = 2; hitRate = 2/3
      captainHitRate: 2 / 3,
      captainHits: 2,
    })
  })

  it('captainHitRate is null when gwsWithData === 0 (all entries have null regret)', () => {
    const entries: RegretEntry[] = [entry(1, null), entry(2, null), entry(3, null)]
    const summary = computeSeasonSummary(entries)
    expect(summary.gwsWithData).toBe(0)
    expect(summary.captainHitRate).toBeNull()
    expect(summary.captainHits).toBe(0)
  })

  it('captainHitRate equals (userWon + tied) / gwsWithData when gwsWithData > 0 (D-02)', () => {
    // 4 GWs of data: 1 model-better, 2 user-won, 1 tied → hits = 3, total = 4 → rate = 0.75
    const entries: RegretEntry[] = [
      entry(1, 4),    // model better — NOT a hit
      entry(2, -3),   // user won — HIT
      entry(3, -1),   // user won — HIT
      entry(4, 0),    // tied — HIT (D-02: regret <= 0)
    ]
    const summary = computeSeasonSummary(entries)
    expect(summary.gwsWithData).toBe(4)
    expect(summary.userWon).toBe(2)
    expect(summary.tied).toBe(1)
    expect(summary.captainHits).toBe(3)        // userWon + tied
    expect(summary.captainHitRate).toBe(0.75)  // 3/4
  })

  it('tied GWs (regret === 0) count as hits per D-02 (regret <= 0)', () => {
    // All entries are tied → every GW is a hit → hitRate = 1.0
    const entries: RegretEntry[] = [entry(1, 0), entry(2, 0), entry(3, 0)]
    const summary = computeSeasonSummary(entries)
    expect(summary.tied).toBe(3)
    expect(summary.captainHits).toBe(3)
    expect(summary.captainHitRate).toBe(1)
  })
})

// Phase 113 BACK-02: Transfer regret math primitives (TDD RED).
// computeTransferDelta and computeTransferSeasonSummary are not yet exported from
// regret.ts — these tests MUST fail until Task 2 (GREEN) adds the implementations.

describe('computeTransferDelta', () => {
  it('returns null when engineBuyPts is empty (no snapshot signal)', () => {
    expect(computeTransferDelta([], [], null, null)).toBeNull()
  })

  it('returns engine counterfactual gain (rounded 1dp) when user held (userBuyPts null)', () => {
    // engine: sell 3pts player, buy 12pts player → engineGain = 12-3 = 9
    expect(computeTransferDelta([12], [3], null, null)).toBe(9.0)
  })

  it('returns engine counterfactual gain when only userBuyPts is null (defensive hold path)', () => {
    // Only one of userBuyPts/userSellPts is null → same as full hold path
    expect(computeTransferDelta([12], [3], null, [3])).toBe(9.0)
  })

  it('returns engine counterfactual gain when only userSellPts is null (defensive hold path)', () => {
    expect(computeTransferDelta([12], [3], [6], null)).toBe(9.0)
  })

  it('1-FT case: delta = engine gain - user gain', () => {
    // engine: sell 3, buy 12 → engineGain = 9
    // user:   sell 3, buy 6  → userGain = 3
    // delta = 9 - 3 = 6
    expect(computeTransferDelta([12], [3], [6], [3])).toBe(6.0)
  })

  it('2-FT case: sums across both legs', () => {
    // engine: sell [3,4], buy [12,5] → engineGain = (12+5) - (3+4) = 10
    // user:   sell [3,1], buy [6,2]  → userGain = (6+2) - (3+1) = 4
    // delta = 10 - 4 = 6
    expect(computeTransferDelta([12, 5], [3, 4], [6, 2], [3, 1])).toBe(6.0)
  })

  it('rounds to 1dp to eliminate float noise (matches WR-01 convention)', () => {
    // engineGain = 1.23 - 0 = 1.23 → rounded to 1dp = 1.2
    expect(computeTransferDelta([1.23], [0], null, null)).toBe(1.2)
  })

  it('negative delta: user made better transfer (user better → green in UI)', () => {
    // engine: sell 5, buy 2 → engineGain = 2 - 5 = -3
    // user:   sell 5, buy 10 → userGain = 10 - 5 = 5
    // delta = -3 - 5 = -8 (user better)
    expect(computeTransferDelta([2], [5], [10], [5])).toBe(-8.0)
  })
})

describe('computeTransferSeasonSummary', () => {
  function tEntry(gw: number, delta: number | null): TransferRegretEntry {
    return {
      gw,
      hasSnapshot: delta !== null,
      engineSell: null, engineBuy: null,
      engineSellPts: null, engineBuyPts: null,
      isHold: false,
      userSell: null, userBuy: null,
      userSellPts: null, userBuyPts: null,
      delta,
    }
  }

  it('empty array returns zeroed summary', () => {
    expect(computeTransferSeasonSummary([])).toEqual({
      totalDelta: 0, gwsWithData: 0, engineBetter: 0, userBetter: 0, tied: 0,
    })
  })

  it('skips entries where delta is null', () => {
    const entries = [tEntry(1, null), tEntry(2, null)]
    const summary = computeTransferSeasonSummary(entries)
    expect(summary.gwsWithData).toBe(0)
    expect(summary.totalDelta).toBe(0)
    expect(summary.engineBetter).toBe(0)
  })

  it('delta > 0 increments engineBetter', () => {
    const entries = [tEntry(1, 5.0), tEntry(2, 3.0)]
    const summary = computeTransferSeasonSummary(entries)
    expect(summary.engineBetter).toBe(2)
    expect(summary.userBetter).toBe(0)
    expect(summary.tied).toBe(0)
    expect(summary.gwsWithData).toBe(2)
  })

  it('delta < 0 increments userBetter', () => {
    const entries = [tEntry(1, -4.0)]
    const summary = computeTransferSeasonSummary(entries)
    expect(summary.userBetter).toBe(1)
    expect(summary.engineBetter).toBe(0)
  })

  it('delta === 0 increments tied', () => {
    const entries = [tEntry(1, 0)]
    const summary = computeTransferSeasonSummary(entries)
    expect(summary.tied).toBe(1)
    expect(summary.userBetter).toBe(0)
    expect(summary.engineBetter).toBe(0)
  })

  it('totalDelta sums non-null deltas and rounds to 1dp', () => {
    // 1.23 + 2.34 = 3.57 → rounded to 1dp = 3.6
    const entries = [tEntry(1, 1.23), tEntry(2, 2.34)]
    const summary = computeTransferSeasonSummary(entries)
    expect(summary.totalDelta).toBe(3.6)
    expect(summary.gwsWithData).toBe(2)
  })
})
