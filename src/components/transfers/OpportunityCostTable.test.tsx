// @vitest-environment jsdom
// Phase 101 GWT-01 + UX-01: column header tests for OpportunityCostTable
// Phase 105 NLP-02: gw prop threading + PlayerInsightSection presence stubs
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { OpportunityCostTable } from './OpportunityCostTable'
import type { OCSRow } from '@/lib/opportunity-cost'
import type { ScoredPlayer } from '@/lib/types'

// Wave 0: usePlayerInsight module does not exist yet.
// vi.mock is registered here so that when Wave 1 creates the module, the mock activates.
// The factory provides the mock implementation for all tests in this file.
// No static import is added in Wave 0 — module resolution would fail during transform.
vi.mock('@/lib/hooks/usePlayerInsight', () => ({
  usePlayerInsight: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  readCachedInsight: vi.fn().mockReturnValue(null),
}))

function withQueryClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(createElement(QueryClientProvider, { client: qc }, ui))
}

function makeScoredPlayer(overrides: Partial<ScoredPlayer> = {}): ScoredPlayer {
  return {
    id: 100,
    web_name: 'Strong',
    element_type: 3,
    team: 1,
    now_cost: 80,
    gem_score: 5.0,
    xPts_1gw: 7.0,
    start_prob: 0.95,
    form_pts_per90: 8.0,
    selected_by_percent: '25.0',
    cost_change_event: 0,
    rotation_risk: false,
    fixtures: [{ event_id: 33, difficulty_tier: 'easy', is_home: true, opponent_team: 'MCI', difficulty_score: 0.2 }],
    xg_per90: 0.4,
    xa_per90: 0.2,
    news: '',
    news_added: null,
    chance_of_playing_next_round: undefined,
    mins_60_prob: undefined,
    penalties_order: null,
    direct_freekicks_order: null,
    corners_and_indirect_freekicks_order: null,
    fdr_score: 0.7,
    form_score: 0.8,
    xg_score: 0.5,
    xa_score: 0.3,
    ownership_score: 0.4,
    minutes_score: 0.9,
    set_piece_score: 0.0,
    ...overrides,
  } as unknown as ScoredPlayer
}

function makeSingleFreeRow(sell: ScoredPlayer, buy: ScoredPlayer): OCSRow {
  return {
    kind: 'single-free',
    label: '1 FT',
    transfers: [{ sell, buy }],
    xPtsGain: 2.0,
    xPtsGainNet: 2.0,
    xPtsGainPerGw: 2.0,
    breakEvenGws: 3,
    cost: 0,
    bankAfter: 0,
    isAffordable: true,
  } as unknown as OCSRow
}

function makeRollRow(): OCSRow {
  return {
    kind: 'roll',
    label: 'Roll FT',
    transfers: [],
    xPtsGain: 0,
    xPtsGainNet: 0,
    xPtsGainPerGw: 0,
    breakEvenGws: null,
    cost: 0,
    bankAfter: 0,
    isAffordable: true,
  } as unknown as OCSRow
}

describe('OpportunityCostTable column header', () => {
  it('renders "xPts Gain (Next 1 GW)" in horizon mode with horizon=1 (singular)', () => {
    const { container } = render(<OpportunityCostTable rows={[makeRollRow()]} horizon={1} />)
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('Next 1 GW')
    expect(th?.textContent).not.toContain('Next 1 GWs')
  })

  it('renders "xPts Gain (Next 3 GWs)" in horizon mode with horizon=3 (plural)', () => {
    const { container } = render(<OpportunityCostTable rows={[makeRollRow()]} horizon={3} />)
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('Next 3 GWs')
  })

  it('renders "xPts Gain (Next 5 GWs)" in horizon mode with horizon=5 (plural)', () => {
    const { container } = render(<OpportunityCostTable rows={[makeRollRow()]} horizon={5} />)
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('Next 5 GWs')
  })

  it('renders "xPts Gain (GW33)" in GWT mode with targetGw=33', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={1} targetGw={33} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('xPts Gain (GW33)')
    expect(th?.textContent).not.toContain('Next')
  })

  it('renders "xPts Gain (GW36)" in GWT mode with targetGw=36', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={5} targetGw={36} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('xPts Gain (GW36)')
  })

  it('falls back to horizon when targetGw is undefined', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={3} targetGw={undefined} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('Next 3 GWs')
  })
})

describe('Phase 105 NLP-02 integration', () => {
  // Wave 0 stubs — these tests will be implemented in Wave 1 once:
  // 1. usePlayerInsight module exists at src/lib/hooks/usePlayerInsight.ts
  // 2. PlayerInsightSection component exists at src/components/shared/PlayerInsightSection.tsx
  // 3. OpportunityCostTable accepts a `gw` prop and passes it to PlayerMoveCell
  // These it.todo() stubs mark the requirements as pending verification targets.

  it.todo('gw prop is threaded to PlayerMoveCell — usePlayerInsight called with (playerId, 35)')

  it.todo('PlayerInsightSection absent on roll rows')

  it.todo('PlayerInsightSection present on buy-candidate rows')
})
