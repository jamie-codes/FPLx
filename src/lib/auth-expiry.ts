export type AuthExpiryState = 'normal' | 'expiring-soon' | 'expired'

/**
 * Computes the expiry state of an FPL auth token.
 *
 * @param expiresAt - Unix timestamp (seconds) when the token expires, or undefined if no token
 * @param nowSeconds - Current Unix timestamp in seconds
 * @returns 'normal' if > 1hr remaining, 'expiring-soon' if 15min–1hr, 'expired' if < 15min or no token
 */
export function computeAuthExpiryState(
  expiresAt: number | undefined,
  nowSeconds: number
): AuthExpiryState {
  if (expiresAt === undefined) return 'expired'
  const remaining = expiresAt - nowSeconds
  if (remaining >= 3600) return 'normal'
  if (remaining >= 900) return 'expiring-soon'
  return 'expired'
}
