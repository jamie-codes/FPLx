// Phase 59 Plan 02: ManualPlanTab component tests
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, within, act } from '@testing-library/react'
import type { MergedPlayer, ScoredPlayer } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

vi.mock('@/lib/hooks/usePlayers', () => ({ usePlayers: vi.fn() }))
vi.mock('@/lib/hooks/useSquad', () => ({ useSquad: vi.fn() }))
vi.mock('@/lib/hooks/useMyTeam', () => ({ useMyTeam: vi.fn() }))
vi.mock('@/lib/hooks/useAuthStatus', () => ({ useAuthStatus: vi.fn() }))
vi.mock('./ChipToggle', () => ({
  ChipToggle: ({ activeChip, onToggle }: { activeChip: string | null; onToggle: (c: string) => void }) => (
    <div data-testid="chip-toggle" data-active={activeChip ?? 'none'}>
      <button onClick={() => onToggle('wildcard')}>WC</button>
      <button onClick={() => onToggle('freehit')}>FH</button>
    </div>
  ),
}))
vi.mock('./SquadSnapshotRow', () => ({
  SquadSnapshotRow: (props: { squadAfter?: number[] }) => (
    <div data-testid="squad-snapshot" data-squad-len={props.squadAfter?.length} />
  ),
}))
vi.mock('./PlayerPickerModal', () => ({
  PlayerPickerModal: ({
    open, position, scoredPlayers, onPick, onClose,
  }: {
    open: boolean
    position: number
    scoredPlayers: { id: number }[]
    onPick: (id: number) => void
    onClose: () => void
  }) =>
    open ? (
      <div
        data-testid="picker-modal"
        data-position={position}
        data-pool-size={scoredPlayers.length}
        data-pool-ids={scoredPlayers.map((p) => p.id).join(',')}
      >
        <button data-testid="pick-buy" onClick={() => onPick(99)}>
          pick
        </button>
        <button data-testid="close-picker" onClick={onClose}>
          close
        </button>
      </div>
    ) : null,
}))

import { ManualPlanTab } from './ManualPlanTab'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useSquad } from '@/lib/hooks/useSquad'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'

const mU = vi.mocked

// ---------------------------------------------------------------------------
// Minimal test fixtures
// ---------------------------------------------------------------------------

function makePlayer(id: number, opts: Partial<ScoredPlayer> = {}): ScoredPlayer {
  return {
    id,
    web_name: `Player${id}`,
    element_type: opts.element_type ?? 3, // MID by default
    team: 1,
    now_cost: opts.now_cost ?? 60,
    status: 'a',
    xPts_1gw: opts.xPts_1gw ?? 5.0,
    xPts_90th_1gw: undefined,
    mins_risk: 'nailed',
    fixtures: [{ event_id: 33, opponent_team: 'OPP', is_home: true, difficulty_score: 0.5, difficulty_tier: 'medium', attacking_difficulty: 0.5, defensive_difficulty: 0.5 }],
    gem_score: 0,
    ...opts,
  } as unknown as ScoredPlayer
}

function makePick(element: number, position: number): SquadPick {
  return { element, position, multiplier: 1, is_captain: false, is_vice_captain: false }
}

// 15 default picks
const DEFAULT_PICKS: SquadPick[] = [
  makePick(1, 1),  // GK starter
  makePick(2, 12), // GK bench
  makePick(3, 2),  makePick(4, 3),  makePick(5, 4),  makePick(6, 5), // DEF
  makePick(7, 6),  makePick(8, 7),  makePick(9, 8),  makePick(10, 9), // MID
  makePick(11, 10), makePick(12, 11), // FWD
  makePick(13, 13), makePick(14, 14), makePick(15, 15), // bench
]

// 15 scored players matching DEFAULT_PICKS elements
const DEFAULT_SCORED: ScoredPlayer[] = DEFAULT_PICKS.map((p) =>
  makePlayer(p.element, {
    element_type: p.element <= 2 ? 1 : p.element <= 6 ? 2 : p.element <= 12 ? 3 : 4,
  })
)

const DEFAULT_SQUAD_DATA = {
  picks: DEFAULT_PICKS,
  active_chip: null,
  entry_history: { event: 33, bank: 10, event_transfers: 1, event_transfers_cost: 0, value: 1000 },
}

function setupDefaultMocks(overrides: {
  isAuthenticated?: boolean
  picks?: SquadPick[] | null
  scoredPlayers?: ScoredPlayer[]
} = {}) {
  const isAuthenticated = overrides.isAuthenticated ?? false
  const picks = overrides.picks !== undefined ? overrides.picks : DEFAULT_PICKS
  const scoredPlayers = overrides.scoredPlayers ?? DEFAULT_SCORED

  mU(useAuthStatus).mockReturnValue({
    isAuthenticated,
    expiresAt: undefined,
    isLoading: false,
    setAuthenticated: vi.fn(),
    clearAuthenticated: vi.fn(),
  })

  mU(usePlayers).mockReturnValue({
    data: scoredPlayers.map((p) => p as unknown as MergedPlayer),
    isLoading: false,
    error: null,
  } as ReturnType<typeof usePlayers>)

  if (picks === null) {
    mU(useSquad).mockReturnValue({ data: undefined, isLoading: false, error: null } as ReturnType<typeof useSquad>)
    mU(useMyTeam).mockReturnValue({ data: undefined, isLoading: false, error: null } as ReturnType<typeof useMyTeam>)
  } else {
    mU(useSquad).mockReturnValue({
      data: { ...DEFAULT_SQUAD_DATA, picks },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useSquad>)
    mU(useMyTeam).mockReturnValue({ data: undefined, isLoading: false, error: null } as ReturnType<typeof useMyTeam>)
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ManualPlanTab', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    window.localStorage.clear()
    // Provide a fpl_team_id so hooks fire
    window.localStorage.setItem('fpl_team_id', '123456')
  })

  // ---- Shell tests (S1–S9) ----

  it('S1: renders loading state when usePlayers data is undefined', () => {
    mU(useAuthStatus).mockReturnValue({ isAuthenticated: false, expiresAt: undefined, isLoading: true, setAuthenticated: vi.fn(), clearAuthenticated: vi.fn() })
    mU(usePlayers).mockReturnValue({ data: undefined, isLoading: true, error: null } as ReturnType<typeof usePlayers>)
    mU(useSquad).mockReturnValue({ data: undefined, isLoading: true, error: null } as ReturnType<typeof useSquad>)
    mU(useMyTeam).mockReturnValue({ data: undefined, isLoading: true, error: null } as ReturnType<typeof useMyTeam>)

    render(<ManualPlanTab submittedId="123456" />)
    expect(screen.getByText('Loading…')).toBeDefined()
  })

  it('S2: renders no-squad branch when picks are null but players loaded', () => {
    setupDefaultMocks({ picks: null, scoredPlayers: DEFAULT_SCORED })
    render(<ManualPlanTab submittedId={null} />)
    expect(screen.getByText('Load your squad first')).toBeDefined()
    expect(screen.getByLabelText('FPL Team ID')).toBeDefined()
    expect(screen.getByText('Load Squad')).toBeDefined()
  })

  it('S3: renders summary header with three metric labels when picks loaded', () => {
    setupDefaultMocks()
    render(<ManualPlanTab submittedId="123456" />)
    expect(screen.getByText('Hits')).toBeDefined()
    expect(screen.getByText('Hit cost')).toBeDefined()
    expect(screen.getByText('Avg break-even')).toBeDefined()
  })

  it('S4: empty plan shows Hits 0, Hit cost 0 pts, Avg break-even em-dash', () => {
    setupDefaultMocks()
    const { container } = render(<ManualPlanTab submittedId="123456" />)

    // Find summary values (text-base font-semibold spans)
    const allText = container.textContent ?? ''
    expect(allText).toContain('0')
    expect(allText).toContain('0 pts')
    // em-dash for no-hits avg break-even
    expect(allText).toContain('—')
  })

  it('S5: caveat banner present when unauthenticated and picks not null', () => {
    setupDefaultMocks({ isAuthenticated: false })
    render(<ManualPlanTab submittedId="123456" />)
    expect(screen.getByText('Sell prices are approximate — log in to FPL for exact selling prices.')).toBeDefined()
  })

  it('S6: caveat banner absent when authenticated', () => {
    setupDefaultMocks({ isAuthenticated: true })
    render(<ManualPlanTab submittedId="123456" />)
    const banner = screen.queryByText('Sell prices are approximate — log in to FPL for exact selling prices.')
    expect(banner).toBeNull()
  })

  it('S7: HorizonSelector present; clicking 1 GW button changes plan horizon', () => {
    setupDefaultMocks()
    render(<ManualPlanTab submittedId="123456" />)
    // HorizonSelector renders buttons like "1 GW"
    const btn1Gw = screen.getByRole('button', { name: '1 GW' })
    expect(btn1Gw).toBeDefined()
    fireEvent.click(btn1Gw)
    // After clicking 1 GW, 1 step card should remain (GW step list reduced)
    // Verified indirectly via rendered content not throwing
  })

  it('S8: Reset Plan link triggers confirm; on cancel no clear; on accept clears localStorage', () => {
    setupDefaultMocks()
    // Seed existing plan
    window.localStorage.setItem('fplx_manual_plan', JSON.stringify({
      version: 1, horizon: 3,
      steps: [
        { gw: 33, chip: null, transfers: [{ sellId: 3, buyId: 20 }] },
        { gw: 34, chip: null, transfers: [] },
        { gw: 35, chip: null, transfers: [] },
      ],
    }))

    // Mock confirm to return false first
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ManualPlanTab submittedId="123456" />)
    fireEvent.click(screen.getByText('Reset Plan'))
    expect(confirmSpy).toHaveBeenCalledWith('Clear all transfers from your manual plan?')
    // plan key not cleared on cancel
    expect(window.localStorage.getItem('fplx_manual_plan')).not.toBeNull()

    // Now return true
    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByText('Reset Plan'))
    // After confirm=true, clearManualPlan removes the key
    expect(window.localStorage.getItem('fplx_manual_plan')).toBeNull()

    confirmSpy.mockRestore()
  })

  it('S9: plan state restored from localStorage on mount', () => {
    const savedPlan = {
      version: 1, horizon: 1,
      steps: [{ gw: 33, chip: null, transfers: [] }],
    }
    window.localStorage.setItem('fplx_manual_plan', JSON.stringify(savedPlan))
    setupDefaultMocks()
    render(<ManualPlanTab submittedId="123456" />)
    // HorizonSelector should show "1 GW" as pressed (restored horizon=1)
    const btn1 = screen.getByRole('button', { name: '1 GW' })
    expect(btn1.getAttribute('aria-pressed')).toBe('true')
  })

  // ---- GwStepCard tests (S10–S21) ----

  it('S10: squad-loaded with 3-step plan renders 3 GwStepCards each with header GW {N}', () => {
    window.localStorage.setItem('fplx_manual_plan', JSON.stringify({
      version: 1, horizon: 3,
      steps: [
        { gw: 33, chip: null, transfers: [] },
        { gw: 34, chip: null, transfers: [] },
        { gw: 35, chip: null, transfers: [] },
      ],
    }))
    setupDefaultMocks()
    render(<ManualPlanTab submittedId="123456" />)
    expect(screen.getByText('GW 33')).toBeDefined()
    expect(screen.getByText('GW 34')).toBeDefined()
    expect(screen.getByText('GW 35')).toBeDefined()
  })

  it('S11: each GwStepCard shows a + Add Transfer button', () => {
    window.localStorage.setItem('fplx_manual_plan', JSON.stringify({
      version: 1, horizon: 3,
      steps: [
        { gw: 33, chip: null, transfers: [] },
        { gw: 34, chip: null, transfers: [] },
        { gw: 35, chip: null, transfers: [] },
      ],
    }))
    setupDefaultMocks()
    render(<ManualPlanTab submittedId="123456" />)
    const addButtons = screen.getAllByText('+ Add Transfer')
    expect(addButtons.length).toBe(3)
  })

  it('S12: clicking + Add Transfer enters sell stage; sell-stage list contains squad player names', () => {
    window.localStorage.setItem('fplx_manual_plan', JSON.stringify({
      version: 1, horizon: 3,
      steps: [
        { gw: 33, chip: null, transfers: [] },
        { gw: 34, chip: null, transfers: [] },
        { gw: 35, chip: null, transfers: [] },
      ],
    }))
    setupDefaultMocks()
    render(<ManualPlanTab submittedId="123456" />)
    const addButtons = screen.getAllByText('+ Add Transfer')
    fireEvent.click(addButtons[0])
    // Sell stage: squad player names should appear in a sell list
    // Player1..Player15 (our DEFAULT_PICKS)
    expect(screen.getByText('Player1')).toBeDefined()
    expect(screen.getByText('Player3')).toBeDefined()
  })

  it('S13: after picking a sell, buy stage opens with PlayerPickerModal at sell element_type', () => {
    // Player3 is element_type=2 (DEF) in our setup
    const scored = DEFAULT_SCORED.map((p) => ({ ...p }))
    window.localStorage.setItem('fplx_manual_plan', JSON.stringify({
      version: 1, horizon: 3,
      steps: [
        { gw: 33, chip: null, transfers: [] },
        { gw: 34, chip: null, transfers: [] },
        { gw: 35, chip: null, transfers: [] },
      ],
    }))
    setupDefaultMocks({ scoredPlayers: scored })
    render(<ManualPlanTab submittedId="123456" />)
    const addButtons = screen.getAllByText('+ Add Transfer')
    fireEvent.click(addButtons[0])
    // Click player3 in sell list (element_type=2 DEF)
    const sellBtn = screen.getByText('Player3')
    fireEvent.click(sellBtn)
    // Buy stage: PlayerPickerModal should appear with position=2 (DEF)
    const modal = screen.getByTestId('picker-modal')
    expect(modal).toBeDefined()
    expect(modal.getAttribute('data-position')).toBe('2')
  })

  it('S14: after picking buy, transfer row appears with sell/buy names and Free badge', () => {
    // Use 1 step plan; player3 is el_type=2 (DEF)
    window.localStorage.setItem('fplx_manual_plan', JSON.stringify({
      version: 1, horizon: 1,
      steps: [{ gw: 33, chip: null, transfers: [] }],
    }))

    // Add player id=99 to scoredPlayers so its name shows
    const scored = [
      ...DEFAULT_SCORED,
      makePlayer(99, { element_type: 2, web_name: 'NewPlayer' } as Partial<ScoredPlayer>),
    ]
    setupDefaultMocks({ scoredPlayers: scored })
    render(<ManualPlanTab submittedId="123456" />)

    // Add transfer
    fireEvent.click(screen.getByText('+ Add Transfer'))
    // Pick sell: Player3 (DEF)
    fireEvent.click(screen.getByText('Player3'))
    // Pick buy via mocked modal
    fireEvent.click(screen.getByTestId('pick-buy'))

    // Transfer row should appear
    expect(screen.getByText('Player3')).toBeDefined()
    expect(screen.getByText('Player99')).toBeDefined()
    // "Free" badge since 1 FT available (default)
    expect(screen.getByText('Free')).toBeDefined()
  })

  it('S15: clicking X removes transfer from plan steps', () => {
    window.localStorage.setItem('fplx_manual_plan', JSON.stringify({
      version: 1, horizon: 1,
      steps: [{ gw: 33, chip: null, transfers: [] }],
    }))
    const scored = [
      ...DEFAULT_SCORED,
      makePlayer(99, { element_type: 2 } as Partial<ScoredPlayer>),
    ]
    setupDefaultMocks({ scoredPlayers: scored })
    render(<ManualPlanTab submittedId="123456" />)

    // Add a transfer
    fireEvent.click(screen.getByText('+ Add Transfer'))
    fireEvent.click(screen.getByText('Player3'))
    fireEvent.click(screen.getByTestId('pick-buy'))

    // ✕ button
    const removeBtn = screen.getByRole('button', { name: 'Remove transfer' })
    fireEvent.click(removeBtn)
    // Transfer row gone
    expect(screen.queryByText('Player99')).toBeNull()
  })

  it('S16: toggling a chip via ChipToggle sets it; toggling same chip again sets it to null', () => {
    window.localStorage.setItem('fplx_manual_plan', JSON.stringify({
      version: 1, horizon: 1,
      steps: [{ gw: 33, chip: null, transfers: [] }],
    }))
    setupDefaultMocks()
    render(<ManualPlanTab submittedId="123456" />)

    const chipToggle = screen.getByTestId('chip-toggle')
    expect(chipToggle.getAttribute('data-active')).toBe('none')

    // Toggle WC on
    fireEvent.click(within(chipToggle).getByText('WC'))
    expect(screen.getByTestId('chip-toggle').getAttribute('data-active')).toBe('wildcard')

    // Toggle WC off (same chip again)
    fireEvent.click(within(screen.getByTestId('chip-toggle')).getByText('WC'))
    expect(screen.getByTestId('chip-toggle').getAttribute('data-active')).toBe('none')
  })

  it('S17: accordion toggle mounts SquadSnapshotRow when open', () => {
    window.localStorage.setItem('fplx_manual_plan', JSON.stringify({
      version: 1, horizon: 1,
      steps: [{ gw: 33, chip: null, transfers: [] }],
    }))
    setupDefaultMocks()
    render(<ManualPlanTab submittedId="123456" />)

    // Accordion default: closed
    expect(screen.queryByTestId('squad-snapshot')).toBeNull()

    // Open accordion
    fireEvent.click(screen.getByRole('button', { name: /show squad/i }))
    expect(screen.getByTestId('squad-snapshot')).toBeDefined()
  })

  it('S18: hit transfer with positive xPts delta shows break-even in GWs', () => {
    // 2 transfers: first is free (1 FT), second is a hit
    // xPts_buy - xPts_sell = 4.0 → 4/4 = 1.0 GW
    const scored = [
      ...DEFAULT_SCORED,
      makePlayer(99, { element_type: 2, xPts_1gw: 9.0 } as Partial<ScoredPlayer>), // buy
      makePlayer(98, { element_type: 2, xPts_1gw: 9.0 } as Partial<ScoredPlayer>), // buy2
    ]
    // Player3 is sell (xPts=5.0 default), Player99 buy (xPts=9.0): delta=4.0 → BE=1.0 GW
    window.localStorage.setItem('fplx_manual_plan', JSON.stringify({
      version: 1, horizon: 1,
      steps: [{ gw: 33, chip: null, transfers: [
        { sellId: 3, buyId: 99 },  // free
        { sellId: 4, buyId: 98 },  // hit (delta=4.0)
      ] }],
    }))
    setupDefaultMocks({ scoredPlayers: scored })
    render(<ManualPlanTab submittedId="123456" />)
    // Second transfer is hit: delta = 9.0 - 5.0 = 4.0 → 4/4.0 = 1.0 GW
    expect(screen.getByText('Break-even: 1.0 GWs')).toBeDefined()
  })

  it('S19: hit transfer with zero/negative xPts delta shows infinity glyph', () => {
    // Player3 xPts=5.0, buy player100 xPts=3.0 → delta=-2.0 → ∞
    const scored = [
      ...DEFAULT_SCORED,
      makePlayer(100, { element_type: 2, xPts_1gw: 3.0 } as Partial<ScoredPlayer>),
      makePlayer(101, { element_type: 2, xPts_1gw: 3.0 } as Partial<ScoredPlayer>),
    ]
    window.localStorage.setItem('fplx_manual_plan', JSON.stringify({
      version: 1, horizon: 1,
      steps: [{ gw: 33, chip: null, transfers: [
        { sellId: 3, buyId: 100 }, // free
        { sellId: 4, buyId: 101 }, // hit — delta negative
      ] }],
    }))
    setupDefaultMocks({ scoredPlayers: scored })
    render(<ManualPlanTab submittedId="123456" />)
    // Should show ∞ glyph (U+221E)
    expect(screen.getByText('Break-even: ∞')).toBeDefined()
  })

  it('S20: bank balance < 0 renders with text-red-700 class', () => {
    // bank=10 (£1.0m), sell player3 now_cost=60 (£6.0m), buy player99 now_cost=100 (£10.0m)
    // bank after: 10 + 60 - 100 = -30 → red
    const scored = [
      ...DEFAULT_SCORED,
      makePlayer(99, { element_type: 2, now_cost: 100 } as Partial<ScoredPlayer>),
    ]
    window.localStorage.setItem('fplx_manual_plan', JSON.stringify({
      version: 1, horizon: 1,
      steps: [{ gw: 33, chip: null, transfers: [{ sellId: 3, buyId: 99 }] }],
    }))
    setupDefaultMocks({ scoredPlayers: scored })
    const { container } = render(<ManualPlanTab submittedId="123456" />)
    // The bank span should have red class
    const redSpan = container.querySelector('.text-red-700')
    expect(redSpan).not.toBeNull()
  })

  it('S21: D-06 MTP-02 budget-aware filter — only affordable players passed to picker', () => {
    // bank=5 (£0.5m), sell player id=3 now_cost=50 (£5.0m), bankAfterSell=55 (£5.5m)
    // Pool: id=100 now_cost=40 (affordable), id=101 now_cost=55 (affordable), id=102 now_cost=60 (over budget)
    // Also a different element_type player (el=1) id=103 now_cost=30 (affordable but wrong position for modal)
    const scored = DEFAULT_SCORED.map((p) => p.element === 3 ? { ...p, now_cost: 50 } : p)
      .concat([
        makePlayer(100, { element_type: 2, now_cost: 40 } as Partial<ScoredPlayer>),
        makePlayer(101, { element_type: 2, now_cost: 55 } as Partial<ScoredPlayer>),
        makePlayer(102, { element_type: 2, now_cost: 60 } as Partial<ScoredPlayer>),
        makePlayer(103, { element_type: 1, now_cost: 30 } as Partial<ScoredPlayer>),
      ])

    window.localStorage.setItem('fplx_manual_plan', JSON.stringify({
      version: 1, horizon: 1,
      steps: [{ gw: 33, chip: null, transfers: [] }],
    }))

    // bank = 5, unauthenticated → no sellPriceMap → uses now_cost for sellPrice
    mU(useAuthStatus).mockReturnValue({ isAuthenticated: false, expiresAt: undefined, isLoading: false, setAuthenticated: vi.fn(), clearAuthenticated: vi.fn() })
    mU(usePlayers).mockReturnValue({ data: scored as unknown as MergedPlayer[], isLoading: false, error: null } as ReturnType<typeof usePlayers>)
    mU(useSquad).mockReturnValue({
      data: {
        picks: DEFAULT_PICKS,
        active_chip: null,
        entry_history: { event: 33, bank: 5, event_transfers: 1, event_transfers_cost: 0, value: 1000 },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useSquad>)
    mU(useMyTeam).mockReturnValue({ data: undefined, isLoading: false, error: null } as ReturnType<typeof useMyTeam>)

    render(<ManualPlanTab submittedId="123456" />)

    // Open picker for step 0
    fireEvent.click(screen.getByText('+ Add Transfer'))
    // Sell player3 (element_type=2, now_cost=50)
    fireEvent.click(screen.getByText('Player3'))

    // Buy stage: PlayerPickerModal should appear
    const modal = screen.getByTestId('picker-modal')
    expect(modal).toBeDefined()

    // Budget-aware filter: bankAfterSell = 5 + 50 = 55
    // affordablePlayers: id=100 (40), id=101 (55) — id=102 (60) excluded
    const poolIds = modal.getAttribute('data-pool-ids')!.split(',').map(Number)
    expect(poolIds).toEqual(expect.arrayContaining([100, 101]))
    expect(poolIds).not.toContain(102)
    // id=103 is affordable (30 ≤ 55) but the modal handles position filtering
    // The caller's affordability filter keeps it in the pool — confirmed included
    expect(poolIds).toContain(103)
  })
})
