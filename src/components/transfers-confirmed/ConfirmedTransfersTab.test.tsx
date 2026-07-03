// TFR-01: ConfirmedTransfersTab unit tests
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock the hook so tests are pure
vi.mock('@/lib/hooks/useConfirmedTransfers', () => ({
  useConfirmedTransfers: vi.fn(),
}))

// Mock shared/TeamBadge to avoid FPL image logic in unit tests
vi.mock('@/components/shared/TeamBadge', () => ({
  TeamBadge: ({ shortName }: { shortName: string }) => (
    <span data-testid={`team-badge-${shortName}`}>{shortName}</span>
  ),
}))

import { useConfirmedTransfers } from '@/lib/hooks/useConfirmedTransfers'
import { ConfirmedTransfersTab } from './ConfirmedTransfersTab'

const mockUseConfirmedTransfers = vi.mocked(useConfirmedTransfers)

const DISABLED_DATA = {
  data: { enabled: false, scraped_at: '', window: '', source_url: '', groups: [], chronological: [], counts: { deals: 0, loans: 0 } },
  isLoading: false,
  isError: false,
  isNotAvailable: true,
}

const LOADED_EMPTY_DATA = {
  data: { enabled: true, scraped_at: '2026-07-01T12:00:00Z', window: 'summer_2026', source_url: 'http://x', groups: [], chronological: [], counts: { deals: 0, loans: 0 } },
  isLoading: false,
  isError: false,
  isNotAvailable: false,
}

const POPULATED_DATA = {
  data: {
    enabled: true,
    scraped_at: '2026-07-01T12:00:00Z',
    window: 'summer_2026',
    source_url: 'http://x',
    groups: [
      {
        team_id: 1,
        team_name: 'Arsenal',
        team_short_name: 'ARS',
        ins: [
          { date: '1 July 2026', player: 'Player One', fee: '£40m', kind: 'permanent' as const, other_club: 'Wolves' },
        ],
        outs: [
          { date: '2 July 2026', player: 'Player Two', fee: 'Undisclosed', kind: 'loan' as const, other_club: 'Real Madrid' },
        ],
      },
    ],
    chronological: [
      { date: '2 July 2026', player: 'Player Two', fee: 'Undisclosed', kind: 'loan' as const, from_club: 'Arsenal', to_club: 'Real Madrid', from_short: 'ARS', to_short: null, is_pl_to_pl: false },
      { date: '1 July 2026', player: 'Player One', fee: '£40m', kind: 'permanent' as const, from_club: 'Wolves', to_club: 'Arsenal', from_short: 'WOL', to_short: 'ARS', is_pl_to_pl: true },
    ],
    counts: { deals: 2, loans: 1 },
  },
  isLoading: false,
  isError: false,
  isNotAvailable: false,
}

const mockOnOpenWindow = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ConfirmedTransfersTab', () => {
  it('(a) enabled:false shows empty state "appear when the window is active"', () => {
    mockUseConfirmedTransfers.mockReturnValue(DISABLED_DATA as any)
    render(<ConfirmedTransfersTab onOpenWindow={mockOnOpenWindow} />)
    expect(screen.getByText(/appear when the window is active/i)).toBeInTheDocument()
  })

  it('(b) loaded + empty groups shows "No Premier League deals confirmed yet"', () => {
    mockUseConfirmedTransfers.mockReturnValue(LOADED_EMPTY_DATA as any)
    render(<ConfirmedTransfersTab onOpenWindow={mockOnOpenWindow} />)
    expect(screen.getByText(/No Premier League deals confirmed yet/i)).toBeInTheDocument()
  })

  it('(c) populated: shows group TeamBadge + Ins player + fee chip', () => {
    mockUseConfirmedTransfers.mockReturnValue(POPULATED_DATA as any)
    render(<ConfirmedTransfersTab onOpenWindow={mockOnOpenWindow} />)
    expect(screen.getByTestId('team-badge-ARS')).toBeInTheDocument()
    expect(screen.getByText('Player One')).toBeInTheDocument()
    expect(screen.getByText('£40m')).toBeInTheDocument()
  })

  it('(d) a loan deal shows a "LOAN" chip', () => {
    mockUseConfirmedTransfers.mockReturnValue(POPULATED_DATA as any)
    render(<ConfirmedTransfersTab onOpenWindow={mockOnOpenWindow} />)
    // Player Two is a loan out
    expect(screen.getAllByText('LOAN').length).toBeGreaterThan(0)
  })

  it('(e) toggle to "Most recent" shows the chronological list', () => {
    mockUseConfirmedTransfers.mockReturnValue(POPULATED_DATA as any)
    render(<ConfirmedTransfersTab onOpenWindow={mockOnOpenWindow} />)
    // Default is by-club; toggle to Most recent
    const toggleBtn = screen.getByRole('button', { name: /most recent/i })
    fireEvent.click(toggleBtn)
    // chronological view shows both players in a flat list
    expect(screen.getByText('Player Two')).toBeInTheDocument()
    expect(screen.getByText('Player One')).toBeInTheDocument()
    // from_short TeamBadge
    expect(screen.getByTestId('team-badge-WOL')).toBeInTheDocument()
  })

  it('(f) "Rumours" button calls onOpenWindow (section switch in PreSeasonTab)', () => {
    mockUseConfirmedTransfers.mockReturnValue(POPULATED_DATA as any)
    render(<ConfirmedTransfersTab onOpenWindow={mockOnOpenWindow} />)
    const rumoursBtn = screen.getByRole('button', { name: /rumours/i })
    fireEvent.click(rumoursBtn)
    expect(mockOnOpenWindow).toHaveBeenCalled()
  })
})
