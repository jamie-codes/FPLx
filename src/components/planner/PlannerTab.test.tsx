// @vitest-environment jsdom
// PLAN-01: the planning-horizon selector must actually re-plan.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import type { MergedPlayer } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

const generatePlanMock = vi.fn()

vi.mock('@/lib/planning-engine', async (orig) => {
  const actual = await orig<typeof import('@/lib/planning-engine')>()
  return {
    ...actual,
    generatePlan: (...args: unknown[]) => {
      generatePlanMock(...args)
      return { horizon: args[2], steps: [], originalSteps: [], totalGain: 0, totalHits: 0 }
    },
  }
})

// Child panels pull their own hooks; this file renders without a QueryClient.
vi.mock('./ChipStrategyPanel', () => ({ ChipStrategyPanel: () => <div data-testid="chip-panel" /> }))
vi.mock('@/components/club-form/FixtureHeatMap', () => ({ FixtureHeatMap: () => <div data-testid="heat-map" /> }))
vi.mock('./CaptainPlanStrip', () => ({ CaptainPlanStrip: () => <div data-testid="captain-strip" /> }))
vi.mock('./TransferPlanTable', () => ({ TransferPlanTable: () => <div data-testid="plan-table" /> }))

const playersMock = vi.fn()
const squadMock = vi.fn()
vi.mock('@/lib/hooks/usePlayers', () => ({ usePlayers: () => playersMock() }))
vi.mock('@/lib/hooks/useSquad', () => ({ useSquad: () => squadMock() }))
vi.mock('@/lib/hooks/useMyTeam', () => ({ useMyTeam: () => ({ data: undefined }) }))
vi.mock('@/lib/hooks/useAuthStatus', () => ({ useAuthStatus: () => ({ isAuthenticated: false }) }))
vi.mock('@/lib/hooks/useClubForm', () => ({ useClubForm: () => ({ data: [] }) }))

import { PlannerTab } from './PlannerTab'

function makePlayer(id: number, et: 1 | 2 | 3 | 4): MergedPlayer {
  return {
    id, code: 1000 + id, web_name: `P${id}`, team: 1, team_short_name: 'MUN', team_code: 1,
    element_type: et, now_cost: 50, selected_by_percent: '5.0', form: '3.0', status: 'a',
    minutes: 900, starts: 10, total_points: 50, goals_scored: 1, assists: 1,
    expected_goals: 1, expected_assists: 1, defensive_contribution: null,
    clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null,
    corners_and_indirect_freekicks_order: null, penalties_text: '', direct_freekicks_text: '',
    corners_and_indirect_freekicks_text: '', news: '', cost_change_event: 0, cost_change_start: 0,
    understat_id: null, xg_per90: 0.3, xa_per90: 0.2, minutes_per90: 88, form_pts_per90: 3,
    pts_last3gw: 9, pts_last5gw: 15, pts_gw_count: 5,
    fixtures: [{
      opponent_team: 'LIV', is_home: true, event_id: 1, difficulty_score: 0.5,
      difficulty_tier: 'medium', attacking_difficulty: 0.5, defensive_difficulty: 0.5,
    }],
    xPts_1gw: 4, xPts_3gw: 12, xPts_5gw: 20, xmins: 85, start_prob: 0.9, mins_risk: 'nailed',
  } as unknown as MergedPlayer
}

const ELEMENT_TYPES: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]

beforeEach(() => {
  generatePlanMock.mockClear()
  localStorage.setItem('fpl_team_id', '537955')
  const players = ELEMENT_TYPES.map((et, i) => makePlayer(i + 1, et))
  const picks: SquadPick[] = players.map((p, i) => ({
    element: p.id, position: i + 1, multiplier: 1, is_captain: false, is_vice_captain: false,
  }))
  playersMock.mockReturnValue({ data: players })
  squadMock.mockReturnValue({
    data: {
      active_chip: null, picks,
      entry_history: { event: 1, bank: 5, event_transfers: 0, event_transfers_cost: 0, value: 1000 },
    },
  })
})

function generate(container: HTMLElement) {
  const btn = Array.from(container.querySelectorAll('button'))
    .find(b => /generate/i.test(b.textContent ?? ''))
  expect(btn, 'a generate-plan button must exist').toBeTruthy()
  fireEvent.click(btn!)
}

describe('PlannerTab horizon (PLAN-01)', () => {
  it('re-plans when the horizon changes', () => {
    // The bug: `horizon` was read only inside the generate handler, so changing
    // the selector left the plan already on screen untouched — the buttons moved
    // and nothing else did.
    const { container, rerender } = render(<PlannerTab horizon={3} />)
    generate(container)
    expect(generatePlanMock).toHaveBeenCalledTimes(1)
    expect(generatePlanMock.mock.calls[0][2]).toBe(3)

    rerender(<PlannerTab horizon={5} />)
    expect(generatePlanMock).toHaveBeenCalledTimes(2)
    expect(generatePlanMock.mock.calls[1][2]).toBe(5)
  })

  it('does not plan on a horizon change before the user has generated one', () => {
    // Changing the horizon is not itself a request for a plan.
    const { rerender } = render(<PlannerTab horizon={3} />)
    rerender(<PlannerTab horizon={5} />)
    expect(generatePlanMock).not.toHaveBeenCalled()
  })

  it('accepts the 8-gameweek horizon', () => {
    const { container } = render(<PlannerTab horizon={8} />)
    generate(container)
    expect(generatePlanMock.mock.calls[0][2]).toBe(8)
  })

  it('re-rendering with an unchanged horizon does not re-plan', () => {
    const { container, rerender } = render(<PlannerTab horizon={3} />)
    generate(container)
    expect(generatePlanMock).toHaveBeenCalledTimes(1)
    rerender(<PlannerTab horizon={3} />)
    expect(generatePlanMock).toHaveBeenCalledTimes(1)
  })
})
