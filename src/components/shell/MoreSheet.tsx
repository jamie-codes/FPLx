'use client'
// UIX-01 shell: mobile bottom sheet for the groups that don't fit the bar
// (Planning + Model). Mounted only when open; backdrop click closes; the
// .sheet-enter keyframe (globals.css) gives the 250ms translate-y entrance.
// UIX-01 audit: proper modal semantics — aria-modal, Escape closes, focus
// moves to the first tool on open and back to the trigger on close, Tab is
// trapped within the sheet, and body scroll is locked while open.
import { useEffect, useRef } from 'react'
import { GROUPS, visibleTools, type ToolId } from '@/lib/navigation'

const SHEET_GROUP_IDS = ['planning', 'model']

export function MoreSheet({ open, onClose, active, onSelect }: {
  open: boolean
  onClose: () => void
  active: ToolId
  onSelect: (t: ToolId) => void
}) {
  if (!open) return null
  // Hooks live in the panel, which only mounts while open — its effect
  // lifecycle IS the modal lifecycle (lock on mount, restore on unmount).
  return <SheetPanel onClose={onClose} active={active} onSelect={onSelect} />
}

function SheetPanel({ onClose, active, onSelect }: {
  onClose: () => void
  active: ToolId
  onSelect: (t: ToolId) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector<HTMLElement>('a[href]')?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      trigger?.focus()
    }
  }, [])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !rootRef.current) return
    // Simple trap: wrap between the first and last focusable in the overlay
    // (backdrop close button + tool links).
    const focusables = Array.from(
      rootRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
    )
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div ref={rootRef} onKeyDown={onKeyDown} className="lg:hidden fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 w-full bg-black/40"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="More tools"
        className="sheet-enter absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-xl bg-surface-1 border-t border-line shadow-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" />
        {GROUPS.filter((g) => SHEET_GROUP_IDS.includes(g.id)).map((group) => (
          <div key={group.id} className="mb-3 last:mb-0">
            <div className="flex items-center gap-1.5 px-1 py-1 text-data font-medium uppercase tracking-wide text-ink-muted">
              <group.icon size={16} strokeWidth={2} aria-hidden className="shrink-0" />
              {group.label}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {visibleTools(group).map((tool) => {
                const isActive = tool.id === active
                return (
                  <a
                    key={tool.id}
                    href={`?t=${tool.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      onSelect(tool.id)
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`min-h-[44px] flex items-center px-3 text-left text-body rounded-md transition-colors duration-150 ease-out ${
                      isActive
                        ? 'bg-accent-soft text-accent font-medium'
                        : 'text-ink hover:bg-surface-2'
                    }`}>
                    {tool.label}
                  </a>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
