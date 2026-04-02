'use client'

import type { PlannerChip, ScoredPlayer } from '@/lib/types'

const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

interface SquadSnapshotRowProps {
  squadAfter: number[]
  positionsAfter: Record<number, number>
  transfersIn: number[]
  chip: PlannerChip
  playerMap: Map<number, ScoredPlayer>
}

export function SquadSnapshotRow({
  squadAfter,
  positionsAfter,
  transfersIn,
  chip,
  playerMap,
}: SquadSnapshotRowProps) {
  // Group squad IDs by element_type, with their position from positionsAfter
  const grouped: Record<number, Array<{ id: number; pos: number }>> = { 1: [], 2: [], 3: [], 4: [] }

  for (const id of squadAfter) {
    const player = playerMap.get(id)
    if (!player) continue
    const et = player.element_type
    if (et === 1 || et === 2 || et === 3 || et === 4) {
      grouped[et].push({ id, pos: positionsAfter[id] ?? 99 })
    }
  }

  // Sort each group by position ascending
  for (const et of [1, 2, 3, 4] as const) {
    grouped[et].sort((a, b) => a.pos - b.pos)
  }

  // Collect starters (pos <= 11) and bench (pos >= 12) across all position groups
  const startersByGroup: Array<{ et: number; items: Array<{ id: number; pos: number }> }> = []
  const benchItems: Array<{ id: number; pos: number }> = []

  for (const et of [1, 2, 3, 4] as const) {
    const starters = grouped[et].filter((p) => p.pos <= 11)
    const bench = grouped[et].filter((p) => p.pos >= 12)
    if (starters.length > 0) {
      startersByGroup.push({ et, items: starters })
    }
    benchItems.push(...bench)
  }

  // Sort bench players by position
  benchItems.sort((a, b) => a.pos - b.pos)

  function renderPlayerRow(id: number, isBench: boolean) {
    const player = playerMap.get(id)
    if (!player) return null
    const isIn = transfersIn.includes(id)
    const dimmed = isBench && chip !== 'bboost'

    return (
      <div
        key={id}
        className={`flex items-center gap-2 py-0.5 px-2 text-sm ${dimmed ? 'opacity-50' : ''}`}
      >
        <span className="text-zinc-900 dark:text-zinc-100">{player.web_name}</span>
        {isIn && (
          <span className="text-xs font-semibold text-green-600 dark:text-green-400">IN</span>
        )}
        <span className="text-zinc-500 dark:text-zinc-400 text-xs">{player.team_short_name}</span>
        {isBench && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">bench</span>
        )}
      </div>
    )
  }

  return (
    <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50">
      {/* Starters grouped by position */}
      {startersByGroup.map(({ et, items }, groupIndex) => (
        <div key={et}>
          <h4 className={`text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 ${groupIndex === 0 ? 'mt-0' : 'mt-2'}`}>
            {POSITION_LABELS[et]}
          </h4>
          {items.map(({ id }) => renderPlayerRow(id, false))}
        </div>
      ))}

      {/* Bench divider */}
      {benchItems.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-700 my-2 text-xs text-zinc-400 dark:text-zinc-500 text-center">
          -- bench --
        </div>
      )}

      {/* Bench players */}
      {benchItems.map(({ id }) => renderPlayerRow(id, true))}
    </div>
  )
}
