// TRF-02: parity tests — same cases as pipeline/test_transfer_advisor.py so the
// TS port provably implements the exp14-validated policy.
import { describe, it, expect } from 'vitest'
import {
  FREE_GAIN_MIN, HIT_GAIN_MIN, suggestValidatedTransfers,
  picksToSquadCandidates, type AdvisorCandidate,
} from './validated-transfer-advisor'
import type { MergedPlayer } from './types'

function c(id: number, et: 1 | 2 | 3 | 4, value: number,
           over: Partial<AdvisorCandidate> = {}): AdvisorCandidate {
  return { id, name: `P${id}`, elementType: et, team: id, cost: 50,
           value, available: true, ...over }
}

function squad15(): AdvisorCandidate[] {
  const squad: AdvisorCandidate[] = []
  let id = 1
  for (const [et, n] of [[1, 2], [2, 5], [3, 5], [4, 3]] as const) {
    for (let i = 0; i < n; i++) squad.push(c(id++, et, 4.0))
  }
  return squad
}

const BUDGET = 1000

describe('suggestValidatedTransfers (parity with pipeline/transfer_advisor.py)', () => {
  it('recommends a clear upgrade', () => {
    const squad = squad15()
    const star = c(100, 3, 9.0, { team: 100 })
    const res = suggestValidatedTransfers(squad, [...squad, star], { budget: BUDGET })
    expect(res.hold).toBe(false)
    expect(res.moves[0].in.id).toBe(100)
    expect(res.moves[0].gain).toBe(5.0)
    expect(res.nHits).toBe(0)
  })

  it('holds when the gain is below the free bar', () => {
    const squad = squad15()
    const meh = c(100, 3, 4.0 + FREE_GAIN_MIN - 0.1, { team: 100 })
    const res = suggestValidatedTransfers(squad, [...squad, meh], { budget: BUDGET })
    expect(res.hold).toBe(true)
  })

  it('respects the budget', () => {
    const squad = squad15()
    const rich = c(100, 3, 20.0, { team: 100, cost: 200 })
    const res = suggestValidatedTransfers(squad, [...squad, rich], { budget: 750 })
    expect(res.moves.every(m => m.in.id !== 100)).toBe(true)
  })

  it('respects the 3-per-club limit', () => {
    const squad = squad15()
    squad[0].team = 99; squad[1].team = 99; squad[2].team = 99
    const fourth = c(100, 3, 20.0, { team: 99 })
    const res = suggestValidatedTransfers(squad, [...squad, fourth], { budget: BUDGET })
    expect(res.moves.every(m => m.in.id !== 100)).toBe(true)
  })

  it('only swaps within the same position', () => {
    const squad = squad15()
    const gkStar = c(100, 1, 20.0, { team: 100 })
    const res = suggestValidatedTransfers(squad, [...squad, gkStar], { budget: BUDGET })
    for (const m of res.moves) expect(m.out.elementType).toBe(m.in.elementType)
  })

  it('never brings in an unavailable player', () => {
    const squad = squad15()
    const injured = c(100, 3, 25.0, { team: 100, available: false })
    const res = suggestValidatedTransfers(squad, [...squad, injured], { budget: BUDGET })
    expect(res.moves.every(m => m.in.id !== 100)).toBe(true)
  })

  it('forces out an unavailable squad member', () => {
    const squad = squad15()
    const injured = squad[3]           // a DEF (2 GK then 5 DEF)
    expect(injured.elementType).toBe(2)
    injured.available = false
    const sub = c(100, 2, 4.5, { team: 100 })
    const res = suggestValidatedTransfers(squad, [...squad, sub], { budget: BUDGET })
    expect(res.hold).toBe(false)
    expect(res.moves[0].out.id).toBe(injured.id)
    expect(res.moves[0].reason).toContain('forced')
  })

  it('spends the free transfer on the biggest gain; hits need HIT_GAIN_MIN', () => {
    const squad = squad15()
    const good = c(100, 3, 9.0, { team: 100 })                       // gain 5.0
    const big = c(102, 2, 4.0 + HIT_GAIN_MIN + 2.0, { team: 102 })   // gain 8.0
    const res = suggestValidatedTransfers(squad, [...squad, good, big],
                                          { budget: BUDGET, maxExtra: 2 })
    expect(res.moves.map(m => m.in.id)).toEqual([102])
    expect(res.nHits).toBe(0)
  })

  it('recommends a hit when the second gain clears the bar', () => {
    const squad = squad15()
    const a = c(100, 3, 4.0 + HIT_GAIN_MIN + 4.0, { team: 100 })   // gain 10
    const b = c(101, 4, 4.0 + HIT_GAIN_MIN + 1.0, { team: 101 })   // gain 7
    const res = suggestValidatedTransfers(squad, [...squad, a, b],
                                          { budget: BUDGET, maxExtra: 2 })
    expect(new Set(res.moves.map(m => m.in.id))).toEqual(new Set([100, 101]))
    expect(res.nHits).toBe(1)
    expect(res.netGain).toBe(res.predictedGain - 4)
  })

  it('uses banked free transfers without hits', () => {
    const squad = squad15()
    const a = c(100, 3, 9.0, { team: 100 })
    const b = c(101, 4, 8.0, { team: 101 })
    const res = suggestValidatedTransfers(squad, [...squad, a, b],
                                          { budget: BUDGET, freeTransfers: 2 })
    expect(res.nHits).toBe(0)
    expect(res.moves).toHaveLength(2)
  })
})

describe('picksToSquadCandidates', () => {
  const merged = [
    { id: 7, web_name: 'Salah', element_type: 3, team: 12, now_cost: 130,
      xPts_5gw: 28.4, xPts_1gw: 6.1, status: 'a' },
    { id: 8, web_name: 'Doak', element_type: 3, team: 12, now_cost: 45,
      xPts_5gw: null, xPts_1gw: 2.0, status: 'i' },
  ] as unknown as MergedPlayer[]

  const pick = (element: number) => ({ element, position: 1, multiplier: 1,
                                       is_captain: false, is_vice_captain: false })

  it('prefers selling_price over now_cost and flags injured members', () => {
    const sells = new Map([[7, 125]])
    const [salah, doak] = picksToSquadCandidates([pick(7), pick(8)], merged, sells)
    expect(salah.cost).toBe(125)
    expect(salah.value).toBe(28.4)
    expect(doak.available).toBe(false)
    expect(doak.value).toBe(2.0)   // xPts_5gw null -> 1gw fallback
  })

  it('turns a pick missing from the pool into a zero-value forced sell', () => {
    const [ghost] = picksToSquadCandidates([pick(999)], merged)
    expect(ghost.available).toBe(false)
    expect(ghost.value).toBe(0)
  })
})
