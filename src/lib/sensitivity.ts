// Phase 64 (SENS-01): computeFragility — pure fragility detector.
// Sources of truth:
//   - .planning/phases/064-sensitivity-analysis/064-CONTEXT.md §decisions D-04 through D-12
//   - .planning/phases/064-sensitivity-analysis/064-RESEARCH.md §Pattern 1
// Conditions:
//   - start_prob < 0.70                          → 'start_prob < 70%'
//   - fixtures[0].difficulty_tier === 'medium'   → 'harder fixture'
//   - isTransfer && xPtsGain < 4.0               → 'taken as a hit (-4pt)'
import type { MergedPlayer } from '@/lib/types'

export interface FragilityResult {
  fragile: boolean
  reasons: string[]
}

export function computeFragility(
  _player: MergedPlayer,
  _isTransfer: boolean,
  _xPtsGain?: number,
): FragilityResult {
  // STUB — implementation comes in Task 2 (GREEN)
  return { fragile: false, reasons: [] }
}
