import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { NextRequest } from 'next/server'
import type { GwReview } from '@/lib/types'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'
// fantasy.premierleague.com/api — called directly (picks + bootstrap); see Pitfall 1 in RESEARCH.md
const FPL_BASE = 'https://fantasy.premierleague.com/api'

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

interface BlobBase { gw: number | null; average_score?: number }

/**
 * GET /api/gw-review?teamId=&gw=N
 *
 * Phase 73 PGW-02. Reads gw_review_gw{N}.json (global data: gw, average_score)
 * from Blob or local cache and merges it with on-demand FPL picks data
 * (team-specific: your_score, bench_pts_left, captain_delta, top_scorer).
 *
 * Security (T-34-01 + path-traversal mitigation):
 *   - teamId MUST match /^\d+$/  (numeric)
 *   - gw MUST match /^\d+$/      (numeric, prevents ../ and arbitrary filename injection)
 *
 * Pitfall 1 (RESEARCH.md): we call FPL upstream directly, NOT through the
 * internal /api/fpl/[...proxy] route — relative-URL self-fetch fails on
 * Vercel serverless deployments.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const gwParam = searchParams.get('gw')
  const teamIdParam = searchParams.get('teamId')

  if (!gwParam || !/^\d+$/.test(gwParam)) {
    return Response.json({ error: 'Invalid gw parameter' }, { status: 400 })
  }
  if (!teamIdParam || !/^\d+$/.test(teamIdParam)) {
    return Response.json({ error: 'Invalid teamId parameter' }, { status: 400 })
  }

  const gw = Number(gwParam)
  const teamId = teamIdParam
  const filename = `gw_review_gw${gw}.json`

  // Step 1: Read gw_review_gw{N}.json (Blob or local cache)
  let blobText: string
  try {
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: filename, limit: 1 })
      if (!blobs.length || blobs[0].pathname !== filename) {
        return Response.json({ error: 'GW review not available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      if (!res.ok) {
        return Response.json({ error: `Blob fetch failed: ${res.status}` }, { status: 502 })
      }
      blobText = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', filename)
      blobText = await readFile(cachePath, 'utf-8')
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') {
      return Response.json({ error: 'GW review not available' }, { status: 404 })
    }
    return Response.json({ error: 'Failed to read GW review' }, { status: 500 })
  }

  let blobBase: BlobBase
  try {
    blobBase = JSON.parse(blobText) as BlobBase
  } catch {
    return Response.json({ error: 'Malformed GW review file' }, { status: 500 })
  }

  // D-13: cold-start seed file has gw === null. Treat as unsettled (503).
  if (blobBase.gw === null) {
    return Response.json({ error: 'GW not yet settled' }, { status: 503 })
  }

  const averageScore = typeof blobBase.average_score === 'number' ? blobBase.average_score : 0

  // Step 2: Fetch FPL picks directly upstream (Pitfall 1)
  let picks: FPLPick[]
  let entryHistory: { points: number; points_on_bench: number; event: number }
  try {
    const picksRes = await fetch(`${FPL_BASE}/entry/${teamId}/event/${gw}/picks/`, {
      headers: { 'User-Agent': 'fplx/1.11 (+https://fplx.app)' },
    })
    if (!picksRes.ok) {
      return Response.json(
        { error: `FPL picks fetch failed: ${picksRes.status}` },
        { status: picksRes.status === 404 ? 404 : 502 }
      )
    }
    const picksJson = (await picksRes.json()) as FPLPicksResponse
    if (!picksJson || !Array.isArray(picksJson.picks) || !picksJson.entry_history) {
      return Response.json({ error: 'FPL picks: unexpected response shape' }, { status: 502 })
    }
    picks = picksJson.picks
    entryHistory = picksJson.entry_history
  } catch {
    return Response.json({ error: 'FPL picks unreachable' }, { status: 502 })
  }

  // Step 3: Fetch bootstrap to resolve element -> web_name
  let elementMap: Map<number, string>
  try {
    const bootRes = await fetch(`${FPL_BASE}/bootstrap-static/`, {
      headers: { 'User-Agent': 'fplx/1.11 (+https://fplx.app)' },
    })
    if (!bootRes.ok) {
      return Response.json({ error: `FPL bootstrap fetch failed: ${bootRes.status}` }, { status: 502 })
    }
    const bootJson = (await bootRes.json()) as { elements?: FPLBootstrapElement[] }
    const elements = Array.isArray(bootJson?.elements) ? bootJson.elements : []
    elementMap = new Map(elements.map((e) => [e.id, e.web_name]))
  } catch {
    return Response.json({ error: 'FPL bootstrap unreachable' }, { status: 502 })
  }

  // Step 4: Compute team-specific metrics (D-05, D-06, D-07)
  const starters = picks.filter((p) => p.position <= 11)
  if (starters.length === 0) {
    return Response.json({ error: 'No starting XI found in picks' }, { status: 502 })
  }

  const yourCaptain = starters.find((p) => p.is_captain) ?? starters[0]
  // Optimal captain: highest total_points among starters
  const optimalCaptain = starters.reduce(
    (best, p) => (p.total_points > best.total_points ? p : best),
    starters[0]
  )
  // Top scorer: same as optimal captain by definition (highest total_points among starters)
  const topScorer = optimalCaptain

  // D-06: captain delta uses pick.multiplier (Pitfall 3 — handles Triple Captain where multiplier=3)
  // Clamp to 0 if your captain WAS the optimal captain (or if Triple Captain on optimal makes
  // the formula go negative — defence in depth)
  const captainDeltaRaw =
    optimalCaptain.total_points * 2 - yourCaptain.total_points * yourCaptain.multiplier
  const captainDelta = Math.max(0, captainDeltaRaw)

  const review: GwReview = {
    gw,
    your_score: entryHistory.points,
    bench_pts_left: entryHistory.points_on_bench,
    captain_name: elementMap.get(yourCaptain.element) ?? `Player ${yourCaptain.element}`,
    optimal_captain_name: elementMap.get(optimalCaptain.element) ?? `Player ${optimalCaptain.element}`,
    captain_delta: captainDelta,
    top_scorer_name: elementMap.get(topScorer.element) ?? `Player ${topScorer.element}`,
    top_scorer_pts: topScorer.total_points,
    average_score: averageScore,
    // Phase 98 D-09 / PGW-01: TODO — computed in Plan 02; stub until then
    best_bench_player_name: '—',
    best_bench_player_pts: 0,
  }

  return Response.json(review, {
    status: 200,
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
  })
}
