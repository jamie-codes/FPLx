// CHP-01 UI: ChipAdviceCard states — all four chips render with signals.
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChipAdviceCard } from './ChipAdviceCard'
import type { ChipAdvice } from '@/lib/types'

vi.mock('@/lib/hooks/useChipAdvice', () => ({ useChipAdvice: vi.fn() }))
import { useChipAdvice } from '@/lib/hooks/useChipAdvice'
const mockHook = vi.mocked(useChipAdvice)

const DATA: ChipAdvice = {
  gw: 12, generated_at: '2026-07-03T00:00:00+00:00',
  dgw_team_count: 4, bgw_team_count: 0,
  chips: {
    bench_boost: { signal: 'play', value: 15.2, reason: 'Predicted bench = 15.2 xPts with 4 DGW teams' },
    triple_captain: { signal: 'consider', value: 8.1, captain: 'Haaland', reason: 'Top captain projects 8.1' },
    free_hit: { signal: 'hold', value: 61.0, reason: 'No blank-GW pressure' },
    wildcard: { signal: 'informational', reason: 'Fixture-swing driven' },
  },
  note: 'Generic advice',
}

type HookResult = ReturnType<typeof useChipAdvice>
function asResult(partial: object): HookResult {
  return partial as HookResult
}

describe('ChipAdviceCard', () => {
  it('shows an empty state on error', () => {
    mockHook.mockReturnValue(asResult({ data: undefined, isLoading: false, isError: true }))
    render(<ChipAdviceCard />)
    expect(screen.getByText('No chip advice yet')).toBeTruthy()
  })

  it('renders all four chips with their signals', () => {
    mockHook.mockReturnValue(asResult({ data: DATA, isLoading: false, isError: false }))
    render(<ChipAdviceCard />)
    expect(screen.getByText('Bench Boost')).toBeTruthy()
    expect(screen.getByText('Triple Captain')).toBeTruthy()
    expect(screen.getByText('Free Hit')).toBeTruthy()
    expect(screen.getByText('Wildcard')).toBeTruthy()
    expect(screen.getByText('play')).toBeTruthy()
    expect(screen.getByText('consider')).toBeTruthy()
    expect(screen.getByText('informational')).toBeTruthy()
  })

  it('shows the DGW count in the subtitle', () => {
    mockHook.mockReturnValue(asResult({ data: DATA, isLoading: false, isError: false }))
    render(<ChipAdviceCard />)
    expect(screen.getAllByText(/4 DGW teams/).length).toBeGreaterThanOrEqual(1)
  })
})
