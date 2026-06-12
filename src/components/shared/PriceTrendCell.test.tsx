// @vitest-environment jsdom
// UIX-03 Task 2: shared price-trend cell (unifies the value-gems and
// gem-table duplicates; gem-table repoints here in Task 5).
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PriceTrendCell } from './PriceTrendCell'

describe('PriceTrendCell', () => {
  it('renders a rise as ↑ in £m with the positive token', () => {
    render(<PriceTrendCell costChangeEvent={1} costChangeStart={3} />)
    const rise = screen.getByText('↑ 0.1m')
    expect(rise.className).toContain('text-positive')
  })

  it('renders a fall as ↓ with the negative token', () => {
    render(<PriceTrendCell costChangeEvent={-2} costChangeStart={-2} />)
    const fall = screen.getByText('↓ 0.2m')
    expect(fall.className).toContain('text-negative')
  })

  it('renders an em-dash when the GW change is zero', () => {
    render(<PriceTrendCell costChangeEvent={0} costChangeStart={0} />)
    expect(screen.getByText('—').className).toContain('text-ink-muted')
  })

  it('shows the signed season total as sub-text when non-zero', () => {
    render(<PriceTrendCell costChangeEvent={1} costChangeStart={5} />)
    expect(screen.getByText('+0.5m season')).toBeTruthy()
  })

  it('shows a negative season total with a minus sign', () => {
    render(<PriceTrendCell costChangeEvent={0} costChangeStart={-4} />)
    expect(screen.getByText('-0.4m season')).toBeTruthy()
  })

  it('omits the season sub-text when the season change is zero', () => {
    render(<PriceTrendCell costChangeEvent={1} costChangeStart={0} />)
    expect(screen.queryByText(/season/)).toBeNull()
  })
})
