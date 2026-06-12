'use client'
// UIX-01 primitive: in-page secondary tabs (pill row). Roving tabindex:
// ArrowLeft/ArrowRight move selection with wrap-around, Home/End jump to the
// edges, and DOM focus follows the active tab (UIX-01 audit). Pills are real
// links (?t=<id>) so middle-click/ctrl-click open in a new tab; plain click is
// intercepted for the SPA select.
import { useRef } from 'react'

export function Tabs<T extends string>({ items, value, onChange, size = 'md' }: {
  items: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  size?: 'sm' | 'md'
}) {
  const sizeCls = size === 'md' ? 'text-body px-3 py-1.5' : 'text-data px-2 py-1'
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([])

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
    <div role="tablist" className="flex items-center gap-1 overflow-x-auto" onKeyDown={onKeyDown}>
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
