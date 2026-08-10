'use client'
// Chip-timeline: a horizontal GW axis (horizonStart..horizonEnd) with recommended
// windows drawn as positioned segments. play = accent fill, consider = muted. When
// there are no windows (early season) or the horizon is unknown (old cached JSON),
// it renders the track with an honest "no confirmed windows yet" hint.
import type { ChipWindow } from '@/lib/types'

function label(w: ChipWindow): string {
  return w.start_gw === w.end_gw ? `GW${w.start_gw}` : `GW${w.start_gw}-${w.end_gw}`
}

export function ChipTimelineBar({
  windows,
  horizonStart,
  horizonEnd,
}: {
  windows: ChipWindow[]
  horizonStart?: number
  horizonEnd?: number
}) {
  const hasHorizon = typeof horizonStart === 'number' && typeof horizonEnd === 'number' && horizonEnd > horizonStart
  const show = hasHorizon && windows.length > 0

  if (!show) {
    return (
      <div className="relative h-4 w-full rounded bg-surface-2" role="img" aria-label="No confirmed chip windows yet">
        <span className="absolute inset-0 flex items-center justify-center text-data text-ink-faint">
          no confirmed windows yet
        </span>
      </div>
    )
  }

  const span = horizonEnd! - horizonStart!
  return (
    <div className="relative h-4 w-full rounded bg-surface-2" role="img" aria-label="Recommended chip windows by gameweek">
      {windows.map((w) => {
        const left = ((w.start_gw - horizonStart!) / span) * 100
        const width = ((w.end_gw - w.start_gw + 1) / span) * 100
        return (
          <span
            key={`${w.start_gw}-${w.end_gw}`}
            data-window
            data-strength={w.strength}
            title={w.reason}
            className={`absolute inset-y-0 flex items-center justify-center rounded text-[10px] font-medium leading-none ${
              w.strength === 'play'
                ? 'bg-accent text-on-accent'
                : 'bg-surface-1 border border-line text-ink-muted'
            }`}
            style={{ left: `${left}%`, width: `${Math.max(width, 6)}%` }}
          >
            {label(w)}
          </span>
        )
      })}
    </div>
  )
}
