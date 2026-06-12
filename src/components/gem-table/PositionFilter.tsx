'use client'

import type { PositionCode } from '@/lib/types'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'

// UIX-03: control unified onto the SegmentedToggle primitive (same options/
// semantics — 'all' maps to the null position code).
const POSITIONS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: '1', label: 'GK' },
  { id: '2', label: 'DEF' },
  { id: '3', label: 'MID' },
  { id: '4', label: 'FWD' },
]

interface Props {
  active: PositionCode | null
  onChange: (code: PositionCode | null) => void
}

export function PositionFilter({ active, onChange }: Props) {
  return (
    <SegmentedToggle
      options={POSITIONS}
      value={active === null ? 'all' : String(active)}
      onChange={(id) => onChange(id === 'all' ? null : (Number(id) as PositionCode))}
      ariaLabel="Position filter"
    />
  )
}
