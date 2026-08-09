// @vitest-environment jsdom
// UIX-01 Task 4: shell components — Sidebar, TopBar, MobileBar, MoreSheet.
// page.tsx owns all state; these tests pin the prop contracts + a11y wiring.
// UIX-01 audit: nav items are real links (?t=<id>) with SPA onClick; MoreSheet
// is a proper modal (escape, focus trap, focus return, scroll lock).
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileBar } from './MobileBar'
import { MoreSheet } from './MoreSheet'
import { GROUPS, ALL_TOOL_IDS } from '@/lib/navigation'

function sidebarLinks(container: HTMLElement): HTMLAnchorElement[] {
  const nav = container.querySelector('nav[aria-label="Primary navigation"]')!
  return Array.from(nav.querySelectorAll('a'))
}

describe('Sidebar', () => {
  it('renders all 6 group labels and all 28 tool links', () => {
    const { container } = render(<Sidebar active="gems" onSelect={() => {}} />)
    const nav = container.querySelector('nav[aria-label="Primary navigation"]')
    expect(nav).not.toBeNull()
    for (const group of GROUPS) {
      expect(nav!.textContent).toContain(group.label)
    }
    expect(sidebarLinks(container)).toHaveLength(ALL_TOOL_IDS.length) // 28
  })

  it('clicking a tool fires onSelect with its id and prevents native navigation', () => {
    const onSelect = vi.fn()
    const { container } = render(<Sidebar active="gems" onSelect={onSelect} />)
    const transfersLink = sidebarLinks(container).find((a) => a.textContent === 'Transfers')
    expect(transfersLink?.getAttribute('href')).toBe('?t=transfers')
    const navigated = fireEvent.click(transfersLink!)
    expect(onSelect).toHaveBeenCalledWith('transfers')
    expect(navigated).toBe(false) // preventDefault — SPA select, no full navigation
  })

  it('active tool gets aria-current="page" and accent-soft fill', () => {
    const { container } = render(<Sidebar active="defcon" onSelect={() => {}} />)
    const active = container.querySelector('a[aria-current="page"]')
    expect(active?.textContent).toBe('DefCon Analysis')
    expect(active?.className).toContain('bg-accent-soft')
    expect(active?.className).toContain('text-accent')
    // exactly one active
    expect(container.querySelectorAll('a[aria-current="page"]')).toHaveLength(1)
  })

  it('is desktop-only (hidden lg:flex)', () => {
    const { container } = render(<Sidebar active="gems" onSelect={() => {}} />)
    const aside = container.querySelector('aside')
    expect(aside?.className).toContain('hidden')
    expect(aside?.className).toContain('lg:flex')
    expect(aside?.className).toContain('w-[var(--sidebar-w)]')
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
  it('renders 4 group links + the More button', () => {
    const { container } = render(<MobileBar active="home" onSelect={() => {}} onMore={() => {}} />)
    const nav = container.querySelector('nav[aria-label="Mobile navigation"]')!
    const labels = Array.from(nav.querySelectorAll('a, button')).map((b) => b.textContent)
    expect(labels).toHaveLength(5)
    expect(labels.some((l) => l?.includes('Home'))).toBe(true)
    expect(labels.some((l) => l?.includes('This Week'))).toBe(true)
    expect(labels.some((l) => l?.includes('Squad'))).toBe(true)
    expect(labels.some((l) => l?.includes('Research'))).toBe(true)
    expect(labels.some((l) => l?.includes('More'))).toBe(true)
    expect(nav.querySelectorAll('a')).toHaveLength(4)
    expect(nav.querySelectorAll('button')).toHaveLength(1)
  })

  it("group links point at ?t=<first tool> and fire onSelect with the group's first tool id", () => {
    const onSelect = vi.fn()
    const { container } = render(<MobileBar active="home" onSelect={onSelect} onMore={() => {}} />)
    const nav = container.querySelector('nav[aria-label="Mobile navigation"]')!
    const researchLink = Array.from(nav.querySelectorAll('a')).find((b) => b.textContent?.includes('Research'))
    expect(researchLink?.getAttribute('href')).toBe('?t=gems')
    const navigated = fireEvent.click(researchLink!)
    expect(onSelect).toHaveBeenCalledWith('gems')
    expect(navigated).toBe(false) // preventDefault
  })

  it('More fires onMore and the active group is highlighted', () => {
    const onMore = vi.fn()
    const { container } = render(<MobileBar active="defcon" onSelect={() => {}} onMore={onMore} />)
    const nav = container.querySelector('nav[aria-label="Mobile navigation"]')!
    const moreBtn = Array.from(nav.querySelectorAll('button')).find((b) => b.textContent?.includes('More'))
    fireEvent.click(moreBtn!)
    expect(onMore).toHaveBeenCalledTimes(1)
    // defcon belongs to Research → Research link is the current one
    const current = nav.querySelector('a[aria-current="page"]')
    expect(current?.textContent).toContain('Research')
  })

  it('More is a disclosure button: aria-haspopup="dialog" + aria-expanded, never aria-current', () => {
    const { container, rerender } = render(
      <MobileBar active="wildcard" onSelect={() => {}} onMore={() => {}} moreOpen={false} />
    )
    const nav = container.querySelector('nav[aria-label="Mobile navigation"]')!
    const moreBtn = Array.from(nav.querySelectorAll('button')).find((b) => b.textContent?.includes('More'))!
    expect(moreBtn.getAttribute('aria-haspopup')).toBe('dialog')
    expect(moreBtn.getAttribute('aria-expanded')).toBe('false')
    expect(moreBtn.getAttribute('aria-current')).toBeNull()
    // still visually highlighted when a Planning/Model tool is active
    expect(moreBtn.className).toContain('text-ink')
    rerender(<MobileBar active="wildcard" onSelect={() => {}} onMore={() => {}} moreOpen />)
    expect(moreBtn.getAttribute('aria-expanded')).toBe('true')
  })

  it('MobileBar wraps the active tab icon in a volt fill pill', () => {
    const { container } = render(
      <MobileBar active="cockpit" onSelect={() => {}} onMore={() => {}} />,
    )
    // The active group's icon sits inside a bg-volt/text-on-volt pill.
    const pill = container.querySelector('.bg-volt.text-on-volt')
    expect(pill).not.toBeNull()
    // Exactly one active pill is rendered.
    expect(container.querySelectorAll('.bg-volt').length).toBe(1)
  })
})

describe('MoreSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <MoreSheet open={false} onClose={() => {}} active="home" onSelect={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('lists Planning + Model tools when open, as an aria-modal dialog', () => {
    const { container } = render(
      <MoreSheet open onClose={() => {}} active="home" onSelect={() => {}} />
    )
    const dialog = container.querySelector('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    for (const groupId of ['planning', 'model']) {
      const group = GROUPS.find((g) => g.id === groupId)!
      for (const tool of group.tools) {
        expect(dialog.textContent).toContain(tool.label)
      }
    }
    // bar groups are NOT listed
    expect(dialog.textContent).not.toContain('Gem Ratings')
  })

  it('clicking a tool link fires onSelect; backdrop fires onClose', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    const { container } = render(
      <MoreSheet open onClose={onClose} active="home" onSelect={onSelect} />
    )
    const dialog = container.querySelector('[role="dialog"]')!
    const wildcardLink = Array.from(dialog.querySelectorAll('a')).find((b) => b.textContent === 'Wildcard')
    expect(wildcardLink?.getAttribute('href')).toBe('?t=wildcard')
    const navigated = fireEvent.click(wildcardLink!)
    expect(onSelect).toHaveBeenCalledWith('wildcard')
    expect(navigated).toBe(false) // preventDefault
    fireEvent.click(container.querySelector('button[aria-label="Close menu"]')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('marks the active tool with aria-current', () => {
    const { container } = render(
      <MoreSheet open onClose={() => {}} active="accuracy" onSelect={() => {}} />
    )
    const current = container.querySelector('[role="dialog"] a[aria-current="page"]')
    expect(current?.textContent).toBe('Accuracy')
  })

  it('Escape closes the sheet', () => {
    const onClose = vi.fn()
    const { container } = render(
      <MoreSheet open onClose={onClose} active="home" onSelect={() => {}} />
    )
    fireEvent.keyDown(container.querySelector('[role="dialog"]')!, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('moves focus to the first tool link on open and returns it to the trigger on close', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    const { container, unmount } = render(
      <MoreSheet open onClose={() => {}} active="home" onSelect={() => {}} />
    )
    const firstTool = container.querySelector('[role="dialog"] a')
    expect(firstTool).not.toBeNull()
    expect(document.activeElement).toBe(firstTool)
    unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('locks body scroll while open and restores it on close', () => {
    const { unmount } = render(
      <MoreSheet open onClose={() => {}} active="home" onSelect={() => {}} />
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('Tab wraps within the sheet in both directions', () => {
    const { container } = render(
      <MoreSheet open onClose={() => {}} active="home" onSelect={() => {}} />
    )
    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
    )
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })
})
