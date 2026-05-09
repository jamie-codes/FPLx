import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { SetPieceChanges, SetPieceTaker, SetPieceTeam } from '@/lib/types'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

type SpQualityEntry = {
  corner_danger_score?: number | null
  fk_danger_score?: number | null
  delivery_quality_rank?: number | null
  sp_sample_n?: number | null
  understat_id?: number | null
}
type SpQualityMap = Record<string, SpQualityEntry>

async function readJsonArtifact(localFilename: string, blobPrefix: string): Promise<string> {
  if (USE_BLOB) {
    const { blobs } = await list({ prefix: blobPrefix, limit: 1 })
    if (!blobs.length) throw new Error(`Blob not found: ${blobPrefix}`)
    const res = await fetch(blobs[0].url)
    return await res.text()
  }
  const cachePath = join(process.cwd(), 'pipeline', 'cache', localFilename)
  return await readFile(cachePath, 'utf-8')
}

function computeQuartileCutoffs(ranks: number[]): { p25: number; p75: number } | null {
  const distinct = Array.from(new Set(ranks)).sort((a, b) => a - b)
  if (distinct.length < 4) return null
  const sorted = [...ranks].sort((a, b) => a - b)
  const pickAt = (frac: number) => {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(frac * (sorted.length - 1))))
    return sorted[idx]
  }
  return { p25: pickAt(0.25), p75: pickAt(0.75) }
}

function classifyTier(
  rank: number | null | undefined,
  cutoffs: { p25: number; p75: number } | null,
): 'Elite' | 'Good' | 'Weak' | null {
  if (rank === null || rank === undefined) return null
  if (cutoffs === null) return 'Good' // <4 distinct ranked takers fallback
  if (rank >= cutoffs.p75) return 'Elite'
  if (rank <= cutoffs.p25) return 'Weak'
  return 'Good'
}

function mergeSpQualityIntoTaker(taker: SetPieceTaker, qmap: SpQualityMap): SetPieceTaker {
  const key = taker.id !== null && taker.id !== undefined ? String(taker.id) : null
  const entry = key ? qmap[key] : undefined
  if (!entry) return taker
  return {
    ...taker,
    corner_danger_score: entry.corner_danger_score ?? null,
    fk_danger_score: entry.fk_danger_score ?? null,
    delivery_quality_rank: entry.delivery_quality_rank ?? null,
    sp_sample_n: entry.sp_sample_n ?? null,
  }
}

export async function GET() {
  // Primary read — failure here is fatal (500), preserving previous behaviour.
  let primaryRaw: string
  try {
    primaryRaw = await readJsonArtifact('set_piece_changes.json', 'set_piece_changes.json')
  } catch {
    return Response.json({ error: 'Failed to load set-piece data' }, { status: 500 })
  }

  let payload: SetPieceChanges
  try {
    payload = JSON.parse(primaryRaw) as SetPieceChanges
    if (!payload || !Array.isArray(payload.teams)) {
      return Response.json({ error: 'Failed to load set-piece data' }, { status: 500 })
    }
  } catch {
    return Response.json({ error: 'Failed to load set-piece data' }, { status: 500 })
  }

  // Secondary read — failure here is non-fatal. Log and return primary payload unchanged.
  let qmap: SpQualityMap | null = null
  try {
    const qualityRaw = await readJsonArtifact('sp_quality.json', 'sp_quality.json')
    qmap = JSON.parse(qualityRaw) as SpQualityMap
  } catch (err) {
    console.error('[api/set-pieces] sp_quality.json read failed; serving without sp_quality fields', err)
  }

  if (qmap) {
    // 1) Merge raw sp_quality fields onto every taker (penalty/fk/corner) by id->string lookup.
    const mergedTeams: SetPieceTeam[] = payload.teams.map((team) => ({
      ...team,
      penalty_taker: mergeSpQualityIntoTaker(team.penalty_taker, qmap),
      fk_taker: mergeSpQualityIntoTaker(team.fk_taker, qmap),
      corner_taker: mergeSpQualityIntoTaker(team.corner_taker, qmap),
    }))

    // 2) Build the rank pool from FK+corner takers ONLY (penalty takers excluded per D-01;
    //    penalty sp_tier remains null even when delivery_quality_rank is present).
    //    Deduplicate by taker ID so dual-role takers are not counted twice.
    const ranks: number[] = []
    const seen = new Set<number>()
    for (const team of mergedTeams) {
      for (const taker of [team.fk_taker, team.corner_taker]) {
        if (typeof taker.delivery_quality_rank === 'number' && taker.id != null && !seen.has(taker.id)) {
          seen.add(taker.id)
          ranks.push(taker.delivery_quality_rank)
        }
      }
    }
    const cutoffs = computeQuartileCutoffs(ranks)

    // 3) Assign sp_tier on FK and corner takers only.
    const tieredTeams: SetPieceTeam[] = mergedTeams.map((team) => ({
      ...team,
      fk_taker: { ...team.fk_taker, sp_tier: classifyTier(team.fk_taker.delivery_quality_rank, cutoffs) },
      corner_taker: { ...team.corner_taker, sp_tier: classifyTier(team.corner_taker.delivery_quality_rank, cutoffs) },
    }))

    payload = { ...payload, teams: tieredTeams }
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
