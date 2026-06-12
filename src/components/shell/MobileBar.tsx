'use client'
// UIX-01 shell: mobile bottom tab bar — Home · This Week · Squad · Research ·
// More. Group buttons report the group's FIRST tool id via onSelect; page.tsx
// maps that to the group's remembered tool (per-group memory lives in page.tsx).
// More opens the MoreSheet (Planning + Model groups).
import { GROUPS, groupOf, type ToolId } from '@/lib/navigation'

const BAR_GROUPS: { groupId: string; label: string }[] = [
  { groupId: 'home', label: 'Home' },
  { groupId: 'this-week', label: 'This Week' },
  { groupId: 'my-squad', label: 'Squad' },
  { groupId: 'research', label: 'Research' },
]
const SHEET_GROUP_IDS = ['planning', 'model']

const BTN_CLS =
  'flex-1 min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-data font-medium transition-colors duration-150 ease-out'

export function MobileBar({ active, onSelect, onMore }: {
  active: ToolId
  onSelect: (t: ToolId) => void
  onMore: () => void
}) {
  const activeGroupId = groupOf(active).id
  const moreActive = SHEET_GROUP_IDS.includes(activeGroupId)
  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex bg-surface-1 border-t border-line pb-[env(safe-area-inset-bottom)]">
      {BAR_GROUPS.map(({ groupId, label }) => {
        const group = GROUPS.find((g) => g.id === groupId)!
        const isActive = groupId === activeGroupId
        return (
          <button
            key={groupId}
            type="button"
            onClick={() => onSelect(group.tools[0].id)}
            aria-current={isActive ? 'page' : undefined}
            className={`${BTN_CLS} ${isActive ? 'text-accent' : 'text-ink-muted'}`}>
            <span aria-hidden>{group.icon}</span>
            {label}
          </button>
        )
      })}
      <button
        type="button"
        onClick={onMore}
        aria-current={moreActive ? 'page' : undefined}
        className={`${BTN_CLS} ${moreActive ? 'text-accent' : 'text-ink-muted'}`}>
        <span aria-hidden>⋯</span>
        More
      </button>
    </nav>
  )
}
