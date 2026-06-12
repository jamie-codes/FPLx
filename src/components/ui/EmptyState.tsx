'use client'
// UIX-01 primitive: off-season / no-data surface.
export function EmptyState({ title, hint, icon }: {
  title: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      {icon != null && (
        <span aria-hidden className="text-ink-muted">
          {icon}
        </span>
      )}
      <p className="text-h4 font-semibold text-ink">{title}</p>
      {hint != null && <p className="text-body text-ink-muted">{hint}</p>}
    </div>
  )
}
