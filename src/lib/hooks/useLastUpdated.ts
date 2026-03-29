import { useQuery } from '@tanstack/react-query'

interface LastUpdatedData {
  last_updated: string
  stale: boolean
}

async function fetchLastUpdated(): Promise<LastUpdatedData> {
  const res = await fetch('/api/last-updated')
  if (!res.ok) throw new Error(`Failed to fetch last updated: ${res.status}`)
  return res.json()
}

export function useLastUpdated() {
  return useQuery<LastUpdatedData>({
    queryKey: ['last-updated'],
    queryFn: fetchLastUpdated,
    staleTime: 1000 * 60 * 60,
  })
}
