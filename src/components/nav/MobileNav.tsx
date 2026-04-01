'use client'

type Tab = 'gems' | 'defcon' | 'squad' | 'club-form' | 'value-gems'

const TABS = [
  { id: 'gems',       label: 'Gems' },
  { id: 'defcon',     label: 'DefCon' },
  { id: 'squad',      label: 'Squad' },
  { id: 'club-form',  label: 'Form' },
  { id: 'value-gems', label: 'Values' },
] as const satisfies ReadonlyArray<{ id: Tab; label: string }>

interface MobileNavProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  return (
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-zinc-200 nav-safe-bottom z-50"
      aria-label="Mobile navigation"
    >
      <div className="flex">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`flex-1 flex flex-col items-center justify-center min-h-[44px] py-2 text-xs font-medium cursor-pointer active:scale-95 transition-transform ${
              activeTab === tab.id ? 'text-zinc-900' : 'text-zinc-400'
            }`}
            onClick={() => onTabChange(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
