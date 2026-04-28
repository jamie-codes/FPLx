'use client'

// Phase 30 TMPL-01, TMPL-02 — differential flag badge component.
// Visual envelope matches RegressionSignalBadge.tsx and VarianceBadge.tsx (text-xs font-normal rounded px-2 py-1).
// DIFF = green pill, TRAP = amber pill, null/undefined = em-dash.
// Tooltip: native HTML title attribute (no Radix — project pattern from VarianceBadge.tsx).

export function DifferentialBadge({
  flag,
  ownership,
}: {
  flag: 'diff' | 'trap' | null | undefined
  ownership: number | null | undefined
}) {
  if (!flag) return <span className="text-zinc-400">—</span>

  const pct = ownership != null ? ownership.toFixed(1) : '?'

  if (flag === 'diff') {
    return (
      <span
        className="inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
        title={`Differential: ${pct}% owned, above-average xPts for position. Low ownership = rank gain potential.`}
      >
        DIFF
      </span>
    )
  }

  return (
    <span
      className="inline-block text-xs font-normal rounded px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
      title={`Template trap: ${pct}% owned, below-average xPts for position. High ownership with weak projections.`}
    >
      TRAP
    </span>
  )
}
