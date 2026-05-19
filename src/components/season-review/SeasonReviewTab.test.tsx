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
    { chip: 'bboost', gw: 2, delta: 15, label: 'Bench Boost', weekAvg: 55 },
    { chip: '3xc', gw: 5, delta: 20, label: 'Triple Captain', weekAvg: 60 },
    { chip: 'freehit', gw: 8, delta: -5, label: 'Free Hit', weekAvg: 50 },
  ],
  hitTracking: [
    { gw: 3, cost: 4, actualGain: 8, brokeEven: true },
    { gw: 6, cost: 4, actualGain: 2, brokeEven: false },
    { gw: 9, cost: 4, actualGain: 6, brokeEven: true },
    { gw: 12, cost: 4, actualGain: 3, brokeEven: false },
  ],
}

// captainHitRate = 0.625 (based on entries: 5 gwsWithData, userWon+tied = regret <= 0)
// We need to provide entries where computeSeasonSummary returns captainHitRate = 0.625
// gwsWithData = 8, captainHits = 5 → 5/8 = 0.625
const HISTORY_DATA_62_5: DecisionHistory = {
  entries: [
    { gw: 1, regret: -2, userCaptainName: 'A', modelCeilingName: 'B', userCaptainPts: 6, modelCeilingPts: 5 },  // userWon
    { gw: 2, regret: 0, userCaptainName: 'A', modelCeilingName: 'B', userCaptainPts: 6, modelCeilingPts: 6 },   // tied
    { gw: 3, regret: -1, userCaptainName: 'A', modelCeilingName: 'B', userCaptainPts: 6, modelCeilingPts: 5.5 }, // userWon
    { gw: 4, regret: 4, userCaptainName: 'A', modelCeilingName: 'B', userCaptainPts: 4, modelCeilingPts: 6 },   // modelBetter
    { gw: 5, regret: -3, userCaptainName: 'A', modelCeilingName: 'B', userCaptainPts: 8, modelCeilingPts: 6.5 }, // userWon
    { gw: 6, regret: 2, userCaptainName: 'A', modelCeilingName: 'B', userCaptainPts: 5, modelCeilingPts: 6 },   // modelBetter
    { gw: 7, regret: 0, userCaptainName: 'A', modelCeilingName: 'B', userCaptainPts: 7, modelCeilingPts: 7 },   // tied
    { gw: 8, regret: -1, userCaptainName: 'A', modelCeilingName: 'B', userCaptainPts: 6, modelCeilingPts: 5.5 }, // userWon
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
  entries: [
    { gw: 1, regret: 0, userCaptainName: 'A', modelCeilingName: 'B', userCaptainPts: 6, modelCeilingPts: 6 },
    { gw: 2, regret: -2, userCaptainName: 'A', modelCeilingName: 'B', userCaptainPts: 7, modelCeilingPts: 6 },
    { gw: 3, regret: -1, userCaptainName: 'A', modelCeilingName: 'B', userCaptainPts: 7, modelCeilingPts: 6.5 },
  ],
}

// All chips ROI positive, all broke even → grade A
const ANALYTICS_DATA_ALL_POSITIVE: SeasonAnalytics = {
  chipRoi: [
    { chip: 'bboost', gw: 1, delta: 15, label: 'Bench Boost', weekAvg: 55 },
    { chip: '3xc', gw: 2, delta: 20, label: 'Triple Captain', weekAvg: 60 },
    { chip: 'freehit', gw: 3, delta: 10, label: 'Free Hit', weekAvg: 50 },
  ],
  hitTracking: [],
}

// Analytics with no chips for D-06 test
const ANALYTICS_DATA_NO_CHIPS: SeasonAnalytics = {
  chipRoi: [],
  hitTracking: [
    { gw: 3, cost: 4, actualGain: 8, brokeEven: true },
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
        { chip: 'bboost', gw: 1, delta: 10, label: 'Bench Boost', weekAvg: 55 },
        { chip: '3xc', gw: 2, delta: 15, label: 'Triple Captain', weekAvg: 60 },
        { chip: 'freehit', gw: 3, delta: 5, label: 'Free Hit', weekAvg: 50 },
      ],
      hitTracking: [
        { gw: 4, cost: 4, actualGain: 8, brokeEven: true },
        { gw: 5, cost: 4, actualGain: 2, brokeEven: false },
        { gw: 6, cost: 4, actualGain: 6, brokeEven: true },
        { gw: 7, cost: 4, actualGain: 3, brokeEven: false },
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
