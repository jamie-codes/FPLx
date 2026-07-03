// @vitest-environment jsdom
// UIX-02 Tasks 2+3: Home command centre — presentational components + orchestration.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { MergedPlayer } from '@/lib/types'
import type { SquadPick, SquadPicksResponse } from '@/lib/squad-adapter'

// ---------- Hook mocks (mutable per test — declared BEFORE the component import) ----------
const usePlayersMock = vi.fn()
const useSquadMock = vi.fn()
const useNextDeadlineMock = vi.fn()
const useClubFormMock = vi.fn()
const suggestTransfersMock = vi.fn()

vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: () => usePlayersMock(),
}))
vi.mock('@/lib/hooks/useSquad', () => ({
  useSquad: (id: string | null) => useSquadMock(id),
}))
vi.mock('@/lib/hooks/useNextDeadline', () => ({
  useNextDeadline: () => useNextDeadlineMock(),
}))
vi.mock('@/lib/hooks/useClubForm', () => ({
  useClubForm: () => useClubFormMock(),
}))
// Wiring pin (spec Testing §): Home must call the real engine module with
// horizon 1 / ftCount 1 / public bank — mocked here so the call args are assertable.
vi.mock('@/lib/suggest-transfers', () => ({
  suggestTransfers: (params: unknown) => suggestTransfersMock(params),
}))

// Import AFTER mocks (vi.mock hoisting requirement)
import { HomeTab } from './HomeTab'
import { SquadStrip } from './SquadStrip'
import { ActionCards } from './ActionCards'

// ---------- Fixtures (mirrors LineupTab.test.tsx factories) ----------

function mkPlayer(over: Partial<MergedPlayer>): MergedPlayer {
  return {
    id: 0,
    web_name: 'Player',
    team: 1,
    team_short_name: 'XXX',
    element_type: 3,
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
    ...over,
  } as MergedPlayer
}

function mkPick(element: number, position: number): SquadPick {
  return { element, position, multiplier: 1, is_captain: false, is_vice_captain: false }
}

const ELEMENT_TYPES: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]

/** 15-man squad: id 8 (MID) is the clear captain (xPts 8.0); id 5 (DEF) is a
 * minutes_trap (£8.0m rotation risk, start_prob 0.5) → riskCount 1. */
function makeSquadFixture() {
  const picks: SquadPick[] = []
  const players: MergedPlayer[] = []
  for (let i = 0; i < 15; i++) {
    const id = i + 1
    picks.push(mkPick(id, i + 1))
    players.push(
      mkPlayer({
        id,
        web_name: `P${id}`,
        element_type: ELEMENT_TYPES[i],
        ...(id === 8 ? { xPts_1gw: 8.0, xPts_90th_1gw: 11.0 } : {}),
        ...(id === 5 ? { now_cost: 80, mins_risk: 'rotation_risk', start_prob: 0.5 } : {}),
      }),
    )
  }
  const poolStar = mkPlayer({ id: 100, web_name: 'PoolStar', element_type: 4, xPts_1gw: 9.0 })
  const squadResp: SquadPicksResponse = {
    active_chip: null,
    picks,
    entry_history: { event: 30, bank: 5, event_transfers: 0, event_transfers_cost: 0, value: 1000 },
  }
  return { picks, players: [...players, poolStar], squadResp, poolStar }
}

const FUTURE_DEADLINE = { id: 31, deadline_time: new Date(Date.now() + 3 * 86_400_000).toISOString() }

function setHooks({
  players,
  squad,
  deadline,
}: {
  players: MergedPlayer[]
  squad: SquadPicksResponse | undefined
  deadline: { id: number; deadline_time: string } | null | undefined
}) {
  usePlayersMock.mockReturnValue({ data: players, isLoading: false, error: null })
  useSquadMock.mockReturnValue({ data: squad, isLoading: false, error: squad ? null : new Error('x') })
  useNextDeadlineMock.mockReturnValue({ data: deadline, isLoading: false })
  useClubFormMock.mockReturnValue({ data: [] })
}

beforeEach(() => {
  vi.clearAllMocks()
  suggestTransfersMock.mockReturnValue([])
})

// ---- SquadStrip (Task 2) ----

describe('SquadStrip', () => {
  const xi = [
    { player: mkPlayer({ id: 1, web_name: 'Haaland', element_type: 4 }), badge: { text: 'BUY', intent: 'positive' as const }, isCaptain: true },
    { player: mkPlayer({ id: 2, web_name: 'Saka' }), badge: { text: 'SELL SOON', intent: 'warning' as const }, isCaptain: false },
  ]
  const bench = [
    mkPlayer({ id: 12, web_name: 'BenchOne', element_type: 1 }),
    mkPlayer({ id: 13, web_name: 'BenchTwo' }),
    mkPlayer({ id: 14, web_name: 'BenchThree' }),
    mkPlayer({ id: 15, web_name: 'BenchFour' }),
  ]

  it('renders XI rows with badge chips and the captain C chip', () => {
    render(<SquadStrip xi={xi} bench={bench} />)
    expect(screen.getByText('My Squad')).toBeTruthy()
    expect(screen.getByText('Haaland')).toBeTruthy()
    expect(screen.getByText('BUY')).toBeTruthy()
    expect(screen.getByText('SELL SOON')).toBeTruthy()
    // exactly one captain chip, on Haaland's row
    expect(screen.getAllByTitle('Optimised captain').length).toBe(1)
    expect(screen.getByTestId('squad-row-1').textContent).toContain('C')
  })

  it('renders all 4 bench players', () => {
    render(<SquadStrip xi={xi} bench={bench} />)
    for (const name of ['BenchOne', 'BenchTwo', 'BenchThree', 'BenchFour']) {
      expect(screen.getByText(name)).toBeTruthy()
    }
  })

  it('renders nothing when xi is empty (parent decides states)', () => {
    const { container } = render(<SquadStrip xi={[]} bench={[]} />)
    expect(container.firstChild).toBeNull()
  })
})

// ---- ActionCards (Task 2) ----

describe('ActionCards', () => {
  const captain = { name: 'Haaland', team: 'MCI', projectedPts: 14.4, captainType: 'safe' as const }
  const transfer = { sellName: 'Selman', buyName: 'Buyer', gain: 1.4, costLabel: 'Free transfer' }
  const lineup = { formation: '4-3-3', xiXpts: 61.2 }

  it('captain card shows name and doubled points; routes to cockpit', () => {
    const onGo = vi.fn()
    render(<ActionCards captain={captain} transfer={transfer} lineup={lineup} onGo={onGo} />)
    expect(screen.getByText('Haaland')).toBeTruthy()
    expect(screen.getByText(/14\.4/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /cockpit/i }))
    expect(onGo).toHaveBeenCalledWith('cockpit')
  })

  it('transfer card shows sell ➜ buy headline, gain, and cost label; routes to transfers', () => {
    const onGo = vi.fn()
    render(<ActionCards captain={captain} transfer={transfer} lineup={lineup} onGo={onGo} />)
    expect(screen.getByText(/Selman\s*➜\s*Buyer/)).toBeTruthy()
    expect(screen.getByText(/\+1\.4/)).toBeTruthy()
    expect(screen.getByText(/Free transfer/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /transfers/i }))
    expect(onGo).toHaveBeenCalledWith('transfers')
  })

  it('lineup card shows formation and projected XI pts; routes to lineup', () => {
    const onGo = vi.fn()
    render(<ActionCards captain={captain} transfer={transfer} lineup={lineup} onGo={onGo} />)
    expect(screen.getByText('4-3-3')).toBeTruthy()
    expect(screen.getByText(/61\.2/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /lineup/i }))
    expect(onGo).toHaveBeenCalledWith('lineup')
  })

  it('cards with undefined data are absent', () => {
    render(<ActionCards captain={captain} onGo={vi.fn()} />)
    expect(screen.getByText('Haaland')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /transfers/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /lineup/i })).toBeNull()
  })

  it('renders nothing when every card is undefined', () => {
    const { container } = render(<ActionCards onGo={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })
})

// ---- HomeTab (Task 3) ----

function renderHome(over: Partial<React.ComponentProps<typeof HomeTab>> = {}) {
  const props = {
    teamId: '',
    onTeamIdChange: vi.fn(),
    submittedId: null as string | null,
    onSubmit: vi.fn(),
    selectTool: vi.fn(),
    ...over,
  }
  render(<HomeTab {...props} />)
  return props
}

describe('HomeTab — state 1: no FPL ID', () => {
  it('renders header stats, connect form, pool-fallback captain, and Picks link — no squad cards', () => {
    const { players } = makeSquadFixture()
    setHooks({ players, squad: undefined, deadline: FUTURE_DEADLINE })
    const props = renderHome()

    // header: GW + countdown only
    expect(screen.getByText('GW 31')).toBeTruthy()
    // connect form wired to the passed-through handlers
    const input = screen.getByLabelText('FPL Team ID')
    fireEvent.change(input, { target: { value: '123' } })
    expect(props.onTeamIdChange).toHaveBeenCalledWith('123')
    fireEvent.click(screen.getByRole('button', { name: /load squad/i }))
    expect(props.onSubmit).toHaveBeenCalled()
    // captain card uses the pool fallback sorted by ceiling (xPts_90th_1gw ?? xPts_1gw) — VAR-01
    // P8 (xPts_90th_1gw=11.0) outranks PoolStar (xPts_90th_1gw=7.0) despite lower mean
    expect(screen.getByText('P8')).toBeTruthy()
    expect(screen.getByText(/16\.0/)).toBeTruthy() // 8.0 × 2
    // Picks link routes
    fireEvent.click(screen.getByRole('button', { name: /weekly picks/i }))
    expect(props.selectTool).toHaveBeenCalledWith('picks')
    // no squad strip, no transfer/lineup cards
    expect(screen.queryByText('My Squad')).toBeNull()
    expect(screen.queryByRole('button', { name: /transfers/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /lineup/i })).toBeNull()
  })
})

describe('HomeTab — state 3: off-season', () => {
  it('renders the quiet hero with Picks/Research routes when deadline is null', () => {
    const { players } = makeSquadFixture()
    setHooks({ players, squad: undefined, deadline: null })
    const props = renderHome()

    expect(screen.getByText(/season hasn't started/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /weekly picks/i }))
    expect(props.selectTool).toHaveBeenCalledWith('picks')
    fireEvent.click(screen.getByRole('button', { name: /research/i }))
    expect(props.selectTool).toHaveBeenCalledWith('gems')
    // no action cards, no connect form on the hero
    expect(screen.queryByTestId('action-cards')).toBeNull()
    expect(screen.queryByLabelText('FPL Team ID')).toBeNull()
  })

  it('still renders the squad strip when the squad API returns data', () => {
    const { players, squadResp } = makeSquadFixture()
    setHooks({ players, squad: squadResp, deadline: null })
    renderHome({ submittedId: '123' })
    expect(screen.getByText(/season hasn't started/i)).toBeTruthy()
    expect(screen.getByText('My Squad')).toBeTruthy()
  })
})

describe('HomeTab — state 2: squad loaded', () => {
  function loadedSetup() {
    const fx = makeSquadFixture()
    setHooks({ players: fx.players, squad: fx.squadResp, deadline: FUTURE_DEADLINE })
    // one real-shaped suggestion so the transfer card renders from OCS rows
    suggestTransfersMock.mockReturnValue([
      {
        kind: 'single',
        sell: fx.players[0 + 10], // P11
        buy: fx.poolStar,
        cost: 0,
        xPtsGain: 2.0,
        xPtsGainPerGw: 2.0,
        breakEvenGws: null,
      },
    ])
    return fx
  }

  it('renders the full layout: stats header, squad strip, three action cards, risk chip', () => {
    loadedSetup()
    const props = renderHome({ submittedId: '123' })

    // header stats incl. bank + FT
    expect(screen.getByText('GW 31')).toBeTruthy()
    expect(screen.getByText('£0.5m')).toBeTruthy()
    expect(screen.getByText('0 FT used')).toBeTruthy()
    // squad strip: XI rows + bench + ONE chip per row (risk beats verdict on P5)
    expect(screen.getByText('My Squad')).toBeTruthy()
    expect(screen.getByTestId('squad-row-5').textContent).toContain('MINS TRAP')
    expect(screen.getByTestId('squad-bench').textContent).toContain('P12')
    // captain ⓒ on the optimiseLineup captain (P8, top xPts)
    expect(screen.getByTestId('squad-row-8').textContent).toContain('C')
    expect(screen.getAllByTitle('Optimised captain').length).toBe(1)
    // three action cards: captain headline is P8, transfer headline is the top OCS row
    expect(screen.getByTestId('action-cards').textContent).toContain('P8')
    expect(screen.getByText(/P11\s*➜\s*PoolStar/)).toBeTruthy()
    expect(screen.getByText(/Free transfer/)).toBeTruthy()
    // deep links
    fireEvent.click(screen.getByRole('button', { name: /→ lineup/i }))
    expect(props.selectTool).toHaveBeenCalledWith('lineup')
    // risk chip: exactly 1 flagged player (P5 minutes_trap)
    expect(screen.getByTestId('risk-flag-chip').textContent).toContain('1 player flagged')
  })

  it('risk chip routes to the Cockpit on click', () => {
    loadedSetup()
    const props = renderHome({ submittedId: '123' })
    fireEvent.click(screen.getByTestId('risk-flag-chip'))
    expect(props.selectTool).toHaveBeenCalledWith('cockpit')
  })

  it('pins the suggestTransfers wiring: horizon 1, ftCount 1, public bank', () => {
    const { squadResp } = loadedSetup()
    renderHome({ submittedId: '123' })
    expect(suggestTransfersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        horizon: 1,
        ftCount: 1,
        bank: squadResp.entry_history.bank,
        currentPicks: squadResp.picks,
      }),
    )
  })

  it('guards a null optimiseLineup result — lineup card absent, page still renders', () => {
    const fx = makeSquadFixture()
    // 5 of the 15 squad players have xPts 0 → <11 eligible → optimiseLineup null.
    const players = fx.players.map((p) =>
      p.id >= 11 && p.id <= 15 ? { ...p, xPts_1gw: 0 } : p,
    )
    setHooks({ players, squad: fx.squadResp, deadline: FUTURE_DEADLINE })
    renderHome({ submittedId: '123' })

    expect(screen.getByText('My Squad')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /→ lineup/i })).toBeNull()
    expect(screen.getByRole('button', { name: /→ cockpit/i })).toBeTruthy()
  })
})

describe('HomeTab — loading', () => {
  it('shows skeletons while players load', () => {
    usePlayersMock.mockReturnValue({ data: undefined, isLoading: true, error: null })
    useSquadMock.mockReturnValue({ data: undefined, isLoading: false, error: null })
    useNextDeadlineMock.mockReturnValue({ data: undefined, isLoading: true })
    useClubFormMock.mockReturnValue({ data: undefined })
    renderHome()
    expect(screen.getByTestId('home-loading')).toBeTruthy()
  })
})
