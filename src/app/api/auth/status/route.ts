import { cookies } from 'next/headers'

/**
 * GET /api/auth/status
 *
 * Returns { isAuthenticated: boolean } — checked server-side since fpl_session
 * is HttpOnly and invisible to client JavaScript.
 *
 * Checks session?.value (not just session) to handle the edge case where the
 * cookie exists but was cleared with an empty value.
 */
export async function GET() {
  const cookieStore = await cookies()
  const session = cookieStore.get('fpl_session')
  return Response.json({ isAuthenticated: !!session?.value })
}
