import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { extractPlProfile } from '@/lib/fpl-auth'

/**
 * POST /api/auth/login
 *
 * Forwards FPL credentials to FPL's login endpoint server-side,
 * extracts the pl_profile session cookie, and mirrors it as an
 * HttpOnly fpl_session cookie on our domain (D-02).
 *
 * Credentials are strictly request-scoped — consumed once, never stored.
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return Response.json(
        { error: 'Email and password required' },
        { status: 400 }
      )
    }

    // Build form-encoded body per FPL login API convention
    const body = new URLSearchParams({
      login: email,
      password,
      app: 'plfpl-web',
      redirect_uri: 'https://fantasy.premierleague.com/a/login',
    })

    // CRITICAL: redirect: 'manual' — FPL returns 302 on success, not 200.
    // Without this, fetch follows the redirect and loses the Set-Cookie headers.
    const fplRes = await fetch('https://users.premierleague.com/accounts/login/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'fplx/1.0',
      },
      body: body.toString(),
      redirect: 'manual',
    })

    // Use getAll() for multiple Set-Cookie headers (Node 18+ undici fetch).
    // Safe fallback for environments where getAll is not available.
    const setCookieHeaders: string[] =
      (fplRes.headers as unknown as { getAll?: (name: string) => string[] }).getAll?.('set-cookie') ??
      [fplRes.headers.get('set-cookie') ?? '']

    const plProfile = extractPlProfile(setCookieHeaders)

    if (!plProfile) {
      return Response.json(
        { error: 'Invalid FPL credentials' },
        { status: 401 }
      )
    }

    // Mirror pl_profile as HttpOnly fpl_session on our domain (D-04)
    const cookieStore = await cookies()
    cookieStore.set('fpl_session', plProfile.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: plProfile.maxAge,
    })

    return Response.json({ ok: true })
  } catch (err) {
    return Response.json(
      { error: 'Login failed', detail: String(err) },
      { status: 502 }
    )
  }
}
