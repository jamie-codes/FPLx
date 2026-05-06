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

    gws: [
      { gw: 32, haulter_count: 8, xpts_flagged: 4, xpts_hit_rate: 0.50 },
      { gw: 31, haulter_count: 6, xpts_flagged: 2, xpts_hit_rate: 0.33 },
      { gw: 30, haulter_count: 5, xpts_flagged: 1, xpts_hit_rate: 0.20 },
      { gw: 29, haulter_count: 7, xpts_flagged: 3, xpts_hit_rate: 0.43 },
      { gw: 28, haulter_count: 4, xpts_flagged: 2, xpts_hit_rate: 0.50 },
    ],
  },
  haulters: [
    { gw: 32, player_id: 1, player_name: 'Salah', actual_pts: 18, xpts_predicted: 8.2, xpts_rank: 2, xpts_flagged: true },
    { gw: 32, player_id: 2, player_name: 'Haaland', actual_pts: 12, xpts_predicted: 7.5, xpts_rank: 5, xpts_flagged: false },
  ],
  players: [
    {
      player_id: 1, player_name: 'Salah', team: 'LIV',
      gws: [
        { gw: 32, actual_pts: 18, xpts_predicted: 8.2, xpts_delta: 9.8 },
        { gw: 31, actual_pts: 2, xpts_predicted: 12.0, xpts_delta: -10.0 },
      ],
    },
    {
      player_id: 2, player_name: 'Haaland', team: 'MCI',
      gws: [
        { gw: 32, actual_pts: 1, xpts_predicted: 9.0, xpts_delta: -8.0 },
      ],
    },
  ],
}

const fixtureWithVersionsAndCalibration: AccuracyBacktest = {
  ...fixtureBacktest,
  versions: [
    {
      formula_version: 'v1.11-a',
      recorded_at: '2026-04-15T00:00:00+00:00',
      hit_rate: 0.380,
      gate_flags: { form_signal_enabled: false, xmins_v2_enabled: false, bonus_predictor_enabled: false },
    },
    {
      formula_version: 'v1.12-a',
      recorded_at: '2026-04-30T00:00:00+00:00',
      hit_rate: 0.420,
      gate_flags: { form_signal_enabled: true, xmins_v2_enabled: false, bonus_predictor_enabled: false },
    },
  ],
  calibration: {
    by_position: {
      all: [
        { bucket_mid: 0.05, predicted_rate: 0.05, actual_rate: 0.04, sample_n: 25 },
        { bucket_mid: 0.15, predicted_rate: 0.15, actual_rate: 0.12, sample_n: 25 },
        { bucket_mid: 0.25, predicted_rate: 0.25, actual_rate: 0.22, sample_n: 25 },
        { bucket_mid: 0.95, predicted_rate: 0.95, actual_rate: 0.88, sample_n: 25 },
      ],
      '1': [],
      '2': [
        { bucket_mid: 0.05, predicted_rate: 0.05, actual_rate: 0.06, sample_n: 8 },
        { bucket_mid: 0.95, predicted_rate: 0.95, actual_rate: 0.90, sample_n: 6 },
      ],
      '3': [
        { bucket_mid: 0.05, predicted_rate: 0.05, actual_rate: 0.04, sample_n: 7 },
      ],
      '4': [
        { bucket_mid: 0.95, predicted_rate: 0.95, actual_rate: 0.85, sample_n: 5 },
      ],
    },
  },
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
    expect(firstRowAfterActual).toContain('1') // actual_pts=1; \b1\b broke when CR-02 removed ZWS word boundaries
  })
})

describe('Phase 63: VersionHistoryTable + CalibrationSection', () => {
  beforeEach(() => {
    mockedUseAccuracy.mockReset()
  })

  it('VER-02: VersionHistoryTable renders heading and one row per version when data.versions present', () => {
    mockedUseAccuracy.mockReturnValue({ data: fixtureWithVersionsAndCalibration, isLoading: false, error: null } as never)
    const { getByText } = render(<AccuracyTab />)
    const heading = getByText('Model Version History')
    expect(heading).toBeTruthy()
    const table = heading.parentElement?.querySelector('table')
    expect(table).toBeTruthy()
    // 2 versions in fixture -> 2 body rows
    const bodyRows = table!.querySelectorAll('tbody tr')
    expect(bodyRows.length).toBe(2)
    // Both version strings present
    expect(getByText('v1.11-a')).toBeTruthy()
    expect(getByText(/v1\.12-a/)).toBeTruthy()
  })

  it('VER-02: first version row delta is em-dash; second row delta is +4.0 percentage points', () => {
    mockedUseAccuracy.mockReturnValue({ data: fixtureWithVersionsAndCalibration, isLoading: false, error: null } as never)
    const { getByText } = render(<AccuracyTab />)
    const heading = getByText('Model Version History')
    const tbody = heading.parentElement?.querySelector('tbody')
    expect(tbody).toBeTruthy()
    const rows = tbody!.querySelectorAll('tr')
    // First row delta cell -> '—'
    expect(rows[0].textContent).toContain('—')
    // Second row delta cell -> +4.0 (from 0.380 -> 0.420 = +4.0 pp)
    expect(rows[1].textContent).toMatch(/\+4\.0/)
  })

  it('CAL-01: CalibrationSection renders heading, X-axis label, and chart container when data.calibration present', () => {
    mockedUseAccuracy.mockReturnValue({ data: fixtureWithVersionsAndCalibration, isLoading: false, error: null } as never)
    const { getByText, container } = render(<AccuracyTab />)
    expect(getByText('Calibration Reliability')).toBeTruthy()
    // chart container has data-testid="calibration-chart" or contains the legend label
    expect(getByText(/Actual haul rate/)).toBeTruthy()
    expect(getByText(/Perfect calibration/)).toBeTruthy()
    // recharts ResponsiveContainer renders an SVG (or div wrapper) inside the section
    expect(container.querySelector('[data-testid="calibration-chart"], .recharts-responsive-container')).toBeTruthy()
  })

  it('CAL-02: PositionTabSelector renders 5 pills (All/GK/DEF/MID/FWD) with All active by default', () => {
    mockedUseAccuracy.mockReturnValue({ data: fixtureWithVersionsAndCalibration, isLoading: false, error: null } as never)
    const { container } = render(<AccuracyTab />)
    const tablist = container.querySelector('[role="tablist"][aria-label="Calibration position filter"]')
    expect(tablist).toBeTruthy()
    const tabs = tablist!.querySelectorAll('[role="tab"]')
    expect(tabs.length).toBe(5)
    // First tab is "All", aria-selected="true"
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    expect(tabs[0].textContent).toBe('All')
    // Position labels in order
    const labels = Array.from(tabs).map((t) => t.textContent)
    expect(labels).toEqual(['All', 'GK', 'DEF', 'MID', 'FWD'])
    // Click GK pill -> aria-selected swaps
    fireEvent.click(tabs[1])
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
    expect(tabs[0].getAttribute('aria-selected')).toBe('false')
  })

  it('CAL-01: Insufficient-sample overlay renders when active position has zero usable buckets', () => {
    mockedUseAccuracy.mockReturnValue({ data: fixtureWithVersionsAndCalibration, isLoading: false, error: null } as never)
    const { container, getByText } = render(<AccuracyTab />)
    // Switch to GK pill — fixture has by_position['1'] === [] (zero buckets)
    const tablist = container.querySelector('[role="tablist"][aria-label="Calibration position filter"]')
    const gkTab = tablist!.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement
    fireEvent.click(gkTab)
    // Empty-state overlay copy from UI-SPEC Copywriting Contract
    expect(getByText(/Insufficient sample \(n<5\) for GK this window\./)).toBeTruthy()
  })

  it('VER-02 / CAL-01: both new sections are SUPPRESSED when fixture lacks versions and calibration (legacy-cache compat)', () => {
    mockedUseAccuracy.mockReturnValue({ data: fixtureBacktest, isLoading: false, error: null } as never)
    const { queryByText } = render(<AccuracyTab />)
    // Legacy-cache fixture has neither field — sections must not render
    expect(queryByText('Model Version History')).toBeNull()
    expect(queryByText('Calibration Reliability')).toBeNull()
  })
})
