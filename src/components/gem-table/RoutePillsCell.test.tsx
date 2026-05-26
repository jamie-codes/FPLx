// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RoutePillsCell } from './RoutePillsCell'
import type { RouteFlags } from '@/lib/routes'

const ALL_TRUE: RouteFlags  = { pk: true,  fk: true,  ck: true,  xg: true,  xa: true  }
const ALL_FALSE: RouteFlags = { pk: false, fk: false, ck: false, xg: false, xa: false }

describe('RoutePillsCell', () => {
  it('renders all 5 pills when all flags are true', () => {
    render(<RoutePillsCell flags={ALL_TRUE} />)
    expect(screen.getByTitle('Penalty taker')).toBeTruthy()
    expect(screen.getByTitle('Direct FK taker')).toBeTruthy()
    expect(screen.getByTitle('Corner taker')).toBeTruthy()
    expect(screen.getByTitle('Above-median xG in team')).toBeTruthy()
    expect(screen.getByTitle('Above-median xA in team')).toBeTruthy()
  })

  it('renders only a PK pill when only pk is true', () => {
    render(<RoutePillsCell flags={{ ...ALL_FALSE, pk: true }} />)
    expect(screen.getByTitle('Penalty taker')).toBeTruthy()
    expect(screen.queryByTitle('Direct FK taker')).toBeNull()
    expect(screen.queryByTitle('Corner taker')).toBeNull()
    expect(screen.queryByTitle('Above-median xG in team')).toBeNull()
    expect(screen.queryByTitle('Above-median xA in team')).toBeNull()
  })

  it('renders em-dash when all flags are false', () => {
    const { container } = render(<RoutePillsCell flags={ALL_FALSE} />)
    expect(container.textContent).toBe('—')
    // No pill spans
    expect(screen.queryByTitle('Penalty taker')).toBeNull()
  })

  it('pills render in fixed order PK → FK → CK → xG → xA in the DOM', () => {
    const { container } = render(<RoutePillsCell flags={ALL_TRUE} />)
    const pills = container.querySelectorAll('[title]')
    const titles = Array.from(pills).map(el => el.getAttribute('title'))
    expect(titles).toEqual([
      'Penalty taker',
      'Direct FK taker',
      'Corner taker',
      'Above-median xG in team',
      'Above-median xA in team',
    ])
  })

  it('PK/FK/CK pills have bg-* class (solid fill), not a border class', () => {
    const { container } = render(<RoutePillsCell flags={ALL_TRUE} />)
    const pk = container.querySelector('[title="Penalty taker"]')!
    expect(pk.className).toMatch(/bg-red-500/)
    expect(pk.className).not.toMatch(/border-/)
  })

  it('xG/xA pills have border-* class (outline), not bg-* class', () => {
    const { container } = render(<RoutePillsCell flags={ALL_TRUE} />)
    const xg = container.querySelector('[title="Above-median xG in team"]')!
    expect(xg.className).toMatch(/border-blue-500/)
    expect(xg.className).not.toMatch(/bg-[a-z]+-[0-9]+/)
  })

  it('each pill has the correct title attribute', () => {
    render(<RoutePillsCell flags={ALL_TRUE} />)
    expect(screen.getByTitle('Penalty taker').textContent).toBe('PK')
    expect(screen.getByTitle('Direct FK taker').textContent).toBe('FK')
    expect(screen.getByTitle('Corner taker').textContent).toBe('CK')
    expect(screen.getByTitle('Above-median xG in team').textContent).toBe('xG')
    expect(screen.getByTitle('Above-median xA in team').textContent).toBe('xA')
  })
})
