'use client'
// UIX-01 shell: 56px sticky top bar. The right cluster is a slot — page.tsx
// mounts its EXISTING chrome there (deadline banner, LastUpdated, bell, theme
// toggle); TopBar deliberately recreates nothing.
import { Brand } from './Brand'

export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 h-14 flex items-center gap-3 px-4 bg-surface-1/95 backdrop-blur border-b border-line">
      <Brand className="lg:hidden" />
      <div className="ml-auto flex items-center gap-2 min-w-0">{children}</div>
    </header>
  )
}
