import { describe, it, expect } from 'vitest'
import { computePlanValue, CHIP_LABELS, formatGain } from '@/components/planner/plan-helpers'
import type { PlanStep } from '@/lib/types'

function makePlanStep(netGain: number): PlanStep {
  return {
    gw: 34,
    chip: null,
    transfersIn: [],
    transfersOut: [],
    freeTransfersAvailable: 1,
    hitCost: 0,
    scoredTransfers: [
      {
        sellId: 1,
        buyId: 2,
        gwScore: netGain,
        lookAheadScore: 0,
        totalScore: netGain,
        hitCost: 0,
        netGain,
        affordable: true,
      },
    ],
    squadAfter: [],
    positionsAfter: {},
    unconfirmedFixtures: false,
  }
}

function makeHoldStep(): PlanStep {
  return {
    gw: 34,
    chip: null,
    transfersIn: [],
    transfersOut: [],
    freeTransfersAvailable: 1,
    hitCost: 0,
    scoredTransfers: [],
    squadAfter: [],
    positionsAfter: {},
    unconfirmedFixtures: false,
  }
}

describe('computePlanValue', () => {
  it('sums netGain across steps', () => {
    const steps = [makePlanStep(5.2), makePlanStep(-1.0)]
    expect(computePlanValue(steps)).toBeCloseTo(4.2)
  })

  it('returns 0 for step with empty scoredTransfers', () => {
    expect(computePlanValue([makeHoldStep()])).toBe(0)
  })

  it('returns 0 for empty steps array', () => {
    expect(computePlanValue([])).toBe(0)
  })
})

describe('CHIP_LABELS', () => {
  it('maps wildcard to Wildcard', () => {
    expect(CHIP_LABELS['wildcard']).toBe('Wildcard')
  })

  it('maps freehit to Free Hit', () => {
    expect(CHIP_LABELS['freehit']).toBe('Free Hit')
  })

  it('maps bboost to Bench Boost', () => {
    expect(CHIP_LABELS['bboost']).toBe('Bench Boost')
  })

  it('maps 3xc to Triple Captain', () => {
    expect(CHIP_LABELS['3xc']).toBe('Triple Captain')
  })
})

describe('formatGain', () => {
  it('formats positive value with + prefix', () => {
    expect(formatGain(5.23)).toBe('+5.2 pts')
  })

  it('formats negative value with U+2212 minus sign', () => {
    expect(formatGain(-2.0)).toBe('\u22122.0 pts')
  })

  it('formats zero with + prefix', () => {
    expect(formatGain(0)).toBe('+0.0 pts')
  })
})
