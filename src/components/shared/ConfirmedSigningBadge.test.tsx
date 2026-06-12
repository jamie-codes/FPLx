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

  it('renders with positive-intent token classes (UIX-03: Chip positive equivalent)', () => {
    const { container } = render(<ConfirmedSigningBadge />)
    const span = container.querySelector('span')
    expect(span?.className).toContain('bg-positive-soft')
    expect(span?.className).toContain('text-positive')
    expect(span?.className).toContain('border-positive/40')
  })

  it('renders with pill classes (inline-flex, rounded-md, px-2, py-0.5, text-data)', () => {
    const { container } = render(<ConfirmedSigningBadge />)
    const span = container.querySelector('span')
    expect(span?.className).toContain('inline-flex')
    expect(span?.className).toContain('rounded-md')
    expect(span?.className).toContain('px-2')
    expect(span?.className).toContain('py-0.5')
    expect(span?.className).toContain('text-data')
  })

  it('sets data-testid="confirmed-signing-badge"', () => {
    const { container } = render(<ConfirmedSigningBadge />)
    const span = container.querySelector('[data-testid="confirmed-signing-badge"]')
    expect(span).not.toBeNull()
  })

  it('sets title attribute when tooltipText provided', () => {
    const tooltipText = 'Salah signs new deal · Sky Sports'
    const { container } = render(<ConfirmedSigningBadge tooltipText={tooltipText} />)
    const span = container.querySelector('span')
    expect(span?.getAttribute('title')).toBe(tooltipText)
  })

  it('renders without title attribute when not provided', () => {
    const { container } = render(<ConfirmedSigningBadge />)
    const span = container.querySelector('span')
    // title attribute should be absent or empty (jsdom reflects title={undefined} as "" not null)
    expect(span?.getAttribute('title')).toBeFalsy()
  })

  it('renders exactly one span element', () => {
    const { container } = render(<ConfirmedSigningBadge tooltipText="Test · BBC" />)
    expect(container.querySelectorAll('span').length).toBe(1)
  })
})
