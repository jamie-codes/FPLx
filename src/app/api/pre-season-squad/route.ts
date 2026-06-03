// Phase 126 (NSP-02): pre-season squad API route.
// Phase 127 (GREEDY-01): envelope response with health side-read and solver inference (D-05/D-06/D-07).
// Phase 129 (COST-02): ?include=inputs query-param attaches inputs envelope (D-01–D-04).
// Resolution order:
//   1. pre_season_squad.json (pre-computed ILP result) — return envelope with solver: 'ilp'
//   2. season_archive_gw38.json (raw archive) — compute ppm scoreMap, build greedy squad — solver: 'greedy'
//   3. Neither exists — 404 "Archive not available" (D-03 "Prices pending" trigger)
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { NextRequest } from 'next/server'
import { buildPreSeasonSquad, diagnoseBuildPreSeasonSquad } from '@/lib/pre-season-squad'
import type { PreSeasonPlayer, PreSeasonSquadInputs, SeasonArchiveEntry, SquadHealth, PreSeasonSquadResponse } from '@/lib/types'

async function readBlobOrLocal(filename: string): Promise<string | null> {
  const useBlob = process.env.USE_BLOB?.toLowerCase() === 'true'
  try {
    if (useBlob) {
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

// Phase 129 (COST-02): Extract archive+bootstrap parsing into a shared helper.
// Takes the raw JSON strings (owns the parse step), applies 500-minute eligibility filter,
// computes ppm, and returns { players, scoreMap } or null if parse fails / no eligible players.
function loadSquadInputs(
  archiveText: string,
  bootstrapText: string,
): { players: PreSeasonPlayer[]; scoreMap: Map<number, number> } | null {
  try {
    // Parse archive: Record<string, SeasonArchiveEntry> (keyed by player id)
    const archive = JSON.parse(archiveText) as Record<string, SeasonArchiveEntry>

    const bootstrap = JSON.parse(bootstrapText)
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

    if (players.length === 0) return null

    return { players, scoreMap }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeInputs = searchParams.get('include') === 'inputs'

    // --- Resolution 1: prefer pre-computed ILP result — side-read health in parallel (D-06) ---
    // Phase 129 (D-01): when ?include=inputs, also read archive+bootstrap in parallel for the inputs envelope
    const [preComputedData, healthData, archiveDataR1, bootstrapDataR1] = await Promise.all([
      readBlobOrLocal('pre_season_squad.json'),
      readBlobOrLocal('pre_season_squad_health.json'),  // null if absent (D-06)
      includeInputs ? readBlobOrLocal('season_archive_gw38.json') : Promise.resolve(null),
      includeInputs ? readBlobOrLocal('fpl_bootstrap.json') : Promise.resolve(null),
    ])
    const health: SquadHealth | null = healthData ? (JSON.parse(healthData) as SquadHealth) : null

    if (preComputedData !== null) {
      const squad = JSON.parse(preComputedData)

      // Phase 129 (COST-02): attach inputs envelope when requested and archive+bootstrap available
      let inputs: PreSeasonSquadInputs | undefined
      if (includeInputs && archiveDataR1 !== null && bootstrapDataR1 !== null) {
        const result = loadSquadInputs(archiveDataR1, bootstrapDataR1)
        if (result !== null) {
          // D-03: Object.fromEntries converts Map<number,number> → Record<string,number>
          inputs = {
            players: result.players,
            scoreMap: Object.fromEntries(result.scoreMap),
            budget_default: 1000,  // D-04: FPL tenths = £100m
          }
        }
        // If loadSquadInputs returns null or archive/bootstrap missing: graceful degradation — no inputs, no 503
      }

      return Response.json(
        { squad, health, solver: 'ilp', ...(inputs ? { inputs } : {}) } satisfies PreSeasonSquadResponse,
        {
          status: 200,
          headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
        },
      )
    }

    // --- Resolution 2: fall back to raw archive ---
    // When includeInputs=true, archive+bootstrap were already fetched above; reuse them.
    // When includeInputs=false, fetch fresh (D-02: no extra I/O when query param absent).
    const archiveData = includeInputs ? archiveDataR1 : await readBlobOrLocal('season_archive_gw38.json')
    if (archiveData === null) {
      // Resolution 3: neither artifact exists → "Prices pending" (D-03)
      return Response.json({ error: 'Archive not available' }, { status: 404 })
    }

    const bootstrapData = includeInputs ? bootstrapDataR1 : await readBlobOrLocal('fpl_bootstrap.json')
    if (bootstrapData === null) {
      // Cannot build player metadata without bootstrap — return 503
      return Response.json(
        { error: 'Bootstrap data not available — squad computation pending' },
        { status: 503 },
      )
    }

    // Phase 129 (COST-02): use shared loadSquadInputs helper for Resolution 2
    const result = loadSquadInputs(archiveData, bootstrapData)
    if (result === null) {
      // Parse failure or no eligible players — treat equivalently to bootstrap absence
      console.error('[pre-season-squad] loadSquadInputs returned null — Bootstrap data not available — squad computation pending')
      return Response.json(
        { error: 'Bootstrap data not available — squad computation pending' },
        { status: 503 },
      )
    }

    const { players, scoreMap } = result
    const squad = buildPreSeasonSquad(players, scoreMap)

    if (squad === null) {
      // Greedy returned null — classify why and include reason in 503 body (GREEDY-NULL).
      const diagnosis = diagnoseBuildPreSeasonSquad(players, scoreMap)
      const reason = diagnosis?.reason ?? 'unknown'
      console.error('[pre-season-squad] Greedy returned null —', reason, '— ILP fallback pending')
      return Response.json(
        { error: 'Squad infeasible — ILP fallback pending', reason },
        { status: 503 },
      )
    }

    // Phase 129 (COST-02): attach inputs envelope when requested on greedy path
    let inputs: PreSeasonSquadInputs | undefined
    if (includeInputs) {
      // D-03: Object.fromEntries converts Map<number,number> → Record<string,number>
      inputs = {
        players,
        scoreMap: Object.fromEntries(scoreMap),
        budget_default: 1000,  // D-04: FPL tenths = £100m
      }
    }

    return Response.json(
      { squad, health, solver: 'greedy', ...(inputs ? { inputs } : {}) } satisfies PreSeasonSquadResponse,
      {
        status: 200,
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      },
    )
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
