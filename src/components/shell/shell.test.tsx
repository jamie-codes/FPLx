// @vitest-environment jsdom
// UIX-01 Task 4: shell components — Sidebar, TopBar, MobileBar, MoreSheet.
// page.tsx owns all state; these tests pin the prop contracts + a11y wiring.
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileBar } from './MobileBar'
import { MoreSheet } from './MoreSheet'
import { GROUPS, ALL_TOOL_IDS } from '@/lib/navigation'

function sidebarButtons(container: HTMLElement): HTMLButtonElement[] {
  const nav = container.querySelector('nav[aria-label="Primary navigation"]')!
  return Array.from(nav.querySelectorAll('button'))
}

describe('Sidebar', () => {
  it('renders all 6 group labels and all 28 tool buttons', () => {
    const { container } = render(<Sidebar active="gems" onSelect={() => {}} />)
    const nav = container.querySelector('nav[aria-label="Primary navigation"]')
    expect(nav).not.toBeNull()
    for (const group of GROUPS) {
      expect(nav!.textContent).toContain(group.label)
    }
    expect(sidebarButtons(container)).toHaveLength(ALL_TOOL_IDS.length) // 28
  })

  it('clicking a tool fires onSelect with its id', () => {
    const onSelect = vi.fn()
    const { container } = render(<Sidebar active="gems" onSelect={onSelect} />)
    const transfersBtn = sidebarButtons(container).find((b) => b.textContent === 'Transfers')
    fireEvent.click(transfersBtn!)
    expect(onSelect).toHaveBeenCalledWith('transfers')
  })

  it('active tool gets aria-current="page" and accent-soft fill', () => {
    const { container } = render(<Sidebar active="defcon" onSelect={() => {}} />)
    const active = container.querySelector('button[aria-current="page"]')
    expect(active?.textContent).toBe('DefCon Analysis')
    expect(active?.className).toContain('bg-accent-soft')
    expect(active?.className).toContain('text-accent')
    // exactly one active
    expect(container.querySelectorAll('button[aria-current="page"]')).toHaveLength(1)
  })

  it('is desktop-only (hidden lg:flex)', () => {
    const { container } = render(<Sidebar active="gems" onSelect={() => {}} />)
    const aside = container.querySelector('aside')
    expect(aside?.className).toContain('hidden')
    expect(aside?.className).toContain('lg:flex')
    expect(aside?.className).toContain('w-[220px]')
  })
})

describe('TopBar', () => {
  it('renders the children slot in the right cluster', () => {
    const { container } = render(
      <TopBar>
        <span data-testid="chrome-slot-item">bell</span>
      </TopBar>
    )
    expect(container.querySelector('[data-testid="chrome-slot-item"]')).not.toBeNull()
    expect(container.querySelector('header')?.className).toContain('sticky')
  })
})

describe('MobileBar', () => {
  it('renders 5 buttons: Home, This Week, Squad, Research, More', () => {
    const { container } = render(<MobileBar active="home" onSelect={() => {}} onMore={() => {}} />)
    const nav = container.querySelector('nav[aria-label="Mobile navigation"]')!
    const labels = Array.from(nav.querySelectorAll('button')).map((b) => b.textContent)
    expect(labels).toHaveLength(5)
    expect(labels.some((l) => l?.includes('Home'))).toBe(true)
    expect(labels.some((l) => l?.includes('This Week'))).toBe(true)
    expect(labels.some((l) => l?.includes('Squad'))).toBe(true)
    expect(labels.some((l) => l?.includes('Research'))).toBe(true)
    expect(labels.some((l) => l?.includes('More'))).toBe(true)
  })

  it("group buttons fire onSelect with the group's first tool id", () => {
    const onSelect = vi.fn()
    const { container } = render(<MobileBar active="home" onSelect={onSelect} onMore={() => {}} />)
    const nav = container.querySelector('nav[aria-label="Mobile navigation"]')!
    const researchBtn = Array.from(nav.querySelectorAll('button')).find((b) => b.textContent?.includes('Research'))
    fireEvent.click(researchBtn!)
    expect(onSelect).toHaveBeenCalledWith('gems')
  })

  it('More fires onMore and the active group is highlighted', () => {
    const onMore = vi.fn()
    const { container } = render(<MobileBar active="defcon" onSelect={() => {}} onMore={onMore} />)
    const nav = container.querySelector('nav[aria-label="Mobile navigation"]')!
    const moreBtn = Array.from(nav.querySelectorAll('button')).find((b) => b.textContent?.includes('More'))
    fireEvent.click(moreBtn!)
    expect(onMore).toHaveBeenCalledTimes(1)
    // defcon belongs to Research → Research button is the current one
    const current = nav.querySelector('button[aria-current="page"]')
    expect(current?.textContent).toContain('Research')
  })

  it('More is highlighted when a Planning or Model tool is active', () => {
    const { container } = render(<MobileBar active="wildcard" onSelect={() => {}} onMore={() => {}} />)
    const nav = container.querySelector('nav[aria-label="Mobile navigation"]')!
    const current = nav.querySelector('button[aria-current="page"]')
    expect(current?.textContent).toContain('More')
  })
})

describe('MoreSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <MoreSheet open={false} onClose={() => {}} active="home" onSelect={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('lists Planning + Model tools when open', () => {
    const { container } = render(
      <MoreSheet open onClose={() => {}} active="home" onSelect={() => {}} />
    )
    const dialog = container.querySelector('[role="dialog"]')!
    for (const groupId of ['planning', 'model']) {
      const group = GROUPS.find((g) => g.id === groupId)!
      for (const tool of group.tools) {
        expect(dialog.textContent).toContain(tool.label)
      }
    }
    // bar groups are NOT listed
    expect(dialog.textContent).not.toContain('Gem Ratings')
  })

  it('clicking a tool fires onSelect; backdrop fires onClose', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    const { container } = render(
      <MoreSheet open onClose={onClose} active="home" onSelect={onSelect} />
    )
    const dialog = container.querySelector('[role="dialog"]')!
    const wildcardBtn = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Wildcard')
    fireEvent.click(wildcardBtn!)
    expect(onSelect).toHaveBeenCalledWith('wildcard')
    fireEvent.click(container.querySelector('button[aria-label="Close menu"]')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('marks the active tool with aria-current', () => {
    const { container } = render(
      <MoreSheet open onClose={() => {}} active="accuracy" onSelect={() => {}} />
    )
    const current = container.querySelector('[role="dialog"] button[aria-current="page"]')
    expect(current?.textContent).toBe('Accuracy')
  })
})
