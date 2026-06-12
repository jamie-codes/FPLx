// @vitest-environment jsdom
// Phase 119 UI-01 / D-02 / D-04 / D-05 — StatusLabelBadge contract tests
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StatusLabelBadge } from './StatusLabelBadge'

describe('StatusLabelBadge', () => {
  it('returns null for undefined statusLabel', () => {
    const { container } = render(<StatusLabelBadge statusLabel={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null for confirmed_start', () => {
    const { container } = render(<StatusLabelBadge statusLabel="confirmed_start" />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null for unknown', () => {
    const { container } = render(<StatusLabelBadge statusLabel="unknown" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders warning pill with "doubted" label for doubted', () => {
    const { container } = render(<StatusLabelBadge statusLabel="doubted" />)
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span?.textContent).toBe('doubted')
    expect(span?.className).toContain('bg-warning-soft')
    expect(span?.className).toContain('text-warning')
    expect(span?.className).toContain('inline-block')
    expect(span?.className).toContain('text-xs')
    expect(span?.className).toContain('font-normal')
    expect(span?.className).toContain('rounded')
    expect(span?.className).toContain('px-2')
    expect(span?.className).toContain('py-1')
    expect(span?.getAttribute('title')).toBe('Doubted: lineup news indicates player may not play')
  })

  it('renders negative pill with "confirmed absent" label for confirmed_absent', () => {
    const { container } = render(<StatusLabelBadge statusLabel="confirmed_absent" />)
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span?.textContent).toBe('confirmed absent')
    expect(span?.className).toContain('bg-negative-soft')
    expect(span?.className).toContain('text-negative')
    expect(span?.getAttribute('title')).toBe('Confirmed absent: lineup news indicates player will not play')
  })

  it('renders exactly one span element', () => {
    const { container } = render(<StatusLabelBadge statusLabel="doubted" />)
    expect(container.querySelectorAll('span').length).toBe(1)
  })
})
