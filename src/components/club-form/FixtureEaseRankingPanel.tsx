'use client'

import { useState } from 'react'
import { useClubForm } from '@/lib/hooks/useClubForm'
import { GwToggle } from '@/components/gem-table/GwToggle'
import { AttDefToggle } from './AttDefToggle'
import { EaseBar } from './EaseBar'
import type { ClubForm } from '@/lib/types'

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

  // Mobile layout is handled entirely via Tailwind responsive classes (sm:) — no JS-side
  // viewport detection needed. The earlier useState/useEffect pair for isMobile was
  // removed in revision iteration 2 (lint warning: destructured value never read).

  if (isLoading) {
    return <p className="text-gray-500 dark:text-zinc-400">Loading fixture ease...</p>
  }
  if (error) {
    return (
      <p className="text-red-500">
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
          const pct = (ease * 100).toFixed(0)
          return (
            <li
              key={team.team_id}
              className="flex items-center gap-2 text-sm"
              data-testid={`ease-row-${team.team_short_name}`}
            >
              <span className="w-6 text-right text-zinc-500">{i + 1}</span>
              <span className="w-12 font-mono">{team.team_short_name}</span>
              <EaseBar ease={ease} />
              <span className="w-10 text-right text-xs text-zinc-500">{pct}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
