// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock hooks BEFORE importing the component (Vitest hoists vi.mock)
const mockUseBootstrap   = vi.fn()
const mockUseLiveGwPoints = vi.fn()
vi.mock('@/lib/hooks/useBootstrap',    () => ({ useBootstrap:    (...a: unknown[]) => mockUseBootstrap(...a) }))
vi.mock('@/lib/hooks/useLiveGwPoints', () => ({ useLiveGwPoints: (...a: unknown[]) => mockUseLiveGwPoints(...a) }))

import { PerfectGWTab } from './PerfectGWTab'

// Minimal bootstrap with 2 settled GWs and enough players to fill an XI
const BOOTSTRAP = {
  elements: [
    // 1 GK
    { id: 1, code: 1, web_name: 'GK1', team: 1, element_type: 1, now_cost: 50, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    // 4 DEFs
    { id: 2, code: 2, web_name: 'DEF1', team: 2, element_type: 2, now_cost: 50, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    { id: 3, code: 3, web_name: 'DEF2', team: 3, element_type: 2, now_cost: 50, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    { id: 4, code: 4, web_name: 'DEF3', team: 4, element_type: 2, now_cost: 50, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    { id: 5, code: 5, web_name: 'DEF4', team: 5, element_type: 2, now_cost: 50, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    // 4 MIDs
    { id: 6, code: 6, web_name: 'MID1', team: 6, element_type: 3, now_cost: 80, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    { id: 7, code: 7, web_name: 'MID2', team: 7, element_type: 3, now_cost: 80, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    { id: 8, code: 8, web_name: 'MID3', team: 8, element_type: 3, now_cost: 80, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    { id: 9, code: 9, web_name: 'MID4', team: 9, element_type: 3, now_cost: 80, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    // 2 FWDs
    { id: 10, code: 10, web_name: 'FWD1', team: 10, element_type: 4, now_cost: 90, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
    { id: 11, code: 11, web_name: 'FWD2', team: 11, element_type: 4, now_cost: 90, selected_by_percent: '5', form: '5', status: 'a', minutes: 90, starts: 1, defensive_contribution: null, defensive_contribution_per_90: null, clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null, corners_and_indirect_freekicks_order: null, news: '' },
  ],
  teams: Array.from({ length: 11 }, (_, i) => ({
    id: i + 1, name: `Club ${i + 1}`, short_name: `C${i + 1}`, code: i + 1,
  })),
  events: [
    { id: 37, is_current: false, is_next: false, finished: true, data_checked: true, deadline_time: '2026-05-10T10:00:00Z' },
    { id: 38, is_current: false, is_next: false, finished: true, data_checked: true, deadline_time: '2026-05-17T10:00:00Z' },
  ],
}

const LIVE_POINTS: Record<number, number> = {
  1: 6, 2: 8, 3: 7, 4: 6, 5: 5, 6: 18, 7: 10, 8: 9, 9: 8, 10: 15, 11: 9,
}

function mockSuccess() {
  mockUseBootstrap.mockReturnValue({
    data: BOOTSTRAP, isLoading: false, isError: false, error: null,
  })
  mockUseLiveGwPoints.mockReturnValue({
    data: LIVE_POINTS, isLoading: false, isError: false, error: null,
  })
}

beforeEach(() => {
  mockUseBootstrap.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null })
  mockUseLiveGwPoints.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null })
})

describe('PerfectGWTab', () => {
  it('shows loading state while data is fetching', () => {
    render(<PerfectGWTab />)
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })

  it('shows error state when bootstrap fetch fails', () => {
    mockUseBootstrap.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('fail') })
    mockUseLiveGwPoints.mockReturnValue({ data: undefined, isLoading: false, isError: false, error: null })
    render(<PerfectGWTab />)
    expect(screen.getByText(/error/i)).toBeTruthy()
  })

  it('defaults to latest settled GW (GW38) in the header', () => {
    mockSuccess()
    render(<PerfectGWTab />)
    expect(screen.getByText(/GW\s*38/)).toBeTruthy()
  })

  it('renders inner tabs: Perfect XI and Top Scorers', () => {
    mockSuccess()
    render(<PerfectGWTab />)
    expect(screen.getByRole('button', { name: /perfect xi/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /top scorers/i })).toBeTruthy()
  })

  it('switches to Top Scorers tab on click', () => {
    mockSuccess()
    render(<PerfectGWTab />)
    fireEvent.click(screen.getByRole('button', { name: /top scorers/i }))
    // TopScorersTable renders position headers
    expect(screen.getByText('GK')).toBeTruthy()
    expect(screen.getByText('DEF')).toBeTruthy()
  })

  it('prev button is disabled on the first settled GW', () => {
    mockSuccess()
    render(<PerfectGWTab />)
    // Navigate back to GW37 (earliest)
    fireEvent.click(screen.getByRole('button', { name: /previous gameweek/i }))
    // Now prev should be disabled
    expect(screen.getByRole('button', { name: /previous gameweek/i })).toBeDisabled()
  })

  it('next button is disabled on the latest settled GW (default view)', () => {
    mockSuccess()
    render(<PerfectGWTab />)
    expect(screen.getByRole('button', { name: /next gameweek/i })).toBeDisabled()
  })

  it('shows neighbouring GW numbers in selector buttons', () => {
    mockSuccess()
    render(<PerfectGWTab />)
    // Default is GW38 (latest). Prev button should show GW37.
    expect(screen.getByRole('button', { name: /previous gameweek/i }).textContent).toContain('GW 37')
    // Next button is disabled (GW38 is last), so it shows no GW number.
    expect(screen.getByRole('button', { name: /next gameweek/i }).textContent).not.toContain('GW')
  })
})
