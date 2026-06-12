'use client'
// UIX-01 primitive: section heading with optional subtitle + right-side control.
export function SectionHeader({ title, subtitle, action }: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-h3 font-semibold text-ink">{title}</h2>
        {subtitle != null && <p className="text-body text-ink-muted">{subtitle}</p>}
      </div>
      {action != null && <div className="shrink-0">{action}</div>}
    </div>
  )
}
