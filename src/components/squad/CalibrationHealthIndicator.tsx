'use client'

import type { AccuracyBacktest, CalibrationBucket } from '@/lib/types'

interface CalibrationHealthIndicatorProps {
  data: AccuracyBacktest
}

type Tier = 'good' | 'fair' | 'poor'

// UIX-04 ruling 3: good/fair/poor health -> positive/warning/negative tokens
const TIER_BADGE_CLASSES: Record<Tier, string> = {
  good: 'text-positive bg-positive-soft',
  fair: 'text-warning bg-warning-soft',
  poor: 'text-negative bg-negative-soft',
}

// Phase 109 D-09/D-10: mode badge for MC vs Analytical calibration path
type CalibrationMode = 'mc' | 'analytical'

// UIX-04: MC (teal identity) -> accent, analytical -> neutral tokens
const MODE_BADGE_CLASSES: Record<CalibrationMode, string> = {
  mc: 'text-accent bg-accent-soft',
  analytical: 'text-ink-muted bg-surface-2',
}

const MODE_BADGE_LABEL: Record<CalibrationMode, string> = {
  mc: 'MC',
  analytical: 'Analytical',
}

function computeTier(maxDeviation: number): Tier {
  if (maxDeviation < 0.05) return 'good'
  if (maxDeviation <= 0.10) return 'fair'
  return 'poor'
}

/**
 * Phase 103 CAL-02: one-sentence calibration health row for DecisionSummaryTab.
 * Reads `data.calibration.by_position.all` (~200 obs/decile aggregate). Returns null
 * when calibration is absent (legacy cache) or empty (pool guard hit). Shows a static
 * cold-start prompt when fewer than 3 completed GWs are available.
 *
 * See `.planning/phases/103-calibration-sparse-bucket-fix-health-indicator/103-UI-SPEC.md`
 * for the locked Tailwind class strings and copy contract.
 */
export function CalibrationHealthIndicator({ data }: CalibrationHealthIndicatorProps) {
  const buckets: CalibrationBucket[] | undefined = data.calibration?.by_position?.all

  // D-12: silent omission when calibration is absent or empty (legacy cache or pool guard hit).
  if (!buckets || buckets.length === 0) {
    return null
  }

  // D-13: cold-start override — no tier badge, just the prompt.
  if (data.gws_covered.length < 3) {
    return (
      <div
        role="status"
        className="flex items-center gap-3 py-3 px-4 border-t border-line bg-surface-1"
      >
        <span className="text-xs text-ink-muted shrink-0">Model health</span>
        <span className="text-sm text-ink">
          Calibration evidence will appear after 3+ completed GWs.
        </span>
      </div>
    )
  }

  // D-09 / D-10 / D-11: max haul-rate deviation -> tier -> locked status sentence.
  // Phase 109 D-11 bug fix: use predicted_rate (not bucket_mid) so MC-mode tier is correct.
  const maxDeviation = Math.max(...buckets.map((b) => Math.abs(b.actual_rate - b.predicted_rate)))
  const tier = computeTier(maxDeviation)
  const calibrationMode = data.summary?.calibration_mode as CalibrationMode | undefined
  const N = Math.round(maxDeviation * 100)
  const M = buckets.length
  const sentence = `Calibration: ${tier} — predicted vs actual within ${N}pp across ${M} deciles`

  return (
    <div
      role="status"
      className="flex items-center gap-3 py-3 px-4 border-t border-line bg-surface-1"
    >
      <span className="text-xs text-ink-muted shrink-0">Model health</span>
      <span
        aria-label={`Calibration health: ${tier}`}
        className={`text-xs font-semibold rounded px-2 py-0.5 ${TIER_BADGE_CLASSES[tier]}`}
      >
        {tier}
      </span>
      {calibrationMode && (
        <span
          aria-label={`Calibration mode: ${MODE_BADGE_LABEL[calibrationMode]}`}
          className={`text-xs font-semibold rounded px-2 py-0.5 ${MODE_BADGE_CLASSES[calibrationMode]}`}
        >
          {MODE_BADGE_LABEL[calibrationMode]}
        </span>
      )}
      <span className="text-sm text-ink">{sentence}</span>
    </div>
  )
}
