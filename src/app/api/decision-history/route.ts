// Phase 96 BACK-01: captain regret backtester API route.
// Phase 113 BACK-02: extended with transfer regret pipeline.
// Joins per-GW captain snapshots (Vercel Blob) with the user's authenticated
// FPL picks to produce a season-long DecisionHistory.
//
// Sources of truth:
//   .planning/phases/96-captain-decision-backtester/96-CONTEXT.md (D-06, D-08, D-10, SC-5)
//   .planning/phases/96-captain-decision-backtester/096-PATTERNS.md §src/app/api/decision-history/route.ts
//   .planning/phases/113-transfer-regret-backtester-v1-20/113-CONTEXT.md (D-01 through D-14)
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { NextRequest } from 'next/server'
import type { DecisionHistory, RegretEntry, CaptainPickSnapshot, TransferRegretEntry, SlimPlayer, MergedPlayer } from '@/lib/types'
import { computeRegret, computeTransferDelta } from '@/lib/regret'
import { suggestTransfers } from '@/lib/suggest-transfers'
import type { SquadPick } from '@/lib/squad-adapter'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'
const FPL_BASE = 'https://fantasy.premierleague.com/api'
const FPL_UA = 'fplx/1.11 (+https://fplx.app)'

interface FPLPick {
  element: number
  position: number
  multiplier: number
  is_captain: boolean
  is_vice_captain: boolean
  total_points: number
}
interface FPLPicksResponse {
  entry_history: { points: number; points_on_bench: number; event: number }
  picks: FPLPick[]
}
interface FPLBootstrapElement { id: number; web_name: string }
interface FPLBootstrapEvent { id: number; finished: boolean }

// Phase 113 BACK-02: FPL transfers entry (all-season array from /entry/{id}/transfers/).
// Filter by event === gw before use (Pitfall 2).
interface FPLTransferEntry { element_in: number; element_out: number; event: number; time?: string }

async function readSnapshot(gw: number): Promise<CaptainPickSnapshot | null> {
  const filename = `captain_picks_gw${gw}.json`
  try {
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: filename, limit: 1 })
      if (!blobs.length || blobs[0].pathname !== filename) return null
      const res = await fetch(blobs[0].url)
      if (!res.ok) return null
      return (await res.json()) as CaptainPickSnapshot
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', filename)
      const data = await readFile(cachePath, 'utf-8')
      return JSON.parse(data) as CaptainPickSnapshot
    }
  } catch {
    // ENOENT / malformed JSON / blob fetch failure all collapse to "no snapshot" (D-10).
    return null
  }
}

async function readGwPicks(teamId: string, gw: number): Promise<FPLPick[] | null> {
  try {
    const res = await fetch(`${FPL_BASE}/entry/${teamId}/event/${gw}/picks/`, {
      headers: { 'User-Agent': FPL_UA },
    })
    if (!res.ok) return null
    const json = (await res.json()) as FPLPicksResponse
    if (!json || !Array.isArray(json.picks)) return null
    return json.picks
  } catch {
    return null
  }
}

// Phase 113 BACK-02 helpers ------------------------------------------------

/**
 * Read the slim player snapshot for a specific GW from Vercel Blob.
 * Mirrors readSnapshot() verbatim with three substitutions:
 *   filename: merged_players_slim_gw{N}.json
 *   return type: SlimPlayer[] | null
 *   JSON cast: as SlimPlayer[]
 * Security: blobs[0].pathname !== filename exact-match check prevents path traversal
 * (T-113-11). All failure modes return null — JSON parse try/catch collapses
 * malformed JSON to null (T-113-09). Pattern: D-10 no-snapshot fold.
 */
async function readTransferSlimSnapshot(gw: number): Promise<SlimPlayer[] | null> {
  const filename = `merged_players_slim_gw${gw}.json`
  try {
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: filename, limit: 1 })
      if (!blobs.length || blobs[0].pathname !== filename) return null
      const res = await fetch(blobs[0].url)
      if (!res.ok) return null
      return (await res.json()) as SlimPlayer[]
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', filename)
      const data = await readFile(cachePath, 'utf-8')
      return JSON.parse(data) as SlimPlayer[]
    }
  } catch {
    return null
  }
}

/**
 * Fetch ALL season transfers for a team from FPL /entry/{teamId}/transfers/.
 * Returns flat season-aggregate array — filter by event === gw before use (Pitfall 2).
 * Called with already-validated teamId (regex-guarded in GET handler — no double-validation).
 * Copied verbatim from src/app/api/season-analytics/route.ts (same shape and URL).
 */
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

/**
 * Reconstruct the pre-transfer squad from the post-transfer picks array.
 *
 * FPL picks endpoint returns POST-transfer squad; swap element_in→element_out
 * to recover pre-transfer state (Pitfall 1).
 *
 * Algorithm (D-03):
 *   1. Map each pick to { element: p.element }.
 *   2. For each transfer in gwTransfers, locate element_in in the squad and replace with element_out.
 *   3. Return swapped array — this is the squad the engine would have seen before the deadline.
 */
function reconstructPreTransferSquad(
  postTransferPicks: FPLPick[],
  gwTransfers: FPLTransferEntry[],
): { element: number }[] {
  const squad = postTransferPicks.map((p) => ({ element: p.element }))
  for (const t of gwTransfers) {
    // Swap element_in (bought) back to element_out (sold) to undo the transfer
    const idx = squad.findIndex((p) => p.element === t.element_in)
    if (idx !== -1) squad[idx] = { element: t.element_out }
  }
  return squad
}

/**
 * GET /api/decision-history?teamId=N
 *
 * Returns a DecisionHistory timeline of captain regret per finished GW.
 * SC-5: any partial failure (FPL picks unreachable, individual GW snapshot missing)
 * is folded into the RegretEntry shape via null fields — the route never 502s
 * because of a single missing GW; it only 502s if the FPL bootstrap itself fails.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const teamIdParam = searchParams.get('teamId')

  if (!teamIdParam || !/^\d+$/.test(teamIdParam)) {
    return Response.json({ error: 'Invalid teamId parameter' }, { status: 400 })
  }
  const teamId = teamIdParam

  // Step 1: bootstrap → finished events + element_id → web_name map.
  let elementMap: Map<number, string>
  let finishedGws: number[]
  try {
    const bootRes = await fetch(`${FPL_BASE}/bootstrap-static/`, {
      headers: { 'User-Agent': FPL_UA },
    })
    if (!bootRes.ok) {
      return Response.json(
        { error: `FPL bootstrap fetch failed: ${bootRes.status}` },
        { status: 502 },
      )
    }
    const bootJson = (await bootRes.json()) as {
      elements?: FPLBootstrapElement[]
      events?: FPLBootstrapEvent[]
    }
    const elements = Array.isArray(bootJson?.elements) ? bootJson.elements : []
    const events = Array.isArray(bootJson?.events) ? bootJson.events : []
    elementMap = new Map(elements.map((e) => [e.id, e.web_name]))
    finishedGws = events.filter((e) => e.finished).map((e) => e.id).sort((a, b) => a - b)
  } catch {
    return Response.json({ error: 'FPL bootstrap unreachable' }, { status: 502 })
  }

  if (finishedGws.length === 0) {
    const empty: DecisionHistory = { teamId: Number(teamId), gwsWithData: 0, entries: [] }
    return Response.json(empty, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
    })
  }

  // Step 2: parallel snapshot reads + picks fetches + slim snapshot reads.
  // Phase 113 BACK-02: add slimSnapshots (readTransferSlimSnapshot per GW) and
  // allTransfers (fetchTransfers — single call for all-season data) to the fan-out.
  const [snapshots, slimSnapshots, picks, allTransfers] = await Promise.all([
    Promise.all(finishedGws.map((gw) => readSnapshot(gw))),
    Promise.all(finishedGws.map((gw) => readTransferSlimSnapshot(gw))),
    Promise.all(finishedGws.map((gw) => readGwPicks(teamId, gw))),
    fetchTransfers(teamId),
  ])

  // Step 2b (FIX-06, Phase 110): element-summary lookups for unique ceiling IDs.
  // Deduplication: a single ceiling player (e.g. Salah) across N GWs = 1 fetch, not N.
  // SC-5: any failure leaves actualPtsMap entry absent → modelCeilingPts stays null.
  // Per CONTEXT.md D-10: collect unique IDs, Promise.allSettled (NOT Promise.all — individual
  // fetch failures must not abort the fan-out), build Map<elementId, Map<gwRound, actualPts>>.
  const uniqueCeilingIds = new Set<number>()
  for (const snap of snapshots) {
    if (snap?.ceiling?.id != null) uniqueCeilingIds.add(snap.ceiling.id)
  }

  const actualPtsMap = new Map<number, Map<number, number>>()
  if (uniqueCeilingIds.size > 0) {
    const summaryResults = await Promise.allSettled(
      [...uniqueCeilingIds].map(async (id) => {
        try {
          const res = await fetch(`${FPL_BASE}/element-summary/${id}/`, {
            headers: { 'User-Agent': FPL_UA },
          })
          if (!res.ok) return null
          const json = (await res.json()) as {
            history?: Array<{ element: number; round: number; total_points: number }>
          }
          return { id, history: json.history ?? [] }
        } catch {
          return null
        }
      }),
    )
    for (const result of summaryResults) {
      if (result.status === 'fulfilled' && result.value) {
        const { id, history } = result.value
        actualPtsMap.set(id, new Map(history.map((h) => [h.round, h.total_points])))
      }
    }
  }
  // actualPtsMap is now available for Step 3 lookups.
  // If all element-summary calls fail, actualPtsMap is empty → all modelCeilingPts = null (SC-5).

  // Step 3: assemble RegretEntry per GW.
  const entries: RegretEntry[] = finishedGws.map((gw, i) => {
    const snap = snapshots[i]
    const gwPicks = picks[i]

    // Model side (D-08: ceiling pick at decision time).
    const ceiling = snap?.ceiling ?? null
    const modelCeilingId = ceiling?.id ?? null
    const modelCeilingName = ceiling?.name ?? null
    // FIX-06 (Phase 110): modelCeilingPts derives from FPL element-summary lookup populated in
    // Step 2b. Stays null when no snapshot, no ceiling, or element-summary unavailable (SC-5).
    // CR-01 deferral from Phase 96 is now resolved — actual post-GW raw player points are used.
    const modelCeilingPts: number | null =
      modelCeilingId !== null ? (actualPtsMap.get(modelCeilingId)?.get(gw) ?? null) : null
    const hasSnapshot = snap !== null && ceiling !== null

    // User side (from FPL picks — captain in the starting XI).
    let userCaptainId: number | null = null
    let userCaptainName: string | null = null
    let userCaptainPts: number | null = null
    if (gwPicks) {
      const starters = gwPicks.filter((p) => p.position <= 11)
      const cap = starters.find((p) => p.is_captain)
      if (cap) {
        userCaptainId = cap.element
        userCaptainName = elementMap.get(cap.element) ?? `Player ${cap.element}`
        // multiplier handles Triple Captain (=3) — divide by it to recover raw player pts.
        userCaptainPts = cap.multiplier > 0 ? cap.total_points / cap.multiplier : cap.total_points
      }
    }

    const regret = computeRegret(modelCeilingPts, userCaptainPts)

    return {
      gw,
      userCaptainId,
      userCaptainName,
      userCaptainPts,
      modelCeilingId,
      modelCeilingName,
      modelCeilingPts,
      hasSnapshot,
      regret,
    }
  })

  const gwsWithData = entries.filter((e) => e.regret !== null).length

  // Step 4 (Phase 113 BACK-02): Transfer regret pipeline.
  // Wrapped in try/catch so a transfer-side failure cannot break the captain response (T-113-13,
  // Pitfall 7). On any error, transferEntries falls back to [] and captain data still returns.
  let transferEntries: TransferRegretEntry[] = []
  try {
    // Step 4a: For each GW, build per-GW input bundle (slim snapshot, picks, GW transfers).
    // Collect unique player IDs (engine+user) across all GWs for element-summary fan-out.
    type GwBundle = {
      gw: number
      slimSnapshot: SlimPlayer[] | null
      gwPicks: FPLPick[] | null
      gwTransfers: FPLTransferEntry[]
      isHold: boolean
    }
    const bundles: GwBundle[] = finishedGws.map((gw, i) => {
      const slimSnapshot = slimSnapshots[i]
      const gwPicks = picks[i]
      // Pitfall 2: allTransfers is season-aggregate; filter by event === gw before use.
      const gwTransfers = allTransfers.filter((t) => t.event === gw)
      const isHold = gwTransfers.length === 0
      return { gw, slimSnapshot, gwPicks, gwTransfers, isHold }
    })

    // Step 4b: Run suggestTransfers post-hoc for each GW that has a slim snapshot + picks.
    // Collect (engineOutIds, engineInIds, userOutIds, userInIds) for element-summary fan-out.
    type GwEngineResult = {
      gw: number
      isHold: boolean
      hasSnapshot: boolean
      engineOutIds: number[]
      engineInIds: number[]
      userOutIds: number[]
      userInIds: number[]
      slimSnapshot: SlimPlayer[] | null
      gwTransfers: FPLTransferEntry[]
    }
    const gwResults: GwEngineResult[] = []
    const uniqueTransferIds = new Set<number>()

    for (const bundle of bundles) {
      const { gw, slimSnapshot, gwPicks, gwTransfers, isHold } = bundle

      if (slimSnapshot === null || gwPicks === null || slimSnapshot.length === 0) {
        gwResults.push({
          gw, isHold, hasSnapshot: false,
          engineOutIds: [], engineInIds: [],
          userOutIds: [], userInIds: [],
          slimSnapshot: null, gwTransfers,
        })
        continue
      }

      // Reconstruct pre-transfer squad (D-03, Pitfall 1).
      const preTransferSquad = reconstructPreTransferSquad(gwPicks, gwTransfers)

      // Post-hoc engine call:
      //   bank: 9999 — unconstrained post-hoc simplification (Pitfall 4); goal is xPts
      //   recommendation, not budget enforcement at decision time.
      //   ftCount: mirrors what the user did so engine's combo enumeration matches D-07.
      //   horizon: 1 — 1GW horizon (D-01 discretion default; xPts_1gw from slim snapshot).
      const ftCount: 1 | 2 = gwTransfers.length >= 2 ? 2 : 1
      const suggestions = suggestTransfers({
        currentPicks: preTransferSquad as SquadPick[],
        players: slimSnapshot as unknown as MergedPlayer[],
        horizon: 1,
        ftCount,
        bank: 9999,
        sellPrices: undefined,
      })

      const top = suggestions[0]
      if (!top) {
        gwResults.push({
          gw, isHold, hasSnapshot: true,
          engineOutIds: [], engineInIds: [],
          userOutIds: [], userInIds: [],
          slimSnapshot, gwTransfers,
        })
        continue
      }

      // Extract engine OUT/IN element IDs from top suggestion.
      // combo kind has two transfers [{sell, buy}, {sell, buy}]; single kind has one sell/buy.
      let engineOutIds: number[]
      let engineInIds: number[]
      if (top.kind === 'combo') {
        engineOutIds = top.transfers.map((t) => t.sell.id)
        engineInIds = top.transfers.map((t) => t.buy.id)
      } else {
        // kind === 'single'
        engineOutIds = [top.sell.id]
        engineInIds = [top.buy.id]
      }

      // User OUT/IN come from the GW's actual transfers.
      const userOutIds: number[] = gwTransfers.map((t) => t.element_out)
      const userInIds: number[] = gwTransfers.map((t) => t.element_in)

      // Add all IDs to dedup set for element-summary fan-out (Step 4c).
      for (const id of [...engineOutIds, ...engineInIds, ...userOutIds, ...userInIds]) {
        uniqueTransferIds.add(id)
      }

      gwResults.push({
        gw, isHold, hasSnapshot: true,
        engineOutIds, engineInIds,
        userOutIds, userInIds,
        slimSnapshot, gwTransfers,
      })
    }

    // Step 4c: Fan out element-summary fetches for all unique transfer player IDs.
    // Separate from the captain actualPtsMap — do not merge keys.
    // Security T-113-10: SSRF guard — !/^\d+$/.test(String(id)) skips non-numeric IDs.
    // Pitfall 3: deduplication limits worst-case to ~304 IDs (38 GWs × 2 transfers × 4 sides).
    const transferActualPtsMap = new Map<number, Map<number, number>>()
    if (uniqueTransferIds.size > 0) {
      const transferSummaryResults = await Promise.allSettled(
        [...uniqueTransferIds].map(async (id) => {
          // T-113-10: SSRF guard — skip non-numeric element IDs before constructing URL.
          if (!/^\d+$/.test(String(id))) return null
          try {
            const res = await fetch(`${FPL_BASE}/element-summary/${id}/`, {
              headers: { 'User-Agent': FPL_UA },
            })
            if (!res.ok) return null
            const json = (await res.json()) as {
              history?: Array<{ element: number; round: number; total_points: number }>
            }
            return { id, history: json.history ?? [] }
          } catch {
            return null
          }
        }),
      )
      for (const result of transferSummaryResults) {
        if (result.status === 'fulfilled' && result.value) {
          const { id, history } = result.value
          transferActualPtsMap.set(id, new Map(history.map((h) => [h.round, h.total_points])))
        }
      }
    }

    // Step 4d: Assemble TransferRegretEntry per GW.
    transferEntries = gwResults.map((r) => {
      const { gw, isHold, hasSnapshot, engineOutIds, engineInIds, userOutIds, userInIds, slimSnapshot, gwTransfers } = r

      // No snapshot: pre-deployment GW or missing slim snapshot — return null fields.
      if (!hasSnapshot || slimSnapshot === null) {
        return {
          gw, hasSnapshot: false, isHold,
          engineSell: null, engineBuy: null,
          engineSellPts: null, engineBuyPts: null,
          userSell: null, userBuy: null,
          userSellPts: null, userBuyPts: null,
          delta: null,
        }
      }

      // No engine suggestion possible (engine returned empty).
      if (engineOutIds.length === 0) {
        return {
          gw, hasSnapshot: true, isHold,
          engineSell: null, engineBuy: null,
          engineSellPts: null, engineBuyPts: null,
          userSell: isHold ? null : userOutIds.map((id) => slimSnapshot.find((p) => p.id === id)?.web_name ?? 'Unknown'),
          userBuy: isHold ? null : userInIds.map((id) => slimSnapshot.find((p) => p.id === id)?.web_name ?? 'Unknown'),
          userSellPts: null, userBuyPts: null,
          delta: null,
        }
      }

      // Look up actual points for engine and user players via transferActualPtsMap.
      // Pitfall: if element-summary fetch fails entirely, all four fan-out IDs return undefined;
      // treat each leg's missing pts as 0 rather than null-propagating delta, matching captain
      // backtester convention (SC-5 partial-failure fold for individual element-summary failures).
      const engineOutPts = engineOutIds.map((id) => transferActualPtsMap.get(id)?.get(gw) ?? 0)
      const engineInPts = engineInIds.map((id) => transferActualPtsMap.get(id)?.get(gw) ?? 0)
      const userOutPts = isHold ? null : userOutIds.map((id) => transferActualPtsMap.get(id)?.get(gw) ?? 0)
      const userInPts = isHold ? null : userInIds.map((id) => transferActualPtsMap.get(id)?.get(gw) ?? 0)

      // Web names for display — look up in slim snapshot first, fall back to bootstrap elementMap.
      const nameFor = (id: number): string =>
        slimSnapshot.find((p) => p.id === id)?.web_name ?? elementMap.get(id) ?? 'Unknown'

      const engineSell = engineOutIds.map(nameFor)
      const engineBuy = engineInIds.map(nameFor)
      const userSell = isHold ? null : userOutIds.map(nameFor)
      const userBuy = isHold ? null : userInIds.map(nameFor)

      // D-06 hold delta: delta = engineIn_pts - engineOut_pts (counterfactual gain)
      // D-07 1/2-FT delta: delta = Σ(engineIn_pts) - Σ(engineOut_pts) - (Σ(userIn_pts) - Σ(userOut_pts))
      const delta = isHold
        ? computeTransferDelta(engineInPts, engineOutPts, null, null)
        : computeTransferDelta(engineInPts, engineOutPts, userInPts!, userOutPts!)

      return {
        gw, hasSnapshot: true, isHold,
        engineSell, engineBuy,
        engineSellPts: engineOutPts, engineBuyPts: engineInPts,
        userSell, userBuy,
        userSellPts: userOutPts, userBuyPts: userInPts,
        delta,
      }
    })
  } catch {
    // T-113-13: Transfer pipeline failure — fall back to empty array so captain path still returns.
    transferEntries = []
  }

  const payload: DecisionHistory = {
    teamId: Number(teamId),
    gwsWithData,
    entries,
    transferEntries,
  }

  return Response.json(payload, {
    status: 200,
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' },
  })
}
