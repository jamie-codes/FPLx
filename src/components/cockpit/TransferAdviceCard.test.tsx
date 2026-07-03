// TRF-01 UI: TransferAdviceCard states — loading / error / hold / moves.
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransferAdviceCard } from './TransferAdviceCard'
import type { TransferAdvice } from '@/lib/types'

vi.mock('@/lib/hooks/useTransferAdvice', () => ({ useTransferAdvice: vi.fn() }))
import { useTransferAdvice } from '@/lib/hooks/useTransferAdvice'
const mockHook = vi.mocked(useTransferAdvice)

function advice(overrides: Partial<TransferAdvice> = {}): TransferAdvice {
  return {
    gw: 12, generated_at: '2026-07-03T00:00:00+00:00',
    moves: [], n_free_used: 0, n_hits: 0,
    predicted_gain: 0, net_gain: 0, hold: true, new_squad_ids: [],
    ...overrides,
  }
}

type HookResult = ReturnType<typeof useTransferAdvice>
function asResult(partial: object): HookResult {
  return partial as HookResult
}

describe('TransferAdviceCard', () => {
  it('shows an empty state on error', () => {
    mockHook.mockReturnValue(asResult({ data: undefined, isLoading: false, isError: true }))
    render(<TransferAdviceCard />)
    expect(screen.getByText('No transfer advice yet')).toBeTruthy()
  })

  it('shows the hold message when no move clears the bar', () => {
    mockHook.mockReturnValue(asResult({ data: advice(), isLoading: false, isError: false }))
    render(<TransferAdviceCard />)
    expect(screen.getByTestId('hold-message')).toBeTruthy()
  })

  it('renders moves with OUT/IN names, gain and hit badge', () => {
    const data = advice({
      hold: false, n_free_used: 1, n_hits: 1, predicted_gain: 13.2, net_gain: 9.2,
      moves: [
        { out: { id: 1, name: 'Doak', element_type: 3, cost: 45, value: 2.0, available: false },
          in: { id: 2, name: 'Salah', element_type: 3, cost: 130, value: 8.4 },
          gain: 6.4, hit: false, reason: 'unavailable — forced replacement' },
        { out: { id: 3, name: 'Archer', element_type: 4, cost: 45, value: 2.1 },
          in: { id: 4, name: 'Haaland', element_type: 4, cost: 150, value: 8.9 },
          gain: 6.8, hit: true, reason: 'predicted upgrade' },
      ],
    })
    mockHook.mockReturnValue(asResult({ data, isLoading: false, isError: false }))
    render(<TransferAdviceCard />)
    expect(screen.getByText('Salah')).toBeTruthy()
    expect(screen.getByText('Haaland')).toBeTruthy()
    expect(screen.getByText('forced')).toBeTruthy()
    expect(screen.getByText('-4 hit')).toBeTruthy()
    expect(screen.getByText('+6.4')).toBeTruthy()
  })
})
