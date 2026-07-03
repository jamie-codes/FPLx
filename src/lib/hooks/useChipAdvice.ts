import { useQuery } from '@tanstack/react-query'
import type { ChipAdvice } from '../types'

// CHP-01: pre-deadline chip signals (Bench Boost / Triple Captain / Free Hit)
// from the decision ledger + DGW/BGW fixture shape.
export function useChipAdvice() {
  return useQuery<ChipAdvice>({
    queryKey: ['chip-advice'],
    queryFn: async () => {
      const res = await fetch('/api/chip-advice')
      if (!res.ok) throw new Error('Failed to fetch chip advice')
      return res.json()
    },
    staleTime: 30 * 60 * 1000, // 30 min — refreshed by every pipeline run
  })
}
