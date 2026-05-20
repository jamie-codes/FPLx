// Phase 126 (NSP-03): TanStack Query hook for pre-season squad data.
// Phase 127 (D-08): return type updated to PreSeasonSquadResponse | null (envelope).
// 404 → null (archive absent, "Prices pending" graceful state — D-03).
// Non-404 errors throw (red error state in UI).
// Phase 129 (COST-02): optional includeInputs parameter + queryKey discriminator to prevent cache collision with Phase 127 watchlist consumer (RESEARCH §R1).
import { useQuery } from '@tanstack/react-query'
import type { PreSeasonSquadResponse } from '../types'

export function usePreSeasonSquad(options?: { includeInputs?: boolean }) {
  const includeInputs = options?.includeInputs ?? false
  return useQuery<PreSeasonSquadResponse | null>({
    queryKey: ['pre-season-squad', includeInputs ? 'with-inputs' : 'default'],
    queryFn: async () => {
      const url = includeInputs ? '/api/pre-season-squad?include=inputs' : '/api/pre-season-squad'
      const res = await fetch(url)
      if (res.status === 404) return null  // archive absent → "Prices pending"
      if (!res.ok) throw new Error('Failed to fetch pre-season squad')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000,  // 6h — mirrors useTransferNews.ts line 12
  })
}
