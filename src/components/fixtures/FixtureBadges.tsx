'use client'

import type { FixtureEntry } from '@/lib/types'

// UIX-03: stays bespoke (grouped DGW-aware layout); internals retokenized per
// the spec's badge policy — easy→positive-soft, medium→warning-soft,
// hard→negative-soft, DGW label→violet.
const TIER_COLOURS: Record<string, string> = {
  easy:   'bg-positive-soft text-positive border-positive/40',
  medium: 'bg-warning-soft text-warning border-warning/40',
  hard:   'bg-negative-soft text-negative border-negative/40',
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
            <span className="text-xs font-semibold text-violet mr-0.5">DGW</span>
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
