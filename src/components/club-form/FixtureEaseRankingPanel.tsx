'use client'

import React, { useMemo, useState } from 'react'
import { useClubForm } from '@/lib/hooks/useClubForm'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { computeXgiInvolvement } from '@/lib/xgi'
import { GwToggle } from '@/components/gem-table/GwToggle'
import { RegressionSignalBadge } from '@/components/gem-table/RegressionSignalBadge'
import { DifferentialBadge } from '@/components/gem-table/DifferentialBadge'
import { AttDefToggle } from './AttDefToggle'
import { EaseBar } from './EaseBar'
import type { ClubForm, MergedPlayer } from '@/lib/types'

const POS_LABEL: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
function posLabel(et: number): string {
  return POS_LABEL[et] ?? ''
}

function getTopPlayers(
  teamId: number,
  players: MergedPlayer[],
  xgiMap: Map<number, number>,
): MergedPlayer[] {
  return players
    .filter((p) => p.team === teamId && p.status === 'a')
    .sort((a, b) => (xgiMap.get(b.id) ?? 0) - (xgiMap.get(a.id) ?? 0))
    .slice(0, 3)
}

type Win = 1 | 3 | 5
type Mode = 'ATT' | 'DEF'

function easeKey(mode: Mode, win: Win): keyof ClubForm {
  const prefix = mode === 'ATT' ? 'attacking' : 'defensive'
  return `${prefix}_ease_${win}gw` as keyof ClubForm
}

export function FixtureEaseRankingPanel() {
  const { data, isLoading, error } = useClubForm()
  const [win, setWin] = useState<Win>(3)
  const [mode, setMode] = useState<Mode>('ATT')
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null)
  const { data: players } = usePlayers()
  // Compute once per render — 700-element pass is cheap
  const xgiMap = useMemo(() => computeXgiInvolvement(players ?? []), [players])

  // Mobile layout is handled entirely via Tailwind responsive classes (sm:) — no JS-side
  // viewport detection needed. The earlier useState/useEffect pair for isMobile was
  // removed in revision iteration 2 (lint warning: destructured value never read).

  if (isLoading) {
    return <p className="text-ink-muted">Loading fixture ease...</p>
  }
  if (error) {
    return (
      <p className="text-negative">
        Failed to load fixture ease: {error instanceof Error ? error.message : String(error)}
      </p>
    )
  }
  if (!data) return null

  const key = easeKey(mode, win)
  const ranked = [...data]
    .filter((t) => typeof t[key] === 'number')
    .sort((a, b) => (b[key] as number) - (a[key] as number)) // easiest first

  return (
    <section className="mb-6" data-testid="fixture-ease-panel">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-xl font-bold">Fixture Ease Ranking</h2>
        <div className="flex gap-2 items-center">
          <AttDefToggle value={mode} onChange={setMode} />
          <GwToggle value={win} onChange={setWin} />
        </div>
      </div>
      <ul className="space-y-1">
        {ranked.map((team, i) => {
          const ease = team[key] as number
          const isTarget = team.upcoming_fixtures
            .slice(0, 5)
            .filter((f) => f.attacking_difficulty < 0.5).length >= 4
          const isExpanded = isTarget && expandedTeamId === team.team_id
          const topPlayers = isExpanded
            ? getTopPlayers(team.team_id, players ?? [], xgiMap)
            : []
          return (
            <React.Fragment key={team.team_id}>
              <li
                className="flex items-center gap-2 text-sm"
                data-testid={`ease-row-${team.team_short_name}`}
                {...(isTarget
                  ? {
                      onClick: () =>
                        setExpandedTeamId(
                          expandedTeamId === team.team_id ? null : team.team_id,
                        ),
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setExpandedTeamId(
                            expandedTeamId === team.team_id ? null : team.team_id,
                          )
                        }
                      },
                      tabIndex: 0,
                      role: 'button',
                      style: { cursor: 'pointer' },
                    }
                  : {})}
              >
                <span className="w-6 text-right text-ink-muted">{i + 1}</span>
                <span className="w-12 font-mono">{team.team_short_name}</span>
                {/* review 2026-08-29: label folded into EaseBar (clamped, aria-hidden) */}
                <EaseBar ease={ease} showLabel />
                {isTarget && (
                  <>
                    <span
                      className="inline-block text-xs font-normal rounded px-2 py-1 bg-positive-soft text-positive"
                      title="4+ favourable fixtures in the next 5 GWs (attacking difficulty < 0.5). Click to see top players."
                      data-testid={`target-badge-${team.team_short_name}`}
                    >
                      TARGET
                    </span>
                    <span
                      className="ml-auto text-ink-muted w-4 h-4"
                      title={isExpanded ? 'Hide player list' : 'Show top players for this team'}
                      aria-hidden="true"
                    >
                      {isExpanded ? '▴' : '▾'}
                    </span>
                  </>
                )}
              </li>
              {isExpanded && (
                <li
                  className="mt-1 mb-2 pl-8 bg-surface-2 rounded list-none"
                  data-testid={`expanded-${team.team_short_name}`}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-ink-muted border-b border-line">
                          <th className="py-1 pr-3 text-left w-28">Player</th>
                          <th className="py-1 pr-3 text-left w-8">Pos</th>
                          <th className="py-1 pr-3 text-right w-10">xGI%</th>
                          <th className="py-1 pr-3 text-right w-10">xPts</th>
                          <th className="py-1 pr-3 w-14">Signal</th>
                          <th className="py-1 pr-3 w-14">Diff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topPlayers.map((p) => {
                          const share = xgiMap.get(p.id)
                          return (
                            <tr key={p.id} data-testid={`player-row-${p.id}`}>
                              <td className="py-1 pr-3 font-semibold truncate max-w-[7rem]">
                                {p.web_name}
                              </td>
                              <td className="py-1 pr-3">{posLabel(p.element_type)}</td>
                              <td className="py-1 pr-3 text-right">
                                {share != null ? (
                                  `${(share * 100).toFixed(0)}%`
                                ) : (
                                  <span className="text-ink-muted">—</span>
                                )}
                              </td>
                              <td className="py-1 pr-3 text-right">
                                {p.xPts_1gw != null ? p.xPts_1gw.toFixed(1) : '—'}
                              </td>
                              <td className="py-1 pr-3">
                                <RegressionSignalBadge
                                  signal={p.regression_signal}
                                  delta={p.actual_vs_xg_delta}
                                />
                              </td>
                              <td className="py-1 pr-3">
                                <DifferentialBadge
                                  flag={p.differential_flag}
                                  ownership={parseFloat(p.selected_by_percent)}
                                />
                              </td>
                            </tr>
                          )
                        })}
                        {topPlayers.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-xs text-ink-muted py-1">
                              No available players with xGI data for this team.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </li>
              )}
            </React.Fragment>
          )
        })}
      </ul>
    </section>
  )
}
