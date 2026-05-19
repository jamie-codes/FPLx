// Phase 126 (NSP-02): pre-season squad API route.
// Phase 127 (GREEDY-01): envelope response with health side-read and solver inference (D-05/D-06/D-07).
// Resolution order:
//   1. pre_season_squad.json (pre-computed ILP result) — return envelope with solver: 'ilp'
//   2. season_archive_gw38.json (raw archive) — compute ppm scoreMap, build greedy squad — solver: 'greedy'
//   3. Neither exists — 404 "Archive not available" (D-03 "Prices pending" trigger)
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { buildPreSeasonSquad } from '@/lib/pre-season-squad'
import type { PreSeasonPlayer, SeasonArchiveEntry, SquadHealth, PreSeasonSquadResponse } from '@/lib/types'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

async function readBlobOrLocal(filename: string): Promise<string | null> {
  try {
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: filename, limit: 1 })
      if (!blobs.length) return null
      const res = await fetch(blobs[0].url)
      if (!res.ok) throw new Error(`Blob fetch failed: ${res.status}`)
      return await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', filename)
      return await readFile(cachePath, 'utf-8')
    }
  } catch (err) {
    const isNotFound =
      err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
    if (isNotFound) return null
    throw err
  }
}

export async function GET() {
  try {
    // --- Resolution 1: prefer pre-computed ILP result — side-read health in parallel (D-06) ---
    const [preComputedData, healthData] = await Promise.all([
      readBlobOrLocal('pre_season_squad.json'),
      readBlobOrLocal('pre_season_squad_health.json'),  // null if absent (D-06)
    ])
    const health: SquadHealth | null = healthData ? (JSON.parse(healthData) as SquadHealth) : null

    if (preComputedData !== null) {
      const squad = JSON.parse(preComputedData)
      return Response.json({ squad, health, solver: 'ilp' } satisfies PreSeasonSquadResponse, {
        status: 200,
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      })
    }

    // --- Resolution 2: fall back to raw archive ---
    const archiveData = await readBlobOrLocal('season_archive_gw38.json')
    if (archiveData === null) {
      // Resolution 3: neither artifact exists → "Prices pending" (D-03)
      return Response.json({ error: 'Archive not available' }, { status: 404 })
    }

    // Parse archive: Record<number, SeasonArchiveEntry> (keyed by player id)
    const archive = JSON.parse(archiveData) as Record<string, SeasonArchiveEntry>

    // Build PreSeasonPlayer[] from archive entries
    // Archive does not include bootstrap fields (name, team, cost) — those must come from
    // bootstrap. For now, use only players with valid history and sufficient minutes.
    // NOTE: The archive stores element-summary objects keyed by player id.
    // We need bootstrap data to get web_name/team/now_cost. Load fpl_bootstrap.json.
    const bootstrapData = await readBlobOrLocal('fpl_bootstrap.json')
    if (bootstrapData === null) {
      // Cannot build player metadata without bootstrap — return 503
      return Response.json(
        { error: 'Bootstrap data not available — squad computation pending' },
        { status: 503 },
      )
    }

    const bootstrap = JSON.parse(bootstrapData)
    const elements: Array<{
      id: number
      web_name: string
      element_type: 1 | 2 | 3 | 4
      team: number
      now_cost: number
    }> = bootstrap.elements ?? []

    // Build id→bootstrap lookup
    const elementMap = new Map(elements.map(e => [e.id, e]))

    // Build team id→short_name lookup
    const teamMap = new Map<number, string>(
      (bootstrap.teams ?? []).map((t: { id: number; short_name: string }) => [t.id, t.short_name]),
    )

    // Compute total_points and total_minutes from history
    const scoreMap = new Map<number, number>()
    const players: PreSeasonPlayer[] = []

    for (const [idStr, entry] of Object.entries(archive)) {
      const id = Number(idStr)
      const el = elementMap.get(id)
      if (!el) continue

      const history = entry.history ?? []
      const totalPoints = history.reduce(
        (sum, gw) => sum + (typeof gw.total_points === 'number' ? gw.total_points : 0),
        0,
      )
      const totalMinutes = history.reduce(
        (sum, gw) => sum + (typeof gw.minutes === 'number' ? gw.minutes : 0),
        0,
      )

      // D-02: exclude players with < 500 total minutes (insufficient season data)
      if (totalMinutes < 500) continue

      const ppm = totalPoints / totalMinutes

      players.push({
        id,
        web_name: el.web_name,
        element_type: el.element_type,
        team: el.team,
        team_short_name: teamMap.get(el.team) ?? 'UNK',
        now_cost: el.now_cost,
        total_points: totalPoints,
        ppm,
      })

      scoreMap.set(id, ppm)
    }

    const squad = buildPreSeasonSquad(players, scoreMap)

    if (squad === null) {
      // Greedy returned null — ILP fallback pending from pipeline
      console.error('[pre-season-squad] Greedy buildPreSeasonSquad returned null — ILP fallback pending')
      return Response.json(
        { error: 'Squad infeasible — ILP fallback pending' },
        { status: 503 },
      )
    }

    return Response.json({ squad, health, solver: 'greedy' } satisfies PreSeasonSquadResponse, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  } catch (err) {
    const isNotFound =
      err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
    if (isNotFound) {
      return Response.json({ error: 'Archive not available' }, { status: 404 })
    }
    console.error('[pre-season-squad] Unexpected error:', err)
    return Response.json({ error: 'Failed to load pre-season squad' }, { status: 500 })
  }
}
