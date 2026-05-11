// Phase 96 BACK-01 Wave 1 RED — regret formula + season summary contract.
// regret.ts does not exist yet; this file fails at import. Plan 03 turns it GREEN.
// Sources of truth:
//   .planning/phases/96-captain-decision-backtester/96-CONTEXT.md §D-06
//   .planning/phases/96-captain-decision-backtester/096-PATTERNS.md §src/lib/regret.ts
import { describe, it, expect } from 'vitest'
import { computeRegret, computeSeasonSummary } from './regret'
import type { RegretEntry } from './types'

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
  it('returns zeros for an empty array', () => {
    expect(computeSeasonSummary([])).toEqual({
      totalRegret: 0, gwsWithData: 0, modelBetter: 0, userWon: 0, tied: 0,
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
    })
  })
})
