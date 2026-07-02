import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

// TRF-01: this GW's recommended transfers from the pipeline's advisor
// trajectory (validated exp14: +136 pts vs hold on 2025/26).
export async function GET() {
  try {
    let data: string

    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'transfer_advice.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'Transfer advice not available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'transfer_advice.json')
      data = await readFile(cachePath, 'utf-8')
    }

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    return Response.json({ error: 'Failed to load transfer advice' }, { status: 500 })
  }
}
