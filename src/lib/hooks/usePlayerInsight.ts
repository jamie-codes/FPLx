'use client'

// Phase 105 NLP-02: usePlayerInsight mutation hook.
// Trigger: on-demand button click ONLY — never auto-fired from useEffect.
// Cost guard: useMutation (no auto-refetch), mutationKey includes playerId + gw for in-flight dedup.

import { useMutation } from '@tanstack/react-query'
import type { PlayerInsightRequest, PlayerInsightResponse } from '../types'

// localStorage key builder — must match readCachedInsight key logic
function cacheKey(playerId: number, gw: number): string {
  return `playerInsight:${playerId}:gw${gw}`
}

/**
 * Read a cached PlayerInsightResponse from localStorage.
 * Returns null if absent or if the stored value fails to parse.
 * Exported so PlayerInsightSection can check cache on mount.
 */
export function readCachedInsight(playerId: number, gw: number): PlayerInsightResponse | null {
  try {
    const raw = localStorage.getItem(cacheKey(playerId, gw))
    if (!raw) return null
    return JSON.parse(raw) as PlayerInsightResponse
  } catch {
    return null
  }
}

async function postInsight(request: PlayerInsightRequest): Promise<PlayerInsightResponse> {
  const res = await fetch('/api/player-insight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (res.status === 422) {
    // Guardrail failed — sentinel error for fallback UI rendering
    throw new Error('GUARDRAIL_FAILED')
  }
  if (!res.ok) {
    throw new Error(`Insight failed: ${res.status}`)
  }
  return res.json()
}

/**
 * useMutation hook for fetching a per-player LLM insight on demand.
 *
 * @param playerId - The FPL player element id
 * @param gw       - The current gameweek number
 *
 * Usage:
 *   const { mutate, isPending, isError, error, data } = usePlayerInsight(player.id, gw)
 *   // On button click: mutate(requestPayload)
 *   // NEVER call mutate from useEffect — cost-explosion risk.
 */
export function usePlayerInsight(playerId: number, gw: number) {
  return useMutation<PlayerInsightResponse, Error, PlayerInsightRequest>({
    mutationKey: ['playerInsight', playerId, gw],
    mutationFn: postInsight,
    onSuccess: (data) => {
      // Write to localStorage as client-side cache layer
      try {
        localStorage.setItem(cacheKey(playerId, gw), JSON.stringify(data))
      } catch {
        // localStorage may be unavailable in some environments; non-fatal
      }
    },
  })
}
