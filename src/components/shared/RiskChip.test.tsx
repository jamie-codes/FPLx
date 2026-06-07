// @vitest-environment jsdom
// MIN-02: RiskChip — rotation risk + availability risk chips
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RiskChip } from './RiskChip'

describe('RiskChip', () => {
  it('renders ↻ HIGH chip when difficultyRotationRisk is high', () => {
    const { container } = render(<RiskChip difficultyRotationRisk="high" />)
    expect(container.textContent).toContain('↻ HIGH')
  })

  it('renders ↻ MED chip when difficultyRotationRisk is medium', () => {
    const { container } = render(<RiskChip difficultyRotationRisk="medium" />)
    expect(container.textContent).toContain('↻ MED')
  })

  it('renders nothing when difficultyRotationRisk is low', () => {
    const { container } = render(<RiskChip difficultyRotationRisk="low" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders ✕ OUT chip when availabilityRisk is out', () => {
    const { container } = render(<RiskChip availabilityRisk="out" />)
    expect(container.textContent).toContain('✕ OUT')
  })

  it('renders ⚠ DOUBT chip when availabilityRisk is doubt', () => {
    const { container } = render(<RiskChip availabilityRisk="doubt" />)
    expect(container.textContent).toContain('⚠ DOUBT')
  })

  it('renders nothing when both are low and unknown', () => {
    const { container } = render(
      <RiskChip difficultyRotationRisk="low" availabilityRisk="unknown" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders both chips when difficultyRotationRisk is high and availabilityRisk is out', () => {
    const { container } = render(
      <RiskChip difficultyRotationRisk="high" availabilityRisk="out" />
    )
    expect(container.textContent).toContain('↻ HIGH')
    expect(container.textContent).toContain('✕ OUT')
  })
})
