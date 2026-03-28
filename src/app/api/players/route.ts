import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let data: string

    if (USE_BLOB) {
      // Production: read from Vercel Blob
      const { blobs } = await list({ prefix: 'merged_players.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'No merged data available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      data = await res.text()
    } else {
      // Dev: read from local pipeline cache
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'merged_players.json')
      data = await readFile(cachePath, 'utf-8')
    }

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
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
