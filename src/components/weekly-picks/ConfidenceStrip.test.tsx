// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfidenceStrip } from './ConfidenceStrip'

describe('ConfidenceStrip — PICK-01', () => {
  it('falls back to last-season constants when no honest metrics', () => {
    render(<ConfidenceStrip honest={undefined} />)
    expect(screen.getByText('5.7')).toBeTruthy()           // 5.66 rounded to 1dp
    expect(screen.getByText('~1 in 5')).toBeTruthy()
    expect(screen.getByText('60%')).toBeTruthy()
    expect(screen.getByText(/2025\/26/)).toBeTruthy()
  })
  it('falls back when honest metrics cover < 8 GWs', () => {
    render(<ConfidenceStrip honest={{ top10_mean_pts: 9.9, haul_capture_20: 0.5, captain_return_rate: 1, n_gws: 4 }} />)
    expect(screen.getByText('5.7')).toBeTruthy()
    expect(screen.queryByText('9.9')).toBeNull()
  })
  it('uses live metrics at >= 8 GWs with live caption', () => {
    render(<ConfidenceStrip honest={{ top10_mean_pts: 6.12, haul_capture_20: 0.25, captain_return_rate: 0.7, n_gws: 12 }} />)
    expect(screen.getByText('6.1')).toBeTruthy()
    expect(screen.getByText('~1 in 4')).toBeTruthy()
    expect(screen.getByText('70%')).toBeTruthy()
    expect(screen.getByText(/12 GWs/)).toBeTruthy()
  })
})
