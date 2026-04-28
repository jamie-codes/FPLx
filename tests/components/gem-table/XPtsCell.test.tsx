// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VarianceBadge } from '@/components/gem-table/VarianceBadge'
import { XPtsCell } from '@/components/gem-table/columns'

describe('VarianceBadge', () => {
  it('renders ⬆ in violet envelope when ceiling=true', () => {
    const { container } = render(<VarianceBadge ceiling={true} />)
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span!.textContent).toBe('⬆')
    const cls = span!.className
    expect(cls).toContain('bg-violet-100')
    expect(cls).toContain('dark:bg-violet-900')
    expect(cls).toContain('text-violet-800')
    expect(cls).toContain('dark:text-violet-200')
    expect(cls).toContain('ml-1')
    expect(cls).toContain('inline-block')
    expect(cls).toContain('text-xs')
    expect(cls).toContain('font-normal')
    expect(cls).toContain('rounded')
    expect(cls).toContain('px-2')
    expect(cls).toContain('py-1')
    expect(span!.getAttribute('title')).toMatch(/^High ceiling/)
  })

  it('renders = in zinc envelope when ceiling=false', () => {
    const { container } = render(<VarianceBadge ceiling={false} />)
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span!.textContent).toBe('=')
    const cls = span!.className
    expect(cls).toContain('bg-zinc-100')
    expect(cls).toContain('dark:bg-zinc-700')
    expect(cls).toContain('text-zinc-600')
    expect(cls).toContain('dark:text-zinc-300')
    expect(cls).toContain('ml-1')
    expect(span!.getAttribute('title')).toMatch(/^Consistent/)
  })

  it('renders nothing when ceiling=undefined', () => {
    const { container } = render(<VarianceBadge ceiling={undefined} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('XPtsCell', () => {
  it('renders value (toFixed 1), VarianceBadge ⬆, and breakdown tooltip when components + ceiling=true', () => {
    const components = { goal_pts: 1.2, assist_pts: 0.8, cs_pts: 0.4, bonus_pts: 2.1 }
    const { container } = render(
      <XPtsCell value={4.5} ceiling={true} components={components} window={1} />,
    )
    expect(screen.getByText('4.5')).toBeTruthy()
    // Variance badge ⬆ present
    const badge = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === '⬆')
    expect(badge).toBeDefined()
    // Wrapping span carries the breakdown tooltip
    const wrap = container.querySelector('span[title*="xPts breakdown"]')
    expect(wrap).not.toBeNull()
    const tip = wrap!.getAttribute('title')!
    expect(tip).toContain('xPts breakdown (1 GW):')
    expect(tip).toContain('Goals: 1.20')
    expect(tip).toContain('Assists: 0.80')
    expect(tip).toContain('Clean sheet: 0.40')
    expect(tip).toContain('Bonus: 2.10')
    expect(wrap!.className).toContain('cursor-help')
  })

  it('renders "0.0" with no badge and no tooltip when value is undefined', () => {
    const { container } = render(
      <XPtsCell value={undefined} ceiling={undefined} components={undefined} window={1} />,
    )
    expect(screen.getByText('0.0')).toBeTruthy()
    // No variance badge
    expect(container.querySelectorAll('span').length).toBe(1)
    // The single span has no breakdown tooltip
    const span = container.querySelector('span')!
    expect(span.getAttribute('title')).toBeNull()
  })

  it('renders "0.0" with no badge and no tooltip when value is exactly 0', () => {
    const { container } = render(
      <XPtsCell value={0} ceiling={true} components={{ goal_pts: 0, assist_pts: 0, cs_pts: 0, bonus_pts: 0 }} window={1} />,
    )
    expect(screen.getByText('0.0')).toBeTruthy()
    // Zero-value short-circuit: no badge, no tooltip even when components present
    expect(container.querySelectorAll('span').length).toBe(1)
    const span = container.querySelector('span')!
    expect(span.getAttribute('title')).toBeNull()
  })

  it('renders number + VarianceBadge but no breakdown tooltip when components are undefined (3GW/5GW)', () => {
    const { container } = render(
      <XPtsCell value={12.4} ceiling={false} components={undefined} window={3} />,
    )
    expect(screen.getByText('12.4')).toBeTruthy()
    const wrap = container.querySelector('span[title*="xPts breakdown"]')
    expect(wrap).toBeNull()
    const badge = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === '=')
    expect(badge).toBeDefined()
  })

  it('renders 3 GW window value with no breakdown tooltip even if components passed', () => {
    // Components are spec'd to only ship for 1 GW; if a caller passes them on 3GW we still suppress the tooltip.
    const components = { goal_pts: 1.2, assist_pts: 0.8, cs_pts: 0.4, bonus_pts: 2.1 }
    const { container } = render(
      <XPtsCell value={12.4} ceiling={true} components={components} window={3} />,
    )
    const wrap = container.querySelector('span[title*="xPts breakdown"]')
    expect(wrap).toBeNull()
  })

  it('breakdown tooltip uses sentence case "Clean sheet" (not "Clean Sheet")', () => {
    const components = { goal_pts: 1.2, assist_pts: 0.8, cs_pts: 0.4, bonus_pts: 2.1 }
    const { container } = render(
      <XPtsCell value={4.5} ceiling={true} components={components} window={1} />,
    )
    const wrap = container.querySelector('span[title*="xPts breakdown"]')!
    const tip = wrap.getAttribute('title')!
    expect(tip).toContain('Clean sheet')
    expect(tip).not.toContain('Clean Sheet')
    expect(tip).not.toContain('CS:')
  })
})
