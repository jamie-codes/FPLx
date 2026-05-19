// Phase 124 Wave 1 RED — computeDecisionGrade boundary conditions.
// season-review.ts does not exist yet; this file fails at import. Task 2 turns it GREEN.
// Sources of truth:
//   .planning/phases/124-season-review/124-CONTEXT.md §D-05, D-06
//   .planning/phases/124-season-review/124-RESEARCH.md §Code Examples
import { describe, it, expect } from 'vitest'
import { computeDecisionGrade } from './season-review'
import type { GradeLabel } from './season-review'

describe('computeDecisionGrade — D-05/D-06 grade thresholds', () => {
  it('returns A when all inputs are 1.0 with chipCount=2 (score = 1.0 >= 0.75)', () => {
    const result = computeDecisionGrade(1.0, 1.0, 1.0, 2)
    expect(result).toBe('A')
  })

  it('returns A at the 0.75 boundary (score = 0.75 >= 0.75)', () => {
    const result = computeDecisionGrade(0.75, 0.75, 0.75, 2)
    expect(result).toBe('A')
  })

  it('returns B at the 0.50 boundary (score = 0.5 >= 0.50 < 0.75)', () => {
    const result = computeDecisionGrade(0.5, 0.5, 0.5, 2)
    expect(result).toBe('B')
  })

  it('returns C at the 0.25 boundary (score = 0.25 >= 0.25 < 0.50)', () => {
    const result = computeDecisionGrade(0.25, 0.25, 0.25, 2)
    expect(result).toBe('C')
  })

  it('returns D when all inputs are 0.0 (score = 0 < 0.25)', () => {
    const result = computeDecisionGrade(0.0, 0.0, 0.0, 2)
    expect(result).toBe('D')
  })

  it('D-06: chipCount=0 excludes chip ROI and renormalizes — returns A when both others are 1.0', () => {
    // score = 1.0 * (40/75) + 1.0 * (35/75) = 75/75 = 1.0 → A
    const result = computeDecisionGrade(1.0, 1.0, 0, 0)
    expect(result).toBe('A')
  })

  it('D-06: NaN guard — chipROIPositiveRate NaN is ignored when chipCount=0', () => {
    // NaN chipROIPositiveRate must not poison the score when chipCount === 0
    const result = computeDecisionGrade(0.5, 0.5, Number.NaN, 0)
    expect(result).toBe('B')
  })

  it('D-06: partial renormalization — returns B for 0.6 captainEV and 0.4 hitBE with chipCount=0', () => {
    // score = 0.6 * (40/75) + 0.4 * (35/75) = 0.32 + 0.18667 = 0.5067 → B
    const result = computeDecisionGrade(0.6, 0.4, 0, 0)
    expect(result).toBe('B')
  })

  it('standard 3-component path: 0.8 captainEV + 0.6 hitBE + 0.4 chipROI + chipCount=3 → B', () => {
    // score = 0.8*0.40 + 0.6*0.35 + 0.4*0.25 = 0.32 + 0.21 + 0.10 = 0.63 → B
    const result = computeDecisionGrade(0.8, 0.6, 0.4, 3)
    expect(result).toBe('B')
  })

  it('GradeLabel type is exported as a discriminated string literal — all values compile', () => {
    const a: GradeLabel = 'A'
    const b: GradeLabel = 'B'
    const c: GradeLabel = 'C'
    const d: GradeLabel = 'D'
    // If this test compiles and runs, the type export is correct
    expect([a, b, c, d]).toEqual(['A', 'B', 'C', 'D'])
  })
})
