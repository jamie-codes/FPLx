'use client'
// UIX-01 shell: mobile bottom sheet for the groups that don't fit the bar
// (Planning + Model). Mounted only when open; backdrop click closes; the
// .sheet-enter keyframe (globals.css) gives the 250ms translate-y entrance.
import { GROUPS, type ToolId } from '@/lib/navigation'

const SHEET_GROUP_IDS = ['planning', 'model']

export function MoreSheet({ open, onClose, active, onSelect }: {
  open: boolean
  onClose: () => void
  active: ToolId
  onSelect: (t: ToolId) => void
}) {
  if (!open) return null
  return (
    <div className="lg:hidden fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 w-full bg-black/40"
      />
      <div
        role="dialog"
        aria-label="More tools"
        className="sheet-enter absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-xl bg-surface-1 border-t border-line shadow-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {GROUPS.filter((g) => SHEET_GROUP_IDS.includes(g.id)).map((group) => (
          <div key={group.id} className="mb-3 last:mb-0">
            <div className="px-1 py-1 text-data font-medium uppercase tracking-wide text-ink-muted">
              <span aria-hidden className="mr-1.5">{group.icon}</span>
              {group.label}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {group.tools.map((tool) => {
                const isActive = tool.id === active
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => onSelect(tool.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`min-h-[44px] px-3 text-left text-body rounded-md transition-colors duration-150 ease-out ${
                      isActive
                        ? 'bg-accent-soft text-accent font-medium'
                        : 'text-ink hover:bg-surface-2'
                    }`}>
                    {tool.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
