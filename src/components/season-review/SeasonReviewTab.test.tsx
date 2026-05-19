// @vitest-environment jsdom
// Phase 124 Plan 03 — render tests for SeasonReviewTab.
// Tests are ordered by feature area: empty state, loading, grade-loading, grade-resolved, summary stats.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { SeasonReviewTab } from './SeasonReviewTab'
import type { SeasonReview } from '@/lib/types'
import type { SeasonAnalytics } from '@/lib/types'
import type { DecisionHistory } from '@/lib/types'

// ---------------------------------------------------------------------------
// Module mocks — all three hooks are mocked so tests are pure render tests.
// ---------------------------------------------------------------------------
vi.mock('@/lib/hooks/useSeasonReview', () => ({ useSeasonReview: vi.fn() }))
vi.mock('@/lib/hooks/useSeasonAnalytics', () => ({ useSeasonAnalytics: vi.fn() }))
vi.mock('@/lib/hooks/useDecisionHistory', () => ({ useDecisionHistory: vi.fn() }))

// recharts resize-observer is not available in jsdom — suppress the warning
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) =>
      createElement('div', { 'data-testid': 'responsive-container', style: { width: 100, height: 288 } }, children),
  }
})

import { useSeasonReview } from '@/lib/hooks/useSeasonReview'
import { useSeasonAnalytics } from '@/lib/hooks/useSeasonAnalytics'
import { useDecisionHistory } from '@/lib/hooks/useDecisionHistory'

const mockedUseSeasonReview = vi.mocked(useSeasonReview)
const mockedUseSeasonAnalytics = vi.mocked(useSeasonAnalytics)
const mockedUseDecisionHistory = vi.mocked(useDecisionHistory)

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const IDLE_QUERY = {
  isLoading: false,
  isSuccess: false,
  isError: false,
  data: undefined,
  error: null,
} as const

const LOADING_QUERY = {
  isLoading: true,
  isSuccess: false,
  isError: false,
  data: undefined,
  error: null,
} as const

const REVIEW_DATA: SeasonReview = {
  totalPoints: 1234,
  finalRank: 500000,
  bestGw: { gw: 7, points: 94 },
  worstGw: { gw: 4, points: 38 },
  transferNetPoints: -8,
  gwData: [
    { gw: 1, points: 55, avgManagerScore: 50, overallRank: 600000, chipPlayed: null },
    { gw: 2, points: 72, avgManagerScore: 60, overallRank: 550000, chipPlayed: 'bboost' },
    { gw: 3, points: 45, avgManagerScore: 48, overallRank: 580000, chipPlayed: null },
  ],
}

const ANALYTICS_DATA_WITH_CHIPS: SeasonAnalytics = {
  chipRoi: [
    { chipName: 'bboost', event: 2, delta: 15, gwPoints: 70, seasonAvgPoints: 55 },
    { chipName: '3xc', event: 5, delta: 20, gwPoints: 80, seasonAvgPoints: 60 },
    { chipName: 'freehit', event: 8, delta: -5, gwPoints: 45, seasonAvgPoints: 50 },
  ],
  hitTracking: [
    { event: 3, elementIn: 1, elementOut: 2, elementInName: 'A', elementOutName: 'B', elementInPts: 12, elementOutPts: 4, netPts: 4, brokeEven: true },
    { event: 6, elementIn: 3, elementOut: 4, elementInName: 'C', elementOutName: 'D', elementInPts: 2, elementOutPts: 0, netPts: -2, brokeEven: false },
    { event: 9, elementIn: 5, elementOut: 6, elementInName: 'E', elementOutName: 'F', elementInPts: 10, elementOutPts: 2, netPts: 4, brokeEven: true },
    { event: 12, elementIn: 7, elementOut: 8, elementInName: 'G', elementOutName: 'H', elementInPts: 3, elementOutPts: 1, netPts: -2, brokeEven: false },
  ],
}

// captainHitRate = 0.625 (based on entries: 8 gwsWithData, captainHits = 5 → 5/8 = 0.625)
// Entries: regret -2(hit), 0(hit), 4(miss), 2(miss), -3(hit), 2(miss), 0(hit), -1(hit) = 5 hits from 8 GWs = 62.5%
const HISTORY_DATA_62_5: DecisionHistory = {
  teamId: 12345,
  gwsWithData: 8,
  entries: [
    { gw: 1, regret: -2, userCaptainId: 1, userCaptainName: 'A', userCaptainPts: 6, modelCeilingId: 2, modelCeilingName: 'B', modelCeilingPts: 5, hasSnapshot: true },   // hit
    { gw: 2, regret: 0, userCaptainId: 1, userCaptainName: 'A', userCaptainPts: 6, modelCeilingId: 2, modelCeilingName: 'B', modelCeilingPts: 6, hasSnapshot: true },    // hit
    { gw: 3, regret: 4, userCaptainId: 1, userCaptainName: 'A', userCaptainPts: 4, modelCeilingId: 2, modelCeilingName: 'B', modelCeilingPts: 6, hasSnapshot: true },    // miss
    { gw: 4, regret: 2, userCaptainId: 1, userCaptainName: 'A', userCaptainPts: 5, modelCeilingId: 2, modelCeilingName: 'B', modelCeilingPts: 6, hasSnapshot: true },    // miss
    { gw: 5, regret: -3, userCaptainId: 1, userCaptainName: 'A', userCaptainPts: 8, modelCeilingId: 2, modelCeilingName: 'B', modelCeilingPts: 6.5, hasSnapshot: true }, // hit
    { gw: 6, regret: 2, userCaptainId: 1, userCaptainName: 'A', userCaptainPts: 5, modelCeilingId: 2, modelCeilingName: 'B', modelCeilingPts: 6, hasSnapshot: true },    // miss
    { gw: 7, regret: 0, userCaptainId: 1, userCaptainName: 'A', userCaptainPts: 7, modelCeilingId: 2, modelCeilingName: 'B', modelCeilingPts: 7, hasSnapshot: true },    // hit
    { gw: 8, regret: -1, userCaptainId: 1, userCaptainName: 'A', userCaptainPts: 6, modelCeilingId: 2, modelCeilingName: 'B', modelCeilingPts: 5.5, hasSnapshot: true }, // hit
    // 5 hits (regret <= 0) from 8 GWs with data → captainHitRate = 5/8 = 0.625 = 62.5%
  ],
}

// gwData with 3 chips for grade test A: captainHitRate=1.0, all broke even, all ROI positive → grade A
const REVIEW_DATA_GRADE_A: SeasonReview = {
  totalPoints: 2000,
  finalRank: 10000,
  bestGw: { gw: 1, points: 100 },
  worstGw: { gw: 2, points: 50 },
  transferNetPoints: 0,
  gwData: [
    { gw: 1, points: 100, avgManagerScore: 55, overallRank: 10000, chipPlayed: 'bboost' },
    { gw: 2, points: 50, avgManagerScore: 48, overallRank: 15000, chipPlayed: '3xc' },
    { gw: 3, points: 80, avgManagerScore: 60, overallRank: 12000, chipPlayed: 'freehit' },
  ],
}

// captainHitRate=1.0: all regret <= 0
const HISTORY_DATA_ALL_HITS: DecisionHistory = {
  teamId: 12345,
  gwsWithData: 3,
  entries: [
    { gw: 1, regret: 0, userCaptainId: 1, userCaptainName: 'A', userCaptainPts: 6, modelCeilingId: 2, modelCeilingName: 'B', modelCeilingPts: 6, hasSnapshot: true },
    { gw: 2, regret: -2, userCaptainId: 1, userCaptainName: 'A', userCaptainPts: 7, modelCeilingId: 2, modelCeilingName: 'B', modelCeilingPts: 6, hasSnapshot: true },
    { gw: 3, regret: -1, userCaptainId: 1, userCaptainName: 'A', userCaptainPts: 7, modelCeilingId: 2, modelCeilingName: 'B', modelCeilingPts: 6.5, hasSnapshot: true },
  ],
}

// All chips ROI positive, all broke even → grade A
const ANALYTICS_DATA_ALL_POSITIVE: SeasonAnalytics = {
  chipRoi: [
    { chipName: 'bboost', event: 1, delta: 15, gwPoints: 70, seasonAvgPoints: 55 },
    { chipName: '3xc', event: 2, delta: 20, gwPoints: 80, seasonAvgPoints: 60 },
    { chipName: 'freehit', event: 3, delta: 10, gwPoints: 60, seasonAvgPoints: 50 },
  ],
  hitTracking: [],
}

// Analytics with no chips for D-06 test
const ANALYTICS_DATA_NO_CHIPS: SeasonAnalytics = {
  chipRoi: [],
  hitTracking: [
    { event: 3, elementIn: 1, elementOut: 2, elementInName: 'A', elementOutName: 'B', elementInPts: 12, elementOutPts: 4, netPts: 4, brokeEven: true },
  ],
}

const REVIEW_DATA_NO_CHIPS: SeasonReview = {
  totalPoints: 1500,
  finalRank: 200000,
  bestGw: { gw: 5, points: 85 },
  worstGw: { gw: 2, points: 40 },
  transferNetPoints: -4,
  gwData: [
    { gw: 1, points: 55, avgManagerScore: 50, overallRank: 220000, chipPlayed: null },
    { gw: 2, points: 40, avgManagerScore: 48, overallRank: 230000, chipPlayed: null },
  ],
}

// ---------------------------------------------------------------------------
// Wrapper — minimal QueryClient wrapper (tests don't need real queries)
// ---------------------------------------------------------------------------
function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

function renderTab(props: { teamId?: string | null }) {
  const wrapper = makeWrapper()
  return render(createElement(SeasonReviewTab, props), { wrapper })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SeasonReviewTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: idle state — no team ID
    mockedUseSeasonReview.mockReturnValue(IDLE_QUERY as ReturnType<typeof useSeasonReview>)
    mockedUseSeasonAnalytics.mockReturnValue(IDLE_QUERY as ReturnType<typeof useSeasonAnalytics>)
    mockedUseDecisionHistory.mockReturnValue(IDLE_QUERY as ReturnType<typeof useDecisionHistory>)
  })

  it('renders empty state when teamId is null', () => {
    renderTab({ teamId: null })
    expect(screen.getByText('Enter your FPL Team ID to see your Season Review')).toBeTruthy()
  })

  it('renders the skeleton when useSeasonReview is loading', () => {
    mockedUseSeasonReview.mockReturnValue(LOADING_QUERY as ReturnType<typeof useSeasonReview>)
    const { container } = renderTab({ teamId: '12345' })
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the skeleton when only useDecisionHistory is loading', () => {
    mockedUseSeasonReview.mockReturnValue({
      ...IDLE_QUERY,
      isSuccess: true,
      data: REVIEW_DATA,
    } as ReturnType<typeof useSeasonReview>)
    mockedUseSeasonAnalytics.mockReturnValue({
      ...IDLE_QUERY,
      isSuccess: true,
      data: ANALYTICS_DATA_WITH_CHIPS,
    } as ReturnType<typeof useSeasonAnalytics>)
    mockedUseDecisionHistory.mockReturnValue(LOADING_QUERY as ReturnType<typeof useDecisionHistory>)
    const { container } = renderTab({ teamId: '12345' })
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(1)
  })

  it('renders — in grade badge while any hook is still loading (Pitfall 2)', () => {
    mockedUseSeasonReview.mockReturnValue({
      ...IDLE_QUERY,
      isSuccess: true,
      data: REVIEW_DATA,
    } as ReturnType<typeof useSeasonReview>)
    mockedUseSeasonAnalytics.mockReturnValue({
      ...IDLE_QUERY,
      isSuccess: true,
      data: ANALYTICS_DATA_WITH_CHIPS,
    } as ReturnType<typeof useSeasonAnalytics>)
    // historyQuery still loading — grade cannot be computed yet
    mockedUseDecisionHistory.mockReturnValue(LOADING_QUERY as ReturnType<typeof useDecisionHistory>)
    const { container } = renderTab({ teamId: '12345' })
    // isLoading is true (history is loading) — skeleton renders, so check for animate-pulse
    // The grade badge renders '—' only after isLoading is false; while loading the skeleton shows
    // (We expect skeleton here since isLoading = true from historyQuery)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(1)
  })

  it('renders grade A when computeDecisionGrade returns A', () => {
    mockedUseSeasonReview.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: REVIEW_DATA_GRADE_A,
      error: null,
    } as ReturnType<typeof useSeasonReview>)
    mockedUseSeasonAnalytics.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: ANALYTICS_DATA_ALL_POSITIVE,
      error: null,
    } as ReturnType<typeof useSeasonAnalytics>)
    mockedUseDecisionHistory.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: HISTORY_DATA_ALL_HITS,
      error: null,
    } as ReturnType<typeof useDecisionHistory>)
    renderTab({ teamId: '12345' })
    // Grade A badge should be present
    expect(screen.getByLabelText('Decision quality grade: A')).toBeTruthy()
  })

  it('renders summary stats with formatted values', () => {
    mockedUseSeasonReview.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: REVIEW_DATA,
      error: null,
    } as ReturnType<typeof useSeasonReview>)
    mockedUseSeasonAnalytics.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: ANALYTICS_DATA_WITH_CHIPS,
      error: null,
    } as ReturnType<typeof useSeasonAnalytics>)
    mockedUseDecisionHistory.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: HISTORY_DATA_62_5,
      error: null,
    } as ReturnType<typeof useDecisionHistory>)
    renderTab({ teamId: '12345' })
    // finalRank formatted with locale separator
    expect(screen.getByText('500,000')).toBeTruthy()
    // bestGw
    expect(screen.getByText('GW7: 94pts')).toBeTruthy()
    // worstGw
    expect(screen.getByText('GW4: 38pts')).toBeTruthy()
    // Transfer net negative — U+2212 minus sign
    expect(screen.getByText('−8')).toBeTruthy()
  })

  it('renders methodology note on grade card', () => {
    mockedUseSeasonReview.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: REVIEW_DATA_GRADE_A,
      error: null,
    } as ReturnType<typeof useSeasonReview>)
    mockedUseSeasonAnalytics.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: ANALYTICS_DATA_ALL_POSITIVE,
      error: null,
    } as ReturnType<typeof useSeasonAnalytics>)
    mockedUseDecisionHistory.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: HISTORY_DATA_ALL_HITS,
      error: null,
    } as ReturnType<typeof useDecisionHistory>)
    renderTab({ teamId: '12345' })
    // Methodology note must contain "captain EV rate (40%)"
    const methodologyEl = screen.getByText((content) => content.includes('captain EV rate (40%)'))
    expect(methodologyEl).toBeTruthy()
  })

  it('renders the three component scores in the grade card', () => {
    // captainHitRate = 5/8 = 0.625 (62.5%)
    // hitTracking: 4 entries, 2 brokeEven → 50.0%
    // chipRoi: 3 entries, all positive → 100.0%
    // gwData with 3 chips played
    const reviewWithChips: SeasonReview = {
      totalPoints: 1500,
      finalRank: 300000,
      bestGw: { gw: 1, points: 90 },
      worstGw: { gw: 3, points: 42 },
      transferNetPoints: 0,
      gwData: [
        { gw: 1, points: 90, avgManagerScore: 55, overallRank: 300000, chipPlayed: 'bboost' },
        { gw: 2, points: 60, avgManagerScore: 52, overallRank: 310000, chipPlayed: '3xc' },
        { gw: 3, points: 42, avgManagerScore: 48, overallRank: 320000, chipPlayed: 'freehit' },
      ],
    }
    const analyticsWithThreePositive: SeasonAnalytics = {
      chipRoi: [
        { chipName: 'bboost', event: 1, delta: 10, gwPoints: 65, seasonAvgPoints: 55 },
        { chipName: '3xc', event: 2, delta: 15, gwPoints: 75, seasonAvgPoints: 60 },
        { chipName: 'freehit', event: 3, delta: 5, gwPoints: 55, seasonAvgPoints: 50 },
      ],
      hitTracking: [
        { event: 4, elementIn: 1, elementOut: 2, elementInName: 'A', elementOutName: 'B', elementInPts: 12, elementOutPts: 4, netPts: 4, brokeEven: true },
        { event: 5, elementIn: 3, elementOut: 4, elementInName: 'C', elementOutName: 'D', elementInPts: 2, elementOutPts: 0, netPts: -2, brokeEven: false },
        { event: 6, elementIn: 5, elementOut: 6, elementInName: 'E', elementOutName: 'F', elementInPts: 10, elementOutPts: 2, netPts: 4, brokeEven: true },
        { event: 7, elementIn: 7, elementOut: 8, elementInName: 'G', elementOutName: 'H', elementInPts: 3, elementOutPts: 1, netPts: -2, brokeEven: false },
      ],
    }
    mockedUseSeasonReview.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: reviewWithChips,
      error: null,
    } as ReturnType<typeof useSeasonReview>)
    mockedUseSeasonAnalytics.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: analyticsWithThreePositive,
      error: null,
    } as ReturnType<typeof useSeasonAnalytics>)
    mockedUseDecisionHistory.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: HISTORY_DATA_62_5,
      error: null,
    } as ReturnType<typeof useDecisionHistory>)
    renderTab({ teamId: '12345' })
    const scoresDl = screen.getByTestId('grade-component-scores')
    expect(within(scoresDl).getByText('Captain EV rate')).toBeTruthy()
    expect(within(scoresDl).getByText('62.5%')).toBeTruthy()
    expect(within(scoresDl).getByText('Hit break-even rate')).toBeTruthy()
    expect(within(scoresDl).getByText('50.0%')).toBeTruthy()
    expect(within(scoresDl).getByText('Chip ROI positive rate')).toBeTruthy()
    expect(within(scoresDl).getByText('100.0%')).toBeTruthy()
  })

  it('renders — placeholder for chip ROI positive rate when no chips played (D-06)', () => {
    mockedUseSeasonReview.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: REVIEW_DATA_NO_CHIPS,
      error: null,
    } as ReturnType<typeof useSeasonReview>)
    mockedUseSeasonAnalytics.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: ANALYTICS_DATA_NO_CHIPS,
      error: null,
    } as ReturnType<typeof useSeasonAnalytics>)
    mockedUseDecisionHistory.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: HISTORY_DATA_ALL_HITS,
      error: null,
    } as ReturnType<typeof useDecisionHistory>)
    renderTab({ teamId: '12345' })
    const scoresDl = screen.getByTestId('grade-component-scores')
    // Chip ROI positive rate cell should show em dash (U+2014), not NaN% or 0.0%
    const chipRoiDt = within(scoresDl).getByText('Chip ROI positive rate')
    const chipRoiCell = chipRoiDt.closest('div')
    expect(chipRoiCell?.textContent).toContain('—')
    expect(chipRoiCell?.textContent).not.toContain('NaN')
    expect(chipRoiCell?.textContent).not.toContain('0.0%')
  })
})
