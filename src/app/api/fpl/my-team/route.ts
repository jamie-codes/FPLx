import { cookies } from 'next/headers'
import { parseMyTeamResponse } from '@/lib/squad-adapter'

/**
 * GET /api/fpl/my-team
 *
 * Proxies FPL's authenticated /api/my-team/ endpoint using the fpl_session
 * HttpOnly cookie set by /api/auth/login.
 *
 * Returns validated MyTeamResponse with picks (including selling_price)
 * and entry_history (including exact bank balance).
 *
 * No caching — squad data changes and must always be fresh (revalidate: 0).
 * Pitfall 4: sends Cookie: pl_profile=<value>, not Authorization header.
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('fpl_session')

    if (!session?.value) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const res = await fetch('https://fantasy.premierleague.com/api/my-team/', {
      headers: {
        'User-Agent': 'fplx/1.0',
        'Cookie': `pl_profile=${session.value}`,
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      return Response.json(
        { error: 'FPL my-team fetch failed', status: res.status },
        { status: res.status }
      )
    }

    const data = await res.json()
    const parsed = parseMyTeamResponse(data)

    if (!parsed.success) {
      return Response.json(
        { error: 'Unexpected my-team response shape' },
        { status: 502 }
      )
    }

    return Response.json(parsed.data)
  } catch (err) {
    return Response.json(
      { error: 'My-team fetch failed', detail: String(err) },
      { status: 502 }
    )
  }
}
