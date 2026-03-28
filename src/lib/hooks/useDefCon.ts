import { useQuery } from '@tanstack/react-query'
import type { DefConPlayer } from '@/lib/types'

async function fetchDefCon(): Promise<DefConPlayer[]> {
  const res = await fetch('/api/defcon')
  if (!res.ok) {
    throw new Error(`Failed to fetch DefCon data: ${res.status}`)
  }
  return res.json()
}

export function useDefCon() {
  return useQuery<DefConPlayer[]>({
    queryKey: ['defcon'],
    queryFn: fetchDefCon,
    staleTime: 1000 * 60 * 60 * 6, // 6 hours, same as players
  })
}
