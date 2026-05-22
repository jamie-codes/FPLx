import { useQuery } from '@tanstack/react-query'
import type { PriceResetResponse } from '../types'

export function usePriceReset() {
  return useQuery<PriceResetResponse>({
    queryKey: ['price-reset'],
    queryFn: async () => {
      const res = await fetch('/api/price-reset')
      if (!res.ok) throw new Error('Failed to fetch price reset data')
      return res.json()
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}
