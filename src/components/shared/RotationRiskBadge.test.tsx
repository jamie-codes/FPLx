// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RotationRiskBadge } from '@/components/shared/RotationRiskBadge'

describe('RotationRiskBadge', () => {
  it('renders the ⚡ Rotation risk label when rotationRisk=true', () => {
    const { container } = render(<RotationRiskBadge rotationRisk={true} />)
    expect(container.textContent).toContain('Rotation risk')
    expect(container.textContent).toContain('⚡')
    const span = container.querySelector('span[title]')
    expect(span).not.toBeNull()
    expect(span?.getAttribute('title')).toBe(
      'Rotation risk: cup/European fixture within 3 days of this PL fixture'
    )
  })

  it('applies warning token classes (bg-warning/10 text-warning border-warning/30)', () => {
    const { container } = render(<RotationRiskBadge rotationRisk={true} />)
    const span = container.querySelector('span[title]')
    expect(span?.className).toContain('bg-warning/10')
    expect(span?.className).toContain('text-warning')
    expect(span?.className).toContain('border-warning/30')
    expect(span?.className).toContain('rounded')
    expect(span?.className).toContain('text-xs')
  })

  it('icon span has aria-hidden="true"', () => {
    const { container } = render(<RotationRiskBadge rotationRisk={true} />)
    const iconSpan = container.querySelector('span[aria-hidden="true"]')
    expect(iconSpan).not.toBeNull()
    expect(iconSpan?.textContent).toBe('⚡')
  })

  it('returns null when rotationRisk=false', () => {
    const { container } = render(<RotationRiskBadge rotationRisk={false} />)
    expect(container.firstChild).toBeNull()
  })
})
