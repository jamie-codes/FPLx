// Phase 72 (LINEUP-01): RTL component tests for LineupTab.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import type { MergedPlayer } from '@/lib/types'
import type { SquadPick, SquadPicksResponse } from '@/lib/squad-adapter'

// ---------- Hook mocks (mutable per test — declared BEFORE the component import) ----------
const useSquadMock = vi.fn()
const usePlayersMock = vi.fn()

vi.mock('@/lib/hooks/useSquad', () => ({
  useSquad: (id: string | null) => useSquadMock(id),
}))
vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: () => usePlayersMock(),
}))

// Import AFTER mocks (vi.mock hoisting requirement)
import { LineupTab } from './LineupTab'

// ---------- Test fixtures (mirrors OptimiserPanel.test.tsx factories) ----------

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
  // Clear any localStorage state set by prior tests (D-08 contract).
  // Using removeItem loops since some test environments don't provide localStorage.clear().
  try { localStorage.clear() } catch { /* test env may not support .clear() — no-op */ }
})

function setupValidLineup() {
  const { players, squadResp } = makeValidSquad()
  useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
  usePlayersMock.mockReturnValue({ data: players, isLoading: false })
  return { players, squadResp }
}

// ---------- Tests ----------

describe('Phase 72: LineupTab', () => {
  describe('LINEUP-01e empty / loading / error states', () => {
    it('empty state when no team id', () => {
      useSquadMock.mockReturnValue({ data: undefined, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: undefined, isLoading: false })
      const { container } = render(<LineupTab teamId="" />)
      expect(container.textContent).toContain('Enter your FPL Team ID on the Transfers tab')
      expect(container.querySelector('[data-testid="pitch"]')).toBeNull()
    })

    it('loading state', () => {
      useSquadMock.mockReturnValue({ data: undefined, isLoading: true, error: null })
      usePlayersMock.mockReturnValue({ data: undefined, isLoading: false })
      const { container } = render(<LineupTab teamId="123" />)
      expect(container.textContent).toContain('Loading squad...')
    })

    it('BGW critical banner when optimiseLineup returns null and eligibleCount < 11', () => {
      // Build a squad where 10 of 15 players have xPts_1gw === 0 (BGW) → eligibleCount = 5 < 11
      const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
      const picks: SquadPick[] = []
      const players: MergedPlayer[] = []
      for (let i = 0; i < 15; i++) {
        const id = i + 1
        picks.push(makePick(id, i + 1))
        // First 5 players keep xPts_1gw = 5.0 (default); remaining 10 get xPts_1gw = 0 (BGW)
        const xPts = i < 5 ? 5.0 : 0
        players.push(makePlayer({ id, element_type: elementTypes[i], xPts_1gw: xPts }))
      }
      const squadResp: SquadPicksResponse = {
        active_chip: null,
        picks,
        entry_history: { event: 30, bank: 0, event_transfers: 0, event_transfers_cost: 0, value: 1000 },
      }
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<LineupTab teamId="123" />)
      expect(container.querySelector('[data-testid="bgw-banner-critical"]')).not.toBeNull()
      expect(container.textContent).toContain('fewer than 11 eligible starters')
    })
  })

  describe('LINEUP-01d pitch render', () => {
    it('renders pitch with formation rows', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      // 5 rows present
      expect(container.querySelector('[data-testid="pitch-row-gk"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="pitch-row-def"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="pitch-row-mid"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="pitch-row-fwd"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="pitch-row-bench"]')).not.toBeNull()
      // Total starters = 11 (across the 4 XI rows)
      const xiCards = container.querySelectorAll('[data-testid="pitch-row-gk"] [data-testid^="pitch-card-"], [data-testid="pitch-row-def"] [data-testid^="pitch-card-"], [data-testid="pitch-row-mid"] [data-testid^="pitch-card-"], [data-testid="pitch-row-fwd"] [data-testid^="pitch-card-"]')
      expect(xiCards.length).toBe(11)
      // Bench has 4 cards
      const benchCards = container.querySelectorAll('[data-testid="pitch-row-bench"] [data-testid^="pitch-card-"]')
      expect(benchCards.length).toBe(4)
    })

    it('card content shows web_name + xPts + start_prob percentage', () => {
      // Override player 1 with distinctive values to assert formatting
      const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
      const players: MergedPlayer[] = []
      const picks: SquadPick[] = []
      for (let i = 0; i < 15; i++) {
        const id = i + 1
        picks.push(makePick(id, i + 1))
        const overrides: Partial<MergedPlayer> & { id: number; element_type: 1 | 2 | 3 | 4 } = {
          id, element_type: elementTypes[i],
        }
        if (id === 1) {
          overrides.web_name = 'Salah'
          overrides.xPts_1gw = 7.42
          overrides.start_prob = 0.78
        }
        players.push(makePlayer(overrides))
      }
      const squadResp: SquadPicksResponse = {
        active_chip: null,
        picks,
        entry_history: { event: 30, bank: 0, event_transfers: 0, event_transfers_cost: 0, value: 1000 },
      }
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<LineupTab teamId="123" />)
      const card = container.querySelector('[data-testid="pitch-card-1"]')
      expect(card).not.toBeNull()
      expect(card!.textContent).toContain('Salah')
      expect(card!.textContent).toContain('7.4')      // .toFixed(1)
      expect(card!.textContent).toContain('78%')      // Math.round(0.78 * 100)
    })

    it('captain badge appears on captain card; vc badge on vc card', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      const captainBadge = container.querySelector('[data-testid="captain-badge"]')
      const vcBadge = container.querySelector('[data-testid="vc-badge"]')
      expect(captainBadge).not.toBeNull()
      expect(captainBadge!.textContent).toBe('C')
      expect(vcBadge).not.toBeNull()
      expect(vcBadge!.textContent).toBe('VC')
    })
  })

  describe('LINEUP-01d swap interaction', () => {
    it('arm and disarm — tap a starter twice', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      // Pick the first DEF starter card (id 3 — DEFs are ids 3-7 per makeValidSquad)
      const card = container.querySelector('[data-testid="pitch-card-3"]') as HTMLButtonElement
      expect(card).not.toBeNull()
      fireEvent.click(card)
      expect(card.getAttribute('data-pending')).toBe('true')
      fireEvent.click(card)
      expect(card.getAttribute('data-pending')).toBeNull()
    })

    it('compatible bench highlight: armed starter highlights legal bench targets and dims incompatible', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      // Arm a DEF starter (id 3)
      const defCard = container.querySelector('[data-testid="pitch-card-3"]') as HTMLButtonElement
      fireEvent.click(defCard)
      // At least one bench card must be a legal target
      const legalCards = container.querySelectorAll('[data-testid="pitch-row-bench"] [data-legal-target="true"]')
      expect(legalCards.length).toBeGreaterThanOrEqual(1)
      // The bench GK must be incompatible (DEF cannot swap with GK)
      // makeValidSquad: ids 1,2 are GKs; one will be on bench after optimiseLineup picks 11.
      const benchCards = Array.from(container.querySelectorAll('[data-testid="pitch-row-bench"] [data-testid^="pitch-card-"]')) as HTMLButtonElement[]
      const benchGkCard = benchCards.find(c => {
        const id = Number(c.getAttribute('data-testid')!.replace('pitch-card-', ''))
        return id === 1 || id === 2   // one of the two GKs is on the bench
      })
      expect(benchGkCard).not.toBeUndefined()
      expect(benchGkCard!.disabled).toBe(true)   // GK bench is incompatible when DEF starter armed
    })

    it('GK only swaps with GK: armed GK starter highlights only bench GK', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      // Find the GK starter (only id in the GK row)
      const gkRowCards = container.querySelectorAll('[data-testid="pitch-row-gk"] [data-testid^="pitch-card-"]')
      expect(gkRowCards.length).toBe(1)
      const gkStarterCard = gkRowCards[0] as HTMLButtonElement
      fireEvent.click(gkStarterCard)
      // Exactly one bench card has data-legal-target="true" (the bench GK)
      const legalBenchCards = container.querySelectorAll('[data-testid="pitch-row-bench"] [data-legal-target="true"]')
      expect(legalBenchCards.length).toBe(1)
      // The other 3 bench cards are incompatible (disabled)
      const disabledBenchCards = Array.from(container.querySelectorAll('[data-testid="pitch-row-bench"] [data-testid^="pitch-card-"]'))
        .filter(c => (c as HTMLButtonElement).disabled)
      expect(disabledBenchCards.length).toBe(3)
    })

    it('executes swap: arm starter, click legal bench, lineup state updates', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      // Find a DEF starter and a DEF bench card (same-position swap is always legal).
      // Per makeValidSquad: ids 3-7 are DEFs; one will be on bench after optimiseLineup picks 11.
      const defCard = container.querySelector('[data-testid="pitch-card-3"]') as HTMLButtonElement | null
      const benchDefCard = Array.from(container.querySelectorAll('[data-testid="pitch-row-bench"] [data-legal-target="true"]'))[0] as HTMLButtonElement | undefined
      if (!defCard || !benchDefCard) {
        // If id 3 wasn't a starter, retry with id 4
        const altDefCard = container.querySelector('[data-testid="pitch-card-4"]') as HTMLButtonElement
        fireEvent.click(altDefCard)
      } else {
        fireEvent.click(defCard)
      }
      // After arming, click the first legal bench card
      const legal = container.querySelector('[data-testid="pitch-row-bench"] [data-legal-target="true"]') as HTMLButtonElement
      expect(legal).not.toBeNull()
      const swappedInId = Number(legal.getAttribute('data-testid')!.replace('pitch-card-', ''))
      fireEvent.click(legal)
      // After swap: the swapped-in id is now in an XI row, no longer in bench row
      const benchIds = Array.from(container.querySelectorAll('[data-testid="pitch-row-bench"] [data-testid^="pitch-card-"]'))
        .map(c => Number(c.getAttribute('data-testid')!.replace('pitch-card-', '')))
      expect(benchIds).not.toContain(swappedInId)
      // Pending state cleared
      const stillPending = container.querySelector('[data-pending="true"]')
      expect(stillPending).toBeNull()
    })

    it('Reset restores algorithm original lineup', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      // Snapshot the initial bench id at row 0 (bench GK)
      const initialBenchIds = Array.from(container.querySelectorAll('[data-testid="pitch-row-bench"] [data-testid^="pitch-card-"]'))
        .map(c => c.getAttribute('data-testid')!.replace('pitch-card-', ''))
      const initialFormation = container.querySelector('[data-testid="lineup-headline-row"]')!.textContent
      // Perform an arbitrary legal swap: arm any starter and click any legal bench
      const defStarter = container.querySelector('[data-testid="pitch-row-def"] [data-testid^="pitch-card-"]') as HTMLButtonElement
      fireEvent.click(defStarter)
      const legalTarget = container.querySelector('[data-testid="pitch-row-bench"] [data-legal-target="true"]') as HTMLButtonElement | null
      if (legalTarget) {
        fireEvent.click(legalTarget)
        // Verify state changed
        const afterSwapBenchIds = Array.from(container.querySelectorAll('[data-testid="pitch-row-bench"] [data-testid^="pitch-card-"]'))
          .map(c => c.getAttribute('data-testid')!.replace('pitch-card-', ''))
        expect(afterSwapBenchIds).not.toEqual(initialBenchIds)
      }
      // Click Reset
      const resetBtn = container.querySelector('[data-testid="lineup-reset"]') as HTMLButtonElement
      fireEvent.click(resetBtn)
      // Bench ids return to initial
      const restoredBenchIds = Array.from(container.querySelectorAll('[data-testid="pitch-row-bench"] [data-testid^="pitch-card-"]'))
        .map(c => c.getAttribute('data-testid')!.replace('pitch-card-', ''))
      expect(restoredBenchIds).toEqual(initialBenchIds)
      const restoredFormation = container.querySelector('[data-testid="lineup-headline-row"]')!.textContent
      expect(restoredFormation).toBe(initialFormation)
    })

    it('no localStorage persistence (D-08 session-only)', () => {
      setupValidLineup()
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
      const { container } = render(<LineupTab teamId="123" />)
      // Perform a swap
      const defStarter = container.querySelector('[data-testid="pitch-row-def"] [data-testid^="pitch-card-"]') as HTMLButtonElement
      fireEvent.click(defStarter)
      const legalTarget = container.querySelector('[data-testid="pitch-row-bench"] [data-legal-target="true"]') as HTMLButtonElement | null
      if (legalTarget) fireEvent.click(legalTarget)
      // localStorage.setItem must not have been called with any lineup-related key
      const lineupCalls = setItemSpy.mock.calls.filter(([k]) =>
        typeof k === 'string' && /lineup|override|swap/i.test(k)
      )
      expect(lineupCalls.length).toBe(0)
      setItemSpy.mockRestore()
    })
  })
})
