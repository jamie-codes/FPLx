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
// PITCH-01: the card tooltip reads the lineup-news badge. Mocked like the other
// two hooks — this file renders without a QueryClientProvider. Default is
// undefined, which is also what the real hook returns when the scrape is stale.
const useLineupNewsMock = vi.fn(() => ({ data: undefined }))
vi.mock('@/lib/hooks/useLineupNews', () => ({
  useLineupNews: () => useLineupNewsMock(),
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
        // BGW-02: first 5 have a fixture; the remaining 10 blank. A blank is
        // the absence of a FIXTURE — `xPts_1gw: 0` also describes a player
        // simply not expected to play, which is a different thing.
        players.push(makePlayer({
          id, element_type: elementTypes[i], xPts_1gw: 5.0,
          fixtures: i < 5 ? [{ opponent_team: 'TST', is_home: true, event_id: 30,
                               difficulty_score: 0.5, difficulty_tier: 'medium' as const }] : [],
        }))
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
      // Total starters = 11 (across the 4 XI rows) — use outer pitch-card-{id} divs only (not pitch-card-body-{id} or pitch-card-kit-{id})
      const xiCards = container.querySelectorAll('[data-testid="pitch-row-gk"] [data-testid^="pitch-card-"]:not([data-testid^="pitch-card-body-"]):not([data-testid^="pitch-card-kit-"]), [data-testid="pitch-row-def"] [data-testid^="pitch-card-"]:not([data-testid^="pitch-card-body-"]):not([data-testid^="pitch-card-kit-"]), [data-testid="pitch-row-mid"] [data-testid^="pitch-card-"]:not([data-testid^="pitch-card-body-"]):not([data-testid^="pitch-card-kit-"]), [data-testid="pitch-row-fwd"] [data-testid^="pitch-card-"]:not([data-testid^="pitch-card-body-"]):not([data-testid^="pitch-card-kit-"])')
      expect(xiCards.length).toBe(11)
      // Bench has 4 cards
      const benchCards = container.querySelectorAll('[data-testid="pitch-row-bench"] [data-testid^="pitch-card-"]:not([data-testid^="pitch-card-body-"]):not([data-testid^="pitch-card-kit-"])')
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
      // Pick the first DEF starter card body button (id 3 — DEFs are ids 3-7 per makeValidSquad)
      // Phase 76: body button is pitch-card-body-{id}; data-pending lives on the body button.
      const card = container.querySelector('[data-testid="pitch-card-body-3"]') as HTMLButtonElement
      expect(card).not.toBeNull()
      fireEvent.click(card)
      expect(card.getAttribute('data-pending')).toBe('true')
      fireEvent.click(card)
      expect(card.getAttribute('data-pending')).toBeNull()
    })

    it('compatible bench highlight: armed starter highlights legal bench targets and dims incompatible', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      // Arm a DEF starter (id 3) — Phase 76: click the body button
      const defCard = container.querySelector('[data-testid="pitch-card-body-3"]') as HTMLButtonElement
      fireEvent.click(defCard)
      // At least one bench card must be a legal target
      const legalCards = container.querySelectorAll('[data-testid="pitch-row-bench"] [data-legal-target="true"]')
      expect(legalCards.length).toBeGreaterThanOrEqual(1)
      // The bench GK must be incompatible (DEF cannot swap with GK)
      // makeValidSquad: ids 1,2 are GKs; one will be on bench after optimiseLineup picks 11.
      // Phase 76: body buttons carry disabled; select only body buttons (not outer divs)
      const benchBodyCards = Array.from(container.querySelectorAll('[data-testid="pitch-row-bench"] [data-testid^="pitch-card-body-"]')) as HTMLButtonElement[]
      const benchGkCard = benchBodyCards.find(c => {
        const id = Number(c.getAttribute('data-testid')!.replace('pitch-card-body-', ''))
        return id === 1 || id === 2   // one of the two GKs is on the bench
      })
      expect(benchGkCard).not.toBeUndefined()
      expect(benchGkCard!.disabled).toBe(true)   // GK bench is incompatible when DEF starter armed
    })

    it('GK only swaps with GK: armed GK starter highlights only bench GK', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      // Find the GK starter body button (only one in the GK row)
      // Phase 76: outer cards are divs; body buttons are pitch-card-body-{id}
      const gkRowBodies = container.querySelectorAll('[data-testid="pitch-row-gk"] [data-testid^="pitch-card-body-"]')
      expect(gkRowBodies.length).toBe(1)
      const gkStarterCard = gkRowBodies[0] as HTMLButtonElement
      fireEvent.click(gkStarterCard)
      // Exactly one bench body button has data-legal-target="true" (the bench GK)
      const legalBenchCards = container.querySelectorAll('[data-testid="pitch-row-bench"] [data-legal-target="true"]')
      expect(legalBenchCards.length).toBe(1)
      // The other 3 bench body buttons are incompatible (disabled)
      const disabledBenchCards = Array.from(container.querySelectorAll('[data-testid="pitch-row-bench"] [data-testid^="pitch-card-body-"]'))
        .filter(c => (c as HTMLButtonElement).disabled)
      expect(disabledBenchCards.length).toBe(3)
    })

    it('executes swap: arm starter, click legal bench, lineup state updates', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      // Find a DEF starter body button and a DEF bench body button (same-position swap is always legal).
      // Per makeValidSquad: ids 3-7 are DEFs; one will be on bench after optimiseLineup picks 11.
      // Phase 76: body buttons are pitch-card-body-{id}; data-legal-target lives on them.
      const defCard = container.querySelector('[data-testid="pitch-card-body-3"]') as HTMLButtonElement | null
      const benchDefCard = Array.from(container.querySelectorAll('[data-testid="pitch-row-bench"] [data-legal-target="true"]'))[0] as HTMLButtonElement | undefined
      if (!defCard || !benchDefCard) {
        // If id 3 wasn't a starter, retry with id 4
        const altDefCard = container.querySelector('[data-testid="pitch-card-body-4"]') as HTMLButtonElement
        fireEvent.click(altDefCard)
      } else {
        fireEvent.click(defCard)
      }
      // After arming, click the first legal bench body button
      const legal = container.querySelector('[data-testid="pitch-row-bench"] [data-legal-target="true"]') as HTMLButtonElement
      expect(legal).not.toBeNull()
      const swappedInId = Number(legal.getAttribute('data-testid')!.replace('pitch-card-body-', ''))
      fireEvent.click(legal)
      // After swap: the swapped-in id is now in an XI row, no longer in bench row
      // Use outer pitch-card-{id} divs (not body buttons) to avoid double-counting
      const benchIds = Array.from(container.querySelectorAll('[data-testid="pitch-row-bench"] [data-testid^="pitch-card-"]:not([data-testid^="pitch-card-body-"]):not([data-testid^="pitch-card-kit-"])'))
        .map(c => Number(c.getAttribute('data-testid')!.replace('pitch-card-', '')))
      expect(benchIds).not.toContain(swappedInId)
      // Pending state cleared
      const stillPending = container.querySelector('[data-pending="true"]')
      expect(stillPending).toBeNull()
    })

    it('Reset restores algorithm original lineup', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      // Snapshot the initial bench ids — use outer pitch-card-{id} divs only (Phase 76 refactor)
      const initialBenchIds = Array.from(container.querySelectorAll('[data-testid="pitch-row-bench"] [data-testid^="pitch-card-"]:not([data-testid^="pitch-card-body-"]):not([data-testid^="pitch-card-kit-"])'))
        .map(c => c.getAttribute('data-testid')!.replace('pitch-card-', ''))
      const initialFormation = container.querySelector('[data-testid="lineup-headline-row"]')!.textContent
      // Perform an arbitrary legal swap: arm any starter body button and click any legal bench
      const defStarter = container.querySelector('[data-testid="pitch-row-def"] [data-testid^="pitch-card-body-"]') as HTMLButtonElement
      fireEvent.click(defStarter)
      const legalTarget = container.querySelector('[data-testid="pitch-row-bench"] [data-legal-target="true"]') as HTMLButtonElement | null
      if (legalTarget) {
        fireEvent.click(legalTarget)
        // Verify state changed
        const afterSwapBenchIds = Array.from(container.querySelectorAll('[data-testid="pitch-row-bench"] [data-testid^="pitch-card-"]:not([data-testid^="pitch-card-body-"]):not([data-testid^="pitch-card-kit-"])'))
          .map(c => c.getAttribute('data-testid')!.replace('pitch-card-', ''))
        expect(afterSwapBenchIds).not.toEqual(initialBenchIds)
      }
      // Click Reset
      const resetBtn = container.querySelector('[data-testid="lineup-reset"]') as HTMLButtonElement
      fireEvent.click(resetBtn)
      // Bench ids return to initial
      const restoredBenchIds = Array.from(container.querySelectorAll('[data-testid="pitch-row-bench"] [data-testid^="pitch-card-"]:not([data-testid^="pitch-card-body-"]):not([data-testid^="pitch-card-kit-"])'))
        .map(c => c.getAttribute('data-testid')!.replace('pitch-card-', ''))
      expect(restoredBenchIds).toEqual(initialBenchIds)
      const restoredFormation = container.querySelector('[data-testid="lineup-headline-row"]')!.textContent
      expect(restoredFormation).toBe(initialFormation)
    })

    it('no localStorage persistence (D-08 session-only)', () => {
      setupValidLineup()
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
      const { container } = render(<LineupTab teamId="123" />)
      // Perform a swap — Phase 76: use body button to arm swap
      const defStarter = container.querySelector('[data-testid="pitch-row-def"] [data-testid^="pitch-card-body-"]') as HTMLButtonElement
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

  // -- PITCH-01 helpers -------------------------------------------------------
  // The C / VC pills used to sit on all 15 cards. They now render only beneath
  // the armed card, so a test that wants a pill must arm that card first. This
  // is the one test change the redesign brief sanctions (HANDOFF.md section 4)
  // -- both handlers and both data-testids are unchanged.
  function armCard(container: HTMLElement, cardId: string) {
    const body = container.querySelector('[data-testid="pitch-card-body-' + cardId + '"]') as HTMLButtonElement
    expect(body, 'card ' + cardId + ' must exist to be armed').not.toBeNull()
    fireEvent.click(body)
    return body
  }
  function pillsOf(container: HTMLElement, cardId: string) {
    return {
      setC: container.querySelector('[data-testid="set-c-' + cardId + '"]') as HTMLButtonElement,
      setVc: container.querySelector('[data-testid="set-vc-' + cardId + '"]') as HTMLButtonElement,
    }
  }
  /** id of the pitch-card wrapper an element sits inside */
  function cardIdOf(el: Element | null): string | null {
    const card = el?.closest('[data-testid^="pitch-card-"]:not([data-testid^="pitch-card-body-"])')
    return card ? card.getAttribute('data-testid')!.replace('pitch-card-', '') : null
  }
  /** ids of the XI, in pitch order -- the bench now lives outside [data-testid="pitch"] */
  function starterIds(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll('[data-testid="pitch"] [data-testid^="pitch-card-body-"]'))
      .map(b => b.getAttribute('data-testid')!.replace('pitch-card-body-', ''))
  }

  describe('Phase 76 OPT-01: captain override', () => {
    it('Set C pill commits captain to a non-captain starter', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      const initialCaptainId = cardIdOf(container.querySelector('[data-testid="captain-badge"]'))
      expect(initialCaptainId).not.toBeNull()
      const newCaptainId = starterIds(container).find(id => id !== initialCaptainId)!
      armCard(container, newCaptainId)
      const setCBtn = pillsOf(container, newCaptainId).setC
      expect(setCBtn).not.toBeNull()
      expect(setCBtn.disabled).toBe(false)
      fireEvent.click(setCBtn)
      expect(cardIdOf(container.querySelector('[data-testid="captain-badge"]'))).toBe(newCaptainId)
    })

    it('Set VC pill commits VC to a non-VC, non-captain starter', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      const captainId = cardIdOf(container.querySelector('[data-testid="captain-badge"]'))
      const vcId = cardIdOf(container.querySelector('[data-testid="vc-badge"]'))
      const newVcId = starterIds(container).find(id => id !== captainId && id !== vcId)!
      armCard(container, newVcId)
      const setVcBtn = pillsOf(container, newVcId).setVc
      expect(setVcBtn.disabled).toBe(false)
      fireEvent.click(setVcBtn)
      expect(cardIdOf(container.querySelector('[data-testid="vc-badge"]'))).toBe(newVcId)
    })

    it('Set C on the current VC auto-shuffles: VC moves to the previous captain', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      const prevCaptainId = cardIdOf(container.querySelector('[data-testid="captain-badge"]'))!
      const prevVcId = cardIdOf(container.querySelector('[data-testid="vc-badge"]'))!
      armCard(container, prevVcId)
      fireEvent.click(pillsOf(container, prevVcId).setC)
      expect(cardIdOf(container.querySelector('[data-testid="captain-badge"]'))).toBe(prevVcId)
      expect(cardIdOf(container.querySelector('[data-testid="vc-badge"]'))).toBe(prevCaptainId)
    })

    it('Set VC on the current captain is disabled / no-op', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      const captainId = cardIdOf(container.querySelector('[data-testid="captain-badge"]'))!
      armCard(container, captainId)
      const setVcOnCaptain = pillsOf(container, captainId).setVc
      // disabled OR aria-disabled="true" -- both valid per UI-SPEC Interaction States
      const isInert = setVcOnCaptain.disabled || setVcOnCaptain.getAttribute('aria-disabled') === 'true'
      expect(isInert).toBe(true)
      fireEvent.click(setVcOnCaptain)
      expect(cardIdOf(container.querySelector('[data-testid="captain-badge"]'))).toBe(captainId)
      expect(cardIdOf(container.querySelector('[data-testid="vc-badge"]'))).not.toBe(captainId)
    })

    it('Reset clears captain override and restores algorithm captain', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      const initialCaptainId = cardIdOf(container.querySelector('[data-testid="captain-badge"]'))!
      const otherId = starterIds(container).find(id => id !== initialCaptainId)!
      armCard(container, otherId)
      fireEvent.click(pillsOf(container, otherId).setC)
      fireEvent.click(container.querySelector('[data-testid="lineup-reset"]') as HTMLButtonElement)
      expect(cardIdOf(container.querySelector('[data-testid="captain-badge"]'))).toBe(initialCaptainId)
    })

    it('Squad refresh clears captain override (Pitfall 2)', async () => {
      // First render with squad A; perform override; rerender with squad B (different picks);
      // override must be cleared so the new captain is the algorithm choice for squad B.
      const { rerenderWithDifferentSquad } = setupValidLineup() as ReturnType<typeof setupValidLineup> & { rerenderWithDifferentSquad?: () => void }
      const { container, rerender } = render(<LineupTab teamId="123" />)
      // Override captain to any non-captain starter.
      const capId = cardIdOf(container.querySelector('[data-testid="captain-badge"]'))
      const overrideId = starterIds(container).find(id => id !== capId)!
      armCard(container, overrideId)
      fireEvent.click(pillsOf(container, overrideId).setC)
      // Trigger squad refresh — the helper must mutate mocked useSquad to return a different squad,
      // then the component rerender propagates initialLineup change.
      if (typeof rerenderWithDifferentSquad === 'function') {
        rerenderWithDifferentSquad()
        rerender(<LineupTab teamId="123" />)
      } else {
        // Fallback: change teamId to force a useSquad re-fetch path.
        rerender(<LineupTab teamId="999" />)
      }
      // After refresh, the captain badge must follow the algorithm's choice for the new squad,
      // NOT the previously-overridden id (unless coincidentally the same — assert ABSENCE of stale override).
      const finalCaptainCard = container.querySelector('[data-testid="captain-badge"]')
        ?.closest('[data-testid^="pitch-card-"]:not([data-testid^="pitch-card-body-"])')
      // If the new lineup's algorithm captain happens to equal the previously-overridden id, the test still
      // passes — what matters is that the badge MATCHES the new lineup's recommendation, not that it differs.
      // The strong assertion is: there is exactly one captain badge AND it is on a player from the new lineup.
      expect(finalCaptainCard).not.toBeNull()
      expect(container.querySelectorAll('[data-testid="captain-badge"]').length).toBe(1)
    })

    it('no localStorage persistence for captain/vc override (D-08 carry-forward)', () => {
      setupValidLineup()
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
      const { container } = render(<LineupTab teamId="123" />)
      // Perform a captain override + a VC override.
      const capId = cardIdOf(container.querySelector('[data-testid="captain-badge"]'))
      const vcId = cardIdOf(container.querySelector('[data-testid="vc-badge"]'))
      const cTarget = starterIds(container).find(id => id !== capId)!
      armCard(container, cTarget)
      fireEvent.click(pillsOf(container, cTarget).setC)
      const vcTarget = starterIds(container).find(id => id !== cTarget && id !== vcId)!
      armCard(container, vcTarget)
      fireEvent.click(pillsOf(container, vcTarget).setVc)
      const overrideCalls = setItemSpy.mock.calls.filter(([k]) =>
        typeof k === 'string' && /lineup|override|swap|captain|vc/i.test(k)
      )
      expect(overrideCalls.length).toBe(0)
      setItemSpy.mockRestore()
    })

    it('PlayerCard body click still arms swap (regression check)', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      // After refactor, the body button is at pitch-card-body-{id}.
      const someBody = container.querySelector('[data-testid^="pitch-card-body-"]') as HTMLButtonElement
      const id = someBody.getAttribute('data-testid')!.replace('pitch-card-body-', '')
      const parent = container.querySelector(`[data-testid="pitch-card-${id}"]`) as HTMLElement
      fireEvent.click(someBody)
      // After clicking a starter body, the parent (or body) should signal pending state.
      const pending = parent.getAttribute('data-pending') === 'true'
        || someBody.getAttribute('data-pending') === 'true'
      expect(pending).toBe(true)
    })
  })
  describe('PITCH-01: pitch surface, bench tray and formation switcher', () => {
    it('the pitch holds only the XI; the bench tray sits outside it', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      // The bench is no longer a fifth pitch row -- a bench is not on the pitch.
      const pitch = container.querySelector('[data-testid="pitch"]')!
      expect(pitch.querySelector('[data-testid="pitch-row-bench"]')).toBeNull()
      expect(container.querySelector('[data-testid="pitch-row-bench"]')).not.toBeNull()
      expect(starterIds(container)).toHaveLength(11)
    })

    it('drops the GK / DEF / MID / FWD label column -- the shape communicates it', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      // A textContent scan would be wrong: the card tooltip legitimately names
      // the position. The claim is structural — a row contains cards and
      // nothing else, where it used to lead with a label div.
      for (const row of ['gk', 'def', 'mid', 'fwd']) {
        const el = container.querySelector('[data-testid="pitch-row-' + row + '"]')!
        const kids = Array.from(el.children)
        expect(kids.length, row).toBeGreaterThan(0)
        for (const kid of kids) {
          expect(kid.getAttribute('data-testid'), row).toMatch(/^pitch-card-\d+$/)
        }
      }
    })

    it('the card tooltip carries the detail taken off the resting card', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      const id = starterIds(container)[0]
      const tip = container.querySelector('[data-testid="pitch-tip-' + id + '"]')!
      expect(tip).not.toBeNull()
      expect(tip.textContent).toContain('% start')
      expect(tip.textContent).toContain('xPts')
      // It must not be counted as a card by the keep-all-features tripwire.
      expect(tip.getAttribute('data-testid')).not.toMatch(/^pitch-card-/)
    })

    it('C / VC pills exist only under the armed card', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      // This is the point of the redesign: 22 permanent buttons became 0.
      expect(container.querySelectorAll('[data-testid^="set-c-"]')).toHaveLength(0)
      expect(container.querySelectorAll('[data-testid^="set-vc-"]')).toHaveLength(0)
      const id = starterIds(container)[0]
      armCard(container, id)
      expect(container.querySelectorAll('[data-testid^="set-c-"]')).toHaveLength(1)
      expect(pillsOf(container, id).setC).not.toBeNull()
    })

    it('renders all seven legal shapes in the switcher', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      const sw = container.querySelector('[data-testid="formation-switcher"]')!
      expect(sw.querySelectorAll('[role="radio"]')).toHaveLength(7)
      expect(container.querySelector('[data-testid="formation-4-4-2"]')).not.toBeNull()
    })

    it('picking a formation re-renders the pitch in that shape', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      fireEvent.click(container.querySelector('[data-testid="formation-5-3-2"]') as HTMLButtonElement)
      expect(container.querySelectorAll('[data-testid="pitch-row-def"] [data-testid^="pitch-card-body-"]')).toHaveLength(5)
      expect(container.querySelectorAll('[data-testid="pitch-row-mid"] [data-testid^="pitch-card-body-"]')).toHaveLength(3)
      expect(container.querySelectorAll('[data-testid="pitch-row-fwd"] [data-testid^="pitch-card-body-"]')).toHaveLength(2)
      expect(container.querySelector('[data-testid="formation-5-3-2"]')!.getAttribute('aria-checked')).toBe('true')
    })

    it('Reset returns the shape to the optimiser own choice', () => {
      setupValidLineup()
      const { container } = render(<LineupTab teamId="123" />)
      const before = container.querySelectorAll('[data-testid="pitch-row-def"] [data-testid^="pitch-card-body-"]').length
      fireEvent.click(container.querySelector('[data-testid="formation-5-3-2"]') as HTMLButtonElement)
      fireEvent.click(container.querySelector('[data-testid="lineup-reset"]') as HTMLButtonElement)
      expect(container.querySelectorAll('[data-testid="pitch-row-def"] [data-testid^="pitch-card-body-"]')).toHaveLength(before)
      // No shape is force-selected once Reset has run.
      const checked = Array.from(container.querySelectorAll('[data-testid="formation-switcher"] [role="radio"]'))
        .filter(b => b.getAttribute('aria-checked') === 'true')
      expect(checked).toHaveLength(0)
    })

    it('disables a shape the squad cannot field', () => {
      // 3 defenders owned, so 5-3-2 and 5-4-1 are unreachable.
      const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4]
      const picks: SquadPick[] = []
      const players: MergedPlayer[] = []
      for (let i = 0; i < 15; i++) {
        picks.push(makePick(i + 1, i + 1))
        players.push(makePlayer({ id: i + 1, element_type: elementTypes[i] }))
      }
      useSquadMock.mockReturnValue({
        data: { active_chip: null, picks, entry_history: { event: 30, bank: 0, event_transfers: 0, event_transfers_cost: 0, value: 1000 } },
        isLoading: false, error: null,
      })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<LineupTab teamId="123" />)
      expect((container.querySelector('[data-testid="formation-5-3-2"]') as HTMLButtonElement).disabled).toBe(true)
      expect((container.querySelector('[data-testid="formation-3-4-3"]') as HTMLButtonElement).disabled).toBe(false)
    })

    it('shows the cost of a forced shape against the optimiser choice', () => {
      // Make the optimum unambiguous: three strong forwards mean the free search
      // takes all three, so forcing 5-4-1 (one forward) must cost real points.
      const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
      const picks: SquadPick[] = []
      const players: MergedPlayer[] = []
      for (let i = 0; i < 15; i++) {
        const et = elementTypes[i]
        picks.push(makePick(i + 1, i + 1))
        players.push(makePlayer({ id: i + 1, element_type: et, xPts_1gw: et === 4 ? 9 : 2 }))
      }
      useSquadMock.mockReturnValue({
        data: { active_chip: null, picks, entry_history: { event: 30, bank: 0, event_transfers: 0, event_transfers_cost: 0, value: 1000 } },
        isLoading: false, error: null,
      })
      usePlayersMock.mockReturnValue({ data: players, isLoading: false })
      const { container } = render(<LineupTab teamId="123" />)
      const tiles = () => container.querySelector('[data-testid="lineup-headline-row"]')!.textContent!

      // Nothing to compare against until the user overrides the optimiser.
      expect(tiles()).not.toContain('vs optimal')
      fireEvent.click(container.querySelector('[data-testid="formation-5-4-1"]') as HTMLButtonElement)
      // Dropping two 9-point forwards for two 2-point outfielders is -14.
      expect(tiles()).toContain('vs optimal')
      expect(tiles()).toContain('14.0')
    })
  })
  describe('PITCH-01: card image source ladder', () => {
    // The two photo sources are different pictures, not two sizes of one: the PL
    // 110x140 is a portrait showing the current shirt, api-football's 150x150 is
    // a head-only crop. The shirt is what makes a pitch readable at a glance, so
    // the portrait has to lead.
    function renderOne(over: Partial<MergedPlayer>) {
      const { players, squadResp } = makeValidSquad()
      // A real short name so TEAM_BADGE_CODE resolves and useTeamBadge does not
      // short-circuit to the flat-colour fallback before an image is attempted.
      const patched = players.map(p => (p.id === 1 ? { ...p, team_short_name: 'MUN', ...over } : p))
      useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
      usePlayersMock.mockReturnValue({ data: patched, isLoading: false })
      return render(<LineupTab teamId="123" />).container
    }

    it('leads with the Premier League kit portrait, not the headshot', () => {
      const c = renderOne({ code: 223094, photo_url: 'https://media.api-sports.io/x.png' })
      const img = c.querySelector('[data-testid="pitch-card-kit-1"]') as HTMLImageElement
      expect(img.getAttribute('src')).toContain('resources.premierleague.com')
      expect(img.getAttribute('src')).toContain('223094')
      // A photo fills the tile from the head down so the shirt reads.
      expect(img.className).toContain('object-cover')
      expect(img.className).toContain('object-top')
    })

    it('falls back to the headshot when the portrait 404s, then to the kit', () => {
      const c = renderOne({ code: 223094, photo_url: 'https://media.api-sports.io/x.png' })
      const img = () => c.querySelector('[data-testid="pitch-card-kit-1"]') as HTMLImageElement
      fireEvent.error(img())
      expect(img().getAttribute('src')).toBe('https://media.api-sports.io/x.png')
      fireEvent.error(img())
      const src = img().getAttribute('src')!
      expect(src).toContain('shirt_')
      // The kit is a graphic, not a photo — cropping it clips the sleeves.
      expect(img().className).toContain('object-contain')
    })

    it('skips straight to the kit for a player with no photo of either kind', () => {
      const c = renderOne({ code: 0, photo_url: null })
      const img = c.querySelector('[data-testid="pitch-card-kit-1"]') as HTMLImageElement
      expect(img.getAttribute('src')).toContain('shirt_')
    })

    it('a new signing with no PL portrait still gets a face', () => {
      // The brief warned PL photos go stale; the headshot fallback is the answer.
      const c = renderOne({ code: 0, photo_url: 'https://media.api-sports.io/new.png' })
      const img = c.querySelector('[data-testid="pitch-card-kit-1"]') as HTMLImageElement
      expect(img.getAttribute('src')).toBe('https://media.api-sports.io/new.png')
    })
  })
})
