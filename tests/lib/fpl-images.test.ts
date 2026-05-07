import { describe, it, expect } from 'vitest'
import { playerImageUrl, teamBadgeUrl, teamKitUrl } from '@/lib/fpl-images'

describe('fpl-images URL helpers', () => {
  it('playerImageUrl returns the canonical FPL player photo URL', () => {
    expect(playerImageUrl(12345)).toBe('https://resources.premierleague.com/premierleague/photos/players/110x140/p12345.png')
  })

  it('teamBadgeUrl returns the canonical PL badge URL', () => {
    expect(teamBadgeUrl(3)).toBe('https://resources.premierleague.com/premierleague/badges/t3.png')
  })

  describe('teamKitUrl', () => {
    it('returns the standard 66px kit URL for Arsenal (code 3)', () => {
      expect(teamKitUrl(3)).toBe('https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_3-66.png')
    })
    it('returns the standard 66px kit URL for Liverpool (code 14)', () => {
      expect(teamKitUrl(14)).toBe('https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_14-66.png')
    })
    it('returns the standard 66px kit URL for Man City (code 43)', () => {
      expect(teamKitUrl(43)).toBe('https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_43-66.png')
    })
  })
})
