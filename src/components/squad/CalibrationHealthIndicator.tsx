'use client'

import type { AccuracyBacktest, CalibrationBucket } from '@/lib/types'

interface CalibrationHealthIndicatorProps {
  data: AccuracyBacktest
}

type Tier = 'good' | 'fair' | 'poor'

const TIER_BADGE_CLASSES: Record<Tier, string> = {
  good: 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900',
  fair: 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900',
  poor: 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900',
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
        className="flex items-center gap-3 py-3 px-4 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
      >
        <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0">Model health</span>
        <span className="text-sm text-zinc-700 dark:text-zinc-300">
          Calibration evidence will appear after 3+ completed GWs.
        </span>
      </div>
    )
  }

  // D-09 / D-10 / D-11: max haul-rate deviation -> tier -> locked status sentence.
  const maxDeviation = Math.max(...buckets.map((b) => Math.abs(b.actual_rate - b.bucket_mid)))
  const tier = computeTier(maxDeviation)
  const N = Math.round(maxDeviation * 100)
  const M = buckets.length
  const sentence = `Calibration: ${tier} — predicted vs actual within ${N}pp across ${M} deciles`

  return (
    <div
      role="status"
      className="flex items-center gap-3 py-3 px-4 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
    >
      <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0">Model health</span>
      <span
        aria-label={`Calibration health: ${tier}`}
        className={`text-xs font-semibold rounded px-2 py-0.5 ${TIER_BADGE_CLASSES[tier]}`}
      >
        {tier}
      </span>
      <span className="text-sm text-zinc-700 dark:text-zinc-300">{sentence}</span>
    </div>
  )
}
