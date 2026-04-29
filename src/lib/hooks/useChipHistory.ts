import { useQuery } from '@tanstack/react-query'

export interface ChipHistoryEntry {
  name: string      // 'bboost' | '3xc' | 'freehit' | 'wildcard'
  time: string      // ISO timestamp
  event: number     // gameweek number when the chip was played
}

interface ChipHistoryResponse {
  chips?: ChipHistoryEntry[]
  // FPL also returns `current` and `past` arrays — we ignore them.
}

async function fetchChipHistory(teamId: string): Promise<ChipHistoryEntry[]> {
  const res = await fetch(`/api/fpl/entry/${teamId}/history/`)
  if (!res.ok) {
    throw new Error(`Chip history fetch failed: ${res.status}`)
  }
  const raw = await res.json()
  if (!raw || typeof raw !== 'object') {
    throw new Error('Chip history: unexpected response shape')
  }
  const data = raw as ChipHistoryResponse
  return Array.isArray(data.chips) ? data.chips : []
}

/**
 * Fetch the manager's used-chips history via the existing FPL proxy.
 *
 * Security: T-34-01 mitigation — `teamId` MUST be numeric. The `/^\d+$/.test`
 * guard prevents URL injection through the `[...proxy]` path segment.
 *
 * @param teamId  string from localStorage; null disables the query
 */
export function useChipHistory(teamId: string | null) {
  return useQuery<ChipHistoryEntry[]>({
    queryKey: ['chip-history', teamId],
    queryFn: () => {
      if (!teamId) throw new Error('teamId is required')
      return fetchChipHistory(teamId)
    },
    enabled: !!teamId && /^\d+$/.test(teamId),
    staleTime: 1000 * 60 * 60 * 6, // 6 hours — chip usage rarely changes mid-season
    retry: 1,
  })
}
