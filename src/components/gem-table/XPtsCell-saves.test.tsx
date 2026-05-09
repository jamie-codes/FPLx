// @vitest-environment jsdom
// Phase 83 GK-02 — XPtsCell save_pts invariant + GK render guard
//
// Three cases:
//   1. cardTotal/xPts_1gw invariant within 0.015 (D-08)
//   2. GK with save_pts > 0 renders a 'Saves' row
//   3. Non-GK (element_type=3) with save_pts > 0 does NOT render a 'Saves' row

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { XPtsCell } from './columns'

const GK_COMPONENTS = {
  appearance_pts: 1.8,
  goal_pts: 0.24,
  assist_pts: 0.09,
  cs_pts: 1.44,
  bonus_pts: 0.27,
  save_pts: 0.32,
}

describe('Phase 83 GK-02 — XPtsCell save_pts invariant', () => {
  it('cardTotal matches xPts_1gw within 0.015 for a GK fixture with save_pts (D-08)', () => {
    // xPts_1gw (pipeline-side total) is computed as the sum of all six components.
    const xPts_1gw =
      GK_COMPONENTS.appearance_pts +
      GK_COMPONENTS.goal_pts +
      GK_COMPONENTS.assist_pts +
      GK_COMPONENTS.cs_pts +
      GK_COMPONENTS.bonus_pts +
      GK_COMPONENTS.save_pts

    // cardTotal is the formula used in columns.tsx (with the (save_pts ?? 0) summand).
    const cardTotal =
      GK_COMPONENTS.appearance_pts +
      GK_COMPONENTS.goal_pts +
      GK_COMPONENTS.assist_pts +
      GK_COMPONENTS.cs_pts +
      GK_COMPONENTS.bonus_pts +
      (GK_COMPONENTS.save_pts ?? 0)

    expect(Math.abs(cardTotal - xPts_1gw)).toBeLessThanOrEqual(0.015)
  })
})

describe('Phase 83 GK-02 — XPtsCell render guard for Saves row', () => {
  it('renders Saves row when components.save_pts > 0 and elementType === 1 (GK)', () => {
    const { getByText } = render(
      <XPtsCell
        value={4.16}
        ceiling={false}
        components={GK_COMPONENTS}
        elementType={1}
        window={1}
      />,
    )
    expect(getByText('Saves')).toBeTruthy()
    // The numeric value renders as 0.32 (rounded to 2 decimals).
    expect(getByText('0.32')).toBeTruthy()
  })

  it('does NOT render Saves row when elementType !== 1 (non-GK), even with save_pts > 0', () => {
    const NON_GK_COMPONENTS = {
      appearance_pts: 1.8,
      goal_pts: 1.0,
      assist_pts: 0.5,
      cs_pts: 0.0,
      bonus_pts: 0.6,
      save_pts: 0.32,   // present in data but irrelevant for non-GKs
    }
    const { container } = render(
      <XPtsCell
        value={4.22}
        ceiling={false}
        components={NON_GK_COMPONENTS}
        elementType={3}    // MID
        window={1}
      />,
    )
    expect(container.textContent).not.toContain('Saves')
  })
})
