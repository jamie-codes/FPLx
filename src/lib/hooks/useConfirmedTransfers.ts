import { useQuery } from '@tanstack/react-query'
import type { ConfirmedTransfers } from '../types'

export function useConfirmedTransfers() {
  const query = useQuery<ConfirmedTransfers>({
    queryKey: ['confirmed-transfers'],
    queryFn: async () => {
      const res = await fetch('/api/transfers')
      if (!res.ok) throw new Error('Failed to fetch confirmed transfers')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6h — matches pipeline run cadence
    retry: false,                   // 200 envelope means no retriable errors
  })

  // Convenience flag: enabled:false → pipeline hasn't written the artifact yet.
  // Derived from data (not error state) because the route returns 200 + envelope
  // instead of 404, eliminating browser console noise and React Query retries.
  const isNotAvailable = query.data?.enabled === false

  return { ...query, isNotAvailable }
}
