// @vitest-environment jsdom
// Phase 101 GWT-01 + UX-01: column header tests for OpportunityCostTable
// Phase 104 WHY-01: sell-side rejection reasons tests
// Phase 105 NLP-02: gw prop threading + PlayerInsightSection presence
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { OpportunityCostTable } from './OpportunityCostTable'
import type { OCSRow } from '@/lib/opportunity-cost'
import type { ScoredPlayer } from '@/lib/types'
import type { LifecycleLabel } from '@/lib/lifecycle-label'

// Phase 115 NEWS-03: mock useNewsFlagEnabled so NewsBanner can be exercised in staleness tests.
vi.mock('@/lib/hooks/useAccuracy', () => ({ useNewsFlagEnabled: vi.fn(() => true) }))

// Phase 105 NLP-02: mock usePlayerInsight hook and PlayerInsightSection component.
// Both are mocked so this test file renders cleanly and we can assert on call args and DOM presence.
vi.mock('@/lib/hooks/usePlayerInsight', () => ({
  usePlayerInsight: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  readCachedInsight: vi.fn().mockReturnValue(null),
}))

vi.mock('@/components/shared/PlayerInsightSection', () => ({
  PlayerInsightSection: vi.fn(() =>
    createElement('div', { 'data-testid': 'player-insight-section' }, 'mock-section'),
  ),
}))

import { usePlayerInsight } from '@/lib/hooks/usePlayerInsight'
import { PlayerInsightSection } from '@/components/shared/PlayerInsightSection'

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
    news_added: undefined,
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
      <OpportunityCostTable rows={[makeRollRow()]} horizon={1} gw={0} allPlayers={[]} lifecycleLabels={new Map()} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('Next 1 GW')
    expect(th?.textContent).not.toContain('Next 1 GWs')
  })

  it('renders "xPts Gain (Next 3 GWs)" in horizon mode with horizon=3 (plural)', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={3} gw={0} allPlayers={[]} lifecycleLabels={new Map()} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('Next 3 GWs')
  })

  it('renders "xPts Gain (Next 5 GWs)" in horizon mode with horizon=5 (plural)', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={5} gw={0} allPlayers={[]} lifecycleLabels={new Map()} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('Next 5 GWs')
  })

  it('renders "xPts Gain (GW33)" in GWT mode with targetGw=33', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={1} targetGw={33} gw={33} allPlayers={[]} lifecycleLabels={new Map()} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('xPts Gain (GW33)')
    expect(th?.textContent).not.toContain('Next')
  })

  it('renders "xPts Gain (GW36)" in GWT mode with targetGw=36', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={5} targetGw={36} gw={36} allPlayers={[]} lifecycleLabels={new Map()} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('xPts Gain (GW36)')
  })

  it('falls back to horizon when targetGw is undefined', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={3} targetGw={undefined} gw={0} allPlayers={[]} lifecycleLabels={new Map()} />
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
        gw={0}
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
        gw={0}
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
    const heavySell = makeScoredPlayer({
      id: 102, web_name: 'HeavySell',
      start_prob: 0.3,
      form_pts_per90: 1.0,
      cost_change_event: -2,
      fixtures: [{ event_id: 33, difficulty_tier: 'hard', is_home: false, opponent_team: 'ARS', difficulty_score: 0.9 }],
      selected_by_percent: '4.0',
    })
    const buy = makeScoredPlayer({ id: 202, web_name: 'AnyBuy' })
    const lifecycleLabels = new Map<number, LifecycleLabel>([[102, 'sell']])
    const { container } = withQueryClient(
      <OpportunityCostTable
        rows={[makeSingleFreeRow(heavySell, buy)]}
        horizon={1}
        gw={0}
        allPlayers={[heavySell, buy]}
        lifecycleLabels={lifecycleLabels}
      />
    )
    const block = container.querySelector('[data-testid="sell-rejection-reasons"]')
    expect(block).not.toBeNull()
    expect(block!.querySelectorAll('p').length).toBe(4)
  })

  it('renders per-leg independent sell-rejection-reasons on a combo-free row', () => {
    const sell1 = makeScoredPlayer({
      id: 103, web_name: 'RotationSell',
      start_prob: 0.4,
    })
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
        gw={0}
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

describe('Phase 105 NLP-02 integration', () => {
  it('gw prop is threaded to PlayerMoveCell — PlayerInsightSection rendered with gw=35 and buy player id=200', () => {
    vi.mocked(PlayerInsightSection).mockClear()
    const buy = makeScoredPlayer({ id: 200, web_name: 'AnyBuy' })
    const sell = makeScoredPlayer({ id: 100, web_name: 'AnySell' })
    withQueryClient(
      <OpportunityCostTable
        rows={[makeSingleFreeRow(sell, buy)]}
        horizon={1}
        gw={35}
        allPlayers={[sell, buy]}
        lifecycleLabels={new Map()}
      />
    )
    const calls = vi.mocked(PlayerInsightSection).mock.calls
    const matchingCall = calls.find(call => (call[0] as { gw: number }).gw === 35)
    expect(matchingCall).toBeDefined()
  })

  it('PlayerInsightSection absent on roll rows', () => {
    const { container } = withQueryClient(
      <OpportunityCostTable
        rows={[makeRollRow()]}
        horizon={1}
        gw={35}
        allPlayers={[]}
        lifecycleLabels={new Map()}
      />
    )
    expect(container.querySelector('[data-testid="player-insight-section"]')).toBeNull()
  })

  it('PlayerInsightSection present on buy-candidate rows', () => {
    const buy = makeScoredPlayer({ id: 200, web_name: 'AnyBuy' })
    const sell = makeScoredPlayer({ id: 100, web_name: 'AnySell' })
    const { container } = withQueryClient(
      <OpportunityCostTable
        rows={[makeSingleFreeRow(sell, buy)]}
        horizon={1}
        gw={35}
        allPlayers={[sell, buy]}
        lifecycleLabels={new Map()}
      />
    )
    expect(container.querySelector('[data-testid="player-insight-section"]')).not.toBeNull()
  })
})

describe('Phase 112 (TFR-02): truncation footnote', () => {
  it('renders cap-footnote-MID when totalsByPosition.get(3) > 3', () => {
    const { container } = withQueryClient(
      <OpportunityCostTable
        rows={[makeRollRow()]}
        horizon={1}
        gw={30}
        allPlayers={[]}
        lifecycleLabels={new Map()}
        totalsByPosition={new Map<number, number>([[3, 7]])}
      />
    )
    const footnote = container.querySelector('[data-testid="cap-footnote-MID"]')
    expect(footnote).not.toBeNull()
    expect(footnote!.textContent?.trim()).toBe('Showing top 3 of 7 MID suggestions.')
  })

  it('renders separate footnotes for each position whose pre-cap total > 3', () => {
    const { container } = withQueryClient(
      <OpportunityCostTable
        rows={[makeRollRow()]}
        horizon={1}
        gw={30}
        allPlayers={[]}
        lifecycleLabels={new Map()}
        totalsByPosition={new Map<number, number>([[2, 5], [3, 8], [4, 3]])}
      />
    )
    const defFootnote = container.querySelector('[data-testid="cap-footnote-DEF"]')
    expect(defFootnote).not.toBeNull()
    expect(defFootnote!.textContent?.trim()).toBe('Showing top 3 of 5 DEF suggestions.')
    const midFootnote = container.querySelector('[data-testid="cap-footnote-MID"]')
    expect(midFootnote).not.toBeNull()
    expect(midFootnote!.textContent?.trim()).toBe('Showing top 3 of 8 MID suggestions.')
    const fwdFootnote = container.querySelector('[data-testid="cap-footnote-FWD"]')
    expect(fwdFootnote).toBeNull()
  })

  it('renders NO footnotes when every bucket is <= 3 (D-07 silent)', () => {
    const { container } = withQueryClient(
      <OpportunityCostTable
        rows={[makeRollRow()]}
        horizon={1}
        gw={30}
        allPlayers={[]}
        lifecycleLabels={new Map()}
        totalsByPosition={new Map<number, number>([[1, 1], [2, 3], [3, 3], [4, 2]])}
      />
    )
    expect(container.querySelectorAll('[data-testid^="cap-footnote-"]').length).toBe(0)
  })

  it('renders NO footnotes when totalsByPosition is undefined (backward-compat)', () => {
    const { container } = withQueryClient(
      <OpportunityCostTable
        rows={[makeRollRow()]}
        horizon={1}
        gw={30}
        allPlayers={[]}
        lifecycleLabels={new Map()}
      />
    )
    expect(container.querySelectorAll('[data-testid^="cap-footnote-"]').length).toBe(0)
  })
})

describe('OpportunityCostTable — Phase 122 POL-04 MinsRiskBadge buy cluster', () => {
  it('renders "Rotation risk" badge in buy cluster when t.buy.mins_risk is rotation_risk', () => {
    const sell = makeScoredPlayer({ id: 100, web_name: 'AnySell' })
    const buy = makeScoredPlayer({ id: 200, web_name: 'RotationBuy', mins_risk: 'rotation_risk' })
    const { container } = withQueryClient(
      <OpportunityCostTable
        rows={[makeSingleFreeRow(sell, buy)]}
        horizon={1}
        gw={33}
        allPlayers={[sell, buy]}
        lifecycleLabels={new Map()}
      />
    )
    expect(container.textContent).toContain('Rotation risk')
    // Badge should appear after the buy player name in the DOM
    const text = container.textContent ?? ''
    const buyNameIdx = text.indexOf('RotationBuy')
    const badgeIdx = text.indexOf('Rotation risk')
    expect(buyNameIdx).toBeGreaterThanOrEqual(0)
    expect(badgeIdx).toBeGreaterThan(buyNameIdx)
  })

  it('renders nothing for MinsRiskBadge when t.buy.mins_risk is injured', () => {
    const sell = makeScoredPlayer({ id: 100, web_name: 'AnySell' })
    const buy = makeScoredPlayer({ id: 200, web_name: 'InjuredBuy', mins_risk: 'injured' })
    const { container } = withQueryClient(
      <OpportunityCostTable
        rows={[makeSingleFreeRow(sell, buy)]}
        horizon={1}
        gw={33}
        allPlayers={[sell, buy]}
        lifecycleLabels={new Map()}
      />
    )
    // MinsRiskBadge should return null for 'injured' — verify no unexpected badge text
    expect(container.textContent).not.toContain('Rotation risk')
    expect(container.textContent).not.toContain('Nailed')
  })
})

describe('OpportunityCostTable — Phase 115 NEWS-03 staleness suppression', () => {
  afterEach(() => vi.restoreAllMocks())

  it('stale zinc buy candidate suppresses NewsBanner in PlayerMoveCell (NEWS-03 automated verification)', () => {
    // news_added 15 days before mocked now → stale zinc → NewsBanner returns null → no banner in DOM
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T00:00:00Z').getTime())
    const buy = makeScoredPlayer({
      id: 300,
      web_name: 'StaleBuy',
      news: 'Old recovery note',
      news_added: '2025-12-17T00:00:00Z',
      chance_of_playing_next_round: 100,
    })
    const sell = makeScoredPlayer({ id: 100, web_name: 'AnySell' })
    const { container } = withQueryClient(
      <OpportunityCostTable
        rows={[makeSingleFreeRow(sell, buy)]}
        horizon={1}
        gw={0}
        allPlayers={[sell, buy]}
        lifecycleLabels={new Map()}
      />
    )
    expect(container.querySelectorAll('[data-testid="news-banner"]').length).toBe(0)
  })
})
