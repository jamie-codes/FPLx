import { useQuery } from '@tanstack/react-query'
import type { MergedPlayer } from '@/lib/types'

async function fetchPlayers(): Promise<MergedPlayer[]> {
  const res = await fetch('/api/players')
  if (!res.ok) {
    throw new Error(`Failed to fetch players: ${res.status}`)
  }
  return res.json()
}

export function usePlayers() {
  return useQuery<MergedPlayer[]>({
    queryKey: ['players'],
    queryFn: fetchPlayers,
    staleTime: 1000 * 60 * 60 * 6, // 6 hours per D-09
  })
}
