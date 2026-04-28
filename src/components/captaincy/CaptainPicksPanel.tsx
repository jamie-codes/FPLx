'use client'

import { useCaptainPicks } from '@/lib/hooks/useCaptainPicks'
import type { CaptainPick } from '@/lib/types'

const TOOLTIPS = {
  ceiling: 'Highest 90th-percentile xPts. Captain when chasing rank — accepts higher variance for upside.',
  eo: 'Highest 90th-percentile xPts among players with under 25% ownership. Reduces rank variance vs the template.',
} as const

const LABELS = {
  ceiling: 'Ceiling',
  eo: 'EO-Adjusted',
} as const

const EMPTY_COPY = {
  ceiling: 'No ceiling pick available',
  eo: 'No EO-adjusted pick available',
} as const

function PickCard({ kind, pick }: { kind: 'ceiling' | 'eo'; pick: CaptainPick | null }) {
  if (!pick) {
    return (
      <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-2">
        <h3 className="text-sm font-semibold" title={TOOLTIPS[kind]}>{LABELS[kind]}</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{EMPTY_COPY[kind]}</p>
      </div>
    )
  }
  const price = (pick.now_cost / 10).toFixed(1)
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" title={TOOLTIPS[kind]}>{LABELS[kind]}</h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{pick.position}</span>
      </div>
      <p className="text-base font-semibold">{pick.name}</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {pick.team} · £{price}m · {pick.selected_by_percent}% owned
      </p>
      <p className="text-sm">
        xPts: <span className="font-semibold">{pick.xPts_1gw.toFixed(1)}</span>
        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
          (90th pct: {pick.xPts_90th_1gw.toFixed(1)})
        </span>
      </p>
    </div>
  )
}

export function CaptainPicksPanel() {
  const { data, isLoading, error } = useCaptainPicks()

  if (isLoading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
        Loading captain picks…
      </p>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400 py-4">
        Failed to load captain picks. Check the pipeline output and refresh.
      </p>
    )
  }

  if (!data) return null

  const sameAsCeiling =
    data.ceiling != null && data.eo_adjusted != null && data.ceiling.id === data.eo_adjusted.id

  return (
    <section className="mt-6 space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Captain Picks — GW {data.gameweek ?? '—'}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Ceiling = chase rank. EO-Adjusted = protect rank.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PickCard kind="ceiling" pick={data.ceiling} />
        <PickCard kind="eo" pick={data.eo_adjusted} />
      </div>
      {sameAsCeiling && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Ceiling pick is also low-owned — same player satisfies both criteria this GW.
        </p>
      )}
    </section>
  )
}
