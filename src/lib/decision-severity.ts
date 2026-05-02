// Phase 51 (WDS-03 / WDS-05): computeDecisionSeverity — pure rule classifier for the
// four severity badges on the Weekly Decision Summary tab (Captain, Transfer, Chip, Risk).
// Mirrors src/lib/opportunity-cost.ts pattern: no 'use client', no React, no side effects,
// importable in @vitest-environment node tests.
//
// Rules locked in .planning/phases/051-weekly-decision-summary/051-CONTEXT.md §D-12:
//   - Captain: HIGH when top1 >= 2*top2 (with top2 > 0 guard); else MEDIUM.
//   - Transfer: HIGH if any 'sell'/'minutes_trap'; MEDIUM if any 'sell_soon'/'fixture_trap'; else LOW.
//   - Risk: same rule as Transfer (worst-severity flag shown).
//   - Chip: HIGH if (DGW||BGW) && hasAvailableChip && hasRecommendedChip;
//           MEDIUM if hasRecommendedChip; else LOW.
import type { CaptaincyCandidate } from './captaincy-engine'
import type { LifecycleLabel } from './lifecycle-label'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SeverityLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface DecisionSeverity {
  captain: SeverityLevel
  transfer: SeverityLevel
  chip: SeverityLevel
  risk: SeverityLevel
}

export interface ComputeDecisionSeverityArgs {
  candidates: CaptaincyCandidate[]
  riskLabels: LifecycleLabel[]
  isDGW: boolean
  isBGW: boolean
  hasAvailableChip: boolean
  hasRecommendedChip: boolean
}

// ---------------------------------------------------------------------------
// Pure classifier
// ---------------------------------------------------------------------------

export function computeDecisionSeverity(
  args: ComputeDecisionSeverityArgs,
): DecisionSeverity {
  // Captain: HIGH when #1 >= 2 * #2 (and top2 > 0 to avoid division-by-zero / single-candidate degenerate case).
  const top1 = args.candidates[0]?.projected_captain_pts ?? 0
  const top2 = args.candidates[1]?.projected_captain_pts ?? 0
  const captain: SeverityLevel = top2 > 0 && top1 >= 2 * top2 ? 'HIGH' : 'MEDIUM'

  // Transfer & Risk: shared rule — worst label visible across the squad.
  const hasUrgent = args.riskLabels.some(l => l === 'sell' || l === 'minutes_trap')
  const hasWarning = args.riskLabels.some(l => l === 'sell_soon' || l === 'fixture_trap')
  const transferRisk: SeverityLevel = hasUrgent ? 'HIGH' : hasWarning ? 'MEDIUM' : 'LOW'

  // Chip: HIGH gated on DGW/BGW + availability + recommendation; MEDIUM only requires recommendation.
  const chip: SeverityLevel =
    (args.isDGW || args.isBGW) && args.hasAvailableChip && args.hasRecommendedChip
      ? 'HIGH'
      : args.hasRecommendedChip
        ? 'MEDIUM'
        : 'LOW'

  return {
    captain,
    transfer: transferRisk,
    chip,
    risk: transferRisk,
  }
}
