import { describe, it, expect } from 'vitest'
import { computeAuthExpiryState } from '@/lib/auth-expiry'

describe('computeAuthExpiryState', () => {
  const NOW = 1000000

  it('returns expired when expiresAt is undefined', () => {
    expect(computeAuthExpiryState(undefined, NOW)).toBe('expired')
  })

  it('returns normal when token has more than 1hr remaining', () => {
    // expiresAt - now > 3600 => normal
    expect(computeAuthExpiryState(NOW + 3601, NOW)).toBe('normal')
  })

  it('returns normal when token has exactly 1hr remaining (boundary)', () => {
    // expiresAt - now === 3600 => normal (>= 3600)
    expect(computeAuthExpiryState(NOW + 3600, NOW)).toBe('normal')
  })

  it('returns expiring-soon when token has just under 1hr remaining', () => {
    // expiresAt - now === 3599 => expiring-soon
    expect(computeAuthExpiryState(NOW + 3599, NOW)).toBe('expiring-soon')
  })

  it('returns expiring-soon when token has exactly 15min remaining (boundary)', () => {
    // expiresAt - now === 900 => expiring-soon (>= 900)
    expect(computeAuthExpiryState(NOW + 900, NOW)).toBe('expiring-soon')
  })

  it('returns expired when token has just under 15min remaining', () => {
    // expiresAt - now === 899 => expired (< 900)
    expect(computeAuthExpiryState(NOW + 899, NOW)).toBe('expired')
  })

  it('returns expired when token has exactly 0 seconds remaining', () => {
    // expiresAt - now === 0 => expired
    expect(computeAuthExpiryState(NOW, NOW)).toBe('expired')
  })

  it('returns expired when token has already expired (negative remaining)', () => {
    // expiresAt - now < 0 => expired
    expect(computeAuthExpiryState(NOW - 1, NOW)).toBe('expired')
  })
})
