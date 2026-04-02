import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { MyTeamResponse } from '@/lib/squad-adapter'

async function fetchMyTeam(): Promise<MyTeamResponse> {
  const res = await fetch('/api/fpl/my-team')
  if (!res.ok) {
    if (res.status === 401) throw new Error('AUTH_EXPIRED')
    throw new Error(`my-team fetch failed: ${res.status}`)
  }
  return res.json()
}

export function useMyTeam(enabled: boolean) {
  const queryClient = useQueryClient()

  return useQuery<MyTeamResponse>({
    queryKey: ['my-team'],
    queryFn: async () => {
      try {
        return await fetchMyTeam()
      } catch (err) {
        if (err instanceof Error && err.message === 'AUTH_EXPIRED') {
          // Session expired — invalidate auth status per Research Pitfall 5
          queryClient.setQueryData(['auth-status'], { authenticated: false })
        }
        throw err
      }
    },
    enabled,
    staleTime: 1000 * 60 * 5,
    retry: 0,
  })
}
