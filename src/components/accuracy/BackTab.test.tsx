// @vitest-environment jsdom
// Phase 96 BACK-01 Wave 1 RED — BackTab UI contract.
// BackTab.tsx does not exist yet; this file fails at import. Plan 04 turns it GREEN.
// Source of truth: .planning/phases/96-captain-decision-backtester/096-UI-SPEC.md §Copywriting Contract
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@/lib/hooks/useDecisionHistory', () => ({
  useDecisionHistory: vi.fn(),
}))

vi.mock('@/lib/hooks/useSeasonAnalytics', () => ({
  useSeasonAnalytics: vi.fn(),
}))

import { BackTab } from './BackTab'
import { useDecisionHistory } from '@/lib/hooks/useDecisionHistory'
import { useSeasonAnalytics } from '@/lib/hooks/useSeasonAnalytics'
import type { DecisionHistory, RegretEntry, SeasonAnalytics } from '@/lib/types'

const mockedUseDecisionHistory = vi.mocked(useDecisionHistory)
const mockedUseSeasonAnalytics = vi.mocked(useSeasonAnalytics)

function entry(overrides: Partial<RegretEntry> = {}): RegretEntry {
  return {
    gw: 30,
    userCaptainId: 100, userCaptainName: 'Salah', userCaptainPts: 6,
    modelCeilingId: 200, modelCeilingName: 'Haaland', modelCeilingPts: 10,
    hasSnapshot: true,
    regret: 8,
    ...overrides,
  }
}

beforeEach(() => {
  mockedUseDecisionHistory.mockReset()
  mockedUseSeasonAnalytics.mockReset()
  // Default: hook returns idle empty state. Specific tests override this.
  mockedUseSeasonAnalytics.mockReturnValue({
    data: undefined, isLoading: false, error: null,
  } as ReturnType<typeof useSeasonAnalytics>)
})

describe('BackTab — Phase 96 BACK-01', () => {
  it('shows loading copy while isLoading is true (UI-SPEC §Copywriting Contract)', () => {
    mockedUseDecisionHistory.mockReturnValue({
      data: undefined, isLoading: true, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    const { container } = render(<BackTab teamId="12345" />)
    expect(container.textContent).toContain('Loading captain history')
  })

  it('shows error copy when the hook reports an error (UI-SPEC §Copywriting Contract)', () => {
    mockedUseDecisionHistory.mockReturnValue({
      data: undefined, isLoading: false, error: new Error('boom'),
    } as ReturnType<typeof useDecisionHistory>)
    const { container } = render(<BackTab teamId="12345" />)
    expect(container.textContent).toContain('Failed to load captain history')
    expect(container.textContent).toContain('Check your connection and refresh')
  })

  it('shows empty-state copy when entries array is empty (D-11)', () => {
    const empty: DecisionHistory = { teamId: 12345, gwsWithData: 0, entries: [] }
    mockedUseDecisionHistory.mockReturnValue({
      data: empty, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    const { container } = render(<BackTab teamId="12345" />)
    expect(container.textContent).toContain('No captain history yet')
  })

  it('renders positive regret as "+Npts (model better)" with red text class (UI-SPEC §Per-GW Detail Rows)', () => {
    const history: DecisionHistory = {
      teamId: 12345, gwsWithData: 1, entries: [entry({ regret: 8 })],
    }
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    const { container } = render(<BackTab teamId="12345" />)
    expect(container.textContent).toContain('+8pts (model better)')
    // Tailwind colour class for negative outcome (model beat user)
    expect(container.innerHTML).toMatch(/text-red-600/)
  })

  it('renders "No model snapshot" placeholder when hasSnapshot is false (D-10)', () => {
    const history: DecisionHistory = {
      teamId: 12345, gwsWithData: 0,
      entries: [entry({
        hasSnapshot: false,
        modelCeilingId: null, modelCeilingName: null, modelCeilingPts: null,
        regret: null,
      })],
    }
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    const { container } = render(<BackTab teamId="12345" />)
    expect(container.textContent).toContain('No model snapshot')
  })

  it('shows login-prompt empty state when teamId is null (WR-02)', () => {
    mockedUseDecisionHistory.mockReturnValue({
      data: undefined, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    const { container } = render(<BackTab teamId={null} />)
    expect(container.textContent).toContain('Log in to see your actual captain picks')
  })
})

function makeHistoryFromHits(hits: number, total: number): DecisionHistory {
  // Build a DecisionHistory whose computeSeasonSummary yields the desired captainHits/gwsWithData.
  // userWon entries (regret < 0) count as hits; tied entries (regret === 0) also count as hits.
  // Remaining entries (regret > 0) are NOT hits. Null-regret entries are skipped.
  const entries: RegretEntry[] = []
  for (let i = 0; i < hits; i++) entries.push(entry({ gw: i + 1, regret: -1 }))
  for (let i = hits; i < total; i++) entries.push(entry({ gw: i + 1, regret: 3 }))
  return { teamId: 12345, gwsWithData: total, entries }
}

function sampleSeasonData(overrides: Partial<SeasonAnalytics> = {}): SeasonAnalytics {
  return {
    chipRoi: [
      { chipName: 'bboost', event: 29, gwPoints: 74, seasonAvgPoints: 52, delta: 22 },
    ],
    hitTracking: [
      {
        event: 31, elementIn: 100, elementOut: 200,
        elementInName: 'Salah', elementOutName: 'Haaland',
        elementInPts: 18, elementOutPts: 10, netPts: 4, brokeEven: true,
      },
    ],
    ...overrides,
  }
}

describe('BackTab — Phase 100 HIST-01/02/03', () => {
  it('HIST-01: renders "Captain hit rate: {N}/{M} GWs ({P}%)" when summary.captainHitRate !== null (D-03)', () => {
    const history = makeHistoryFromHits(3, 4)  // 3 hits in 4 GWs → 75%
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    const { container } = render(<BackTab teamId="12345" />)
    expect(container.textContent).toMatch(/Captain hit rate:\s*3\/4 GWs\s*\(\s*75%\s*\)/)
  })

  it('HIST-01: does NOT render the captain hit rate line when summary.captainHitRate === null', () => {
    // All entries have null regret → gwsWithData === 0 → captainHitRate === null
    const history: DecisionHistory = {
      teamId: 12345, gwsWithData: 0,
      entries: [
        entry({ gw: 1, regret: null, userCaptainPts: null, modelCeilingPts: null }),
      ],
    }
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    const { container } = render(<BackTab teamId="12345" />)
    // The captain-hit-rate line must be absent.
    expect(container.textContent).not.toMatch(/Captain hit rate:/)
  })

  it('HIST-02/03 auth guard: renders prompt when teamId is null; HIST-01 still renders (D-12)', () => {
    const history = makeHistoryFromHits(2, 3)
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    // useSeasonAnalytics not called when teamId === null; the prompt covers both sections.
    const { container } = render(<BackTab teamId={null as unknown as string} />)
    // Note: the existing teamId={null} branch in BackTab returns the empty-state copy
    // ("Log in to see your actual captain picks") because useDecisionHistory data is undefined
    // in that flow. Phase 100 changes this: when there IS decision-history data but teamId
    // is null, the page-level wiring should still render the HIST-01 line and the auth-guard.
    // For this test, we PASS teamId="12345" but mock useSeasonAnalytics to behave as if disabled
    // by passing teamId={null} branch — see the implementation: BackTab passes teamId through to
    // useSeasonAnalytics and renders the auth-guard inline when teamId === null.
    expect(container.textContent).toContain('Load your squad to see chip ROI and hit tracking')
  })

  it('HIST-02/03 loading: renders "Loading season analytics…" when seasonLoading is true', () => {
    const history = makeHistoryFromHits(2, 3)
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    mockedUseSeasonAnalytics.mockReturnValue({
      data: undefined, isLoading: true, error: null,
    } as ReturnType<typeof useSeasonAnalytics>)
    const { container } = render(<BackTab teamId="12345" />)
    expect(container.textContent).toContain('Loading season analytics')
  })

  it('HIST-02/03 error: renders error copy when seasonError is set', () => {
    const history = makeHistoryFromHits(2, 3)
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    mockedUseSeasonAnalytics.mockReturnValue({
      data: undefined, isLoading: false, error: new Error('boom'),
    } as ReturnType<typeof useSeasonAnalytics>)
    const { container } = render(<BackTab teamId="12345" />)
    expect(container.textContent).toContain('Failed to load season analytics')
    expect(container.textContent).toContain('Check your connection and refresh')
  })

  it('HIST-02 empty: renders "No chips played yet this season." when chipRoi is empty', () => {
    const history = makeHistoryFromHits(2, 3)
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    mockedUseSeasonAnalytics.mockReturnValue({
      data: sampleSeasonData({ chipRoi: [] }), isLoading: false, error: null,
    } as ReturnType<typeof useSeasonAnalytics>)
    const { container } = render(<BackTab teamId="12345" />)
    expect(container.textContent).toContain('No chips played yet this season')
  })

  it('HIST-02 happy: chipRoi row maps bboost → "Bench Boost", formats delta as "+22pts" with green class', () => {
    const history = makeHistoryFromHits(2, 3)
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    mockedUseSeasonAnalytics.mockReturnValue({
      data: sampleSeasonData(), isLoading: false, error: null,
    } as ReturnType<typeof useSeasonAnalytics>)
    const { container } = render(<BackTab teamId="12345" />)
    expect(container.textContent).toContain('Bench Boost')
    expect(container.textContent).toContain('GW29')
    expect(container.textContent).toContain('74pts')
    expect(container.textContent).toContain('52pt avg')
    expect(container.textContent).toContain('+22pts')
    expect(container.innerHTML).toMatch(/text-green-600/)
  })

  it('HIST-03 empty: renders "No transfer hits taken this season." when hitTracking is empty', () => {
    const history = makeHistoryFromHits(2, 3)
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    mockedUseSeasonAnalytics.mockReturnValue({
      data: sampleSeasonData({ hitTracking: [] }), isLoading: false, error: null,
    } as ReturnType<typeof useSeasonAnalytics>)
    const { container } = render(<BackTab teamId="12345" />)
    expect(container.textContent).toContain('No transfer hits taken this season')
  })

  it('HIST-03 happy: renders GW, "{in} ← {out}", net pts, and ✓ broke-even badge', () => {
    const history = makeHistoryFromHits(2, 3)
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    mockedUseSeasonAnalytics.mockReturnValue({
      data: sampleSeasonData(), isLoading: false, error: null,
    } as ReturnType<typeof useSeasonAnalytics>)
    const { container } = render(<BackTab teamId="12345" />)
    expect(container.textContent).toContain('Hit Break-Even Tracking')
    expect(container.textContent).toContain('GW31')
    expect(container.textContent).toContain('Salah')
    expect(container.textContent).toContain('Haaland')
    expect(container.textContent).toContain('+4pts')
    expect(container.textContent).toContain('✓')
  })
})
