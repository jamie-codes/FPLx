'use client'

import React, { useMemo } from 'react'
import { useClubForm } from '@/lib/hooks/useClubForm'
import type { ClubForm, ClubFormFixture, DifficultyTier } from '@/lib/types'

const TIER_CLASSES: Record<DifficultyTier, string> = {
  easy:   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  hard:   'bg-red-100   text-red-800   dark:bg-red-900   dark:text-red-200',
}

const TIER_HEX: Record<DifficultyTier, string> = {
  easy:   '#dcfce7',  // green-100
  medium: '#fef3c7',  // amber-100
  hard:   '#fee2e2',  // red-100
}

export function FixtureHeatMap() {
  const { data, isLoading, error } = useClubForm()

  // Build column event_ids and per-team grouping in a single useMemo.
  const grid = useMemo(() => {
    if (!data || data.length === 0) return null
    const allEventIds = Array.from(
      new Set(data.flatMap(t => t.upcoming_fixtures.map(f => f.event_id)))
    ).sort((a, b) => a - b).slice(0, 8)
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
    const sortedTeams = [...data].sort((a, b) =>
      a.team_short_name.localeCompare(b.team_short_name)
    )
    return { allEventIds, byTeamGw, sortedTeams }
  }, [data])

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

  return (
    <section className="mb-6" data-testid="fixture-heat-map">
      <h2 className="text-xl font-bold mb-3">Fixture Heat Map</h2>
      <div className="overflow-x-auto">
        <table className="min-w-[640px] w-full text-xs border-collapse">
          <thead>
            <tr>
              <th
                scope="col"
                aria-label="Team"
                className="px-2 py-1 text-left font-mono text-xs text-zinc-500 dark:text-zinc-400 w-16"
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
            {grid.sortedTeams.map(t => (
              <tr key={t.team_id} className="border-b border-zinc-100 dark:border-zinc-800">
                <th
                  scope="row"
                  className="px-2 py-1 text-left font-mono text-xs w-16 h-8"
                >
                  {t.team_short_name}
                </th>
                {grid.allEventIds.map(gw => {
                  const fixtures = grid.byTeamGw.get(t.team_id)?.get(gw) ?? []
                  if (fixtures.length === 0) {
                    // BGW
                    return (
                      <td
                        key={gw}
                        className="px-2 py-1 text-center min-w-[48px] h-8 bg-zinc-50 dark:bg-zinc-900"
                        title="No fixture (BGW)"
                      />
                    )
                  }
                  if (fixtures.length >= 2) {
                    // DGW (Pitfall 1: detect via group.length, NOT total array length)
                    const [f1, f2] = fixtures
                    const c1 = TIER_HEX[f1.difficulty_tier]
                    const c2 = TIER_HEX[f2.difficulty_tier]
                    const tooltip =
                      `${f1.opponent_team} (${f1.is_home ? 'H' : 'A'}) ${f1.attacking_difficulty.toFixed(2)}` +
                      ` / ` +
                      `${f2.opponent_team} (${f2.is_home ? 'H' : 'A'}) ${f2.attacking_difficulty.toFixed(2)}`
                    return (
                      <td
                        key={gw}
                        className="px-2 py-1 text-center min-w-[48px] h-8"
                        style={{ background: `linear-gradient(to bottom right, ${c1} 50%, ${c2} 50%)` }}
                        title={tooltip}
                      />
                    )
                  }
                  // Single fixture
                  const f = fixtures[0]
                  const tooltip =
                    `${f.opponent_team} (${f.is_home ? 'H' : 'A'}) — ${f.attacking_difficulty.toFixed(2)}`
                  return (
                    <td
                      key={gw}
                      className={`px-2 py-1 text-center min-w-[48px] h-8 ${TIER_CLASSES[f.difficulty_tier]}`}
                      title={tooltip}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
