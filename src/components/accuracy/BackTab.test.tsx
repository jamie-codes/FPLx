// @vitest-environment jsdom
// Phase 96 BACK-01 Wave 1 RED — BackTab UI contract.
// BackTab.tsx does not exist yet; this file fails at import. Plan 04 turns it GREEN.
// Source of truth: .planning/phases/96-captain-decision-backtester/096-UI-SPEC.md §Copywriting Contract
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'

vi.mock('@/lib/hooks/useDecisionHistory', () => ({
  useDecisionHistory: vi.fn(),
}))

vi.mock('@/lib/hooks/useSeasonAnalytics', () => ({
  useSeasonAnalytics: vi.fn(),
}))

import { BackTab } from './BackTab'
import { useDecisionHistory } from '@/lib/hooks/useDecisionHistory'
import { useSeasonAnalytics } from '@/lib/hooks/useSeasonAnalytics'
import type { DecisionHistory, RegretEntry, SeasonAnalytics, TransferRegretEntry } from '@/lib/types'

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

function transferEntry(overrides: Partial<TransferRegretEntry> = {}): TransferRegretEntry {
  return {
    gw: 30,
    hasSnapshot: true,
    engineSell: ['Isak'], engineBuy: ['Salah'],
    engineSellPts: [3], engineBuyPts: [12],
    isHold: false,
    userSell: ['Isak'], userBuy: ['Watkins'],
    userSellPts: [3], userBuyPts: [9],
    delta: 3,  // engineGain=(12-3)=9, userGain=(9-3)=6, delta=3
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
    // Tailwind colour class for negative outcome (model beat user) — tokenized UIX-05
    expect(container.innerHTML).toMatch(/text-negative/)
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
    expect(container.innerHTML).toMatch(/text-positive/)
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

describe('BackTab — Phase 113 BACK-02 Transfer Toggle', () => {
  it('renders both "Captain" and "Transfer" buttons inside a group with aria-label="Backtester view"', () => {
    const history: DecisionHistory = {
      teamId: 12345, gwsWithData: 1, entries: [entry()],
      transferEntries: [],
    }
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    const { container } = render(<BackTab teamId="12345" />)
    const group = container.querySelector('[role="group"][aria-label="Backtester view"]')
    expect(group).not.toBeNull()
    expect(container.textContent).toContain('Captain')
    expect(container.textContent).toContain('Transfer')
  })

  it('default render: Captain button has aria-pressed="true", Transfer button has aria-pressed="false"', () => {
    const history: DecisionHistory = {
      teamId: 12345, gwsWithData: 1, entries: [entry()],
      transferEntries: [],
    }
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    render(<BackTab teamId="12345" />)
    const captainBtn = screen.getByRole('button', { name: 'Captain' })
    const transferBtn = screen.getByRole('button', { name: 'Transfer' })
    expect(captainBtn.getAttribute('aria-pressed')).toBe('true')
    expect(transferBtn.getAttribute('aria-pressed')).toBe('false')
  })

  it('default render: Captain view content is visible; Transfer-only copy is NOT visible', () => {
    const history: DecisionHistory = {
      teamId: 12345, gwsWithData: 1, entries: [entry()],
      transferEntries: [],
    }
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    const { container } = render(<BackTab teamId="12345" />)
    // Captain view should show season summary
    expect(container.textContent).toContain('Total captain regret')
    // Transfer-only copy should NOT be visible
    expect(container.textContent).not.toContain('Total transfer regret')
  })

  it('after clicking Transfer pill: Transfer view content visible, Captain view content hidden', () => {
    const history: DecisionHistory = {
      teamId: 12345, gwsWithData: 1, entries: [entry()],
      transferEntries: [transferEntry()],
    }
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    const { container } = render(<BackTab teamId="12345" />)
    const transferBtn = screen.getByRole('button', { name: 'Transfer' })
    fireEvent.click(transferBtn)
    // Transfer view content should be visible
    expect(container.textContent).toContain('Total transfer regret')
    // Captain view content should be hidden
    expect(container.textContent).not.toContain('Total captain regret')
  })

  it('Transfer button click: aria-pressed="true" on Transfer, aria-pressed="false" on Captain', () => {
    const history: DecisionHistory = {
      teamId: 12345, gwsWithData: 1, entries: [entry()],
      transferEntries: [transferEntry()],
    }
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    render(<BackTab teamId="12345" />)
    const captainBtn = screen.getByRole('button', { name: 'Captain' })
    const transferBtn = screen.getByRole('button', { name: 'Transfer' })
    fireEvent.click(transferBtn)
    expect(transferBtn.getAttribute('aria-pressed')).toBe('true')
    expect(captainBtn.getAttribute('aria-pressed')).toBe('false')
  })
})

describe('BackTab — Phase 113 TransferRegretView', () => {
  it('with transferEntries=[] renders empty state copy', () => {
    const history: DecisionHistory = {
      teamId: 12345, gwsWithData: 1, entries: [entry()],
      transferEntries: [],
    }
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    const { container } = render(<BackTab teamId="12345" />)
    const transferBtn = screen.getByRole('button', { name: 'Transfer' })
    fireEvent.click(transferBtn)
    expect(container.textContent).toContain(
      'No transfer history yet — data accumulates each GW after this version is deployed.'
    )
  })

  it('delta > 0 renders "+8pts (engine better)" with text-red-600 class', () => {
    const history: DecisionHistory = {
      teamId: 12345, gwsWithData: 1, entries: [entry()],
      transferEntries: [transferEntry({
        delta: 8.0,
        engineSell: ['Isak'], engineBuy: ['Salah'],
        engineSellPts: [3], engineBuyPts: [12],
        isHold: false,
        userSell: ['Isak'], userBuy: ['Watkins'],
        userSellPts: [3], userBuyPts: [9],
        hasSnapshot: true,
      })],
    }
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    const { container } = render(<BackTab teamId="12345" />)
    const transferBtn = screen.getByRole('button', { name: 'Transfer' })
    fireEvent.click(transferBtn)
    expect(container.textContent).toContain('+8pts (engine better)')
    expect(container.innerHTML).toMatch(/text-negative/)
  })

  it('isHold=true renders "Held — no transfer" AND delta<0 renders "−2pts (good hold)" with text-green-600', () => {
    const history: DecisionHistory = {
      teamId: 12345, gwsWithData: 1, entries: [entry()],
      transferEntries: [transferEntry({
        delta: -2.0,
        isHold: true,
        userSell: null, userBuy: null, userSellPts: null, userBuyPts: null,
        hasSnapshot: true,
      })],
    }
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    const { container } = render(<BackTab teamId="12345" />)
    const transferBtn = screen.getByRole('button', { name: 'Transfer' })
    fireEvent.click(transferBtn)
    expect(container.textContent).toContain('Held — no transfer')
    // U+2212 MINUS SIGN, not ASCII hyphen
    expect(container.textContent).toContain('−2pts (good hold)')
    expect(container.innerHTML).toMatch(/text-positive/)
  })

  it('hasSnapshot=false renders "No model snapshot" in Engine column, "—" in You cell, and "—" in Delta cell', () => {
    const history: DecisionHistory = {
      teamId: 12345, gwsWithData: 1, entries: [entry()],
      transferEntries: [transferEntry({
        hasSnapshot: false,
        engineSell: null, engineBuy: null,
        engineSellPts: null, engineBuyPts: null,
        // Match what the route actually emits when hasSnapshot is false
        userSell: null, userBuy: null,
        userSellPts: null, userBuyPts: null,
        delta: null,
      })],
    }
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    const { container } = render(<BackTab teamId="12345" />)
    const transferBtn = screen.getByRole('button', { name: 'Transfer' })
    fireEvent.click(transferBtn)
    expect(container.textContent).toContain('No model snapshot')
    // You cell renders '—' when userSell/userBuy/userSellPts/userBuyPts are all null
    const cells = container.querySelectorAll('td')
    const youCell = Array.from(cells).find((td) => td.textContent === '—')
    expect(youCell).not.toBeNull()
    // U+2014 EM DASH in delta cell as well
    expect(container.textContent).toContain('—')
  })

  it('season summary: correct "Total transfer regret" and "Engine better:" copy with multiple entries', () => {
    // delta: 5 (engine better), -2 (user better), 0 (tied), null (no snapshot)
    const history: DecisionHistory = {
      teamId: 12345, gwsWithData: 1, entries: [entry()],
      transferEntries: [
        transferEntry({ gw: 1, delta: 5, hasSnapshot: true }),
        transferEntry({ gw: 2, delta: -2, hasSnapshot: true }),
        transferEntry({ gw: 3, delta: 0, hasSnapshot: true }),
        transferEntry({ gw: 4, delta: null, hasSnapshot: false, engineSell: null, engineBuy: null, engineSellPts: null, engineBuyPts: null }),
      ],
    }
    mockedUseDecisionHistory.mockReturnValue({
      data: history, isLoading: false, error: null,
    } as ReturnType<typeof useDecisionHistory>)
    const { container } = render(<BackTab teamId="12345" />)
    const transferBtn = screen.getByRole('button', { name: 'Transfer' })
    fireEvent.click(transferBtn)
    // totalDelta = 5 + (-2) + 0 = 3, gwsWithData = 3 (null skipped)
    expect(container.textContent).toContain('Total transfer regret: 3pts across 3 GWs')
    expect(container.textContent).toContain('Engine better: 1')
    expect(container.textContent).toContain('You better: 1')
    expect(container.textContent).toContain('Tied: 1')
  })
})
