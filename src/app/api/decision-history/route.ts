// Phase 96 BACK-01: captain regret backtester API route.
// Joins per-GW captain snapshots (Vercel Blob) with the user's authenticated
// FPL picks to produce a season-long DecisionHistory.
//
// Sources of truth:
//   .planning/phases/96-captain-decision-backtester/96-CONTEXT.md (D-06, D-08, D-10, SC-5)
//   .planning/phases/96-captain-decision-backtester/096-PATTERNS.md §src/app/api/decision-history/route.ts
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { NextRequest } from 'next/server'
import type { DecisionHistory, RegretEntry, CaptainPickSnapshot } from '@/lib/types'
import { computeRegret } from '@/lib/regret'

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

  // Step 2: parallel snapshot reads + picks fetches.
  const [snapshots, picks] = await Promise.all([
    Promise.all(finishedGws.map((gw) => readSnapshot(gw))),
    Promise.all(finishedGws.map((gw) => readGwPicks(teamId, gw))),
  ])

  // Step 3: assemble RegretEntry per GW.
  const entries: RegretEntry[] = finishedGws.map((gw, i) => {
    const snap = snapshots[i]
    const gwPicks = picks[i]

    // Model side (D-08: ceiling pick at decision time).
    const ceiling = snap?.ceiling ?? null
    const modelCeilingId = ceiling?.id ?? null
    const modelCeilingName = ceiling?.name ?? null
    const modelCeilingPts = ceiling
      ? Math.round((ceiling.xPts_1gw ?? 0) * 10) / 10
      : null
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

  const payload: DecisionHistory = {
    teamId: Number(teamId),
    gwsWithData,
    entries,
  }

  return Response.json(payload, {
    status: 200,
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' },
  })
}
