'use client'

import type { ShortlistEntry } from '@/lib/replacement-shortlist'

interface ExplainPanelProps {
  reasons: string[]
  shortlist: ShortlistEntry[] | null
  rejectionReasons?: string[]   // Phase 65 WHY-03 (D-08)
}

export function ExplainPanel({ reasons, shortlist, rejectionReasons }: ExplainPanelProps) {
  return (
    <div className="bg-surface-2 border-t border-line px-3 py-2 space-y-2">
      {/* Reasons section */}
      <ul className="space-y-0.5">
        {reasons.map((reason, i) => (
          <li key={i} className="text-xs text-ink-muted">
            {reason}
          </li>
        ))}
      </ul>

      {/* Phase 65 WHY-03: rejection reasons section — between positive reasons and shortlist (D-08). */}
      {rejectionReasons && rejectionReasons.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-ink-muted">Why not recommended:</p>
          <ul className="space-y-0.5">
            {rejectionReasons.map((reason, i) => (
              <li key={i} className="text-xs text-ink-muted">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Shortlist section — only for Sell-verdicted players */}
      {shortlist !== null && shortlist.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-ink-muted">Replacement options</p>
          {shortlist.map((entry, i) => (
            <div key={entry.player.id} className="flex items-center gap-2 text-xs text-ink">
              <span className="w-4 text-ink-muted">{i + 1}</span>
              <span className="font-medium">{entry.player.web_name}</span>
              <span className="text-ink-muted">{entry.player.team_short_name}</span>
              <span className="text-positive">+{entry.pts_delta.toFixed(1)} pts</span>
              {entry.budget_sufficient ? (
                <span className="text-positive bg-positive-soft rounded px-1">Affordable</span>
              ) : (
                <span className="text-negative bg-negative-soft rounded px-1">Over budget</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
