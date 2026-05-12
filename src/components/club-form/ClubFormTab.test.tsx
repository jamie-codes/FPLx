// Phase 97 HEAT-01 — TDD tests for ClubFormTab
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Capture spy for FixtureHeatMap props
const fixtureHeatMapSpy = vi.fn()
vi.mock('./FixtureHeatMap', () => ({
  FixtureHeatMap: (props: { submittedId?: string | null }) => {
    fixtureHeatMapSpy(props)
    return <div data-testid="fixture-heat-map-mock" />
  },
}))
vi.mock('./FixtureEaseRankingPanel', () => ({
  FixtureEaseRankingPanel: () => <div data-testid="fixture-ease-mock" />,
}))
vi.mock('./FixtureSwingDetector', () => ({
  FixtureSwingDetector: () => <div data-testid="fixture-swing-mock" />,
}))
vi.mock('./ClubFormTable', () => ({
  ClubFormTable: () => <div data-testid="club-form-table-mock" />,
}))

// Mock hooks for safety (even though child components are mocked, leave nothing to chance)
vi.mock('@/lib/hooks/useClubForm', () => ({
  useClubForm: () => ({ data: undefined, isLoading: false, error: null }),
}))
vi.mock('@/lib/hooks/useSquad', () => ({
  useSquad: () => ({ data: undefined, isLoading: false, error: null }),
}))
vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: () => ({ data: undefined, isLoading: false, error: null }),
}))

import { ClubFormTab } from './ClubFormTab'

describe('ClubFormTab', () => {
  beforeEach(() => {
    fixtureHeatMapSpy.mockReset()
  })

  it('default view renders form panels and not the heat map (D-08)', () => {
    render(<ClubFormTab />)
    expect(screen.getByTestId('fixture-ease-mock')).toBeTruthy()
    expect(screen.getByTestId('fixture-swing-mock')).toBeTruthy()
    expect(screen.getByTestId('club-form-table-mock')).toBeTruthy()
    expect(screen.queryByTestId('fixture-heat-map-mock')).toBeNull()
  })

  it('clicking Heat Map pill switches to heat-map view', () => {
    render(<ClubFormTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Heat Map' }))
    expect(screen.getByTestId('fixture-heat-map-mock')).toBeTruthy()
    expect(screen.queryByTestId('fixture-ease-mock')).toBeNull()
    expect(screen.queryByTestId('fixture-swing-mock')).toBeNull()
    expect(screen.queryByTestId('club-form-table-mock')).toBeNull()
  })

  it('clicking Form pill returns to form view from heat-map view', () => {
    render(<ClubFormTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Heat Map' }))
    fireEvent.click(screen.getByRole('button', { name: 'Form' }))
    expect(screen.getByTestId('fixture-ease-mock')).toBeTruthy()
    expect(screen.getByTestId('fixture-swing-mock')).toBeTruthy()
    expect(screen.getByTestId('club-form-table-mock')).toBeTruthy()
    expect(screen.queryByTestId('fixture-heat-map-mock')).toBeNull()
  })

  it('aria-pressed inverts when toggle is clicked (D-05 contract)', () => {
    render(<ClubFormTab />)
    const formBtn = screen.getByRole('button', { name: 'Form' })
    const heatBtn = screen.getByRole('button', { name: 'Heat Map' })
    expect(formBtn.getAttribute('aria-pressed')).toBe('true')
    expect(heatBtn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(heatBtn)
    expect(formBtn.getAttribute('aria-pressed')).toBe('false')
    expect(heatBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('forwards submittedId prop to FixtureHeatMap when in heat-map view', () => {
    render(<ClubFormTab submittedId="123" />)
    fireEvent.click(screen.getByRole('button', { name: 'Heat Map' }))
    expect(fixtureHeatMapSpy).toHaveBeenCalledWith(expect.objectContaining({ submittedId: '123' }))
  })

  it('toggle container has role=group and aria-label="Club Form view"', () => {
    render(<ClubFormTab />)
    const group = screen.getByRole('group', { name: 'Club Form view' })
    expect(group).not.toBeNull()
  })
})
