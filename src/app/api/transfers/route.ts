import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

// Returned when the pipeline has not yet written the artifact (CONFIRMED_TRANSFERS_ENABLED
// not active in CI). 200 + enabled:false is preferable to 404 — the endpoint exists;
// only the data is absent. This prevents browser console errors and React Query retries.
const DISABLED_RESPONSE = {
  enabled: false,
  scraped_at: '',
  window: '',
  source_url: '',
  groups: [],
  chronological: [],
  counts: { deals: 0, loans: 0 },
} as const

export async function GET() {
  try {
    let data: string

    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'transfers_confirmed.json', limit: 1 })
      if (!blobs.length) {
        return Response.json(DISABLED_RESPONSE, { status: 200 })
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
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'transfers_confirmed.json')
      data = await readFile(cachePath, 'utf-8')
    }

    const parsed = JSON.parse(data)
    return Response.json({ enabled: true, ...parsed }, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  } catch (err) {
    const isNotFound =
      err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
    if (isNotFound) {
      return Response.json(DISABLED_RESPONSE, { status: 200 })
    }
    return Response.json({ error: 'Failed to load confirmed transfers' }, { status: 500 })
  }
}
