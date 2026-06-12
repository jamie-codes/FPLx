import type { FPLElementRaw } from '@/lib/fpl-adapter'
import type { FPLTeam } from '@/lib/types'
import { TableShell } from '@/components/ui/Table'

interface TopScorersTableProps {
  players: FPLElementRaw[]
  livePoints: Record<number, number>
  teams: FPLTeam[]
}

const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
const POSITIONS = [1, 2, 3, 4] as const
const TOP_N = 5

export function TopScorersTable({ players, livePoints, teams }: TopScorersTableProps) {
  const teamMap = new Map(teams.map(t => [t.id, t]))

  return (
    <div className="grid grid-cols-4 gap-3">
      {POSITIONS.map(pos => {
        const posPlayers = players
          .filter(p => p.element_type === pos)
          .sort((a, b) => (livePoints[b.id] ?? 0) - (livePoints[a.id] ?? 0))
          .slice(0, TOP_N)

        // UIX-04: per-position card chrome unified onto the TableShell primitive
        // (surface-1 + line border + rounded shell).
        return (
          <TableShell key={pos}>
            <div className="bg-surface-2 px-3 py-2 text-center">
              <span className="text-xs font-bold text-ink-muted uppercase tracking-wide">
                {POSITION_LABELS[pos]}
              </span>
            </div>
            <div className="divide-y divide-line">
              {posPlayers.map((player, idx) => {
                const pts = livePoints[player.id] ?? 0
                const team = teamMap.get(player.team)
                const isTop = idx === 0

                return (
                  <div
                    key={player.id}
                    data-testid={`${POSITION_LABELS[pos].toLowerCase()}-row-${player.web_name}`}
                    className={`flex items-center justify-between px-2 py-1.5 ${
                      isTop ? 'bg-surface-2' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs truncate ${isTop ? 'font-semibold text-ink' : 'text-ink'}`}>
                        {player.web_name}
                      </p>
                      <p className="text-[10px] text-ink-muted">
                        {team?.short_name ?? '?'} · £{(player.now_cost / 10).toFixed(1)}m
                      </p>
                    </div>
                    <span className={`text-sm font-bold ml-2 ${isTop ? 'text-positive' : 'text-ink-muted'}`}>
                      {pts}
                    </span>
                  </div>
                )
              })}
            </div>
          </TableShell>
        )
      })}
    </div>
  )
}
