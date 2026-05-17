import { useQuery } from '@tanstack/react-query'
import type { LineupNews, LineupNewsPlayer } from '../types'

// Phase 118 INFRA-02 / D-09: 48h staleness select transform.
// Returns undefined when root scraped_at is >48h old so engines stay timestamp-unaware.
export const lineupNewsSelect = (data: LineupNews): Map<number, LineupNewsPlayer> | undefined => {
  const ageMs = Date.now() - new Date(data.scraped_at).getTime()
  if (ageMs > 48 * 60 * 60 * 1000) return undefined  // stale → engines receive undefined
  return new Map(data.players.map(p => [p.id, p]))
}

export function useLineupNews() {
  return useQuery<LineupNews, Error, Map<number, LineupNewsPlayer> | undefined>({
    queryKey: ['lineup-news'],
    queryFn: async () => {
      const res = await fetch('/api/lineup-news')
      if (!res.ok) throw new Error('Failed to fetch lineup news')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours — D-07, matches useGWIntel/useSetPieces
    select: lineupNewsSelect,
  })
}
