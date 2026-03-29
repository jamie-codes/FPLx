import { useQuery } from '@tanstack/react-query'
import type { SquadPicksResponse } from '@/lib/squad-adapter'

async function fetchSquad(teamId: string): Promise<SquadPicksResponse> {
  const res = await fetch(`/api/squad/${teamId}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Squad fetch failed: ${res.status}`)
  }
  return res.json()
}

export function useSquad(teamId: string | null) {
  return useQuery<SquadPicksResponse>({
    queryKey: ['squad', teamId],
    queryFn: () => fetchSquad(teamId!),
    enabled: !!teamId,
    staleTime: 1000 * 60 * 5, // 5 minutes — squad can change mid-GW
    retry: 1,
  })
}
