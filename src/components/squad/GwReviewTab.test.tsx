// Phase 73 PGW-01: GwReviewTab tests (Wave 0 — written BEFORE component)
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import type { GwReview } from '@/lib/types'

// Mock the hook BEFORE importing the component (Vitest hoists vi.mock).
const mockUseGwReview = vi.fn()
vi.mock('@/lib/hooks/useGwReview', () => ({
  useGwReview: (...args: unknown[]) => mockUseGwReview(...args),
}))

import { GwReviewTab } from './GwReviewTab'

const sampleReview: GwReview = {
  gw: 34,
  your_score: 72,
  bench_pts_left: 8,
  captain_name: 'Salah',
  optimal_captain_name: 'Haaland',
  captain_delta: 6,
  top_scorer_name: 'Haaland',
  top_scorer_pts: 14,
  average_score: 55,
  best_bench_player_name: 'Watkins',  // Phase 98 PGW-01
  best_bench_player_pts: 9,           // Phase 98 PGW-01
  // Phase 99 PGW-03 — new required fields:
  benchmark_score: 54,
  benchmark_label: 'Dream team',
  missed_players: [
    { name: 'Saka', pts: 12 },
    { name: 'Palmer', pts: 10 },
  ],
}

function mockSuccess(data: GwReview = sampleReview) {
  mockUseGwReview.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    error: null,
  })
}

function mockError(status: number, message: string) {
  const err = Object.assign(new Error(message), { status }) as Error & { status: number }
  mockUseGwReview.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: true,
    error: err,
  })
}

describe('Phase 73: GwReviewTab', () => {
  beforeEach(() => {
    // Reset to a safe default (disabled-query shape) so tests that don't call
    // mockSuccess/mockError still get a valid destructurable object. The hook
    // is always called (React rules of hooks), even when teamId is empty.
    mockUseGwReview.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    })
  })

  it('renders 4 stat values + top-scorer + captain rows when data present (PGW-01)', () => {
    mockSuccess()
    const { container } = render(<GwReviewTab teamId="12345" settledGws={[33, 34, 35]} />)
    // Section landmark
    expect(container.querySelector('[data-testid="gw-review-tab"]')).not.toBeNull()
    // Stat values appear in the rendered output
    expect(container.textContent).toContain('72')   // your_score
    expect(container.textContent).toContain('8')    // bench_pts_left
    expect(container.textContent).toContain('+6')   // captain_delta with + prefix
    expect(container.textContent).toContain('54')   // benchmark_score (PGW-03 replaces the 4th card)
    // Detail rows
    expect(container.textContent).toContain('Haaland') // top scorer name + optimal captain
    expect(container.textContent).toContain('Salah')   // captain name
    // Stat labels
    expect(container.textContent).toContain('GW Score')
    expect(container.textContent).toContain('Bench pts left')
    expect(container.textContent).toContain('Dream team')  // PGW-03: 4th card now shows benchmark label
    expect(container.textContent).toContain('Captain delta')
  })

  it('renders empty state when teamId is empty string (PGW-01)', () => {
    // useGwReview should NOT be called with a real teamId; the component should short-circuit.
    const { container } = render(<GwReviewTab teamId="" settledGws={[33, 34, 35]} />)
    expect(container.textContent).toContain('Load your squad to see GW reviews.')
    // No stat cards rendered
    expect(container.querySelector('[data-testid="gw-review-stat-grid"]')).toBeNull()
    // No pill toggle rendered
    expect(container.querySelector('[role="group"][aria-label="Gameweek"]')).toBeNull()
  })

  it('renders unsettled message when error.status === 503 (PGW-01)', () => {
    mockError(503, 'GW not yet settled')
    const { container } = render(<GwReviewTab teamId="12345" settledGws={[33, 34, 35]} />)
    expect(container.textContent).toContain('GW review will appear once scores finalise.')
    // Stat grid not rendered when unsettled
    expect(container.querySelector('[data-testid="gw-review-stat-grid"]')).toBeNull()
  })

  it('GW pill toggle switches active GW and triggers new query (PGW-01)', () => {
    mockSuccess()
    const { container, rerender } = render(
      <GwReviewTab teamId="12345" settledGws={[33, 34, 35]} />
    )
    // Default active GW = 35 (most recent settled). Verify hook called with 35.
    const calls = mockUseGwReview.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const lastCallArgs = calls[calls.length - 1]
    expect(lastCallArgs[0]).toBe('12345')
    expect(lastCallArgs[1]).toBe(35)

    // Find the GW33 pill and click it.
    const buttons = Array.from(container.querySelectorAll('button'))
    const gw33Btn = buttons.find(b => b.textContent === 'GW33')
    expect(gw33Btn).toBeDefined()
    fireEvent.click(gw33Btn!)

    // Re-render captures the next render cycle. After click, hook should be called with gw=33.
    rerender(<GwReviewTab teamId="12345" settledGws={[33, 34, 35]} />)
    const callsAfter = mockUseGwReview.mock.calls
    const lastAfter = callsAfter[callsAfter.length - 1]
    expect(lastAfter[1]).toBe(33)

    // Active pill (GW33) has aria-pressed="true"; others have aria-pressed="false"
    const buttonsAfter = Array.from(container.querySelectorAll('button'))
    const gw33After = buttonsAfter.find(b => b.textContent === 'GW33')
    const gw35After = buttonsAfter.find(b => b.textContent === 'GW35')
    expect(gw33After?.getAttribute('aria-pressed')).toBe('true')
    expect(gw35After?.getAttribute('aria-pressed')).toBe('false')
  })

  it('renders "Best bench" info row with name and points when data present (PGW-01)', () => {
    mockSuccess()
    const { container } = render(<GwReviewTab teamId="12345" settledGws={[33, 34, 35]} />)
    expect(container.textContent).toContain('Best bench')
    expect(container.textContent).toContain('Watkins')
    expect(container.textContent).toContain('9pts')
  })

  it('"Best bench" row is absent in no-squad empty state (PGW-01)', () => {
    const { container } = render(<GwReviewTab teamId="" settledGws={[33, 34, 35]} />)
    expect(container.textContent).not.toContain('Best bench')
  })
})

describe('Phase 99 PGW-03: GwReviewTab benchmark card + Missed row', () => {
  beforeEach(() => {
    mockUseGwReview.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    })
  })

  function withReview(overrides: Partial<GwReview> = {}) {
    mockUseGwReview.mockReturnValue({
      data: { ...sampleReview, ...overrides },
      isLoading: false,
      isError: false,
      error: null,
    })
  }

  it('renders benchmark StatCard with label and value from review.benchmark_label/benchmark_score', () => {
    withReview({ benchmark_label: 'Dream team', benchmark_score: 54 })
    const { container } = render(<GwReviewTab teamId="12345" settledGws={[33, 34, 35]} />)
    const card = container.querySelector('[data-testid="gw-review-benchmark-card"]')
    expect(card).not.toBeNull()
    expect(card!.textContent).toContain('Dream team')
    expect(card!.textContent).toContain('54')
  })

  it('renders delta sub-label "+N vs you" when your_score > benchmark_score', () => {
    withReview({ your_score: 72, benchmark_score: 60, benchmark_label: 'Dream team' })
    const { container } = render(<GwReviewTab teamId="12345" settledGws={[33, 34, 35]} />)
    const card = container.querySelector('[data-testid="gw-review-benchmark-card"]')
    expect(card!.textContent).toMatch(/\+12 vs you/)
  })

  it('renders delta sub-label "−N vs you" (U+2212) when your_score < benchmark_score', () => {
    withReview({ your_score: 50, benchmark_score: 65, benchmark_label: 'Dream team' })
    const { container } = render(<GwReviewTab teamId="12345" settledGws={[33, 34, 35]} />)
    const card = container.querySelector('[data-testid="gw-review-benchmark-card"]')
    // U+2212 MINUS SIGN, not U+002D HYPHEN-MINUS
    expect(card!.textContent).toMatch(/−15 vs you/)
    // Confirm it is NOT the ASCII hyphen variant
    expect(card!.textContent).not.toMatch(/^-15 vs you$/)
  })

  it('renders delta sub-label "on par" when your_score === benchmark_score', () => {
    withReview({ your_score: 60, benchmark_score: 60, benchmark_label: 'Dream team' })
    const { container } = render(<GwReviewTab teamId="12345" settledGws={[33, 34, 35]} />)
    const card = container.querySelector('[data-testid="gw-review-benchmark-card"]')
    expect(card!.textContent).toContain('on par')
  })

  it('does NOT render delta sub-label when benchmark_label === "FPL average" (degraded fallback)', () => {
    withReview({
      your_score: 72,
      benchmark_score: 55,
      benchmark_label: 'FPL average',
      missed_players: [],
    })
    const { container } = render(<GwReviewTab teamId="12345" settledGws={[33, 34, 35]} />)
    const card = container.querySelector('[data-testid="gw-review-benchmark-card"]')
    expect(card!.textContent).toContain('FPL average')
    expect(card!.textContent).toContain(String(55))  // benchmark_score value shown
    // Delta sub-label must be absent
    expect(card!.textContent).not.toContain('vs you')
    expect(card!.textContent).not.toContain('on par')
  })

  it('renders Missed row when missed_players.length > 0', () => {
    withReview({
      missed_players: [
        { name: 'Saka', pts: 12 },
        { name: 'Palmer', pts: 10 },
      ],
    })
    const { container } = render(<GwReviewTab teamId="12345" settledGws={[33, 34, 35]} />)
    const row = container.querySelector('[data-testid="gw-review-missed-row"]')
    expect(row).not.toBeNull()
    expect(row!.textContent).toContain('Missed')
    expect(row!.textContent).toContain('Saka (12)')
    expect(row!.textContent).toContain('Palmer (10)')
  })

  it('Missed row is absent from DOM when missed_players.length === 0', () => {
    withReview({ missed_players: [] })
    const { container } = render(<GwReviewTab teamId="12345" settledGws={[33, 34, 35]} />)
    expect(container.querySelector('[data-testid="gw-review-missed-row"]')).toBeNull()
    // The literal label "Missed" must also be absent (so the row isn't merely hidden)
    const dataBranch = container.querySelector('[data-testid="gw-review-tab"]')
    expect(dataBranch!.textContent).not.toContain('Missed')
  })

  it('Missed row formats players as "Name (pts)" joined by ", " (3 misses)', () => {
    withReview({
      missed_players: [
        { name: 'Saka', pts: 14 },
        { name: 'Palmer', pts: 12 },
        { name: 'Foden', pts: 10 },
      ],
    })
    const { container } = render(<GwReviewTab teamId="12345" settledGws={[33, 34, 35]} />)
    const row = container.querySelector('[data-testid="gw-review-missed-row"]')
    const valueSpan = row!.querySelector('span:nth-of-type(2)')
    expect(valueSpan!.textContent).toBe('Saka (14), Palmer (12), Foden (10)')
  })
})
