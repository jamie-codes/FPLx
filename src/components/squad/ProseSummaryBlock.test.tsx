// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

vi.mock('@/lib/hooks/useProseSummary', () => ({ useProseSummary: vi.fn() }))
vi.mock('@/lib/hooks/useProseRefresh', () => ({ useProseRefresh: vi.fn() }))

import { useProseSummary } from '@/lib/hooks/useProseSummary'
import { useProseRefresh } from '@/lib/hooks/useProseRefresh'
import { ProseSummaryBlock } from './ProseSummaryBlock'

const SAMPLE_PAYLOAD = {
  gw: 35,
  captains: [{ name: 'Salah', team: 'LIV', xPts_1gw: 6.8 }],
  transfer: null,
  chip: { code: null, bestGw: null },
  risks: [],
} as const

function mockSummary(prose: { prose: string; gw: number; generated_at: string } | null) {
  vi.mocked(useProseSummary).mockReturnValue({ data: prose, isLoading: false, error: null } as never)
}

function mockRefresh(opts: { isPending?: boolean; mutate?: ReturnType<typeof vi.fn> }) {
  vi.mocked(useProseRefresh).mockReturnValue({
    mutate: opts.mutate ?? vi.fn(),
    isPending: !!opts.isPending,
    isError: false,
    error: null,
    data: undefined,
  } as never)
}

describe('ProseSummaryBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders prose when summary exists', () => {
    mockSummary({ prose: 'Salah leads.', gw: 35, generated_at: '2026-05-05T00:00:00Z' })
    mockRefresh({})
    const { getByText } = render(<ProseSummaryBlock payload={SAMPLE_PAYLOAD} />)
    expect(getByText('Salah leads.')).toBeTruthy()
    expect(getByText(/Updated GW35/)).toBeTruthy()
  })

  it('returns null when no prose available', () => {
    mockSummary(null)
    mockRefresh({})
    const { container } = render(<ProseSummaryBlock payload={SAMPLE_PAYLOAD} />)
    expect(container.firstChild).toBeNull()
  })

  it('refresh replaces displayed prose on success', () => {
    mockSummary({ prose: 'GLOBAL', gw: 35, generated_at: '2026-05-05T00:00:00Z' })
    const mutate = vi.fn((_payload, opts) => {
      opts?.onSuccess?.({ prose: 'OVERRIDE', gw: 35, generated_at: '2026-05-05T00:01:00Z' })
    })
    mockRefresh({ mutate })
    const { getByLabelText, getByText, queryByText } = render(
      <ProseSummaryBlock payload={SAMPLE_PAYLOAD} />,
    )
    expect(getByText('GLOBAL')).toBeTruthy()
    fireEvent.click(getByLabelText('Refresh AI summary'))
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(getByText('OVERRIDE')).toBeTruthy()
    expect(queryByText('GLOBAL')).toBeNull()
  })

  it('refresh button disabled while in flight', () => {
    mockSummary({ prose: 'GLOBAL', gw: 35, generated_at: '2026-05-05T00:00:00Z' })
    mockRefresh({ isPending: true })
    const { getByLabelText } = render(<ProseSummaryBlock payload={SAMPLE_PAYLOAD} />)
    const btn = getByLabelText('Refresh AI summary') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('reload reverts to global prose (override is component state)', () => {
    mockSummary({ prose: 'GLOBAL', gw: 35, generated_at: '2026-05-05T00:00:00Z' })
    const mutate = vi.fn((_payload, opts) => {
      opts?.onSuccess?.({ prose: 'OVERRIDE', gw: 35, generated_at: '2026-05-05T00:01:00Z' })
    })
    mockRefresh({ mutate })
    const { getByLabelText, getByText, unmount } = render(
      <ProseSummaryBlock payload={SAMPLE_PAYLOAD} />,
    )
    fireEvent.click(getByLabelText('Refresh AI summary'))
    expect(getByText('OVERRIDE')).toBeTruthy()
    unmount()
    // Remount fresh instance — override state is lost, global prose shows again (D-04)
    const { getByText: getByText2 } = render(<ProseSummaryBlock payload={SAMPLE_PAYLOAD} />)
    expect(getByText2('GLOBAL')).toBeTruthy()
  })
})
