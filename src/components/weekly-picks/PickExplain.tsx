'use client'
// PICK-02: Presentational component for pick explanations.
// Tokens only — no raw palette values. Pure display, no ranking logic.
import type { PickExplanation } from '@/lib/explain-pick'

export function PickExplain({ explanation }: { explanation: PickExplanation }) {
  const { reasons, risks } = explanation
  return (
    <div className="space-y-1.5 text-data">
      {/* Why the model rates this player */}
      <ul className="space-y-0.5">
        {reasons.map((reason) => (
          <li key={reason} className="flex items-start gap-1.5">
            <span className="text-positive shrink-0">✓</span>
            <span className="text-positive">{reason}</span>
          </li>
        ))}
      </ul>

      {/* What could make this wrong */}
      {risks.length > 0 ? (
        <ul className="space-y-0.5">
          {risks.map((risk) => (
            <li key={risk} className="flex items-start gap-1.5">
              <span className="text-warning shrink-0">⚠</span>
              <span className="text-warning">{risk}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">No major flags</p>
      )}
    </div>
  )
}
