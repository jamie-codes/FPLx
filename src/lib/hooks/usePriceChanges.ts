import { useQuery } from '@tanstack/react-query'
import type { PriceChanges } from '../types'

export function usePriceChanges() {
  return useQuery<PriceChanges>({
    queryKey: ['price-changes'],
    queryFn: async () => {
      const res = await fetch('/api/price-changes')
      if (!res.ok) throw new Error('Failed to fetch price change data')
      return res.json()
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}
