// @vitest-environment jsdom
// Phase 96 BACK-01 Wave 1 RED — BackTab UI contract.
// BackTab.tsx does not exist yet; this file fails at import. Plan 04 turns it GREEN.
// Source of truth: .planning/phases/96-captain-decision-backtester/096-UI-SPEC.md §Copywriting Contract
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@/lib/hooks/useDecisionHistory', () => ({
  useDecisionHistory: vi.fn(),
}))

import { BackTab } from './BackTab'
import { useDecisionHistory } from '@/lib/hooks/useDecisionHistory'
import type { DecisionHistory, RegretEntry } from '@/lib/types'

const mockedUseDecisionHistory = vi.mocked(useDecisionHistory)

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
