import { useQuery } from '@tanstack/react-query'
import type { CaptainPicks } from '../types'

export function useCaptainPicks() {
  return useQuery<CaptainPicks>({
    queryKey: ['captain-picks'],
    queryFn: async () => {
      const res = await fetch('/api/captain-picks')
      if (!res.ok) throw new Error('Failed to fetch captain picks')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  })
}
