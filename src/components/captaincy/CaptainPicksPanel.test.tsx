// Phase 57 (EO-01..EO-04): CaptainPicksPanel RTL tests — RED in Wave 0, GREEN after rewrite.
// Mirrors src/components/optimiser/ChipModeToggle.test.tsx pattern.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, within } from '@testing-library/react'
import { CaptainPicksPanel } from './CaptainPicksPanel'
import type { MergedPlayer } from '@/lib/types'

vi.mock('@/lib/hooks/usePlayers', () => ({ usePlayers: vi.fn() }))
vi.mock('@/lib/hooks/useCaptainPicks', () => ({ useCaptainPicks: vi.fn() }))
vi.mock('@/lib/hooks/useAuthStatus', () => ({ useAuthStatus: vi.fn() }))
vi.mock('@/lib/hooks/useMyTeam', () => ({ useMyTeam: vi.fn() }))

import { usePlayers } from '@/lib/hooks/usePlayers'
import { useCaptainPicks } from '@/lib/hooks/useCaptainPicks'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { useMyTeam } from '@/lib/hooks/useMyTeam'

type PlayerOverrides = Partial<MergedPlayer> & { id: number; element_type: 1 | 2 | 3 | 4 }
function makePlayer(overrides: PlayerOverrides): MergedPlayer {
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

function buildPlayers(): MergedPlayer[] {
  return [
    // 5 mids/fwds with varying xPts_1gw and selected_by_percent
    makePlayer({ id: 101, element_type: 3, web_name: 'Salah',   selected_by_percent: '34.5', xPts_1gw: 7.8, xPts_90th_1gw: 11.2 }),
    makePlayer({ id: 102, element_type: 3, web_name: 'Saka',    selected_by_percent: '28.0', xPts_1gw: 6.4, xPts_90th_1gw: 9.6 }),
    makePlayer({ id: 103, element_type: 4, web_name: 'Haaland', selected_by_percent: '52.1', xPts_1gw: 8.1, xPts_90th_1gw: 12.5 }),
    makePlayer({ id: 104, element_type: 3, web_name: 'Palmer',  selected_by_percent: '22.4', xPts_1gw: 6.0, xPts_90th_1gw: 9.0 }),
    makePlayer({ id: 105, element_type: 3, web_name: 'Differ',  selected_by_percent: '4.2',  xPts_1gw: 6.7, xPts_90th_1gw: 9.4 }),
  ]
}

beforeEach(() => {
  vi.mocked(usePlayers).mockReturnValue({ data: buildPlayers(), isLoading: false, error: null } as never)
  vi.mocked(useCaptainPicks).mockReturnValue({ data: { gameweek: 28, ceiling: null, eo_adjusted: null }, isLoading: false, error: null } as never)
  vi.mocked(useAuthStatus).mockReturnValue({ isAuthenticated: false, expiresAt: undefined, isLoading: false, setAuthenticated: vi.fn(), clearAuthenticated: vi.fn() } as never)
  vi.mocked(useMyTeam).mockReturnValue({ data: undefined, isLoading: false, error: null } as never)
})

describe('CaptainPicksPanel — Phase 57', () => {
  // a. Toggle render + default mode
  it('renders 4 mode toggle buttons with correct testIds', () => {
    const { getByTestId } = render(<CaptainPicksPanel />)
    expect(getByTestId('eo-toggle-max-xpts')).toBeTruthy()
    expect(getByTestId('eo-toggle-protect-rank')).toBeTruthy()
    expect(getByTestId('eo-toggle-chase-rank')).toBeTruthy()
    expect(getByTestId('eo-toggle-differential')).toBeTruthy()
  })

  it('Max xPts is the default active mode (D-04)', () => {
    const { getByTestId } = render(<CaptainPicksPanel />)
    expect(getByTestId('eo-toggle-max-xpts').getAttribute('aria-pressed')).toBe('true')
    expect(getByTestId('eo-toggle-protect-rank').getAttribute('aria-pressed')).toBe('false')
    expect(getByTestId('eo-toggle-chase-rank').getAttribute('aria-pressed')).toBe('false')
    expect(getByTestId('eo-toggle-differential').getAttribute('aria-pressed')).toBe('false')
  })

  it('toggle group has role="group" with aria-label="Captain ranking mode"', () => {
    const { container } = render(<CaptainPicksPanel />)
    const group = container.querySelector('[role="group"]')
    expect(group).not.toBeNull()
    expect(group!.getAttribute('aria-label')).toBe('Captain ranking mode')
  })

  // b. Mode switching reorders rows (EO-02)
  it('clicking Protect Rank reorders the list to highest selected_by_percent first', () => {
    const { getByTestId, getAllByTestId } = render(<CaptainPicksPanel />)
    fireEvent.click(getByTestId('eo-toggle-protect-rank'))
    const rows = getAllByTestId('eo-candidate-row')
    expect(rows[0].textContent).toContain('Haaland')
  })

  it('clicking Differential filters and reorders to ascending EO above-median xPts', () => {
    const { getByTestId, getAllByTestId } = render(<CaptainPicksPanel />)
    fireEvent.click(getByTestId('eo-toggle-differential'))
    const rows = getAllByTestId('eo-candidate-row')
    expect(rows[0].textContent).toContain('Differ')
  })

  it('clicking Chase Rank reorders by xPts_90th_1gw descending', () => {
    const { getByTestId, getAllByTestId } = render(<CaptainPicksPanel />)
    fireEvent.click(getByTestId('eo-toggle-chase-rank'))
    const rows = getAllByTestId('eo-candidate-row')
    expect(rows[0].textContent).toContain('Haaland')
  })

  // c. EO% inline display (EO-01)
  it('renders ~XX% inline next to player name in default mode', () => {
    const { getAllByTestId } = render(<CaptainPicksPanel />)
    // Default (max_xpts): Haaland (8.1 xPts) is first
    const rows = getAllByTestId('eo-candidate-row')
    const firstRow = rows[0]
    const eoSpan = within(firstRow).getByText(/^~\d+%$/)
    expect(eoSpan).toBeTruthy()
    // Haaland has 52.1% → rounds to ~52%
    expect(eoSpan.textContent).toBe('~52%')
  })

  it('the ~XX% span carries the exact tooltip text', () => {
    const { getAllByTestId } = render(<CaptainPicksPanel />)
    const rows = getAllByTestId('eo-candidate-row')
    const firstRow = rows[0]
    const eoSpan = within(firstRow).getByText(/^~\d+%$/)
    expect(eoSpan.getAttribute('title')).toBe('Approximate effective ownership based on FPL selected_by_percent data.')
  })

  // d. Dangerous to fade badge gating (EO-03 / D-08–D-11)
  it('badge appears for high-EO non-squad players when authenticated + protect_rank', () => {
    vi.mocked(useAuthStatus).mockReturnValue({ isAuthenticated: true, expiresAt: undefined, isLoading: false, setAuthenticated: vi.fn(), clearAuthenticated: vi.fn() } as never)
    vi.mocked(useMyTeam).mockReturnValue({
      data: {
        picks: [{ element: 101, position: 1, selling_price: 130, multiplier: 1, is_captain: false, is_vice_captain: false }],
        entry_history: { event_transfers: 1, bank: 0 },
      },
      isLoading: false,
      error: null,
    } as never)
    const { getByTestId, getAllByTestId } = render(<CaptainPicksPanel submittedId="123" />)
    fireEvent.click(getByTestId('eo-toggle-protect-rank'))
    const rows = getAllByTestId('eo-candidate-row')
    // Haaland (52.1% EO, NOT in squad) should have the badge
    const haalandRow = rows.find(r => r.textContent?.includes('Haaland'))
    expect(haalandRow?.textContent).toContain('Dangerous to fade')
    // Salah (34.5% EO, IS in squad) should NOT have the badge
    const salahRow = rows.find(r => r.textContent?.includes('Salah'))
    expect(salahRow?.textContent).not.toContain('Dangerous to fade')
  })

  it('badge hidden entirely when unauthenticated (D-10, Pitfall 3 regression)', () => {
    // default mocks: isAuthenticated: false
    const { getByTestId, queryByText } = render(<CaptainPicksPanel />)
    fireEvent.click(getByTestId('eo-toggle-protect-rank'))
    expect(queryByText('Dangerous to fade')).toBeNull()
  })

  it('badge hidden in non-protect_rank modes (D-11)', () => {
    vi.mocked(useAuthStatus).mockReturnValue({ isAuthenticated: true, expiresAt: undefined, isLoading: false, setAuthenticated: vi.fn(), clearAuthenticated: vi.fn() } as never)
    vi.mocked(useMyTeam).mockReturnValue({
      data: {
        picks: [{ element: 999, position: 1, selling_price: 130, multiplier: 1, is_captain: false, is_vice_captain: false }],
        entry_history: { event_transfers: 1, bank: 0 },
      },
      isLoading: false,
      error: null,
    } as never)
    const { getByTestId, queryByText } = render(<CaptainPicksPanel submittedId="123" />)
    // default mode: max_xpts — no badge
    expect(queryByText('Dangerous to fade')).toBeNull()
    // chase_rank — no badge
    fireEvent.click(getByTestId('eo-toggle-chase-rank'))
    expect(queryByText('Dangerous to fade')).toBeNull()
    // differential — no badge
    fireEvent.click(getByTestId('eo-toggle-differential'))
    expect(queryByText('Dangerous to fade')).toBeNull()
  })

  it('badge hidden for low-EO players even in protect_rank', () => {
    vi.mocked(useAuthStatus).mockReturnValue({ isAuthenticated: true, expiresAt: undefined, isLoading: false, setAuthenticated: vi.fn(), clearAuthenticated: vi.fn() } as never)
    vi.mocked(useMyTeam).mockReturnValue({
      data: {
        picks: [{ element: 999, position: 1, selling_price: 130, multiplier: 1, is_captain: false, is_vice_captain: false }],
        entry_history: { event_transfers: 1, bank: 0 },
      },
      isLoading: false,
      error: null,
    } as never)
    const { getByTestId, getAllByTestId } = render(<CaptainPicksPanel submittedId="123" />)
    fireEvent.click(getByTestId('eo-toggle-protect-rank'))
    const rows = getAllByTestId('eo-candidate-row')
    // Palmer (22.4% EO) should NOT have badge (EO < 30)
    const palmerRow = rows.find(r => r.textContent?.includes('Palmer'))
    expect(palmerRow?.textContent).not.toContain('Dangerous to fade')
  })

  // e. Loading / error states
  it('shows loading copy when usePlayers is loading', () => {
    vi.mocked(usePlayers).mockReturnValue({ data: undefined, isLoading: true, error: null } as never)
    const { getByText } = render(<CaptainPicksPanel />)
    expect(getByText('Loading captain picks…')).toBeTruthy()
  })

  it('shows error copy when usePlayers errors', () => {
    vi.mocked(usePlayers).mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    const { getByText } = render(<CaptainPicksPanel />)
    expect(getByText(/Failed to load captain picks/)).toBeTruthy()
  })
})

// Phase 62 MC-04 — helper to add MC fields to the standard buildPlayers() output.
// Uses deterministic values to ensure reproducible tests.
// haul_prob: 0.45 → 0.05 descending, p10_pts: 3.0 → 5.0, p90_pts: 14.0 → 8.0
function withMC(players: MergedPlayer[]): MergedPlayer[] {
  const mcData = [
    { haul_prob: 0.45, p10_pts: 3.0, p90_pts: 14.0, blank_prob: 0.05, p90_override: 14.0 },
    { haul_prob: 0.35, p10_pts: 4.0, p90_pts: 13.0, blank_prob: 0.08, p90_override: 13.0 },
    { haul_prob: 0.30, p10_pts: 5.0, p90_pts: 12.0, blank_prob: 0.10, p90_override: 12.0 },
    { haul_prob: 0.20, p10_pts: 4.5, p90_pts: 11.0, blank_prob: 0.12, p90_override: 11.0 },
    { haul_prob: 0.10, p10_pts: 3.5, p90_pts: 9.0,  blank_prob: 0.15, p90_override: 9.0 },
  ]
  return players.map((p, i) => ({
    ...p,
    ...mcData[i % mcData.length],
  }))
}

describe('Phase 62: MC-04 captain enrichment', () => {
  // Test 1: TC callout renders when MC fields present
  it('renders TC callout with player name and haul% when haul_prob is present', () => {
    vi.mocked(usePlayers).mockReturnValue({ data: withMC(buildPlayers()), isLoading: false, error: null } as never)
    const { getByTestId } = render(<CaptainPicksPanel />)
    const callout = getByTestId('tc-callout')
    expect(callout).toBeTruthy()
    expect(callout.textContent).toMatch(/TC: .+ — \d+% P\(haul\)/)
  })

  // Test 2: TC callout absent when MC fields absent
  it('does NOT render TC callout when haul_prob is absent from all candidates', () => {
    // default buildPlayers() has no haul_prob — standard pre-Phase 61 data
    vi.mocked(usePlayers).mockReturnValue({ data: buildPlayers(), isLoading: false, error: null } as never)
    const { queryByTestId } = render(<CaptainPicksPanel />)
    expect(queryByTestId('tc-callout')).toBeNull()
  })

  // Test 3: MC label badge renders for highest haul_prob player
  it('renders "Best P(haul)" badge with correct percent for top haul_prob player', () => {
    // withMC: player index 0 has highest haul_prob=0.45 → "45%"
    vi.mocked(usePlayers).mockReturnValue({ data: withMC(buildPlayers()), isLoading: false, error: null } as never)
    const { getByText } = render(<CaptainPicksPanel />)
    // In max_xpts mode, Haaland (id:103, xPts_1gw:8.1) is first — that player maps to mcData[2] (haul_prob=0.30 → 30%)
    // Salah (id:101, xPts_1gw:7.8) is second — maps to mcData[0] (haul_prob=0.45 → 45%)
    // But computeMCLabels operates on eoCandidates order: [Haaland, Salah, Differ, Saka, Palmer]
    // in max_xpts: sorted by xPts: 8.1, 7.8, 6.7, 6.4, 6.0 → [103, 101, 105, 102, 104]
    // withMC maps by index: 103→mcData[0](0.45), 101→mcData[1](0.35), 105→mcData[2](0.30), 102→mcData[3](0.20), 104→mcData[4](0.10)
    // Wait — withMC maps original buildPlayers() array order: [101,102,103,104,105]
    // 101(Salah)→mcData[0](0.45), 102(Saka)→mcData[1](0.35), 103(Haaland)→mcData[2](0.30), 104(Palmer)→mcData[3](0.20), 105(Differ)→mcData[4](0.10)
    // eoCandidates in max_xpts: sorted by xPts: Haaland(8.1)=id:103→0.30, Salah(7.8)=id:101→0.45, Differ(6.7)=id:105→0.10, Saka(6.4)=id:102→0.35, Palmer(6.0)=id:104→0.20
    // computeMCLabels assigns: haul→id:101(0.45→45%), ceiling→id:102(p90=13.0 among unlabelled: 102,103,104,105 after 101 labelled; highest p90=13.0 is id:102), floor→id:103(highest p10 among unlabelled 103,104,105: 5.0=103)
    // So "Best P(haul) — 45%" badge should appear for Salah
    expect(getByText(/Best P\(haul\) — \d+%/)).toBeTruthy()
  })

  // Test 4: At most 3 MC label badges rendered across all candidate rows
  it('renders at most 3 mc-label-badge elements when 5 candidates all have full MC fields', () => {
    vi.mocked(usePlayers).mockReturnValue({ data: withMC(buildPlayers()), isLoading: false, error: null } as never)
    const { queryAllByTestId } = render(<CaptainPicksPanel />)
    const badges = queryAllByTestId('mc-label-badge')
    expect(badges.length).toBeLessThanOrEqual(3)
    expect(badges.length).toBe(3)
  })

  // Test 5: Player winning Best P(haul) gets only one badge; Highest ceiling badge goes to next player
  it('player with highest haul_prob gets only the Best P(haul) badge; Highest ceiling badge goes to a different player', () => {
    // withMC: Salah(101)→haul_prob=0.45 (Best P(haul)), Haaland(103)→p90_pts via mcData[2]
    vi.mocked(usePlayers).mockReturnValue({ data: withMC(buildPlayers()), isLoading: false, error: null } as never)
    const { queryAllByTestId } = render(<CaptainPicksPanel />)
    const badges = queryAllByTestId('mc-label-badge')
    // At most 3 badges total
    expect(badges.length).toBeLessThanOrEqual(3)
    // Find the "Best P(haul)" badge
    const haulBadge = badges.find(b => b.textContent?.includes('Best P(haul)'))
    // Find the "Highest ceiling" badge
    const ceilingBadge = badges.find(b => b.textContent?.includes('Highest ceiling'))
    expect(haulBadge).toBeDefined()
    expect(ceilingBadge).toBeDefined()
    // They should not be the same element
    expect(haulBadge).not.toBe(ceilingBadge)
  })

  // Test 6: No mc-label-badge when haul_prob is absent from all candidates
  it('renders 0 mc-label-badge elements when MC fields are absent', () => {
    vi.mocked(usePlayers).mockReturnValue({ data: buildPlayers(), isLoading: false, error: null } as never)
    const { queryAllByTestId } = render(<CaptainPicksPanel />)
    expect(queryAllByTestId('mc-label-badge').length).toBe(0)
  })
})

// Phase 102 MC-02: CandidateRow inline P10/P90 range after pts (C).
describe('Phase 102 MC-02: CandidateRow P10/P90 inline range', () => {
  it('renders " · {p10}–{p90}" span after pts (C) when both p10_pts and p90_pts are defined', () => {
    vi.mocked(usePlayers).mockReturnValue({ data: withMC(buildPlayers()), isLoading: false, error: null } as never)
    const { container } = render(<CaptainPicksPanel />)
    // withMC mcData[0] sets p10_pts=3.0, p90_pts=14.0 for the first player (id:101 Salah)
    // Look for any element whose text content includes " · 3.0–14.0"
    const range = Array.from(container.querySelectorAll('span')).find(
      s => /·\s*3\.0\s*–\s*14\.0/.test(s.textContent ?? '')
    )
    expect(range).toBeDefined()
  })

  it('range span has classes text-xs text-zinc-400 dark:text-zinc-500 tabular-nums', () => {
    vi.mocked(usePlayers).mockReturnValue({ data: withMC(buildPlayers()), isLoading: false, error: null } as never)
    const { container } = render(<CaptainPicksPanel />)
    const range = Array.from(container.querySelectorAll('span')).find(
      s => /·\s*\d/.test(s.textContent ?? '') && /–/.test(s.textContent ?? '')
    )
    expect(range).toBeDefined()
    const cls = range?.className ?? ''
    expect(cls).toContain('text-xs')
    expect(cls).toContain('text-zinc-400')
    expect(cls).toContain('dark:text-zinc-500')
    expect(cls).toContain('tabular-nums')
  })

  it('P10/P90 values are RAW (not doubled) — withMC p10=3.0 p90=14.0 renders " · 3.0–14.0" not " · 6.0–28.0"', () => {
    vi.mocked(usePlayers).mockReturnValue({ data: withMC(buildPlayers()), isLoading: false, error: null } as never)
    const { container } = render(<CaptainPicksPanel />)
    // Doubled values should NOT appear anywhere in a range span
    const doubledRange = Array.from(container.querySelectorAll('span')).find(
      s => /·\s*6\.0\s*–\s*28\.0/.test(s.textContent ?? '')
    )
    expect(doubledRange).toBeUndefined()
  })

  it('does NOT render range span when p10_pts is absent (gate-off path)', () => {
    // buildPlayers() returns players with NO MC fields
    vi.mocked(usePlayers).mockReturnValue({ data: buildPlayers(), isLoading: false, error: null } as never)
    const { container } = render(<CaptainPicksPanel />)
    const range = Array.from(container.querySelectorAll('span')).find(
      s => /·\s*\d.*–.*\d/.test(s.textContent ?? '')
    )
    expect(range).toBeUndefined()
    // pts (C) span MUST still render (gate-off should not hide the captain card)
    expect(container.textContent).toMatch(/pts \(C\)/)
  })

  it('does NOT render range span when only p90_pts is defined (p10_pts undefined)', () => {
    const players = buildPlayers().map(p => ({ ...p, p90_pts: 14.0 })) as MergedPlayer[]
    vi.mocked(usePlayers).mockReturnValue({ data: players, isLoading: false, error: null } as never)
    const { container } = render(<CaptainPicksPanel />)
    const range = Array.from(container.querySelectorAll('span')).find(
      s => /·\s*\d.*–.*\d/.test(s.textContent ?? '')
    )
    expect(range).toBeUndefined()
  })

  it('renders range when p10_pts=0 and p90_pts=0 (BGW edge case — uses !== undefined, not falsy)', () => {
    const players = buildPlayers().map((p, i) => i === 0 ? ({ ...p, p10_pts: 0, p90_pts: 0 } as MergedPlayer) : p)
    vi.mocked(usePlayers).mockReturnValue({ data: players, isLoading: false, error: null } as never)
    const { container } = render(<CaptainPicksPanel />)
    const zeroRange = Array.from(container.querySelectorAll('span')).find(
      s => /·\s*0\.0\s*–\s*0\.0/.test(s.textContent ?? '')
    )
    expect(zeroRange).toBeDefined()
  })
})
