import { useQuery } from '@tanstack/react-query'
import type { TransferNewsFeed } from '../types'

export function useTransferNews() {
  const query = useQuery<TransferNewsFeed>({
    queryKey: ['transfer-news'],
    queryFn: async () => {
      const res = await fetch('/api/transfer-news')
      if (!res.ok) throw new Error('Failed to fetch transfer news')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6h — D-07, matches pipeline run cadence
    retry: false,                   // 200 envelope means no retriable errors; belt-and-suspenders
  })

  // Convenience flag: enabled:false → pipeline hasn't written the artifact yet.
  // Derived from data (not error state) because the route now returns 200 + envelope
  // instead of 404, eliminating browser console noise and React Query retries.
  const isNotAvailable = query.data?.enabled === false

  return { ...query, isNotAvailable }
}
