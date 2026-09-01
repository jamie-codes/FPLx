'use client'
// UIX-01 shell: mobile bottom tab bar — Home · This Week · Squad · Research ·
// More. Group items are real links to the group's FIRST tool (?t=<id>) so
// middle-click/open-in-new-tab work; plain click is intercepted and reports
// the first tool id via onSelect; page.tsx maps that to the group's
// remembered tool (per-group memory lives in page.tsx). More stays a button —
// it opens the MoreSheet dialog (Planning + Model groups), so it gets
// aria-haspopup/aria-expanded rather than aria-current (UIX-01 audit).
import { Ellipsis } from 'lucide-react'
import { GROUPS, groupOf, visibleTools, type ToolId } from '@/lib/navigation'

const BAR_GROUPS: { groupId: string; label: string }[] = [
  { groupId: 'home', label: 'Home' },
  { groupId: 'this-week', label: 'This Week' },
  { groupId: 'my-squad', label: 'Squad' },
  { groupId: 'research', label: 'Research' },
]
const SHEET_GROUP_IDS = ['planning', 'model']

const BTN_CLS =
  'flex-1 min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-data font-medium transition-colors duration-150 ease-out'

// §5: active tab = icon in a volt fill pill (fill + dark ink, both themes),
// label below in ink. Inactive = muted, no pill. Keeps the icon+label shape.
const ICON_PILL = 'rounded-lg p-1 transition-colors duration-150 ease-out'

export function MobileBar({ active, onSelect, onMore, moreOpen = false }: {
  active: ToolId
  onSelect: (t: ToolId) => void
  onMore: () => void
  moreOpen?: boolean
}) {
  const activeGroupId = groupOf(active).id
  const moreActive = SHEET_GROUP_IDS.includes(activeGroupId)
  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex bg-surface-1 border-t border-line pb-[env(safe-area-inset-bottom)]">
      {BAR_GROUPS.map(({ groupId, label }) => {
        const group = GROUPS.find((g) => g.id === groupId)!
        // A group's entry point must be a VISIBLE tool — landing someone on a
        // hidden one (e.g. Pre-Season) would defeat hiding it.
        const entryTool = (visibleTools(group)[0] ?? group.tools[0]).id
        const isActive = groupId === activeGroupId
        return (
          <a
            key={groupId}
            href={`?t=${entryTool}`}
            onClick={(e) => {
              e.preventDefault()
              onSelect(entryTool)
            }}
            aria-current={isActive ? 'page' : undefined}
            className={`${BTN_CLS} ${isActive ? 'text-ink' : 'text-ink-muted'}`}>
            <span className={`${ICON_PILL} ${isActive ? 'bg-volt text-on-volt' : ''}`}>
              <group.icon size={20} strokeWidth={2} aria-hidden />
            </span>
            {label}
          </a>
        )
      })}
      <button
        type="button"
        onClick={onMore}
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        className={`${BTN_CLS} ${moreActive ? 'text-ink' : 'text-ink-muted'}`}>
        <span className={`${ICON_PILL} ${moreActive ? 'bg-volt text-on-volt' : ''}`}>
          <Ellipsis size={20} strokeWidth={2} aria-hidden />
        </span>
        More
      </button>
    </nav>
  )
}
