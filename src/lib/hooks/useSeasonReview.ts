// Phase 124 REV-03: useSeasonReview TanStack Query v5 hook.
// Fetches /api/season-review data for the SeasonReviewTab (Plan 03).
//
// Design: in-memory cache only — no localStorage ring-buffer. Season data is settled
// and immutable; TanStack Query's 6-hour staleTime is sufficient.
// No localStorage ring buffer needed (cf. useDecisionHistory which uses one for
// captain snapshot joins). Season data is stable within a session.
//
// Sources of truth:
//   .planning/phases/124-season-review/124-CONTEXT.md §D-03/D-04
//   .planning/phases/124-season-review/124-PATTERNS.md §src/lib/hooks/useSeasonReview.ts
//   .planning/phases/124-season-review/124-RESEARCH.md Pattern 3
import { useQuery } from '@tanstack/react-query'
import type { SeasonReview } from '../types'

async function fetchSeasonReview(teamId: string): Promise<SeasonReview> {
  const res = await fetch(`/api/season-review?teamId=${teamId}`)
  if (!res.ok) {
    const err = new Error(`Season review fetch failed: ${res.status}`) as Error & {
      status?: number
    }
    err.status = res.status
    throw err
  }
  return (await res.json()) as SeasonReview
}

/**
 * Returns the user's season review data (GW-by-GW points, final rank, chip usage).
 *
 * - Disabled when `teamId` is null or non-numeric (defence in depth against T-124-05).
 * - `staleTime: 6h` — settled season data is immutable during a session (D-11 convention).
 * - In-memory cache only — no localStorage ring buffer; season data does not need a placeholder.
 * - TanStack Query v5 compliant — no deprecated v4 query options.
 *
 * @param teamId  numeric team ID string; null disables the query
 */
export function useSeasonReview(teamId: string | null) {
  return useQuery<SeasonReview>({
    queryKey: ['season-review', teamId],
    queryFn: () => {
      if (!teamId) throw new Error('teamId is required')
      return fetchSeasonReview(teamId)
    },
    enabled: !!teamId && /^\d+$/.test(teamId),
    staleTime: 6 * 60 * 60 * 1000,  // 6 hours — settled season data per D-11
    retry: 1,
  })
}
