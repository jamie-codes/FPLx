// Phase 46 (CHIP-01..CHIP-02): ChipModeToggle RTL tests — RED in Wave 0.
// Wave 2 creates ChipModeToggle.tsx and turns these GREEN.
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

// Dynamic import so missing file produces import error (RED) not parse error
// Wave 2 creates the file — import becomes valid.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ChipModeToggle: any

try {
  // Will throw in Wave 0 (file does not exist)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ChipModeToggle = require('./ChipModeToggle').ChipModeToggle
} catch {
  ChipModeToggle = null
}

describe('ChipModeToggle — Wave 0 (RED)', () => {
  it('file exists and ChipModeToggle is exported', () => {
    expect(ChipModeToggle).not.toBeNull()
  })

  it('renders 4 buttons: None, Wildcard, Free Hit, Bench Boost', () => {
    if (!ChipModeToggle) throw new Error('ChipModeToggle not yet implemented')
    const onChange = vi.fn()
    const { getByTestId } = render(
      <ChipModeToggle value="none" onChange={onChange} />
    )
    expect(getByTestId('chip-toggle-none')).toBeTruthy()
    expect(getByTestId('chip-toggle-wildcard')).toBeTruthy()
    expect(getByTestId('chip-toggle-freehit')).toBeTruthy()
    expect(getByTestId('chip-toggle-benchboost')).toBeTruthy()
  })

  it('aria-pressed is true on the active button and false on others', () => {
    if (!ChipModeToggle) throw new Error('ChipModeToggle not yet implemented')
    const onChange = vi.fn()
    const { getByTestId } = render(
      <ChipModeToggle value="wildcard" onChange={onChange} />
    )
    expect(getByTestId('chip-toggle-wildcard').getAttribute('aria-pressed')).toBe('true')
    expect(getByTestId('chip-toggle-none').getAttribute('aria-pressed')).toBe('false')
    expect(getByTestId('chip-toggle-freehit').getAttribute('aria-pressed')).toBe('false')
    expect(getByTestId('chip-toggle-benchboost').getAttribute('aria-pressed')).toBe('false')
  })

  it('calls onChange with "wildcard" when Wildcard button is clicked', () => {
    if (!ChipModeToggle) throw new Error('ChipModeToggle not yet implemented')
    const onChange = vi.fn()
    const { getByTestId } = render(
      <ChipModeToggle value="none" onChange={onChange} />
    )
    fireEvent.click(getByTestId('chip-toggle-wildcard'))
    expect(onChange).toHaveBeenCalledWith('wildcard')
  })

  it('calls onChange with "free-hit" when Free Hit button is clicked', () => {
    if (!ChipModeToggle) throw new Error('ChipModeToggle not yet implemented')
    const onChange = vi.fn()
    const { getByTestId } = render(
      <ChipModeToggle value="none" onChange={onChange} />
    )
    fireEvent.click(getByTestId('chip-toggle-freehit'))
    expect(onChange).toHaveBeenCalledWith('free-hit')
  })

  it('calls onChange with "bench-boost" when Bench Boost button is clicked', () => {
    if (!ChipModeToggle) throw new Error('ChipModeToggle not yet implemented')
    const onChange = vi.fn()
    const { getByTestId } = render(
      <ChipModeToggle value="none" onChange={onChange} />
    )
    fireEvent.click(getByTestId('chip-toggle-benchboost'))
    expect(onChange).toHaveBeenCalledWith('bench-boost')
  })

  it('has role="group" wrapper with aria-label="Chip mode"', () => {
    if (!ChipModeToggle) throw new Error('ChipModeToggle not yet implemented')
    const onChange = vi.fn()
    const { container } = render(
      <ChipModeToggle value="none" onChange={onChange} />
    )
    const group = container.querySelector('[role="group"]')
    expect(group).not.toBeNull()
    expect(group!.getAttribute('aria-label')).toBe('Chip mode')
  })
})
