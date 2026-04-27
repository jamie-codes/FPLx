import { useQuery } from '@tanstack/react-query'
import type { SetPieceChanges } from '../types'

export function useSetPieces() {
  return useQuery<SetPieceChanges>({
    queryKey: ['set-pieces'],
    queryFn: async () => {
      const res = await fetch('/api/set-pieces')
      if (!res.ok) throw new Error('Failed to fetch set-piece data')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  })
}
