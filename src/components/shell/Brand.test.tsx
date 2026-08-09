// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Brand } from './Brand'

describe('Brand', () => {
  it('renders the "Fx" badge and the "FPLx" wordmark', () => {
    const { container } = render(<Brand />)
    expect(container.textContent).toContain('Fx')
    expect(container.textContent).toContain('FPLx')
  })

  it('the badge uses the fill-only volt tokens (not the theme-adaptive accent)', () => {
    const { container } = render(<Brand />)
    const badge = container.querySelector('.bg-volt')
    expect(badge).not.toBeNull()
    expect(badge!.className).toContain('text-on-volt')
    expect(badge!.textContent).toBe('Fx')
  })

  it('applies a passed className to the root', () => {
    const { container } = render(<Brand className="test-hook" />)
    expect((container.firstChild as HTMLElement).className).toContain('test-hook')
  })
})
