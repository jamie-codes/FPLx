// @vitest-environment jsdom
// Phase 95 SPQ-04: SetPieceLeagueTable component tests
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

// Mocks MUST appear before component imports — Vitest hoisting requirement
const mockUseTeamBadge = vi.fn()
vi.mock('@/lib/hooks/useTeamBadge', () => ({
  useTeamBadge: () => mockUseTeamBadge(),
}))

const mockAggregateSetPieceLeague = vi.fn()
vi.mock('@/lib/setPieceLeague', () => ({
  aggregateSetPieceLeague: (...args: unknown[]) => mockAggregateSetPieceLeague(...args),
  formatScore: (raw: number | null | undefined) => {
    if (raw === null || raw === undefined) return '—'
    return (raw * 100).toFixed(1)
  },
}))

import { SetPieceLeagueTable } from './SetPieceLeagueTable'
import type { SetPieceTeam, SetPieceChanges } from '@/lib/types'

function makeChanges(teams: SetPieceTeam[]): SetPieceChanges {
  return { teams, change_count: 0, has_changes: false } as SetPieceChanges
}

function makeTeam(shortName: string, cornerScore: number | null, fkScore: number | null): SetPieceTeam {
  return {
    team_id: shortName.charCodeAt(0),
    team_short_name: shortName,
    penalty_taker: { id: 1, name: 'P', changed: false },
    fk_taker: { id: 2, name: 'F', changed: false, fk_danger_score: fkScore },
    corner_taker: { id: 3, name: 'C', changed: false, corner_danger_score: cornerScore },
  } as SetPieceTeam
}

function makeRow(shortName: string, composite: number | null, corner: number | null, fk: number | null) {
  return {
    team_id: shortName.charCodeAt(0),
    team_short_name: shortName,
    composite,
    corner_score: corner,
    fk_score: fk,
    sample_n: 10,
    primary_taker_name: 'Taker',
  }
}

beforeEach(() => {
  mockUseTeamBadge.mockReturnValue({
    src: null,
    onError: vi.fn(),
    showFallback: true,
    fallbackColour: '#123456',
    initial: 'A',
  })
  mockAggregateSetPieceLeague.mockReset()
})

describe('SetPieceLeagueTable — Phase 95 SPQ-04', () => {
  it('renders ranked rows in composite-score descending order', () => {
    mockAggregateSetPieceLeague.mockReturnValue({
      ranked: [
        makeRow('ARS', 0.095, 0.090, 0.100),
        makeRow('CHE', 0.070, 0.060, 0.080),
      ],
      insufficient: [],
    })
    const changes = makeChanges([makeTeam('ARS', 0.090, 0.100), makeTeam('CHE', 0.060, 0.080)])
    const { container } = render(<SetPieceLeagueTable changes={changes} />)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(2)
    expect(rows[0].textContent).toContain('ARS')
    expect(rows[1].textContent).toContain('CHE')
  })

  it('renders "Insufficient Data" section when a team has both scores null', () => {
    mockAggregateSetPieceLeague.mockReturnValue({
      ranked: [makeRow('ARS', 0.095, 0.090, 0.100)],
      insufficient: [makeRow('SOU', null, null, null)],
    })
    const changes = makeChanges([makeTeam('ARS', 0.090, 0.100), makeTeam('SOU', null, null)])
    const { container } = render(<SetPieceLeagueTable changes={changes} />)
    expect(container.textContent).toContain('Insufficient Data')
  })

  it('shows "—" in corner column for a team with corner_danger_score null', () => {
    mockAggregateSetPieceLeague.mockReturnValue({
      ranked: [makeRow('LIV', 0.080, null, 0.080)],
      insufficient: [],
    })
    const changes = makeChanges([makeTeam('LIV', null, 0.080)])
    const { container } = render(<SetPieceLeagueTable changes={changes} />)
    const tds = container.querySelectorAll('tbody tr td')
    const emDashCell = Array.from(tds).find((td) => td.textContent === '—')
    expect(emDashCell).toBeDefined()
  })

  it('shows "—" in FK column for a team with fk_danger_score null', () => {
    mockAggregateSetPieceLeague.mockReturnValue({
      ranked: [makeRow('EVE', 0.060, 0.060, null)],
      insufficient: [],
    })
    const changes = makeChanges([makeTeam('EVE', 0.060, null)])
    const { container } = render(<SetPieceLeagueTable changes={changes} />)
    const tds = container.querySelectorAll('tbody tr td')
    const emDashCell = Array.from(tds).find((td) => td.textContent === '—')
    expect(emDashCell).toBeDefined()
  })

  it('renders fallback message when all teams are in the insufficient section', () => {
    mockAggregateSetPieceLeague.mockReturnValue({
      ranked: [],
      insufficient: [makeRow('SOU', null, null, null)],
    })
    const changes = makeChanges([makeTeam('SOU', null, null)])
    const { container } = render(<SetPieceLeagueTable changes={changes} />)
    expect(container.textContent).toContain('No teams have sufficient set-piece delivery data yet')
  })
})
