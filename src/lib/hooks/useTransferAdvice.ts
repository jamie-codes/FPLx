import { useQuery } from '@tanstack/react-query'
import type { TransferAdvice } from '../types'

// TRF-01: this GW's recommended transfers from the pipeline advisor trajectory
// (validated exp14: +136 pts vs hold, +197 vs placebo on 2025/26).
export function useTransferAdvice() {
  return useQuery<TransferAdvice>({
    queryKey: ['transfer-advice'],
    queryFn: async () => {
      const res = await fetch('/api/transfer-advice')
      if (!res.ok) throw new Error('Failed to fetch transfer advice')
      return res.json()
    },
    staleTime: 30 * 60 * 1000, // 30 min — refreshed by every pipeline run
  })
}
