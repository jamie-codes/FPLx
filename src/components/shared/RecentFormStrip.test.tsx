// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecentFormStrip } from './RecentFormStrip'
import type { RecentGw } from '@/lib/types'

const gw = (over: Partial<RecentGw> = {}): RecentGw => ({
  gw: 1, pts: 4, min: 90, opp: 'ARS', home: true, ...over,
})

describe('RecentFormStrip (LAST5-01)', () => {
  it('renders one chip per game, in the order played', () => {
    const { container } = render(
      <RecentFormStrip recentGws={[gw({ gw: 1, pts: 2 }), gw({ gw: 2, pts: 12 }), gw({ gw: 3, pts: 6 })]} />,
    )
    const chips = container.querySelectorAll('[data-testid="recent-form-strip"] > span')
    expect(Array.from(chips).map((c) => c.querySelector('span')!.textContent)).toEqual(['2', '12', '6'])
  })

  it('says so when the player has no games yet, rather than rendering nothing', () => {
    render(<RecentFormStrip recentGws={[]} />)
    expect(screen.getByText('No games yet')).toBeTruthy()
    // An artifact written before recent_gws shipped sends undefined.
    render(<RecentFormStrip recentGws={undefined} />)
    expect(screen.getAllByText('No games yet')).toHaveLength(2)
  })

  it('distinguishes a benched blank from a played blank', () => {
    const { container } = render(
      <RecentFormStrip recentGws={[gw({ pts: 0, min: 0 }), gw({ pts: 0, min: 78 })]} />,
    )
    const [unused, played] = Array.from(
      container.querySelectorAll('[data-testid="recent-form-strip"] > span'),
    )
    expect(unused.className).toContain('text-ink-muted')
    expect(unused.getAttribute('title')).toContain('did not play')
    expect(played.className).toContain('text-negative')
    expect(played.getAttribute('title')).toContain('78 mins')
  })

  it('marks away games by lower-casing the opponent, and spells it out in the tooltip', () => {
    const { container } = render(
      <RecentFormStrip recentGws={[gw({ opp: 'LIV', home: false }), gw({ opp: 'LIV', home: true })]} />,
    )
    const chips = Array.from(container.querySelectorAll('[data-testid="recent-form-strip"] > span'))
    expect(chips[0].textContent).toContain('liv')
    expect(chips[0].getAttribute('title')).toContain('(A)')
    expect(chips[1].textContent).toContain('LIV')
    expect(chips[1].getAttribute('title')).toContain('(H)')
  })

  it('handles history with no opponent recorded', () => {
    const { container } = render(<RecentFormStrip recentGws={[gw({ opp: null, home: null })]} />)
    const chip = container.querySelector('[data-testid="recent-form-strip"] > span')!
    expect(chip.textContent).toContain('?')
    expect(chip.getAttribute('title')).toBe('GW1 v ? — 4 pts, 90 mins')
  })
})
