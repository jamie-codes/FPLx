import type { MinsRisk } from '@/lib/types'

interface Config {
  bg: string
  text: string
  label: string
  title: string
}

const BADGE_MAP: Record<Exclude<MinsRisk, 'injured'>, Config> = {
  nailed: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Nailed',
    title: 'Nailed: high start probability (\u226585%)',
  },
  likely_start: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    label: 'Likely start',
    title: 'Likely start: moderate start probability (65\u201384%)',
  },
  rotation_risk: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    label: 'Rotation risk',
    title: 'Rotation risk: rotation risk identified',
  },
  cameo: {
    bg: 'bg-zinc-100',
    text: 'text-zinc-600',
    label: 'Cameo',
    title: 'Cameo: low minutes expected',
  },
}

export function getMinsRiskConfig(minsRisk: MinsRisk): Config | null {
  if (!minsRisk || minsRisk === 'injured') return null
  return BADGE_MAP[minsRisk] ?? null
}

export function MinsRiskBadge({ minsRisk }: { minsRisk: MinsRisk }) {
  const config = getMinsRiskConfig(minsRisk)
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
