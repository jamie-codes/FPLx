'use client'

// Phase 127 WATCH-02 + D-14: Bespoke WatchlistPlayerCard — does NOT reuse PriceTrendCell
// or NewsBanner (table-cell components with fixed widths). ConfirmedSigningBadge IS
// imported per WATCH-02 explicit enumeration (D-14 prohibition scoped to PriceTrendCell/NewsBanner).
import type { MergedPlayer } from '@/lib/types'
import { ConfirmedSigningBadge } from '@/components/shared/ConfirmedSigningBadge'

const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

export interface WatchlistPlayerCardProps {
  player: MergedPlayer | { id: number }
  departed: boolean
  hasNews: boolean
  inSquad: boolean
  confirmedSigningTooltip?: string
}

export function WatchlistPlayerCard({
  player,
  departed,
  hasNews,
  inSquad,
  confirmedSigningTooltip,
}: WatchlistPlayerCardProps) {
  const borderClass = departed
    ? 'border border-zinc-200 dark:border-zinc-700 opacity-50'
    : hasNews
      ? 'border-2 border-amber-400 dark:border-amber-500'
      : 'border border-zinc-200 dark:border-zinc-700'

  if (departed) {
    return (
      <div className={`rounded bg-white dark:bg-zinc-800 p-3 text-sm space-y-1 ${borderClass}`}>
        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">ID: {player.id}</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
            Departed
          </span>
        </div>
      </div>
    )
  }

  const fullPlayer = player as MergedPlayer
  const trendArrow = fullPlayer.cost_change_event > 0
    ? '▲'
    : fullPlayer.cost_change_event < 0
      ? '▼'
      : null
  const trendCls = fullPlayer.cost_change_event > 0
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400'

  return (
    <div className={`rounded bg-white dark:bg-zinc-800 p-3 text-sm space-y-1 ${borderClass}`}>
      {/* Position badge */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
          {POSITION_LABELS[fullPlayer.element_type] ?? '?'}
        </span>
        {inSquad && (
          <span
            aria-label="In your pre-season squad"
            className="inline-block w-2 h-2 rounded-full bg-green-500 ml-1"
          />
        )}
      </div>

      {/* Player name */}
      <div className="font-semibold text-zinc-800 dark:text-zinc-100 truncate">
        {fullPlayer.web_name}
      </div>

      {/* Confirmed signing badge (WATCH-02) — before price line, not shown when departed */}
      {confirmedSigningTooltip !== undefined && (
        <div className="pb-1">
          <ConfirmedSigningBadge tooltipText={confirmedSigningTooltip} />
        </div>
      )}

      {/* Price + trend arrow */}
      <div className="text-xs text-zinc-600 dark:text-zinc-300">
        £{(fullPlayer.now_cost / 10).toFixed(1)}m
        {trendArrow !== null && (
          <span className={`ml-1 ${trendCls}`}>{trendArrow}</span>
        )}
      </div>

      {/* Ownership */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        {fullPlayer.selected_by_percent}%
      </div>
    </div>
  )
}
