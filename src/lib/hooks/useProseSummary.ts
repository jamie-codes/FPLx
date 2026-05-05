import { useQuery } from '@tanstack/react-query'
import type { ProseSummary } from '../types'

export function useProseSummary() {
  return useQuery<ProseSummary | null>({
    queryKey: ['prose-summary'],
    queryFn: async () => {
      const res = await fetch('/api/prose-summary')
      if (res.status === 404) return null  // D-13: silently hide when not yet generated
      if (!res.ok) throw new Error(`Failed to fetch prose: ${res.status}`)
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000,  // 6 hours — matches useInsights
  })
}
