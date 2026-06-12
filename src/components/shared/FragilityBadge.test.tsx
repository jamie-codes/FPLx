// Phase 93 (SENS-01): FragilityBadge — RTL component tests.
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { FragilityBadge } from './FragilityBadge'

describe('FragilityBadge — Phase 93 SENS-01', () => {
  it('renders nothing when tier is robust (empty reasons)', () => {
    const { container } = render(<FragilityBadge tier="robust" reasons={[]} />)
    expect(container.firstChild).toBeNull()
    expect(container.querySelector('[data-testid="fragility-badge"]')).toBeNull()
  })

  it('renders nothing when tier is robust even with non-empty reasons (D-07)', () => {
    const { container } = render(
      <FragilityBadge tier="robust" reasons={['start_prob < 70%']} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders warning badge for fragile tier with single reason', () => {
    const { container } = render(
      <FragilityBadge tier="fragile" reasons={['start_prob < 70%']} />
    )
    const badge = container.querySelector('[data-testid="fragility-badge"]')
    expect(badge).not.toBeNull()
    expect(badge?.textContent ?? '').toContain('no longer recommended if: start_prob < 70%')
    const cls = badge?.className ?? ''
    expect(cls).toContain('text-xs')
    expect(cls).toContain('text-warning')
    expect(cls).not.toContain('text-negative')
  })

  it('fragile tier MUST NOT include filled-pill classes (Pitfall 4)', () => {
    const { container } = render(
      <FragilityBadge tier="fragile" reasons={['harder fixture']} />
    )
    const cls = container.querySelector('[data-testid="fragility-badge"]')?.className ?? ''
    expect(cls).not.toContain('bg-')
    expect(cls).not.toContain('inline-block')
    expect(cls).not.toContain('rounded')
  })

  it('renders negative badge for knife_edge tier with multiple reasons', () => {
    const { container } = render(
      <FragilityBadge
        tier="knife_edge"
        reasons={['start_prob < 70%', 'harder fixture']}
      />
    )
    const badge = container.querySelector('[data-testid="fragility-badge"]')
    expect(badge).not.toBeNull()
    expect(badge?.textContent ?? '').toContain(
      'no longer recommended if: start_prob < 70%, harder fixture'
    )
    const cls = badge?.className ?? ''
    expect(cls).toContain('text-xs')
    expect(cls).toContain('text-negative')
    expect(cls).not.toContain('text-warning')
  })

  it('knife_edge tier MUST NOT include filled-pill classes (Pitfall 4)', () => {
    const { container } = render(
      <FragilityBadge tier="knife_edge" reasons={['news doubt', 'harder fixture']} />
    )
    const cls = container.querySelector('[data-testid="fragility-badge"]')?.className ?? ''
    expect(cls).not.toContain('bg-')
    expect(cls).not.toContain('inline-block')
    expect(cls).not.toContain('rounded')
  })

  it('aria-hidden ⚠ icon present on rendered tiers', () => {
    for (const tier of ['fragile', 'knife_edge'] as const) {
      const { container } = render(
        <FragilityBadge tier={tier} reasons={['start_prob < 70%']} />
      )
      const ariaHiddenSpan = container.querySelector('span[aria-hidden="true"]')
      expect(ariaHiddenSpan).not.toBeNull()
      expect(ariaHiddenSpan?.textContent ?? '').toContain('⚠')
    }
  })

  it('prefix "no longer recommended if:" appears exactly once per render (Pitfall 4)', () => {
    for (const tier of ['fragile', 'knife_edge'] as const) {
      const { container } = render(
        <FragilityBadge
          tier={tier}
          reasons={['start_prob < 70%', 'harder fixture', 'news doubt']}
        />
      )
      const text = container.querySelector('[data-testid="fragility-badge"]')?.textContent ?? ''
      const matches = text.match(/no longer recommended if:/g) ?? []
      expect(matches.length).toBe(1)
    }
  })
})
