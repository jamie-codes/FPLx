// @vitest-environment jsdom
// Phase 126 (NSP-03, NSP-04): NextSeasonPlannerTab RTL integration tests.
// Phase 127 (127-04): Updated mocks to use PreSeasonSquadResponse envelope shape;
//   added health indicator and solver badge tests.
// Phase 128 (128-04): Added activation pill and first-activation banner tests (WR-03).
// Phase 129 (129-01): Extended with makeInputs helper and RED slider/infeasibility/amber tests (COST-01, COST-03).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import type { PreSeasonSquad, PreSeasonPlayer, SquadHealth, PreSeasonSquadResponse, PreSeasonSquadInputs } from '@/lib/types'

// Mock usePreSeasonSquad hook
const usePreSeasonSquadMock = vi.fn()
vi.mock('@/lib/hooks/usePreSeasonSquad', () => ({
  usePreSeasonSquad: () => usePreSeasonSquadMock(),
}))

// Mock usePreSeasonActive hook (Phase 128 AUTO-03) — default to Awaiting (null) so existing tests are unaffected.
const usePreSeasonActiveMock = vi.fn()
vi.mock('@/lib/hooks/usePreSeasonActive', () => ({
  usePreSeasonActive: () => usePreSeasonActiveMock(),
}))

// Import AFTER mocks
import { NextSeasonPlannerTab } from './NextSeasonPlannerTab'

// Helper: build a minimal PreSeasonPlayer for test data
function makePlayer(id: number, element_type: 1 | 2 | 3 | 4, team = 1): PreSeasonPlayer {
  return {
    id,
    web_name: `Player${id}`,
    element_type,
    team,
    team_short_name: 'TST',
    now_cost: 60,
    total_points: 120,
    ppm: 0.55,
  }
}

// Helper: build a minimal PreSeasonSquad for test data
function makeSquad(): PreSeasonSquad {
  const starters: PreSeasonPlayer[] = [
    makePlayer(1, 1),                              // GK
    makePlayer(2, 2), makePlayer(3, 2), makePlayer(4, 2), makePlayer(5, 2),  // DEF x4
    makePlayer(6, 3), makePlayer(7, 3), makePlayer(8, 3),                    // MID x3
    makePlayer(9, 4), makePlayer(10, 4), makePlayer(11, 4),                  // FWD x3
  ]
  const bench: PreSeasonPlayer[] = [
    makePlayer(12, 1),  // GK bench
    makePlayer(13, 2),  // DEF bench
    makePlayer(14, 3),  // MID bench
    makePlayer(15, 4),  // FWD bench
  ]
  return {
    starters,
    bench,
    formation: '4-3-3',
    budgetUsed: 900,
  }
}

// Helper: build a SquadHealth object
function makeHealth(overrides: Partial<SquadHealth> = {}): SquadHealth {
  return {
    greedy_null_rate: 0.1,
    min_feasible_budget_greedy: 83.5,
    greedy_optimality_gap_avg: null,
    budget_sweep_min: 80,
    budget_sweep_max: 120,
    budget_sweep_step: 0.5,
    sweep_count: 81,
    ...overrides,
  }
}

// Phase 129 (COST-01, COST-03): build a PreSeasonSquadInputs fixture.
// Players are tuned so:
//   buildPreSeasonSquad(players, scoreMap, 950) → non-null (squad costs 945 ≤ 950)
//   buildPreSeasonSquad(players, scoreMap, 800) → null (costs 945 > 800)
// ppm = 0.5 + (id * 0.01) for deterministic ranking.
// Core 15 players: 2 GK@50 + 5 DEF@50 + 5 MID@65 + 3 FWD@90 = 945 tenths.
// Plus 5 filler players at lower cost (id 16-20) to reach a 20-player pool.
// Team distribution: T1-T7, max 3 per team (teamCap=3 respected).
function makeInputs(overrides: Partial<PreSeasonSquadInputs> = {}): PreSeasonSquadInputs {
  const basePlayers: PreSeasonPlayer[] = [
    // 2 GK — teams 1,2
    { id: 1, web_name: 'InputPlayer1', element_type: 1, team: 1, team_short_name: 'IP1', now_cost: 50, total_points: 100, ppm: 0.51 },
    { id: 2, web_name: 'InputPlayer2', element_type: 1, team: 2, team_short_name: 'IP2', now_cost: 50, total_points: 100, ppm: 0.52 },
    // 5 DEF — teams 3,4,5,6,7
    { id: 3, web_name: 'InputPlayer3', element_type: 2, team: 3, team_short_name: 'IP3', now_cost: 50, total_points: 100, ppm: 0.53 },
    { id: 4, web_name: 'InputPlayer4', element_type: 2, team: 4, team_short_name: 'IP4', now_cost: 50, total_points: 100, ppm: 0.54 },
    { id: 5, web_name: 'InputPlayer5', element_type: 2, team: 5, team_short_name: 'IP5', now_cost: 50, total_points: 100, ppm: 0.55 },
    { id: 6, web_name: 'InputPlayer6', element_type: 2, team: 6, team_short_name: 'IP6', now_cost: 50, total_points: 100, ppm: 0.56 },
    { id: 7, web_name: 'InputPlayer7', element_type: 2, team: 7, team_short_name: 'IP7', now_cost: 50, total_points: 100, ppm: 0.57 },
    // 5 MID — teams 1,2,3,4,5
    { id: 8, web_name: 'InputPlayer8', element_type: 3, team: 1, team_short_name: 'IP1', now_cost: 65, total_points: 130, ppm: 0.58 },
    { id: 9, web_name: 'InputPlayer9', element_type: 3, team: 2, team_short_name: 'IP2', now_cost: 65, total_points: 130, ppm: 0.59 },
    { id: 10, web_name: 'InputPlayer10', element_type: 3, team: 3, team_short_name: 'IP3', now_cost: 65, total_points: 130, ppm: 0.60 },
    { id: 11, web_name: 'InputPlayer11', element_type: 3, team: 4, team_short_name: 'IP4', now_cost: 65, total_points: 130, ppm: 0.61 },
    { id: 12, web_name: 'InputPlayer12', element_type: 3, team: 5, team_short_name: 'IP5', now_cost: 65, total_points: 130, ppm: 0.62 },
    // 3 FWD — teams 6,7,1
    { id: 13, web_name: 'InputPlayer13', element_type: 4, team: 6, team_short_name: 'IP6', now_cost: 90, total_points: 150, ppm: 0.63 },
    { id: 14, web_name: 'InputPlayer14', element_type: 4, team: 7, team_short_name: 'IP7', now_cost: 90, total_points: 150, ppm: 0.64 },
    { id: 15, web_name: 'InputPlayer15', element_type: 4, team: 2, team_short_name: 'IP2', now_cost: 90, total_points: 150, ppm: 0.65 },
    // 5 filler players (lower cost) — teams spread to avoid teamCap violation
    { id: 16, web_name: 'InputPlayer16', element_type: 2, team: 3, team_short_name: 'IP3', now_cost: 40, total_points: 60, ppm: 0.66 },
    { id: 17, web_name: 'InputPlayer17', element_type: 3, team: 4, team_short_name: 'IP4', now_cost: 45, total_points: 70, ppm: 0.67 },
    { id: 18, web_name: 'InputPlayer18', element_type: 4, team: 5, team_short_name: 'IP5', now_cost: 45, total_points: 70, ppm: 0.68 },
    { id: 19, web_name: 'InputPlayer19', element_type: 2, team: 6, team_short_name: 'IP6', now_cost: 40, total_points: 60, ppm: 0.69 },
    { id: 20, web_name: 'InputPlayer20', element_type: 3, team: 7, team_short_name: 'IP7', now_cost: 45, total_points: 70, ppm: 0.70 },
  ]
  const scoreMap: Record<string, number> = Object.fromEntries(
    basePlayers.map(p => [String(p.id), p.ppm])
  )
  return {
    players: basePlayers,
    scoreMap,
    budget_default: 1000,
    ...overrides,
  }
}

// Helper: build a PreSeasonSquadResponse envelope
function makeEnvelope(overrides: Partial<PreSeasonSquadResponse> = {}): PreSeasonSquadResponse {
  return {
    squad: makeSquad(),
    health: null,
    solver: 'ilp',
    ...overrides,
  }
}

describe('NextSeasonPlannerTab', () => {
  beforeEach(() => {
    // Default to Awaiting state (null) so existing tests are unaffected by Phase 128 pill.
    usePreSeasonActiveMock.mockReturnValue({ data: null, isLoading: false, isSuccess: true })
  })

  it('renders "Pre-season squad not yet available" when usePreSeasonSquad returns null data', () => {
    usePreSeasonSquadMock.mockReturnValue({ data: null, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toMatch(/pre-season squad/i)
  })

  it('renders formation grid with formation string and player rows when data is populated', () => {
    const envelope = makeEnvelope()
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    // Formation string should appear
    expect(container.textContent).toContain('4-3-3')
    // All 15 player names should appear
    envelope.squad!.starters.concat(envelope.squad!.bench).forEach(p => {
      expect(container.textContent).toContain(p.web_name)
    })
  })

  it('renders "Fixtures not yet published" when next-season fixtures hook returns empty', () => {
    const envelope = makeEnvelope()
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toMatch(/fixtures not yet published/i)
  })

  it('renders error copy "Failed to load pre-season squad" when isError is true', () => {
    usePreSeasonSquadMock.mockReturnValue({ data: null, isLoading: false, isError: true })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toMatch(/failed to load pre-season squad/i)
  })

  it('surfaces reason code in error paragraph when error has infeasible message (GREEDY-NULL)', () => {
    // Hook throws with reason when 503 body includes reason code
    usePreSeasonSquadMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Squad infeasible — ILP fallback pending (unmet_min_slots)'),
    })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toContain('unmet_min_slots')
  })

  // Phase 127 Task 2: new tests for health indicator and solver badge

  it('renders ILP pill and no health paragraph when solver=ilp and health=null', () => {
    const envelope = makeEnvelope({ solver: 'ilp', health: null })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toContain('ILP')
    // No health indicator paragraph should be rendered
    expect(container.textContent).not.toMatch(/Greedy success rate/i)
    expect(container.textContent).not.toMatch(/No feasible squad found/i)
  })

  it('renders Greedy pill and health paragraph with percentage and budget values when health is present', () => {
    const health = makeHealth({
      greedy_null_rate: 0.1,
      min_feasible_budget_greedy: 83.5,
      budget_sweep_min: 80,
      budget_sweep_max: 120,
    })
    const envelope = makeEnvelope({ solver: 'greedy', health })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toContain('Greedy')
    expect(container.textContent).toContain('90%')
    expect(container.textContent).toContain('£80m')
    expect(container.textContent).toContain('£120m')
    expect(container.textContent).toContain('£83.5m')
  })

  it('renders "100% — all budgets feasible" when greedy_null_rate is 0', () => {
    const health = makeHealth({ greedy_null_rate: 0, min_feasible_budget_greedy: 80 })
    const envelope = makeEnvelope({ solver: 'ilp', health })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toContain('100%')
    expect(container.textContent).toContain('all budgets feasible')
  })

  it('renders "No feasible squad found" text in red when min_feasible_budget_greedy is null', () => {
    const health = makeHealth({ greedy_null_rate: 1, min_feasible_budget_greedy: null })
    const envelope = makeEnvelope({ solver: 'ilp', health })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toContain('No feasible squad found')
    // Red text element
    const redEl = container.querySelector('.text-red-600, .text-red-400')
    expect(redEl).not.toBeNull()
  })

  it('renders "Pre-season squad not yet available" when data is null (404 state)', () => {
    usePreSeasonSquadMock.mockReturnValue({ data: null, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toMatch(/Pre-season squad not yet available/i)
    // No badge, no health paragraph
    expect(container.textContent).not.toContain('ILP')
    expect(container.textContent).not.toContain('Greedy')
    expect(container.textContent).not.toMatch(/Greedy success rate/i)
  })

  // Phase 128 AUTO-03: activation pill and first-activation banner tests (WR-03)

  it('renders "Live" pill when usePreSeasonActive returns non-null data', () => {
    usePreSeasonSquadMock.mockReturnValue({ data: null, isLoading: false, isError: false })
    usePreSeasonActiveMock.mockReturnValue({
      data: { activated_at: '2026-08-01T04:12:33Z', season_id: '2526' },
      isLoading: false,
      isSuccess: true,
    })
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toContain('Live')
  })

  it('renders activation banner with correct copy when data is non-null and localStorage key absent', () => {
    usePreSeasonSquadMock.mockReturnValue({ data: null, isLoading: false, isError: false })
    usePreSeasonActiveMock.mockReturnValue({
      data: { activated_at: '2026-08-01T04:12:33Z', season_id: '2526' },
      isLoading: false,
      isSuccess: true,
    })
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).toContain(
      '🏆 Pre-season is live — your squad has been re-optimised against the new FPL prices.'
    )
  })

  it('calls localStorage.setItem with correct key when dismiss button is clicked', () => {
    usePreSeasonSquadMock.mockReturnValue({ data: null, isLoading: false, isError: false })
    usePreSeasonActiveMock.mockReturnValue({
      data: { activated_at: '2026-08-01T04:12:33Z', season_id: '2526' },
      isLoading: false,
      isSuccess: true,
    })
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const { getByLabelText } = render(<NextSeasonPlannerTab />)
    const dismissBtn = getByLabelText('Dismiss activation banner')
    fireEvent.click(dismissBtn)
    expect(setItemSpy).toHaveBeenCalledWith('fplx_nsp_activation_seen_2526', 'true')
  })

  it('suppresses banner when localStorage returns "true" for the activation seen key', () => {
    usePreSeasonSquadMock.mockReturnValue({ data: null, isLoading: false, isError: false })
    usePreSeasonActiveMock.mockReturnValue({
      data: { activated_at: '2026-08-01T04:12:33Z', season_id: '2526' },
      isLoading: false,
      isSuccess: true,
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) =>
      key === 'fplx_nsp_activation_seen_2526' ? 'true' : null
    )
    const { container } = render(<NextSeasonPlannerTab />)
    expect(container.textContent).not.toContain(
      '🏆 Pre-season is live — your squad has been re-optimised against the new FPL prices.'
    )
  })

  // Phase 129 (COST-01, COST-03): RED slider, infeasibility, and amber-track tests.
  // All tests below FAIL at Wave 0 because:
  //   - PreSeasonSquadInputs not yet exported from types.ts (Wave 1 task)
  //   - Component does not render <input type="range"> (Wave 2 task)
  //   - Component does not implement infeasibility / amber gradient (Wave 3 task)
  // The 13 existing tests above remain GREEN — makeEnvelope() has no inputs field
  // so the component's defensive gate treats data.inputs === undefined as "no slider".

  it('does NOT render slider when envelope has no inputs field (Phase 127/128 regression)', () => {
    // Envelope without inputs → no slider should render (backwards compat guard)
    const envelope = makeEnvelope()  // no inputs field
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    // No slider input when inputs absent
    expect(container.querySelector('input[type="range"]')).toBeNull()
    // Legacy formation grid still renders
    expect(container.textContent).toContain('4-3-3')
  })

  it('renders slider input when data.inputs is present', () => {
    const envelope = makeEnvelope({ inputs: makeInputs() })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    // Slider should be present when inputs are available
    expect(container.querySelector('input[type="range"]')).not.toBeNull()
    // Label with budget should appear
    expect(container.textContent).toContain('Budget: £100.0m')
  })

  it('slider initial value is £100.0m with aria-valuetext £100.0m', () => {
    const envelope = makeEnvelope({ inputs: makeInputs() })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement
    // Initial value = 100 (D-05: default £100m)
    expect(slider.value).toBe('100')
    // aria-valuetext per UI-SPEC
    expect(slider.getAttribute('aria-valuetext')).toBe('£100.0m')
  })

  it('slider has min=80 max=120 step=0.5 and aria-label Budget slider', () => {
    const envelope = makeEnvelope({ inputs: makeInputs() })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement
    // Slider range attributes per COST-01
    expect(slider.min).toBe('80')
    expect(slider.max).toBe('120')
    expect(slider.step).toBe('0.5')
    expect(slider.getAttribute('aria-label')).toBe('Budget slider')
    expect(slider.getAttribute('aria-valuemin')).toBe('80')
    expect(slider.getAttribute('aria-valuemax')).toBe('120')
  })

  it('shows API squad (budgetUsed) before any commit (D-06)', () => {
    // Before any pointerUp, the grid should show the API squad (data.squad)
    // The API squad has budgetUsed=900 (£90.0m from makeSquad)
    const envelope = makeEnvelope({ inputs: makeInputs(), health: makeHealth() })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    // The API squad formation should appear (from makeSquad — '4-3-3')
    expect(container.textContent).toContain('4-3-3')
    // API squad player names should appear (not input players)
    expect(container.textContent).toContain('Player1')
  })

  it('onInput updates label only (no recompute; grid still shows API squad)', () => {
    const envelope = makeEnvelope({ inputs: makeInputs(), health: makeHealth() })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement
    // Fire onInput — visual only
    fireEvent.input(slider, { target: { value: '85.5' } })
    // Label should update to the new value
    expect(container.textContent).toContain('Budget: £85.5m')
    expect(slider.getAttribute('aria-valuetext')).toBe('£85.5m')
    // Grid still shows API squad — Player1 from makeSquad still visible (no recompute)
    expect(container.textContent).toContain('Player1')
    // API squad formation still visible (no recompute)
    expect(container.textContent).toContain('4-3-3')
  })

  it('pointerUp commits to client squad (D-06)', () => {
    // After pointerUp, the grid should switch to the client greedy result
    const envelope = makeEnvelope({ inputs: makeInputs(), health: makeHealth() })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement
    // Set slider to 95 (£95m = budget 950) — greedy should return a squad
    fireEvent.input(slider, { target: { value: '95' } })
    fireEvent.pointerUp(slider)
    // After commit, the grid should show client squad — InputPlayer names should appear
    // (the greedy algo picks from makeInputs players who have web_name 'InputPlayerN')
    expect(container.textContent).toMatch(/InputPlayer\d+/)
  })

  it('infeasibility variant A: shows "No squad possible at £X.Xm — try £Y.Ym+" (D-08)', () => {
    // Set up envelope with inputs where budget=800 returns null, health.min_feasible=83.5
    const envelope = makeEnvelope({
      inputs: makeInputs(),
      health: makeHealth({ min_feasible_budget_greedy: 83.5 }),
    })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement
    // Commit at £80m — infeasible (squad costs 945 > 800)
    fireEvent.input(slider, { target: { value: '80.0' } })
    fireEvent.pointerUp(slider)
    // Variant A: show suggestion from health.min_feasible_budget_greedy
    expect(container.textContent).toContain('No squad possible at £80.0m — try £83.5m+')
  })

  it('infeasibility variant B: shows "No squad possible at £X.Xm" when health is null (D-09)', () => {
    // health === null → no suggestion suffix
    const envelope = makeEnvelope({
      inputs: makeInputs(),
      health: null,
    })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement
    // Commit at £80m — infeasible
    fireEvent.input(slider, { target: { value: '80.0' } })
    fireEvent.pointerUp(slider)
    // Variant B: no suggestion
    expect(container.textContent).toContain('No squad possible at £80.0m')
    expect(container.textContent).not.toContain(' — try ')
  })

  it('grid stays visible at infeasible budget showing lastValidSquad (D-07)', () => {
    // Commit at 95 (feasible) first, then commit at 80 (infeasible)
    const envelope = makeEnvelope({
      inputs: makeInputs(),
      health: makeHealth({ min_feasible_budget_greedy: 83.5 }),
    })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement
    // First commit at 95 (feasible)
    fireEvent.input(slider, { target: { value: '95' } })
    fireEvent.pointerUp(slider)
    // Second commit at 80 (infeasible)
    fireEvent.input(slider, { target: { value: '80.0' } })
    fireEvent.pointerUp(slider)
    // Infeasibility message appears
    expect(container.textContent).toContain('No squad possible at £80.0m')
    // Grid stays visible — lastValidSquad from first commit still shown
    expect(container.textContent).toMatch(/InputPlayer\d+/)
  })

  it('amber gradient inline style contains #f59e0b and 10% threshold when min_feasible=84 (D-10)', () => {
    // threshold = ((84 - 80) / 40) * 100 = 10%
    const envelope = makeEnvelope({
      inputs: makeInputs(),
      health: makeHealth({ min_feasible_budget_greedy: 84 }),
    })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement
    // Amber gradient must include the amber color and threshold position
    expect(slider.style.background).toContain('#f59e0b')
    expect(slider.style.background).toContain('10%')
  })

  it('slider track is zinc #71717a only when health is null (D-11)', () => {
    const envelope = makeEnvelope({
      inputs: makeInputs(),
      health: null,  // no health → zinc track
    })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement
    // Zinc-only track, no gradient
    // jsdom normalises hex colours to rgb() — check for the rgb equivalent of #71717a
    expect(slider.style.background).toMatch(/#71717a|rgb\(113,\s*113,\s*122\)/)
    expect(slider.style.background).not.toContain('linear-gradient')
  })

  it('keyboard arrow + 300ms debounce commits once', async () => {
    const envelope = makeEnvelope({ inputs: makeInputs(), health: makeHealth() })
    usePreSeasonSquadMock.mockReturnValue({ data: envelope, isLoading: false, isError: false })
    vi.useFakeTimers()
    const { container } = render(<NextSeasonPlannerTab />)
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement
    // Simulate keyboard navigation: input then keyUp
    fireEvent.input(slider, { target: { value: '95.0' } })
    fireEvent.keyUp(slider, { key: 'ArrowRight' })
    // Before 300ms: grid should not yet show client squad (API squad still showing)
    expect(container.textContent).toContain('Player1')  // API squad player
    // Advance timers past debounce threshold
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    // After 300ms: grid should now show client squad
    expect(container.textContent).toMatch(/InputPlayer\d+/)
    vi.useRealTimers()
  })

  it('slider NOT rendered when isError is true', () => {
    usePreSeasonSquadMock.mockReturnValue({ data: null, isLoading: false, isError: true })
    const { container } = render(<NextSeasonPlannerTab />)
    // No slider when error state
    expect(container.querySelector('input[type="range"]')).toBeNull()
    // Error copy still appears
    expect(container.textContent).toMatch(/failed to load pre-season squad/i)
  })

  it('slider NOT rendered when data is null (Prices pending)', () => {
    usePreSeasonSquadMock.mockReturnValue({ data: null, isLoading: false, isError: false })
    const { container } = render(<NextSeasonPlannerTab />)
    // No slider when data is null (archive not available)
    expect(container.querySelector('input[type="range"]')).toBeNull()
    // Empty state copy appears
    expect(container.textContent).toMatch(/pre-season squad not yet available/i)
  })
})
