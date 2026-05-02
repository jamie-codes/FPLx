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
