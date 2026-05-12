// Phase 100 HIST-02 + HIST-03: /api/season-analytics route.
// Joins FPL /entry/{id}/history/, /entry/{id}/transfers/, and per-player
// /element-summary/{id}/ to produce chip ROI and hit break-even data.
//
// Sources of truth:
//   .planning/phases/100-decision-history-analytics/100-CONTEXT.md (D-04, D-05, D-07, D-08, D-10)
//   .planning/phases/100-decision-history-analytics/100-PATTERNS.md §src/app/api/season-analytics/route.ts
//   .planning/phases/100-decision-history-analytics/100-RESEARCH.md Pitfalls 1, 2, 3, 4, 6
import type { NextRequest } from 'next/server'
import type { ChipRoiEntry, HitTrackingEntry, SeasonAnalytics } from '@/lib/types'

const FPL_BASE = 'https://fantasy.premierleague.com/api'
const FPL_UA = 'fplx/1.17 (+https://fplx.app)'

type ChipName = 'bboost' | '3xc' | 'freehit'
const ALLOWED_CHIPS: readonly ChipName[] = ['bboost', '3xc', 'freehit'] as const

interface FPLHistoryChip { name: string; event: number; time: string }
interface FPLHistoryCurrent { event: number; points: number; event_transfers_cost: number }
interface FPLHistoryResponse {
  chips?: FPLHistoryChip[]
  current?: FPLHistoryCurrent[]
}
interface FPLTransferEntry { element_in: number; element_out: number; event: number; time?: string }
interface FPLElementHistoryRow { round: number; total_points: number }
interface FPLElementSummary { history?: FPLElementHistoryRow[] }
interface FPLBootstrapElement { id: number; web_name: string }

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

async function fetchTransfers(teamId: string): Promise<FPLTransferEntry[]> {
  try {
    const res = await fetch(`${FPL_BASE}/entry/${teamId}/transfers/`, {
      headers: { 'User-Agent': FPL_UA },
    })
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json) ? (json as FPLTransferEntry[]) : []
  } catch {
    return []
  }
}

async function fetchElementSummary(elementId: number): Promise<FPLElementSummary | null> {
  // Defence in depth: numeric guard before constructing URL (T-100-03).
  if (!/^\d+$/.test(String(elementId))) return null
  try {
    const res = await fetch(`${FPL_BASE}/element-summary/${elementId}/`, {
      headers: { 'User-Agent': FPL_UA },
    })
    if (!res.ok) return null
    const json = (await res.json()) as FPLElementSummary
    if (!json || !Array.isArray(json.history)) return null
    return json
  } catch {
    return null
  }
}

async function fetchBootstrapElementMap(): Promise<Map<number, string>> {
  try {
    const res = await fetch(`${FPL_BASE}/bootstrap-static/`, {
      headers: { 'User-Agent': FPL_UA },
    })
    if (!res.ok) return new Map()
    const json = (await res.json()) as { elements?: FPLBootstrapElement[] }
    const elements = Array.isArray(json?.elements) ? json.elements : []
    return new Map(elements.map((e) => [e.id, e.web_name]))
  } catch {
    return new Map()
  }
}

/**
 * GET /api/season-analytics?teamId={id}
 *
 * Returns SeasonAnalytics = { chipRoi, hitTracking }.
 * - 400 if teamId missing or non-numeric
 * - 502 if /entry/{id}/history/ itself fails
 * - 200 + empty arrays if `current` is empty (Pitfall 6 — no division by zero)
 * - Partial failures (one /element-summary/ fail, transfers fetch fail, bootstrap fail)
 *   fold to null/empty fields; the route only 502s on the bootstrap-equivalent
 *   /history/ failure.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const teamIdParam = searchParams.get('teamId')
  if (!teamIdParam || !/^\d+$/.test(teamIdParam)) {
    return Response.json({ error: 'Invalid teamId parameter' }, { status: 400 })
  }
  const teamId = teamIdParam

  // Step 1: parallel /history/ + /transfers/ + /bootstrap-static/.
  // History is the only fetch whose failure aborts the route.
  const [history, transfers, elementMap] = await Promise.all([
    fetchHistory(teamId),
    fetchTransfers(teamId),
    fetchBootstrapElementMap(),
  ])

  if (history === null) {
    return Response.json(
      { error: 'FPL history fetch failed' },
      { status: 502 },
    )
  }

  const current = Array.isArray(history.current) ? history.current : []
  const chips = Array.isArray(history.chips) ? history.chips : []

  // Pitfall 6 guard: empty current → no chips can match, no hits, no average.
  if (current.length === 0) {
    const empty: SeasonAnalytics = { chipRoi: [], hitTracking: [] }
    return Response.json(empty, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' },
    })
  }

  // Step 2: season average (D-05).
  const totalPoints = current.reduce((s, c) => s + (typeof c.points === 'number' ? c.points : 0), 0)
  const seasonAvgPoints = totalPoints / current.length

  // Step 3: chip ROI (D-04 filter, D-05 delta).
  const currentByEvent = new Map<number, FPLHistoryCurrent>(current.map((c) => [c.event, c]))
  const chipRoi: ChipRoiEntry[] = []
  for (const chip of chips) {
    if (!ALLOWED_CHIPS.includes(chip.name as ChipName)) continue
    const matched = currentByEvent.get(chip.event)
    if (!matched) continue
    const gwPoints = matched.points
    chipRoi.push({
      chipName: chip.name as ChipName,
      event: chip.event,
      gwPoints,
      seasonAvgPoints,
      delta: gwPoints - seasonAvgPoints,
    })
  }
  chipRoi.sort((a, b) => a.event - b.event)

  // Step 4: hit identification (D-08 + Pitfall 3 — multi-transfer hit GWs).
  const hitGws = new Set<number>()
  for (const c of current) {
    if (typeof c.event_transfers_cost === 'number' && c.event_transfers_cost > 0) {
      hitGws.add(c.event)
    }
  }
  const hitTransfers = transfers.filter((t) => hitGws.has(t.event))

  // Step 5: per-player /element-summary/ in parallel (partial-failure fold).
  const uniqueElementIds = Array.from(
    new Set(hitTransfers.flatMap((t) => [t.element_in, t.element_out])),
  )
  const summaries = await Promise.all(uniqueElementIds.map((id) => fetchElementSummary(id)))
  const summaryMap = new Map<number, FPLElementSummary | null>()
  uniqueElementIds.forEach((id, i) => summaryMap.set(id, summaries[i] ?? null))

  // Step 6: hitTracking rows (D-07 break-even — round >= event inclusive, Pitfall 4).
  function cumulativePointsFrom(
    summary: FPLElementSummary | null,
    fromRound: number,
  ): number | null {
    if (!summary || !Array.isArray(summary.history)) return null
    let sum = 0
    for (const row of summary.history) {
      if (typeof row.round !== 'number' || typeof row.total_points !== 'number') continue
      if (row.round >= fromRound) sum += row.total_points
    }
    return sum
  }

  const hitTracking: HitTrackingEntry[] = hitTransfers.map((t) => {
    const inSummary = summaryMap.get(t.element_in) ?? null
    const outSummary = summaryMap.get(t.element_out) ?? null
    const elementInPts = cumulativePointsFrom(inSummary, t.event)
    const elementOutPts = cumulativePointsFrom(outSummary, t.event)
    const netPts =
      elementInPts === null || elementOutPts === null
        ? null
        : elementInPts - elementOutPts - 4
    const brokeEven = netPts === null ? null : netPts > 0
    return {
      event: t.event,
      elementIn: t.element_in,
      elementOut: t.element_out,
      elementInName: elementMap.get(t.element_in) ?? null,
      elementOutName: elementMap.get(t.element_out) ?? null,
      elementInPts,
      elementOutPts,
      netPts,
      brokeEven,
    }
  })
  hitTracking.sort((a, b) => a.event - b.event)

  const payload: SeasonAnalytics = { chipRoi, hitTracking }
  return Response.json(payload, {
    status: 200,
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' },
  })
}
