import { useQuery } from '@tanstack/react-query'
import type { LineupNews } from '../types'

export function useLineupNews() {
  return useQuery<LineupNews>({
    queryKey: ['lineup-news'],
    queryFn: async () => {
      const res = await fetch('/api/lineup-news')
      if (!res.ok) throw new Error('Failed to fetch lineup news')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours — D-07, matches useGWIntel/useSetPieces
  })
}
