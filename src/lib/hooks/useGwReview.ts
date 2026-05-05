import { useQuery } from '@tanstack/react-query'
import type { GwReview } from '@/lib/types'

/**
 * Fetch the merged GW review (Blob global data + on-demand FPL picks data).
 *
 * Security (T-34-01): `teamId` MUST be numeric. The `/^\d+$/.test` guard is
 * defence-in-depth (the API route also validates), preventing wasted fetches
 * with malformed input.
 *
 * @param teamId  numeric team ID string from localStorage; null disables the query
 * @param gw      gameweek number to load; null disables the query
 */
async function fetchGwReview(teamId: string, gw: number): Promise<GwReview> {
  const res = await fetch(`/api/gw-review?teamId=${teamId}&gw=${gw}`)
  if (!res.ok) {
    // Surface the status code so the component can render distinct messages
    // for 503 (unsettled), 404 (no Blob file), 502 (cold start / FPL down).
    const err = new Error(`GW review fetch failed: ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const data = (await res.json()) as GwReview
  return data
}

export function useGwReview(teamId: string | null, gw: number | null) {
  return useQuery<GwReview>({
    queryKey: ['gw-review', teamId, gw],
    queryFn: () => {
      if (!teamId) throw new Error('teamId is required')
      if (gw === null) throw new Error('gw is required')
      return fetchGwReview(teamId, gw)
    },
    enabled: !!teamId && /^\d+$/.test(teamId) && gw !== null,
    staleTime: 1000 * 60 * 30, // 30 min — settled GW scores don't change
    retry: 1,
  })
}
