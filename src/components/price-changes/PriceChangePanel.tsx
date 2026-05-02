'use client'

import { usePriceChanges } from '@/lib/hooks/usePriceChanges'
import type { PriceChangePrediction } from '@/lib/types'

// Phase 51 D-13 severity convention (HIGH=red urgency)
const CONFIDENCE_CLASSES = {
  HIGH:   'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  LOW:    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
} as const

type Tier = keyof typeof CONFIDENCE_CLASSES

const MIN_DAYS_FOR_TIERS = 14  // CONTEXT.md D-06

// CONTEXT.md D-04 thresholds
function getConfidenceTier(pct: number): Tier {
  if (pct >= 70) return 'HIGH'
  if (pct >= 40) return 'MEDIUM'
  return 'LOW'
}

function formatEta(eta: number): string {
  const days = Math.round(eta)
  if (days <= 0) return 'Tonight'
  return `${days} day${days === 1 ? '' : 's'}`
}

export function PriceChangePanel() {
  const { data, isLoading, error } = usePriceChanges()

  if (isLoading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
        Loading price change predictions…
      </p>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400 py-4">
        Failed to load price change data. Check the pipeline output and refresh.
      </p>
    )
  }

  if (!data || !data.predictions || data.predictions.length === 0) {
    return (
      <section className="mt-6 space-y-2" aria-label="Price change predictions not available">
        <h2 className="text-lg font-semibold">No price change data yet</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Run the pipeline to generate price change predictions.
        </p>
      </section>
    )
  }

  const showTier = data.snapshot_days >= MIN_DAYS_FOR_TIERS  // D-06 badge suppression
  const rises = data.predictions
    .filter((p) => p.direction === 'rise')
    .sort((a, b) => b.confidence_pct - a.confidence_pct)
  const falls = data.predictions
    .filter((p) => p.direction === 'fall')
    .sort((a, b) => b.confidence_pct - a.confidence_pct)

  return (
    <section className="mt-6 space-y-6" aria-label="Price change predictions">
      {data.snapshot_days < MIN_DAYS_FOR_TIERS && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
          Early data — less than 14 days of snapshots. Confidence scores are estimates only.
        </p>
      )}

      {rises.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Predicted to rise</h2>
          <div className="space-y-3">
            {rises.map((p) => (
              <PredictionRow key={p.player_id} prediction={p} showTier={showTier} />
            ))}
          </div>
        </div>
      )}

      {falls.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Predicted to fall</h2>
          <div className="space-y-3">
            {falls.map((p) => (
              <PredictionRow key={p.player_id} prediction={p} showTier={showTier} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function PredictionRow({ prediction, showTier }: { prediction: PriceChangePrediction; showTier: boolean }) {
  const tier = getConfidenceTier(prediction.confidence_pct)
  const barColor = prediction.direction === 'rise' ? 'bg-rose-500' : 'bg-red-500'
  const costPounds = (prediction.now_cost / 10).toFixed(1)

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{prediction.name}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {prediction.team} · £{costPounds}m
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showTier && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${CONFIDENCE_CLASSES[tier]}`}>
              {tier}
            </span>
          )}
          <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
            {Math.round(prediction.confidence_pct)}%
          </span>
        </div>
      </div>

      <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${prediction.confidence_pct}%` }}
        />
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        ETA: {formatEta(prediction.eta_days)}
      </p>
    </div>
  )
}
