import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

// CHP-01: pre-deadline chip signals (Bench Boost / Triple Captain / Free Hit)
// from the decision ledger + DGW/BGW fixture shape.
export async function GET() {
  try {
    let data: string

    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'chip_advice.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'Chip advice not available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'chip_advice.json')
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
    return Response.json({ error: 'Failed to load chip advice' }, { status: 500 })
  }
}
