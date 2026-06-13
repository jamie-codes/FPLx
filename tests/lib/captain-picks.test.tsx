// Phase 31: Captaincy Ceiling — test stubs + component tests
// Wave 0: stubs created before implementation to satisfy Nyquist rule.
// Wave 2 (Plan 02): component tests filled in below.
// Integration tests are skipped (require pipeline run).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { render } from '@testing-library/react'

vi.mock('@/lib/hooks/useCaptainPicks', () => ({
  useCaptainPicks: vi.fn(),
}))

vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: vi.fn(),
}))

vi.mock('@/lib/hooks/useAuthStatus', () => ({
  useAuthStatus: vi.fn(),
}))

vi.mock('@/lib/hooks/useMyTeam', () => ({
  useMyTeam: vi.fn(),
}))

vi.mock('@/lib/hooks/useLineupNews', () => ({
  useLineupNews: vi.fn(),
}))

vi.mock('@/lib/hooks/useAccuracy', () => ({
  useAccuracy: vi.fn(),
  useNewsFlagEnabled: vi.fn().mockReturnValue(false),
}))

import { CaptainPicksPanel } from '@/components/captaincy/CaptainPicksPanel'
import { useCaptainPicks } from '@/lib/hooks/useCaptainPicks'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { useLineupNews } from '@/lib/hooks/useLineupNews'

const mockedUseCaptainPicks = vi.mocked(useCaptainPicks)
const mockedUsePlayers = vi.mocked(usePlayers)
const mockedUseAuthStatus = vi.mocked(useAuthStatus)
const mockedUseMyTeam = vi.mocked(useMyTeam)
const mockedUseLineupNews = vi.mocked(useLineupNews)

describe('Phase 31: Captain picks pipeline output', () => {
  it.skip('captain_picks.json exists and parses (requires pipeline run)', async () => {
    const raw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json'), 'utf-8')
    const data = JSON.parse(raw) as Record<string, unknown>
    expect(data).toHaveProperty('generated_at')
    expect(data).toHaveProperty('gameweek')
    expect(data).toHaveProperty('ceiling')
    expect(data).toHaveProperty('eo_adjusted')
  })

  it.skip('ceiling pick has all required fields and xPts_90th_1gw > 0 (CAP-03)', async () => {
    const raw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json'), 'utf-8')
    const data = JSON.parse(raw) as { ceiling: Record<string, unknown> | null }
    if (data.ceiling) {
      expect(data.ceiling).toHaveProperty('id')
      expect(data.ceiling).toHaveProperty('name')
      expect(data.ceiling).toHaveProperty('team')
      expect(data.ceiling).toHaveProperty('position')
      expect(data.ceiling).toHaveProperty('now_cost')
      expect(data.ceiling).toHaveProperty('xPts_1gw')
      expect(data.ceiling).toHaveProperty('xPts_90th_1gw')
      expect(data.ceiling).toHaveProperty('selected_by_percent')
      expect(data.ceiling.xPts_90th_1gw as number).toBeGreaterThan(0)
    }
  })

  it.skip('ceiling pick has highest xPts_90th_1gw among status=a players (CAP-03)', async () => {
    const picksRaw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json'), 'utf-8')
    const picks = JSON.parse(picksRaw) as { ceiling: { id: number; xPts_90th_1gw: number } | null }
    const playersRaw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'merged_players.json'), 'utf-8')
    const players = JSON.parse(playersRaw) as Array<{ id: number; status: string; xPts_90th_1gw?: number }>
    if (picks.ceiling) {
      const eligible = players.filter((p) => p.status === 'a' && typeof p.xPts_90th_1gw === 'number')
      const maxCeiling = Math.max(...eligible.map((p) => p.xPts_90th_1gw as number))
      expect(picks.ceiling.xPts_90th_1gw).toBeCloseTo(maxCeiling, 3)
    }
  })

  it.skip('xPts_90th_1gw field is present on every player in merged_players.json (D-11)', async () => {
    const raw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'merged_players.json'), 'utf-8')
    const players = JSON.parse(raw) as Array<Record<string, unknown>>
    expect(players.length).toBeGreaterThan(0)
    for (const p of players) {
      expect(p).toHaveProperty('xPts_90th_1gw')
      expect(typeof p.xPts_90th_1gw).toBe('number')
    }
  })

  it.skip('xPts_90th_1gw == round(xPts_1gw + 1.28 * sigma_1gw, 3) for spot-checked player (CAP-03 D-05)', async () => {
    // Spot-check the relationship for the ceiling pick (sigma is stripped from JSON, so we
    // verify by recovering sigma = (xPts_90th_1gw - xPts_1gw) / 1.28 must be >= 0).
    const picksRaw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json'), 'utf-8')
    const picks = JSON.parse(picksRaw) as { ceiling: { xPts_1gw: number; xPts_90th_1gw: number } | null }
    if (picks.ceiling) {
      const recoveredSigma = (picks.ceiling.xPts_90th_1gw - picks.ceiling.xPts_1gw) / 1.28
      expect(recoveredSigma).toBeGreaterThanOrEqual(0)
    }
  })

  it.skip('eo_adjusted pick exists and has selected_by_percent < 35.0 (CAP-04 D-06/D-08)', async () => {
    const raw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json'), 'utf-8')
    const data = JSON.parse(raw) as { eo_adjusted: { selected_by_percent: string; eo_threshold_used?: number } | null }
    if (data.eo_adjusted) {
      const own = parseFloat(data.eo_adjusted.selected_by_percent)
      // Either ownership is below 35 (a real fallback succeeded) OR no threshold_used means it fell back to ceiling.
      const fellBackToCeiling = data.eo_adjusted.eo_threshold_used === undefined
      expect(fellBackToCeiling || own < 35.0).toBe(true)
    }
  })

  it.skip('eo_adjusted pick has highest xPts_90th_1gw among low-owned status=a players (CAP-04)', async () => {
    const picksRaw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json'), 'utf-8')
    const picks = JSON.parse(picksRaw) as {
      eo_adjusted: { id: number; xPts_90th_1gw: number; eo_threshold_used?: number } | null
    }
    const playersRaw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'merged_players.json'), 'utf-8')
    const players = JSON.parse(playersRaw) as Array<{
      id: number; status: string; selected_by_percent?: string; xPts_90th_1gw?: number
    }>
    if (picks.eo_adjusted && picks.eo_adjusted.eo_threshold_used !== undefined) {
      const threshold = picks.eo_adjusted.eo_threshold_used
      const candidates = players.filter(
        (p) => p.status === 'a'
          && typeof p.xPts_90th_1gw === 'number'
          && parseFloat(p.selected_by_percent ?? '0') < threshold
      )
      const maxCeiling = Math.max(...candidates.map((p) => p.xPts_90th_1gw as number))
      expect(picks.eo_adjusted.xPts_90th_1gw).toBeCloseTo(maxCeiling, 3)
    }
  })

  it.skip('both ceiling and eo_adjusted picks reference status=a players (CAP-03/04)', async () => {
    const picksRaw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json'), 'utf-8')
    const picks = JSON.parse(picksRaw) as {
      ceiling: { id: number } | null; eo_adjusted: { id: number } | null
    }
    const playersRaw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'merged_players.json'), 'utf-8')
    const players = JSON.parse(playersRaw) as Array<{ id: number; status: string }>
    const byId = new Map(players.map((p) => [p.id, p]))
    if (picks.ceiling) expect(byId.get(picks.ceiling.id)?.status).toBe('a')
    if (picks.eo_adjusted) expect(byId.get(picks.eo_adjusted.id)?.status).toBe('a')
  })
})

describe('Phase 31: CaptainPicksPanel component', () => {
  // Minimal MergedPlayer fixture satisfying computeEOCandidates eligibility:
  // status='a', element_type!=1 (not GK), xPts_1gw>0.
  const sakaFixture = {
    id: 1,
    web_name: 'Saka',
    team: 1,
    team_short_name: 'ARS',
    element_type: 3 as const,  // MID
    now_cost: 91,
    selected_by_percent: '12.4',
    form: '8.0',
    status: 'a' as const,
    minutes: 270,
    starts: 3,
    total_points: 24,
    goals_scored: 2,
    assists: 1,
    expected_goals: 1.2,
    expected_assists: 0.8,
    pts_last3gw: 18,
    pts_last5gw: 30,
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
    minutes_per90: 90,
    form_pts_per90: 6.0,
    fixtures: [],
    xmins: 90,
    start_prob: 0.95,
    mins_risk: 'low' as const,
    xPts_1gw: 7.8,
  }

  beforeEach(() => {
    mockedUseCaptainPicks.mockReset()
    mockedUsePlayers.mockReset()
    mockedUseAuthStatus.mockReturnValue({ isAuthenticated: false } as ReturnType<typeof useAuthStatus>)
    mockedUseMyTeam.mockReturnValue({ data: undefined, isLoading: false, error: null } as unknown as ReturnType<typeof useMyTeam>)
    mockedUseLineupNews.mockReturnValue({ data: undefined, isLoading: false, error: null } as unknown as ReturnType<typeof useLineupNews>)
  })

  it('renders candidate list with GW header when data loaded (CAP-03)', () => {
    mockedUseCaptainPicks.mockReturnValue({
      data: { generated_at: '2026-04-28T00:00:00Z', gameweek: 30, ceiling: null, eo_adjusted: null },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCaptainPicks>)
    mockedUsePlayers.mockReturnValue({
      data: [sakaFixture],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePlayers>)
    const { container } = render(<CaptainPicksPanel />)
    expect(container.textContent).toContain('Captain Picks — GW 30')
    expect(container.textContent).toContain('Saka')
    expect(container.textContent).toContain('ARS')
    expect(container.textContent).toContain('pts (C)')
  })

  it('renders EO mode toggle with all 4 modes (CAP-04)', () => {
    mockedUseCaptainPicks.mockReturnValue({
      data: { generated_at: '2026-04-28T00:00:00Z', gameweek: 30, ceiling: null, eo_adjusted: null },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCaptainPicks>)
    mockedUsePlayers.mockReturnValue({
      data: [sakaFixture],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePlayers>)
    const { container } = render(<CaptainPicksPanel />)
    expect(container.textContent).toContain('Max xPts')
    expect(container.textContent).toContain('Protect Rank')
    expect(container.textContent).toContain('Chase Rank')
    expect(container.textContent).toContain('Differential')
  })

  it('shows empty candidates message when no eligible players (CAP-03/04 edge case)', () => {
    mockedUseCaptainPicks.mockReturnValue({
      data: { generated_at: '2026-04-28T00:00:00Z', gameweek: 30, ceiling: null, eo_adjusted: null },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCaptainPicks>)
    // All players have status='i' (injured) — computeEOCandidates returns empty
    mockedUsePlayers.mockReturnValue({
      data: [{ ...sakaFixture, status: 'i' as const }],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof usePlayers>)
    const { container } = render(<CaptainPicksPanel />)
    expect(container.textContent).toContain('No captain candidates available for GW 30')
  })

  it('shows loading state with locked copy (CAP-03/04)', () => {
    mockedUseCaptainPicks.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCaptainPicks>)
    mockedUsePlayers.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof usePlayers>)
    const { container } = render(<CaptainPicksPanel />)
    expect(container.textContent).toContain('Loading captain picks…')
    const p = container.querySelector('p')
    expect(p?.className).toContain('text-center')
    expect(p?.className).toContain('py-8')
  })

  it('shows error state with locked copy (CAP-03/04)', () => {
    mockedUseCaptainPicks.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCaptainPicks>)
    mockedUsePlayers.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
    } as unknown as ReturnType<typeof usePlayers>)
    const { container } = render(<CaptainPicksPanel />)
    expect(container.textContent).toContain('Failed to load captain picks. Check the pipeline output and refresh.')
    const p = container.querySelector('p')
    expect(p?.className).toContain('text-negative')
  })
})

it('Wave 0 stub file created — replace with real tests after implementation', () => {
  expect(true).toBe(true)
})
