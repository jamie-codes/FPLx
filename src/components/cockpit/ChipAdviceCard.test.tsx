// CHP-01 UI: ChipAdviceCard states — all four chips render with signals.
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChipAdviceCard } from './ChipAdviceCard'
import type { ChipAdvice } from '@/lib/types'

vi.mock('@/lib/hooks/useChipAdvice', () => ({ useChipAdvice: vi.fn() }))
// CHIP-02: the card now re-judges the squad-dependent signals against the
// loaded squad, so it reads these too. Empty by default → falls back to the
// pipeline advice, which is what these existing cases assert.
vi.mock('@/lib/hooks/useSquad', () => ({ useSquad: () => ({ data: undefined }) }))
vi.mock('@/lib/hooks/usePlayers', () => ({ usePlayers: () => ({ data: undefined }) }))
import { useChipAdvice } from '@/lib/hooks/useChipAdvice'
const mockHook = vi.mocked(useChipAdvice)

const DATA: ChipAdvice = {
  gw: 12, generated_at: '2026-07-03T00:00:00+00:00',
  dgw_team_count: 4, bgw_team_count: 0,
  chips: {
    bench_boost: { signal: 'play', value: 15.2, reason: 'Predicted bench = 15.2 xPts with 4 DGW teams',
      windows: [{ start_gw: 34, end_gw: 35, strength: 'play', reason: 'DGW cluster — GW34-35' }] },
    triple_captain: { signal: 'consider', value: 8.1, captain: 'Haaland', reason: 'Top captain projects 8.1', windows: [] },
    free_hit: { signal: 'hold', value: 61.0, reason: 'No blank-GW pressure', windows: [] },
    wildcard: { signal: 'informational', reason: 'Fixture-swing driven', windows: [] },
  },
  note: 'Generic advice',
  horizon_start: 12, horizon_end: 38,
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

  it('draws a window segment for a chip that has one', () => {
    mockHook.mockReturnValue(asResult({ data: DATA, isLoading: false, isError: false }))
    const { container } = render(<ChipAdviceCard />)
    const segs = container.querySelectorAll('[data-window]')
    expect(segs.length).toBe(1)                       // only bench_boost has a window
    expect(container.textContent).toContain('GW34-35')
  })

  it('does not render a timeline bar for Wildcard', () => {
    mockHook.mockReturnValue(asResult({ data: DATA, isLoading: false, isError: false }))
    const { container } = render(<ChipAdviceCard />)
    // 3 bars (BB/TC/FH) — Wildcard row has none.
    expect(container.querySelectorAll('[role="img"]').length).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// CHIP-02: with a squad loaded, the Bench Boost and Triple Captain rows must
// describe THAT squad rather than the pipeline's simulated one.
// ---------------------------------------------------------------------------
describe('ChipAdviceCard — squad-aware signals', () => {
  it('labels whose squad the advice is about', () => {
    mockHook.mockReturnValue({ data: DATA, isLoading: false, isError: false } as never)
    render(<ChipAdviceCard />)
    // No squad mocked in this file, so it must say model squad.
    expect(screen.getByText(/model squad/)).toBeTruthy()
  })
})
