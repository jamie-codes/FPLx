// @vitest-environment jsdom
// Phase 52 MIN-01 — MinsRiskBadge tooltip upgrade (D-09)
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MinsRiskBadge } from './MinsRiskBadge'

describe('MinsRiskBadge — Phase 52 MIN-01 tooltip upgrade', () => {
  it('renders tooltip with percentage when mins60Prob provided', () => {
    const { getByTitle } = render(
      <MinsRiskBadge minsRisk="nailed" mins60Prob={0.94} />
    )
    // D-09 format: "<Label> — <X>% chance 60+ min"
    expect(getByTitle(/94% chance 60\+ min/)).toBeTruthy()
  })

  it('uses em-dash separator with surrounding spaces (UI-SPEC § Copywriting rules)', () => {
    const { container } = render(
      <MinsRiskBadge minsRisk="nailed" mins60Prob={0.94} />
    )
    const span = container.querySelector('span')
    expect(span?.getAttribute('title')).toContain(' — 94%')
  })

  it('renders config.title only when mins60Prob absent (no regression)', () => {
    const { container } = render(<MinsRiskBadge minsRisk="nailed" />)
    const span = container.querySelector('span')
    const title = span?.getAttribute('title') ?? ''
    expect(title).not.toContain('chance 60+ min')
    // Existing nailed tooltip from BADGE_MAP — verify the original wording survives
    expect(title.length).toBeGreaterThan(0)
  })

  it('rounds 0.945 to 95 (Math.round half-up)', () => {
    const { container } = render(
      <MinsRiskBadge minsRisk="nailed" mins60Prob={0.945} />
    )
    const span = container.querySelector('span')
    expect(span?.getAttribute('title')).toContain('95% chance 60+ min')
  })

  it('renders 0% when mins60Prob is 0.0 (UI-SPEC § Format rules — do not suppress)', () => {
    const { container } = render(
      <MinsRiskBadge minsRisk="cameo" mins60Prob={0.0} />
    )
    const span = container.querySelector('span')
    expect(span?.getAttribute('title')).toContain('0% chance 60+ min')
  })

  it('renders 100% when mins60Prob is 1.0', () => {
    const { container } = render(
      <MinsRiskBadge minsRisk="nailed" mins60Prob={1.0} />
    )
    const span = container.querySelector('span')
    expect(span?.getAttribute('title')).toContain('100% chance 60+ min')
  })

  it('renders null for injured minsRisk (no regression)', () => {
    const { container } = render(
      <MinsRiskBadge minsRisk="injured" mins60Prob={0.5} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders null for undefined minsRisk (no regression)', () => {
    const { container } = render(<MinsRiskBadge minsRisk={undefined} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('MIN-01 — sub_risk badge', () => {
  it('sub_risk renders label "Sub risk" with warning text class', () => {
    const { container } = render(
      <MinsRiskBadge minsRisk="sub_risk" />
    )
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span?.textContent).toBe('Sub risk')
    expect(span?.className).toContain('text-warning')
  })

  it('sub_risk with mins60Prob=0.45 renders tooltip "Sub risk — 45% chance 60+ min"', () => {
    const { container } = render(
      <MinsRiskBadge minsRisk="sub_risk" mins60Prob={0.45} />
    )
    const span = container.querySelector('span')
    expect(span?.getAttribute('title')).toBe('Sub risk — 45% chance 60+ min')
  })

  it('existing nailed badge still works after widening type (no regression)', () => {
    const { container } = render(<MinsRiskBadge minsRisk="nailed" />)
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('Nailed')
    expect(span?.className).toContain('text-positive')
  })
})

describe('MinsRiskBadge — MIN-02 RiskChip integration', () => {
  it('renders ↻ HIGH chip when difficultyRotationRisk=high', () => {
    const { container } = render(
      <MinsRiskBadge minsRisk="nailed" difficultyRotationRisk="high" />
    )
    expect(container.textContent).toContain('↻ HIGH')
  })

  it('renders ⚠ DOUBT chip when availabilityRisk=doubt', () => {
    const { container } = render(
      <MinsRiskBadge minsRisk="nailed" availabilityRisk="doubt" />
    )
    expect(container.textContent).toContain('⚠ DOUBT')
  })

  it('does not render risk chips when both are low and fit', () => {
    const { container } = render(
      <MinsRiskBadge minsRisk="nailed" difficultyRotationRisk="low" availabilityRisk="fit" />
    )
    expect(container.textContent).not.toContain('↻')
    expect(container.textContent).not.toContain('⚠')
    expect(container.textContent).not.toContain('✕')
  })

  it('renders nothing when minsRisk is undefined and both risk signals are low/unknown', () => {
    const { container } = render(
      <MinsRiskBadge minsRisk={undefined} difficultyRotationRisk="low" availabilityRisk="unknown" />
    )
    expect(container.firstChild).toBeNull()
  })
})
