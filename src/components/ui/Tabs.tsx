'use client'
// UIX-01 primitive: in-page secondary tabs (pill row). Roving tabindex:
// ArrowLeft/ArrowRight move selection with wrap-around, Home/End jump to the
// edges, and DOM focus follows the active tab (UIX-01 audit). Pills are real
// links (?t=<id>) so middle-click/ctrl-click open in a new tab; plain click is
// intercepted for the SPA select.
// scrollIntoViewActive (opt-in, UIX-01 audit batch 2): for scrollable pill
// rows (mobile tool row) — the active pill scrolls into view on selection and
// the row gets a right-edge fade mask as an overflow affordance.
import { useEffect, useRef } from 'react'

// Static right-edge fade — signals horizontal overflow on scrollable pill rows.
const FADE_MASK = 'linear-gradient(to right, black calc(100% - 24px), transparent)'

export function Tabs<T extends string>({ items, value, onChange, size = 'md', scrollIntoViewActive = false }: {
  items: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  size?: 'sm' | 'md'
  scrollIntoViewActive?: boolean
}) {
  const sizeCls = size === 'md' ? 'text-body px-3 py-1.5' : 'text-data px-2 py-1'
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([])

  // Keep the active pill visible when selection changes (e.g. group switch
  // lands on a pill that's scrolled out of view). Respects reduced motion.
  useEffect(() => {
    if (!scrollIntoViewActive) return
    const idx = items.findIndex((t) => t.id === value)
    if (idx === -1) return
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    tabRefs.current[idx]?.scrollIntoView?.({
      inline: 'nearest',
      block: 'nearest',
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }, [scrollIntoViewActive, value, items])

  function onKeyDown(e: React.KeyboardEvent) {
    const idx = items.findIndex((t) => t.id === value)
    if (idx === -1) return
    let next: number
    if (e.key === 'ArrowRight') next = (idx + 1) % items.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + items.length) % items.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    else return
    e.preventDefault()
    onChange(items[next].id)
    tabRefs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      className="flex items-center gap-1 overflow-x-auto"
      style={scrollIntoViewActive ? { maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK } : undefined}
      onKeyDown={onKeyDown}>
      {items.map((item, i) => {
        const active = item.id === value
        return (
          <a
            key={item.id}
            ref={(el) => { tabRefs.current[i] = el }}
            role="tab"
            href={`?t=${item.id}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={(e) => {
              e.preventDefault()
              onChange(item.id)
            }}
            className={`rounded-md font-medium whitespace-nowrap transition-colors duration-150 ease-out ${sizeCls} ${
              active
                ? 'bg-accent-soft text-accent'
                : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
            }`}>
            {item.label}
          </a>
        )
      })}
    </div>
  )
}
