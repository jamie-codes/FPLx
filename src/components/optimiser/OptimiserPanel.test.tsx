// Phase 43 (OPT-01..OPT-05): OptimiserPanel — full RTL integration tests.
// Mocks the data hooks; runs the real optimise-lineup engine; asserts UI state for
// empty / loading / error / BGW / valid-lineup branches.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import type { MergedPlayer } from '@/lib/types'
import type { SquadPick, SquadPicksResponse } from '@/lib/squad-adapter'

// ---------- Hook mocks (mutable per test) ----------
const useSquadMock = vi.fn()
const usePlayersMock = vi.fn()

vi.mock('@/lib/hooks/useSquad', () => ({
  useSquad: (id: string | null) => useSquadMock(id),
}))
vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: () => usePlayersMock(),
}))

// Import AFTER mocks
import { OptimiserPanel } from './OptimiserPanel'

// ---------- Test fixtures (mirrors src/lib/optimise-lineup.test.ts factories) ----------
function makePick(element: number, position: number): SquadPick {
  return { element, position, multiplier: 1, is_captain: false, is_vice_captain: false }
}

function makePlayer(overrides: Partial<MergedPlayer> & { id: number; element_type: 1 | 2 | 3 | 4 }): MergedPlayer {
  return {
    web_name: `P${overrides.id}`,
    team: 1,
    team_short_name: 'T1',
    now_cost: 50,
    selected_by_percent: '5.0',
    form: '0.0',
    status: 'a',
    minutes: 900,
    starts: 10,
    total_points: 50,
    goals_scored: 2,
    assists: 1,
    expected_goals: 1.5,
    expected_assists: 1.0,
    pts_last3gw: 12,
    pts_last5gw: 20,
    pts_gw_count: 5,
    defensive_contribution: null,
    clearances_blocks_interceptions: null,
    direct_freekicks_order: null,
    penalties_order: null,
    corners_and_indirect_freekicks_order: null,
    penalties_text: '',
    direct_freekicks_text: '',
    corners_and_indirect_freekicks_text: '',
    news: '',
    cost_change_event: 0,
    cost_change_start: 0,
    understat_id: null,
    xg_per90: null,
    xa_per90: null,
    minutes_per90: 80,
    form_pts_per90: 5.0,
    fixtures: [],
    xmins: 80,
    start_prob: 0.9,
    mins_risk: 'nailed',
    xPts_1gw: 5.0,
    xPts_3gw: 14.0,
    xPts_5gw: 22.0,
    xPts_90th_1gw: 7.0,
    ...overrides,
  } as MergedPlayer
}

function makeValidSquad(): { picks: SquadPick[]; players: MergedPlayer[]; squadResp: SquadPicksResponse } {
  const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
  const picks: SquadPick[] = []
  const players: MergedPlayer[] = []
  for (let i = 0; i < 15; i++) {
    const id = i + 1
    picks.push(makePick(id, i + 1))
    players.push(makePlayer({ id, element_type: elementTypes[i] }))
  }
  const squadResp: SquadPicksResponse = {
    active_chip: null,
    picks,
    entry_history: { event: 30, bank: 0, event_transfers: 0, event_transfers_cost: 0, value: 1000 },
  }
  return { picks, players, squadResp }
}

beforeEach(() => {
  useSquadMock.mockReset()
  usePlayersMock.mockReset()
})

describe('Phase 43: OptimiserPanel (UI integration)', () => {
  describe('Empty / loading / error states', () => {
    it('renders empty-state copy when teamId is empty (no submission)', () => {
      useSquadMock.mockReturnValue({ data: undefined, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: undefined, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="" />)
      expect(container.textContent).toContain('Enter your FPL Team ID to see your optimised lineup.')
    })

    it('renders Loading copy when squad is loading', () => {
      useSquadMock.mockReturnValue({ data: undefined, isLoading: true, error: null })
      usePlayersMock.mockReturnValue({ data: undefined, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      expect(container.textContent).toContain('Loading squad...')
    })

    it('renders red error panel with error.message when useSquad errors', () => {
      useSquadMock.mockReturnValue({ data: undefined, isLoading: false, error: new Error('Boom — 404 from FPL') })
      usePlayersMock.mockReturnValue({ data: [], isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      expect(container.textContent).toContain('Boom — 404 from FPL')
      expect(container.querySelector('.border-red-300')).not.toBeNull()
    })

    it('renders fallback error copy when error has empty message', () => {
      useSquadMock.mockReturnValue({ data: undefined, isLoading: false, error: new Error('') })
      usePlayersMock.mockReturnValue({ data: [], isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      expect(container.textContent).toContain('Unable to load squad data. Please try again.')
    })
  })

  describe('OPT-01 pitch + formation render', () => {
    it('renders the pitch div, the formation label, and a bench row when lineup is valid', () => {
      const { players, squadResp } = makeValidSquad()
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      expect(container.querySelector('[data-testid="pitch"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="formation-label"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="formation-label"]')!.textContent).toMatch(/Formation: \d-\d-\d/)
      expect(container.querySelector('[data-testid="bench-row"]')).not.toBeNull()
    })

    it('pitch has bg-green-950 class (green field background)', () => {
      const { players, squadResp } = makeValidSquad()
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      const pitch = container.querySelector('[data-testid="pitch"]')
      expect(pitch?.className).toContain('bg-green-950')
    })

    it('renders 11 player circles on the pitch (excluding the bench)', () => {
      const { players, squadResp } = makeValidSquad()
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      const allCirclesInPanel = container.querySelectorAll('[data-testid^="player-circle-"]')
      const benchCircles = container.querySelectorAll('[data-testid="bench-row"] [data-testid^="player-circle-"]')
      expect(allCirclesInPanel.length - benchCircles.length).toBe(11)
    })
  })

  describe('OPT-02 horizon toggle re-optimises', () => {
    it('clicking 5GW changes the formation/lineup output (horizon switch propagates)', () => {
      // Make horizon 1 lineup distinctly different from horizon 5 lineup.
      // DEF id=3: terrible 1gw, great 5gw. DEF id=7: great 1gw, terrible 5gw.
      const { picks } = makeValidSquad()
      const players: MergedPlayer[] = []
      const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
      for (let i = 0; i < 15; i++) {
        const id = i + 1
        let p = makePlayer({ id, element_type: elementTypes[i] })
        if (id === 3) p = { ...p, xPts_1gw: 0.1, xPts_3gw: 100, xPts_5gw: 100 }
        if (id === 7) p = { ...p, xPts_1gw: 9.9, xPts_3gw: 0.1, xPts_5gw: 0.1 }
        players.push(p)
      }
      const squadResp: SquadPicksResponse = {
        active_chip: null,
        picks,
        entry_history: { event: 30, bank: 0, event_transfers: 0, event_transfers_cost: 0, value: 1000 },
      }
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)

      // Helper: get starter circle ids (pitch > div children EXCLUDING the bench-row)
      const getStarterCircleIds = () => {
        const benchRow = container.querySelector('[data-testid="bench-row"]')
        return Array.from(container.querySelectorAll('[data-testid^="player-circle-"]'))
          .filter(n => !benchRow?.contains(n))
          .map(n => n.getAttribute('data-testid'))
      }

      // Default horizon = 1: id=7 (P7, xPts_1gw=9.9) should be a starter; id=3 (P3, xPts_1gw=0.1) should NOT.
      const initialStarterIds = getStarterCircleIds()
      expect(initialStarterIds).toContain('player-circle-7')
      expect(initialStarterIds).not.toContain('player-circle-3')

      // Click the 5GW toggle button (GwToggle renders "5 GW" — note the space)
      const fiveGwBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === '5 GW')
      expect(fiveGwBtn).toBeTruthy()
      fireEvent.click(fiveGwBtn!)

      // After toggle: id=3 (xPts_5gw=100) should now be a starter; id=7 (xPts_5gw=0.1) should NOT.
      const after5gwStarterIds = getStarterCircleIds()
      expect(after5gwStarterIds).toContain('player-circle-3')
      expect(after5gwStarterIds).not.toContain('player-circle-7')
    })
  })

  describe('OPT-03 captain / VC badges', () => {
    it('renders exactly one (C) badge and one (VC) badge on the pitch', () => {
      const { players, squadResp } = makeValidSquad()
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      const captainBadges = container.querySelectorAll('[data-testid^="captain-badge-"]')
      const vcBadges = container.querySelectorAll('[data-testid^="vc-badge-"]')
      expect(captainBadges).toHaveLength(1)
      expect(vcBadges).toHaveLength(1)
    })

    it('captain badge has amber colour class; VC badge has zinc colour class', () => {
      const { players, squadResp } = makeValidSquad()
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      const captainBadge = container.querySelector('[data-testid^="captain-badge-"]')!
      const vcBadge = container.querySelector('[data-testid^="vc-badge-"]')!
      expect(captainBadge.className).toContain('text-amber-400')
      expect(vcBadge.className).toContain('text-zinc-400')
      expect(captainBadge.textContent).toBe('(C)')
      expect(vcBadge.textContent).toBe('(VC)')
    })
  })

  describe('OPT-04 bench row layout', () => {
    it('bench row has GK slot at position 0 with "GK" label and a divider before outfield', () => {
      const { players, squadResp } = makeValidSquad()
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      expect(container.querySelector('[data-testid="bench-gk-slot"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="bench-gk-slot"]')!.textContent).toContain('GK')
      expect(container.querySelector('[data-testid="bench-divider"]')).not.toBeNull()
      const outfieldBenchSlots = container.querySelectorAll('[data-testid^="bench-outfield-"]')
      expect(outfieldBenchSlots).toHaveLength(3)
    })
  })

  describe('OPT-05 BGW critical banner', () => {
    it('renders amber critical banner when more than 4 players have xPts_1gw === 0 (engine returns null)', () => {
      // 5 BGW players -> 10 eligible -> engine returns null
      const { picks } = makeValidSquad()
      const players: MergedPlayer[] = []
      const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
      for (let i = 0; i < 15; i++) {
        const id = i + 1
        const isBgw = [1, 3, 5, 8, 13].includes(id)
        players.push(makePlayer({
          id,
          element_type: elementTypes[i],
          xPts_1gw: isBgw ? 0 : 5.0,
        }))
      }
      const squadResp: SquadPicksResponse = {
        active_chip: null,
        picks,
        entry_history: { event: 30, bank: 0, event_transfers: 0, event_transfers_cost: 0, value: 1000 },
      }
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      expect(container.querySelector('[data-testid="bgw-banner-critical"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="bgw-banner-critical"]')!.textContent).toContain('fewer than 11')
      expect(container.querySelector('[data-testid="pitch"]')).toBeNull()
    })

    it('renders soft amber banner when some BGW exclusions occur but engine still returns 11 starters', () => {
      // 2 BGW players -> 13 eligible -> engine still returns a lineup; soft banner shown
      const { picks } = makeValidSquad()
      const players: MergedPlayer[] = []
      const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
      for (let i = 0; i < 15; i++) {
        const id = i + 1
        const isBgw = [14, 15].includes(id)  // 2 FWDs BGW; remaining 1 FWD + 5 MID + 5 DEF + 2 GK = 13 eligible
        players.push(makePlayer({
          id,
          element_type: elementTypes[i],
          xPts_1gw: isBgw ? 0 : 5.0,
        }))
      }
      const squadResp: SquadPicksResponse = {
        active_chip: null,
        picks,
        entry_history: { event: 30, bank: 0, event_transfers: 0, event_transfers_cost: 0, value: 1000 },
      }
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      expect(container.querySelector('[data-testid="bgw-banner-soft"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="pitch"]')).not.toBeNull()
    })
  })
})
