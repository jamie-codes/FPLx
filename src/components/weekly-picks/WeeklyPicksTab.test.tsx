// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { MergedPlayer } from '@/lib/types'

const players: Partial<MergedPlayer>[] = [
  { id: 1, web_name: 'Alpha', team_short_name: 'ARS', element_type: 4, status: 'a',
    selected_by_percent: '40.0', now_cost: 90, xPts_1gw: 7.2, xPts_3gw: 18.0,
    haul_prob: 0.34, differential_flag: null, fixtures: [] },
  { id: 2, web_name: 'Beta', team_short_name: 'CHE', element_type: 3, status: 'd',
    selected_by_percent: '4.1', now_cost: 55, xPts_1gw: 5.5, xPts_3gw: 14.0,
    haul_prob: 0.22, differential_flag: 'diff', fixtures: [] },
]

vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: () => ({ data: players, isLoading: false, error: null }),
}))
vi.mock('@/lib/hooks/useAccuracy', () => ({
  useAccuracy: () => ({ data: { summary: {} } }),
}))

// Import AFTER mocks
import { WeeklyPicksTab } from './WeeklyPicksTab'

describe('WeeklyPicksTab — PICK-01', () => {
  it('renders both horizon tables with ranked players', () => {
    render(<WeeklyPicksTab />)
    expect(screen.getByText(/next gw/i)).toBeTruthy()
    expect(screen.getByText(/next 3 gws/i)).toBeTruthy()
    expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(2) // both tables
  })
  it('renders under-the-radar chip for low-ownership player', () => {
    render(<WeeklyPicksTab />)
    expect(screen.getByText(/under the radar/i)).toBeTruthy()
    // Beta is 4.1% owned -> appears in radar row as well as tables
    expect(screen.getAllByText('Beta').length).toBeGreaterThanOrEqual(3)
  })
  it('shows status warning for doubtful player', () => {
    render(<WeeklyPicksTab />)
    expect(screen.getAllByTitle('Doubtful').length).toBeGreaterThanOrEqual(1)
  })
})
