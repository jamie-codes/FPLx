// Phase 124 REV-01: /api/season-review route.
// Returns aggregated SeasonReview JSON for a valid numeric teamId.
//
// Sources of truth:
//   .planning/phases/124-season-review/124-CONTEXT.md D-01..D-04
//   .planning/phases/124-season-review/124-PATTERNS.md §src/app/api/season-review/route.ts
//   .planning/phases/124-season-review/124-RESEARCH.md Pitfalls 1, 3, 4, 6
//
// Trust boundary mitigations (PLAN.md threat model):
//   T-124-01 SSRF: teamId validated with /^\d+$/ before URL construction.
//   T-124-02 Response injection: TypeScript interface cast + try/catch on JSON parse.
import type { NextRequest } from 'next/server'
import type { SeasonReview, SeasonGwEntry } from '@/lib/types'

const FPL_BASE = 'https://fantasy.premierleague.com/api'
const FPL_UA = 'fplx/1.24 (+https://fplx.app)'

// Local interface block — includes overall_rank (RESEARCH Pitfall 1: absent from existing season-analytics interface).
interface FPLHistoryChip    { name: string; event: number; time: string }
interface FPLHistoryCurrent {
  event: number
  points: number
  event_transfers_cost: number
  overall_rank: number   // present in FPL API but absent from season-analytics/route.ts interface
}
interface FPLHistoryResponse { chips?: FPLHistoryChip[]; current?: FPLHistoryCurrent[] }
// FPL bootstrap events — field name is average_entry_score (NOT average_score — RESEARCH Pitfall 6).
interface FPLBootstrapEvent { id: number; average_entry_score: number; finished: boolean }

async function fetchHistory(teamId: string): Promise<FPLHistoryResponse | null> {
  try {
    const res = await fetch(`${FPL_BASE}/entry/${teamId}/history/`, {
      headers: { 'User-Agent': FPL_UA },
    })
    if (!res.ok) return null
    const json = (await res.json()) as FPLHistoryResponse
    if (!json || typeof json !== 'object') return null
    return json
  } catch {
    return null
  }
}

async function fetchBootstrapEvents(): Promise<FPLBootstrapEvent[]> {
  try {
    const res = await fetch(`${FPL_BASE}/bootstrap-static/`, {
      headers: { 'User-Agent': FPL_UA },
    })
    if (!res.ok) return []
    const json = (await res.json()) as { events?: FPLBootstrapEvent[] }
    return Array.isArray(json?.events) ? json.events : []
  } catch {
    return []
  }
}

/**
 * GET /api/season-review?teamId={id}
 *
 * Returns SeasonReview aggregate from FPL /entry/{id}/history/ + /bootstrap-static/.
 * - 400 if teamId missing or non-numeric (T-124-01 SSRF guard)
 * - 502 if /entry/{id}/history/ itself fails (blocking dependency)
 * - 200 + zero/empty payload if current[] is empty (Pitfall 6 — no div-by-zero)
 * - Bootstrap failure folds gracefully: avgManagerScore defaults to 0 per GW
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const teamIdParam = searchParams.get('teamId')

  // T-124-01: SSRF guard — validate before constructing FPL URL.
  if (!teamIdParam || !/^\d+$/.test(teamIdParam)) {
    return Response.json({ error: 'Invalid teamId parameter' }, { status: 400 })
  }
  const teamId = teamIdParam

  // Parallel fetch: history is blocking; bootstrap failure folds to empty events.
  const [history, bootstrapEvents] = await Promise.all([
    fetchHistory(teamId),
    fetchBootstrapEvents(),
  ])

  if (history === null) {
    return Response.json({ error: 'FPL history fetch failed' }, { status: 502 })
  }

  const current = Array.isArray(history.current) ? history.current : []
  const chips   = Array.isArray(history.chips)   ? history.chips   : []

  // Pitfall 6: empty current — return zero/empty payload without any reduce/divide operations.
  if (current.length === 0) {
    const empty: SeasonReview = {
      totalPoints: 0,
      finalRank: 0,
      bestGw: { gw: 0, points: 0 },
      worstGw: { gw: 0, points: 0 },
      transferNetPoints: 0,
      gwData: [],
    }
    return Response.json(empty, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' },
    })
  }

  // Build lookup maps.
  // average_entry_score — exact field name per CONTEXT.md D-02 and RESEARCH Pitfall 6.
  const eventToAvgScore = new Map<number, number>(
    bootstrapEvents.map((e) => [e.id, e.average_entry_score]),
  )
  const eventToChip = new Map<number, string>(
    chips.map((c) => [c.event, c.name]),
  )

  // Sort current[] by event ascending (defensive — FPL API order should already be ascending).
  const sortedCurrent = current.slice().sort((a, b) => a.event - b.event)

  // Build gwData.
  const gwData: SeasonGwEntry[] = sortedCurrent.map((entry) => ({
    gw: entry.event,
    points: entry.points,
    avgManagerScore: eventToAvgScore.get(entry.event) ?? 0,
    overallRank: entry.overall_rank,
    chipPlayed: eventToChip.get(entry.event) ?? null,
  }))

  // Aggregate summary fields.
  const totalPoints = sortedCurrent.reduce((s, c) => s + (typeof c.points === 'number' ? c.points : 0), 0)
  const finalRank   = sortedCurrent[sortedCurrent.length - 1]?.overall_rank ?? 0
  const transferNetPoints = -(
    sortedCurrent.reduce((s, c) => s + (typeof c.event_transfers_cost === 'number' ? c.event_transfers_cost : 0), 0)
  )

  // bestGw / worstGw via reduce (current.length > 0 guaranteed by guard above).
  const bestEntry  = sortedCurrent.reduce((best, c) => (c.points > best.points ? c : best), sortedCurrent[0])
  const worstEntry = sortedCurrent.reduce((worst, c) => (c.points < worst.points ? c : worst), sortedCurrent[0])

  const payload: SeasonReview = {
    totalPoints,
    finalRank,
    bestGw:  { gw: bestEntry.event,  points: bestEntry.points },
    worstGw: { gw: worstEntry.event, points: worstEntry.points },
    transferNetPoints,
    gwData,
  }

  return Response.json(payload, {
    status: 200,
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' },
  })
}
