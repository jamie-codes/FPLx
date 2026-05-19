'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useClubForm } from '@/lib/hooks/useClubForm'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useSquad } from '@/lib/hooks/useSquad'
import { useTeamBadge } from '@/lib/hooks/useTeamBadge'
import { tier } from '@/lib/club-form'
import { AttDefToggle } from './AttDefToggle'
import { HorizonToggle } from './HorizonToggle'
import { OwnedFilterToggle } from './OwnedFilterToggle'
import type { ClubForm, ClubFormFixture, DifficultyTier } from '@/lib/types'

const TIER_CLASSES: Record<DifficultyTier, string> = {
  easy:   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  hard:   'bg-red-100   text-red-800   dark:bg-red-900   dark:text-red-200',
}

const TIER_HEX: Record<DifficultyTier, string> = {
  easy:   '#dcfce7',
  medium: '#fef3c7',
  hard:   '#fee2e2',
}

const TIER_HEX_DARK: Record<DifficultyTier, string> = {
  easy:   '#14532d',  // green-900
  medium: '#78350f',  // amber-900
  hard:   '#7f1d1d',  // red-900
}

function currentTier(f: ClubFormFixture, mode: 'ATT' | 'DEF'): DifficultyTier {
  return mode === 'ATT' ? f.difficulty_tier : tier(f.defensive_difficulty)
}

interface Props {
  submittedId?: string | null
}

// --- HeatMapRow: module-level to avoid remount on every FixtureHeatMap render ---

export interface HeatMapRowProps {
  t: ClubForm
  grid: {
    allEventIds: number[]
    byTeamGw: Map<number, Map<number, ClubFormFixture[]>>
    byTeamGwPlayed: Map<number, Map<number, ClubFormFixture[]>>
  }
  mode: 'ATT' | 'DEF'
  tierMap: Record<DifficultyTier, string>
  ownedTeamIds: Set<number>
}

export function HeatMapRow({ t, grid, mode, tierMap, ownedTeamIds }: HeatMapRowProps) {
  const { src, onError, showFallback, fallbackColour, initial } = useTeamBadge(t.team_short_name)
  const isOwned = ownedTeamIds.has(t.team_id)
  const rowClass = isOwned
    ? 'border-b border-zinc-100 dark:border-zinc-800 bg-blue-50 dark:bg-blue-950 border-l-2 border-l-blue-500'
    : 'border-b border-zinc-100 dark:border-zinc-800'
  return (
    <tr className={rowClass} data-owned={isOwned ? 'true' : 'false'}>
      <th scope="row" className="px-2 py-1 text-left font-mono text-xs w-20 h-8">
        <span className="flex items-center gap-1">
          {showFallback ? (
            <span
              aria-hidden="true"
              className="w-5 h-5 rounded-full flex items-center justify-center text-white font-semibold text-[10px] shrink-0"
              style={{ background: fallbackColour }}
            >
              {initial}
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src!}
              alt=""
              width={20}
              height={20}
              className="w-5 h-5 object-contain shrink-0"
              onError={onError}
            />
          )}
          <span>{t.team_short_name}</span>
        </span>
      </th>
      {grid.allEventIds.map(gw => {
        const fixtures = grid.byTeamGw.get(t.team_id)?.get(gw) ?? []
        const playedFixtures = grid.byTeamGwPlayed.get(t.team_id)?.get(gw) ?? []
        if (fixtures.length === 0 && playedFixtures.length === 0) {
          // True BGW — unchanged visual
          return (
            <td
              key={gw}
              className="px-2 py-1 text-center min-w-[48px] h-8 bg-zinc-50 dark:bg-zinc-900"
              title="No fixture (BGW)"
            />
          )
        }
        if (fixtures.length === 0 && playedFixtures.length >= 2) {
          // Phase 111 FIX-01: DGW played cell — split gradient + opacity-40
          const colours = playedFixtures.map(f => tierMap[currentTier(f, mode)])
          const gradient = colours.length === 2
            ? `linear-gradient(to bottom right, ${colours[0]} 50%, ${colours[1]} 50%)`
            : `linear-gradient(to bottom right, ${colours[0]} 33%, ${colours[1]} 33% 66%, ${colours[2]} 66%)`
          const tooltip = playedFixtures
            .map(f => `${f.opponent_team} (${f.is_home ? 'H' : 'A'}) — Played`)
            .join(' / ')
          return (
            <td
              key={gw}
              className="relative px-0 py-0 text-center min-w-[48px] h-10 opacity-40"
              style={{ background: gradient }}
              title={tooltip}
            >
              <span className="absolute top-0 left-1 text-[10px] font-mono leading-none pt-0.5 text-zinc-900 dark:text-zinc-100">
                {playedFixtures[0].opponent_team}
              </span>
              <span className="absolute bottom-0 right-1 text-[10px] font-mono leading-none pb-0.5 text-zinc-900 dark:text-zinc-100">
                {playedFixtures[1].opponent_team}
              </span>
            </td>
          )
        }
        if (fixtures.length === 0 && playedFixtures.length === 1) {
          // Phase 111 FIX-01: single played cell — dimmed difficulty color + opponent label
          const f = playedFixtures[0]
          return (
            <td
              key={gw}
              className={`px-2 py-1 text-center min-w-[48px] h-8 ${TIER_CLASSES[currentTier(f, mode)]} opacity-40`}
              title={`${f.opponent_team} (${f.is_home ? 'H' : 'A'}) — Played`}
            >
              <span className="text-xs font-mono">{f.opponent_team}</span>
            </td>
          )
        }
        if (fixtures.length >= 2) {
          const colours = fixtures.map(f => tierMap[currentTier(f, mode)])
          const gradient = colours.length === 2
            ? `linear-gradient(to bottom right, ${colours[0]} 50%, ${colours[1]} 50%)`
            : `linear-gradient(to bottom right, ${colours[0]} 33%, ${colours[1]} 33% 66%, ${colours[2]} 66%)`
          const tooltip = fixtures
            .map(f => {
              const d = (mode === 'ATT' ? f.attacking_difficulty : f.defensive_difficulty) ?? 0
              return `${f.opponent_team} (${f.is_home ? 'H' : 'A'}) ${d.toFixed(2)}`
            })
            .join(' / ')
          return (
            <td
              key={gw}
              className="relative px-0 py-0 text-center min-w-[48px] h-10"
              style={{ background: gradient }}
              title={tooltip}
            >
              <span className="absolute top-0 left-1 text-[10px] font-mono leading-none pt-0.5 text-zinc-900 dark:text-zinc-100">
                {fixtures[0].opponent_team}
              </span>
              <span className="absolute bottom-0 right-1 text-[10px] font-mono leading-none pb-0.5 text-zinc-900 dark:text-zinc-100">
                {fixtures[1].opponent_team}
              </span>
              {fixtures.length >= 3 && (
                <span className="absolute bottom-0 left-1 text-[10px] font-mono leading-none pb-0.5 text-zinc-900 dark:text-zinc-100">
                  {fixtures[2].opponent_team}
                </span>
              )}
            </td>
          )
        }
        const f = fixtures[0]
        const diff = mode === 'ATT' ? f.attacking_difficulty : f.defensive_difficulty
        const baseTooltip = `${f.opponent_team} (${f.is_home ? 'H' : 'A'}) — ${(diff ?? 0).toFixed(2)}`
        const playedSuffix = playedFixtures
          .map(pf => `${pf.opponent_team} (${pf.is_home ? 'H' : 'A'}) — Played`)
          .join(' / ')
        const tooltip = playedSuffix.length > 0 ? `${baseTooltip} / ${playedSuffix}` : baseTooltip
        return (
          <td
            key={gw}
            className={`px-2 py-1 text-center min-w-[48px] h-8 ${TIER_CLASSES[currentTier(f, mode)]}`}
            title={tooltip}
          >
            <span className="text-xs font-mono">{f.opponent_team}</span>
          </td>
        )
      })}
    </tr>
  )
}

export function FixtureHeatMap({ submittedId = null }: Props) {
  const { data, isLoading, error } = useClubForm()
  const { data: squad } = useSquad(submittedId)
  const { data: players } = usePlayers()

  const [horizon, setHorizon] = useState<8 | 12 | 16>(8)
  const [mode, setMode] = useState<'ATT' | 'DEF'>('ATT')
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setOwnedOnly(false)
  }, [submittedId])

  useEffect(() => {
    const html = document.documentElement
    setIsDark(html.classList.contains('dark'))
    const observer = new MutationObserver(() => {
      setIsDark(html.classList.contains('dark'))
    })
    observer.observe(html, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

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

  const grid = useMemo(() => {
    if (!data || data.length === 0) return null
    // Phase 111 FIX-01: include current_gw_played event_ids so played-GW column always appears.
    const allEventIds = Array.from(
      new Set([
        ...data.flatMap(t => t.upcoming_fixtures.map(f => f.event_id)),
        ...data.flatMap(t => (t.current_gw_played ?? []).map(f => f.event_id)),
      ])
    ).sort((a, b) => a - b).slice(0, horizon)
    const byTeamGw = new Map<number, Map<number, ClubFormFixture[]>>()
    for (const t of data) {
      const m = new Map<number, ClubFormFixture[]>()
      for (const f of t.upcoming_fixtures) {
        const arr = m.get(f.event_id) ?? []
        arr.push(f)
        m.set(f.event_id, arr)
      }
      byTeamGw.set(t.team_id, m)
    }
    // Phase 111 FIX-01: second map for played current-GW fixtures.
    const byTeamGwPlayed = new Map<number, Map<number, ClubFormFixture[]>>()
    for (const t of data) {
      const m = new Map<number, ClubFormFixture[]>()
      for (const f of (t.current_gw_played ?? [])) {
        const arr = m.get(f.event_id) ?? []
        arr.push(f)
        m.set(f.event_id, arr)
      }
      byTeamGwPlayed.set(t.team_id, m)
    }
    const sortedTeams = [...data].sort((a, b) =>
      a.team_short_name.localeCompare(b.team_short_name)
    )
    return { allEventIds, byTeamGw, byTeamGwPlayed, sortedTeams }
  }, [data, horizon])

  if (isLoading) {
    return <p className="text-zinc-500 dark:text-zinc-400">Loading fixture heat map...</p>
  }
  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400 py-4">
        Failed to load fixture data. Check the pipeline output and refresh.
      </p>
    )
  }
  if (!data || data.length === 0 || !grid) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No fixture data available. Run the pipeline to generate fixture data.
      </p>
    )
  }

  const visibleTeams = ownedOnly && submittedId !== null
    ? grid.sortedTeams.filter(t => ownedTeamIds.has(t.team_id))
    : grid.sortedTeams

  const tierMap = isDark ? TIER_HEX_DARK : TIER_HEX

  return (
    <section className="mb-6" data-testid="fixture-heat-map">
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold">Fixture Heat Map</h2>
        <div className="flex flex-wrap items-center gap-2">
          <HorizonToggle value={horizon} onChange={setHorizon} />
          <AttDefToggle value={mode} onChange={setMode} />
          <OwnedFilterToggle
            value={ownedOnly}
            onChange={setOwnedOnly}
            disabled={submittedId === null}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[640px] w-full text-xs border-collapse">
          <thead>
            <tr>
              <th
                scope="col"
                aria-label="Team"
                className="px-2 py-1 text-left font-mono text-xs text-zinc-500 dark:text-zinc-400 w-20"
              ></th>
              {grid.allEventIds.map(gw => (
                <th
                  key={gw}
                  scope="col"
                  className="px-2 py-1 text-center font-mono text-xs text-zinc-500 dark:text-zinc-400 min-w-[48px]"
                >
                  GW{gw}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ownedOnly && submittedId !== null && visibleTeams.length === 0 ? (
              <tr>
                <td
                  colSpan={grid.allEventIds.length + 1}
                  className="text-sm text-zinc-500 dark:text-zinc-400 px-4 py-6 text-center"
                >
                  No fixtures for owned teams in this window. Try a longer horizon or turn off the filter.
                </td>
              </tr>
            ) : (
              visibleTeams.map(t => (
                <HeatMapRow
                  key={t.team_id}
                  t={t}
                  grid={grid}
                  mode={mode}
                  tierMap={tierMap}
                  ownedTeamIds={ownedTeamIds}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
