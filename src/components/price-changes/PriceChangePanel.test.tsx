import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PriceChangePanel } from './PriceChangePanel'

vi.mock('@/lib/hooks/usePriceChanges', () => ({
  usePriceChanges: vi.fn(),
}))

import { usePriceChanges } from '@/lib/hooks/usePriceChanges'

const mockedUse = usePriceChanges as unknown as ReturnType<typeof vi.fn>

function setHook(value: unknown) {
  mockedUse.mockReturnValue(value)
}

describe('PriceChangePanel', () => {
  beforeEach(() => {
    mockedUse.mockReset()
  })

  it('renders the loading state when isLoading=true', () => {
    setHook({ data: undefined, isLoading: true, error: undefined })
    render(<PriceChangePanel />)
    expect(screen.getByText(/Loading price change predictions/i)).toBeTruthy()
  })

  it('renders empty state when predictions list is empty', () => {
    setHook({
      data: { generated_at: '2026-05-02T00:00:00Z', current_gw: 33, snapshot_days: 0, predictions: [] },
      isLoading: false,
      error: undefined,
    })
    render(<PriceChangePanel />)
    expect(screen.getByText(/No price change data yet/i)).toBeTruthy()
  })

  it('renders rise section before fall section', () => {
    setHook({
      data: {
        generated_at: '2026-05-02T00:00:00Z',
        current_gw: 33,
        snapshot_days: 20,
        predictions: [
          { player_id: 1, name: 'Riser',  team: 'ARS', now_cost: 90, direction: 'rise', confidence_pct: 80, eta_days: 1, cumulative_net:  900, selected_by_percent: '10.0' },
          { player_id: 2, name: 'Faller', team: 'CHE', now_cost: 75, direction: 'fall', confidence_pct: 60, eta_days: 2, cumulative_net: -600, selected_by_percent:  '5.0' },
        ],
      },
      isLoading: false,
      error: undefined,
    })
    const { container } = render(<PriceChangePanel />)
    const text = container.textContent ?? ''
    const riseIdx = text.indexOf('Predicted to rise')
    const fallIdx = text.indexOf('Predicted to fall')
    expect(riseIdx).toBeGreaterThanOrEqual(0)
    expect(fallIdx).toBeGreaterThanOrEqual(0)
    expect(riseIdx).toBeLessThan(fallIdx)
  })

  it('suppresses tier badges when snapshot_days < 14', () => {
    setHook({
      data: {
        generated_at: '2026-05-02T00:00:00Z',
        current_gw: 33,
        snapshot_days: 5,
        predictions: [
          { player_id: 1, name: 'Riser', team: 'ARS', now_cost: 90, direction: 'rise', confidence_pct: 85, eta_days: 1, cumulative_net: 900, selected_by_percent: '10.0' },
        ],
      },
      isLoading: false,
      error: undefined,
    })
    render(<PriceChangePanel />)
    expect(screen.queryByText('HIGH')).toBeNull()
    expect(screen.queryByText('MEDIUM')).toBeNull()
    expect(screen.queryByText('LOW')).toBeNull()
  })
})
