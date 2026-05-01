'use client'

import type { LifecycleLabel } from '@/lib/lifecycle-label'

interface Config {
  bg: string
  text: string
  label: string
  title: string
}

const LABEL_MAP: Record<LifecycleLabel, Config> = {
  buy_next_week: {
    bg: 'bg-emerald-100 dark:bg-emerald-900',
    text: 'text-emerald-700 dark:text-emerald-200',
    label: 'Buy Next Week',
    title: 'Buy Next Week: hold band gem score but immediate fixture improvement incoming',
  },
  hold_one_more: {
    bg: 'bg-green-100 dark:bg-green-900',
    text: 'text-green-700 dark:text-green-300',
    label: 'Hold One More',
    title: 'Hold One More: fixtures improving over 3 GWs — gem score may recover',
  },
  sell_soon: {
    bg: 'bg-orange-100 dark:bg-orange-900',
    text: 'text-orange-700 dark:text-orange-200',
    label: 'Sell Soon',
    title: 'Sell Soon: gem score approaching sell threshold — consider timing your exit',
  },
  minutes_trap: {
    bg: 'bg-amber-100 dark:bg-amber-900',
    text: 'text-amber-800 dark:text-amber-200',
    label: 'Minutes Trap',
    title: 'Minutes Trap: expensive player with rotation risk — ownership is risky at this price',
  },
  fixture_trap: {
    bg: 'bg-amber-100 dark:bg-amber-900',
    text: 'text-amber-800 dark:text-amber-200',
    label: 'Fixture Trap',
    title: 'Fixture Trap: high-ownership player with worsening fixture run',
  },
  hold: {
    bg: 'bg-zinc-100 dark:bg-zinc-700',
    text: 'text-zinc-700 dark:text-zinc-300',
    label: 'Hold',
    title: 'Hold: gem score within acceptable range — no action needed',
  },
  sell: {
    bg: 'bg-red-100 dark:bg-red-900',
    text: 'text-red-700 dark:text-red-300',
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
