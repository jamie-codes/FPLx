// Phase 128 (AUTO-03): pre-season activation status API route.
// D-07: Returns 404 when activation artifact absent (pre-season not yet activated).
// D-08: Returns 200 with { activated_at, season_id } payload when artifact is present.
// Uses Response.json() per Next.js 16 project convention (not NextResponse.json()).
// Mirrors pre-season-squad/route.ts readBlobOrLocal pattern exactly.
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { PreSeasonActiveResponse } from '@/lib/types'

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
    const data = await readBlobOrLocal('pre_season_active.json')
    if (data === null) {
      return Response.json({ error: 'Pre-season not yet activated' }, { status: 404 })
    }
    const payload = JSON.parse(data) as PreSeasonActiveResponse
    return Response.json(payload, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('[pre-season-active] Unexpected error:', err)
    return Response.json({ error: 'Failed to load activation status' }, { status: 500 })
  }
}
