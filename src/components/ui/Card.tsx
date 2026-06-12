'use client'
// UIX-01 primitive: surface-1 card, radius-8, e0 elevation (border only).
// Component tokens (tier 3) live in the PADDING_CLS constant.
const PADDING_CLS = {
  md: 'p-4',
  sm: 'p-3',
  none: '',
} as const

export type CardPadding = keyof typeof PADDING_CLS

export function Card({ title, subtitle, action, padding = 'md', children }: {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  padding?: CardPadding
  children: React.ReactNode
}) {
  const hasHeader = title != null || subtitle != null || action != null
  return (
    <section className="bg-surface-1 border border-line rounded-lg">
      {hasHeader && (
        <header
          className={`flex items-start justify-between gap-3 px-4 pt-4 ${
            padding === 'none' ? 'pb-3' : ''
          }`}>
          <div className="min-w-0">
            {title != null && (
              <h3 className="text-h4 font-semibold text-ink">{title}</h3>
            )}
            {subtitle != null && (
              <p className="text-data text-ink-muted">{subtitle}</p>
            )}
          </div>
          {action != null && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={PADDING_CLS[padding]}>{children}</div>
    </section>
  )
}
