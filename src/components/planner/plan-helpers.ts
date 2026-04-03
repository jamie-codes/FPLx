import type { PlanStep } from '@/lib/types'

/**
 * Compute total net gain across all plan steps.
 * - WC/FH chip steps: use chipGain (multi-transfer total, no hit cost)
 * - BB/3xc chip steps: use transfer gain + bbValue (bench or captain bonus)
 * - Normal steps: use best-scored transfer netGain
 */
export function computePlanValue(steps: PlanStep[]): number {
  return steps.reduce((sum, step) => {
    const transferGain = step.chipGain !== undefined
      ? step.chipGain
      : (step.scoredTransfers[0]?.netGain ?? 0)
    return sum + transferGain + (step.bbValue ?? 0)
  }, 0)
}

/**
 * Human-readable chip labels keyed by chip code.
 */
export const CHIP_LABELS: Record<string, string> = {
  wildcard: 'Wildcard',
  freehit: 'Free Hit',
  bboost: 'Bench Boost',
  '3xc': 'Triple Captain',
}

/**
 * Format a numeric gain as a signed string with 1 decimal place.
 * Positive: '+5.2 pts'. Negative: uses U+2212 minus sign. Zero: '+0.0 pts'.
 */
export function formatGain(value: number): string {
  const abs = Math.abs(value).toFixed(1)
  if (value < 0) {
    return `\u2212${abs} pts`
  }
  return `+${abs} pts`
}
