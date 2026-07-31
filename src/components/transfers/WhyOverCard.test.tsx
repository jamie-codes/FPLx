// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { MergedPlayer } from '@/lib/types'
import { WhyOverCard } from './WhyOverCard'

function mk(over: Partial<MergedPlayer> = {}): MergedPlayer {
  return {
    id: 1, web_name: 'X', team_short_name: 'ARS', element_type: 3, now_cost: 80,
    selected_by_percent: '10.0', status: 'a', news: '', mins_risk: 'nailed',
    rotation_risk: false, penalties_order: null, xPts_1gw: 5, xPts_5gw: 20,
    haul_prob: 0.2, fixtures: [], xg_per90: 0.3, xa_per90: 0.2, blank_prob: 0.1,
    ...over,
  } as unknown as MergedPlayer
}

describe('WhyOverCard', () => {
  it('renders the header, a numbered reason, and the risk line', () => {
    const { container } = render(
      <WhyOverCard
        x={mk({ web_name: 'Marmoush', haul_prob: 0.28, mins_risk: 'rotation_risk' })}
        y={mk({ web_name: 'Gordon', haul_prob: 0.19 })}
      />,
    )
    expect(container.textContent).toContain('Why Marmoush over Gordon?')
    expect(container.textContent).toContain('Higher ceiling: haul 28% vs 19%')
    expect(container.textContent).toContain('Gordon is the safer floor pick')
    expect(container.textContent).toContain('01')
  })

  it('renders nothing when the comparison is empty', () => {
    const { container } = render(<WhyOverCard x={mk({ haul_prob: 0.2 })} y={mk({ haul_prob: 0.2 })} />)
    expect(container.firstChild).toBeNull()
  })
})
