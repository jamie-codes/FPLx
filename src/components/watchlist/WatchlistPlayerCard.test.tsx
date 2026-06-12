// @vitest-environment jsdom
// Phase 127 WATCH-02: WatchlistPlayerCard component tests.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { MergedPlayer } from '@/lib/types'
import { WatchlistPlayerCard } from './WatchlistPlayerCard'

function makePlayer(overrides: Partial<MergedPlayer> = {}): MergedPlayer {
  return {
    id: 1,
    web_name: 'Salah',
    element_type: 3,
    team: 14,
    team_short_name: 'LIV',
    now_cost: 130,
    selected_by_percent: '42.5',
    cost_change_event: 0,
    cost_change_start: 0,
    form: '8.5',
    status: 'a',
    minutes: 2700,
    starts: 30,
    total_points: 220,
    goals_scored: 18,
    assists: 12,
    expected_goals: 15.3,
    expected_assists: 10.1,
    pts_last3gw: 18,
    pts_last5gw: 28,
    pts_gw_count: 5,
    defensive_contribution: null,
    clearances_blocks_interceptions: null,
    direct_freekicks_order: null,
    penalties_order: null,
    corners_and_indirect_freekicks_order: null,
    penalties_text: '',
    direct_freekicks_text: '',
    corners_and_indirect_freekicks_text: '',
    news: '',
    xmins: 80,
    start_prob: 0.97,
    mins_risk: 'nailed',
    minutes_per90: 85,
    form_pts_per90: 8.0,
    fixtures: [],
    gem_score: 5.0,
    fdr_score: 0.7,
    form_score: 0.9,
    xg_score: 0.6,
    xa_score: 0.4,
    ownership_score: 0.5,
    minutes_score: 0.9,
    set_piece_score: 0.0,
    understat_id: 100,
    xg_per90: 0.5,
    xa_per90: 0.3,
    xPts_1gw: 6.8,
    xPts_3gw: 18.0,
    xPts_5gw: 28.0,
    regression_signal: null,
    actual_vs_xg_delta: null,
    differential_flag: null,
    ...overrides,
  } as unknown as MergedPlayer
}

describe('WatchlistPlayerCard', () => {
  it('renders Departed pill and applies opacity-50 when departed=true', () => {
    const { container } = render(
      <WatchlistPlayerCard player={{ id: 99 }} departed={true} hasNews={false} inSquad={false} />
    )
    expect(container.textContent).toContain('Departed')
    expect(container.querySelector('.opacity-50')).not.toBeNull()
  })

  it('renders border-warning class on the outer div when hasNews=true && !departed', () => {
    const { container } = render(
      <WatchlistPlayerCard player={makePlayer()} departed={false} hasNews={true} inSquad={false} />
    )
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('border-warning')
  })

  it('renders the squad-overlap dot span when inSquad=true && !departed', () => {
    render(
      <WatchlistPlayerCard player={makePlayer()} departed={false} hasNews={false} inSquad={true} />
    )
    const dot = screen.getByLabelText('In your pre-season squad')
    expect(dot).not.toBeNull()
  })

  it('renders ▲ in green when cost_change_event > 0', () => {
    const { container } = render(
      <WatchlistPlayerCard player={makePlayer({ cost_change_event: 1 })} departed={false} hasNews={false} inSquad={false} />
    )
    expect(container.textContent).toContain('▲')
    const arrow = container.querySelector('.text-positive')
    expect(arrow).not.toBeNull()
  })

  it('renders ▼ in red when cost_change_event < 0', () => {
    const { container } = render(
      <WatchlistPlayerCard player={makePlayer({ cost_change_event: -1 })} departed={false} hasNews={false} inSquad={false} />
    )
    expect(container.textContent).toContain('▼')
    const arrow = container.querySelector('.text-negative')
    expect(arrow).not.toBeNull()
  })

  it('renders neither arrow when cost_change_event === 0', () => {
    const { container } = render(
      <WatchlistPlayerCard player={makePlayer({ cost_change_event: 0 })} departed={false} hasNews={false} inSquad={false} />
    )
    expect(container.textContent).not.toContain('▲')
    expect(container.textContent).not.toContain('▼')
  })

  it('renders normal state with line border and full opacity when all flags are false', () => {
    const { container } = render(
      <WatchlistPlayerCard player={makePlayer()} departed={false} hasNews={false} inSquad={false} />
    )
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('border-line')
    expect(card.className).not.toContain('opacity-50')
    expect(card.className).not.toContain('border-warning')
  })

  it('renders the ConfirmedSigningBadge when confirmedSigningTooltip is a non-empty string and departed=false', () => {
    render(
      <WatchlistPlayerCard
        player={makePlayer()}
        departed={false}
        hasNews={false}
        inSquad={false}
        confirmedSigningTooltip="Bruno Fernandes signs new contract · BBC"
      />
    )
    expect(screen.getByTestId('confirmed-signing-badge')).not.toBeNull()
  })

  it('does NOT render the badge when confirmedSigningTooltip is undefined', () => {
    render(
      <WatchlistPlayerCard player={makePlayer()} departed={false} hasNews={false} inSquad={false} />
    )
    expect(screen.queryByTestId('confirmed-signing-badge')).toBeNull()
  })

  it('does NOT render the badge when departed=true, even if a tooltip is passed', () => {
    render(
      <WatchlistPlayerCard
        player={{ id: 99 }}
        departed={true}
        hasNews={false}
        inSquad={false}
        confirmedSigningTooltip="Bruno Fernandes signs · BBC"
      />
    )
    expect(screen.queryByTestId('confirmed-signing-badge')).toBeNull()
  })
})
