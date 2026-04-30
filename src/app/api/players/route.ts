import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

async function readBacktestPlayersBlob(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: 'accuracy_backtest.json', limit: 1 })
    if (!blobs.length) return null
    const res = await fetch(blobs[0].url)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function readBacktestPlayersLocal(): Promise<string | null> {
  try {
    const cachePath = join(process.cwd(), 'pipeline', 'cache', 'accuracy_backtest.json')
    return await readFile(cachePath, 'utf-8')
  } catch {
    return null
  }
}

function buildBacktestMap(raw: string | null): Map<number, number | null> {
  const map = new Map<number, number | null>()
  if (!raw) return map
  try {
    const bt = JSON.parse(raw) as { gws_covered?: number[]; players?: Array<{ player_id: number; gws?: Array<{ gw: number; actual_pts: number }> }> }
    const mostRecentGw = bt.gws_covered?.[0]
    if (mostRecentGw === undefined) return map
    for (const p of bt.players ?? []) {
      const entry = p.gws?.find(g => g.gw === mostRecentGw)
      map.set(p.player_id, entry?.actual_pts ?? null)
    }
  } catch {
    // malformed backtest — return empty map
  }
  return map
}

export async function GET() {
  try {
    let data: string

    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'merged_players.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'No merged data available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'merged_players.json')
      data = await readFile(cachePath, 'utf-8')
    }

    // Graceful backtest join — must NOT throw if accuracy_backtest.json absent.
    const backtestRaw = USE_BLOB ? await readBacktestPlayersBlob() : await readBacktestPlayersLocal()
    const backtestMap = buildBacktestMap(backtestRaw)

    const players = JSON.parse(data) as Array<Record<string, unknown>>
    const enriched = players.map(p => ({
      ...p,
      last_gw_actual_pts: backtestMap.get(p.id as number) ?? null,
    }))

    return Response.json(enriched, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Failed to serve merged players:', error)
    return Response.json(
      { error: 'Failed to load player data' },
      { status: 500 }
    )
  }
}
