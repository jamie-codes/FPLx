// Phase 100 HIST-02 + HIST-03: useSeasonAnalytics TanStack Query v5 hook.
// Provides /api/season-analytics data to BackTab.tsx (Plan 04).
//
// Design (RESEARCH A1): no localStorage ring buffer. Unlike useDecisionHistory which
// joins expensive Blob snapshots, useSeasonAnalytics fetches pure FPL data — TanStack
// Query's in-memory cache + 6-hour staleTime is sufficient. Season data rarely changes
// mid-season; on cold load the user accepts one round-trip.
//
// Sources of truth:
//   .planning/phases/100-decision-history-analytics/100-CONTEXT.md §D-11, D-12
//   .planning/phases/100-decision-history-analytics/100-RESEARCH.md Pattern 1, Pitfall 7
//   .planning/phases/100-decision-history-analytics/100-PATTERNS.md §src/lib/hooks/useSeasonAnalytics.ts
import { useQuery } from '@tanstack/react-query'
import type { SeasonAnalytics } from '../types'

async function fetchSeasonAnalytics(teamId: string): Promise<SeasonAnalytics> {
  const res = await fetch(`/api/season-analytics?teamId=${teamId}`)
  if (!res.ok) {
    const err = new Error(`Season analytics fetch failed: ${res.status}`) as Error & {
      status?: number
    }
    err.status = res.status
    throw err
  }
  return (await res.json()) as SeasonAnalytics
}

/**
 * Returns the user's season-level chip ROI and hit break-even data.
 *
 * - Disabled when `teamId` is null or non-numeric (defence in depth against T-100-03).
 * - `staleTime: 6h` — season data rarely changes (D-11).
 * - No localStorage persist (A1) — TanStack in-memory cache is sufficient for this
 *   fetch-only data. If the user navigates away and back within 6 hours, no refetch;
 *   beyond that, one fresh round-trip.
 * - No `onSuccess` (Pitfall 7 — removed in TanStack Query v5).
 *
 * @param teamId  numeric team ID string from localStorage; null disables the query
 */
export function useSeasonAnalytics(teamId: string | null) {
  return useQuery<SeasonAnalytics>({
    queryKey: ['season-analytics', teamId],
    queryFn: () => {
      if (!teamId) throw new Error('teamId is required')
      return fetchSeasonAnalytics(teamId)
    },
    enabled: !!teamId && /^\d+$/.test(teamId),
    staleTime: 6 * 60 * 60 * 1000,  // 6 hours per D-11
    retry: 1,
  })
}
