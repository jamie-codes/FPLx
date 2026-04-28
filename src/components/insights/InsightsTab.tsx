'use client'

import { useInsights } from '@/lib/hooks/useInsights'
import type { Insight } from '@/lib/types'

// D-04 tier thresholds + D-05 badge colours (LOCKED by 33-UI-SPEC.md)
const TIER_CLASSES = {
  HIGH:   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  LOW:    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
} as const

type Tier = keyof typeof TIER_CLASSES

function getTier(pct: number): Tier {
  if (pct >= 70) return 'HIGH'
  if (pct >= 50) return 'MEDIUM'
  return 'LOW'
}

// D-06 four categories — render in this fixed order.
const CATEGORY_ORDER = ['defensive', 'attacking', 'player', 'captaincy'] as const
const CATEGORY_LABELS: Record<typeof CATEGORY_ORDER[number], string> = {
  defensive: 'Defensive Patterns',
  attacking: 'Attacking Patterns',
  player:    'Player-Specific Patterns',
  captaincy: 'Captaincy Patterns',
}

function InsightCard({ insight }: { insight: Insight }) {
  const tier = getTier(insight.confidence_pct)
  const tooltip = `True in ${insight.confidence_pct.toFixed(1)}% of fixtures — ${insight.sample_n}/${insight.sample_total} matches`
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-2">
      <p className="text-sm">{insight.statement}</p>
      <span
        className={`inline-block text-xs font-normal rounded px-2 py-1 cursor-help ${TIER_CLASSES[tier]}`}
        title={tooltip}
      >
        {tier}
      </span>
    </div>
  )
}

export function InsightsTab() {
  const { data, isLoading, error } = useInsights()

  if (isLoading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
        Loading insights…
      </p>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400 py-4">
        Failed to load insights. Check the pipeline output and refresh.
      </p>
    )
  }

  if (!data || data.length === 0) {
    return (
      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-semibold">No insights available yet</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Run the pipeline to generate pattern data for this season.
        </p>
      </section>
    )
  }

  // Group insights by category (already sorted by pipeline as (category asc, confidence_pct desc))
  const byCategory: Record<string, Insight[]> = {
    defensive: [],
    attacking: [],
    player:    [],
    captaincy: [],
  }
  for (const insight of data) {
    if (insight.category in byCategory) {
      byCategory[insight.category].push(insight)
    }
  }

  return (
    <section className="mt-6 space-y-6">
      {CATEGORY_ORDER.map((cat) => {
        const items = byCategory[cat]
        if (items.length === 0) return null
        return (
          <div key={cat}>
            <h2 className="text-lg font-semibold mb-2">{CATEGORY_LABELS[cat]}</h2>
            <div className="space-y-3">
              {items.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          </div>
        )
      })}
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-4">
        Patterns shown only when seen in 10 or more fixtures.
      </p>
    </section>
  )
}
