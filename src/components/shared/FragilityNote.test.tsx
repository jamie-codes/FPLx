// Phase 64 (SENS-02): FragilityNote — RTL component tests.
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { FragilityNote } from './FragilityNote'

describe("FragilityNote — Phase 64 SENS-02", () => {
  it('renders indicator with single reason', () => {
    const { container } = render(<FragilityNote reasons={['start_prob < 70%']} />)
    const note = container.querySelector('[data-testid="fragility-note"]')
    expect(note).not.toBeNull()
    expect(note?.textContent ?? '').toContain('no longer recommended if: start_prob < 70%')
    const cls = note?.className ?? ''
    expect(cls).toContain('text-amber-600')
    expect(cls).toContain('dark:text-amber-400')
    expect(cls).toContain('text-xs')
    expect(cls).not.toContain('bg-amber-100')
    expect(cls).not.toContain('bg-amber-900')
    expect(cls).not.toContain('inline-block')
    expect(cls).not.toContain('rounded')
  })

  it('renders nothing when empty', () => {
    const { container } = render(<FragilityNote reasons={[]} />)
    expect(container.firstChild).toBeNull()
    expect(container.querySelector('[data-testid="fragility-note"]')).toBeNull()
  })

  it('aria-hidden on warning symbol', () => {
    const { container } = render(<FragilityNote reasons={['harder fixture']} />)
    const ariaHiddenSpan = container.querySelector('span[aria-hidden="true"]')
    expect(ariaHiddenSpan).not.toBeNull()
    expect(ariaHiddenSpan?.textContent ?? '').toContain('⚠')
  })

  it('multi-reason joins with comma and single prefix', () => {
    const { container } = render(
      <FragilityNote reasons={['start_prob < 70%', 'harder fixture']} />
    )
    const note = container.querySelector('[data-testid="fragility-note"]')
    const text = note?.textContent ?? ''
    expect(text).toContain('no longer recommended if: start_prob < 70%, harder fixture')
    // Pitfall 4 guard: prefix must appear exactly once
    const prefixCount = (text.match(/no longer recommended if:/g) ?? []).length
    expect(prefixCount).toBe(1)
  })
})
