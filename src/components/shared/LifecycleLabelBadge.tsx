'use client'

import type { LifecycleLabel } from '@/lib/lifecycle-label'

interface Config {
  bg: string
  text: string
  label: string
  title: string
}

// UIX-04: stays bespoke, internals retokenized. The 7-tier ladder keeps 7
// distinct labels mapped onto semantic intents: buy_next_week→positive,
// hold_one_more→accent, hold→neutral, minutes_trap/fixture_trap/sell_soon→warning,
// sell→negative.
const LABEL_MAP: Record<LifecycleLabel, Config> = {
  buy_next_week: {
    bg: 'bg-positive-soft',
    text: 'text-positive',
    label: 'Buy Next Week',
    title: 'Buy Next Week: hold band gem score but immediate fixture improvement incoming',
  },
  hold_one_more: {
    bg: 'bg-accent-soft',
    text: 'text-accent',
    label: 'Hold One More',
    title: 'Hold One More: fixtures improving over 3 GWs — gem score may recover',
  },
  sell_soon: {
    bg: 'bg-warning-soft',
    text: 'text-warning',
    label: 'Sell Soon',
    title: 'Sell Soon: gem score approaching sell threshold — consider timing your exit',
  },
  minutes_trap: {
    bg: 'bg-warning-soft',
    text: 'text-warning',
    label: 'Minutes Trap',
    title: 'Minutes Trap: expensive player with rotation risk — ownership is risky at this price',
  },
  fixture_trap: {
    bg: 'bg-warning-soft',
    text: 'text-warning',
    label: 'Fixture Trap',
    title: 'Fixture Trap: high-ownership player with worsening fixture run',
  },
  hold: {
    bg: 'bg-surface-2',
    text: 'text-ink-muted',
    label: 'Hold',
    title: 'Hold: gem score within acceptable range — no action needed',
  },
  sell: {
    bg: 'bg-negative-soft',
    text: 'text-negative',
    label: 'Sell',
    title: 'Sell: gem score well below position average — consider replacing',
  },
}

export function LifecycleLabelBadge({ label }: { label: LifecycleLabel | null }) {
  if (!label) return null
  const config = LABEL_MAP[label]
  return (
    <span
      className={`inline-block text-xs font-normal ${config.text} ${config.bg} rounded px-2 py-1`}
      title={config.title}
    >
      {config.label}
    </span>
  )
}
