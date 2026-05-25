import { useQuery } from '@tanstack/react-query'
import { parseFPLBootstrap } from '@/lib/fpl-adapter'
import type { FPLBootstrap } from '@/lib/fpl-adapter'

async function fetchBootstrap(): Promise<FPLBootstrap> {
  const res = await fetch('/api/fpl/bootstrap-static/')
  if (!res.ok) {
    const err = new Error(`bootstrap fetch failed: ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const raw = await res.json()
  const parsed = parseFPLBootstrap(raw)
  if (!parsed.success) {
    throw new Error('bootstrap parse failed: invalid shape')
  }
  return parsed.data
}

export function useBootstrap() {
  return useQuery<FPLBootstrap>({
    queryKey: ['bootstrap'],
    queryFn: fetchBootstrap,
    staleTime: 60 * 60 * 1000, // 1 hour — bootstrap events change at most once per GW
    retry: 1,
  })
}
