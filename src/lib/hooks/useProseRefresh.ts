// Phase 67 Plan 02 — STUB. Plan 03 replaces with real useMutation calling POST /api/prose-summary.
// Stub keeps ProseSummaryBlock compiling without the POST route in place.
import type { ProseSummary, ProseRefreshPayload } from '../types'

export interface ProseRefreshHandle {
  mutate: (
    payload: ProseRefreshPayload,
    opts?: { onSuccess?: (data: ProseSummary) => void; onError?: (e: Error) => void },
  ) => void
  isPending: boolean
}

export function useProseRefresh(): ProseRefreshHandle {
  return {
    mutate: () => {
      // Plan 03 implements POST /api/prose-summary call
    },
    isPending: false,
  }
}
