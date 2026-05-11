// Phase 96 BACK-01: captain decision history hook.
// Cache-first: hydrates from localStorage ring buffer immediately, then refreshes
// from /api/decision-history in the background. On successful refresh the ring
// buffer is rewritten (trimmed to last 38 GWs).
//
// Sources of truth:
//   .planning/phases/96-captain-decision-backtester/96-CONTEXT.md (SC-4, SC-5)
//   .planning/phases/96-captain-decision-backtester/096-PATTERNS.md §src/lib/hooks/useDecisionHistory.ts
//   ROADMAP cross-cutting (key=`decisionHistory:teamId:{id}`, ring buffer size 38)
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { DecisionHistory } from '../types'
import { loadCachedHistory, persistHistory } from '../regret'

async function fetchDecisionHistory(teamId: string): Promise<DecisionHistory> {
  const res = await fetch(`/api/decision-history?teamId=${teamId}`)
  if (!res.ok) {
    const err = new Error(`Decision history fetch failed: ${res.status}`) as Error & {
      status?: number
    }
    err.status = res.status
    throw err
  }
  return (await res.json()) as DecisionHistory
}

/**
 * Returns the user's captain decision-history timeline.
 *
 * - Hydrates synchronously from `localStorage[decisionHistory:teamId:{id}]` so
 *   the bar chart renders without a network round-trip on revisit (SC-4).
 * - Refreshes from `/api/decision-history` in the background; on success the
 *   ring buffer is trimmed to the last 38 entries and rewritten.
 * - Disabled when teamId is null or non-numeric.
 *
 * @param teamId  numeric team ID string from localStorage; null disables the query
 */
export function useDecisionHistory(teamId: string | null) {
  const enabled = !!teamId && /^\d+$/.test(teamId)

  const query = useQuery<DecisionHistory>({
    queryKey: ['decision-history', teamId],
    queryFn: () => {
      if (!teamId) throw new Error('teamId is required')
      return fetchDecisionHistory(teamId)
    },
    enabled,
    staleTime: 6 * 60 * 60 * 1000, // 6 hours — settled GW data is immutable
    retry: 1,
    placeholderData: teamId ? (loadCachedHistory(teamId) ?? undefined) : undefined,
  })

  // Persist successful responses to the ring buffer (replaces the v4 onSuccess option).
  useEffect(() => {
    if (!teamId) return
    if (!query.isSuccess) return
    if (!query.data) return
    persistHistory(teamId, query.data)
  }, [teamId, query.isSuccess, query.data])

  return query
}
