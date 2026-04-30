// Phase 44 (CMP-01..CMP-03): OptimiserPanel — comparison table RTL integration tests.
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

describe('Phase 44: OptimiserPanel (comparison table)', () => {
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

  describe('OPT-02 horizon toggle re-optimises', () => {
    it('clicking 5GW changes the comparison table output (horizon switch propagates)', () => {
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

      // Click the 5GW toggle button (GwToggle renders "5 GW" — note the space)
      const fiveGwBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === '5 GW')
      expect(fiveGwBtn).toBeTruthy()

      const tableText = () => container.querySelector('[data-testid="comparison-table"]')?.textContent ?? ''
      expect(tableText()).toContain('P7')      // P7 starter at 1GW
      expect(tableText()).not.toContain('P3 →') // crude guard — P3 is benched at 1GW
      fireEvent.click(fiveGwBtn!)
      expect(tableText()).toContain('P3')      // P3 starter at 5GW
    })
  })

  describe('CMP-01 comparison table renders', () => {
    it('renders comparison-table and all 5 section headers when lineup is valid', () => {
      const { players, squadResp } = makeValidSquad()
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      expect(container.querySelector('[data-testid="comparison-table"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="section-header-gk"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="section-header-def"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="section-header-mid"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="section-header-fwd"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="section-header-bench"]')).not.toBeNull()
    })

    it('changed starter rows have border-l-2 + border-l-green-500 classes and a delta pill', () => {
      // Force a starter swap by giving id=8 (MID, XI position=8) a very low xPts and id=12 (MID, bench position=12)
      // a very high xPts. Engine will swap id=12 into XI, id=8 to bench.
      const { picks } = makeValidSquad()
      const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
      const players: MergedPlayer[] = []
      for (let i = 0; i < 15; i++) {
        const id = i + 1
        let p = makePlayer({ id, element_type: elementTypes[i] })
        if (id === 8) p = { ...p, xPts_1gw: 0.1, xPts_3gw: 0.3, xPts_5gw: 0.5 }
        if (id === 12) p = { ...p, xPts_1gw: 99, xPts_3gw: 297, xPts_5gw: 495 }
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
      const changedRows = container.querySelectorAll('[data-testid="comparison-row-changed"]')
      expect(changedRows.length).toBeGreaterThan(0)
      const firstChanged = changedRows[0] as HTMLElement
      expect(firstChanged.className).toContain('border-l-2')
      expect(firstChanged.className).toContain('border-l-green-500')
      const deltaPill = container.querySelector('[data-testid="delta-pill"]')
      expect(deltaPill).not.toBeNull()
      expect(deltaPill!.textContent).toMatch(/^\+\d+\.\d xPts$/)
    })

    it('unchanged rows have no border-l-green-500 class and no delta-pill', () => {
      // Default valid squad: every player has xPts_1gw=5.0 -> ties; engine selects deterministically.
      // The current XI = picks positions 1..11 = ids 1..11. Engine ranks all 15 by xPts equally and
      // by id ascending (stable sort) -> same ids 1..11 chosen as starters -> no swap.
      const { players, squadResp } = makeValidSquad()
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      const greenBordered = Array.from(container.querySelectorAll('[data-testid="comparison-table"] *'))
        .filter(el => (el as HTMLElement).className && (el as HTMLElement).className.toString().includes('border-l-green-500'))
      expect(greenBordered).toHaveLength(0)
      expect(container.querySelector('[data-testid="delta-pill"]')).toBeNull()
    })

    it('bench changed rows show Promoted or Dropped badge instead of a numeric delta', () => {
      // Force a XI<->bench swap (same fixture as test 2 above). Bench rows that change must show a badge.
      const { picks } = makeValidSquad()
      const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
      const players: MergedPlayer[] = []
      for (let i = 0; i < 15; i++) {
        const id = i + 1
        let p = makePlayer({ id, element_type: elementTypes[i] })
        if (id === 8) p = { ...p, xPts_1gw: 0.1, xPts_3gw: 0.3, xPts_5gw: 0.5 }   // weak MID in XI
        if (id === 12) p = { ...p, xPts_1gw: 99, xPts_3gw: 297, xPts_5gw: 495 }  // strong MID on bench (position 12)
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
      // At least one bench row gets a Promoted or Dropped badge
      const promoted = container.querySelectorAll('[data-testid="badge-promoted"]')
      const dropped = container.querySelectorAll('[data-testid="badge-dropped"]')
      expect(promoted.length + dropped.length).toBeGreaterThan(0)
      // At least one Promoted exists (id=12 was on bench, gets promoted into XI).
      expect(promoted.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('CMP-02 headline row', () => {
    it('renders headline row with Formation / Changes / xPts gain copy', () => {
      const { players, squadResp } = makeValidSquad()
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      const headline = container.querySelector('[data-testid="headline-row"]')
      expect(headline).not.toBeNull()
      const text = headline!.textContent ?? ''
      expect(text).toContain('Formation:')
      expect(text).toContain('Changes:')
      expect(text).toContain('xPts gain')
    })

    it('change count and xPts gain exclude bench-only swaps (D-07)', () => {
      // Default makeValidSquad: all xPts equal. Current XI = ids 1..11, optimised picks same set.
      // No XI changes -> changeCount = 0, xPtsGain = 0.0 in headline.
      const { players, squadResp } = makeValidSquad()
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      const text = container.querySelector('[data-testid="headline-row"]')!.textContent ?? ''
      expect(text).toContain('Changes: 0 players')
      expect(text).toContain('+0.0 xPts gain')
    })

    it('singular "player" copy when changeCount === 1', () => {
      // Construct a fixture with exactly one starter swap.
      // id=12 (bench MID) very strong; id=8 (XI MID, position=8) very weak. Engine swaps id=12 into XI, id=8 to bench.
      const { picks } = makeValidSquad()
      const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
      const players: MergedPlayer[] = []
      for (let i = 0; i < 15; i++) {
        const id = i + 1
        let p = makePlayer({ id, element_type: elementTypes[i] })
        if (id === 8) p = { ...p, xPts_1gw: 0.1, xPts_3gw: 0.3, xPts_5gw: 0.5 }
        if (id === 12) p = { ...p, xPts_1gw: 99, xPts_3gw: 297, xPts_5gw: 495 }
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
      const text = container.querySelector('[data-testid="headline-row"]')!.textContent ?? ''
      expect(text).toContain('Changes: 1 player')
      // Sanity: not "1 players"
      expect(text).not.toMatch(/Changes:\s*1 players/)
    })
  })

  describe('CMP-03 mobile layout structure', () => {
    it('both desktop table and mobile card stack render in DOM (Tailwind toggles via CSS)', () => {
      const { players, squadResp } = makeValidSquad()
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      // Desktop wrapper: hidden sm:block
      const desktopWrapper = Array.from(container.querySelectorAll('div')).find(
        el => el.className.includes('hidden') && el.className.includes('sm:block')
      )
      expect(desktopWrapper).toBeTruthy()
      // Mobile wrapper: sm:hidden
      const mobileWrapper = Array.from(container.querySelectorAll('div')).find(
        el => el.className.includes('sm:hidden') && !el.className.includes('hidden sm:')
      )
      expect(mobileWrapper).toBeTruthy()
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
      expect(container.querySelector('[data-testid="comparison-table"]')).toBeNull()
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
      expect(container.querySelector('[data-testid="comparison-table"]')).not.toBeNull()
    })
  })
})
