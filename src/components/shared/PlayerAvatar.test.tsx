// @vitest-environment jsdom
// PHOTO-01 (2026-09-01): headshots lag transfers by up to two seasons on the
// Premier League CDN, so the avatar prefers the api-football photo AND always
// overlays the current club badge — the badge is live data, so the club stays
// unambiguous even when the kit in the photo is out of date.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayerAvatar } from './PlayerAvatar'

const AF = 'https://media.api-sports.io/football/players/19281.png'

describe('PlayerAvatar', () => {
  it('uses the api-football headshot when supplied', () => {
    render(<PlayerAvatar code={437730} webName="Semenyo" teamShortName="MCI" photoUrl={AF} />)
    expect(screen.getByAltText('Semenyo').getAttribute('src')).toBe(AF)
  })

  it('falls back to the Premier League photo when unmapped', () => {
    render(<PlayerAvatar code={437730} webName="Semenyo" teamShortName="MCI" />)
    expect(screen.getByAltText('Semenyo').getAttribute('src'))
      .toContain('resources.premierleague.com')
  })

  it('overlays the current club badge on the headshot', () => {
    const { container } = render(
      <PlayerAvatar code={437730} webName="Semenyo" teamShortName="MCI" photoUrl={AF} />)
    // TeamBadge renders an <img alt={shortName}> (or an initials fallback with
    // the same title) — either way the club must be present alongside the photo.
    const badge = container.querySelector('[alt="MCI"], [title="MCI"]')
    expect(badge).not.toBeNull()
  })

  it('still renders initials (and no photo) when the player has no code', () => {
    render(<PlayerAvatar code={undefined} webName="Alan Smith" teamShortName="MCI" />)
    expect(screen.getByText('AS')).toBeTruthy()
    expect(screen.queryByAltText('Alan Smith')).toBeNull()
  })
})
