import { useQuery } from '@tanstack/react-query'
import type { TransferNewsFeed } from '../types'

export function useTransferNews() {
  return useQuery<TransferNewsFeed>({
    queryKey: ['transfer-news'],
    queryFn: async () => {
      const res = await fetch('/api/transfer-news')
      if (!res.ok) throw new Error('Failed to fetch transfer news')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6h — D-07, matches pipeline run cadence
  })
}
