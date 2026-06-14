// @vitest-environment jsdom
// PICK-02: tests for the PickExplain presentational component.
// Written FIRST per TDD — implementation does not exist yet.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PickExplain } from './PickExplain'
import type { PickExplanation } from '@/lib/explain-pick'

describe('PickExplain — tone classes', () => {
  it('renders each reason with a positive checkmark prefix', () => {
    const explanation: PickExplanation = {
      reasons: ['Strong goal threat (xG 0.52/90)', 'Nailed starter'],
      risks: [],
    }
    render(<PickExplain explanation={explanation} />)
    // Both reasons should be present in the DOM
    expect(screen.getByText(/Strong goal threat/)).toBeTruthy()
    expect(screen.getByText(/Nailed starter/)).toBeTruthy()
  })

  it('reason items carry text-positive class', () => {
    const explanation: PickExplanation = {
      reasons: ['Nailed starter'],
      risks: [],
    }
    const { container } = render(<PickExplain explanation={explanation} />)
    const positiveEl = container.querySelector('.text-positive')
    expect(positiveEl).toBeTruthy()
  })

  it('renders each risk with a warning prefix', () => {
    const explanation: PickExplanation = {
      reasons: ['Ranked on overall xPts'],
      risks: ['Doubtful: Touch and go', 'Rotation risk'],
    }
    render(<PickExplain explanation={explanation} />)
    expect(screen.getByText(/Doubtful: Touch and go/)).toBeTruthy()
    expect(screen.getByText(/Rotation risk/)).toBeTruthy()
  })

  it('risk items carry text-warning class', () => {
    const explanation: PickExplanation = {
      reasons: ['Ranked on overall xPts'],
      risks: ['Doubtful'],
    }
    const { container } = render(<PickExplain explanation={explanation} />)
    const warningEl = container.querySelector('.text-warning')
    expect(warningEl).toBeTruthy()
  })

  it('empty risks renders "No major flags" in muted text', () => {
    const explanation: PickExplanation = {
      reasons: ['Nailed starter'],
      risks: [],
    }
    render(<PickExplain explanation={explanation} />)
    const el = screen.getByText(/no major flags/i)
    expect(el).toBeTruthy()
    expect(el.className).toContain('text-ink-muted')
  })

  it('does NOT render "No major flags" when risks are present', () => {
    const explanation: PickExplanation = {
      reasons: ['Nailed starter'],
      risks: ['Rotation risk'],
    }
    render(<PickExplain explanation={explanation} />)
    expect(screen.queryByText(/no major flags/i)).toBeNull()
  })

  it('numbers use tabular-nums styling (text-data class or tabular class)', () => {
    const explanation: PickExplanation = {
      reasons: ['High ceiling (haul 35%)'],
      risks: [],
    }
    const { container } = render(<PickExplain explanation={explanation} />)
    // The component should use text-data which maps to tabular-nums in this design system
    const dataEl = container.querySelector('.text-data')
    expect(dataEl).toBeTruthy()
  })
})
