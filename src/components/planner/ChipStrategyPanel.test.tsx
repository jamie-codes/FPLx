// Phase 34: ChipStrategyPanel component tests
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import type { ScoredPlayer, ClubForm, ClubFormFixture } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

vi.mock('@/lib/hooks/useChipHistory', () => ({
  useChipHistory: vi.fn(),
}))

import { ChipStrategyPanel } from '@/components/planner/ChipStrategyPanel'
import { useChipHistory } from '@/lib/hooks/useChipHistory'

const mockedUseChipHistory = vi.mocked(useChipHistory)

function makeFx(event_id: number, attacking_difficulty: number): ClubFormFixture {
  return {
    opponent_team: 'OPP', is_home: true, event_id,
    difficulty_score: 0.5, difficulty_tier: 'medium',
    attacking_difficulty, defensive_difficulty: 0.5,
  }
}

function makeClubForm(team_id: number, fixtures: ClubFormFixture[]): ClubForm {
  return {
    team_id, team_name: `Team${team_id}`, team_short_name: `T${team_id}`,
    wins: 0, draws: 0, losses: 0, goals_scored: 0, goals_conceded: 0,
    upcoming_fixtures: fixtures,
    current_gw_played: [],   // Phase 111 FIX-01
    attacking_ease_1gw: null, attacking_ease_3gw: null, attacking_ease_5gw: null,
    defensive_ease_1gw: null, defensive_ease_3gw: null, defensive_ease_5gw: null,
    past_ease_3gw: null, swing_1gw: null, swing_3gw: null, swing_5gw: null,
  }
}

function makePlayer(p: { id: number; element_type: 1|2|3|4; team: number;
  xPts_1gw?: number; xPts_90th_1gw?: number; status?: string; now_cost?: number }): ScoredPlayer {
  return {
    id: p.id,
    web_name: `P${p.id}`,
    element_type: p.element_type,
    team: p.team,
    now_cost: p.now_cost ?? 50,
    status: p.status ?? 'a',
    xPts_1gw: p.xPts_1gw ?? 5.0,
    xPts_90th_1gw: p.xPts_90th_1gw,
    mins_risk: 'nailed',
    fixtures: [],
  } as unknown as ScoredPlayer
}

function makePick(element: number, position: number): SquadPick {
  return { element, position, multiplier: 0, is_captain: false, is_vice_captain: false }
}

// Build a deterministic full fixture set the panel can render against.
function makeProps(overrides?: Partial<Parameters<typeof ChipStrategyPanel>[0]>) {
  const teams = [1, 2, 3, 4, 5]
  const clubForm = teams.map(t => makeClubForm(t, [35,36,37,38,39].map(gw =>
    makeFx(gw, t === 1 && gw === 36 ? 0.1 : 0.5)  // GW36 easiest for team 1 -> drives best GW
  )))
  // 30 players across 5 teams, 6 per team, mix of positions covering FH formation
  const players: ScoredPlayer[] = []
  let id = 100
  for (const t of teams) {
    players.push(makePlayer({ id: id++, element_type: 1, team: t, now_cost: 45, xPts_1gw: 4.5, xPts_90th_1gw: 6 }))
    players.push(makePlayer({ id: id++, element_type: 1, team: t, now_cost: 40, xPts_1gw: 3.5 }))
    players.push(makePlayer({ id: id++, element_type: 2, team: t, now_cost: 55, xPts_1gw: 5.0, xPts_90th_1gw: 7 }))
    players.push(makePlayer({ id: id++, element_type: 2, team: t, now_cost: 50, xPts_1gw: 4.0 }))
    players.push(makePlayer({ id: id++, element_type: 3, team: t, now_cost: 80, xPts_1gw: 7.0, xPts_90th_1gw: 11 }))
    players.push(makePlayer({ id: id++, element_type: 4, team: t, now_cost: 90, xPts_1gw: 6.5, xPts_90th_1gw: 10 }))
  }
  const picks = [
    makePick(100, 1), makePick(101, 12),
    makePick(102, 2), makePick(103, 13),
    makePick(104, 3), makePick(105, 4),
    makePick(106, 14), makePick(107, 15),
    // Pad to 15 for realism, all positions assigned
    makePick(108, 5), makePick(109, 6), makePick(110, 7),
    makePick(111, 8), makePick(112, 9), makePick(113, 10), makePick(114, 11),
  ]
  return {
    teamId: '5000',
    scoredPlayers: players,
    clubForm,
    picks,
    bankBalance: 50,
    sellPrices: undefined,
    startingGw: 35,
    ...overrides,
  }
}

describe('Phase 34: ChipStrategyPanel component', () => {
  beforeEach(() => {
    mockedUseChipHistory.mockReset()
  })

  it('renders loading copy "Loading chip strategy…" when chip history is loading (CHIP-01/02/03)', () => {
    mockedUseChipHistory.mockReturnValue({ data: undefined, isLoading: true, error: null } as unknown as ReturnType<typeof useChipHistory>)
    const { container } = render(<ChipStrategyPanel {...makeProps()} />)
    expect(container.textContent).toContain('Loading chip strategy…')
  })

  it('renders error copy on fetch failure (CHIP-01/02/03)', () => {
    mockedUseChipHistory.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as unknown as ReturnType<typeof useChipHistory>)
    const { container } = render(<ChipStrategyPanel {...makeProps()} />)
    expect(container.textContent).toContain('Failed to load chip strategy. Check squad data and refresh.')
  })

  it('renders "Enter your FPL Team ID to see chip recommendations." when teamId is null', () => {
    mockedUseChipHistory.mockReturnValue({ data: [], isLoading: false, error: null } as unknown as ReturnType<typeof useChipHistory>)
    const { container } = render(<ChipStrategyPanel {...makeProps({ teamId: null })} />)
    expect(container.textContent).toContain('Enter your FPL Team ID to see chip recommendations.')
  })

  it('renders BB row with chip name, "Best: GW" label, and 5 ease cells (CHIP-01)', () => {
    mockedUseChipHistory.mockReturnValue({ data: [], isLoading: false, error: null } as unknown as ReturnType<typeof useChipHistory>)
    const { container } = render(<ChipStrategyPanel {...makeProps()} />)
    const row = container.querySelector('[data-testid="chip-row-bboost"]')
    expect(row).not.toBeNull()
    expect(row?.textContent).toContain('Bench Boost')
    expect(row?.textContent).toMatch(/Best: GW\d+/)
    const cells = row?.querySelectorAll('[data-testid^="ease-cell-bboost-"]')
    expect(cells?.length).toBe(5)
  })

  it('renders TC row with chip name, "Best: GW" label, and 5 ease cells (CHIP-02)', () => {
    mockedUseChipHistory.mockReturnValue({ data: [], isLoading: false, error: null } as unknown as ReturnType<typeof useChipHistory>)
    const { container } = render(<ChipStrategyPanel {...makeProps()} />)
    const row = container.querySelector('[data-testid="chip-row-3xc"]')
    expect(row).not.toBeNull()
    expect(row?.textContent).toContain('Triple Captain')
    expect(row?.textContent).toMatch(/Best: GW\d+/)
    const cells = row?.querySelectorAll('[data-testid^="ease-cell-3xc-"]')
    expect(cells?.length).toBe(5)
  })

  it('renders FH row with "Best: GW{N} — click for squad" and chevron (CHIP-03)', () => {
    mockedUseChipHistory.mockReturnValue({ data: [], isLoading: false, error: null } as unknown as ReturnType<typeof useChipHistory>)
    const { container } = render(<ChipStrategyPanel {...makeProps()} />)
    const row = container.querySelector('[data-testid="chip-row-freehit"]')
    expect(row).not.toBeNull()
    expect(row?.textContent).toContain('Free Hit')
    expect(row?.textContent).toContain('click for squad')
    expect(row?.getAttribute('aria-expanded')).toBe('false')
    // chevron present
    expect(row?.textContent).toContain('▾')
  })

  it('expands FH row on click revealing FHSquadTable (CHIP-03)', () => {
    mockedUseChipHistory.mockReturnValue({ data: [], isLoading: false, error: null } as unknown as ReturnType<typeof useChipHistory>)
    const { container } = render(<ChipStrategyPanel {...makeProps()} />)
    const row = container.querySelector('[data-testid="chip-row-freehit"]') as HTMLElement
    fireEvent.click(row)
    expect(row.getAttribute('aria-expanded')).toBe('true')
    const table = container.querySelector('[data-testid="fh-squad-table"]')
    expect(table).not.toBeNull()
    expect(row.textContent).toContain('▴')
  })

  it('toggles FH expansion on Enter and Space keyboard with Space preventDefault (CHIP-03)', () => {
    mockedUseChipHistory.mockReturnValue({ data: [], isLoading: false, error: null } as unknown as ReturnType<typeof useChipHistory>)
    const { container } = render(<ChipStrategyPanel {...makeProps()} />)
    const row = container.querySelector('[data-testid="chip-row-freehit"]') as HTMLElement
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(row.getAttribute('aria-expanded')).toBe('true')
    const spaceEvent = fireEvent.keyDown(row, { key: ' ' })
    // After two toggles -> collapsed
    expect(row.getAttribute('aria-expanded')).toBe('false')
    // The Space event should have been default-prevented (jsdom returns false when preventDefault called)
    expect(spaceEvent).toBe(false)
  })

  it('greys used chip rows with opacity-40 and shows "Used GW{N}" label', () => {
    mockedUseChipHistory.mockReturnValue({
      data: [{ name: 'bboost', time: 't', event: 12 }],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useChipHistory>)
    const { container } = render(<ChipStrategyPanel {...makeProps()} />)
    const row = container.querySelector('[data-testid="chip-row-bboost"]')
    expect(row?.className).toContain('opacity-40')
    expect(row?.getAttribute('aria-disabled')).toBe('true')
    expect(row?.textContent).toContain('Used GW12')
  })
})
