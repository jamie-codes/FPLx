import { useQuery } from '@tanstack/react-query'

interface FPLLiveElement {
  id: number
  stats: {
    total_points: number
  }
}

interface FPLLiveResponse {
  elements: FPLLiveElement[]
}

async function fetchLiveGwPoints(gw: number): Promise<Record<number, number>> {
  const res = await fetch(`/api/fpl/event/${gw}/live/`)
  if (!res.ok) {
    const err = new Error(`live GW fetch failed: ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const raw = (await res.json()) as FPLLiveResponse
  const map: Record<number, number> = {}
  for (const el of raw.elements) {
    map[el.id] = el.stats.total_points
  }
  return map
}

export function useLiveGwPoints(gw: number | null) {
  return useQuery<Record<number, number>>({
    queryKey: ['live-gw-points', gw],
    queryFn: () => {
      if (gw === null) throw new Error('gw is required')
      return fetchLiveGwPoints(gw)
    },
    enabled: gw !== null,
    // Historical GWs are immutable — cache for 7 days
    staleTime: 7 * 24 * 60 * 60 * 1000,
  })
}
