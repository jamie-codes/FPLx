import type { MinsRisk, SubRiskLabel } from '@/lib/types'
import { RiskChip } from './RiskChip'
import type { RiskChipProps } from './RiskChip'

interface Config {
  bg: string
  text: string
  label: string
  title: string
}

// UIX-03: stays bespoke (5 tones don't fit the 6-intent Chip set) — internals
// retokenized per the badge policy: green→positive, blue→accent, amber/orange→warning,
// zinc→neutral (surface-2/ink-muted). RiskChip stacking preserved.
const BADGE_MAP: Record<Exclude<MinsRisk | SubRiskLabel, 'injured'>, Config> = {
  nailed: {
    bg: 'bg-positive-soft',
    text: 'text-positive',
    label: 'Nailed',
    title: 'Nailed: high start probability (≥85%)',
  },
  likely_start: {
    bg: 'bg-accent-soft',
    text: 'text-accent',
    label: 'Likely start',
    title: 'Likely start: moderate start probability (65–84%)',
  },
  rotation_risk: {
    bg: 'bg-warning-soft',
    text: 'text-warning',
    label: 'Rotation risk',
    title: 'Rotation risk: rotation risk identified',
  },
  cameo: {
    bg: 'bg-surface-2',
    text: 'text-ink-muted',
    label: 'Cameo',
    title: 'Cameo: low minutes expected',
  },
  sub_risk: {
    bg: 'bg-warning-soft',
    text: 'text-warning',
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
  difficultyRotationRisk,
  availabilityRisk,
}: {
  minsRisk: MinsRisk | SubRiskLabel | undefined
  mins60Prob?: number
  difficultyRotationRisk?: RiskChipProps['difficultyRotationRisk']
  availabilityRisk?: RiskChipProps['availabilityRisk']
}) {
  const config = getMinsRiskConfig(minsRisk)
  const hasRiskChip =
    (difficultyRotationRisk === 'high' || difficultyRotationRisk === 'medium') ||
    (availabilityRisk === 'out' || availabilityRisk === 'doubt')
  if (!config && !hasRiskChip) return null
  // Phase 52 D-09: tooltip shows label + 60-min probability when prop provided.
  // Format per UI-SPEC.md: "<Label> — <X>% chance 60+ min" (em-dash with surrounding spaces, integer percentage).
  const titleText = config
    ? mins60Prob !== undefined
      ? `${config.label} — ${Math.round(mins60Prob * 100)}% chance 60+ min`
      : config.title
    : undefined
  return (
    <div className="inline-flex flex-col gap-1 items-start">
      {config && (
        <span
          className={`inline-block text-xs font-normal ${config.text} ${config.bg} rounded px-2 py-1`}
          title={titleText}
        >
          {config.label}
        </span>
      )}
      <RiskChip difficultyRotationRisk={difficultyRotationRisk} availabilityRisk={availabilityRisk} />
    </div>
  )
}
