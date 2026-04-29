'use client'

import { SECTIONS, type Section, type SubTab } from '@/app/page'

interface MobileNavProps {
  activeSection: Section
  activeSubTab: SubTab | null
  onSectionChange: (section: Section) => void
  onSubTabChange: (subTab: SubTab) => void
}

export function MobileNav({ activeSection, activeSubTab, onSectionChange, onSubTabChange }: MobileNavProps) {
  return (
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700 nav-safe-bottom z-50"
      aria-label="Mobile navigation"
    >
      {activeSection !== 'squad' && (() => {
        const activeSectionDef = SECTIONS.find(s => s.id === activeSection)!
        return (
          <div className="flex gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
            {activeSectionDef.subTabs.map((sub) => (
              <button
                key={sub.id}
                className={`px-3 py-1 text-xs font-medium rounded-full active:scale-95 transition-transform ${activeSubTab === sub.id ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                onClick={() => onSubTabChange(sub.id)}
                aria-current={activeSubTab === sub.id ? 'page' : undefined}
              >
                {sub.mobileLabel}
              </button>
            ))}
          </div>
        )
      })()}
      <div className="flex">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            className={`flex-1 flex flex-col items-center justify-center min-h-[44px] py-2 text-xs font-medium cursor-pointer active:scale-95 transition-transform ${activeSection === section.id ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}`}
            onClick={() => onSectionChange(section.id)}
            aria-current={activeSection === section.id ? 'page' : undefined}
          >
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
