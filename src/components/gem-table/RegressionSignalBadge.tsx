'use client'

// Phase 29 REG-01, REG-02 — regression signal badge component.
// UIX-03: thin wrapper delegating to the Chip primitive per the badge policy
// (BUY → positive, SELL → warning, null/undefined → em-dash). Call sites stable.
// Tooltip: native HTML title attribute (no Radix — project pattern from VarianceBadge.tsx).
import { Chip } from '@/components/ui/Chip'

export function RegressionSignalBadge({
  signal,
  delta,
}: {
  signal: 'buy' | 'sell' | null | undefined
  delta: number | null | undefined
}) {
  if (!signal) return <span className="text-ink-muted">—</span>

  const deltaStr = delta != null ? (delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)) : ''

  if (signal === 'buy') {
    return (
      <Chip
        intent="positive"
        size="sm"
        title={`Underperforming xG+xA over last 5 GW (delta ${deltaStr} per match). Actual G+A below expected — may regress upward. Consider buying.`}
      >
        BUY
      </Chip>
    )
  }

  return (
    <Chip
      intent="warning"
      size="sm"
      title={`Overperforming xG+xA over last 5 GW (delta ${deltaStr} per match). Actual G+A above expected — may regress downward. Consider selling.`}
    >
      SELL
    </Chip>
  )
}
