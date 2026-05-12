import { useQuery } from '@tanstack/react-query'
import { parseFPLBootstrap } from '@/lib/fpl-adapter'

/**
 * Phase 98 PGW-04: live last-3 settled GWs from FPL bootstrap.
 *
 * Replaces SETTLED_GWS_PLACEHOLDER in page.tsx. A settled GW is one where
 * BOTH event.finished === true AND event.data_checked === true (D-06).
 * Returns the last 3 settled GW IDs in ascending order (D-07) — matches the
 * existing GwPillToggle expectation in GwReviewTab.
 */
async function fetchSettledGws(): Promise<number[]> {
  const res = await fetch('/api/fpl/bootstrap-static/')
  if (!res.ok) {
    const err = new Error(`bootstrap fetch failed: ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const raw = await res.json()
  const parsed = parseFPLBootstrap(raw)
  if (!parsed.success) throw new Error('bootstrap parse failed')
  const settled = parsed.data.events
    .filter((e) => e.finished && e.data_checked)
    .map((e) => e.id)
  return settled.slice(-3)
}

export function useSettledGws() {
  return useQuery<number[]>({
    queryKey: ['settled-gws'],
    queryFn: fetchSettledGws,
    staleTime: 60 * 60 * 1000,  // 1 hour — bootstrap events update at most once per GW (Claude's Discretion per CONTEXT)
    retry: 1,
  })
}
