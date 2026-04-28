// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FixtureEaseRankingPanel } from '@/components/club-form/FixtureEaseRankingPanel'
import type { ClubForm } from '@/lib/types'

// Mock useClubForm — controls the data the panel receives.
let mockState: { data: ClubForm[] | undefined; isLoading: boolean; error: unknown } = {
  data: undefined,
  isLoading: false,
  error: null,
}
vi.mock('@/lib/hooks/useClubForm', () => ({
  useClubForm: () => mockState,
}))

function makeTeam(partial: Partial<ClubForm> & Pick<ClubForm, 'team_id' | 'team_short_name'>): ClubForm {
  return {
    team_id: partial.team_id,
    team_name: partial.team_short_name,
    team_short_name: partial.team_short_name,
    wins: 0, draws: 0, losses: 0,
    goals_scored: 0, goals_conceded: 0,
    upcoming_fixtures: [],
    attacking_ease_1gw: partial.attacking_ease_1gw ?? null,
    attacking_ease_3gw: partial.attacking_ease_3gw ?? null,
    attacking_ease_5gw: partial.attacking_ease_5gw ?? null,
    defensive_ease_1gw: partial.defensive_ease_1gw ?? null,
    defensive_ease_3gw: partial.defensive_ease_3gw ?? null,
    defensive_ease_5gw: partial.defensive_ease_5gw ?? null,
  }
}

describe('FixtureEaseRankingPanel', () => {
  it('renders the heading "Fixture Ease Ranking"', () => {
    mockState = {
      isLoading: false,
      error: null,
      data: [
        makeTeam({ team_id: 1, team_short_name: 'ARS', attacking_ease_3gw: 0.7 }),
      ],
    }
    render(<FixtureEaseRankingPanel />)
    expect(screen.getByText('Fixture Ease Ranking')).toBeTruthy()
  })

  it('default toggles: ATT pressed, 3 GW pressed', () => {
    mockState = {
      isLoading: false,
      error: null,
      data: [makeTeam({ team_id: 1, team_short_name: 'ARS', attacking_ease_3gw: 0.7 })],
    }
    render(<FixtureEaseRankingPanel />)
    const att = screen.getByRole('button', { name: 'ATT' })
    const def = screen.getByRole('button', { name: 'DEF' })
    expect(att.getAttribute('aria-pressed')).toBe('true')
    expect(def.getAttribute('aria-pressed')).toBe('false')
    const threeGw = screen.getByRole('button', { name: '3 GW' })
    expect(threeGw.getAttribute('aria-pressed')).toBe('true')
  })

  it('sorts rows by attacking_ease_3gw descending (easiest first)', () => {
    mockState = {
      isLoading: false,
      error: null,
      data: [
        makeTeam({ team_id: 1, team_short_name: 'ARS', attacking_ease_3gw: 0.4 }),
        makeTeam({ team_id: 2, team_short_name: 'CHE', attacking_ease_3gw: 0.9 }),
        makeTeam({ team_id: 3, team_short_name: 'BUR', attacking_ease_3gw: 0.1 }),
      ],
    }
    render(<FixtureEaseRankingPanel />)
    const rows = screen.getAllByTestId(/^ease-row-/)
    expect(rows.length).toBe(3)
    expect(rows[0].getAttribute('data-testid')).toBe('ease-row-CHE')
    expect(rows[1].getAttribute('data-testid')).toBe('ease-row-ARS')
    expect(rows[2].getAttribute('data-testid')).toBe('ease-row-BUR')
  })

  it('filters out teams with null attacking_ease_3gw (BGW)', () => {
    mockState = {
      isLoading: false,
      error: null,
      data: [
        makeTeam({ team_id: 1, team_short_name: 'ARS', attacking_ease_3gw: 0.5 }),
        makeTeam({ team_id: 2, team_short_name: 'CHE', attacking_ease_3gw: null }), // BGW
      ],
    }
    render(<FixtureEaseRankingPanel />)
    expect(screen.queryByTestId('ease-row-CHE')).toBeNull()
    expect(screen.getByTestId('ease-row-ARS')).toBeTruthy()
  })

  it('clicking DEF re-sorts by defensive_ease_3gw and presses DEF', () => {
    mockState = {
      isLoading: false,
      error: null,
      data: [
        makeTeam({
          team_id: 1, team_short_name: 'ARS',
          attacking_ease_3gw: 0.9,  // top in ATT
          defensive_ease_3gw: 0.1,  // bottom in DEF
        }),
        makeTeam({
          team_id: 2, team_short_name: 'CHE',
          attacking_ease_3gw: 0.1,  // bottom in ATT
          defensive_ease_3gw: 0.9,  // top in DEF
        }),
      ],
    }
    render(<FixtureEaseRankingPanel />)
    // Pre-click: ATT mode → ARS first
    let rows = screen.getAllByTestId(/^ease-row-/)
    expect(rows[0].getAttribute('data-testid')).toBe('ease-row-ARS')
    // Click DEF
    fireEvent.click(screen.getByRole('button', { name: 'DEF' }))
    rows = screen.getAllByTestId(/^ease-row-/)
    expect(rows[0].getAttribute('data-testid')).toBe('ease-row-CHE')
    expect(screen.getByRole('button', { name: 'DEF' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'ATT' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('clicking 5 GW re-sorts by attacking_ease_5gw (mode unchanged)', () => {
    mockState = {
      isLoading: false,
      error: null,
      data: [
        makeTeam({
          team_id: 1, team_short_name: 'ARS',
          attacking_ease_3gw: 0.9, attacking_ease_5gw: 0.1,
        }),
        makeTeam({
          team_id: 2, team_short_name: 'CHE',
          attacking_ease_3gw: 0.1, attacking_ease_5gw: 0.9,
        }),
      ],
    }
    render(<FixtureEaseRankingPanel />)
    let rows = screen.getAllByTestId(/^ease-row-/)
    expect(rows[0].getAttribute('data-testid')).toBe('ease-row-ARS')
    fireEvent.click(screen.getByRole('button', { name: '5 GW' }))
    rows = screen.getAllByTestId(/^ease-row-/)
    expect(rows[0].getAttribute('data-testid')).toBe('ease-row-CHE')
  })

  it('shows loading state', () => {
    mockState = { isLoading: true, error: null, data: undefined }
    render(<FixtureEaseRankingPanel />)
    expect(screen.getByText(/Loading fixture ease/i)).toBeTruthy()
  })

  it('shows error state', () => {
    mockState = { isLoading: false, error: new Error('boom'), data: undefined }
    render(<FixtureEaseRankingPanel />)
    expect(screen.getByText(/Failed to load fixture ease/i)).toBeTruthy()
  })
})
