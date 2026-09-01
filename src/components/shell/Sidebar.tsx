'use client'
// UIX-01 shell: desktop-only fixed 220px sidebar — brand at top, then the 6
// nav groups as headed lists of tools. page.tsx owns the active-tool state.
// Items are real links (?t=<id>) so middle-click/ctrl-click/open-in-new-tab
// work; plain click is intercepted for the SPA select (UIX-01 audit).
import { GROUPS, visibleTools, type ToolId } from '@/lib/navigation'
import { Brand } from './Brand'
import { SidebarDeadlineCard } from './SidebarDeadlineCard'

export function Sidebar({ active, onSelect }: {
  active: ToolId
  onSelect: (t: ToolId) => void
}) {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-[var(--sidebar-w)] flex-col bg-surface-1 border-r border-line">
      <div className="px-4 pt-4 pb-2 shrink-0">
        <Brand />
      </div>
      <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto pb-4">
        {GROUPS.map((group) => (
          <div key={group.id} className="mt-3">
            <div className="flex items-center gap-1.5 px-4 py-1 text-data font-medium uppercase tracking-wide text-ink-muted">
              <group.icon size={16} strokeWidth={2} aria-hidden className="shrink-0" />
              {group.label}
            </div>
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
                  className={`block w-full text-left px-4 py-1.5 text-body border-l-2 transition-colors duration-150 ease-out ${
                    isActive
                      ? 'bg-accent-soft text-accent border-accent font-medium'
                      : 'text-ink-muted border-transparent hover:bg-surface-2 hover:text-ink'
                  }`}>
                  {tool.label}
                </a>
              )
            })}
          </div>
        ))}
      </nav>
      <SidebarDeadlineCard />
    </aside>
  )
}
