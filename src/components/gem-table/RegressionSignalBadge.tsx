// Phase 29 REG-01, REG-02 — regression signal badge component.
// Visual envelope matches VarianceBadge.tsx and MinsRiskBadge.tsx (text-xs font-normal rounded px-2 py-1).
// BUY = green pill, SELL = amber pill, null/undefined = em-dash.
// Tooltip: native HTML title attribute (no Radix — project pattern from VarianceBadge.tsx).

export function RegressionSignalBadge({
  signal,
  delta,
}: {
  signal: 'buy' | 'sell' | null | undefined
  delta: number | null | undefined
}) {
  if (!signal) return <span className="text-zinc-400">—</span>

  const deltaStr = delta != null ? delta.toFixed(2) : ''

  if (signal === 'buy') {
    return (
      <span
        className="inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
        title={`Underperforming xG+xA over last 5 GW (delta ${deltaStr} per match). Actual G+A below expected — may regress upward. Consider buying.`}
      >
        BUY
      </span>
    )
  }

  return (
    <span
      className="inline-block text-xs font-normal rounded px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
      title={`Overperforming xG+xA over last 5 GW (delta +${deltaStr} per match). Actual G+A above expected — may regress downward. Consider selling.`}
    >
      SELL
    </span>
  )
}
