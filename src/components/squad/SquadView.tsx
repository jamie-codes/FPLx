'use client'

import React, { useState, useEffect } from 'react'
import type { ScoredPlayer } from '@/lib/types'
import type { SquadPick, EntryHistory } from '@/lib/squad-adapter'
import { MinsRiskBadge } from '@/components/shared/MinsRiskBadge'
import { TeamBadge } from '@/components/shared/TeamBadge'
import { PlayerAvatar } from '@/components/shared/PlayerAvatar'
import { LifecycleLabelBadge } from '@/components/shared/LifecycleLabelBadge'
import type { LifecycleLabel } from '@/lib/lifecycle-label'
import { computeExplanations } from '@/lib/explain'
import { computeReplacementShortlist } from '@/lib/replacement-shortlist'
import { ExplainPanel } from '@/components/squad/ExplainPanel'
import { computeFragility, FRAGILITY_START_PROB, FRAGILITY_HARDER_FIXTURE } from '@/lib/sensitivity'
import type { Verdict } from '@/lib/recommend'
import type { CaptaincyCandidate } from '@/lib/captaincy-engine'

interface SquadViewProps {
  picks: SquadPick[]
  allPlayers: ScoredPlayer[]
  entryHistory: EntryHistory
  labels?: Map<number, LifecycleLabel>
  exactSellPrices?: Map<number, number>
  isAuthenticated?: boolean
  verdicts?: Map<number, Verdict>               // Phase 65 WHY-03 (D-10)
  captaincyCandidates?: CaptaincyCandidate[]    // Phase 65 WHY-03 (D-10)
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

export function SquadView({ picks, allPlayers, entryHistory, labels, exactSellPrices, isAuthenticated, verdicts, captaincyCandidates }: SquadViewProps) {
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
      <div className="text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 bg-zinc-50 dark:bg-zinc-800">
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
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{POSITION_LABELS[et]}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap sticky left-0 z-30 bg-white dark:bg-zinc-900">Player</th>
                    <th className={`px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap z-20 ${hideOnMobile}`}>Team</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap z-20">Price</th>
                    <th className={`px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap z-20 ${hideOnMobile}`}>Own%</th>
                    <th className={`px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap z-20 ${hideOnMobile}`}>Mins</th>
                    <th className={`px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap z-20 ${hideOnMobile}`}>Gem</th>
                    <th className={`px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap z-20 ${hideOnMobile}`}>Status</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap z-20">Risk</th>
                    <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap z-20">Rec</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ pick, player }) => {
                    const isBench = pick.position >= 12
                    return (
                      <React.Fragment key={pick.element}>
                      <tr
                        className={`border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 ${isBench ? 'opacity-50' : ''}`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-zinc-900 dark:text-zinc-100 sticky left-0 z-10 bg-white dark:bg-zinc-900">
                          <div className="flex items-center gap-2">
                            <PlayerAvatar code={player.code} webName={player.web_name} teamShortName={player.team_short_name} width={28} height={35} />
                            <div>
                              {!isBench && (
                                <button
                                  onClick={() => toggleExpand(pick.element)}
                                  className="inline-flex items-center mr-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                                  aria-label={expandedIds.has(pick.element) ? 'Collapse details' : 'Expand details'}
                                >
                                  <span className="text-xs">{expandedIds.has(pick.element) ? '\u25BC' : '\u25B6'}</span>
                                </button>
                              )}
                              <span>{player.web_name}</span>
                              {pick.is_captain && (
                                <span className="ml-1 text-xs font-bold text-amber-600 dark:text-amber-400">(C)</span>
                              )}
                              {pick.is_vice_captain && (
                                <span className="ml-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">(VC)</span>
                              )}
                              {isBench && (
                                <span className="ml-1 text-xs text-zinc-400 dark:text-zinc-500">bench</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400 ${hideOnMobile}`}>
                          <div className="flex items-center gap-1.5">
                            <TeamBadge shortName={player.team_short_name} size={16} />
                            <span>{player.team_short_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
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
                        <td className={`px-3 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400 ${hideOnMobile}`}>
                          {player.selected_by_percent}%
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400 ${hideOnMobile}`}>
                          {player.minutes}
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400 ${hideOnMobile}`}>
                          {player.gem_score.toFixed(2)}
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap ${hideOnMobile}`}>
                          <StatusBadge status={player.status} news={player.news} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <MinsRiskBadge minsRisk={player.mins_risk} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {!isBench ? (
                            <LifecycleLabelBadge label={labels?.get(pick.element) ?? null} />
                          ) : null}
                        </td>
                      </tr>
                      {!isBench && expandedIds.has(pick.element) && (() => {
                        const reasons = computeExplanations(player)
                        const label = labels?.get(pick.element)
                        const shortlist = (label === 'sell' || label === 'sell_soon')
                          ? computeReplacementShortlist(player, allPlayers, squadIds, entryHistory.bank)
                          : null

                        // Phase 65 WHY-03 (D-08, D-09, D-10): per-player rejection reasons.
                        const rejectionReasons: string[] = []
                        if (verdicts && captaincyCandidates) {
                          const verdict = verdicts.get(player.id)
                          if (verdict === 'sell' || verdict === 'hold') {
                            // Below xPts hold threshold (when verdict='sell')
                            if (verdict === 'sell') {
                              rejectionReasons.push('Below xPts hold threshold — consider rotating')
                            }
                            // Translate computeFragility short-codes to user-facing copy (Pitfall 4: isTransfer=false)
                            const { reasons: fragReasons } = computeFragility(player, false)
                            for (const r of fragReasons) {
                              if (r === FRAGILITY_START_PROB) {
                                rejectionReasons.push(`Rotation risk — start probability ${Math.round(player.start_prob * 100)}%`)
                              } else if (r === FRAGILITY_HARDER_FIXTURE) {
                                rejectionReasons.push('Difficult fixture this gameweek')
                              }
                            }
                            // Captain rejection (D-09): include only when player is NOT the top candidate.
                            const capIndex = captaincyCandidates.findIndex(c => c.player.id === player.id)
                            const topCap = captaincyCandidates[0]
                            if (topCap && topCap.player.id !== player.id && verdict === 'sell') {
                              const rank = capIndex === -1 ? '?' : String(capIndex + 1)
                              rejectionReasons.push(
                                `Ranked #${rank} at ${POSITION_LABELS[player.element_type]} by xPts — ${topCap.player.web_name} is the captain pick`
                              )
                            }
                          }
                        }

                        return (
                          <tr key={`expand-${pick.element}`}>
                            <td colSpan={isMobile ? 4 : 9} className="px-0 py-0">
                              <ExplainPanel reasons={reasons} shortlist={shortlist} rejectionReasons={rejectionReasons} />
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
