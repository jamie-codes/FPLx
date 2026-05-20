// Phase 128 AUTO-03: TanStack Query hook for pre-season activation status.
// Returns PreSeasonActiveResponse | null.
// null = 404 = "Awaiting" (not yet activated); non-null = "Live".
// Non-404 errors fall back to null (silent Awaiting) per UI-SPEC Interaction Contract.
// See CONTEXT.md D-07/D-08 for the 404→null contract and D-10 for pill behaviour.
import { useQuery } from '@tanstack/react-query'
import type { PreSeasonActiveResponse } from '../types'

export function usePreSeasonActive() {
  return useQuery<PreSeasonActiveResponse | null>({
    queryKey: ['pre-season-active'],
    queryFn: async () => {
      const res = await fetch('/api/pre-season-active')
      if (res.status === 404) return null  // not yet activated → Awaiting
      if (!res.ok) return null             // treat errors as Awaiting (silent fallback per UI-SPEC)
      return res.json() as Promise<PreSeasonActiveResponse>
    },
    staleTime: 60_000,  // 60s — per CONTEXT.md Claude's Discretion; activation may change during pre-season window
  })
}
