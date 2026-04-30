// Phase 43: OptimiserPanel — Wave 0 stub tests (Plan 01)
// Full UI tests land in Plan 03 alongside the pitch implementation.
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { OptimiserPanel } from './OptimiserPanel'

describe('Phase 43: OptimiserPanel (Wave 0 stub)', () => {
  it('renders the optimiser-panel testid wrapper without errors', () => {
    const { container } = render(<OptimiserPanel teamId="" />)
    expect(container.querySelector('[data-testid="optimiser-panel"]')).not.toBeNull()
  })

  it('renders the "Optimised Lineup" heading text', () => {
    const { container } = render(<OptimiserPanel teamId="1234567" />)
    expect(container.textContent).toContain('Optimised Lineup')
  })
})
