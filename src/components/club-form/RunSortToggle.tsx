'use client'
// Planner (2026-08-29): row-order toggle — alphabetical (original behaviour)
// vs ranked by window ease per GW slot ("who has the best run"), the core
// planner action for wildcard team-targeting. Thin typed wrapper over the
// shared SegmentedToggle primitive (UIX-03) — no bespoke button styling.
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'

export type RunSortMode = 'alpha' | 'ease'

const OPTIONS = [
  { id: 'alpha', label: 'A–Z' },
  { id: 'ease', label: 'Best run' },
]

interface Props {
  value: RunSortMode
  onChange: (v: RunSortMode) => void
}

export function RunSortToggle({ value, onChange }: Props) {
  return (
    <SegmentedToggle
      ariaLabel="Row order"
      options={OPTIONS}
      value={value}
      onChange={(id) => onChange(id as RunSortMode)}
    />
  )
}
