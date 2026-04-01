'use client'

import type { ShortlistEntry } from '@/lib/replacement-shortlist'

interface ExplainPanelProps {
  reasons: string[]
  shortlist: ShortlistEntry[] | null
}

export function ExplainPanel({ reasons, shortlist }: ExplainPanelProps) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-100 dark:border-zinc-700 px-3 py-2 space-y-2">
      {/* Reasons section */}
      <ul className="space-y-0.5">
        {reasons.map((reason, i) => (
          <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400">
            {reason}
          </li>
        ))}
      </ul>

      {/* Shortlist section — only for Sell-verdicted players */}
      {shortlist !== null && shortlist.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Replacement options</p>
          {shortlist.map((entry, i) => (
            <div key={entry.player.id} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
              <span className="w-4 text-zinc-400 dark:text-zinc-500">{i + 1}</span>
              <span className="font-medium">{entry.player.web_name}</span>
              <span className="text-zinc-500 dark:text-zinc-400">{entry.player.team_short_name}</span>
              <span className="text-green-700">+{entry.pts_delta.toFixed(1)} pts</span>
              {entry.budget_sufficient ? (
                <span className="text-green-600 bg-green-50 dark:bg-green-950 rounded px-1">Affordable</span>
              ) : (
                <span className="text-red-600 bg-red-50 dark:bg-red-950 rounded px-1">Over budget</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
