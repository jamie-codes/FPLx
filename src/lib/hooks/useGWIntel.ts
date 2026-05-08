import { useQuery } from '@tanstack/react-query'
import type { GWIntelResponse } from '../types'

export function useGWIntel() {
  return useQuery<GWIntelResponse>({
    queryKey: ['gw-intel'],
    queryFn: async () => {
      const res = await fetch('/api/gw-intel')
      if (!res.ok) throw new Error('Failed to fetch GW insights')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours — same as useInsights
  })
}
