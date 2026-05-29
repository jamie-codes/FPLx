import type { MinsRisk, SubRiskLabel } from '@/lib/types'

interface Config {
  bg: string
  text: string
  label: string
  title: string
}

const BADGE_MAP: Record<Exclude<MinsRisk | SubRiskLabel, 'injured'>, Config> = {
  nailed: {
    bg: 'bg-green-100 dark:bg-green-900',
    text: 'text-green-800 dark:text-green-200',
    label: 'Nailed',
    title: 'Nailed: high start probability (≥85%)',
  },
  likely_start: {
    bg: 'bg-blue-100 dark:bg-blue-900',
    text: 'text-blue-800 dark:text-blue-200',
    label: 'Likely start',
    title: 'Likely start: moderate start probability (65–84%)',
  },
  rotation_risk: {
    bg: 'bg-amber-100 dark:bg-amber-900',
    text: 'text-amber-800 dark:text-amber-200',
    label: 'Rotation risk',
    title: 'Rotation risk: rotation risk identified',
  },
  cameo: {
    bg: 'bg-zinc-100 dark:bg-zinc-700',
    text: 'text-zinc-600 dark:text-zinc-300',
    label: 'Cameo',
    title: 'Cameo: low minutes expected',
  },
  sub_risk: {
    bg: 'bg-orange-100 dark:bg-orange-900',
    text: 'text-orange-800 dark:text-orange-200',
    label: 'Sub risk',
    title: 'Sub risk: likely to start but exits before 60 min',
  },
}

export function getMinsRiskConfig(minsRisk: MinsRisk | SubRiskLabel | undefined): Config | null {
  if (!minsRisk || minsRisk === 'injured') return null
  return BADGE_MAP[minsRisk] ?? null
}

export function MinsRiskBadge({
  minsRisk,
  mins60Prob,
}: {
  minsRisk: MinsRisk | SubRiskLabel | undefined
  mins60Prob?: number
}) {
  const config = getMinsRiskConfig(minsRisk)
  if (!config) return null
  // Phase 52 D-09: tooltip shows label + 60-min probability when prop provided.
  // Format per UI-SPEC.md: "<Label> — <X>% chance 60+ min" (em-dash with surrounding spaces, integer percentage).
  const titleText =
    mins60Prob !== undefined
      ? `${config.label} — ${Math.round(mins60Prob * 100)}% chance 60+ min`
      : config.title
  return (
    <span
      className={`inline-block text-xs font-normal ${config.text} ${config.bg} rounded px-2 py-1`}
      title={titleText}
    >
      {config.label}
    </span>
  )
}
