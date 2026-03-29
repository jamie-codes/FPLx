import { readFile } from 'fs/promises'
import { join } from 'path'
import { computeClubForm } from '@/lib/club-form'

export async function GET() {
  try {
    const cachePath = join(process.cwd(), 'pipeline', 'cache')
    const [fixturesRaw, bootstrapRaw] = await Promise.all([
      readFile(join(cachePath, 'fpl_fixtures.json'), 'utf-8'),
      readFile(join(cachePath, 'fpl_bootstrap.json'), 'utf-8'),
    ])
    const fixtures = JSON.parse(fixturesRaw)
    const bootstrap = JSON.parse(bootstrapRaw)
    const data = computeClubForm({ teams: bootstrap.teams }, fixtures)
    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    return Response.json({ error: 'Club form data not available' }, { status: 404 })
  }
}
