// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

vi.mock('@/lib/hooks/usePlayerInsight', () => ({
  usePlayerInsight: vi.fn(),
  readCachedInsight: vi.fn(),
}))

import { usePlayerInsight, readCachedInsight } from '@/lib/hooks/usePlayerInsight'
import { PlayerInsightSection } from './PlayerInsightSection'
import type { ScoredPlayer } from '@/lib/types'

function mockHook(opts: {
  isPending?: boolean
  isError?: boolean
  error?: Error | null
  mutate?: ReturnType<typeof vi.fn>
}) {
  vi.mocked(usePlayerInsight).mockReturnValue({
    mutate: opts.mutate ?? vi.fn(),
    isPending: !!opts.isPending,
    isError: !!opts.isError,
    error: opts.error ?? null,
    data: undefined,
  } as never)
}

const defaultProps = {
  player: { id: 100, web_name: 'Salah', element_type: 3 } as unknown as ScoredPlayer,
  gw: 35,
  rejectionReasons: ['xPts 4.2 < threshold 4.7', 'fixture vs LIV(A)'],
  fragility: { tier: 'robust' as const, reasons: [] },
}

describe('PlayerInsightSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(readCachedInsight).mockReturnValue(null)
  })

  it('renders Get AI insight button when no cache hit', () => {
    vi.mocked(readCachedInsight).mockReturnValue(null)
    mockHook({})
    const { getByText } = render(<PlayerInsightSection {...defaultProps} />)
    expect(getByText('Get AI insight')).toBeTruthy()
  })

  it('does NOT call mutate from useEffect (cost-explosion safeguard)', () => {
    vi.mocked(readCachedInsight).mockReturnValue(null)
    const mutate = vi.fn()
    mockHook({ mutate })
    render(<PlayerInsightSection {...defaultProps} />)
    // Mount must NOT trigger network — this is the critical invariant
    expect(mutate).not.toHaveBeenCalled()
  })

  it('renders Generating… when isPending', () => {
    vi.mocked(readCachedInsight).mockReturnValue(null)
    mockHook({ isPending: true })
    const { getByText } = render(<PlayerInsightSection {...defaultProps} />)
    const btn = getByText('Generating…')
    expect(btn).toBeTruthy()
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('renders prose and Refresh insight after mutate success', () => {
    vi.mocked(readCachedInsight).mockReturnValue(null)
    const mutate = vi.fn((_payload: unknown, opts?: { onSuccess?: (data: unknown) => void }) => {
      opts?.onSuccess?.({ prose: 'INSIGHT', player_id: 100, gw: 35, generated_at: '2026-05-13T12:00:00.000Z' })
    })
    mockHook({ mutate })
    const { getByText } = render(<PlayerInsightSection {...defaultProps} />)
    fireEvent.click(getByText('Get AI insight'))
    expect(getByText('INSIGHT')).toBeTruthy()
    expect(getByText('Refresh insight')).toBeTruthy()
  })

  it('auto-renders prose on mount when cache hit', () => {
    vi.mocked(readCachedInsight).mockReturnValue({
      prose: 'CACHED',
      player_id: 100,
      gw: 35,
      generated_at: '2026-05-13T12:00:00.000Z',
    })
    mockHook({})
    const { getByText } = render(<PlayerInsightSection {...defaultProps} />)
    // Should show prose WITHOUT any click
    expect(getByText('CACHED')).toBeTruthy()
    expect(getByText('Refresh insight')).toBeTruthy()
  })

  it('renders inline error on hard error', () => {
    vi.mocked(readCachedInsight).mockReturnValue(null)
    mockHook({ isError: true, error: new Error('Server error') })
    const { getByText } = render(<PlayerInsightSection {...defaultProps} />)
    expect(getByText('AI unavailable — try again')).toBeTruthy()
  })

  it('renders guardrail fallback header + reasons list on GUARDRAIL_FAILED', () => {
    vi.mocked(readCachedInsight).mockReturnValue(null)
    const mutate = vi.fn((_payload: unknown, opts?: { onError?: (err: Error) => void }) => {
      opts?.onError?.(new Error('GUARDRAIL_FAILED'))
    })
    mockHook({ mutate })
    const { getByText, container } = render(<PlayerInsightSection {...defaultProps} />)
    fireEvent.click(getByText('Get AI insight'))
    expect(getByText('AI insight unavailable — showing analysis:')).toBeTruthy()
    const listItems = container.querySelectorAll('li')
    expect(listItems.length).toBeGreaterThan(0)
  })

  it('renders section heading AI ✨ Insight when prose visible', () => {
    vi.mocked(readCachedInsight).mockReturnValue(null)
    const mutate = vi.fn((_payload: unknown, opts?: { onSuccess?: (data: unknown) => void }) => {
      opts?.onSuccess?.({ prose: 'INSIGHT', player_id: 100, gw: 35, generated_at: '2026-05-13T12:00:00.000Z' })
    })
    mockHook({ mutate })
    const { getByText } = render(<PlayerInsightSection {...defaultProps} />)
    fireEvent.click(getByText('Get AI insight'))
    expect(getByText('AI ✨ Insight')).toBeTruthy()
  })
})
