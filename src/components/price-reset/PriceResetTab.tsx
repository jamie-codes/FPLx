'use client'

import { usePriceReset } from '@/lib/hooks/usePriceReset'
import type { PriceResetRow, ValueTargetRow } from '@/lib/types'

// UIX-04 ruling 3: price rise/fall semantics → positive/negative tokens
const DELTA_PILL_RISE = 'bg-positive-soft text-positive'
const DELTA_PILL_FALL = 'bg-negative-soft text-negative'

// Unicode minus U+2212 — appears once so every fall pill reuses it
const MINUS = '−'

function formatDeltaPounds(delta_cost: number): string {
  if (delta_cost > 0) {
    return `+${(delta_cost / 10).toFixed(1)}m`
  }
  return `${MINUS}${(Math.abs(delta_cost) / 10).toFixed(1)}m`
}

function PlayerDeltaRow({ row }: { row: PriceResetRow }) {
  return (
    <div className="rounded-md border border-line bg-surface-1 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{row.name}</p>
          <p className="text-xs text-ink-muted">
            {row.team} · £{(row.current_cost / 10).toFixed(1)}m
          </p>
        </div>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${row.delta_cost > 0 ? DELTA_PILL_RISE : DELTA_PILL_FALL}`}
        >
          {formatDeltaPounds(row.delta_cost)}
        </span>
      </div>
    </div>
  )
}

function ValueTargetRowView({ row }: { row: ValueTargetRow }) {
  return (
    <div className="rounded-md border border-line bg-surface-1 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{row.name}</p>
          <p className="text-xs text-ink-muted">
            {`${row.team} · £${(row.current_cost / 10).toFixed(1)}m · #${row.position_rank} ${row.position_label}`}
          </p>
        </div>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${row.delta_cost > 0 ? DELTA_PILL_RISE : DELTA_PILL_FALL}`}
        >
          {formatDeltaPounds(row.delta_cost)}
        </span>
      </div>
    </div>
  )
}

export function PriceResetTab() {
  const { data, isLoading, error } = usePriceReset()

  if (isLoading) {
    return (
      <p className="text-sm text-ink-muted text-center py-8">
        Loading price reset data…
      </p>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-negative py-4">
        Failed to load price reset data. Check the pipeline output and refresh.
      </p>
    )
  }

  if (!data || !data.published) {
    return (
      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-semibold">Prices not yet published</h2>
        <p className="text-sm text-ink-muted">
          FPL typically publishes new prices in mid-to-late July
        </p>
      </section>
    )
  }

  return (
    <section className="mt-6 space-y-6" aria-label="Price reset analysis">
      <div>
        <h2 className="text-lg font-semibold mb-2">Price Reset</h2>
        <div className="space-y-3">
          {data.players.map((p) => (
            <PlayerDeltaRow key={p.player_id} row={p} />
          ))}
        </div>
      </div>

      {data.value_targets.length > 0 && (
        <section className="mt-6 space-y-3" aria-label="Value targets — price fell, xPts above median">
          <h2 className="text-lg font-semibold">Value Targets</h2>
          <p className="text-xs text-ink-muted">
            Players whose price fell but xPts still rates above their position median
          </p>
          <div className="space-y-3">
            {data.value_targets.map((vt) => (
              <ValueTargetRowView key={vt.player_id} row={vt} />
            ))}
          </div>
        </section>
      )}
    </section>
  )
}
