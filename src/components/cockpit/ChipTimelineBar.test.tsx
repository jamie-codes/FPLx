// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ChipTimelineBar } from './ChipTimelineBar'
import type { ChipWindow } from '@/lib/types'

const win = (o: Partial<ChipWindow> = {}): ChipWindow => ({
  start_gw: 34, end_gw: 35, strength: 'play', reason: 'DGW cluster — GW34-35', ...o,
})

describe('ChipTimelineBar', () => {
  it('renders a segment per window with its GW-range label', () => {
    const { container } = render(
      <ChipTimelineBar windows={[win()]} horizonStart={30} horizonEnd={38} />,
    )
    const seg = container.querySelector('[data-window]')
    expect(seg).not.toBeNull()
    expect(container.textContent).toContain('GW34-35')
  })

  it('marks a single-GW window with just GW{n}', () => {
    const { container } = render(
      <ChipTimelineBar windows={[win({ start_gw: 33, end_gw: 33 })]} horizonStart={30} horizonEnd={38} />,
    )
    expect(container.textContent).toContain('GW33')
    expect(container.textContent).not.toContain('GW33-')
  })

  it('styles play and consider differently', () => {
    const { container } = render(
      <ChipTimelineBar
        windows={[win({ strength: 'play' }), win({ start_gw: 36, end_gw: 36, strength: 'consider' })]}
        horizonStart={30}
        horizonEnd={38}
      />,
    )
    const segs = container.querySelectorAll('[data-window]')
    expect(segs.length).toBe(2)
    expect(segs[0].getAttribute('data-strength')).toBe('play')
    expect(segs[1].getAttribute('data-strength')).toBe('consider')
  })

  it('shows an empty-state hint when there are no windows', () => {
    const { container } = render(<ChipTimelineBar windows={[]} horizonStart={30} horizonEnd={38} />)
    expect(container.querySelector('[data-window]')).toBeNull()
    expect(container.textContent).toContain('no confirmed windows yet')
  })

  it('shows the empty hint when horizon is missing (old JSON)', () => {
    const { container } = render(<ChipTimelineBar windows={[win()]} />)
    expect(container.querySelector('[data-window]')).toBeNull()
    expect(container.textContent).toContain('no confirmed windows yet')
  })
})
