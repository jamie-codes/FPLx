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

function team(id: number, short: string, fixtures: ClubFormFixture[], playedFixtures: ClubFormFixture[] = []): ClubForm {
  return {
    team_id: id,
    team_name: `Team ${short}`,
    team_short_name: short,
    wins: 0, draws: 0, losses: 0,
    goals_scored: 0, goals_conceded: 0,
    upcoming_fixtures: fixtures,
    current_gw_played: playedFixtures,
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
    expect(colHeaders.length).toBe(11)  // 1 team-name + 8 GW columns + Ease + Fx (planner)
    bodyRows.forEach(row => {
      const cells = row.querySelectorAll('th, td')
      expect(cells.length).toBe(11)
    })
  })

  it('HEAT-01: maps difficulty_tier to positive-soft/warning-soft/negative-soft tier classes', () => {
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
    expect(arsCell.className).toMatch(/bg-positive-soft/)
    expect(arsCell.className).toMatch(/text-positive/)
    expect(bhaCell.className).toMatch(/bg-warning-soft/)
    expect(bhaCell.className).toMatch(/text-warning/)
    expect(cheCell.className).toMatch(/bg-negative-soft/)
    expect(cheCell.className).toMatch(/text-negative/)
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

  it('HEAT-02: BGW cell is empty with bg-surface-2 and "No fixture (BGW)" tooltip', () => {
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
    expect(arsGw34Cell.className).toMatch(/bg-surface-2/)
    expect(arsGw34Cell.className).not.toMatch(/bg-(positive|warning|negative)-soft/)
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
    expect(colHeaders).toEqual(['GW34', 'GW35', 'GW36', 'GW37', 'GW38', 'GW39', 'GW40', 'GW41', 'Ease', 'Fx'])
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
    expect(container.querySelectorAll('thead th').length).toBe(11)
    const button = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.trim() === '16 GW'
    )!
    fireEvent.click(button)
    expect(container.querySelectorAll('thead th').length).toBe(19)
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
    expect(cell.className).toMatch(/bg-positive-soft/)
    const defBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'DEF'
    )!
    fireEvent.click(defBtn)
    cell = container.querySelector('tbody tr:nth-child(1) td')!
    expect(cell.className).toMatch(/bg-negative-soft/)
  })

  it('HEAT-08: owned-team rows carry bg-accent-soft + border-l-accent even when filter is OFF', () => {
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
    expect(arsRow.className).toMatch(/bg-accent-soft/)
    expect(arsRow.className).toMatch(/border-l-accent/)
    const bhaRow = container.querySelector('tbody tr:nth-child(2)')!
    expect(bhaRow.className).not.toMatch(/bg-accent-soft/)
    expect(bhaRow.className).not.toMatch(/border-l-accent/)
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
    expect(container.querySelectorAll('thead th').length).toBe(11)
    const ownedBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Owned only'
    )!
    fireEvent.click(ownedBtn)
    expect(container.querySelectorAll('thead th').length).toBe(11)
    expect(container.querySelectorAll('tbody tr').length).toBe(1)
  })

  // ===========================================================================
  // Planner (2026-08-29): GW window + best-run ranking + Ease/Fx columns
  // ===========================================================================

  it('PLAN-01: From-GW select shifts the window start (GW36 → columns GW36..41)', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', [34,35,36,37,38,39,40,41].map(gw => fix({ opp:'X', home:true, gw, tier:'easy' }))),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const select = container.querySelector('select[aria-label="From gameweek"]')!
    expect(select).not.toBeNull()
    fireEvent.change(select, { target: { value: '36' } })
    const colHeaders = Array.from(container.querySelectorAll('thead th')).slice(1).map(h => h.textContent?.trim())
    expect(colHeaders).toEqual(['GW36', 'GW37', 'GW38', 'GW39', 'GW40', 'GW41', 'Ease', 'Fx'])
  })

  it('PLAN-02: "Best run" sort ranks teams easiest window first; default stays A–Z', () => {
    const data: ClubForm[] = [
      team(1, 'AVL', [fix({ opp:'X', home:true, gw:34, tier:'hard', ad:0.71 })]),
      team(2, 'WHU', [fix({ opp:'X', home:true, gw:34, tier:'easy', ad:0.28 })]),
      team(3, 'MCI', [fix({ opp:'X', home:true, gw:34, tier:'medium', ad:0.5 })]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const heads = () => Array.from(container.querySelectorAll('tbody tr th[scope="row"]')).map(h => h.textContent?.trim())
    expect(heads()).toEqual(['AVL', 'MCI', 'WHU'])   // default alphabetical
    const btn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Best run'
    )!
    fireEvent.click(btn)
    expect(heads()).toEqual(['WHU', 'MCI', 'AVL'])   // easiest run first
  })

  it('PLAN-03: Ease and Fx columns render per team (ease bar + window fixture count)', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', [
        fix({ opp:'X', home:true, gw:34, tier:'easy', ad:0.28 }),
        fix({ opp:'Y', home:false, gw:35, tier:'easy', ad:0.28 }),
      ]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const row = container.querySelector('tbody tr:nth-child(1)')!
    expect(row.querySelector('[data-testid="ease-bar"]')).not.toBeNull()
    const cells = row.querySelectorAll('td')
    // trailing cells: [..., ease, fx]
    expect(cells[cells.length - 1].textContent?.trim()).toBe('2')
  })

  it('PLAN-04: team with no fixtures in the window shows — and sorts last under Best run', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', []),   // nothing upcoming in window
      team(2, 'WHU', [fix({ opp:'X', home:true, gw:34, tier:'hard', ad:0.71 })]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const btn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Best run'
    )!
    fireEvent.click(btn)
    const heads = Array.from(container.querySelectorAll('tbody tr th[scope="row"]')).map(h => h.textContent?.trim())
    expect(heads).toEqual(['WHU', 'ARS'])   // fixture-less team last despite alphabet
    const arsRow = container.querySelector('tbody tr:nth-child(2)')!
    const arsCells = arsRow.querySelectorAll('td')
    expect(arsCells[arsCells.length - 2].textContent?.trim()).toBe('—')
  })

  // ===========================================================================
  // Phase 81 SHD-02 — Row header crest
  // ===========================================================================

  it('SHD-02: row <th> has w-20 (not w-16)', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', [fix({ opp: 'X', home: true, gw: 34, tier: 'easy' })]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const rowHead = container.querySelector('tbody tr:nth-child(1) th[scope="row"]')!
    expect(rowHead).not.toBeNull()
    expect(rowHead.className).toMatch(/w-20/)
    expect(rowHead.className).not.toMatch(/w-16/)
  })

  it('SHD-02: row <th> renders an <img> crest adjacent to team abbrev for known team (ARS)', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', [fix({ opp: 'X', home: true, gw: 34, tier: 'easy' })]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const rowHead = container.querySelector('tbody tr:nth-child(1) th[scope="row"]')!
    const img = rowHead.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('src')).toContain('/badges/t3.png')
    expect(img!.className).toMatch(/w-5/)
    expect(img!.className).toMatch(/h-5/)
  })

  it('SHD-02: all 20 teams render a crest element (img or fallback span) in their row header', () => {
    mockUseClubForm.mockReturnValue({ data: build20TeamsAllEasy(), isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const rowHeads = Array.from(container.querySelectorAll('tbody tr th[scope="row"]'))
    expect(rowHeads.length).toBe(20)
    rowHeads.forEach(th => {
      const hasCrest = th.querySelector('img') !== null
      const hasFallback = th.querySelector('span.rounded-full') !== null || th.querySelector('[aria-label*="fallback"]') !== null
      expect(hasCrest || hasFallback).toBe(true)
    })
  })

  // ===========================================================================
  // Phase 111 FIX-01 — Played cell rendering
  // ===========================================================================

  it('FIX-01: played cell renders with difficulty color at opacity-40 and "— Played" tooltip', () => {
    const playedFix = fix({ opp: 'MCI', home: true, gw: 35, tier: 'easy' })
    const data: ClubForm[] = [
      team(1, 'ARS', [], [playedFix]),   // ARS played GW35, nothing upcoming
      team(2, 'CHE', [fix({ opp: 'BHA', home: true, gw: 35, tier: 'medium' })]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const arsRow = container.querySelector('tbody tr:nth-child(1)')!
    const arsCell = arsRow.querySelectorAll('td')[0]
    expect(arsCell.getAttribute('title')).toBe('MCI (H) — Played')
    expect(arsCell.className).toMatch(/opacity-40/)
    expect(arsCell.className).toMatch(/bg-positive-soft/)  // difficulty color preserved
  })

  it('FIX-01: played cell is visually distinct from BGW cell (not bg-surface-2, not "No fixture (BGW)")', () => {
    const playedFix = fix({ opp: 'MCI', home: true, gw: 35, tier: 'easy' })
    const data: ClubForm[] = [
      team(1, 'ARS', [], [playedFix]),
      team(2, 'CHE', [fix({ opp: 'BHA', home: true, gw: 35, tier: 'medium' })]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const arsRow = container.querySelector('tbody tr:nth-child(1)')!
    const arsCell = arsRow.querySelectorAll('td')[0]
    expect(arsCell.className).not.toMatch(/bg-surface-2/)
    expect(arsCell.getAttribute('title')).not.toBe('No fixture (BGW)')
  })

  it('FIX-01: true BGW cell unchanged — blank, bg-surface-2, "No fixture (BGW)"', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', [], []),  // no upcoming, no played → true BGW
      team(2, 'CHE', [fix({ opp: 'BHA', home: true, gw: 35, tier: 'medium' })]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const arsRow = container.querySelector('tbody tr:nth-child(1)')!
    const arsCell = arsRow.querySelectorAll('td')[0]
    expect(arsCell.className).toMatch(/bg-surface-2/)
    expect(arsCell.getAttribute('title')).toBe('No fixture (BGW)')
    expect(arsCell.textContent?.trim()).toBe('')
  })

  it('FIX-01: allEventIds includes played GW event_id when all teams have played (no upcoming)', () => {
    const playedFix = fix({ opp: 'MCI', home: true, gw: 35, tier: 'easy' })
    const data: ClubForm[] = [
      team(1, 'ARS', [], [playedFix]),
      team(2, 'CHE', [], [fix({ opp: 'BHA', home: false, gw: 35, tier: 'medium' })]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const colHeaders = Array.from(container.querySelectorAll('thead th')).slice(1).map(h => h.textContent?.trim())
    expect(colHeaders).toContain('GW35')
  })

  it('FIX-01: DGW played cell uses split-cell gradient with opacity-40', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', [], [
        fix({ opp: 'MCI', home: true, gw: 35, tier: 'easy' }),
        fix({ opp: 'CHE', home: false, gw: 35, tier: 'hard' }),
      ]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const arsRow = container.querySelector('tbody tr:nth-child(1)')!
    const arsCell = arsRow.querySelectorAll('td')[0]
    expect(arsCell.className).toMatch(/opacity-40/)
    const style = arsCell.getAttribute('style') ?? ''
    expect(style).toContain('linear-gradient')
  })

  // ===========================================================================
  // Phase 111 FIX-01 (gap) — Partially-played DGW (mixed state) — CR-01 closure
  // ===========================================================================

  it('FIX-01 (gap): partially-played DGW (1 upcoming + 1 played) tooltip contains both opponents and \'— Played\' marker', () => {
    const data: ClubForm[] = [
      team(1, 'ARS', [fix({ opp: 'PSG', home: true, gw: 35, tier: 'easy', ad: 0.28 })], [fix({ opp: 'MCI', home: true, gw: 35, tier: 'easy' })]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const arsRow = container.querySelector('tbody tr:nth-child(1)')!
    const arsCell = arsRow.querySelectorAll('td')[0]
    expect(arsCell.getAttribute('title')).toBe('PSG (H) — 0.28 / MCI (H) — Played')
    expect(arsCell.className).toMatch(/bg-positive-soft/)
    expect(arsCell.className).not.toMatch(/opacity-40/)
    expect(arsCell.querySelector('span')?.textContent).toBe('PSG')
    expect(arsCell.className).not.toMatch(/bg-surface-2/)
  })

  it('FIX-01 (gap): partially-played DGW (1 upcoming + 2 played) tooltip lists all three opponents in order', () => {
    const data: ClubForm[] = [
      team(1, 'BHA', [fix({ opp: 'LIV', home: false, gw: 35, tier: 'hard', ad: 0.71 })], [
        fix({ opp: 'MCI', home: true, gw: 35, tier: 'easy' }),
        fix({ opp: 'CHE', home: false, gw: 35, tier: 'hard' }),
      ]),
    ]
    mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
    const { container } = render(<FixtureHeatMap />)
    const bhaRow = container.querySelector('tbody tr:nth-child(1)')!
    const bhaCell = bhaRow.querySelectorAll('td')[0]
    expect(bhaCell.getAttribute('title')).toBe('LIV (A) — 0.71 / MCI (H) — Played / CHE (A) — Played')
    expect(bhaCell.querySelector('span')?.textContent).toBe('LIV')
    expect(bhaCell.className).not.toMatch(/opacity-40/)
  })
})
