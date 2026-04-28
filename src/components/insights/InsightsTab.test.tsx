// Phase 33: InsightsTab — component tests + Wave 0 stub
// Wave 0: stub created by Plan 01 to satisfy Nyquist rule.
// Wave 2 (Plan 02): component tests filled in below.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@/lib/hooks/useInsights', () => ({
  useInsights: vi.fn(),
}))

import { InsightsTab } from '@/components/insights/InsightsTab'
import { useInsights } from '@/lib/hooks/useInsights'
import type { Insight } from '@/lib/types'

const mockedUseInsights = vi.mocked(useInsights)

describe('Phase 33: InsightsTab component', () => {
  beforeEach(() => {
    mockedUseInsights.mockReset()
  })

  const fixtureInsights: Insight[] = [
    {
      id: 'def_cs_home_vs_away',
      category: 'defensive',
      statement: 'Home teams keep clean sheets in 32.5% of finished fixtures.',
      confidence_pct: 75.0,
      sample_n: 100,
      sample_total: 308,
    },
    {
      id: 'att_top_team_goal_share',
      category: 'attacking',
      statement: 'Liverpool have scored 14.2% of all PL goals this season.',
      confidence_pct: 60.0,
      sample_n: 110,
      sample_total: 770,
    },
    {
      id: 'player_buy_signal_count',
      category: 'player',
      statement: '12 of 50 regular starters carry a BUY signal.',
      confidence_pct: 24.0,
      sample_n: 12,
      sample_total: 50,
    },
    {
      id: 'cap_top3_xpts_share',
      category: 'captaincy',
      statement: 'The top 3 captaincy options account for 18.5% of available xPts this GW.',
      confidence_pct: 18.5,
      sample_n: 18,
      sample_total: 100,
    },
  ]

  it('renders all four category headings when each category has insights (INS-01, INS-03)', () => {
    mockedUseInsights.mockReturnValue({
      data: fixtureInsights,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useInsights>)
    const { container } = render(<InsightsTab />)
    expect(container.textContent).toContain('Defensive Patterns')
    expect(container.textContent).toContain('Attacking Patterns')
    expect(container.textContent).toContain('Player-Specific Patterns')
    expect(container.textContent).toContain('Captaincy Patterns')
  })

  it('renders each insight statement text (INS-01)', () => {
    mockedUseInsights.mockReturnValue({
      data: fixtureInsights,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useInsights>)
    const { container } = render(<InsightsTab />)
    expect(container.textContent).toContain('Home teams keep clean sheets in 32.5% of finished fixtures.')
    expect(container.textContent).toContain('Liverpool have scored 14.2% of all PL goals this season.')
    expect(container.textContent).toContain('12 of 50 regular starters carry a BUY signal.')
    expect(container.textContent).toContain('The top 3 captaincy options account for 18.5% of available xPts this GW.')
  })

  it('renders HIGH tier badge with green classes for confidence_pct >= 70 (INS-02)', () => {
    mockedUseInsights.mockReturnValue({
      data: [fixtureInsights[0]], // 75.0% -> HIGH
      isLoading: false,
      error: null,
    } as ReturnType<typeof useInsights>)
    const { container } = render(<InsightsTab />)
    const badge = container.querySelector('span[title]')
    expect(badge).not.toBeNull()
    expect(badge?.textContent).toBe('HIGH')
    expect(badge?.className).toContain('bg-green-100')
    expect(badge?.className).toContain('text-green-800')
    expect(badge?.className).toContain('dark:bg-green-900')
    expect(badge?.className).toContain('dark:text-green-200')
    expect(badge?.className).toContain('inline-block')
    expect(badge?.className).toContain('cursor-help')
  })

  it('renders MEDIUM tier badge with amber classes for confidence_pct in 50-69 (INS-02)', () => {
    mockedUseInsights.mockReturnValue({
      data: [fixtureInsights[1]], // 60.0% -> MEDIUM
      isLoading: false,
      error: null,
    } as ReturnType<typeof useInsights>)
    const { container } = render(<InsightsTab />)
    const badge = container.querySelector('span[title]')
    expect(badge?.textContent).toBe('MEDIUM')
    expect(badge?.className).toContain('bg-amber-100')
    expect(badge?.className).toContain('text-amber-800')
  })

  it('renders LOW tier badge with zinc classes for confidence_pct < 50 (INS-02)', () => {
    mockedUseInsights.mockReturnValue({
      data: [fixtureInsights[2]], // 24.0% -> LOW
      isLoading: false,
      error: null,
    } as ReturnType<typeof useInsights>)
    const { container } = render(<InsightsTab />)
    const badge = container.querySelector('span[title]')
    expect(badge?.textContent).toBe('LOW')
    expect(badge?.className).toContain('bg-zinc-100')
    expect(badge?.className).toContain('text-zinc-600')
    expect(badge?.className).toContain('dark:bg-zinc-800')
  })

  it('badge tooltip includes percentage and n/total fraction with em-dash (INS-02)', () => {
    mockedUseInsights.mockReturnValue({
      data: [fixtureInsights[0]],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useInsights>)
    const { container } = render(<InsightsTab />)
    const badge = container.querySelector('span[title]')
    // em-dash U+2014, not a hyphen
    expect(badge?.getAttribute('title')).toBe('True in 75.0% of fixtures — 100/308 matches')
  })

  it('renders footnote about minimum sample floor (INS-02)', () => {
    mockedUseInsights.mockReturnValue({
      data: fixtureInsights,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useInsights>)
    const { container } = render(<InsightsTab />)
    expect(container.textContent).toContain('Patterns shown only when seen in 10 or more fixtures.')
  })

  it('skips an empty category section rather than rendering a heading with no cards (INS-03 edge case)', () => {
    // Only defensive insights present — other three category headings should NOT render.
    mockedUseInsights.mockReturnValue({
      data: [fixtureInsights[0]],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useInsights>)
    const { container } = render(<InsightsTab />)
    expect(container.textContent).toContain('Defensive Patterns')
    expect(container.textContent).not.toContain('Attacking Patterns')
    expect(container.textContent).not.toContain('Player-Specific Patterns')
    expect(container.textContent).not.toContain('Captaincy Patterns')
  })

  it('renders empty-state when data is [] (INS-01)', () => {
    mockedUseInsights.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useInsights>)
    const { container } = render(<InsightsTab />)
    expect(container.textContent).toContain('No insights available yet')
    expect(container.textContent).toContain('Run the pipeline to generate pattern data for this season.')
    // Empty state must NOT render any category heading
    expect(container.textContent).not.toContain('Defensive Patterns')
  })

  it('renders loading state with locked copy and Unicode ellipsis (INS-01)', () => {
    mockedUseInsights.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useInsights>)
    const { container } = render(<InsightsTab />)
    expect(container.textContent).toContain('Loading insights…') // U+2026
    const p = container.querySelector('p')
    expect(p?.className).toContain('text-center')
    expect(p?.className).toContain('py-8')
  })

  it('renders error state with locked copy (INS-01)', () => {
    mockedUseInsights.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
    } as unknown as ReturnType<typeof useInsights>)
    const { container } = render(<InsightsTab />)
    expect(container.textContent).toContain('Failed to load insights. Check the pipeline output and refresh.')
    const p = container.querySelector('p')
    expect(p?.className).toContain('text-red-600')
  })
})

describe('Phase 33: InsightsTab — Wave 0 stub', () => {
  it('Wave 0 stub file created — replace with real tests after implementation', () => {
    expect(true).toBe(true)
  })
})
