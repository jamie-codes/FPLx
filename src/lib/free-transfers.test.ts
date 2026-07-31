import { describe, it, expect } from 'vitest'
import { deriveFreeTransfers } from './free-transfers'
import type { MyTeamResponse } from './squad-adapter'

const mt = (event_transfers: number) =>
  ({ entry_history: { event_transfers } }) as unknown as MyTeamResponse

describe('deriveFreeTransfers', () => {
  it('returns 1 without a team (unauthenticated)', () => {
    expect(deriveFreeTransfers(null, null)).toBe(1)
    expect(deriveFreeTransfers(undefined, null)).toBe(1)
  })

  it('banks to 2 when no transfers were made last GW', () => {
    expect(deriveFreeTransfers(mt(0), null)).toBe(2)
  })

  it('is 1 when one or more transfers were made', () => {
    expect(deriveFreeTransfers(mt(1), null)).toBe(1)
    expect(deriveFreeTransfers(mt(2), null)).toBe(1)
  })

  it('is 1 during wildcard / free hit regardless of transfers', () => {
    expect(deriveFreeTransfers(mt(0), 'wildcard')).toBe(1)
    expect(deriveFreeTransfers(mt(0), 'freehit')).toBe(1)
  })
})
