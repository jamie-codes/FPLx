// Phase 102 MC-01: MCDistributionBar — RTL component tests.
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MCDistributionBar } from './MCDistributionBar'

describe('MCDistributionBar — Phase 102 MC-01', () => {
  it('renders P10 label formatted to 1 decimal place', () => {
    render(<MCDistributionBar blankProb={0.1} haulProb={0.3} p10Pts={3.2} p90Pts={11.8} />)
    expect(screen.getByText('3.2')).toBeTruthy()
  })

  it('renders P90 label formatted to 1 decimal place', () => {
    render(<MCDistributionBar blankProb={0.1} haulProb={0.3} p10Pts={3.2} p90Pts={11.8} />)
    expect(screen.getByText('11.8')).toBeTruthy()
  })

  it('renders track with role=img and aria-label "MC range: {p10} to {p90} pts"', () => {
    const { container } = render(
      <MCDistributionBar blankProb={0.1} haulProb={0.3} p10Pts={3.2} p90Pts={11.8} />
    )
    const track = container.querySelector('[role="img"]')
    expect(track).not.toBeNull()
    expect(track?.getAttribute('aria-label')).toBe('MC range: 3.2 to 11.8 pts')
  })

  it('renders teal fill strip with bg-teal-500 dark:bg-teal-400 classes', () => {
    const { container } = render(
      <MCDistributionBar blankProb={0.1} haulProb={0.3} p10Pts={3.2} p90Pts={11.8} />
    )
    const fill = container.querySelector('.bg-teal-500.dark\\:bg-teal-400')
    expect(fill).not.toBeNull()
  })

  it('renders warning "Haul 42%" row when haulProb=0.42', () => {
    render(<MCDistributionBar blankProb={0.1} haulProb={0.42} p10Pts={3.2} p90Pts={11.8} />)
    const haul = screen.getByText(/Haul 42%/)
    expect(haul).toBeTruthy()
    const cls = haul.className
    expect(cls).toContain('text-warning')
  })

  it('renders amber "Haul 40%" row at boundary haulProb=0.40 (inclusive >=)', () => {
    render(<MCDistributionBar blankProb={0.1} haulProb={0.40} p10Pts={3.2} p90Pts={11.8} />)
    expect(screen.getByText(/Haul 40%/)).toBeTruthy()
  })

  it('does NOT render Haul row when haulProb=0.39 (below threshold)', () => {
    render(<MCDistributionBar blankProb={0.1} haulProb={0.39} p10Pts={3.2} p90Pts={11.8} />)
    expect(screen.queryByText(/Haul/)).toBeNull()
  })

  it('does NOT render Haul row when haulProb=0.0', () => {
    render(<MCDistributionBar blankProb={0.1} haulProb={0.0} p10Pts={3.2} p90Pts={11.8} />)
    expect(screen.queryByText(/Haul/)).toBeNull()
  })

  it('rounds haulProb to integer percent: 0.456 → "Haul 46%"', () => {
    render(<MCDistributionBar blankProb={0.1} haulProb={0.456} p10Pts={3.2} p90Pts={11.8} />)
    expect(screen.getByText(/Haul 46%/)).toBeTruthy()
  })

  it('outer wrapper has flex flex-col gap-1 w-full classes', () => {
    const { container } = render(
      <MCDistributionBar blankProb={0.1} haulProb={0.3} p10Pts={3.2} p90Pts={11.8} />
    )
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('flex')
    expect(wrapper?.className).toContain('flex-col')
    expect(wrapper?.className).toContain('gap-1')
    expect(wrapper?.className).toContain('w-full')
  })
})
