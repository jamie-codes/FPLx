// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BonusEvCell } from './BonusEvCell'

describe('BonusEvCell', () => {
  it('learned source renders value to 2dp with text-zinc-100', () => {
    const { container } = render(<BonusEvCell value={0.72} source="learned" />)
    const span = container.querySelector('span')!
    expect(span.textContent).toBe('0.72')
    expect(span.className).toContain('text-zinc-100')
    expect(span.className).not.toContain('text-zinc-500')
  })

  it('flat_default source renders value with text-zinc-500 (muted)', () => {
    const { container } = render(<BonusEvCell value={0.70} source="flat_default" />)
    const span = container.querySelector('span')!
    expect(span.textContent).toBe('0.70')
    expect(span.className).toContain('text-zinc-500')
    expect(span.className).not.toContain('text-zinc-100')
  })

  it('null value renders em-dash regardless of source', () => {
    const { container } = render(<BonusEvCell value={null} source="learned" />)
    expect(container.textContent).toBe('—')
  })

  it('undefined value renders em-dash', () => {
    const { container } = render(<BonusEvCell value={undefined} source={undefined} />)
    expect(container.textContent).toBe('—')
  })

  it('null source treated as learned (text-zinc-100)', () => {
    const { container } = render(<BonusEvCell value={0.30} source={null} />)
    const span = container.querySelector('span')!
    expect(span.textContent).toBe('0.30')
    expect(span.className).toContain('text-zinc-100')
  })
})
