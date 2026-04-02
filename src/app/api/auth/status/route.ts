import { cookies } from 'next/headers'
import { extractTokenExpiry } from '@/lib/fpl-auth'

/**
 * GET /api/auth/status
 *
 * Returns { authenticated: boolean, expiresAt?: number } — checked server-side
 * since fpl_session is HttpOnly and invisible to client JavaScript.
 *
 * Treats an expired token the same as no token — returns authenticated: false.
 */
export async function GET() {
  const cookieStore = await cookies()
  const session = cookieStore.get('fpl_session')

  if (!session?.value) {
    return Response.json({ authenticated: false })
  }

  const expiresAt = extractTokenExpiry(session.value)
  const nowSeconds = Math.floor(Date.now() / 1000)

  if (expiresAt === null || expiresAt <= nowSeconds) {
    return Response.json({ authenticated: false })
  }

  return Response.json({ authenticated: true, expiresAt })
}
