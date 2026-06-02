// @vitest-environment jsdom
// WC-01: WildcardBuilderTab component tests
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ScoredPlayer } from '@/lib/types'

// --- Mock hooks BEFORE importing the component ---
const mockUsePlayers = vi.fn()
vi.mock('@/lib/hooks/usePlayers', () => ({ usePlayers: () => mockUsePlayers() }))

const mockUseSquad = vi.fn()
vi.mock('@/lib/hooks/useSquad', () => ({ useSquad: () => mockUseSquad() }))

const mockUseMyTeam = vi.fn()
vi.mock('@/lib/hooks/useMyTeam', () => ({ useMyTeam: () => mockUseMyTeam() }))

// --- Mock buildAnchoredSquad ---
const mockBuildAnchoredSquad = vi.fn()
vi.mock('@/lib/anchored-squad', () => ({
  buildAnchoredSquad: (...args: unknown[]) => mockBuildAnchoredSquad(...args),
}))

import { WildcardBuilderTab } from './WildcardBuilderTab'
import type { AnchoredSquadResult } from '@/lib/anchored-squad'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(id: number, type: 1|2|3|4 = 3, team = 1): ScoredPlayer {
  return {
    id,
    web_name: `Player${id}`,
    element_type: type,
    team,
    now_cost: 65,
    status: 'a',
    xPts_1gw: 6.0,
    team_short_name: `T${team}`,
  } as unknown as ScoredPlayer
}

function makeResult(overrides: Partial<AnchoredSquadResult> = {}): AnchoredSquadResult {
  return {
    squad: [],
    bestXI: [],
    formation: '4-4-2',
    budgetUsed: 900,
    budgetRemaining: 100,
    xPts1gw: 60.0,
    xPts3gw: 170.0,
    xPts5gw: 280.0,
    captainCandidates: [
      { id: 1, web_name: 'Salah', xPts_1gw: 8.5, ceiling: 12.0 },
      { id: 2, web_name: 'Haaland', xPts_1gw: 8.0, ceiling: 11.5 },
      { id: 3, web_name: 'Saka', xPts_1gw: 6.5, ceiling: 9.0 },
    ],
    anchorConflicts: [],
    ...overrides,
  }
}

const DEFAULT_PLAYERS = [
  makePlayer(10, 1, 1), makePlayer(11, 2, 1), makePlayer(12, 3, 1),
  makePlayer(13, 4, 1), makePlayer(14, 3, 2),
]

beforeEach(() => {
  mockUsePlayers.mockReset()
  mockUseSquad.mockReset()
  mockUseMyTeam.mockReset()
  mockBuildAnchoredSquad.mockReset()

  mockUsePlayers.mockReturnValue({ data: DEFAULT_PLAYERS, isLoading: false, error: null })
  mockUseSquad.mockReturnValue({ data: null, isLoading: false, error: null })
  mockUseMyTeam.mockReturnValue({ data: null, isLoading: false, error: null })
  // Default: return a valid result for both structures
  mockBuildAnchoredSquad.mockReturnValue(makeResult())
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WildcardBuilderTab', () => {
  it('renders two structure panel headers', () => {
    render(<WildcardBuilderTab submittedId={null} horizon={1} />)
    expect(screen.getByText('Structure A')).toBeTruthy()
    expect(screen.getByText('Structure B')).toBeTruthy()
  })

  it('shows loading copy when usePlayers is loading', () => {
    mockUsePlayers.mockReturnValue({ data: undefined, isLoading: true, error: null })
    render(<WildcardBuilderTab submittedId={null} horizon={1} />)
    expect(screen.getByText(/Loading player data/i)).toBeTruthy()
    expect(screen.queryByText('Structure A')).toBeNull()
  })

  it('shows error copy when usePlayers errors', () => {
    mockUsePlayers.mockReturnValue({ data: undefined, isLoading: false, error: new Error('fail') })
    render(<WildcardBuilderTab submittedId={null} horizon={1} />)
    expect(screen.getByText(/Failed to load player data/i)).toBeTruthy()
    expect(screen.queryByText('Structure A')).toBeNull()
  })

  it('comparison table is present when both structures have results', () => {
    mockBuildAnchoredSquad.mockReturnValue(makeResult())
    render(<WildcardBuilderTab submittedId={null} horizon={1} />)
    expect(screen.getByText(/xPts next GW/i)).toBeTruthy()
    expect(screen.getByText(/xPts next 3 GWs/i)).toBeTruthy()
    expect(screen.getByText(/xPts next 5 GWs/i)).toBeTruthy()
    expect(screen.getByText(/Budget remaining/i)).toBeTruthy()
    expect(screen.getByText(/Captain options/i)).toBeTruthy()
  })

  it('comparison table is absent when one structure returns null', () => {
    mockBuildAnchoredSquad
      .mockReturnValueOnce(makeResult())   // Structure A
      .mockReturnValueOnce(null)           // Structure B
    render(<WildcardBuilderTab submittedId={null} horizon={1} />)
    expect(screen.queryByText(/xPts next GW/i)).toBeNull()
  })

  it('winning xPts cell carries bg-green-50 class; losing cell does not', () => {
    mockBuildAnchoredSquad
      .mockReturnValueOnce(makeResult({ xPts1gw: 65.0 }))  // A wins
      .mockReturnValueOnce(makeResult({ xPts1gw: 60.0 }))  // B loses
    const { container } = render(<WildcardBuilderTab submittedId={null} horizon={1} />)
    const rows = container.querySelectorAll('tbody tr')
    // First row = xPts next GW. A cell (index 1) should be green, B cell (index 2) should not.
    const xptsRow = Array.from(rows).find(r => r.textContent?.includes('xPts next GW'))
    expect(xptsRow).not.toBeNull()
    const cells = xptsRow!.querySelectorAll('td')
    expect(cells[1].className).toMatch(/bg-green-50/)
    expect(cells[2].className).not.toMatch(/bg-green-50/)
  })

  it('equal xPts values → neither cell carries bg-green-50', () => {
    mockBuildAnchoredSquad.mockReturnValue(makeResult({ xPts1gw: 60.0 }))
    const { container } = render(<WildcardBuilderTab submittedId={null} horizon={1} />)
    const rows = container.querySelectorAll('tbody tr')
    const xptsRow = Array.from(rows).find(r => r.textContent?.includes('xPts next GW'))
    const cells = xptsRow!.querySelectorAll('td')
    expect(cells[1].className).not.toMatch(/bg-green-50/)
    expect(cells[2].className).not.toMatch(/bg-green-50/)
  })

  it('conflict message renders when anchorConflicts is non-empty', () => {
    mockBuildAnchoredSquad.mockReturnValue(makeResult({
      anchorConflicts: [{ playerId: 10, reason: 'team_cap' }],
    }))
    render(<WildcardBuilderTab submittedId={null} horizon={1} />)
    expect(screen.getAllByText(/team cap/i).length).toBeGreaterThan(0)
  })

  it('null-result message renders when buildAnchoredSquad returns null', () => {
    mockBuildAnchoredSquad.mockReturnValue(null)
    render(<WildcardBuilderTab submittedId={null} horizon={1} />)
    expect(screen.getAllByText(/Could not build a valid squad/i).length).toBeGreaterThan(0)
  })

  it('captain names appear in the comparison table captain row', () => {
    mockBuildAnchoredSquad
      .mockReturnValueOnce(makeResult())
      .mockReturnValueOnce(makeResult({
        captainCandidates: [
          { id: 7, web_name: 'Mbeumo', xPts_1gw: 7.0, ceiling: 10.0 },
        ],
      }))
    render(<WildcardBuilderTab submittedId={null} horizon={1} />)
    expect(screen.getByText(/Salah/)).toBeTruthy()
    expect(screen.getByText(/Mbeumo/)).toBeTruthy()
  })
})
