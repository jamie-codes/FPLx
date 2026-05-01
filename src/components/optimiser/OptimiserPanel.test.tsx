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

// Phase 45 mocks
const useAuthStatusMock = vi.fn()
const useMyTeamMock = vi.fn()
const suggestTransfersMock = vi.fn()

vi.mock('@/lib/hooks/useAuthStatus', () => ({
  useAuthStatus: () => useAuthStatusMock(),
}))
vi.mock('@/lib/hooks/useMyTeam', () => ({
  useMyTeam: (_enabled: boolean) => useMyTeamMock(),
}))
vi.mock('@/lib/suggest-transfers', () => ({
  suggestTransfers: (...args: unknown[]) => suggestTransfersMock(...args),
}))

// Phase 46 mocks
const buildOptimalSquadMock = vi.fn()
const computeBenchBoostXPtsMock = vi.fn()

vi.mock('@/lib/chip-modes', () => ({
  buildOptimalSquad: (...args: unknown[]) => buildOptimalSquadMock(...args),
  computeBenchBoostXPts: (...args: unknown[]) => computeBenchBoostXPtsMock(...args),
  CHIP_DEFAULT_BUDGET_TENTHS: 1000,
}))

// ChipSquadView mock — renders a simple testid so we can verify conditional rendering
vi.mock('./ChipSquadView', () => ({
  ChipSquadView: ({ chipMode }: { chipMode: string }) => (
    <div data-testid="chip-squad-view-mock" data-chipmode={chipMode}>ChipSquadView</div>
  ),
}))

// ChipModeToggle mock — renders testid buttons that fire real onChange calls
vi.mock('./ChipModeToggle', () => ({
  ChipModeToggle: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div data-testid="chip-mode-toggle-mock">
      <button data-testid="chip-toggle-wildcard-mock" onClick={() => onChange('wildcard')}>Wildcard</button>
      <button data-testid="chip-toggle-freehit-mock" onClick={() => onChange('free-hit')}>Free Hit</button>
      <button data-testid="chip-toggle-benchboost-mock" onClick={() => onChange('bench-boost')}>Bench Boost</button>
      <button data-testid="chip-toggle-none-mock" onClick={() => onChange('none')}>None</button>
    </div>
  ),
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
  useAuthStatusMock.mockReset()
  useMyTeamMock.mockReset()
  suggestTransfersMock.mockReset()
  // Default: unauthenticated, no my-team data, engine returns []. These defaults make every
  // existing Phase 44 test pass without modification (the transfer section becomes empty-state).
  useAuthStatusMock.mockReturnValue({ isAuthenticated: false, isLoading: false })
  useMyTeamMock.mockReturnValue({ data: undefined })
  suggestTransfersMock.mockReturnValue([])
  // Phase 46 defaults
  buildOptimalSquadMock.mockReturnValue(null)
  computeBenchBoostXPtsMock.mockReturnValue(0)
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
      // Use a fixture with a proper formation in the current XI (1GK+4DEF+3MID+3FWD = 4-3-3).
      // Make id=6 (MID in XI, pos=6) weak and id=12 (MID bench, pos=12) strong.
      // Engine swaps id=12 into XI, id=6 to bench. Changed MID rows get border-l-2 + delta pill.
      // elementTypes: [1,2,2,2,2,3,3,3,4,4,4,1,3,2,2]
      //   pos 1: GK(1), pos 2-5: DEF(2,3,4,5), pos 6-8: MID(6,7,8), pos 9-11: FWD(9,10,11)
      //   pos 12: GK bench(12-but make it MID by type), pos 13-15: bench
      // Simpler: elementTypes = [1,2,2,2,2,3,3,3,4,4,4,1,3,3,3] - keeps 1GK in XI
      const elementTypes: (1 | 2 | 3 | 4)[] = [1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 1, 3, 3, 3]
      const picks: SquadPick[] = []
      const players: MergedPlayer[] = []
      for (let i = 0; i < 15; i++) {
        const id = i + 1
        picks.push(makePick(id, i + 1))
        let p = makePlayer({ id, element_type: elementTypes[i] })
        if (id === 6) p = { ...p, xPts_1gw: 0.1, xPts_3gw: 0.3, xPts_5gw: 0.5 }   // weak MID in XI
        if (id === 13) p = { ...p, xPts_1gw: 99, xPts_3gw: 297, xPts_5gw: 495 }   // strong MID on bench
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
      // Use a stable fixture where the current XI matches what the engine would pick.
      // XI positions 1-11: 1GK + 4DEF + 3MID + 3FWD (formation 4-3-3). Bench: 1GK+1DEF+1MID+1MID.
      // All xPts equal -> engine picks ids 1-11 exactly -> no swap -> no changed rows.
      const elementTypes: (1 | 2 | 3 | 4)[] = [1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 1, 2, 3, 3]
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
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      const greenBordered = Array.from(container.querySelectorAll('[data-testid="comparison-table"] *'))
        .filter(el => (el as HTMLElement).className && (el as HTMLElement).className.toString().includes('border-l-green-500'))
      expect(greenBordered).toHaveLength(0)
      expect(container.querySelector('[data-testid="delta-pill"]')).toBeNull()
    })

    it('bench changed rows show Promoted or Dropped badge instead of a numeric delta', () => {
      // Use a stable fixture: 1GK+4DEF+3MID+3FWD in XI, bench has 1GK+3MID.
      // id=6 (MID in XI, pos=6) is weak; id=13 (MID bench, pos=13) is strong.
      // Engine promotes id=13 into XI. Bench slot previously holding id=13 now gets badge-promoted.
      const elementTypes: (1 | 2 | 3 | 4)[] = [1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 1, 3, 3, 3]
      const picks: SquadPick[] = []
      const players: MergedPlayer[] = []
      for (let i = 0; i < 15; i++) {
        const id = i + 1
        picks.push(makePick(id, i + 1))
        let p = makePlayer({ id, element_type: elementTypes[i] })
        if (id === 6) p = { ...p, xPts_1gw: 0.1, xPts_3gw: 0.3, xPts_5gw: 0.5 }   // weak MID in XI
        if (id === 13) p = { ...p, xPts_1gw: 99, xPts_3gw: 297, xPts_5gw: 495 }   // strong MID on bench
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
      // id=13 was on bench and gets promoted into XI — its bench slot shows the Promoted badge.
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
      // Build a fixture where the current XI is exactly what the engine would pick (no XI change).
      // Use element types: [1,2,2,2,2,2,3,3,3,4,4] for positions 1-11 (1 GK, 5 DEF, 3 MID, 2 FWD)
      // Bench (positions 12-15): [1,3,3,3] (1 GK, 3 MID).
      // All players equal xPts -> engine picks same 11 as current XI (stable sort by id).
      // No XI changes -> changeCount = 0, xPtsGain = 0.0 in headline.
      const elementTypes: (1 | 2 | 3 | 4)[] = [1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 1, 3, 3, 3]
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
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<OptimiserPanel teamId="1234567" />)
      const text = container.querySelector('[data-testid="headline-row"]')!.textContent ?? ''
      expect(text).toContain('Changes: 0 players')
      expect(text).toContain('+0.0 xPts gain')
    })

    it('singular "player" copy when changeCount === 1', () => {
      // Construct a fixture with exactly one starter swap and FWDs in the current XI
      // to prevent the engine from pulling bench FWDs as starters.
      // Element types: [1,2,2,2,2,2,3,3,3,4,4,1,3,3,3] (XI: 1GK+5DEF+3MID+2FWD; bench: 1GK+3MID)
      // id=9 (MID, position=9, in XI) gets xPts=0.1; id=13 (MID, position=13, bench) gets xPts=99.
      // Engine swaps id=13 into XI (for MID), id=9 to bench. Net = 1 starter swap.
      const elementTypes: (1 | 2 | 3 | 4)[] = [1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 1, 3, 3, 3]
      const picks: SquadPick[] = []
      const players: MergedPlayer[] = []
      for (let i = 0; i < 15; i++) {
        const id = i + 1
        picks.push(makePick(id, i + 1))
        let p = makePlayer({ id, element_type: elementTypes[i] })
        if (id === 9) p = { ...p, xPts_1gw: 0.1, xPts_3gw: 0.3, xPts_5gw: 0.5 }   // weak MID in XI
        if (id === 13) p = { ...p, xPts_1gw: 99, xPts_3gw: 297, xPts_5gw: 495 }    // strong MID on bench
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

describe('Phase 45: Transfer-aware mode (transfer suggestions)', () => {
  function setupValidLineup() {
    const { players, squadResp } = makeValidSquad()
    useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
    usePlayersMock.mockReturnValue({ data: players, isLoading: false })
  }

  it('renders transfer-suggestions-section when lineup is non-null', () => {
    setupValidLineup()
    const { container } = render(<OptimiserPanel teamId="1234567" />)
    expect(container.querySelector('[data-testid="transfer-suggestions-section"]')).not.toBeNull()
    expect(container.textContent).toContain('Transfer Suggestions')
  })

  it('FtToggle defaults to "1 FT" with aria-pressed=true on button 1', () => {
    setupValidLineup()
    const { container } = render(<OptimiserPanel teamId="1234567" />)
    const btn1 = container.querySelector('[data-testid="ft-toggle-1"]') as HTMLButtonElement | null
    const btn2 = container.querySelector('[data-testid="ft-toggle-2"]') as HTMLButtonElement | null
    expect(btn1).not.toBeNull()
    expect(btn2).not.toBeNull()
    expect(btn1!.getAttribute('aria-pressed')).toBe('true')
    expect(btn2!.getAttribute('aria-pressed')).toBe('false')
  })

  it('clicking "2 FTs" updates aria-pressed and re-invokes suggestTransfers with ftCount=2', () => {
    setupValidLineup()
    const { container } = render(<OptimiserPanel teamId="1234567" />)
    const btn2 = container.querySelector('[data-testid="ft-toggle-2"]') as HTMLButtonElement
    suggestTransfersMock.mockClear()  // clear initial mount call
    fireEvent.click(btn2)
    expect(btn2.getAttribute('aria-pressed')).toBe('true')
    // suggestTransfers called at least once after the click with ftCount: 2
    const calls = suggestTransfersMock.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const lastCall = calls[calls.length - 1][0] as { ftCount: 1 | 2 }
    expect(lastCall.ftCount).toBe(2)
  })

  it('renders empty state with locked copy when suggestTransfers returns []', () => {
    setupValidLineup()
    suggestTransfersMock.mockReturnValue([])
    const { container } = render(<OptimiserPanel teamId="1234567" />)
    const empty = container.querySelector('[data-testid="suggestions-empty-state"]')
    expect(empty).not.toBeNull()
    expect(empty!.textContent).toBe('Your current squad is already optimal for this horizon.')
  })

  it('renders FREE single suggestion row with Out/In names, FREE pill, and +X.X xPts; no break-even subline', () => {
    setupValidLineup()
    const { players } = makeValidSquad()
    suggestTransfersMock.mockReturnValue([
      {
        kind: 'single',
        sell: { ...players[0], id: 999, web_name: 'OutGuy' },
        buy: { ...players[0], id: 1000, web_name: 'InGuy' },
        cost: 0,
        xPtsGain: 2.5,
        xPtsGainPerGw: 2.5,
        breakEvenGws: null,
      },
    ])
    const { container } = render(<OptimiserPanel teamId="1234567" />)
    const row = container.querySelector('[data-testid="suggestion-row"]') as HTMLElement
    expect(row).not.toBeNull()
    expect(row.getAttribute('data-variant')).toBe('free')
    expect(row.textContent).toContain('OutGuy')
    expect(row.textContent).toContain('InGuy')
    expect(row.textContent).toContain('+2.5 xPts')
    expect(container.querySelector('[data-testid="cost-pill-free"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="cost-pill-free"]')!.textContent).toBe('FREE')
    // FREE rows have no break-even subline
    expect(container.querySelector('[data-testid="break-even"]')).toBeNull()
  })

  it('renders -4pts hit single suggestion with break-even subline (plural "GWs" when N > 1)', () => {
    setupValidLineup()
    const { players } = makeValidSquad()
    suggestTransfersMock.mockReturnValue([
      {
        kind: 'single',
        sell: { ...players[0], id: 999, web_name: 'OutHit' },
        buy: { ...players[0], id: 1000, web_name: 'InHit' },
        cost: 4,
        xPtsGain: 3.0,
        xPtsGainPerGw: 1.0,
        breakEvenGws: 4,
      },
    ])
    const { container } = render(<OptimiserPanel teamId="1234567" />)
    const row = container.querySelector('[data-testid="suggestion-row"]') as HTMLElement
    expect(row.getAttribute('data-variant')).toBe('hit')
    const pill = container.querySelector('[data-testid="cost-pill-hit"]')
    expect(pill).not.toBeNull()
    expect(pill!.textContent).toBe('-4pts')
    const breakEven = container.querySelector('[data-testid="break-even"]')
    expect(breakEven).not.toBeNull()
    expect(breakEven!.textContent).toBe('Breaks even in 4 GWs')
  })

  it('uses singular "GW" copy when breakEvenGws === 1', () => {
    setupValidLineup()
    const { players } = makeValidSquad()
    suggestTransfersMock.mockReturnValue([
      {
        kind: 'single',
        sell: { ...players[0], id: 999, web_name: 'OutHit' },
        buy: { ...players[0], id: 1000, web_name: 'InHit' },
        cost: 4,
        xPtsGain: 4.5,
        xPtsGainPerGw: 4.5,
        breakEvenGws: 1,
      },
    ])
    const { container } = render(<OptimiserPanel teamId="1234567" />)
    const breakEven = container.querySelector('[data-testid="break-even"]')
    expect(breakEven).not.toBeNull()
    expect(breakEven!.textContent).toBe('Breaks even in 1 GW')
    expect(breakEven!.textContent).not.toContain('GWs')
  })

  it('does not render transfer-suggestions-section when lineup is null (BGW critical state)', () => {
    // Force lineup === null by giving 5 BGW players → engine returns null in OptimiserPanel.
    const { picks } = makeValidSquad()
    const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
    const players: MergedPlayer[] = []
    for (let i = 0; i < 15; i++) {
      const id = i + 1
      const isBgw = [1, 3, 5, 8, 13].includes(id)
      players.push(makePlayer({ id, element_type: elementTypes[i], xPts_1gw: isBgw ? 0 : 5.0 }))
    }
    const squadResp: SquadPicksResponse = {
      active_chip: null,
      picks,
      entry_history: { event: 30, bank: 0, event_transfers: 0, event_transfers_cost: 0, value: 1000 },
    }
    useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
    usePlayersMock.mockReturnValue({ data: players, isLoading: false })
    const { container } = render(<OptimiserPanel teamId="1234567" />)
    // Transfer section not rendered in BGW-critical branch
    expect(container.querySelector('[data-testid="transfer-suggestions-section"]')).toBeNull()
  })

  it('passes empty Map for sellPrices when unauthenticated (D-11 fallback)', () => {
    useAuthStatusMock.mockReturnValue({ isAuthenticated: false, isLoading: false })
    useMyTeamMock.mockReturnValue({ data: undefined })
    setupValidLineup()
    suggestTransfersMock.mockClear()
    render(<OptimiserPanel teamId="1234567" />)
    // suggestTransfers should have been called at least once with sellPrices being a Map of size 0
    const calls = suggestTransfersMock.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const params = calls[calls.length - 1][0] as { sellPrices: Map<number, number> }
    expect(params.sellPrices).toBeInstanceOf(Map)
    expect(params.sellPrices.size).toBe(0)
  })
})

describe('Phase 46: Chip Modes (CHIP-01, CHIP-02, CHIP-03)', () => {
  // Shared valid lineup fixture (reuse from Phase 44/45 pattern — 2GK 5DEF 5MID 3FWD)
  function setupValidLineup() {
    // 15-player squad with a valid optimisable lineup
    const players = [
      makePlayer({ id: 1, element_type: 1, xPts_1gw: 4.0 }),
      makePlayer({ id: 2, element_type: 1, xPts_1gw: 2.0 }),
      makePlayer({ id: 3, element_type: 2, xPts_1gw: 5.0 }),
      makePlayer({ id: 4, element_type: 2, xPts_1gw: 4.5 }),
      makePlayer({ id: 5, element_type: 2, xPts_1gw: 4.0 }),
      makePlayer({ id: 6, element_type: 2, xPts_1gw: 3.5 }),
      makePlayer({ id: 7, element_type: 2, xPts_1gw: 3.0 }),
      makePlayer({ id: 8, element_type: 3, xPts_1gw: 8.0 }),
      makePlayer({ id: 9, element_type: 3, xPts_1gw: 7.0 }),
      makePlayer({ id: 10, element_type: 3, xPts_1gw: 6.0 }),
      makePlayer({ id: 11, element_type: 3, xPts_1gw: 5.0 }),
      makePlayer({ id: 12, element_type: 3, xPts_1gw: 4.0 }),
      makePlayer({ id: 13, element_type: 4, xPts_1gw: 7.0 }),
      makePlayer({ id: 14, element_type: 4, xPts_1gw: 6.0 }),
      makePlayer({ id: 15, element_type: 4, xPts_1gw: 5.0 }),
    ]
    const picks = players.map((p, i) => makePick(p.id, i + 1))
    const squadData: SquadPicksResponse = {
      active_chip: null,
      picks,
      entry_history: { event: 33, bank: 20, value: 1020, event_transfers: 1, event_transfers_cost: 0 },
    }
    useSquadMock.mockReturnValue({ data: squadData, isLoading: false, error: null })
    usePlayersMock.mockReturnValue({ data: players, isLoading: false })
    return { players, picks, squadData }
  }

  it('ChipModeToggle renders when squad is loaded (D-01)', () => {
    setupValidLineup()
    const { getByTestId } = render(<OptimiserPanel teamId="123" />)
    expect(getByTestId('chip-mode-toggle-mock')).toBeTruthy()
  })

  it('activating Wildcard calls buildOptimalSquad and renders ChipSquadView (CHIP-01, D-03)', () => {
    setupValidLineup()
    const mockChipResult = {
      squad: [],
      bestXI: [1, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14],
      formation: '5-3-2',
      budgetUsed: 800,
    }
    buildOptimalSquadMock.mockReturnValue(mockChipResult)
    const { getByTestId } = render(<OptimiserPanel teamId="123" />)
    fireEvent.click(getByTestId('chip-toggle-wildcard-mock'))
    expect(getByTestId('chip-squad-view-mock')).toBeTruthy()
    expect(getByTestId('chip-squad-view-mock').getAttribute('data-chipmode')).toBe('wildcard')
  })

  it('activating Wildcard hides the FT toggle (D-02, Pitfall 3)', () => {
    setupValidLineup()
    buildOptimalSquadMock.mockReturnValue({ squad: [], bestXI: [], formation: '4-3-3', budgetUsed: 800 })
    const { queryByTestId, getByTestId } = render(<OptimiserPanel teamId="123" />)
    // FT toggle visible initially (None mode)
    expect(queryByTestId('ft-toggle')).toBeTruthy()
    fireEvent.click(getByTestId('chip-toggle-wildcard-mock'))
    // FT toggle hidden in WC mode
    expect(queryByTestId('ft-toggle')).toBeNull()
  })

  it('activating Free Hit renders ChipSquadView with chipMode="free-hit" (CHIP-02)', () => {
    setupValidLineup()
    buildOptimalSquadMock.mockReturnValue({ squad: [], bestXI: [], formation: '4-4-2', budgetUsed: 850 })
    const { getByTestId } = render(<OptimiserPanel teamId="123" />)
    fireEvent.click(getByTestId('chip-toggle-freehit-mock'))
    expect(getByTestId('chip-squad-view-mock').getAttribute('data-chipmode')).toBe('free-hit')
  })

  it('activating Bench Boost preserves comparison table and shows bb-headline-row (CHIP-03, D-13)', () => {
    setupValidLineup()
    computeBenchBoostXPtsMock.mockReturnValue(8.5)
    const { getByTestId, queryByTestId } = render(<OptimiserPanel teamId="123" />)
    fireEvent.click(getByTestId('chip-toggle-benchboost-mock'))
    // Comparison table still rendered
    expect(getByTestId('comparison-table')).toBeTruthy()
    // BB headline replaces normal headline
    expect(getByTestId('bb-headline-row')).toBeTruthy()
    expect(queryByTestId('headline-row')).toBeNull()
  })

  it('activating Bench Boost shows BB notice (D-15)', () => {
    setupValidLineup()
    computeBenchBoostXPtsMock.mockReturnValue(6.0)
    const { getByTestId } = render(<OptimiserPanel teamId="123" />)
    fireEvent.click(getByTestId('chip-toggle-benchboost-mock'))
    expect(getByTestId('bb-notice')).toBeTruthy()
    expect(getByTestId('bb-notice').textContent).toContain('All 15 players score points')
  })

  it('activating Bench Boost keeps FT toggle visible (D-02)', () => {
    setupValidLineup()
    computeBenchBoostXPtsMock.mockReturnValue(5.0)
    const { getByTestId } = render(<OptimiserPanel teamId="123" />)
    fireEvent.click(getByTestId('chip-toggle-benchboost-mock'))
    expect(getByTestId('ft-toggle')).toBeTruthy()
  })

  it("buildOptimalSquad returning null shows amber warning banner (Claude's Discretion)", () => {
    setupValidLineup()
    buildOptimalSquadMock.mockReturnValue(null)
    const { getByTestId } = render(<OptimiserPanel teamId="123" />)
    fireEvent.click(getByTestId('chip-toggle-wildcard-mock'))
    expect(getByTestId('chip-squad-null-banner')).toBeTruthy()
  })

  it('Transfer Suggestions section is hidden when WC is active (D-03)', () => {
    setupValidLineup()
    buildOptimalSquadMock.mockReturnValue({ squad: [], bestXI: [], formation: '4-3-3', budgetUsed: 900 })
    const { queryByTestId, getByTestId } = render(<OptimiserPanel teamId="123" />)
    fireEvent.click(getByTestId('chip-toggle-wildcard-mock'))
    expect(queryByTestId('transfer-suggestions-section')).toBeNull()
  })
})
