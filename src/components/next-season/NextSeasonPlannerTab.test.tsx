// @vitest-environment jsdom
// Phase 126 (NSP-03, NSP-04): NextSeasonPlannerTab RTL integration tests.
// Wave 0: all tests RED (component does not exist). Wave 1: GREEN.
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { PreSeasonSquad, PreSeasonPlayer } from '@/lib/types'

// Mock usePreSeasonSquad hook
const usePreSeasonSquadMock = vi.fn()
vi.mock('@/lib/hooks/usePreSeasonSquad', () => ({
  usePreSeasonSquad: () => usePreSeasonSquadMock(),
}))

// Import AFTER mocks
import { NextSeasonPlannerTab } from './NextSeasonPlannerTab'

// Helper: build a minimal PreSeasonPlayer for test data
function makePlayer(id: number, element_type: 1 | 2 | 3 | 4, team = 1): PreSeasonPlayer {
  return {
    id,
    web_name: `Player${id}`,
    element_type,
    team,
    team_short_name: 'TST',
    now_cost: 60,
    total_points: 120,
    ppm: 0.55,
  }
}

// Helper: build a minimal PreSeasonSquad for test data
function makeSquad(): PreSeasonSquad {
  const starters: PreSeasonPlayer[] = [
    makePlayer(1, 1),                              // GK
    makePlayer(2, 2), makePlayer(3, 2), makePlayer(4, 2), makePlayer(5, 2),  // DEF x4
    makePlayer(6, 3), makePlayer(7, 3), makePlayer(8, 3),                    // MID x3
    makePlayer(9, 4), makePlayer(10, 4), makePlayer(11, 4),                  // FWD x3
  ]
  const bench: PreSeasonPlayer[] = [
    makePlayer(12, 1),  // GK bench
    makePlayer(13, 2),  // DEF bench
    makePlayer(14, 3),  // MID bench
    makePlayer(15, 4),  // FWD bench
  ]
  return {
    starters,
    bench,
    formation: '4-3-3',
    budgetUsed: 900,
  }
}

describe('NextSeasonPlannerTab', () => {
  it('renders "Pre-season squad not yet available" when usePreSeasonSquad returns null data', () => {
    usePreSeasonSquadMock.mockReturnValue({ data: null, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toMatch(/pre-season squad/i)
  })

  it('renders formation grid with formation string and player rows when data is populated', () => {
    const squad = makeSquad()
    usePreSeasonSquadMock.mockReturnValue({ data: squad, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    // Formation string should appear
    expect(container.textContent).toContain('4-3-3')
    // All 15 player names should appear
    squad.starters.concat(squad.bench).forEach(p => {
      expect(container.textContent).toContain(p.web_name)
    })
  })

  it('renders "Fixtures not yet published" when next-season fixtures hook returns empty', () => {
    const squad = makeSquad()
    usePreSeasonSquadMock.mockReturnValue({ data: squad, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    // The component should show an empty-state message for fixtures when no next-season fixture data
    expect(container.textContent).toMatch(/fixtures not yet published/i)
  })

  it('renders error copy "Failed to load pre-season squad" when isError is true', () => {
    usePreSeasonSquadMock.mockReturnValue({ data: null, isLoading: false, isError: true })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toMatch(/failed to load pre-season squad/i)
  })
})
