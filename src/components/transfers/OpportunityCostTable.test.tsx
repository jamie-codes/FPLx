// @vitest-environment jsdom
// Phase 101 GWT-01 + UX-01: column header tests for OpportunityCostTable
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { OpportunityCostTable } from './OpportunityCostTable'
import type { OCSRow } from '@/lib/opportunity-cost'

function makeRollRow(): OCSRow {
  return {
    kind: 'roll',
    label: 'Roll FT',
    transfers: [],
    xPtsGain: 0,
    xPtsGainNet: 0,
    xPtsGainPerGw: 0,
    breakEvenGws: null,
    cost: 0,
    bankAfter: 0,
    isAffordable: true,
  } as unknown as OCSRow
}

describe('OpportunityCostTable column header', () => {
  it('renders "xPts Gain (Next 1 GW)" in horizon mode with horizon=1 (singular)', () => {
    const { container } = render(<OpportunityCostTable rows={[makeRollRow()]} horizon={1} />)
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('Next 1 GW')
    expect(th?.textContent).not.toContain('Next 1 GWs')
  })

  it('renders "xPts Gain (Next 3 GWs)" in horizon mode with horizon=3 (plural)', () => {
    const { container } = render(<OpportunityCostTable rows={[makeRollRow()]} horizon={3} />)
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('Next 3 GWs')
  })

  it('renders "xPts Gain (Next 5 GWs)" in horizon mode with horizon=5 (plural)', () => {
    const { container } = render(<OpportunityCostTable rows={[makeRollRow()]} horizon={5} />)
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('Next 5 GWs')
  })

  it('renders "xPts Gain (GW33)" in GWT mode with targetGw=33', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={1} targetGw={33} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('xPts Gain (GW33)')
    expect(th?.textContent).not.toContain('Next')
  })

  it('renders "xPts Gain (GW36)" in GWT mode with targetGw=36', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={5} targetGw={36} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('xPts Gain (GW36)')
  })

  it('falls back to horizon when targetGw is undefined', () => {
    const { container } = render(
      <OpportunityCostTable rows={[makeRollRow()]} horizon={3} targetGw={undefined} />
    )
    const th = container.querySelector('thead th:nth-child(3)')
    expect(th?.textContent).toContain('Next 3 GWs')
  })
})
