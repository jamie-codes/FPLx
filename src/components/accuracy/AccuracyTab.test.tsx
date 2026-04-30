// Phase 41: AccuracyTab — Wave 0 RED stubs (ACC-02, ACC-03, ACC-04)
// The AccuracyTab component will be created in Plan 02. These tests fail at import
// until then. This is the intentional RED state per the Nyquist rule.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

vi.mock('@/lib/hooks/useAccuracy', () => ({
  useAccuracy: vi.fn(),
}))

import { AccuracyTab } from '@/components/accuracy/AccuracyTab'
import { useAccuracy } from '@/lib/hooks/useAccuracy'
import type { AccuracyBacktest } from '@/lib/types'

const mockedUseAccuracy = vi.mocked(useAccuracy)

const fixtureBacktest: AccuracyBacktest = {
  generated_at: '2026-04-30T00:00:00Z',
  gws_covered: [32, 31, 30, 29, 28],
  summary: {
    xpts_hit_rate: 0.42,
    proj_pts_hit_rate: 0.35,
    gws: [
      { gw: 32, haulter_count: 8, xpts_flagged: 4, proj_pts_flagged: 2, xpts_hit_rate: 0.50, proj_pts_hit_rate: 0.25 },
      { gw: 31, haulter_count: 6, xpts_flagged: 2, proj_pts_flagged: 3, xpts_hit_rate: 0.33, proj_pts_hit_rate: 0.50 },
      { gw: 30, haulter_count: 5, xpts_flagged: 1, proj_pts_flagged: 1, xpts_hit_rate: 0.20, proj_pts_hit_rate: 0.20 },
      { gw: 29, haulter_count: 7, xpts_flagged: 3, proj_pts_flagged: 2, xpts_hit_rate: 0.43, proj_pts_hit_rate: 0.29 },
      { gw: 28, haulter_count: 4, xpts_flagged: 2, proj_pts_flagged: 1, xpts_hit_rate: 0.50, proj_pts_hit_rate: 0.25 },
    ],
  },
  haulters: [
    { gw: 32, player_id: 1, player_name: 'Salah', actual_pts: 18, xpts_predicted: 8.2, xpts_rank: 2, xpts_flagged: true, proj_pts_predicted: 6.1, proj_pts_rank: 4, proj_pts_flagged: false },
    { gw: 32, player_id: 2, player_name: 'Haaland', actual_pts: 12, xpts_predicted: 7.5, xpts_rank: 5, xpts_flagged: false, proj_pts_predicted: 7.0, proj_pts_rank: 6, proj_pts_flagged: false },
  ],
  players: [
    {
      player_id: 1, player_name: 'Salah', team: 'LIV',
      gws: [
        { gw: 32, actual_pts: 18, xpts_predicted: 8.2, xpts_delta: 9.8, proj_pts_predicted: 6.1, proj_pts_delta: 11.9 },
        { gw: 31, actual_pts: 2, xpts_predicted: 12.0, xpts_delta: -10.0, proj_pts_predicted: 11.0, proj_pts_delta: -9.0 },
      ],
    },
    {
      player_id: 2, player_name: 'Haaland', team: 'MCI',
      gws: [
        { gw: 32, actual_pts: 1, xpts_predicted: 9.0, xpts_delta: -8.0, proj_pts_predicted: 8.5, proj_pts_delta: -7.5 },
      ],
    },
  ],
}

describe('Phase 41: AccuracyTab component', () => {
  beforeEach(() => {
    mockedUseAccuracy.mockReset()
  })

  it('ACC-02: renders 5 per-GW rows plus an Overall summary row', () => {
    mockedUseAccuracy.mockReturnValue({ data: fixtureBacktest, isLoading: false, error: null } as never)
    const { container, getByText } = render(<AccuracyTab />)
    // 5 GW rows + 1 Overall row = 6 body rows in the GW summary table
    const summaryHeading = getByText('GW Accuracy Summary')
    const summaryTable = summaryHeading.parentElement?.querySelector('table')
    expect(summaryTable).toBeTruthy()
    const bodyRows = summaryTable!.querySelectorAll('tbody tr')
    expect(bodyRows.length).toBe(6)
    expect(getByText('Overall')).toBeTruthy()
    // also assert tab heading exists
    expect(container.querySelector('section[aria-label="Projection accuracy"]')).toBeTruthy()
  })

  it('ACC-02: hit-rate badge tier classes match thresholds (HIGH ≥ 0.50, MEDIUM 0.30–0.49, LOW < 0.30)', () => {
    mockedUseAccuracy.mockReturnValue({ data: fixtureBacktest, isLoading: false, error: null } as never)
    const { container } = render(<AccuracyTab />)
    const html = container.innerHTML
    // GW32 xPts hit rate is 0.50 -> HIGH (green-100)
    expect(html).toMatch(/bg-green-100/)
    // GW31 xPts hit rate is 0.33 -> MEDIUM (amber-100)
    expect(html).toMatch(/bg-amber-100/)
    // GW30 xPts hit rate is 0.20 -> LOW (zinc-100)
    expect(html).toMatch(/bg-zinc-100/)
  })

  it('ACC-03: haulter row renders ✓ when flagged=true and ✗ when flagged=false with correct aria-label', () => {
    mockedUseAccuracy.mockReturnValue({ data: fixtureBacktest, isLoading: false, error: null } as never)
    const { container } = render(<AccuracyTab />)
    // Salah xpts_flagged=true -> ✓ with aria-label "Flagged: yes"
    expect(container.querySelector('[aria-label="Flagged: yes"]')).toBeTruthy()
    expect(container.querySelector('[aria-label="Flagged: no"]')).toBeTruthy()
  })

  it('ACC-04: default sort is xPts Δ ascending — most negative delta in first body row of the delta table', () => {
    mockedUseAccuracy.mockReturnValue({ data: fixtureBacktest, isLoading: false, error: null } as never)
    const { getByText } = render(<AccuracyTab />)
    const heading = getByText('Player Prediction Errors')
    const deltaTable = heading.parentElement?.querySelector('table')
    expect(deltaTable).toBeTruthy()
    const firstRowText = deltaTable!.querySelector('tbody tr')!.textContent ?? ''
    // most negative xPts Δ in fixture is Salah/GW31 (-10.0); next is Haaland/GW32 (-8.0)
    expect(firstRowText).toContain('Salah')
    expect(firstRowText).toContain('-10.0')
  })

  it('ACC-04: clicking xPts Δ header toggles sort direction; clicking a different header switches sort key', () => {
    mockedUseAccuracy.mockReturnValue({ data: fixtureBacktest, isLoading: false, error: null } as never)
    const { getByText } = render(<AccuracyTab />)
    const heading = getByText('Player Prediction Errors')
    const deltaTable = heading.parentElement?.querySelector('table') as HTMLTableElement
    // First click on already-active xPts Δ header flips to desc -> most positive first
    const xptsDeltaHeader = Array.from(deltaTable.querySelectorAll('th')).find(th => th.textContent?.includes('xPts Δ'))!
    fireEvent.click(xptsDeltaHeader)
    const firstRowAfterDesc = deltaTable.querySelector('tbody tr')!.textContent ?? ''
    // most positive xPts Δ is Salah/GW32 (+9.8)
    expect(firstRowAfterDesc).toContain('Salah')
    expect(firstRowAfterDesc).toMatch(/\+9\.8|9\.8/)
    // Click on Actual Pts header -> sortKey switches; sortDir resets to asc
    const actualPtsHeader = Array.from(deltaTable.querySelectorAll('th')).find(th => th.textContent?.includes('Actual Pts'))!
    fireEvent.click(actualPtsHeader)
    const firstRowAfterActual = deltaTable.querySelector('tbody tr')!.textContent ?? ''
    // smallest actual_pts in fixture is Haaland/GW32 (1)
    expect(firstRowAfterActual).toContain('Haaland')
    expect(firstRowAfterActual).toMatch(/\b1\b/)
  })
})
