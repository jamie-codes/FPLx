import { cookies } from 'next/headers'
import { parseMyTeamResponse } from '@/lib/squad-adapter'

/**
 * GET /api/fpl/my-team
 *
 * Proxies FPL's authenticated /api/my-team/ endpoint using the fpl_session
 * HttpOnly cookie set by /api/auth/login.
 *
 * Forwards the stored JWT as x-api-authorization: Bearer <token> — the auth
 * mechanism FPL uses since migrating from cookie-based sessions to OAuth 2.0.
 *
 * No caching — squad data must always be fresh (revalidate: 0).
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
        'User-Agent': 'Mozilla/5.0 (compatible; fplx/1.0)',
        'x-api-authorization': `Bearer ${session.value}`,
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
