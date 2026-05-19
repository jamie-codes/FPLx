// @vitest-environment jsdom
// Phase 126 (NSP-03, NSP-04): NextSeasonPlannerTab RTL integration tests.
// Phase 127 (127-04): Updated mocks to use PreSeasonSquadResponse envelope shape;
//   added health indicator and solver badge tests.
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { PreSeasonSquad, PreSeasonPlayer, SquadHealth, PreSeasonSquadResponse } from '@/lib/types'

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

// Helper: build a SquadHealth object
function makeHealth(overrides: Partial<SquadHealth> = {}): SquadHealth {
  return {
    greedy_null_rate: 0.1,
    min_feasible_budget_greedy: 83.5,
    greedy_optimality_gap_avg: null,
    budget_sweep_min: 80,
    budget_sweep_max: 120,
    budget_sweep_step: 0.5,
    sweep_count: 81,
    ...overrides,
  }
}

// Helper: build a PreSeasonSquadResponse envelope
function makeEnvelope(overrides: Partial<PreSeasonSquadResponse> = {}): PreSeasonSquadResponse {
  return {
    squad: makeSquad(),
    health: null,
    solver: 'ilp',
    ...overrides,
  }
}

describe('NextSeasonPlannerTab', () => {
  it('renders "Pre-season squad not yet available" when usePreSeasonSquad returns null data', () => {
    usePreSeasonSquadMock.mockReturnValue({ data: null, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toMatch(/pre-season squad/i)
  })

  it('renders formation grid with formation string and player rows when data is populated', () => {
    const envelope = makeEnvelope()
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    // Formation string should appear
    expect(container.textContent).toContain('4-3-3')
    // All 15 player names should appear
    envelope.squad!.starters.concat(envelope.squad!.bench).forEach(p => {
      expect(container.textContent).toContain(p.web_name)
    })
  })

  it('renders "Fixtures not yet published" when next-season fixtures hook returns empty', () => {
    const envelope = makeEnvelope()
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toMatch(/fixtures not yet published/i)
  })

  it('renders error copy "Failed to load pre-season squad" when isError is true', () => {
    usePreSeasonSquadMock.mockReturnValue({ data: null, isLoading: false, isError: true })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toMatch(/failed to load pre-season squad/i)
  })

  // Phase 127 Task 2: new tests for health indicator and solver badge

  it('renders ILP pill and no health paragraph when solver=ilp and health=null', () => {
    const envelope = makeEnvelope({ solver: 'ilp', health: null })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toContain('ILP')
    // No health indicator paragraph should be rendered
    expect(container.textContent).not.toMatch(/Greedy success rate/i)
    expect(container.textContent).not.toMatch(/No feasible squad found/i)
  })

  it('renders Greedy pill and health paragraph with percentage and budget values when health is present', () => {
    const health = makeHealth({
      greedy_null_rate: 0.1,
      min_feasible_budget_greedy: 83.5,
      budget_sweep_min: 80,
      budget_sweep_max: 120,
    })
    const envelope = makeEnvelope({ solver: 'greedy', health })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toContain('Greedy')
    expect(container.textContent).toContain('90%')
    expect(container.textContent).toContain('£80m')
    expect(container.textContent).toContain('£120m')
    expect(container.textContent).toContain('£83.5m')
  })

  it('renders "100% — all budgets feasible" when greedy_null_rate is 0', () => {
    const health = makeHealth({ greedy_null_rate: 0, min_feasible_budget_greedy: 80 })
    const envelope = makeEnvelope({ solver: 'ilp', health })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toContain('100%')
    expect(container.textContent).toContain('all budgets feasible')
  })

  it('renders "No feasible squad found" text in red when min_feasible_budget_greedy is null', () => {
    const health = makeHealth({ greedy_null_rate: 1, min_feasible_budget_greedy: null })
    const envelope = makeEnvelope({ solver: 'ilp', health })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toContain('No feasible squad found')
    // Red text element
    const redEl = container.querySelector('.text-red-600, .text-red-400')
    expect(redEl).not.toBeNull()
  })

  it('renders "Pre-season squad not yet available" when data is null (404 state)', () => {
    usePreSeasonSquadMock.mockReturnValue({ data: null, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toMatch(/Pre-season squad not yet available/i)
    // No badge, no health paragraph
    expect(container.textContent).not.toContain('ILP')
    expect(container.textContent).not.toContain('Greedy')
    expect(container.textContent).not.toMatch(/Greedy success rate/i)
  })
})
