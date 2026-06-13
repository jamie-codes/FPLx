// Phase 102 MC-01: MCDistributionBar — visual horizontal range bar for the xPts hover card.
// Replaces inline Blank%/Haul%/Floor/Ceiling text rows in XPtsCell (columns.tsx).
// Display-only component — caller (XPtsCell) guards via showMC; this component performs no guards (D-04).

interface MCDistributionBarProps {
  blankProb: number   // 0–1 (accepted for API symmetry; not displayed in bar — bar-only design D-01)
  haulProb: number    // 0–1
  p10Pts: number      // base points, 1 decimal place
  p90Pts: number      // base points, 1 decimal place
}

export function MCDistributionBar({ blankProb, haulProb, p10Pts, p90Pts }: MCDistributionBarProps) {
  // blankProb intentionally unused in render (D-01 bar-only design); accepted in props for future reuse.
  void blankProb
  return (
    <div className="flex flex-col gap-1 w-full">
      {/* Bar row */}
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono text-ink-muted tabular-nums w-6 text-right">
          {p10Pts.toFixed(1)}
        </span>
        <div
          className="flex-1 h-1.5 rounded-full bg-surface-2 relative"
          role="img"
          aria-label={`MC range: ${p10Pts.toFixed(1)} to ${p90Pts.toFixed(1)} pts`}
        >
          <div className="absolute inset-y-0 left-0 w-full rounded-full bg-teal-500 dark:bg-teal-400" />
        </div>
        <span className="text-xs font-mono text-ink-muted tabular-nums w-6 text-left">
          {p90Pts.toFixed(1)}
        </span>
      </div>
      {/* Haul% row — conditional, same threshold (>= 0.40) and amber token as columns.tsx line 150 */}
      {haulProb >= 0.40 && (
        <div className="text-xs font-mono text-warning">
          Haul {(haulProb * 100).toFixed(0)}%
        </div>
      )}
    </div>
  )
}
