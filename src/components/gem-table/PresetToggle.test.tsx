import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PresetToggle } from './PresetToggle'

describe('PresetToggle', () => {
  it('renders three buttons: Default, Compact, Analysis', () => {
    render(<PresetToggle preset="default" onPresetChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Default' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Compact' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Analysis' })).toBeDefined()
  })

  it('has role="group" wrapper with aria-label="Table view preset"', () => {
    render(<PresetToggle preset="default" onPresetChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'Table view preset' })).toBeDefined()
  })

  it('active button has aria-pressed=true; inactive buttons have aria-pressed=false', () => {
    render(<PresetToggle preset="compact" onPresetChange={() => {}} />)
    const defaultBtn = screen.getByRole('button', { name: 'Default' })
    const compactBtn = screen.getByRole('button', { name: 'Compact' })
    const analysisBtn = screen.getByRole('button', { name: 'Analysis' })
    expect(defaultBtn.getAttribute('aria-pressed')).toBe('false')
    expect(compactBtn.getAttribute('aria-pressed')).toBe('true')
    expect(analysisBtn.getAttribute('aria-pressed')).toBe('false')
  })

  it('calls onPresetChange with correct preset when button is clicked', () => {
    const onPresetChange = vi.fn()
    render(<PresetToggle preset="default" onPresetChange={onPresetChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }))
    expect(onPresetChange).toHaveBeenCalledWith('compact')
  })

  it('calls onPresetChange with "analysis" when Analysis is clicked', () => {
    const onPresetChange = vi.fn()
    render(<PresetToggle preset="default" onPresetChange={onPresetChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Analysis' }))
    expect(onPresetChange).toHaveBeenCalledWith('analysis')
  })
})
