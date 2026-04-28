import { useQuery } from '@tanstack/react-query'
import type { Insight } from '../types'

export function useInsights() {
  return useQuery<Insight[]>({
    queryKey: ['insights'],
    queryFn: async () => {
      const res = await fetch('/api/insights')
      if (!res.ok) throw new Error('Failed to fetch insights')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  })
}
