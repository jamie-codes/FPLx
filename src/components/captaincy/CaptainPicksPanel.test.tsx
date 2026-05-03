// Phase 57 (EO-01..EO-04): CaptainPicksPanel RTL tests — RED in Wave 0, GREEN after rewrite.
// Mirrors src/components/optimiser/ChipModeToggle.test.tsx pattern.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, within } from '@testing-library/react'
import { CaptainPicksPanel } from './CaptainPicksPanel'
import type { MergedPlayer } from '@/lib/types'

vi.mock('@/lib/hooks/usePlayers', () => ({ usePlayers: vi.fn() }))
vi.mock('@/lib/hooks/useCaptainPicks', () => ({ useCaptainPicks: vi.fn() }))
vi.mock('@/lib/hooks/useAuthStatus', () => ({ useAuthStatus: vi.fn() }))
vi.mock('@/lib/hooks/useMyTeam', () => ({ useMyTeam: vi.fn() }))

import { usePlayers } from '@/lib/hooks/usePlayers'
import { useCaptainPicks } from '@/lib/hooks/useCaptainPicks'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { useMyTeam } from '@/lib/hooks/useMyTeam'

type PlayerOverrides = Partial<MergedPlayer> & { id: number; element_type: 1 | 2 | 3 | 4 }
function makePlayer(overrides: PlayerOverrides): MergedPlayer {
  return {
    web_name: `P${overrides.id}`,
    team: 1,
    team_short_name: 'T1',
    now_cost: 50,
    selected_by_percent: '5.0',
    form: '0.0',
    status: 'a',
    minutes: 900,
    starts: 10,
    total_points: 50,
    goals_scored: 2,
    assists: 1,
    expected_goals: 1.5,
    expected_assists: 1.0,
    pts_last3gw: 12,
    pts_last5gw: 20,
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
    cost_change_event: 0,
    cost_change_start: 0,
    understat_id: null,
    xg_per90: null,
    xa_per90: null,
    minutes_per90: 80,
    form_pts_per90: 5.0,
    fixtures: [],
    xmins: 80,
    start_prob: 0.9,
    mins_risk: 'nailed',
    xPts_1gw: 5.0,
    xPts_3gw: 14.0,
    xPts_5gw: 22.0,
    xPts_90th_1gw: 7.0,
    ...overrides,
  } as MergedPlayer
}

function buildPlayers(): MergedPlayer[] {
  return [
    // 5 mids/fwds with varying xPts_1gw and selected_by_percent
    makePlayer({ id: 101, element_type: 3, web_name: 'Salah',   selected_by_percent: '34.5', xPts_1gw: 7.8, xPts_90th_1gw: 11.2 }),
    makePlayer({ id: 102, element_type: 3, web_name: 'Saka',    selected_by_percent: '28.0', xPts_1gw: 6.4, xPts_90th_1gw: 9.6 }),
    makePlayer({ id: 103, element_type: 4, web_name: 'Haaland', selected_by_percent: '52.1', xPts_1gw: 8.1, xPts_90th_1gw: 12.5 }),
    makePlayer({ id: 104, element_type: 3, web_name: 'Palmer',  selected_by_percent: '22.4', xPts_1gw: 6.0, xPts_90th_1gw: 9.0 }),
    makePlayer({ id: 105, element_type: 3, web_name: 'Differ',  selected_by_percent: '4.2',  xPts_1gw: 6.7, xPts_90th_1gw: 9.4 }),
  ]
}

beforeEach(() => {
  vi.mocked(usePlayers).mockReturnValue({ data: buildPlayers(), isLoading: false, error: null } as never)
  vi.mocked(useCaptainPicks).mockReturnValue({ data: { gameweek: 28, ceiling: null, eo_adjusted: null }, isLoading: false, error: null } as never)
  vi.mocked(useAuthStatus).mockReturnValue({ isAuthenticated: false, expiresAt: undefined, isLoading: false, setAuthenticated: vi.fn(), clearAuthenticated: vi.fn() } as never)
  vi.mocked(useMyTeam).mockReturnValue({ data: undefined, isLoading: false, error: null } as never)
})

describe('CaptainPicksPanel — Phase 57', () => {
  // a. Toggle render + default mode
  it('renders 4 mode toggle buttons with correct testIds', () => {
    const { getByTestId } = render(<CaptainPicksPanel />)
    expect(getByTestId('eo-toggle-max-xpts')).toBeTruthy()
    expect(getByTestId('eo-toggle-protect-rank')).toBeTruthy()
    expect(getByTestId('eo-toggle-chase-rank')).toBeTruthy()
    expect(getByTestId('eo-toggle-differential')).toBeTruthy()
  })

  it('Max xPts is the default active mode (D-04)', () => {
    const { getByTestId } = render(<CaptainPicksPanel />)
    expect(getByTestId('eo-toggle-max-xpts').getAttribute('aria-pressed')).toBe('true')
    expect(getByTestId('eo-toggle-protect-rank').getAttribute('aria-pressed')).toBe('false')
    expect(getByTestId('eo-toggle-chase-rank').getAttribute('aria-pressed')).toBe('false')
    expect(getByTestId('eo-toggle-differential').getAttribute('aria-pressed')).toBe('false')
  })

  it('toggle group has role="group" with aria-label="Captain ranking mode"', () => {
    const { container } = render(<CaptainPicksPanel />)
    const group = container.querySelector('[role="group"]')
    expect(group).not.toBeNull()
    expect(group!.getAttribute('aria-label')).toBe('Captain ranking mode')
  })

  // b. Mode switching reorders rows (EO-02)
  it('clicking Protect Rank reorders the list to highest selected_by_percent first', () => {
    const { getByTestId, getAllByTestId } = render(<CaptainPicksPanel />)
    fireEvent.click(getByTestId('eo-toggle-protect-rank'))
    const rows = getAllByTestId('eo-candidate-row')
    expect(rows[0].textContent).toContain('Haaland')
  })

  it('clicking Differential filters and reorders to ascending EO above-median xPts', () => {
    const { getByTestId, getAllByTestId } = render(<CaptainPicksPanel />)
    fireEvent.click(getByTestId('eo-toggle-differential'))
    const rows = getAllByTestId('eo-candidate-row')
    expect(rows[0].textContent).toContain('Differ')
  })

  it('clicking Chase Rank reorders by xPts_90th_1gw descending', () => {
    const { getByTestId, getAllByTestId } = render(<CaptainPicksPanel />)
    fireEvent.click(getByTestId('eo-toggle-chase-rank'))
    const rows = getAllByTestId('eo-candidate-row')
    expect(rows[0].textContent).toContain('Haaland')
  })

  // c. EO% inline display (EO-01)
  it('renders ~XX% inline next to player name in default mode', () => {
    const { getAllByTestId } = render(<CaptainPicksPanel />)
    // Default (max_xpts): Haaland (8.1 xPts) is first
    const rows = getAllByTestId('eo-candidate-row')
    const firstRow = rows[0]
    const eoSpan = within(firstRow).getByText(/^~\d+%$/)
    expect(eoSpan).toBeTruthy()
    // Haaland has 52.1% → rounds to ~52%
    expect(eoSpan.textContent).toBe('~52%')
  })

  it('the ~XX% span carries the exact tooltip text', () => {
    const { getAllByTestId } = render(<CaptainPicksPanel />)
    const rows = getAllByTestId('eo-candidate-row')
    const firstRow = rows[0]
    const eoSpan = within(firstRow).getByText(/^~\d+%$/)
    expect(eoSpan.getAttribute('title')).toBe('Approximate effective ownership based on FPL selected_by_percent data.')
  })

  // d. Dangerous to fade badge gating (EO-03 / D-08–D-11)
  it('badge appears for high-EO non-squad players when authenticated + protect_rank', () => {
    vi.mocked(useAuthStatus).mockReturnValue({ isAuthenticated: true, expiresAt: undefined, isLoading: false, setAuthenticated: vi.fn(), clearAuthenticated: vi.fn() } as never)
    vi.mocked(useMyTeam).mockReturnValue({
      data: {
        picks: [{ element: 101, position: 1, selling_price: 130, multiplier: 1, is_captain: false, is_vice_captain: false }],
        entry_history: { event_transfers: 1, bank: 0 },
      },
      isLoading: false,
      error: null,
    } as never)
    const { getByTestId, getAllByTestId } = render(<CaptainPicksPanel submittedId="123" />)
    fireEvent.click(getByTestId('eo-toggle-protect-rank'))
    const rows = getAllByTestId('eo-candidate-row')
    // Haaland (52.1% EO, NOT in squad) should have the badge
    const haalandRow = rows.find(r => r.textContent?.includes('Haaland'))
    expect(haalandRow?.textContent).toContain('Dangerous to fade')
    // Salah (34.5% EO, IS in squad) should NOT have the badge
    const salahRow = rows.find(r => r.textContent?.includes('Salah'))
    expect(salahRow?.textContent).not.toContain('Dangerous to fade')
  })

  it('badge hidden entirely when unauthenticated (D-10, Pitfall 3 regression)', () => {
    // default mocks: isAuthenticated: false
    const { getByTestId, queryByText } = render(<CaptainPicksPanel />)
    fireEvent.click(getByTestId('eo-toggle-protect-rank'))
    expect(queryByText('Dangerous to fade')).toBeNull()
  })

  it('badge hidden in non-protect_rank modes (D-11)', () => {
    vi.mocked(useAuthStatus).mockReturnValue({ isAuthenticated: true, expiresAt: undefined, isLoading: false, setAuthenticated: vi.fn(), clearAuthenticated: vi.fn() } as never)
    vi.mocked(useMyTeam).mockReturnValue({
      data: {
        picks: [{ element: 999, position: 1, selling_price: 130, multiplier: 1, is_captain: false, is_vice_captain: false }],
        entry_history: { event_transfers: 1, bank: 0 },
      },
      isLoading: false,
      error: null,
    } as never)
    const { getByTestId, queryByText } = render(<CaptainPicksPanel submittedId="123" />)
    // default mode: max_xpts — no badge
    expect(queryByText('Dangerous to fade')).toBeNull()
    // chase_rank — no badge
    fireEvent.click(getByTestId('eo-toggle-chase-rank'))
    expect(queryByText('Dangerous to fade')).toBeNull()
    // differential — no badge
    fireEvent.click(getByTestId('eo-toggle-differential'))
    expect(queryByText('Dangerous to fade')).toBeNull()
  })

  it('badge hidden for low-EO players even in protect_rank', () => {
    vi.mocked(useAuthStatus).mockReturnValue({ isAuthenticated: true, expiresAt: undefined, isLoading: false, setAuthenticated: vi.fn(), clearAuthenticated: vi.fn() } as never)
    vi.mocked(useMyTeam).mockReturnValue({
      data: {
        picks: [{ element: 999, position: 1, selling_price: 130, multiplier: 1, is_captain: false, is_vice_captain: false }],
        entry_history: { event_transfers: 1, bank: 0 },
      },
      isLoading: false,
      error: null,
    } as never)
    const { getByTestId, getAllByTestId } = render(<CaptainPicksPanel submittedId="123" />)
    fireEvent.click(getByTestId('eo-toggle-protect-rank'))
    const rows = getAllByTestId('eo-candidate-row')
    // Palmer (22.4% EO) should NOT have badge (EO < 30)
    const palmerRow = rows.find(r => r.textContent?.includes('Palmer'))
    expect(palmerRow?.textContent).not.toContain('Dangerous to fade')
  })

  // e. Loading / error states
  it('shows loading copy when usePlayers is loading', () => {
    vi.mocked(usePlayers).mockReturnValue({ data: undefined, isLoading: true, error: null } as never)
    const { getByText } = render(<CaptainPicksPanel />)
    expect(getByText('Loading captain picks…')).toBeTruthy()
  })

  it('shows error copy when usePlayers errors', () => {
    vi.mocked(usePlayers).mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    const { getByText } = render(<CaptainPicksPanel />)
    expect(getByText(/Failed to load captain picks/)).toBeTruthy()
  })
})
