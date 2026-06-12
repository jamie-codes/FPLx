// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VarianceBadge } from '@/components/gem-table/VarianceBadge'
import { XPtsCell } from '@/components/gem-table/columns'

describe('VarianceBadge', () => {
  // UIX-03: VarianceBadge now delegates to the Chip primitive inside an ml-1
  // wrapper span (⬆ ceiling → violet intent, = consistent → neutral intent).
  it('renders ⬆ in violet Chip when ceiling=true', () => {
    const { container } = render(<VarianceBadge ceiling={true} />)
    const outer = container.querySelector('span')
    expect(outer).not.toBeNull()
    expect(outer!.className).toContain('ml-1')
    expect(outer!.textContent).toBe('⬆')
    const chip = outer!.querySelector('span')
    expect(chip).not.toBeNull()
    const cls = chip!.className
    expect(cls).toContain('bg-violet-soft')
    expect(cls).toContain('text-violet')
    expect(cls).toContain('rounded-md')
    expect(cls).toContain('px-2')
    expect(cls).toContain('text-data')
    expect(chip!.getAttribute('title')).toMatch(/^High ceiling/)
  })

  it('renders = in neutral Chip when ceiling=false', () => {
    const { container } = render(<VarianceBadge ceiling={false} />)
    const outer = container.querySelector('span')
    expect(outer).not.toBeNull()
    expect(outer!.className).toContain('ml-1')
    expect(outer!.textContent).toBe('=')
    const chip = outer!.querySelector('span')
    expect(chip).not.toBeNull()
    const cls = chip!.className
    expect(cls).toContain('bg-surface-2')
    expect(cls).toContain('text-ink-muted')
    expect(chip!.getAttribute('title')).toMatch(/^Consistent/)
  })

  it('renders nothing when ceiling=undefined', () => {
    const { container } = render(<VarianceBadge ceiling={undefined} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('XPtsCell', () => {
  // Phase 48: XPtsCell now renders a CSS hover card instead of a native title tooltip.
  // Tests updated to verify hover card DOM structure (XPT-01 / D-03).
  it('renders value (toFixed 1), VarianceBadge ⬆, and hover card with all row labels when components + ceiling=true', () => {
    const components = { goal_pts: 1.2, assist_pts: 0.8, cs_pts: 0.4, bonus_pts: 2.1, appearance_pts: 1.8 }
    const { container } = render(
      <XPtsCell value={4.5} ceiling={true} components={components} window={1} />,
    )
    expect(screen.getByText('4.5')).toBeTruthy()
    // Variance badge ⬆ present
    const badge = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === '⬆')
    expect(badge).toBeDefined()
    // Hover card wrapper uses group/xpts and cursor-help
    const wrap = container.querySelector('.cursor-help')
    expect(wrap).not.toBeNull()
    // Hover card renders labeled rows
    expect(container.textContent).toContain('Appearance')
    expect(container.textContent).toContain('Goals')
    expect(container.textContent).toContain('Assists')
    expect(container.textContent).toContain('Clean sheet')
    expect(container.textContent).toContain('Bonus')
    expect(container.textContent).toContain('Total')
  })

  it('renders "0.0" with no badge and no hover card when value is undefined', () => {
    const { container } = render(
      <XPtsCell value={undefined} ceiling={undefined} components={undefined} window={1} />,
    )
    expect(screen.getByText('0.0')).toBeTruthy()
    // No variance badge
    expect(container.querySelectorAll('span').length).toBe(1)
    // No hover card labels
    expect(container.textContent).not.toContain('Appearance')
  })

  it('renders "0.0" with no badge and no hover card when value is exactly 0', () => {
    const { container } = render(
      <XPtsCell value={0} ceiling={true} components={{ goal_pts: 0, assist_pts: 0, cs_pts: 0, bonus_pts: 0, appearance_pts: 0 }} window={1} />,
    )
    expect(screen.getByText('0.0')).toBeTruthy()
    // Zero-value short-circuit: no badge, no hover card even when components present
    expect(container.querySelectorAll('span').length).toBe(1)
    expect(container.textContent).not.toContain('Appearance')
  })

  it('renders number + VarianceBadge but no hover card when components are undefined (3GW/5GW)', () => {
    const { container } = render(
      <XPtsCell value={12.4} ceiling={false} components={undefined} window={3} />,
    )
    expect(screen.getByText('12.4')).toBeTruthy()
    // No hover card labels
    expect(container.textContent).not.toContain('Appearance')
    const badge = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === '=')
    expect(badge).toBeDefined()
  })

  it('renders 3 GW window value with no hover card even if components passed', () => {
    // Components are spec'd to only ship for 1 GW; if a caller passes them on 3GW we still suppress the card.
    const components = { goal_pts: 1.2, assist_pts: 0.8, cs_pts: 0.4, bonus_pts: 2.1, appearance_pts: 1.8 }
    const { container } = render(
      <XPtsCell value={12.4} ceiling={true} components={components} window={3} />,
    )
    expect(container.textContent).not.toContain('Appearance')
  })

  it('hover card uses sentence case "Clean sheet" (not "Clean Sheet") as row label', () => {
    const components = { goal_pts: 1.2, assist_pts: 0.8, cs_pts: 0.4, bonus_pts: 2.1, appearance_pts: 1.8 }
    const { container } = render(
      <XPtsCell value={4.5} ceiling={true} components={components} window={1} />,
    )
    expect(container.textContent).toContain('Clean sheet')
    expect(container.textContent).not.toContain('Clean Sheet')
    expect(container.textContent).not.toContain('CS:')
  })
})
