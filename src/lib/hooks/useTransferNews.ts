import { useQuery } from '@tanstack/react-query'
import type { TransferNewsFeed } from '../types'

export function useTransferNews() {
  const query = useQuery<TransferNewsFeed>({
    queryKey: ['transfer-news'],
    queryFn: async () => {
      const res = await fetch('/api/transfer-news')
      // 404 = pipeline hasn't written the artifact yet (TRANSFER_NEWS_ENABLED not active)
      if (res.status === 404) throw new Error('Transfer news not available')
      if (!res.ok) throw new Error('Failed to fetch transfer news')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6h — D-07, matches pipeline run cadence
  })

  // Convenience flag: 404 response → feed not yet populated by pipeline
  const isNotAvailable =
    query.isError && (query.error as Error)?.message === 'Transfer news not available'

  return { ...query, isNotAvailable }
}
