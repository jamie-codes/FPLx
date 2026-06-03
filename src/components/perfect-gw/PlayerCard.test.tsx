// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayerCard } from './PlayerCard'
import type { FPLElementRaw } from '@/lib/fpl-adapter'
import type { FPLTeam } from '@/lib/types'

const salah: FPLElementRaw = {
  id: 1, code: 1, web_name: 'Salah', team: 10, element_type: 3,
  now_cost: 132, selected_by_percent: '40.0', form: '8.0', status: 'a',
  minutes: 90, starts: 1, defensive_contribution: null,
  defensive_contribution_per_90: null, clearances_blocks_interceptions: null,
  direct_freekicks_order: null, penalties_order: null,
  corners_and_indirect_freekicks_order: null, news: '',
}

const liverpool: FPLTeam = { id: 10, name: 'Liverpool', short_name: 'LIV', code: 14 }

describe('PlayerCard', () => {
  it('renders player name, points, and price', () => {
    render(
      <PlayerCard player={salah} points={18} team={liverpool} isCapt={false} />
    )
    expect(screen.getByText('Salah')).toBeTruthy()
    expect(screen.getByText('18')).toBeTruthy()
    expect(screen.getByText('£13.2m')).toBeTruthy()
  })

  it('renders club short name pill', () => {
    render(
      <PlayerCard player={salah} points={18} team={liverpool} isCapt={false} />
    )
    expect(screen.getByText('LIV')).toBeTruthy()
  })

  it('does not render CAPT badge when isCapt=false', () => {
    render(
      <PlayerCard player={salah} points={18} team={liverpool} isCapt={false} />
    )
    expect(screen.queryByText('CAPT')).toBeNull()
  })

  it('renders CAPT badge when isCapt=true', () => {
    render(
      <PlayerCard player={salah} points={18} team={liverpool} isCapt={true} />
    )
    expect(screen.getByText('CAPT')).toBeTruthy()
  })

  it('formats price correctly: now_cost 132 → £13.2m', () => {
    render(
      <PlayerCard player={salah} points={18} team={liverpool} isCapt={false} />
    )
    expect(screen.getByText('£13.2m')).toBeTruthy()
  })

  it('formats price correctly: now_cost 45 → £4.5m', () => {
    const cheapPlayer = { ...salah, now_cost: 45 }
    render(
      <PlayerCard player={cheapPlayer} points={3} team={liverpool} isCapt={false} />
    )
    expect(screen.getByText('£4.5m')).toBeTruthy()
  })

  it('renders outfield shirt image with FPL CDN src using team code', () => {
    render(
      <PlayerCard player={salah} points={18} team={liverpool} isCapt={false} />
    )
    // salah element_type=3 (MID) → outfield shirt URL with code 14
    const img = document.querySelector('img[alt="LIV kit"]') as HTMLImageElement
    expect(img).toBeTruthy()
    expect(img.src).toContain('shirt_14-66.png')
    expect(img.src).not.toContain('shirt_14_1-66.png')
  })

  it('renders GK shirt URL when element_type=1', () => {
    const gk = { ...salah, element_type: 1 }
    render(
      <PlayerCard player={gk} points={6} team={liverpool} isCapt={false} />
    )
    const img = document.querySelector('img[alt="LIV kit"]') as HTMLImageElement
    expect(img).toBeTruthy()
    expect(img.src).toContain('shirt_14_1-66.png')
  })
})
