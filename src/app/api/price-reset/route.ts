// Phase 133 (PRST-02/PRST-03/PRST-04): Price reset analysis API route.
// Diffs price_baseline.json against the current FPL bootstrap to surface who rose/fell,
// and computes Value Targets from merged_players.json xPts position-median analysis.
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { PriceResetResponse, PriceResetRow, ValueTargetRow, PositionCode } from '@/lib/types'

const ELEMENT_TYPE_LABEL: Record<PositionCode, 'GK' | 'DEF' | 'MID' | 'FWD'> = {
  1: 'GK',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
}

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

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const EMPTY_RESPONSE: Omit<PriceResetResponse, 'generated_at'> = {
  published: false,
  players: [],
  value_targets: [],
}

export async function GET(): Promise<Response> {
  try {
    // Read all three artifacts concurrently.
    // merged_players is optional — errors are swallowed to allow graceful degradation.
    const [baselineText, bootstrapText, mergedPlayersText] = await Promise.all([
      readBlobOrLocal('price_baseline.json'),
      readBlobOrLocal('fpl_bootstrap.json'),
      readBlobOrLocal('merged_players.json').catch(() => null),
    ])

    // D-08: baseline or bootstrap absent → published: false (no 404)
    if (baselineText === null || bootstrapText === null) {
      return Response.json(
        { ...EMPTY_RESPONSE, generated_at: new Date().toISOString() } satisfies PriceResetResponse,
        { status: 200 },
      )
    }

    // Parse baseline and bootstrap (JSON failure → published: false)
    let baseline: Record<string, number>
    let bootstrap: {
      elements: Array<{
        id: number
        web_name: string
        element_type: PositionCode
        team: number
        now_cost: number
      }>
      teams: Array<{ id: number; short_name: string }>
    }

    try {
      baseline = JSON.parse(baselineText) as Record<string, number>
      bootstrap = JSON.parse(bootstrapText) as typeof bootstrap
    } catch {
      return Response.json(
        { ...EMPTY_RESPONSE, generated_at: new Date().toISOString() } satisfies PriceResetResponse,
        { status: 200 },
      )
    }

    // Build team_id → short_name map from bootstrap
    const teamMap = new Map<number, string>(
      (bootstrap.teams ?? []).map(t => [t.id, t.short_name]),
    )

    // Compute deltas for each bootstrap element that exists in the baseline
    const players: PriceResetRow[] = []
    for (const el of bootstrap.elements ?? []) {
      const baselineCost = baseline[String(el.id)]
      if (baselineCost === undefined) continue
      const deltaCost = el.now_cost - baselineCost
      if (deltaCost === 0) continue  // D-07: exclude zero-delta players
      players.push({
        player_id: el.id,
        name: el.web_name,
        team: teamMap.get(el.team) ?? 'UNK',
        element_type: el.element_type,
        baseline_cost: baselineCost,
        current_cost: el.now_cost,
        delta_cost: deltaCost,
      })
    }

    // Sort descending by absolute delta
    players.sort((a, b) => Math.abs(b.delta_cost) - Math.abs(a.delta_cost))

    // D-07: no non-zero deltas → published: false
    const published = players.length > 0
    if (!published) {
      return Response.json(
        { ...EMPTY_RESPONSE, generated_at: new Date().toISOString() } satisfies PriceResetResponse,
        { status: 200 },
      )
    }

    // Compute value_targets from merged_players (in its own try/catch — failure → [] gracefully)
    let valueTargets: ValueTargetRow[] = []

    try {
      if (mergedPlayersText === null) throw new Error('merged_players absent')

      const mergedPlayers = JSON.parse(mergedPlayersText) as Array<{
        id: number
        web_name: string
        team_short_name: string
        element_type: 1 | 2 | 3 | 4
        now_cost: number
        xPts_1gw?: number
      }>

      // For each position, compute median xPts and build rank lookup
      const positionXPts = new Map<PositionCode, number[]>()
      for (const mp of mergedPlayers) {
        if (mp.xPts_1gw === undefined || mp.xPts_1gw === null || !Number.isFinite(mp.xPts_1gw)) {
          continue
        }
        const arr = positionXPts.get(mp.element_type) ?? []
        arr.push(mp.xPts_1gw)
        positionXPts.set(mp.element_type, arr)
      }

      const positionMedians = new Map<PositionCode, number>()
      for (const [pos, vals] of positionXPts) {
        positionMedians.set(pos, median(vals))
      }

      // Build rank lookup: sort merged by xPts_1gw desc within each position, map id → rank (1-indexed)
      const positionRanks = new Map<number, number>()
      const positionGroups = new Map<PositionCode, Array<{ id: number; xPts: number }>>()
      for (const mp of mergedPlayers) {
        if (mp.xPts_1gw === undefined || mp.xPts_1gw === null || !Number.isFinite(mp.xPts_1gw)) {
          continue
        }
        const group = positionGroups.get(mp.element_type) ?? []
        group.push({ id: mp.id, xPts: mp.xPts_1gw })
        positionGroups.set(mp.element_type, group)
      }
      for (const group of positionGroups.values()) {
        group.sort((a, b) => b.xPts - a.xPts)
        group.forEach(({ id }, index) => positionRanks.set(id, index + 1))
      }

      // Build lookup id → merged player row
      const mergedById = new Map(mergedPlayers.map(mp => [mp.id, mp]))

      // Iterate players filtering for fall rows with xPts above position median
      for (const player of players) {
        if (player.delta_cost >= 0) continue  // fall only (most negative delta_cost)
        const mp = mergedById.get(player.player_id)
        if (!mp) continue
        const xPts = mp.xPts_1gw
        if (xPts === undefined || xPts === null || !Number.isFinite(xPts)) continue
        const positionMedian = positionMedians.get(player.element_type) ?? 0
        if (xPts <= positionMedian) continue  // must strictly exceed median
        const rank = positionRanks.get(player.player_id) ?? 0
        valueTargets.push({
          ...player,
          xPts_1gw: xPts,
          position_median_xPts: positionMedian,
          position_rank: rank,
          position_label: ELEMENT_TYPE_LABEL[player.element_type],
        })
      }

      // Sort ascending by delta_cost (most negative = largest fall first)
      valueTargets.sort((a, b) => a.delta_cost - b.delta_cost)
    } catch {
      // merged_players failed — graceful degradation, no value_targets
      valueTargets = []
    }

    return Response.json(
      {
        published: true,
        generated_at: new Date().toISOString(),
        players,
        value_targets: valueTargets,
      } satisfies PriceResetResponse,
      {
        status: 200,
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' },
      },
    )
  } catch {
    return Response.json({ error: 'Failed to load price reset data' }, { status: 500 })
  }
}
