import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const cachePath = join(process.cwd(), 'pipeline', 'cache', 'last_updated.json')
    const data = await readFile(cachePath, 'utf-8')
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch {
    return Response.json({ error: 'Last updated data not available' }, { status: 404 })
  }
}
