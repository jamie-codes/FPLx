'use client'

import type { ScoredPlayer } from '@/lib/types'
import type { SquadPick, EntryHistory } from '@/lib/squad-adapter'
import { MinsRiskBadge } from '@/components/shared/MinsRiskBadge'
import { VerdictBadge } from '@/components/shared/VerdictBadge'
import type { Verdict } from '@/lib/recommend'

interface SquadViewProps {
  picks: SquadPick[]
  allPlayers: ScoredPlayer[]
  entryHistory: EntryHistory
  verdicts?: Map<number, Verdict>
}

const POSITION_LABELS: Record<number, string> = {
  1: 'GK',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
}

function StatusBadge({ status, news }: { status: string; news: string }) {
  if (status === 'a') {
    return (
      <span
        className="inline-block w-2.5 h-2.5 rounded-full bg-green-500"
        title={news || 'Available'}
      />
    )
  }
  if (status === 'd') {
    return (
      <span
        className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400"
        title={news || 'Doubtful'}
      />
    )
  }
  // injured, suspended, unavailable, not available
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full bg-red-500"
      title={news || 'Unavailable'}
    />
  )
}

export function SquadView({ picks, allPlayers, entryHistory, verdicts }: SquadViewProps) {
  // Cross-reference picks with allPlayers by element id
  const playerMap = new Map(allPlayers.map(p => [p.id, p]))

  // Build pick rows with full player data
  const pickRows = picks
    .map(pick => {
      const player = playerMap.get(pick.element)
      return player ? { pick, player } : null
    })
    .filter((row): row is { pick: SquadPick; player: ScoredPlayer } => row !== null)

  // Group by element_type (1=GK, 2=DEF, 3=MID, 4=FWD), then sort within each group by position
  const groupedByPosition: Record<number, typeof pickRows> = { 1: [], 2: [], 3: [], 4: [] }
  for (const row of pickRows) {
    const et = row.player.element_type
    if (et === 1 || et === 2 || et === 3 || et === 4) {
      groupedByPosition[et].push(row)
    }
  }
  for (const et of [1, 2, 3, 4]) {
    groupedByPosition[et].sort((a, b) => a.pick.position - b.pick.position)
  }

  const bankM = (entryHistory.bank / 10).toFixed(1)
  const valueM = (entryHistory.value / 10).toFixed(1)

  return (
    <div className="space-y-4">
      {/* Budget summary */}
      <div className="text-sm text-zinc-600 border border-zinc-200 rounded px-3 py-2 bg-zinc-50">
        Bank: <span className="font-medium">£{bankM}m</span> (approx) &nbsp;|&nbsp; Team value:{' '}
        <span className="font-medium">£{valueM}m</span> (approx)
      </div>

      {/* Position groups */}
      {([1, 2, 3, 4] as const).map(et => {
        const rows = groupedByPosition[et]
        if (rows.length === 0) return null
        return (
          <div key={et}>
            <h3 className="text-sm font-semibold text-zinc-700 mb-1">{POSITION_LABELS[et]}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="px-3 py-2 font-medium text-zinc-500 whitespace-nowrap">Player</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 whitespace-nowrap">Team</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 whitespace-nowrap">Price</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 whitespace-nowrap">Own%</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 whitespace-nowrap">Mins</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 whitespace-nowrap">Gem</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 whitespace-nowrap">Status</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 whitespace-nowrap">Risk</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 whitespace-nowrap">Rec</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ pick, player }) => {
                    const isBench = pick.position >= 12
                    const priceM = (player.now_cost / 10).toFixed(1)
                    return (
                      <tr
                        key={pick.element}
                        className={`border-b border-zinc-100 hover:bg-zinc-50 ${isBench ? 'opacity-50' : ''}`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-zinc-900">
                          {player.web_name}
                          {pick.is_captain && (
                            <span className="ml-1 text-xs font-bold text-amber-600">(C)</span>
                          )}
                          {pick.is_vice_captain && (
                            <span className="ml-1 text-xs font-semibold text-zinc-500">(VC)</span>
                          )}
                          {isBench && (
                            <span className="ml-1 text-xs text-zinc-400">bench</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-zinc-600">
                          {player.team_short_name}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-zinc-600">
                          £{priceM}m{' '}
                          <span className="text-zinc-400 text-xs">(approx)</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-zinc-600">
                          {player.selected_by_percent}%
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-zinc-600">
                          {player.minutes}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-zinc-600">
                          {player.gem_score.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <StatusBadge status={player.status} news={player.news} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <MinsRiskBadge minsRisk={player.mins_risk} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {!isBench && verdicts?.get(pick.element) ? (
                            <VerdictBadge verdict={verdicts.get(pick.element)!} />
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
