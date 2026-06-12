'use client'
// UIX-03 Task 4: thin wrapper over the SegmentedToggle primitive — keeps the
// call-site API (view/onViewChange) and option semantics; only the control unifies.
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'

export type SetPieceView = 'takers' | 'league'

const OPTIONS: { id: SetPieceView; label: string }[] = [
  { id: 'takers', label: 'Takers' },
  { id: 'league', label: 'League Table' },
]

interface SetPieceViewToggleProps {
  view: SetPieceView
  onViewChange: (v: SetPieceView) => void
}

export function SetPieceViewToggle({ view, onViewChange }: SetPieceViewToggleProps) {
  return (
    <SegmentedToggle
      options={OPTIONS}
      value={view}
      onChange={(id) => onViewChange(id as SetPieceView)}
      ariaLabel="Set-piece view"
    />
  )
}
