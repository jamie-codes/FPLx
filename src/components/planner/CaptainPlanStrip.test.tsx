// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { MergedPlayer, PlanStep } from '@/lib/types'
import { CaptainPlanStrip } from './CaptainPlanStrip'

function mkP(over: Partial<MergedPlayer>): MergedPlayer {
  return { id: 0, web_name: 'P', team_short_name: 'ARS', gw_xpts: [], fixtures: [], ...over } as unknown as MergedPlayer
}
function mkStep(gw: number, positionsAfter: Record<number, number>): PlanStep {
  return { gw, positionsAfter, transfersIn: [], transfersOut: [], chip: null } as unknown as PlanStep
}

describe('CaptainPlanStrip', () => {
  it('renders a card per GW with name and xPts', () => {
    const players = new Map<number, MergedPlayer>([
      [1, mkP({ id: 1, web_name: 'Saka', team_short_name: 'ARS', gw_xpts: [7.1, 3] })],
      [2, mkP({ id: 2, web_name: 'Haaland', team_short_name: 'MCI', gw_xpts: [5, 8.4] })],
    ])
    const steps = [mkStep(1, { 1: 1, 2: 2 }), mkStep(2, { 1: 1, 2: 2 })]
    const { container } = render(<CaptainPlanStrip steps={steps} playerMap={players} />)
    expect(container.textContent).toContain('Captain plan')
    expect(container.textContent).toContain('GW1')
    expect(container.textContent).toContain('Saka')
    expect(container.textContent).toContain('7.1')
    expect(container.textContent).toContain('Haaland')
  })

  it('renders nothing when there are no steps', () => {
    const { container } = render(<CaptainPlanStrip steps={[]} playerMap={new Map()} />)
    expect(container.firstChild).toBeNull()
  })
})
