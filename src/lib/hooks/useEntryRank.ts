'use client'
// Phase 62 (MC-03): useEntryRank — fetches FPL entry summary rank via existing FPL proxy.
// Pattern: mirrors useRivals.ts (D-01 — same proxy, same staleTime, same numeric guard).
// Security: T-58-01 pattern — `/^\d+$/.test` guard prevents URL injection through the
//          [...proxy] path segment (mirrors useRivals.ts enabled guard + defence-in-depth
//          inside queryFn).
// No auth required — FPL entry endpoint is public.
import { useQuery } from '@tanstack/react-query'

export interface EntryRankData {
  summary_overall_rank: number | null
  summary_overall_points: number | null
}

export function useEntryRank(teamId: string | null) {
  return useQuery<EntryRankData>({
    queryKey: ['entry-rank', teamId],
    queryFn: async () => {
      // Defence-in-depth: also guard inside queryFn in case of programmatic refetch()
      // that bypasses the enabled gate (mirrors useRivals.ts L51 pattern, T-58-01).
      if (!teamId || !/^\d+$/.test(teamId)) throw new Error('teamId must be numeric')
      const res = await fetch(`/api/fpl/entry/${teamId}/`)
      if (!res.ok) throw new Error(`Entry fetch failed: ${res.status}`)
      const data = await res.json()
      return {
        summary_overall_rank: data?.summary_overall_rank ?? null,
        summary_overall_points: data?.summary_overall_points ?? null,
      }
    },
    enabled: !!teamId && /^\d+$/.test(teamId),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  })
}
