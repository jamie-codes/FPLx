// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BonusEvCell } from './BonusEvCell'

describe('BonusEvCell', () => {
  it('learned_calibrated source renders value to 2dp with text-ink', () => {
    const { container } = render(<BonusEvCell value={0.72} source="learned_calibrated" />)
    const span = container.querySelector('span')!
    expect(span.textContent).toBe('0.72')
    expect(span.className).toContain('text-ink')
    expect(span.className).not.toContain('text-ink-muted')
  })

  it('learned_uncalibrated source renders value with text-ink', () => {
    const { container } = render(<BonusEvCell value={0.65} source="learned_uncalibrated" />)
    const span = container.querySelector('span')!
    expect(span.textContent).toBe('0.65')
    expect(span.className).toContain('text-ink')
    expect(span.className).not.toContain('text-ink-muted')
  })

  it('prior source renders value with text-ink-muted (muted)', () => {
    const { container } = render(<BonusEvCell value={0.70} source="prior" />)
    const span = container.querySelector('span')!
    expect(span.textContent).toBe('0.70')
    expect(span.className).toContain('text-ink-muted')
  })

  it('null value renders em-dash regardless of source', () => {
    const { container } = render(<BonusEvCell value={null} source="learned_calibrated" />)
    expect(container.textContent).toBe('—')
  })

  it('undefined value renders em-dash', () => {
    const { container } = render(<BonusEvCell value={undefined} source={undefined} />)
    expect(container.textContent).toBe('—')
  })

  it('null source treated as learned (text-ink)', () => {
    const { container } = render(<BonusEvCell value={0.30} source={null} />)
    const span = container.querySelector('span')!
    expect(span.textContent).toBe('0.30')
    expect(span.className).toContain('text-ink')
    expect(span.className).not.toContain('text-ink-muted')
  })
})
