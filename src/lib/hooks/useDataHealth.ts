// Phase 82 DH-03: TanStack Query hook for /api/data-health.
// Cadence per CONTEXT.md D-18: always-fresh with 60-second background polling.
// Data health must reflect CURRENT pipeline state — NOT a 6h-cached snapshot
// (which is what useAccuracy uses for accuracy_backtest.json).

import { useQuery } from '@tanstack/react-query'
import type { DataHealth } from '../types'

export function useDataHealth() {
  return useQuery<DataHealth>({
    queryKey: ['data-health'],
    queryFn: async () => {
      const res = await fetch('/api/data-health')
      if (!res.ok) throw new Error('Failed to fetch data health')
      return res.json()
    },
    staleTime: 0,
    refetchInterval: 60_000,
  })
}
