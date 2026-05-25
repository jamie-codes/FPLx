// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BudgetBanner } from './BudgetBanner'

describe('BudgetBanner', () => {
  it('shows within-budget message when squadCost ≤ 1000', () => {
    render(<BudgetBanner squadCost={984} overBudget={false} overBudgetBy={0} />)
    expect(screen.getByText(/£98\.4m/)).toBeTruthy()
    expect(screen.getByText(/within budget/i)).toBeTruthy()
  })

  it('shows over-budget warning with correct amount when overBudget=true', () => {
    render(<BudgetBanner squadCost={1074} overBudget={true} overBudgetBy={74} />)
    expect(screen.getByText(/£107\.4m/)).toBeTruthy()
    expect(screen.getByText(/£7\.4m over/i)).toBeTruthy()
  })

  it('applies amber styling when over budget', () => {
    const { container } = render(
      <BudgetBanner squadCost={1074} overBudget={true} overBudgetBy={74} />
    )
    // The banner root should have an amber class
    expect(container.innerHTML).toContain('amber')
  })

  it('applies green styling when within budget', () => {
    const { container } = render(
      <BudgetBanner squadCost={984} overBudget={false} overBudgetBy={0} />
    )
    expect(container.innerHTML).toContain('green')
  })
})
