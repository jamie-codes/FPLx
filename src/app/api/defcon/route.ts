import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const cachePath = join(process.cwd(), 'pipeline', 'cache', 'defcon_stats.json')
    const data = await readFile(cachePath, 'utf-8')
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    return Response.json({ error: 'DefCon data not available' }, { status: 404 })
  }
}
