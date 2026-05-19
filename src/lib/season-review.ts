// Phase 124 REV-02: season review grade computation.
// Pure module — no React, no fetch. Mirrors src/lib/regret.ts conventions.
//
// Sources of truth:
//   .planning/phases/124-season-review/124-CONTEXT.md §D-05, D-06

/**
 * Discriminated string literal type for the decision quality grade.
 * A = excellent (score >= 0.75), B = good (>= 0.50), C = fair (>= 0.25), D = poor (< 0.25).
 */
export type GradeLabel = 'A' | 'B' | 'C' | 'D'

/**
 * D-05/D-06: weighted composite decision quality grade (v1).
 *
 * Standard 3-component weighted score (chipCount > 0):
 *   score = captainEVRate × 0.40 + hitBreakEvenRate × 0.35 + chipROIPositiveRate × 0.25
 *
 * D-06: When chipCount === 0, the chip ROI component is excluded and the remaining
 * two weights are renormalized to 100% (captainEV = 40/75 ≈ 53.3%, hitBE = 35/75 ≈ 46.7%).
 * This avoids penalizing chip-saving as a strategy and prevents NaN propagation
 * when chipRoi is empty (chipROIPositiveRate argument is NOT referenced in the zero-chip branch).
 *
 * Thresholds (D-05, v1 — methodology note required on card):
 *   score >= 0.75 → 'A'
 *   score >= 0.50 → 'B'
 *   score >= 0.25 → 'C'
 *   score <  0.25 → 'D'
 *
 * @param captainEVRate       Fraction of GWs where user captain met or beat the model ceiling (0..1)
 * @param hitBreakEvenRate    Fraction of hits that broke even (0..1); pass 1.0 if no hits were taken
 * @param chipROIPositiveRate Fraction of chips played that returned above-average points (0..1); ignored when chipCount === 0
 * @param chipCount           Number of chips played this season (BB/TC/FH only; 0 triggers D-06 renormalization)
 */
export function computeDecisionGrade(
  captainEVRate: number,
  hitBreakEvenRate: number,
  chipROIPositiveRate: number,
  chipCount: number,
): GradeLabel {
  const score = chipCount === 0
    ? captainEVRate * (40 / 75) + hitBreakEvenRate * (35 / 75)  // D-06: renormalized to 100%; chipROIPositiveRate NOT referenced
    : captainEVRate * 0.40 + hitBreakEvenRate * 0.35 + chipROIPositiveRate * 0.25
  if (score >= 0.75) return 'A'
  if (score >= 0.50) return 'B'
  if (score >= 0.25) return 'C'
  return 'D'
}
