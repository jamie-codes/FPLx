// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import { CalibrationHealthIndicator } from './CalibrationHealthIndicator'
import type { AccuracyBacktest, CalibrationBucket } from '@/lib/types'

function makeBucket(bucket_mid: number, actual_rate: number, sample_n = 25): CalibrationBucket {
  return { bucket_mid, predicted_rate: bucket_mid, actual_rate, sample_n }
}

function makeMcBucket(predicted_rate: number, actual_rate: number, sample_n = 25, bucket_mid_override?: number): CalibrationBucket {
  return {
    bucket_mid: bucket_mid_override !== undefined ? bucket_mid_override : predicted_rate - 0.02,
    predicted_rate,
    actual_rate,
    sample_n,
  }
}

function makeData(overrides: Partial<AccuracyBacktest> = {}): AccuracyBacktest {
  return {
    generated_at: '2026-05-13T00:00:00Z',
    gws_covered: [32, 31, 30, 29, 28],
    summary: {} as never,
    haulters: [],
    players: [],
    calibration: {
      by_position: {
        all: [makeBucket(0.05, 0.06), makeBucket(0.15, 0.17), makeBucket(0.25, 0.28), makeBucket(0.35, 0.37)],
        '1': [],
        '2': [],
        '3': [],
        '4': [],
      },
    },
    ...overrides,
  } as AccuracyBacktest
}

describe('CalibrationHealthIndicator', () => {
  it('returns null when calibration is absent', () => {
    const data = makeData({ calibration: undefined })
    const { container } = render(<CalibrationHealthIndicator data={data} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when by_position.all is empty (pool guard hit)', () => {
    const data = makeData({
      calibration: {
        by_position: { all: [], '1': [], '2': [], '3': [], '4': [] },
      },
    })
    const { container } = render(<CalibrationHealthIndicator data={data} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders cold-start prompt without tier badge when gws_covered.length < 3', () => {
    const data = makeData({ gws_covered: [32, 31] })
    const { getByText, queryByLabelText } = render(<CalibrationHealthIndicator data={data} />)
    expect(getByText('Calibration evidence will appear after 3+ completed GWs.')).toBeTruthy()
    expect(getByText('Model health')).toBeTruthy()
    expect(queryByLabelText(/Calibration health:/)).toBeNull()
  })

  it('renders good tier when max deviation < 5pp', () => {
    // Deviations: |0.06-0.05|=0.01, |0.17-0.15|=0.02, |0.28-0.25|=0.03, |0.37-0.35|=0.02 -> max 0.03
    const data = makeData()
    const { getByText, getByLabelText } = render(<CalibrationHealthIndicator data={data} />)
    expect(getByText('good')).toBeTruthy()
    expect(getByLabelText('Calibration health: good')).toBeTruthy()
    expect(getByText('Calibration: good — predicted vs actual within 3pp across 4 deciles')).toBeTruthy()
  })

  it('renders fair tier when max deviation between 5pp and 10pp', () => {
    // max deviation = 0.08 -> N=8, tier=fair
    const data = makeData({
      calibration: {
        by_position: {
          all: [makeBucket(0.05, 0.13), makeBucket(0.15, 0.17), makeBucket(0.25, 0.28)],
          '1': [], '2': [], '3': [], '4': [],
        },
      },
    })
    const { getByText, getByLabelText } = render(<CalibrationHealthIndicator data={data} />)
    expect(getByText('fair')).toBeTruthy()
    expect(getByLabelText('Calibration health: fair')).toBeTruthy()
    expect(getByText('Calibration: fair — predicted vs actual within 8pp across 3 deciles')).toBeTruthy()
  })

  it('renders poor tier when max deviation > 10pp', () => {
    // max deviation = 0.15 -> N=15, tier=poor
    const data = makeData({
      calibration: {
        by_position: {
          all: [makeBucket(0.05, 0.20), makeBucket(0.15, 0.17)],
          '1': [], '2': [], '3': [], '4': [],
        },
      },
    })
    const { getByText, getByLabelText } = render(<CalibrationHealthIndicator data={data} />)
    expect(getByText('poor')).toBeTruthy()
    expect(getByLabelText('Calibration health: poor')).toBeTruthy()
    expect(getByText('Calibration: poor — predicted vs actual within 15pp across 2 deciles')).toBeTruthy()
  })

  it('boundary: max deviation exactly 5pp falls into fair tier (<= 0.10 branch)', () => {
    // max deviation = 0.05 -> N=5, tier=fair (D-10: good is < 5pp, not <= 5pp)
    const data = makeData({
      calibration: {
        by_position: {
          all: [makeBucket(0.05, 0.10), makeBucket(0.15, 0.15)],
          '1': [], '2': [], '3': [], '4': [],
        },
      },
    })
    const { getByText } = render(<CalibrationHealthIndicator data={data} />)
    expect(getByText('fair')).toBeTruthy()
  })

  it('boundary: max deviation exactly 10pp falls into fair tier (<= 0.10 branch)', () => {
    // max deviation = 0.10 -> N=10, tier=fair (D-10: fair is <= 10pp, poor is > 10pp)
    const data = makeData({
      calibration: {
        by_position: {
          all: [makeBucket(0.05, 0.15), makeBucket(0.15, 0.15)],
          '1': [], '2': [], '3': [], '4': [],
        },
      },
    })
    const { getByText } = render(<CalibrationHealthIndicator data={data} />)
    expect(getByText('fair')).toBeTruthy()
  })

  it('outer wrapper has role="status" for screen reader live region', () => {
    const data = makeData()
    const { getByRole } = render(<CalibrationHealthIndicator data={data} />)
    expect(getByRole('status')).toBeTruthy()
  })

  it('renders MC badge in accent when calibration_mode is mc', () => {
    const data = makeData({ summary: { calibration_mode: 'mc' } as never })
    const { getByLabelText, getByText } = render(<CalibrationHealthIndicator data={data} />)
    const badge = getByLabelText('Calibration mode: MC')
    expect(badge).toBeTruthy()
    expect(getByText('MC')).toBeTruthy()
    expect(badge.className).toContain('text-accent')
    expect(badge.className).toContain('bg-accent-soft')
  })

  it('renders Analytical badge in neutral when calibration_mode is analytical', () => {
    const data = makeData({ summary: { calibration_mode: 'analytical' } as never })
    const { getByLabelText, getByText } = render(<CalibrationHealthIndicator data={data} />)
    const badge = getByLabelText('Calibration mode: Analytical')
    expect(badge).toBeTruthy()
    expect(getByText('Analytical')).toBeTruthy()
    expect(badge.className).toContain('text-ink-muted')
    expect(badge.className).toContain('bg-surface-2')
  })

  it('mode badge absent when calibration_mode is undefined (legacy cache)', () => {
    const data = makeData({ summary: {} as never })
    const { queryByLabelText, getByText } = render(<CalibrationHealthIndicator data={data} />)
    expect(queryByLabelText(/Calibration mode:/)).toBeNull()
    // Row still renders with tier badge and sentence
    expect(getByText('good')).toBeTruthy()
  })

  it('mode badge not rendered in cold-start branch', () => {
    const data = makeData({
      gws_covered: [32, 31],
      summary: { calibration_mode: 'mc' } as never,
    })
    const { queryByLabelText, getByText } = render(<CalibrationHealthIndicator data={data} />)
    expect(queryByLabelText(/Calibration mode:/)).toBeNull()
    expect(getByText('Calibration evidence will appear after 3+ completed GWs.')).toBeTruthy()
  })

  it('maxDeviation uses predicted_rate not bucket_mid (D-11 bug fix)', () => {
    // bucket where predicted_rate=0.20, actual_rate=0.21, bucket_mid=0.05
    // deviation off predicted_rate = |0.21 - 0.20| = 0.01 → tier='good'
    // deviation off bucket_mid = |0.21 - 0.05| = 0.16 → tier='poor'
    const data = makeData({
      calibration: {
        by_position: {
          all: [makeMcBucket(0.20, 0.21, 25, 0.05)],
          '1': [], '2': [], '3': [], '4': [],
        },
      },
      summary: { calibration_mode: 'mc' } as never,
    })
    const { getByText } = render(<CalibrationHealthIndicator data={data} />)
    // Only passes if maxDeviation uses predicted_rate (0.01 → 'good')
    expect(getByText('good')).toBeTruthy()
  })
})
