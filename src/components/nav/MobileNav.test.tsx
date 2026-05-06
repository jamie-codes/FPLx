// Phase 36: MobileNav component tests — NAV-01, NAV-02, NAV-03, NAV-04, NAV-05
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { MobileNav } from '@/components/nav/MobileNav'
import type { Section, SubTab } from '@/app/page'

function makeProps(overrides?: Partial<{ activeSection: Section; activeSubTab: SubTab | null; onSectionChange: (s: Section) => void; onSubTabChange: (s: SubTab) => void }>) {
  return {
    activeSection: 'analyse' as Section,
    activeSubTab: 'gems' as SubTab,
    onSectionChange: vi.fn(),
    onSubTabChange: vi.fn(),
    ...overrides,
  }
}

describe('Phase 36: MobileNav component', () => {
  it('renders 3 section buttons with labels Analyse, Plan, Squad in order (NAV-01)', () => {
    const { container } = render(<MobileNav {...makeProps()} />)
    const allButtons = Array.from(container.querySelectorAll('button'))
    const sectionButtons = allButtons.filter(b => ['Analyse', 'Plan', 'Squad'].includes(b.textContent ?? ''))
    expect(sectionButtons).toHaveLength(3)
    expect(sectionButtons[0].textContent).toBe('Analyse')
    expect(sectionButtons[1].textContent).toBe('Plan')
    expect(sectionButtons[2].textContent).toBe('Squad')
  })

  it('aria-current="page" is on active section button only (NAV-01)', () => {
    const { container } = render(<MobileNav {...makeProps({ activeSection: 'plan' as Section })} />)
    const allButtons = Array.from(container.querySelectorAll('button'))
    const analyseBtn = allButtons.find(b => b.textContent === 'Analyse')
    const planBtn = allButtons.find(b => b.textContent === 'Plan')
    const squadBtn = allButtons.find(b => b.textContent === 'Squad')
    expect(planBtn?.getAttribute('aria-current')).toBe('page')
    expect(analyseBtn?.getAttribute('aria-current')).not.toBe('page')
    expect(squadBtn?.getAttribute('aria-current')).not.toBe('page')
  })

  it('Analyse active: renders 4 pills with mobile labels Gems/Insights/DefCon/SP in order (NAV-02)', () => {
    const { container } = render(<MobileNav {...makeProps({ activeSection: 'analyse' as Section, activeSubTab: 'gems' as SubTab })} />)
    const allButtons = Array.from(container.querySelectorAll('button'))
    const pillButtons = allButtons.filter(b => ['Gems', 'Insights', 'DefCon', 'SP'].includes(b.textContent ?? ''))
    expect(pillButtons).toHaveLength(4)
    expect(pillButtons[0].textContent).toBe('Gems')
    expect(pillButtons[1].textContent).toBe('Insights')
    expect(pillButtons[2].textContent).toBe('DefCon')
    expect(pillButtons[3].textContent).toBe('SP')
  })

  it('active sub-tab pill has aria-current="page", inactive pills do not (NAV-02)', () => {
    const { container } = render(<MobileNav {...makeProps({ activeSection: 'analyse' as Section, activeSubTab: 'insights' as SubTab })} />)
    const allButtons = Array.from(container.querySelectorAll('button'))
    const insightsBtn = allButtons.find(b => b.textContent === 'Insights')
    const gemsBtn = allButtons.find(b => b.textContent === 'Gems')
    expect(insightsBtn?.getAttribute('aria-current')).toBe('page')
    expect(gemsBtn?.getAttribute('aria-current')).not.toBe('page')
  })

  it('Plan active: renders 3 pills with mobile labels Planner/Form/Values in order (NAV-03)', () => {
    const { container } = render(<MobileNav {...makeProps({ activeSection: 'plan' as Section, activeSubTab: 'planner' as SubTab })} />)
    const allButtons = Array.from(container.querySelectorAll('button'))
    const pillButtons = allButtons.filter(b => ['Planner', 'Form', 'Values'].includes(b.textContent ?? ''))
    expect(pillButtons).toHaveLength(3)
    expect(pillButtons[0].textContent).toBe('Planner')
    expect(pillButtons[1].textContent).toBe('Form')
    expect(pillButtons[2].textContent).toBe('Values')
  })

  it('Squad active: pill row shows 5 pills Decision, Transfers, Optimiser, Lineup, Review; total 8 buttons in DOM (NAV-04 / NAV-01, updated Phase73)', () => {
    const { container } = render(
      <MobileNav {...makeProps({ activeSection: 'squad' as Section, activeSubTab: 'transfers' as SubTab })} />
    )
    const allButtons = Array.from(container.querySelectorAll('button'))
    // 3 section buttons + 5 Squad pills (Decision/Transfers/Optimiser/Lineup/Review) = 8 total
    expect(allButtons).toHaveLength(8)
    const pillButtons = allButtons.filter(b => ['Decision', 'Transfers', 'Optimiser', 'Lineup', 'Review'].includes(b.textContent ?? ''))
    expect(pillButtons).toHaveLength(5)
    expect(pillButtons[0].textContent).toBe('Decision')
    expect(pillButtons[1].textContent).toBe('Transfers')
    expect(pillButtons[2].textContent).toBe('Optimiser')
    expect(pillButtons[3].textContent).toBe('Lineup')
    expect(pillButtons[4].textContent).toBe('Review')
    // Active sub-tab pill (Transfers) has aria-current; others do not
    expect(pillButtons[0].getAttribute('aria-current')).not.toBe('page')
    expect(pillButtons[1].getAttribute('aria-current')).toBe('page')
    expect(pillButtons[2].getAttribute('aria-current')).not.toBe('page')
    expect(pillButtons[3].getAttribute('aria-current')).not.toBe('page')
    expect(pillButtons[4].getAttribute('aria-current')).not.toBe('page')
  })

  it('Phase 62: Plan active includes Rank Sim pill (MC-03)', () => {
    const { container } = render(<MobileNav {...makeProps({ activeSection: 'plan' as Section, activeSubTab: 'planner' as SubTab })} />)
    const allButtons = Array.from(container.querySelectorAll('button'))
    // Plan section has 7 sub-tabs: Planner, Manual, Routes, Rank Sim, Form, Values, Rivals
    const planPills = allButtons.filter(b => ['Planner', 'Manual', 'Routes', 'Rank Sim', 'Form', 'Values', 'Rivals'].includes(b.textContent ?? ''))
    expect(planPills).toHaveLength(7) // was 6 — Phase 62 added 'Rank Sim'
    expect(planPills.map(p => p.textContent)).toContain('Rank Sim')
  })

  it('clicking section buttons calls onSectionChange with correct id (NAV-05)', () => {
    const onSectionChange = vi.fn()
    const { container } = render(<MobileNav {...makeProps({ onSectionChange })} />)
    const allButtons = Array.from(container.querySelectorAll('button'))
    const sectionButtons = allButtons.filter(b => ['Analyse', 'Plan', 'Squad'].includes(b.textContent ?? ''))
    fireEvent.click(sectionButtons[0])
    expect(onSectionChange).toHaveBeenCalledWith('analyse')
    fireEvent.click(sectionButtons[1])
    expect(onSectionChange).toHaveBeenCalledWith('plan')
    fireEvent.click(sectionButtons[2])
    expect(onSectionChange).toHaveBeenCalledWith('squad')
  })

  it('clicking analyse pills calls onSubTabChange with correct sub-tab id (NAV-05)', () => {
    const onSubTabChange = vi.fn()
    const { container } = render(<MobileNav {...makeProps({ activeSection: 'analyse' as Section, activeSubTab: 'gems' as SubTab, onSubTabChange })} />)
    const allButtons = Array.from(container.querySelectorAll('button'))
    const pillButtons = allButtons.filter(b => ['Gems', 'Insights', 'DefCon', 'SP'].includes(b.textContent ?? ''))
    fireEvent.click(pillButtons[0])
    expect(onSubTabChange).toHaveBeenCalledWith('gems')
    fireEvent.click(pillButtons[1])
    expect(onSubTabChange).toHaveBeenCalledWith('insights')
    fireEvent.click(pillButtons[2])
    expect(onSubTabChange).toHaveBeenCalledWith('defcon')
    fireEvent.click(pillButtons[3])
    expect(onSubTabChange).toHaveBeenCalledWith('set-pieces')
  })

  it('nav wrapper has required classes and aria-label; pill row has border-b class (NAV-05)', () => {
    const { container } = render(<MobileNav {...makeProps({ activeSection: 'analyse' as Section, activeSubTab: 'gems' as SubTab })} />)
    const nav = container.querySelector('nav[aria-label="Mobile navigation"]')
    expect(nav).not.toBeNull()
    expect(nav?.className).toContain('sm:hidden')
    expect(nav?.className).toContain('fixed')
    expect(nav?.className).toContain('bottom-0')
    expect(nav?.className).toContain('nav-safe-bottom')
    expect(nav?.className).toContain('z-50')
    expect(nav?.querySelector('.border-b')).not.toBeNull()
    expect(nav?.querySelector('div.flex')).not.toBeNull()
  })
})
