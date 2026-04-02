import type { PlanStep } from '@/lib/types'

/**
 * Compute total net gain across all plan steps.
 * Uses the best-scored transfer (index 0) per step; hold steps (no scoredTransfers) count as 0.
 */
export function computePlanValue(steps: PlanStep[]): number {
  return steps.reduce((sum, step) => sum + (step.scoredTransfers[0]?.netGain ?? 0), 0)
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
