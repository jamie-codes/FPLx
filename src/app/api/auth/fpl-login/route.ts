/*
 * Phase 130 — AUTH-05: Deliberate stub for the removed FPL credential OAuth flow.
 *
 * The users.premierleague.com credential endpoint no longer exists. This route
 * previously proxied email/password to that endpoint, causing 502 errors (AUTH-502).
 * It now returns a stable soft-failure code so any stale clients fall back gracefully
 * to the working token-paste flow (/api/auth/login).
 *
 * No body parsing, no outbound fetch, no cookie writes.
 */
export async function POST(): Promise<Response> {
  return Response.json({ ok: false, code: 'ENDPOINT_GONE' }, { status: 200 })
}
