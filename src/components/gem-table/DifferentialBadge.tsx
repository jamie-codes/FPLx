'use client'

// Phase 30 TMPL-01, TMPL-02 — differential flag badge component.
// UIX-03: thin wrapper delegating to the Chip primitive per the badge policy
// (DIFF → positive, TRAP → warning, null/undefined → em-dash). Call sites stable.
// Tooltip: native HTML title attribute (no Radix — project pattern from VarianceBadge.tsx).
import { Chip } from '@/components/ui/Chip'

export function DifferentialBadge({
  flag,
  ownership,
}: {
  flag: 'diff' | 'trap' | null | undefined
  ownership: number | null | undefined
}) {
  if (!flag) return <span className="text-ink-muted">—</span>

  const pct = ownership != null ? ownership.toFixed(1) : '?'

  if (flag === 'diff') {
    return (
      <Chip
        intent="positive"
        size="sm"
        title={`Differential: ${pct}% owned, above-average xPts for position. Low ownership = rank gain potential.`}
      >
        DIFF
      </Chip>
    )
  }

  return (
    <Chip
      intent="warning"
      size="sm"
      title={`Template trap: ${pct}% owned, below-average xPts for position. High ownership with weak projections.`}
    >
      TRAP
    </Chip>
  )
}
