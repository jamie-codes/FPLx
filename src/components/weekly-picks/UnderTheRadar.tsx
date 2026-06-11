'use client'
// PICK-01: low-ownership gems row.
import type { MergedPlayer } from '@/lib/types'

export function UnderTheRadar({ players }: { players: MergedPlayer[] }) {
  if (players.length === 0) return null
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 p-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
        Under the radar
        <span className="ml-2 font-normal normal-case text-xs text-zinc-500 dark:text-zinc-400">
          highest xPts among &lt;10% owned
        </span>
      </h3>
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        {players.map((p) => (
          <span key={p.id} className="rounded-full border border-zinc-300 dark:border-zinc-600 px-3 py-1">
            <span className="font-medium">{p.web_name}</span>
            {' · '}{(p.xPts_1gw ?? 0).toFixed(1)} xPts
            {' · '}{Number(p.selected_by_percent).toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  )
}
