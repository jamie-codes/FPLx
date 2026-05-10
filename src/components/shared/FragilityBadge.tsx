// Phase 93 (SENS-01): FragilityBadge — tristate inline indicator.
// Sources of truth:
//   - .planning/phases/93-sensitivity-analysis-enhancements/93-UI-SPEC.md §Component Specification: FragilityBadge
//   - .planning/phases/93-sensitivity-analysis-enhancements/93-CONTEXT.md §decisions D-07, D-08, D-09
// Tier mapping:
//   'robust'     → renders nothing (null)
//   'fragile'    → amber tone:  text-amber-600 dark:text-amber-400
//   'knife_edge' → orange tone: text-orange-600 dark:text-orange-400
// Pitfall 4 (from Phase 64): NO filled-pill classes (bg-*, inline-block, rounded) — preserves
// visual distinction from DangerousToFadeBadge / McLabel / SeverityBadge MEDIUM / RotationRiskBadge.

import type { FragilityTier } from '@/lib/sensitivity'

interface FragilityBadgeProps {
  tier: FragilityTier
  reasons: string[]
}

const TIER_CLASSES: Record<Exclude<FragilityTier, 'robust'>, string> = {
  fragile:    'text-xs text-amber-600 dark:text-amber-400',
  knife_edge: 'text-xs text-orange-600 dark:text-orange-400',
}

export function FragilityBadge({ tier, reasons }: FragilityBadgeProps) {
  if (tier === 'robust') return null
  return (
    <div className={TIER_CLASSES[tier]} data-testid="fragility-badge">
      <span aria-hidden="true">⚠ </span>
      {`no longer recommended if: ${reasons.join(', ')}`}
    </div>
  )
}
