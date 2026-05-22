// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/hooks/usePriceReset', () => ({
  usePriceReset: vi.fn(),
}))

import { usePriceReset } from '@/lib/hooks/usePriceReset'
import { PriceResetTab } from './PriceResetTab'

const mockUsePriceReset = usePriceReset as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

describe('PriceResetTab', () => {
  it('renders_loading_state_while_fetching', () => {
    mockUsePriceReset.mockReturnValue({ data: undefined, isLoading: true, error: null })
    render(<PriceResetTab />)
    expect(screen.getByText('Loading price reset data…')).toBeTruthy()
  })

  it('renders_error_state_on_fetch_failure', () => {
    mockUsePriceReset.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') })
    render(<PriceResetTab />)
    expect(screen.getByText('Failed to load price reset data. Check the pipeline output and refresh.')).toBeTruthy()
  })

  it('renders_empty_state_when_published_false', () => {
    mockUsePriceReset.mockReturnValue({
      data: { published: false, generated_at: '2026-05-22T00:00:00Z', players: [], value_targets: [] },
      isLoading: false,
      error: null,
    })
    render(<PriceResetTab />)
    expect(screen.getByText('Prices not yet published')).toBeTruthy()
    expect(screen.getByText('FPL typically publishes new prices in mid-to-late July')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Price Reset' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Value Targets' })).toBeNull()
  })

  it('renders_price_reset_section_with_rise_and_fall_pills', () => {
    mockUsePriceReset.mockReturnValue({
      data: {
        published: true,
        generated_at: '2026-05-22T00:00:00Z',
        players: [
          { player_id: 10, name: 'Rise Player', team: 'ARS', element_type: 3, baseline_cost: 95, current_cost: 100, delta_cost: 5 },
          { player_id: 11, name: 'Fall Player', team: 'CHE', element_type: 3, baseline_cost: 83, current_cost: 80, delta_cost: -3 },
        ],
        value_targets: [],
      },
      isLoading: false,
      error: null,
    })
    render(<PriceResetTab />)

    expect(screen.getByRole('heading', { name: 'Price Reset' })).toBeTruthy()

    const risePill = screen.getByText('+0.5m')
    expect(risePill.className).toContain('bg-green-100')

    // Unicode minus U+2212
    const fallPill = screen.getByText('−0.3m')
    expect(fallPill.className).toContain('bg-red-100')

    const mainSection = screen.getByRole('region', { name: 'Price reset analysis' })
    expect(mainSection).toBeTruthy()
  })

  it('renders_value_target_row_with_rank_label', () => {
    mockUsePriceReset.mockReturnValue({
      data: {
        published: true,
        generated_at: '2026-05-22T00:00:00Z',
        players: [],
        value_targets: [
          {
            player_id: 99,
            name: 'Salah',
            team: 'LIV',
            element_type: 3,
            baseline_cost: 130,
            current_cost: 120,
            delta_cost: -10,
            xPts_1gw: 8.2,
            position_median_xPts: 4.5,
            position_rank: 3,
            position_label: 'MID',
          },
        ],
      },
      isLoading: false,
      error: null,
    })
    render(<PriceResetTab />)

    // Metadata rendered as a single template-literal string — direct text match
    expect(screen.getByText('LIV · £12.0m · #3 MID')).toBeTruthy()

    const vtSection = screen.getByRole('region', { name: 'Value targets — price fell, xPts above median' })
    expect(vtSection).toBeTruthy()

    expect(screen.getByRole('heading', { name: 'Value Targets' })).toBeTruthy()
  })

  it('value_targets_section_omitted_when_array_empty', () => {
    mockUsePriceReset.mockReturnValue({
      data: {
        published: true,
        generated_at: '2026-05-22T00:00:00Z',
        players: [
          { player_id: 1, name: 'Some Player', team: 'TOT', element_type: 2, baseline_cost: 50, current_cost: 55, delta_cost: 5 },
        ],
        value_targets: [],
      },
      isLoading: false,
      error: null,
    })
    render(<PriceResetTab />)

    expect(screen.queryByRole('heading', { name: 'Value Targets' })).toBeNull()
  })
})
