'use client'

export function LandscapeTip({ isMobile, isPortrait }: { isMobile: boolean; isPortrait: boolean }) {
  if (!isMobile || !isPortrait) return null
  return (
    <div className="sm:hidden rounded border border-line bg-surface-2 px-4 py-2 text-xs text-ink-muted mb-2">
      Rotate to landscape for the full table.
    </div>
  )
}
