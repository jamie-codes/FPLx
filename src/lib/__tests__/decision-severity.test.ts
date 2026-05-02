import { describe, it, expect } from 'vitest'
import {
  computeDecisionSeverity,
} from '@/lib/decision-severity'
import type {
  SeverityLevel,
  DecisionSeverity,
  ComputeDecisionSeverityArgs,
} from '@/lib/decision-severity'
import type { CaptaincyCandidate } from '@/lib/captaincy-engine'
import type { LifecycleLabel } from '@/lib/lifecycle-label'

function makeCandidate(projected_captain_pts: number): CaptaincyCandidate {
  return {
    projected_captain_pts,
    captain_type: 'safe',
    // player is required by the type but never read by computeDecisionSeverity.
    // Cast to satisfy TypeScript without populating ScoredPlayer fields.
    player: { id: 1, web_name: 'P', element_type: 3 },
  } as unknown as CaptaincyCandidate
}

function makeArgs(overrides: Partial<ComputeDecisionSeverityArgs> = {}): ComputeDecisionSeverityArgs {
  return {
    candidates: [],
    riskLabels: [],
    isDGW: false,
    isBGW: false,
    hasAvailableChip: false,
    hasRecommendedChip: false,
    ...overrides,
  }
}

describe('computeDecisionSeverity — captain', () => {
  it('Test 1: top1=20, top2=8 (top1 >= 2*top2) → captain=HIGH', () => {
    const result = computeDecisionSeverity(makeArgs({
      candidates: [makeCandidate(20), makeCandidate(8)],
    }))
    expect(result.captain).toBe('HIGH')
  })

  it('Test 2: top1=20, top2=10 (top1 === 2*top2 — boundary) → captain=HIGH (>=, not >)', () => {
    const result = computeDecisionSeverity(makeArgs({
      candidates: [makeCandidate(20), makeCandidate(10)],
    }))
    expect(result.captain).toBe('HIGH')
  })

  it('Test 3: top1=20, top2=11 (top1 < 2*top2) → captain=MEDIUM', () => {
    const result = computeDecisionSeverity(makeArgs({
      candidates: [makeCandidate(20), makeCandidate(11)],
    }))
    expect(result.captain).toBe('MEDIUM')
  })

  it('Test 4: candidates=[] (empty) → captain=MEDIUM (top2===0 short-circuit, never HIGH)', () => {
    const result = computeDecisionSeverity(makeArgs({ candidates: [] }))
    expect(result.captain).toBe('MEDIUM')
  })

  it('Test 5: candidates with single entry → captain=MEDIUM (top2===0)', () => {
    const result = computeDecisionSeverity(makeArgs({
      candidates: [makeCandidate(20)],
    }))
    expect(result.captain).toBe('MEDIUM')
  })

  it('Test 6: top1=20, top2=0 (artificial — defensive against zero division) → captain=MEDIUM', () => {
    const result = computeDecisionSeverity(makeArgs({
      candidates: [makeCandidate(20), makeCandidate(0)],
    }))
    expect(result.captain).toBe('MEDIUM')
  })
})

describe('computeDecisionSeverity — transfer', () => {
  it('Test 7: riskLabels=[sell] → transfer=HIGH', () => {
    const result = computeDecisionSeverity(makeArgs({
      riskLabels: ['sell'] as LifecycleLabel[],
    }))
    expect(result.transfer).toBe('HIGH')
  })

  it('Test 8: riskLabels=[minutes_trap] → transfer=HIGH', () => {
    const result = computeDecisionSeverity(makeArgs({
      riskLabels: ['minutes_trap'] as LifecycleLabel[],
    }))
    expect(result.transfer).toBe('HIGH')
  })

  it('Test 9: riskLabels=[sell, sell_soon] (mixed urgency) → transfer=HIGH (urgent wins)', () => {
    const result = computeDecisionSeverity(makeArgs({
      riskLabels: ['sell', 'sell_soon'] as LifecycleLabel[],
    }))
    expect(result.transfer).toBe('HIGH')
  })

  it('Test 10: riskLabels=[sell_soon] → transfer=MEDIUM', () => {
    const result = computeDecisionSeverity(makeArgs({
      riskLabels: ['sell_soon'] as LifecycleLabel[],
    }))
    expect(result.transfer).toBe('MEDIUM')
  })

  it('Test 11: riskLabels=[fixture_trap] → transfer=MEDIUM', () => {
    const result = computeDecisionSeverity(makeArgs({
      riskLabels: ['fixture_trap'] as LifecycleLabel[],
    }))
    expect(result.transfer).toBe('MEDIUM')
  })

  it('Test 12: riskLabels=[hold, hold_one_more, buy_next_week] → transfer=LOW (non-risk labels never trigger)', () => {
    const result = computeDecisionSeverity(makeArgs({
      riskLabels: ['hold', 'hold_one_more', 'buy_next_week'] as LifecycleLabel[],
    }))
    expect(result.transfer).toBe('LOW')
  })

  it('Test 13: riskLabels=[] → transfer=LOW', () => {
    const result = computeDecisionSeverity(makeArgs({ riskLabels: [] }))
    expect(result.transfer).toBe('LOW')
  })
})

describe('computeDecisionSeverity — risk', () => {
  it('Test 14: risk and transfer always equal — assert across mixed scenarios that risk === transfer', () => {
    const scenarios: LifecycleLabel[][] = [
      ['sell'],
      ['sell_soon'],
      [],
    ]
    scenarios.forEach(riskLabels => {
      const result = computeDecisionSeverity(makeArgs({ riskLabels }))
      expect(result.risk).toBe(result.transfer)
    })
  })
})

describe('computeDecisionSeverity — chip', () => {
  it('Test 15: isDGW=true, hasAvailableChip=true, hasRecommendedChip=true → chip=HIGH', () => {
    const result = computeDecisionSeverity(makeArgs({
      isDGW: true,
      hasAvailableChip: true,
      hasRecommendedChip: true,
    }))
    expect(result.chip).toBe('HIGH')
  })

  it('Test 16: isBGW=true, hasAvailableChip=true, hasRecommendedChip=true → chip=HIGH', () => {
    const result = computeDecisionSeverity(makeArgs({
      isBGW: true,
      hasAvailableChip: true,
      hasRecommendedChip: true,
    }))
    expect(result.chip).toBe('HIGH')
  })

  it('Test 17: isDGW=false, isBGW=false, hasAvailableChip=true, hasRecommendedChip=true → chip=MEDIUM', () => {
    const result = computeDecisionSeverity(makeArgs({
      isDGW: false,
      isBGW: false,
      hasAvailableChip: true,
      hasRecommendedChip: true,
    }))
    expect(result.chip).toBe('MEDIUM')
  })

  it('Test 18: isDGW=true, hasAvailableChip=true, hasRecommendedChip=false → chip=LOW (no recommended chip beats DGW)', () => {
    const result = computeDecisionSeverity(makeArgs({
      isDGW: true,
      hasAvailableChip: true,
      hasRecommendedChip: false,
    }))
    expect(result.chip).toBe('LOW')
  })

  it('Test 19: hasAvailableChip=false, hasRecommendedChip=false → chip=LOW', () => {
    const result = computeDecisionSeverity(makeArgs({
      hasAvailableChip: false,
      hasRecommendedChip: false,
    }))
    expect(result.chip).toBe('LOW')
  })

  it('Test 20: isDGW=true, hasAvailableChip=false, hasRecommendedChip=true (defensive — recommendation without availability) → chip=MEDIUM', () => {
    const result = computeDecisionSeverity(makeArgs({
      isDGW: true,
      hasAvailableChip: false,
      hasRecommendedChip: true,
    }))
    expect(result.chip).toBe('MEDIUM')
  })
})

describe('computeDecisionSeverity — return shape', () => {
  it('Test 21: returned object has exactly four keys: captain, transfer, chip, risk', () => {
    const result = computeDecisionSeverity(makeArgs())
    expect(Object.keys(result).sort()).toEqual(['captain', 'chip', 'risk', 'transfer'])
  })
})
