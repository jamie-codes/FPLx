'use client'

import type { FixtureEntry } from '@/lib/types'

const TIER_COLOURS: Record<string, string> = {
  easy:   'bg-green-100 text-green-800 border-green-300',
  medium: 'bg-amber-100 text-amber-800 border-amber-300',
  hard:   'bg-red-100 text-red-800 border-red-300',
}

export function FixtureBadges({ fixtures }: { fixtures: FixtureEntry[] }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {fixtures.map((f, i) => (
        <span
          key={i}
          className={`text-xs border rounded px-1 py-0.5 font-mono ${TIER_COLOURS[f.difficulty_tier] ?? ''}`}
        >
          {f.opponent_team} {f.is_home ? 'H' : 'A'}
        </span>
      ))}
    </div>
  )
}
