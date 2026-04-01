'use client'

import React, { useState, useEffect } from 'react'
import type { ScoredPlayer } from '@/lib/types'
import type { SquadPick, EntryHistory } from '@/lib/squad-adapter'
import { MinsRiskBadge } from '@/components/shared/MinsRiskBadge'
import { VerdictBadge } from '@/components/shared/VerdictBadge'
import type { Verdict } from '@/lib/recommend'
import { computeExplanations } from '@/lib/explain'
import { computeReplacementShortlist } from '@/lib/replacement-shortlist'
import { ExplainPanel } from '@/components/squad/ExplainPanel'

interface SquadViewProps {
  picks: SquadPick[]
  allPlayers: ScoredPlayer[]
  entryHistory: EntryHistory
  verdicts?: Map<number, Verdict>
  exactSellPrices?: Map<number, number>
  isAuthenticated?: boolean
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

export function SquadView({ picks, allPlayers, entryHistory, verdicts, exactSellPrices, isAuthenticated }: SquadViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const hideOnMobile = isMobile ? 'hidden' : ''

  function toggleExpand(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const squadIds = new Set(picks.map(p => p.element))

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
      {/* Budget summary — D-05 (approx when unauth) / D-06 (exact when auth) */}
      <div className="text-sm text-zinc-600 border border-zinc-200 rounded px-3 py-2 bg-zinc-50">
        Bank:{' '}
        <span className="font-medium">
          {isAuthenticated ? `£${bankM}m` : (
            <span title="Approximate — log in for exact value">~£{bankM}m</span>
          )}
        </span>
        {!isAuthenticated && <span className="text-zinc-400 text-xs ml-1">(approx)</span>}
        &nbsp;|&nbsp; Team value:{' '}
        <span className="font-medium">£{valueM}m</span>
        {!isAuthenticated && <span className="text-zinc-400 text-xs ml-1">(approx)</span>}
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
                    <th className="px-3 py-2 font-medium text-zinc-500 whitespace-nowrap sticky left-0 z-30 bg-white">Player</th>
                    <th className={`px-3 py-2 font-medium text-zinc-500 whitespace-nowrap z-20 ${hideOnMobile}`}>Team</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 whitespace-nowrap z-20">Price</th>
                    <th className={`px-3 py-2 font-medium text-zinc-500 whitespace-nowrap z-20 ${hideOnMobile}`}>Own%</th>
                    <th className={`px-3 py-2 font-medium text-zinc-500 whitespace-nowrap z-20 ${hideOnMobile}`}>Mins</th>
                    <th className={`px-3 py-2 font-medium text-zinc-500 whitespace-nowrap z-20 ${hideOnMobile}`}>Gem</th>
                    <th className={`px-3 py-2 font-medium text-zinc-500 whitespace-nowrap z-20 ${hideOnMobile}`}>Status</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 whitespace-nowrap z-20">Risk</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 whitespace-nowrap z-20">Rec</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ pick, player }) => {
                    const isBench = pick.position >= 12
                    return (
                      <React.Fragment key={pick.element}>
                      <tr
                        className={`border-b border-zinc-100 hover:bg-zinc-50 ${isBench ? 'opacity-50' : ''}`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-zinc-900 sticky left-0 z-10 bg-white">
                          {!isBench && (
                            <button
                              onClick={() => toggleExpand(pick.element)}
                              className="inline-flex items-center mr-1 text-zinc-400 hover:text-zinc-600"
                              aria-label={expandedIds.has(pick.element) ? 'Collapse details' : 'Expand details'}
                            >
                              <span className="text-xs">{expandedIds.has(pick.element) ? '\u25BC' : '\u25B6'}</span>
                            </button>
                          )}
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
                        <td className={`px-3 py-2 whitespace-nowrap text-zinc-600 ${hideOnMobile}`}>
                          {player.team_short_name}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-zinc-600">
                          {(() => {
                            const exactPrice = exactSellPrices?.get(pick.element)
                            const priceVal = exactPrice ?? player.now_cost
                            const pM = (priceVal / 10).toFixed(1)
                            if (isAuthenticated && exactPrice !== undefined) {
                              return `£${pM}m`
                            }
                            return (
                              <span title="Approximate sell price — log in for exact value">
                                ~£{pM}m <span className="text-zinc-400 text-xs">(approx)</span>
                              </span>
                            )
                          })()}
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap text-zinc-600 ${hideOnMobile}`}>
                          {player.selected_by_percent}%
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap text-zinc-600 ${hideOnMobile}`}>
                          {player.minutes}
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap text-zinc-600 ${hideOnMobile}`}>
                          {player.gem_score.toFixed(2)}
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap ${hideOnMobile}`}>
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
                      {!isBench && expandedIds.has(pick.element) && (() => {
                        const reasons = computeExplanations(player)
                        const verdict = verdicts?.get(pick.element)
                        const shortlist = verdict === 'sell'
                          ? computeReplacementShortlist(player, allPlayers, squadIds, entryHistory.bank)
                          : null
                        return (
                          <tr key={`expand-${pick.element}`}>
                            <td colSpan={isMobile ? 4 : 9} className="px-0 py-0">
                              <ExplainPanel reasons={reasons} shortlist={shortlist} />
                            </td>
                          </tr>
                        )
                      })()}
                      </React.Fragment>
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
