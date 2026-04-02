import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { extractTokenExpiry } from '@/lib/fpl-auth'

/**
 * POST /api/auth/login
 *
 * Accepts a raw FPL Bearer token (the value of the x-api-authorization header
 * from any authenticated FPL API request). Validates it is a JWT, decodes the
 * exp claim, and stores it as an HttpOnly fpl_session cookie.
 *
 * How to get the token:
 *   1. Open fantasy.premierleague.com while logged in
 *   2. DevTools → Network → click any /api/ request
 *   3. Copy the x-api-authorization header value (the part after "Bearer ")
 *
 * The token is valid for 8 hours from FPL's login time.
 * Credentials are not involved — this stores the token only.
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token || typeof token !== 'string' || !token.trim()) {
      return Response.json({ error: 'Token required' }, { status: 400 })
    }

    const trimmed = token.trim().replace(/^Bearer\s+/i, '')

    const expiresAt = extractTokenExpiry(trimmed)
    if (expiresAt === null) {
      return Response.json({ error: 'Invalid token — must be a JWT' }, { status: 400 })
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    if (expiresAt <= nowSeconds) {
      return Response.json({ error: 'Token has already expired' }, { status: 400 })
    }

    const maxAge = expiresAt - nowSeconds

    const cookieStore = await cookies()
    cookieStore.set('fpl_session', trimmed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    })

    return Response.json({ ok: true, expiresAt })
  } catch (err) {
    console.error('[auth/login] caught error:', err)
    return Response.json(
      { error: 'Login failed', detail: String(err) },
      { status: 500 }
    )
  }
}
