// Phase 126 (NSP-03): TanStack Query hook for pre-season squad data.
// 404 → null (archive absent, "Prices pending" graceful state — D-03).
// Non-404 errors throw (red error state in UI).
import { useQuery } from '@tanstack/react-query'
import type { PreSeasonSquad } from '../types'

export function usePreSeasonSquad() {
  return useQuery<PreSeasonSquad | null>({
    queryKey: ['pre-season-squad'],
    queryFn: async () => {
      const res = await fetch('/api/pre-season-squad')
      if (res.status === 404) return null  // archive absent → "Prices pending"
      if (!res.ok) throw new Error('Failed to fetch pre-season squad')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000,  // 6h — mirrors useTransferNews.ts line 12
  })
}
