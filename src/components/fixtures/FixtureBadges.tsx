'use client'

import type { FixtureEntry } from '@/lib/types'

const TIER_COLOURS: Record<string, string> = {
  easy:   'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700',
  medium: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700',
  hard:   'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700',
}

export function FixtureBadges({ fixtures }: { fixtures: FixtureEntry[] }) {
  // Group fixtures by gameweek (event_id) to detect DGWs
  const grouped = fixtures.reduce<Map<number, FixtureEntry[]>>((map, f) => {
    const group = map.get(f.event_id) ?? []
    map.set(f.event_id, [...group, f])
    return map
  }, new Map())

  return (
    <div className="flex gap-1 flex-wrap">
      {Array.from(grouped.entries()).map(([eventId, gwFixtures]) => (
        <span key={eventId} className="flex items-center gap-0.5">
          {gwFixtures.length >= 2 && (
            <span className="text-xs font-semibold text-violet-700 dark:text-violet-400 mr-0.5">DGW</span>
          )}
          {gwFixtures.map((f, i) => (
            <span
              key={i}
              className={`text-xs border rounded px-1 py-0.5 font-mono ${TIER_COLOURS[f.difficulty_tier] ?? ''}`}
            >
              {f.opponent_team} {f.is_home ? 'H' : 'A'}
            </span>
          ))}
        </span>
      ))}
    </div>
  )
}
