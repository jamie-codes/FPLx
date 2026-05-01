'use client'

import React, { useMemo, useState } from 'react'
import { useClubForm } from '@/lib/hooks/useClubForm'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useSquad } from '@/lib/hooks/useSquad'
import { GwToggle } from '@/components/gem-table/GwToggle'
import { RegressionSignalBadge } from '@/components/gem-table/RegressionSignalBadge'
import { DifferentialBadge } from '@/components/gem-table/DifferentialBadge'
import { EaseBar } from './EaseBar'
import type { ClubForm, MergedPlayer } from '@/lib/types'

const POS_LABEL: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
function posLabel(et: number): string {
  return POS_LABEL[et] ?? ''
}

// Phase 47 D-01: a team is "materially improving" when upcoming N-GW ease is at least
// 0.20 above the past 3-GW average; symmetric for worsening.
const SWING_THRESHOLD = 0.20
// Phase 47 D-02: cap at 4 improving + 4 worsening (8 rows max). If fewer qualify, show fewer.
const ROW_CAP = 4

type Win = 1 | 3 | 5

function swingValue(team: ClubForm, win: Win): number | null {
  if (win === 1) return team.swing_1gw
  if (win === 3) return team.swing_3gw
  return team.swing_5gw
}

function easeValue(team: ClubForm, win: Win): number | null {
  if (win === 1) return team.attacking_ease_1gw
  if (win === 3) return team.attacking_ease_3gw
  return team.attacking_ease_5gw
}

function useTeamIdFromStorage(): string | null {
  const [teamId, setTeamId] = useState<string | null>(null)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('fpl_team_id')
    setTeamId(stored && stored.trim().length > 0 ? stored : null)
  }, [])
  return teamId
}

export function FixtureSwingDetector() {
  const { data, isLoading, error } = useClubForm()
  const { data: players } = usePlayers()
  const teamId = useTeamIdFromStorage()
  const { data: squad } = useSquad(teamId)
  const [win, setWin] = useState<Win>(3)
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null)

  // Set of FPL team_ids the user owns at least one player from (SWG-04).
  const ownedTeamIds = useMemo<Set<number>>(() => {
    if (!squad?.picks || !players) return new Set()
    const set = new Set<number>()
    const playerById = new Map(players.map((p) => [p.id, p]))
    for (const pick of squad.picks) {
      const player = playerById.get(pick.element)
      if (player) set.add(player.team)
    }
    return set
  }, [squad, players])

  // Owned players grouped by team — used for the expanded sub-row.
  const ownedByTeam = useMemo<Map<number, MergedPlayer[]>>(() => {
    const map = new Map<number, MergedPlayer[]>()
    if (!squad?.picks || !players) return map
    const playerById = new Map(players.map((p) => [p.id, p]))
    for (const pick of squad.picks) {
      const player = playerById.get(pick.element)
      if (!player) continue
      const list = map.get(player.team) ?? []
      list.push(player)
      map.set(player.team, list)
    }
    return map
  }, [squad, players])

  if (isLoading) {
    return <p className="text-gray-500 dark:text-zinc-400">Loading fixture data...</p>
  }
  if (error) {
    return (
      <p className="text-red-500">
        Failed to load fixture data: {error instanceof Error ? error.message : String(error)}
      </p>
    )
  }
  if (!data) return null

  // Classify and cap. BGW teams (null swing) are silently excluded.
  const withSwing = data
    .map((t) => ({ team: t, swing: swingValue(t, win), ease: easeValue(t, win) }))
    .filter((row) => row.swing !== null && row.ease !== null) as Array<{ team: ClubForm; swing: number; ease: number }>

  const improving = withSwing
    .filter((row) => row.swing >= SWING_THRESHOLD)
    .sort((a, b) => b.swing - a.swing)
    .slice(0, ROW_CAP)

  const worsening = withSwing
    .filter((row) => row.swing <= -SWING_THRESHOLD)
    .sort((a, b) => a.swing - b.swing) // most-negative first
    .slice(0, ROW_CAP)

  function renderRow(
    row: { team: ClubForm; swing: number; ease: number },
    i: number,
    direction: 'IMPROVING' | 'WORSENING',
  ) {
    const ownedCount = ownedTeamIds.has(row.team.team_id)
      ? (ownedByTeam.get(row.team.team_id) ?? []).length
      : 0
    const isExpanded = expandedTeamId === row.team.team_id && ownedCount > 0

    return (
      <React.Fragment key={row.team.team_id}>
        <li
          className="flex items-center gap-2 text-sm"
          data-testid={`swing-row-${row.team.team_short_name}`}
          {...(ownedCount > 0
            ? {
                onClick: () =>
                  setExpandedTeamId(
                    expandedTeamId === row.team.team_id ? null : row.team.team_id,
                  ),
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setExpandedTeamId(
                      expandedTeamId === row.team.team_id ? null : row.team.team_id,
                    )
                  }
                },
                tabIndex: 0,
                role: 'button',
                style: { cursor: 'pointer' },
              }
            : {})}
        >
          <span className="w-6 text-right text-zinc-500">{i + 1}</span>
          <span className="w-12 font-mono">{row.team.team_short_name}</span>
          <EaseBar ease={row.ease} />
          <span className="w-14 text-right text-xs text-zinc-500">
            {row.swing > 0 ? '+' : ''}{(row.swing * 100).toFixed(0)}%
          </span>
          <span
            className={
              direction === 'IMPROVING'
                ? 'inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                : 'inline-block text-xs font-normal rounded px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
            }
            title={
              direction === 'IMPROVING'
                ? `Fixture run improving: upcoming ${win}GW ease ${(row.swing * 100).toFixed(0)}% above past 3GW average. Potential buy signal for ${row.team.team_short_name} defenders.`
                : `Fixture run worsening: upcoming ${win}GW ease ${(row.swing * 100).toFixed(0)}% below past 3GW average. Consider selling ${row.team.team_short_name} defenders.`
            }
            data-testid={`swing-direction-${row.team.team_short_name}`}
          >
            {direction}
          </span>
          {ownedCount > 0 && (
            <>
              <span
                className="inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 ml-1"
                title="Click to see your owned players from this team."
                data-testid={`you-own-badge-${row.team.team_short_name}`}
              >
                You own {ownedCount}
              </span>
              <span
                className="ml-auto text-zinc-400 dark:text-zinc-500 w-4 h-4"
                title={isExpanded ? 'Hide owned players' : 'Show owned players for this team'}
                aria-hidden="true"
              >
                {isExpanded ? '▴' : '▾'}
              </span>
            </>
          )}
        </li>
        {isExpanded && (
          <li
            className="mt-1 mb-2 pl-8 bg-zinc-50 dark:bg-zinc-800 rounded list-none"
            data-testid={`expanded-${row.team.team_short_name}`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="py-1 pr-3 text-left w-28">Player</th>
                    <th className="py-1 pr-3 text-left w-8">Pos</th>
                    <th className="py-1 pr-3 text-right w-10">xPts</th>
                    <th className="py-1 pr-3 w-14">Signal</th>
                    <th className="py-1 pr-3 w-14">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {(ownedByTeam.get(row.team.team_id) ?? []).map((p) => (
                    <tr key={p.id} data-testid={`swing-player-row-${p.id}`}>
                      <td className="py-1 pr-3 font-semibold truncate max-w-[7rem]">{p.web_name}</td>
                      <td className="py-1 pr-3">{posLabel(p.element_type)}</td>
                      <td className="py-1 pr-3 text-right">{p.xPts_1gw != null ? p.xPts_1gw.toFixed(1) : '—'}</td>
                      <td className="py-1 pr-3">
                        <RegressionSignalBadge signal={p.regression_signal} delta={p.actual_vs_xg_delta} />
                      </td>
                      <td className="py-1 pr-3">
                        <DifferentialBadge flag={p.differential_flag} ownership={parseFloat(p.selected_by_percent)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </li>
        )}
      </React.Fragment>
    )
  }

  return (
    <section className="mb-6" data-testid="fixture-swing-panel">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-xl font-bold">Fixture Swing Detector</h2>
        <GwToggle value={win} onChange={setWin} />
      </div>
      {/* Improving section */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-2 text-green-700 dark:text-green-400">Improving</h3>
        {improving.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            No teams with materially improving fixtures this window.
          </p>
        ) : (
          <ul className="space-y-1">
            {improving.map((row, i) => renderRow(row, i, 'IMPROVING'))}
          </ul>
        )}
      </div>
      {/* Worsening section */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-amber-700 dark:text-amber-400">Worsening</h3>
        {worsening.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            No teams with materially worsening fixtures this window.
          </p>
        ) : (
          <ul className="space-y-1">
            {worsening.map((row, i) => renderRow(row, i, 'WORSENING'))}
          </ul>
        )}
      </div>
    </section>
  )
}
