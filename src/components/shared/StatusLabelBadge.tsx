// Phase 119 D-02/D-03/D-04/D-05 — shared StatusLabelBadge presentational component.
// UI-SPEC §Component Specification: StatusLabelBadge.
// Renders a colored pill for doubted (warning) and confirmed_absent (negative) only.
// Returns null for confirmed_start, unknown, and undefined — structured signal
// is only shown for availability-impacting states per D-04/D-05.
// UIX-04: stays bespoke, internals retokenized — amber→warning, red→negative.
import type { StatusLabel } from '@/lib/types'

interface Config {
  bg: string
  text: string
  label: string
  title: string
}

const BADGE_MAP: Partial<Record<StatusLabel, Config>> = {
  doubted: {
    bg: 'bg-warning-soft',
    text: 'text-warning',
    label: 'doubted',
    title: 'Doubted: lineup news indicates player may not play',
  },
  confirmed_absent: {
    bg: 'bg-negative-soft',
    text: 'text-negative',
    label: 'confirmed absent',
    title: 'Confirmed absent: lineup news indicates player will not play',
  },
}

export function StatusLabelBadge({
  statusLabel,
}: {
  statusLabel: StatusLabel | undefined
}) {
  const config = statusLabel ? BADGE_MAP[statusLabel] : undefined
  if (!config) return null
  return (
    <span
      className={`inline-block text-xs font-normal ${config.text} ${config.bg} rounded px-2 py-1`}
      title={config.title}
    >
      {config.label}
    </span>
  )
}
