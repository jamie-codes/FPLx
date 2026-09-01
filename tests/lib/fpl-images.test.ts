import { describe, it, expect } from 'vitest'
import { playerImageUrl, teamBadgeUrl, teamKitUrl } from '@/lib/fpl-images'

describe('fpl-images URL helpers', () => {
  it('playerImageUrl returns the canonical FPL player photo URL', () => {
    expect(playerImageUrl(12345)).toBe('https://resources.premierleague.com/premierleague/photos/players/110x140/p12345.png')
  })

  // PHOTO-01 (2026-09-01): the PL CDN shoot dates from Aug 2024, so anyone
  // transferred since wears their old club's kit. api-football re-shot those
  // players in Jul 2026, and the pipeline stamps that URL on as photo_url.
  describe('playerImageUrl photo_url preference', () => {
    const AF = 'https://media.api-sports.io/football/players/19281.png'

    it('prefers the api-football headshot when present', () => {
      expect(playerImageUrl(437730, AF)).toBe(AF)
    })

    it('falls back to the PL CDN when unmapped (null/undefined/empty)', () => {
      const pl = 'https://resources.premierleague.com/premierleague/photos/players/110x140/p437730.png'
      expect(playerImageUrl(437730, null)).toBe(pl)
      expect(playerImageUrl(437730, undefined)).toBe(pl)
      expect(playerImageUrl(437730, '')).toBe(pl)
    })
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
