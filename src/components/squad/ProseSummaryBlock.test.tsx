// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
    // Freeze time to 2026-05-05T20:00:00Z for all tests
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-05T20:00:00Z').getTime())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders prose when summary exists', () => {
    // generated_at is 2 hours before frozen now (2026-05-05T18:00:00Z)
    mockSummary({ prose: 'Salah leads.', gw: 35, generated_at: '2026-05-05T18:00:00Z' })
    mockRefresh({})
    const { getByText } = render(<ProseSummaryBlock payload={SAMPLE_PAYLOAD} />)
    expect(getByText('Salah leads.')).toBeTruthy()
    expect(getByText(/Updated .+ ago · GW35/)).toBeTruthy()
  })

  it('returns null when no prose available', () => {
    mockSummary(null)
    mockRefresh({})
    const { container } = render(<ProseSummaryBlock payload={SAMPLE_PAYLOAD} />)
    expect(container.firstChild).toBeNull()
  })

  it('refresh replaces displayed prose on success', () => {
    mockSummary({ prose: 'GLOBAL', gw: 35, generated_at: '2026-05-05T18:00:00Z' })
    const mutate = vi.fn((_payload, opts) => {
      opts?.onSuccess?.({ prose: 'OVERRIDE', gw: 35, generated_at: '2026-05-05T18:01:00Z' })
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
    mockSummary({ prose: 'GLOBAL', gw: 35, generated_at: '2026-05-05T18:00:00Z' })
    mockRefresh({ isPending: true })
    const { getByLabelText } = render(<ProseSummaryBlock payload={SAMPLE_PAYLOAD} />)
    const btn = getByLabelText('Refresh AI summary') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('reload reverts to global prose (override is component state)', () => {
    mockSummary({ prose: 'GLOBAL', gw: 35, generated_at: '2026-05-05T18:00:00Z' })
    const mutate = vi.fn((_payload, opts) => {
      opts?.onSuccess?.({ prose: 'OVERRIDE', gw: 35, generated_at: '2026-05-05T18:01:00Z' })
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

  it('renders fresh footer in zinc when generated_at is < 20 hours old', () => {
    // generated_at = 2 hours before frozen now (2026-05-05T18:00:00Z)
    mockSummary({ prose: 'Salah leads.', gw: 35, generated_at: '2026-05-05T18:00:00Z' })
    mockRefresh({})
    const { getByText, container } = render(<ProseSummaryBlock payload={SAMPLE_PAYLOAD} />)
    expect(getByText(/Updated 2 hours ago · GW35/)).toBeTruthy()
    const footer = container.querySelector('p.text-xs.mt-2')
    expect(footer).not.toBeNull()
    expect(footer!.className).toContain('text-zinc-400')
    expect(footer!.className).not.toContain('text-amber-600')
  })

  it('renders stale footer in amber when generated_at is >= 20 hours old', () => {
    // generated_at = exactly 20 hours before frozen now (2026-05-05T00:00:00Z)
    mockSummary({ prose: 'Salah leads.', gw: 35, generated_at: '2026-05-05T00:00:00Z' })
    mockRefresh({})
    const { getByText, container } = render(<ProseSummaryBlock payload={SAMPLE_PAYLOAD} />)
    expect(getByText(/Updated 20 hours ago · GW35/)).toBeTruthy()
    const footer = container.querySelector('p.text-xs.mt-2')
    expect(footer).not.toBeNull()
    expect(footer!.className).toContain('text-amber-600')
    expect(footer!.className).not.toContain('text-zinc-400')
  })

  it('uses fresh styling at exactly 19h59m old (boundary)', () => {
    // generated_at = 19h59m before frozen now (2026-05-05T00:01:00Z)
    mockSummary({ prose: 'Salah leads.', gw: 35, generated_at: '2026-05-05T00:01:00Z' })
    mockRefresh({})
    const { container } = render(<ProseSummaryBlock payload={SAMPLE_PAYLOAD} />)
    const footer = container.querySelector('p.text-xs.mt-2')
    expect(footer).not.toBeNull()
    expect(footer!.className).toContain('text-zinc-400')
    expect(footer!.className).not.toContain('text-amber-600')
  })

  it('falls back to static GW label when generated_at is missing', () => {
    mockSummary({ prose: 'Salah leads.', gw: 35, generated_at: '' })
    mockRefresh({})
    const { getByText, container } = render(<ProseSummaryBlock payload={SAMPLE_PAYLOAD} />)
    expect(getByText(/Updated GW35/)).toBeTruthy()
    // Should not contain "ago" in the footer text
    const footer = container.querySelector('p.text-xs.mt-2')
    expect(footer).not.toBeNull()
    expect(footer!.textContent).not.toContain('ago')
    expect(footer!.className).toContain('text-zinc-400')
    expect(footer!.className).not.toContain('text-amber-600')
  })
})
