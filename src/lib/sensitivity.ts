// Phase 64 (SENS-01): computeFragility — pure fragility detector.
// Sources of truth:
//   - .planning/phases/064-sensitivity-analysis/064-CONTEXT.md §decisions D-04 through D-12
//   - .planning/phases/064-sensitivity-analysis/064-RESEARCH.md §Pattern 1
// Conditions:
//   - start_prob < 0.70                          → 'start_prob < 70%'
//   - fixtures[0].difficulty_tier === 'medium'   → 'harder fixture'
//   - isTransfer && xPtsGain < 4.0               → 'taken as a hit (-4pt)'
import type { MergedPlayer } from '@/lib/types'

// Exported constants for fragility reason strings — import these in callers instead of
// hardcoding the literal, so that a rename here is caught at compile time.
export const FRAGILITY_START_PROB = 'start_prob < 70%'
export const FRAGILITY_HARDER_FIXTURE = 'harder fixture'

export interface FragilityResult {
  fragile: boolean
  reasons: string[]
}

export function computeFragility(
  player: MergedPlayer,
  isTransfer: boolean,
  xPtsGain?: number,
): FragilityResult {
  const reasons: string[] = []

  // D-07: rotation risk — applies to both transfers and captains
  if (player.start_prob < 0.70) {
    reasons.push('start_prob < 70%')
  }

  // D-04, D-05: fixture worsening risk — only fixtures[0] (next GW); BGW guard
  if (
    player.fixtures.length > 0 &&
    player.fixtures[0].difficulty_tier === 'medium'
  ) {
    reasons.push('harder fixture')
  }

  // D-09, D-10: hit cost — transfer candidates only
  if (isTransfer && xPtsGain !== undefined && xPtsGain < 4.0) {
    reasons.push('taken as a hit (-4pt)')
  }

  return { fragile: reasons.length > 0, reasons }
}
