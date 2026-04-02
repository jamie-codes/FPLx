/**
 * FPL JWT Bearer token helper.
 * Decodes the exp claim from the JWT payload without signature verification —
 * this is server-side only; we trust the token was obtained from FPL's own UI.
 */

/**
 * Extracts the expiry timestamp (Unix seconds) from a JWT Bearer token string.
 * Returns null if the input is not a valid 3-part JWT or has no numeric exp claim.
 */
export function extractTokenExpiry(token: string): number | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    // JWT payload is base64url — convert to standard base64 and pad
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'))
    return typeof decoded.exp === 'number' ? decoded.exp : null
  } catch {
    return null
  }
}
