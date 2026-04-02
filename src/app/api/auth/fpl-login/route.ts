import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { extractTokenExpiry } from '@/lib/fpl-auth'

/**
 * POST /api/auth/fpl-login
 *
 * Accepts { email, password } and attempts to authenticate with FPL's login
 * endpoint, then extracts the Bearer JWT from the response.
 *
 * FPL migrated to OAuth 2.0 — the Bearer token is issued by their identity
 * platform after the credential login. We attempt to retrieve it server-side
 * by following the login flow and inspecting response cookies/headers.
 *
 * Returns:
 *   { ok: true, expiresAt }         — token stored, auth complete
 *   { ok: false, code: 'NO_TOKEN' } — credentials valid but token unreachable
 *                                     (FPL auth flow changed) — fall back to manual
 *   400 / 401 / 500                 — bad input or FPL rejected the credentials
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body ?? {}

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return Response.json({ error: 'Email and password required' }, { status: 400 })
    }

    // Step 1: POST credentials to FPL's login endpoint
    const loginRes = await fetch('https://users.premierleague.com/accounts/login/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://fantasy.premierleague.com',
        'Referer': 'https://fantasy.premierleague.com/',
      },
      body: new URLSearchParams({
        login: email.trim(),
        password,
        app: 'plfpl-web',
        redirect_uri: 'https://fantasy.premierleague.com/a/login',
      }).toString(),
      redirect: 'follow',
    })

    if (!loginRes.ok) {
      return Response.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Step 2: Collect cookies from the login response
    const setCookies = loginRes.headers.getSetCookie?.() ?? []
    const cookieString = setCookies.map(c => c.split(';')[0]).join('; ')

    // Check if any cookie value is itself a JWT (some FPL auth flows embed it)
    let bearerToken: string | null = null
    for (const cookie of setCookies) {
      const [nameVal] = cookie.split(';')
      const eqIdx = nameVal.indexOf('=')
      if (eqIdx === -1) continue
      const val = decodeURIComponent(nameVal.slice(eqIdx + 1).trim())
      if (extractTokenExpiry(val) !== null) {
        bearerToken = val
        break
      }
    }

    // Step 3: If no JWT in cookies, probe /api/me/ — some FPL builds return
    // x-api-authorization in the response headers after cookie auth
    if (!bearerToken && cookieString) {
      const meRes = await fetch('https://fantasy.premierleague.com/api/me/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Cookie: cookieString,
        },
      })

      const authHeader = meRes.headers.get('x-api-authorization')
      if (authHeader) {
        bearerToken = authHeader.replace(/^Bearer\s+/i, '')
      }
    }

    // Step 4: Token not reachable server-side — FPL's OAuth flow requires
    // client-side JS to complete the token exchange. Tell the client to fall
    // back to manual entry (but credentials are confirmed valid).
    if (!bearerToken) {
      return Response.json({ ok: false, code: 'NO_TOKEN' }, { status: 200 })
    }

    // Step 5: Validate and store the token
    const expiresAt = extractTokenExpiry(bearerToken)
    if (expiresAt === null) {
      return Response.json({ error: 'Unexpected token format from FPL' }, { status: 502 })
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    if (expiresAt <= nowSeconds) {
      return Response.json({ error: 'Token from FPL has already expired' }, { status: 401 })
    }

    const cookieStore = await cookies()
    cookieStore.set('fpl_session', bearerToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: expiresAt - nowSeconds,
    })

    return Response.json({ ok: true, expiresAt })
  } catch (err) {
    console.error('[auth/fpl-login] caught error:', err)
    return Response.json({ error: 'Login failed', detail: String(err) }, { status: 500 })
  }
}
