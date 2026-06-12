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
  // UIX-04: 48h lineup-news border → warning token (D-13 amber semantics)
  const borderClass = departed
    ? 'border border-line opacity-50'
    : hasNews
      ? 'border-2 border-warning'
      : 'border border-line'

  if (departed) {
    return (
      <div className={`rounded bg-surface-1 p-3 text-sm space-y-1 ${borderClass}`}>
        <div className="flex items-center gap-1">
          <span className="text-xs text-ink-muted">ID: {player.id}</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-surface-2 text-ink-muted">
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
  // UIX-04 ruling 3: price rise/fall → positive/negative tokens
  const trendCls = fullPlayer.cost_change_event > 0
    ? 'text-positive'
    : 'text-negative'

  return (
    <div className={`rounded bg-surface-1 p-3 text-sm space-y-1 ${borderClass}`}>
      {/* Position badge */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-surface-2 text-ink-muted">
          {POSITION_LABELS[fullPlayer.element_type] ?? '?'}
        </span>
        {inSquad && (
          <span
            aria-label="In your pre-season squad"
            className="inline-block w-2 h-2 rounded-full bg-positive ml-1"
          />
        )}
      </div>

      {/* Player name */}
      <div className="font-semibold text-ink truncate">
        {fullPlayer.web_name}
      </div>

      {/* Confirmed signing badge (WATCH-02) — before price line, not shown when departed */}
      {confirmedSigningTooltip !== undefined && (
        <div className="pb-1">
          <ConfirmedSigningBadge tooltipText={confirmedSigningTooltip} />
        </div>
      )}

      {/* Price + trend arrow */}
      <div className="text-xs text-ink">
        £{(fullPlayer.now_cost / 10).toFixed(1)}m
        {trendArrow !== null && (
          <span className={`ml-1 ${trendCls}`}>{trendArrow}</span>
        )}
      </div>

      {/* Ownership */}
      <div className="text-xs text-ink-muted">
        {fullPlayer.selected_by_percent}%
      </div>
    </div>
  )
}
