'use client'

// Redesign §4 (Transfers): the "Why X over Y?" explainer — numbered comparative
// reasons + an amber risk line, from compareTransfers(). Renders nothing when
// there is nothing to say (e.g. two near-identical candidates).
import type { MergedPlayer } from '@/lib/types'
import { compareTransfers } from '@/lib/compare-transfers'

export function WhyOverCard({ x, y }: { x: MergedPlayer; y: MergedPlayer }) {
  const { reasons, risk } = compareTransfers(x, y)
  if (reasons.length === 0 && !risk) return null

  return (
    <div className="rounded-lg border border-line bg-surface-1 p-4">
      <h3 className="text-h4 font-semibold text-ink mb-2">
        Why {x.web_name} over {y.web_name}?
      </h3>
      <ul className="space-y-1.5">
        {reasons.map((r, i) => (
          <li key={r} className="flex gap-2 text-data text-ink">
            <span className="tabular text-accent font-semibold shrink-0">{String(i + 1).padStart(2, '0')}</span>
            <span>{r}</span>
          </li>
        ))}
        {risk && (
          <li className="flex gap-2 text-data text-ink-muted">
            <span className="text-warning font-semibold shrink-0">!</span>
            <span>Risk: {risk}</span>
          </li>
        )}
      </ul>
    </div>
  )
}
