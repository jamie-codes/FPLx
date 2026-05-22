import { useQuery } from '@tanstack/react-query'
import { parseFPLBootstrap } from '@/lib/fpl-adapter'

/**
 * Phase 132 DL-01: next FPL gameweek deadline from bootstrap events.
 *
 * Mirrors useSettledGws but selects the is_next event instead of settled GWs.
 * Per D-01: calls /api/fpl/bootstrap-static/ with staleTime 1h.
 * Per D-02: events.find(e => e.is_next) ?? null — no fallback to is_current.
 * Returns null when no is_next event exists (off-season / no upcoming GW).
 */

export type NextDeadline = { id: number; deadline_time: string } | null

async function fetchNextDeadline(): Promise<NextDeadline> {
  const res = await fetch('/api/fpl/bootstrap-static/')
  if (!res.ok) {
    const err = new Error(`bootstrap fetch failed: ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const raw = await res.json()
  const parsed = parseFPLBootstrap(raw)
  if (!parsed.success) throw new Error('bootstrap parse failed')
  const next = parsed.data.events.find((e) => e.is_next) ?? null
  if (next === null) return null
  return { id: next.id, deadline_time: next.deadline_time }
}

export function useNextDeadline() {
  return useQuery<NextDeadline>({
    queryKey: ['next-deadline'],
    queryFn: fetchNextDeadline,
    staleTime: 60 * 60 * 1000,  // 1 hour — bootstrap events update at most once per GW
    retry: 1,
  })
}
