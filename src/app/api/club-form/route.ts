import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { computeClubForm } from '@/lib/club-form'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let fixturesRaw: string
    let bootstrapRaw: string

    if (USE_BLOB) {
      const [fixturesResult, bootstrapResult] = await Promise.all([
        list({ prefix: 'fpl_fixtures.json', limit: 1 }),
        list({ prefix: 'fpl_bootstrap.json', limit: 1 }),
      ])
      if (!fixturesResult.blobs.length || !bootstrapResult.blobs.length) {
        return Response.json({ error: 'Club form data not available' }, { status: 404 })
      }
      const [fixturesRes, bootstrapRes] = await Promise.all([
        fetch(fixturesResult.blobs[0].url),
        fetch(bootstrapResult.blobs[0].url),
      ])
      ;[fixturesRaw, bootstrapRaw] = await Promise.all([fixturesRes.text(), bootstrapRes.text()])
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache')
      ;[fixturesRaw, bootstrapRaw] = await Promise.all([
        readFile(join(cachePath, 'fpl_fixtures.json'), 'utf-8'),
        readFile(join(cachePath, 'fpl_bootstrap.json'), 'utf-8'),
      ])
    }

    const fixtures = JSON.parse(fixturesRaw)
    const bootstrap = JSON.parse(bootstrapRaw)
    const data = computeClubForm({ teams: bootstrap.teams }, fixtures)

    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Failed to serve club form:', error)
    return Response.json({ error: 'Club form data not available' }, { status: 500 })
  }
}
