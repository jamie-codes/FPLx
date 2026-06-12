'use client'
// PICK-01: low-ownership gems row.
// UIX-03 Task 3: retokenized (plan said token-pure already; raw zinc found → migrated).
import type { MergedPlayer } from '@/lib/types'

export function UnderTheRadar({ players }: { players: MergedPlayer[] }) {
  if (players.length === 0) return null
  return (
    <div className="rounded-lg border border-line p-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide">
        Under the radar
        <span className="ml-2 font-normal normal-case text-xs text-ink-muted">
          highest xPts among &lt;10% owned
        </span>
      </h3>
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        {players.map((p) => (
          <span key={p.id} className="rounded-full border border-line px-3 py-1">
            <span className="font-medium">{p.web_name}</span>
            {' · '}{(p.xPts_1gw ?? 0).toFixed(1)} xPts
            {' · '}{Number(p.selected_by_percent).toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  )
}
