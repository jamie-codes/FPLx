import { useQueries } from '@tanstack/react-query'
import { z } from 'zod'
import { LivePicksResponseSchema } from '@/lib/live-gw'
import type { LivePlayerStats, LivePicksResponse } from '@/lib/live-gw'

// ── Fetch helpers ─────────────────────────────────────────────────────────────

const FPLLiveStatsSchema = z.object({
  goals_scored:  z.number(),
  assists:       z.number(),
  bonus:         z.number(),
  clean_sheets:  z.number(),
  saves:         z.number(),
  minutes:       z.number(),
  total_points:  z.number(),
  yellow_cards:  z.number(),
  red_cards:     z.number(),
})

const FPLLiveElementSchema = z.object({
  id:    z.number(),
  stats: FPLLiveStatsSchema,
})

const FPLLiveResponseSchema = z.object({
  elements: z.array(FPLLiveElementSchema),
})

async function fetchLiveStats(gw: number): Promise<Map<number, LivePlayerStats>> {
  const res = await fetch(`/api/fpl/event/${gw}/live/`)
  if (!res.ok) {
    const err = new Error(`live GW fetch failed: ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const raw = await res.json()
  const parsed = FPLLiveResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error('live stats parse failed: invalid shape')
  }
  const map = new Map<number, LivePlayerStats>()
  for (const el of parsed.data.elements) {
    map.set(el.id, {
      goals_scored:  el.stats.goals_scored,
      assists:       el.stats.assists,
      bonus:         el.stats.bonus,
      clean_sheets:  el.stats.clean_sheets,
      saves:         el.stats.saves,
      minutes:       el.stats.minutes,
      total_points:  el.stats.total_points,
      yellow_cards:  el.stats.yellow_cards,
      red_cards:     el.stats.red_cards,
    })
  }
  return map
}

async function fetchPicks(teamId: number, gw: number): Promise<LivePicksResponse> {
  const res = await fetch(`/api/fpl/entry/${teamId}/event/${gw}/picks/`)
  if (!res.ok) {
    const err = new Error(`picks fetch failed: ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const raw = await res.json()
  const parsed = LivePicksResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error('picks parse failed: invalid shape')
  }
  return parsed.data
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseLiveGwResult {
  liveStats:  Map<number, LivePlayerStats> | null
  picksData:  LivePicksResponse | null
  isLoading:  boolean
  isError:    boolean
  refetch:    () => void
}

export function useLiveGw(
  teamId:    number | null,
  currentGw: number | null,
  isLive:    boolean,
): UseLiveGwResult {
  const enabled = teamId !== null && currentGw !== null

  const results = useQueries({
    queries: [
      {
        queryKey:        ['live-gw-stats', currentGw],
        queryFn:         () => fetchLiveStats(currentGw!),
        enabled,
        refetchInterval: isLive ? 60_000 : false,
        staleTime:       30_000,
      },
      {
        queryKey:        ['live-gw-picks', teamId, currentGw],
        queryFn:         () => fetchPicks(teamId!, currentGw!),
        enabled,
        refetchInterval: isLive ? 60_000 : false,
        staleTime:       30_000,
      },
    ],
  })

  const [statsQuery, picksQuery] = results

  const isLoading = enabled && (statsQuery.isLoading || picksQuery.isLoading)
  const isError   = statsQuery.isError || picksQuery.isError

  function refetch() {
    void statsQuery.refetch()
    void picksQuery.refetch()
  }

  return {
    liveStats:  (statsQuery.data as Map<number, LivePlayerStats> | undefined) ?? null,
    picksData:  (picksQuery.data as LivePicksResponse | undefined) ?? null,
    isLoading,
    isError,
    refetch,
  }
}
