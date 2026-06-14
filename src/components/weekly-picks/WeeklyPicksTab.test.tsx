// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { MergedPlayer } from '@/lib/types'

const players: Partial<MergedPlayer>[] = [
  { id: 1, web_name: 'Alpha', team_short_name: 'ARS', element_type: 4, status: 'a',
    selected_by_percent: '40.0', now_cost: 90, xPts_1gw: 7.2, xPts_3gw: 18.0,
    haul_prob: 0.34, differential_flag: null, fixtures: [],
    xg_per90: 0.55, xa_per90: null, mins_risk: 'nailed', start_prob: 0.96,
    penalties_order: null, direct_freekicks_order: null, corners_and_indirect_freekicks_order: null,
    bonus_ev: null, xPts_components_1gw: null, minutes: 900, rotation_risk: false },
  { id: 2, web_name: 'Beta', team_short_name: 'CHE', element_type: 3, status: 'd',
    selected_by_percent: '4.1', now_cost: 55, xPts_1gw: 5.5, xPts_3gw: 14.0,
    haul_prob: 0.22, differential_flag: 'diff', fixtures: [],
    xg_per90: null, xa_per90: null, mins_risk: 'likely_start', start_prob: 0.8,
    penalties_order: null, direct_freekicks_order: null, corners_and_indirect_freekicks_order: null,
    bonus_ev: null, xPts_components_1gw: null, minutes: 900, rotation_risk: false },
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

describe('WeeklyPicksTab — PICK-02 expand explains', () => {
  it('expanded row in Next GW table contains the PickExplain block (reasons visible)', () => {
    render(<WeeklyPicksTab />)
    // Alpha has xg_per90=0.55 and mins_risk='nailed' — reasons should fire
    // Find the Alpha row in the "Next GW" table and click it
    const alphaNames = screen.getAllByText('Alpha')
    // Click the first occurrence (Next GW table)
    fireEvent.click(alphaNames[0].closest('tr')!)
    // After expand, Strong goal threat reason should appear
    expect(screen.getByText(/Strong goal threat/)).toBeTruthy()
  })

  it('expanded row shows "No major flags" when no risks fire', () => {
    render(<WeeklyPicksTab />)
    const alphaNames = screen.getAllByText('Alpha')
    fireEvent.click(alphaNames[0].closest('tr')!)
    expect(screen.getByText(/no major flags/i)).toBeTruthy()
  })

  it('expanded row in Next 3 GWs table also shows explain block', () => {
    render(<WeeklyPicksTab />)
    // Alpha appears in both tables; second occurrence is the 3GW table
    const alphaNames = screen.getAllByText('Alpha')
    // Click second occurrence (3GW table) - note there may be 2 tables rendered
    // Use the last one found
    const lastAlpha = alphaNames[alphaNames.length - 1]
    fireEvent.click(lastAlpha.closest('tr')!)
    // Should still show explain content
    expect(screen.getAllByText(/Strong goal threat/).length).toBeGreaterThanOrEqual(1)
  })
})
