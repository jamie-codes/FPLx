import { cookies } from 'next/headers'

/**
 * POST /api/auth/logout
 *
 * Clears the fpl_session HttpOnly cookie, ending the FPL session (D-03).
 * Setting maxAge: 0 is the recommended Next.js pattern for cookie expiry.
 */
export async function POST() {
  const cookieStore = await cookies()
  cookieStore.set('fpl_session', '', { maxAge: 0, path: '/' })
  return Response.json({ ok: true })
}
