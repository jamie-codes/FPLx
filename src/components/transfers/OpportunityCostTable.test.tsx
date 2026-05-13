// @vitest-environment jsdom
// Phase 101 GWT-01 + UX-01: column header tests for OpportunityCostTable
// Phase 104 WHY-01: sell-side rejection reasons tests
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { OpportunityCostTable } from './OpportunityCostTable'
import type { OCSRow } from '@/lib/opportunity-cost'
import type { ScoredPlayer } from '@/lib/types'
import type { LifecycleLabel } from '@/lib/lifecycle-label'

function withQueryClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(createElement(QueryClientProvider, { client: qc }, ui))
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

function makeScoredPlayer(overrides: Partial<ScoredPlayer> = {}): ScoredPlayer {
  // Defaults define a "strong" player: no rejection reasons.
  return {
    id: 100,
    web_name: 'Strong',
    element_type: 3, // MID
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
    // Phase 93: undefined skips the news-doubt fragility check
    chance_of_playing_next_round: undefined,
    // Phase 93: undefined skips the mins_60_prob fragility check
    mins_60_prob: undefined,
    penalties_order: null,
    direct_freekicks_order: null,
    corners_and_indirect_freekicks_order: null,
    // ScoredPlayer dimension scores
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

function makeComboFreeRow(sell1: ScoredPlayer, buy1: ScoredPlayer, sell2: ScoredPlayer, buy2: ScoredPlayer): OCSRow {
  return {
    kind: 'combo-free',
    label: '2 FT',
    transfers: [{ sell: sell1, buy: buy1 }, { sell: sell2, buy: buy2 }],
    xPtsGain: 4.0,
    xPtsGainNet: 4.0,
    xPtsGainPerGw: 4.0,
    breakEvenGws: 2,
    cost: 0,
    bankAfter: 0,
    isAffordable: true,
  } as unknown as OCSRow
}

describe('OpportunityCostTable column header', () => {
  it('renders "xPts Gain (Next 1 GW)" in horizon mode with horizon=1 (singular)', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={1} allPlayers={[]} lifecycleLabels={new Map()} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('Next 1 GW')
    expect(th?.textContent).not.toContain('Next 1 GWs')
  })

  it('renders "xPts Gain (Next 3 GWs)" in horizon mode with horizon=3 (plural)', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={3} allPlayers={[]} lifecycleLabels={new Map()} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('Next 3 GWs')
  })

  it('renders "xPts Gain (Next 5 GWs)" in horizon mode with horizon=5 (plural)', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={5} allPlayers={[]} lifecycleLabels={new Map()} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('Next 5 GWs')
  })

  it('renders "xPts Gain (GW33)" in GWT mode with targetGw=33', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={1} targetGw={33} allPlayers={[]} lifecycleLabels={new Map()} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('xPts Gain (GW33)')
    expect(th?.textContent).not.toContain('Next')
  })

  it('renders "xPts Gain (GW36)" in GWT mode with targetGw=36', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={5} targetGw={36} allPlayers={[]} lifecycleLabels={new Map()} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('xPts Gain (GW36)')
  })

  it('falls back to horizon when targetGw is undefined', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={3} targetGw={undefined} allPlayers={[]} lifecycleLabels={new Map()} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('Next 3 GWs')
  })
})

describe('OpportunityCostTable WHY-01 sell rejection reasons', () => {
  it('renders no sell-rejection-reasons block when computeRejection returns empty reasons (strong sell)', () => {
    const strongSell = makeScoredPlayer({ id: 100, web_name: 'StrongSell' })
    const buy = makeScoredPlayer({ id: 200, web_name: 'AnyBuy' })
    const allPlayers = [strongSell, buy]
    const { container } = withQueryClient(
      <OpportunityCostTable
        rows={[makeSingleFreeRow(strongSell, buy)]}
        horizon={1}
        allPlayers={allPlayers}
        lifecycleLabels={new Map()}
      />
    )
    expect(container.querySelector('[data-testid="sell-rejection-reasons"]')).toBeNull()
  })

  it('renders sell-rejection-reasons with rotation risk and poor form for a weak sell', () => {
    const weakSell = makeScoredPlayer({
      id: 101, web_name: 'WeakSell',
      start_prob: 0.4, form_pts_per90: 1.5, cost_change_event: -2,
    })
    const buy = makeScoredPlayer({ id: 201, web_name: 'AnyBuy' })
    const { container } = withQueryClient(
      <OpportunityCostTable
        rows={[makeSingleFreeRow(weakSell, buy)]}
        horizon={1}
        allPlayers={[weakSell, buy]}
        lifecycleLabels={new Map()}
      />
    )
    const block = container.querySelector('[data-testid="sell-rejection-reasons"]')
    expect(block).not.toBeNull()
    const text = block!.textContent ?? ''
    expect(text).toMatch(/Rotation risk — start probability/)
    expect(text).toMatch(/Poor form —/)
    expect(text).toMatch(/Price falling this GW/)
  })

  it('caps sell-rejection-reasons at 4 even when computeRejection returns more reasons', () => {
    // Construct a sell with many rejection signals: rotation risk + poor form + hard fixture +
    // price falling + lifecycle 'sell' + low ownership => rank + rotation + form + hard + price + lifecycle + ownership = 7 reasons
    const heavySell = makeScoredPlayer({
      id: 102, web_name: 'HeavySell',
      start_prob: 0.3,           // rotation risk (< 0.70)
      form_pts_per90: 1.0,       // poor form (< 3.0)
      cost_change_event: -2,     // price falling (< 0)
      fixtures: [{ event_id: 33, difficulty_tier: 'hard', is_home: false, opponent_team: 'ARS', difficulty_score: 0.9 }],
      selected_by_percent: '4.0', // low ownership (≤ 20%)
    })
    const buy = makeScoredPlayer({ id: 202, web_name: 'AnyBuy' })
    const lifecycleLabels = new Map<number, LifecycleLabel>([[102, 'sell']])
    const { container } = withQueryClient(
      <OpportunityCostTable
        rows={[makeSingleFreeRow(heavySell, buy)]}
        horizon={1}
        allPlayers={[heavySell, buy]}
        lifecycleLabels={lifecycleLabels}
      />
    )
    const block = container.querySelector('[data-testid="sell-rejection-reasons"]')
    expect(block).not.toBeNull()
    expect(block!.querySelectorAll('p').length).toBe(4)
  })

  it('renders per-leg independent sell-rejection-reasons on a combo-free row', () => {
    // Sell 1: rotation risk signal (start_prob 0.4)
    const sell1 = makeScoredPlayer({
      id: 103, web_name: 'RotationSell',
      start_prob: 0.4,
    })
    // Sell 2: poor form signal (form 1.5)
    const sell2 = makeScoredPlayer({
      id: 104, web_name: 'FormSell',
      form_pts_per90: 1.5,
    })
    const buy1 = makeScoredPlayer({ id: 203, web_name: 'Buy1' })
    const buy2 = makeScoredPlayer({ id: 204, web_name: 'Buy2' })
    const { container } = withQueryClient(
      <OpportunityCostTable
        rows={[makeComboFreeRow(sell1, buy1, sell2, buy2)]}
        horizon={1}
        allPlayers={[sell1, sell2, buy1, buy2]}
        lifecycleLabels={new Map()}
      />
    )
    const blocks = container.querySelectorAll('[data-testid="sell-rejection-reasons"]')
    expect(blocks.length).toBe(2)
    expect(blocks[0]!.textContent).toMatch(/Rotation risk — start probability/)
    expect(blocks[1]!.textContent).toMatch(/Poor form —/)
  })
})
