import { useQuery } from '@tanstack/react-query'
import type { AccuracyBacktest } from '../types'

export function useAccuracy() {
  return useQuery<AccuracyBacktest>({
    queryKey: ['accuracy'],
    queryFn: async () => {
      const res = await fetch('/api/accuracy')
      if (!res.ok) throw new Error('Failed to fetch accuracy data')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours — matches useInsights
  })
}
