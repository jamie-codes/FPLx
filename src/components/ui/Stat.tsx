'use client'
// UIX-01 primitive: big tabular number + caption (confidence-strip style).
const INTENT_CLS = {
  neutral:  'text-ink',
  accent:   'text-accent',
  positive: 'text-positive',
  warning:  'text-warning',
  negative: 'text-negative',
} as const

export type StatIntent = keyof typeof INTENT_CLS

export function Stat({ label, value, sub, intent = 'neutral' }: {
  label: React.ReactNode
  value: React.ReactNode
  sub?: React.ReactNode
  intent?: StatIntent
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-data font-medium text-ink-muted">{label}</span>
      <span className={`text-h3 font-bold tabular ${INTENT_CLS[intent]}`}>{value}</span>
      {sub != null && <span className="text-data text-ink-muted">{sub}</span>}
    </div>
  )
}
