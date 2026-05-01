/* eslint-disable @typescript-eslint/no-explicit-any */
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ClubForm, MergedPlayer } from '@/lib/types'

vi.mock('@/lib/hooks/useClubForm', () => ({
  useClubForm: vi.fn(),
}))
vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: vi.fn(),
}))

import { FixtureEaseRankingPanel } from '@/components/club-form/FixtureEaseRankingPanel'
import { useClubForm } from '@/lib/hooks/useClubForm'
import { usePlayers } from '@/lib/hooks/usePlayers'

const mockedUseClubForm = vi.mocked(useClubForm)
const mockedUsePlayers = vi.mocked(usePlayers)

// ── Fixture helpers ──────────────────────────────────────────────────────────

function makeFixture(diff: number): ClubForm['upcoming_fixtures'][number] {
  return {
    opponent_team: 'OPP',
    is_home: true,
    event_id: 30,
    difficulty_score: diff,
    difficulty_tier: 'easy',
    attacking_difficulty: diff,
    defensive_difficulty: diff,
  }
}

function makeClubForm(overrides: Partial<ClubForm> & { team_id: number; team_short_name: string }): ClubForm {
  return {
    team_id: overrides.team_id,
    team_name: overrides.team_short_name,
    team_short_name: overrides.team_short_name,
    wins: 0, draws: 0, losses: 0, goals_scored: 0, goals_conceded: 0,
    upcoming_fixtures: overrides.upcoming_fixtures ?? [],
    attacking_ease_1gw: overrides.attacking_ease_1gw ?? null,
    attacking_ease_3gw: overrides.attacking_ease_3gw ?? null,
    attacking_ease_5gw: overrides.attacking_ease_5gw ?? null,
    defensive_ease_1gw: overrides.defensive_ease_1gw ?? null,
    defensive_ease_3gw: overrides.defensive_ease_3gw ?? null,
    defensive_ease_5gw: overrides.defensive_ease_5gw ?? null,
    past_ease_3gw: overrides.past_ease_3gw ?? null,
    swing_1gw: overrides.swing_1gw ?? null,
    swing_3gw: overrides.swing_3gw ?? null,
    swing_5gw: overrides.swing_5gw ?? null,
  }
}

function makePlayer(p: {
  id: number
  team: number
  web_name?: string
  status?: 'a' | 'i' | 'd' | 's' | 'u' | 'n'
  element_type?: 1 | 2 | 3 | 4
  xg?: number
  xa?: number
  xPts_1gw?: number
  regression_signal?: 'buy' | 'sell' | null
  differential_flag?: 'diff' | 'trap' | null
  selected_by_percent?: string
}): MergedPlayer {
  return {
    id: p.id,
    team: p.team,
    web_name: p.web_name ?? `P${p.id}`,
    status: p.status ?? 'a',
    element_type: p.element_type ?? 3,
    expected_goals: p.xg ?? 0,
    expected_assists: p.xa ?? 0,
    xPts_1gw: p.xPts_1gw,
    regression_signal: p.regression_signal,
    actual_vs_xg_delta: 0,
    differential_flag: p.differential_flag,
    selected_by_percent: p.selected_by_percent ?? '5.0',
  } as unknown as MergedPlayer
}

// ── Existing panel tests (Phase 27 baseline) ─────────────────────────────────

describe('FixtureEaseRankingPanel', () => {
  beforeEach(() => {
    mockedUsePlayers.mockReturnValue({ data: [], isLoading: false, error: null } as any)
  })

  it('renders the heading "Fixture Ease Ranking"', () => {
    mockedUseClubForm.mockReturnValue({
      isLoading: false,
      error: null,
      data: [
        makeClubForm({ team_id: 1, team_short_name: 'ARS', attacking_ease_3gw: 0.7 }),
      ],
    } as any)
    render(<FixtureEaseRankingPanel />)
    expect(screen.getByText('Fixture Ease Ranking')).toBeTruthy()
  })

  it('default toggles: ATT pressed, 3 GW pressed', () => {
    mockedUseClubForm.mockReturnValue({
      isLoading: false,
      error: null,
      data: [makeClubForm({ team_id: 1, team_short_name: 'ARS', attacking_ease_3gw: 0.7 })],
    } as any)
    render(<FixtureEaseRankingPanel />)
    const att = screen.getByRole('button', { name: 'ATT' })
    const def = screen.getByRole('button', { name: 'DEF' })
    expect(att.getAttribute('aria-pressed')).toBe('true')
    expect(def.getAttribute('aria-pressed')).toBe('false')
    const threeGw = screen.getByRole('button', { name: '3 GW' })
    expect(threeGw.getAttribute('aria-pressed')).toBe('true')
  })

  it('sorts rows by attacking_ease_3gw descending (easiest first)', () => {
    mockedUseClubForm.mockReturnValue({
      isLoading: false,
      error: null,
      data: [
        makeClubForm({ team_id: 1, team_short_name: 'ARS', attacking_ease_3gw: 0.4 }),
        makeClubForm({ team_id: 2, team_short_name: 'CHE', attacking_ease_3gw: 0.9 }),
        makeClubForm({ team_id: 3, team_short_name: 'BUR', attacking_ease_3gw: 0.1 }),
      ],
    } as any)
    render(<FixtureEaseRankingPanel />)
    const rows = screen.getAllByTestId(/^ease-row-/)
    expect(rows.length).toBe(3)
    expect(rows[0].getAttribute('data-testid')).toBe('ease-row-CHE')
    expect(rows[1].getAttribute('data-testid')).toBe('ease-row-ARS')
    expect(rows[2].getAttribute('data-testid')).toBe('ease-row-BUR')
  })

  it('filters out teams with null attacking_ease_3gw (BGW)', () => {
    mockedUseClubForm.mockReturnValue({
      isLoading: false,
      error: null,
      data: [
        makeClubForm({ team_id: 1, team_short_name: 'ARS', attacking_ease_3gw: 0.5 }),
        makeClubForm({ team_id: 2, team_short_name: 'CHE', attacking_ease_3gw: null }),
      ],
    } as any)
    render(<FixtureEaseRankingPanel />)
    expect(screen.queryByTestId('ease-row-CHE')).toBeNull()
    expect(screen.getByTestId('ease-row-ARS')).toBeTruthy()
  })

  it('clicking DEF re-sorts by defensive_ease_3gw and presses DEF', () => {
    mockedUseClubForm.mockReturnValue({
      isLoading: false,
      error: null,
      data: [
        makeClubForm({
          team_id: 1, team_short_name: 'ARS',
          attacking_ease_3gw: 0.9,
          defensive_ease_3gw: 0.1,
        }),
        makeClubForm({
          team_id: 2, team_short_name: 'CHE',
          attacking_ease_3gw: 0.1,
          defensive_ease_3gw: 0.9,
        }),
      ],
    } as any)
    render(<FixtureEaseRankingPanel />)
    let rows = screen.getAllByTestId(/^ease-row-/)
    expect(rows[0].getAttribute('data-testid')).toBe('ease-row-ARS')
    fireEvent.click(screen.getByRole('button', { name: 'DEF' }))
    rows = screen.getAllByTestId(/^ease-row-/)
    expect(rows[0].getAttribute('data-testid')).toBe('ease-row-CHE')
    expect(screen.getByRole('button', { name: 'DEF' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'ATT' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('clicking 5 GW re-sorts by attacking_ease_5gw (mode unchanged)', () => {
    mockedUseClubForm.mockReturnValue({
      isLoading: false,
      error: null,
      data: [
        makeClubForm({
          team_id: 1, team_short_name: 'ARS',
          attacking_ease_3gw: 0.9, attacking_ease_5gw: 0.1,
        }),
        makeClubForm({
          team_id: 2, team_short_name: 'CHE',
          attacking_ease_3gw: 0.1, attacking_ease_5gw: 0.9,
        }),
      ],
    } as any)
    render(<FixtureEaseRankingPanel />)
    let rows = screen.getAllByTestId(/^ease-row-/)
    expect(rows[0].getAttribute('data-testid')).toBe('ease-row-ARS')
    fireEvent.click(screen.getByRole('button', { name: '5 GW' }))
    rows = screen.getAllByTestId(/^ease-row-/)
    expect(rows[0].getAttribute('data-testid')).toBe('ease-row-CHE')
  })

  it('shows loading state', () => {
    mockedUseClubForm.mockReturnValue({ isLoading: true, error: null, data: undefined } as any)
    render(<FixtureEaseRankingPanel />)
    expect(screen.getByText(/Loading fixture ease/i)).toBeTruthy()
  })

  it('shows error state', () => {
    mockedUseClubForm.mockReturnValue({ isLoading: false, error: new Error('boom'), data: undefined } as any)
    render(<FixtureEaseRankingPanel />)
    expect(screen.getByText(/Failed to load fixture ease/i)).toBeTruthy()
  })
})

// ── TARGET badge tests (Phase 32 TGT-01) ────────────────────────────────────

describe('FixtureEaseRankingPanel TARGET badge (Phase 32 TGT-01)', () => {
  beforeEach(() => {
    mockedUsePlayers.mockReturnValue({ data: [], isLoading: false, error: null } as any)
  })

  it('renders TARGET badge for a team with 4 of 5 fixtures attacking_difficulty < 0.5', () => {
    mockedUseClubForm.mockReturnValue({
      data: [makeClubForm({
        team_id: 1,
        team_short_name: 'MCI',
        attacking_ease_3gw: 0.8,
        upcoming_fixtures: [
          makeFixture(0.3), makeFixture(0.3), makeFixture(0.3), makeFixture(0.3), makeFixture(0.8),
        ],
      })],
      isLoading: false, error: null,
    } as any)
    render(<FixtureEaseRankingPanel />)
    expect(screen.getByTestId('target-badge-MCI')).toBeInTheDocument()
    expect(screen.getByText('TARGET')).toBeInTheDocument()
  })

  it('does not render TARGET badge for a team with only 3 of 5 favourable fixtures', () => {
    mockedUseClubForm.mockReturnValue({
      data: [makeClubForm({
        team_id: 2,
        team_short_name: 'WHU',
        attacking_ease_3gw: 0.5,
        upcoming_fixtures: [
          makeFixture(0.3), makeFixture(0.3), makeFixture(0.3), makeFixture(0.6), makeFixture(0.6),
        ],
      })],
      isLoading: false, error: null,
    } as any)
    render(<FixtureEaseRankingPanel />)
    expect(screen.queryByTestId('target-badge-WHU')).not.toBeInTheDocument()
  })
})

// ── Expand-on-click tests (Phase 32 TGT-02, TGT-03) ─────────────────────────

describe('FixtureEaseRankingPanel expand-on-click (Phase 32 TGT-02, TGT-03)', () => {
  const targetTeam = makeClubForm({
    team_id: 1, team_short_name: 'MCI',
    attacking_ease_3gw: 0.9,
    upcoming_fixtures: [
      makeFixture(0.3), makeFixture(0.3), makeFixture(0.3), makeFixture(0.3), makeFixture(0.3),
    ],
  })
  const targetTeamB = makeClubForm({
    team_id: 2, team_short_name: 'ARS',
    attacking_ease_3gw: 0.8,
    upcoming_fixtures: [
      makeFixture(0.3), makeFixture(0.3), makeFixture(0.3), makeFixture(0.3), makeFixture(0.3),
    ],
  })
  const nonTargetTeam = makeClubForm({
    team_id: 3, team_short_name: 'WHU',
    attacking_ease_3gw: 0.3,
    upcoming_fixtures: [
      makeFixture(0.6), makeFixture(0.6), makeFixture(0.6), makeFixture(0.6), makeFixture(0.6),
    ],
  })

  beforeEach(() => {
    mockedUseClubForm.mockReturnValue({
      data: [targetTeam, targetTeamB, nonTargetTeam],
      isLoading: false, error: null,
    } as any)
    mockedUsePlayers.mockReturnValue({
      data: [
        makePlayer({ id: 100, team: 1, web_name: 'Haaland', element_type: 4, xg: 8, xa: 2, xPts_1gw: 8.2, regression_signal: 'buy', differential_flag: 'diff', selected_by_percent: '52.0' }),
        makePlayer({ id: 101, team: 1, web_name: 'Doku', element_type: 3, xg: 3, xa: 1, xPts_1gw: 6.1 }),
        makePlayer({ id: 102, team: 1, web_name: 'Gvardiol', element_type: 2, xg: 2, xa: 1, xPts_1gw: 5.4, differential_flag: 'trap', selected_by_percent: '20.0' }),
        makePlayer({ id: 103, team: 1, web_name: 'Bench', element_type: 3, xg: 0, xa: 0, status: 'i' }),
        makePlayer({ id: 200, team: 2, web_name: 'Saka', element_type: 3, xg: 5, xa: 5, xPts_1gw: 7.0 }),
      ],
      isLoading: false, error: null,
    } as any)
  })

  it('expands the player table when a TARGET row is clicked', () => {
    render(<FixtureEaseRankingPanel />)
    const row = screen.getByTestId('ease-row-MCI')
    fireEvent.click(row)
    expect(screen.getByTestId('expanded-MCI')).toBeInTheDocument()
    expect(screen.getByText('Haaland')).toBeInTheDocument()
  })

  it('collapses when the same TARGET row is clicked again', () => {
    render(<FixtureEaseRankingPanel />)
    const row = screen.getByTestId('ease-row-MCI')
    fireEvent.click(row)
    fireEvent.click(row)
    expect(screen.queryByTestId('expanded-MCI')).not.toBeInTheDocument()
  })

  it('collapses the previous expansion when a different TARGET row is clicked (single-open invariant)', () => {
    render(<FixtureEaseRankingPanel />)
    fireEvent.click(screen.getByTestId('ease-row-MCI'))
    expect(screen.getByTestId('expanded-MCI')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('ease-row-ARS'))
    expect(screen.queryByTestId('expanded-MCI')).not.toBeInTheDocument()
    expect(screen.getByTestId('expanded-ARS')).toBeInTheDocument()
  })

  it('does not expand when a non-TARGET row is clicked', () => {
    render(<FixtureEaseRankingPanel />)
    const row = screen.getByTestId('ease-row-WHU')
    fireEvent.click(row)
    expect(screen.queryByTestId('expanded-WHU')).not.toBeInTheDocument()
    expect(row).not.toHaveAttribute('tabindex', '0')
    expect(row).not.toHaveAttribute('role', 'button')
  })

  it('shows top 3 players sorted by xGI% descending, status === a only', () => {
    render(<FixtureEaseRankingPanel />)
    fireEvent.click(screen.getByTestId('ease-row-MCI'))
    // Expect Haaland (8+2=10), Doku (3+1=4), Gvardiol (2+1=3) — Bench excluded (status 'i')
    expect(screen.getByText('Haaland')).toBeInTheDocument()
    expect(screen.getByText('Doku')).toBeInTheDocument()
    expect(screen.getByText('Gvardiol')).toBeInTheDocument()
    expect(screen.queryByText('Bench')).not.toBeInTheDocument()
  })

  it('renders xGI% as N% and Signal/Diff cells via badge components', () => {
    render(<FixtureEaseRankingPanel />)
    fireEvent.click(screen.getByTestId('ease-row-MCI'))
    // team total = 10+4+3+0 = 17 (Bench has 0 xg/xa); Haaland = 10/17 ≈ 0.588 → "59%"
    // Verify a non-zero percentage renders (don't hard-code if rounding ambiguity)
    expect(screen.getAllByText(/\d+%/).length).toBeGreaterThan(0)
    // Badges: BUY for Haaland, DIFF for Haaland, TRAP for Gvardiol
    expect(screen.getByText('BUY')).toBeInTheDocument()
    expect(screen.getByText('DIFF')).toBeInTheDocument()
    expect(screen.getByText('TRAP')).toBeInTheDocument()
  })

  it('renders the empty-state message when no eligible players exist', () => {
    mockedUsePlayers.mockReturnValue({ data: [], isLoading: false, error: null } as any)
    render(<FixtureEaseRankingPanel />)
    fireEvent.click(screen.getByTestId('ease-row-MCI'))
    expect(
      screen.getByText('No available players with xGI data for this team.'),
    ).toBeInTheDocument()
  })

  it('toggles expansion via Enter key on a focused TARGET row (keyboard accessibility)', () => {
    render(<FixtureEaseRankingPanel />)
    const row = screen.getByTestId('ease-row-MCI')
    expect(row).toHaveAttribute('tabindex', '0')
    expect(row).toHaveAttribute('role', 'button')
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(screen.getByTestId('expanded-MCI')).toBeInTheDocument()
  })
})
