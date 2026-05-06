// Phase 66 HEAT-01/HEAT-02/HEAT-03 — failing tests for FixtureHeatMap
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ClubForm, ClubFormFixture, DifficultyTier } from '@/lib/types'

// Mock the hook BEFORE importing the component
const mockUseClubForm = vi.fn()
vi.mock('@/lib/hooks/useClubForm', () => ({
  useClubForm: () => mockUseClubForm(),
}))
const mockUseSquad = vi.fn()
vi.mock('@/lib/hooks/useSquad', () => ({
  useSquad: () => mockUseSquad(),
}))
const mockUsePlayers = vi.fn()
vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: () => mockUsePlayers(),
}))

import { FixtureHeatMap } from './FixtureHeatMap'

// --- Test fixture helpers ---
function fix(opts: { opp: string; home: boolean; gw: number; tier: DifficultyTier; ad?: number }): ClubFormFixture {
  return {
    opponent_team: opts.opp,
    is_home: opts.home,
    event_id: opts.gw,
    difficulty_score: opts.ad ?? (opts.tier === 'easy' ? 0.28 : opts.tier === 'medium' ? 0.5 : 0.71),
    difficulty_tier: opts.tier,
    attacking_difficulty: opts.ad ?? (opts.tier === 'easy' ? 0.28 : opts.tier === 'medium' ? 0.5 : 0.71),
    defensive_difficulty: 0.5,
  }
}

function team(id: number, short: string, fixtures: ClubFormFixture[]): ClubForm {
  return {
    team_id: id,
    team_name: `Team ${short}`,
    team_short_name: short,
    wins: 0, draws: 0, losses: 0,
    goals_scored: 0, goals_conceded: 0,
    upcoming_fixtures: fixtures,
    attacking_ease_1gw: null, attacking_ease_3gw: null, attacking_ease_5gw: null,
    defensive_ease_1gw: null, defensive_ease_3gw: null, defensive_ease_5gw: null,
    // Phase 47 swing fields — set to null; not consumed by this component
    past_ease_3gw: null,
    swing_1gw: null, swing_3gw: null, swing_5gw: null,
  } as ClubForm
}

// Build 20 teams, each with one easy fixture per event_id 34..41
function build20TeamsAllEasy(): ClubForm[] {
  const shorts = ['ARS','AVL','BHA','BOU','BRE','BUR','CHE','CRY','EVE','FUL','LEE','LIV','MCI','MUN','NEW','NFO','SUN','SOU','TOT','WHU']
  return shorts.map((s, i) => team(
    i + 1, s,
    [34,35,36,37,38,39,40,41].map(gw => fix({ opp: 'XXX', home: true, gw, tier: 'easy' }))
  ))
}

beforeEach(() => {
  mockUseClubForm.mockReset()
  mockUseSquad.mockReset()
  mockUsePlayers.mockReset()
  mockUseSquad.mockReturnValue({ data: undefined, isLoading: false, error: null })
  mockUsePlayers.mockReturnValue({ data: undefined, isLoading: false, error: null })
})

describe('FixtureHeatMap', () => {
  it('renders loading copy when isLoading=true', () => {
    mockUseClubForm.mockReturnValue({ data: undefined, isLoading: true, error: null })
    render(<FixtureHeatMap />)
    expect(screen.getByText('Loading fixture heat map...')).toBeTruthy()
  })

  it('renders error copy when error is set', () => {
    mockUseClubForm.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') })
    render(<FixtureHeatMap />)
    expect(screen.getByText(/Failed to load fixture data/)).toBeTruthy()
  })

  it('renders empty-state copy when data is []', () => {
    mockUseClubForm.mockReturnValue({ data: [], isLoading: false, error: null })
    render(<FixtureHeatMap />)
    expect(screen.getByText(/No fixture data available/)).toBeTruthy()
  })

  it('HEAT-01: renders 20 tbody rows × 8 GW columns when given 20 teams covering 8 event_ids', () => {
    mockUseClubForm.mockReturnValue({ data: build20TeamsAllEasy(), isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const bodyRows = container.querySelectorAll('tbody tr')
    expect(bodyRows.length).toBe(20)
    const colHeaders = container.querySelectorAll('thead th')
    expect(colHeaders.length).toBe(9)  // 1 team-name + 8 GW columns
    bodyRows.forEach(row => {
      const cells = row.querySelectorAll('th, td')
      expect(cells.length).toBe(9)
    })
  })

  it('HEAT-01: maps difficulty_tier to bg-{green|amber|red}-100/dark:900 classes', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', [fix({ opp: 'CHE', home: true, gw: 34, tier: 'easy' })]),
      team(2, 'BHA', [fix({ opp: 'CHE', home: true, gw: 34, tier: 'medium' })]),
      team(3, 'CHE', [fix({ opp: 'ARS', home: false, gw: 34, tier: 'hard' })]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const arsCell = container.querySelector('tbody tr:nth-child(1) td')!
    const bhaCell = container.querySelector('tbody tr:nth-child(2) td')!
    const cheCell = container.querySelector('tbody tr:nth-child(3) td')!
    expect(arsCell.className).toMatch(/bg-green-100/)
    expect(arsCell.className).toMatch(/dark:bg-green-900/)
    expect(bhaCell.className).toMatch(/bg-amber-100/)
    expect(bhaCell.className).toMatch(/dark:bg-amber-900/)
    expect(cheCell.className).toMatch(/bg-red-100/)
    expect(cheCell.className).toMatch(/dark:bg-red-900/)
  })

  it('HEAT-01 (D-08): single-fixture tooltip format "OPP (H/A) — 0.dd"', () => {
    const data: ClubForm[] = [
      team(1, 'BHA', [fix({ opp: 'ARS', home: true, gw: 34, tier: 'easy', ad: 0.28 })]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const cell = container.querySelector('tbody tr:nth-child(1) td')!
    expect(cell.getAttribute('title')).toBe('ARS (H) — 0.28')
  })

  it('HEAT-02 (D-03): DGW cell carries linear-gradient inline style', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', [
        fix({ opp: 'BHA', home: true, gw: 34, tier: 'easy' }),
        fix({ opp: 'CHE', home: false, gw: 34, tier: 'hard' }),
      ]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const cell = container.querySelector('tbody tr:nth-child(1) td')!
    const style = cell.getAttribute('style') ?? ''
    expect(style).toContain('linear-gradient')
    expect(style).toContain('to bottom right')
  })

  it('HEAT-02 (D-04): DGW tooltip format "OPP1 (H/A) 0.dd / OPP2 (H/A) 0.dd"', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', [
        fix({ opp: 'BHA', home: true, gw: 34, tier: 'easy', ad: 0.28 }),
        fix({ opp: 'CHE', home: false, gw: 34, tier: 'hard', ad: 0.71 }),
      ]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const cell = container.querySelector('tbody tr:nth-child(1) td')!
    expect(cell.getAttribute('title')).toBe('BHA (H) 0.28 / CHE (A) 0.71')
  })

  it('HEAT-02: BGW cell is empty with bg-zinc-50/dark:bg-zinc-900 and "No fixture (BGW)" tooltip', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', [fix({ opp: 'BHA', home: true, gw: 35, tier: 'easy' })]),  // BGW at gw34
      team(2, 'CHE', [
        fix({ opp: 'BHA', home: true, gw: 34, tier: 'medium' }),
        fix({ opp: 'BHA', home: true, gw: 35, tier: 'medium' }),
      ]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    // ARS row sorted before CHE alphabetically; ARS GW34 cell = BGW
    const arsRow = container.querySelector('tbody tr:nth-child(1)')!
    const arsGw34Cell = arsRow.querySelectorAll('td')[0]  // first td = first GW column = GW34
    expect(arsGw34Cell.className).toMatch(/bg-zinc-50/)
    expect(arsGw34Cell.className).toMatch(/dark:bg-zinc-900/)
    expect(arsGw34Cell.className).not.toMatch(/bg-(green|amber|red)-/)
    expect(arsGw34Cell.getAttribute('title')).toBe('No fixture (BGW)')
    expect(arsGw34Cell.textContent?.trim()).toBe('')
  })

  it('HEAT-03: outer container has overflow-x-auto, table has min-w-[640px]', () => {
    mockUseClubForm.mockReturnValue({ data: build20TeamsAllEasy(), isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const wrapper = container.querySelector('.overflow-x-auto')
    expect(wrapper).not.toBeNull()
    const table = container.querySelector('table')
    expect(table?.className).toMatch(/min-w-\[640px\]/)
  })

  it('D-02: columns derived from UNION of all teams\' event_ids, ordered ascending, first 8', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', [34,35,36,37,38,39,40,41].map(gw => fix({ opp:'XXX', home:true, gw, tier:'easy' }))),
      team(2, 'CHE', [35,36,37,38,39,40,41,42].map(gw => fix({ opp:'XXX', home:true, gw, tier:'easy' }))),  // BGW at 34
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const colHeaders = Array.from(container.querySelectorAll('thead th')).slice(1).map(h => h.textContent?.trim())
    expect(colHeaders).toEqual(['GW34', 'GW35', 'GW36', 'GW37', 'GW38', 'GW39', 'GW40', 'GW41'])
  })

  it('default sort: rows ordered alphabetically by team_short_name', () => {
    const data: ClubForm[] = [
      team(1, 'WHU', [fix({ opp:'X', home:true, gw:34, tier:'easy' })]),
      team(2, 'ARS', [fix({ opp:'X', home:true, gw:34, tier:'easy' })]),
      team(3, 'MCI', [fix({ opp:'X', home:true, gw:34, tier:'easy' })]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const rowHeads = Array.from(container.querySelectorAll('tbody tr th[scope="row"]')).map(h => h.textContent?.trim())
    expect(rowHeads).toEqual(['ARS', 'MCI', 'WHU'])
  })

  // ===========================================================================
  // Phase 75 HEAT-04..HEAT-08
  // ===========================================================================

  it('HEAT-04: single-fixture cell renders opponent abbreviation as text', () => {
    const data: ClubForm[] = [
      team(1, 'BHA', [fix({ opp: 'MCI', home: true, gw: 34, tier: 'easy' })]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const cell = container.querySelector('tbody tr:nth-child(1) td')!
    const label = cell.querySelector('span')
    expect(label).not.toBeNull()
    expect(label?.textContent).toBe('MCI')
    expect(label?.className).toMatch(/text-xs/)
    expect(label?.className).toMatch(/font-mono/)
  })

  it('HEAT-04: DGW cell renders TWO absolute-positioned opponent labels (top-left + bottom-right)', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', [
        fix({ opp: 'BHA', home: true, gw: 34, tier: 'easy' }),
        fix({ opp: 'CHE', home: false, gw: 34, tier: 'hard' }),
      ]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const cell = container.querySelector('tbody tr:nth-child(1) td')!
    expect(cell.className).toMatch(/relative/)
    const labels = cell.querySelectorAll('span')
    expect(labels.length).toBe(2)
    expect(labels[0].textContent).toBe('BHA')
    expect(labels[0].className).toMatch(/absolute/)
    expect(labels[0].className).toMatch(/top-0/)
    expect(labels[0].className).toMatch(/left-1/)
    expect(labels[1].textContent).toBe('CHE')
    expect(labels[1].className).toMatch(/absolute/)
    expect(labels[1].className).toMatch(/bottom-0/)
    expect(labels[1].className).toMatch(/right-1/)
  })

  it('HEAT-05: OwnedFilterToggle is disabled when submittedId is null', () => {
    mockUseClubForm.mockReturnValue({ data: build20TeamsAllEasy(), isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap submittedId={null} />)
    const button = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Owned only'
    )
    expect(button).not.toBeNull()
    expect(button!.hasAttribute('disabled')).toBe(true)
  })

  it('HEAT-05: clicking OwnedFilterToggle reduces tbody rows to owned teams only', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', [fix({ opp: 'X', home: true, gw: 34, tier: 'easy' })]),
      team(2, 'BHA', [fix({ opp: 'X', home: true, gw: 34, tier: 'easy' })]),
      team(3, 'CHE', [fix({ opp: 'X', home: true, gw: 34, tier: 'easy' })]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    mockUseSquad.mockReturnValue({
      data: { picks: [{ element: 100 }] },
      isLoading: false,
      error: null,
    })
    mockUsePlayers.mockReturnValue({
      data: [{ id: 100, team: 2 }],
      isLoading: false,
      error: null,
    })
    const { container } = render(<FixtureHeatMap submittedId="123" />)
    expect(container.querySelectorAll('tbody tr').length).toBe(3)
    const button = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Owned only'
    )!
    fireEvent.click(button)
    expect(container.querySelectorAll('tbody tr').length).toBe(1)
    const rowHead = container.querySelector('tbody tr th[scope="row"]')
    expect(rowHead?.textContent?.trim()).toBe('BHA')
  })

  it('HEAT-06: default horizon=8, clicking "16 GW" pill expands grid to 16 columns', () => {
    const shorts = ['ARS', 'BHA', 'CHE']
    const data: ClubForm[] = shorts.map((s, i) => team(
      i + 1, s,
      Array.from({ length: 16 }, (_, gwIdx) => fix({ opp: 'X', home: true, gw: 30 + gwIdx, tier: 'easy' }))
    ))
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    expect(container.querySelectorAll('thead th').length).toBe(9)
    const button = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.trim() === '16 GW'
    )!
    fireEvent.click(button)
    expect(container.querySelectorAll('thead th').length).toBe(17)
  })

  it('HEAT-07: ATT mode uses difficulty_tier; DEF mode applies tier() to defensive_difficulty', () => {
    const f: ClubFormFixture = {
      opponent_team: 'X',
      is_home: true,
      event_id: 34,
      difficulty_score: 0.2,
      difficulty_tier: 'easy',
      attacking_difficulty: 0.2,
      defensive_difficulty: 0.8,
    }
    const data: ClubForm[] = [team(1, 'ARS', [f])]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    let cell = container.querySelector('tbody tr:nth-child(1) td')!
    expect(cell.className).toMatch(/bg-green-100/)
    const defBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'DEF'
    )!
    fireEvent.click(defBtn)
    cell = container.querySelector('tbody tr:nth-child(1) td')!
    expect(cell.className).toMatch(/bg-red-100/)
  })

  it('HEAT-08: owned-team rows carry bg-blue-50 + border-l-blue-500 even when filter is OFF', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', [fix({ opp: 'X', home: true, gw: 34, tier: 'easy' })]),
      team(2, 'BHA', [fix({ opp: 'X', home: true, gw: 34, tier: 'easy' })]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    mockUseSquad.mockReturnValue({
      data: { picks: [{ element: 100 }] },
      isLoading: false,
      error: null,
    })
    mockUsePlayers.mockReturnValue({
      data: [{ id: 100, team: 1 }],
      isLoading: false,
      error: null,
    })
    const { container } = render(<FixtureHeatMap submittedId="123" />)
    const arsRow = container.querySelector('tbody tr:nth-child(1)')!
    expect(arsRow.className).toMatch(/bg-blue-50/)
    expect(arsRow.className).toMatch(/border-l-blue-500/)
    const bhaRow = container.querySelector('tbody tr:nth-child(2)')!
    expect(bhaRow.className).not.toMatch(/bg-blue-50/)
    expect(bhaRow.className).not.toMatch(/border-l-blue-500/)
  })

  it('HEAT-05 (Pitfall 3): toggling owned-only does NOT shrink the column set (allEventIds derived from full data)', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', [34,35,36,37,38,39,40,41].map(gw => fix({ opp: 'X', home: true, gw, tier: 'easy' }))),
      team(2, 'CHE', [34,35,36].map(gw => fix({ opp: 'X', home: true, gw, tier: 'easy' }))),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    mockUseSquad.mockReturnValue({
      data: { picks: [{ element: 100 }] },
      isLoading: false,
      error: null,
    })
    mockUsePlayers.mockReturnValue({
      data: [{ id: 100, team: 2 }],
      isLoading: false,
      error: null,
    })
    const { container } = render(<FixtureHeatMap submittedId="123" />)
    expect(container.querySelectorAll('thead th').length).toBe(9)
    const ownedBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Owned only'
    )!
    fireEvent.click(ownedBtn)
    expect(container.querySelectorAll('thead th').length).toBe(9)
    expect(container.querySelectorAll('tbody tr').length).toBe(1)
  })
})
