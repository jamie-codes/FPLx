/**
 * FPL session-cookie helper.
 * Per D-02: credentials are never stored. This file only handles the
 * pl_profile session cookie value — not credentials.
 */

const DEFAULT_MAX_AGE = 60 * 60 * 24 * 7  // 7 days in seconds

/**
 * Extracts the pl_profile session cookie from an array of Set-Cookie header values.
 *
 * FPL's login endpoint returns multiple Set-Cookie headers on success (pl_profile,
 * csrftoken, sessionid, etc.). The caller should pass all Set-Cookie header values
 * from the response (via headers.getAll?.('set-cookie') or a single-element fallback).
 *
 * Returns { value, maxAge } for the pl_profile cookie, or null if not found.
 * Treats an empty pl_profile value as not found (invalid response).
 *
 * @param setCookieHeaders - Array of Set-Cookie header strings
 */
export function extractPlProfile(
  setCookieHeaders: string[]
): { value: string; maxAge: number } | null {
  for (const header of setCookieHeaders) {
    if (!header) continue

    const parts = header.split(';').map(s => s.trim())
    const nameVal = parts[0]

    if (!nameVal.startsWith('pl_profile=')) continue

    const value = nameVal.slice('pl_profile='.length)

    // Treat empty value as invalid — cookie exists but has no session data
    if (!value) continue

    const maxAgePart = parts
      .slice(1)
      .find(d => d.toLowerCase().startsWith('max-age='))

    const maxAge = maxAgePart
      ? parseInt(maxAgePart.split('=')[1], 10)
      : DEFAULT_MAX_AGE

    return { value, maxAge }
  }

  return null
}
