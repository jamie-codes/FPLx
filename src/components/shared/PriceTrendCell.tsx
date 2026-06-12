'use client'
// UIX-03 Task 2: THE shared price-trend cell. The same renderer was previously
// duplicated verbatim in value-gems/columns.tsx and gem-table/columns.tsx —
// value-gems consumes this one now; UIX-03 Task 5 repoints gem-table here.
// Shows the GW change (primary, ↑/↓ in tenths→£m) with the season-to-date
// total as secondary sub-text per CONTEXT.md.
export function PriceTrendCell({ costChangeEvent, costChangeStart }: {
  costChangeEvent: number
  costChangeStart: number
}) {
  const seasonAmt = (Math.abs(costChangeStart) / 10).toFixed(1)
  const seasonSign = costChangeStart > 0 ? '+' : costChangeStart < 0 ? '-' : ''
  const seasonText = costChangeStart !== 0 ? `${seasonSign}${seasonAmt}m season` : ''

  if (costChangeEvent > 0) return (
    <div>
      <span className="text-positive">↑ {(costChangeEvent / 10).toFixed(1)}m</span>
      {seasonText && <span className="block text-[10px] text-ink-muted">{seasonText}</span>}
    </div>
  )
  if (costChangeEvent < 0) return (
    <div>
      <span className="text-negative">↓ {(Math.abs(costChangeEvent) / 10).toFixed(1)}m</span>
      {seasonText && <span className="block text-[10px] text-ink-muted">{seasonText}</span>}
    </div>
  )
  return (
    <div>
      <span className="text-ink-muted">—</span>
      {seasonText && <span className="block text-[10px] text-ink-muted">{seasonText}</span>}
    </div>
  )
}
