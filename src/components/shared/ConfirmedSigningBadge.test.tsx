// @vitest-environment jsdom
// Phase 125 WIN-02 — ConfirmedSigningBadge contract tests
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ConfirmedSigningBadge } from './ConfirmedSigningBadge'

describe('ConfirmedSigningBadge', () => {
  it('renders a span with "Confirmed Signing" text', () => {
    const { container } = render(<ConfirmedSigningBadge />)
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span?.textContent).toBe('Confirmed Signing')
  })

  it('renders with green background and text classes', () => {
    const { container } = render(<ConfirmedSigningBadge />)
    const span = container.querySelector('span')
    expect(span?.className).toContain('bg-green-100')
    expect(span?.className).toContain('dark:bg-green-900')
    expect(span?.className).toContain('text-green-800')
    expect(span?.className).toContain('dark:text-green-200')
  })

  it('renders with pill classes (inline-block, rounded, px-2, py-1, text-xs)', () => {
    const { container } = render(<ConfirmedSigningBadge />)
    const span = container.querySelector('span')
    expect(span?.className).toContain('inline-block')
    expect(span?.className).toContain('rounded')
    expect(span?.className).toContain('px-2')
    expect(span?.className).toContain('py-1')
    expect(span?.className).toContain('text-xs')
  })

  it('sets data-testid="confirmed-signing-badge"', () => {
    const { container } = render(<ConfirmedSigningBadge />)
    const span = container.querySelector('[data-testid="confirmed-signing-badge"]')
    expect(span).not.toBeNull()
  })

  it('sets title attribute when provided', () => {
    const tooltipText = 'Salah signs new deal · Sky Sports'
    const { container } = render(<ConfirmedSigningBadge title={tooltipText} />)
    const span = container.querySelector('span')
    expect(span?.getAttribute('title')).toBe(tooltipText)
  })

  it('renders without title attribute when not provided', () => {
    const { container } = render(<ConfirmedSigningBadge />)
    const span = container.querySelector('span')
    // title attribute should be absent or undefined (not an empty string that shows blank tooltip)
    expect(span?.getAttribute('title')).toBeNull()
  })

  it('renders exactly one span element', () => {
    const { container } = render(<ConfirmedSigningBadge title="Test · BBC" />)
    expect(container.querySelectorAll('span').length).toBe(1)
  })
})
