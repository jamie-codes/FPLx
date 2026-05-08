// Phase 82 DH-03: serves the pipeline data health artifact from Blob or local cache.
// Mirror of src/app/api/accuracy/route.ts — deliberately omits the caching header
// (Pitfall 2 — useDataHealth uses staleTime:0 + 60s refetchInterval; CDN caching
// would defeat Phase 82 by serving stale snapshots. See RESEARCH.md §Pitfall 2).

import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let data: string

    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'data_health.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'Data health not available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      if (!res.ok) {
        return Response.json(
          { error: `Blob fetch failed: ${res.status}` },
          { status: 502 }
        )
      }
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'data_health.json')
      data = await readFile(cachePath, 'utf-8')
    }

    const parsed = JSON.parse(data)
    // No server-side caching header — the 60s refetchInterval is the staleness contract.
    return Response.json(parsed, { status: 200 })
  } catch {
    return Response.json({ error: 'Failed to load data health' }, { status: 500 })
  }
}
