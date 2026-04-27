'use client'

export function LandscapeTip({ isMobile, isPortrait }: { isMobile: boolean; isPortrait: boolean }) {
  if (!isMobile || !isPortrait) return null
  return (
    <div className="sm:hidden rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-xs text-zinc-600 dark:text-zinc-300 mb-2">
      Rotate to landscape for the full table.
    </div>
  )
}
