'use client'
// UIX-01 primitive: in-page secondary tabs (pill row). Roving tabindex,
// ArrowLeft/ArrowRight move selection with wrap-around.
export function Tabs<T extends string>({ items, value, onChange, size = 'md' }: {
  items: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  size?: 'sm' | 'md'
}) {
  const sizeCls = size === 'md' ? 'text-body px-3 py-1.5' : 'text-data px-2 py-1'

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const idx = items.findIndex((t) => t.id === value)
    if (idx === -1) return
    e.preventDefault()
    const delta = e.key === 'ArrowRight' ? 1 : -1
    const next = items[(idx + delta + items.length) % items.length]
    onChange(next.id)
  }

  return (
    <div role="tablist" className="flex items-center gap-1 overflow-x-auto" onKeyDown={onKeyDown}>
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={`rounded-md font-medium whitespace-nowrap transition-colors duration-150 ease-out ${sizeCls} ${
              active
                ? 'bg-accent-soft text-accent'
                : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
            }`}>
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
