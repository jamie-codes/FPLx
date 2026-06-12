'use client'

import type { ViewPreset } from './GwToggle'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'

const PRESET_OPTIONS: { id: ViewPreset; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'compact', label: 'Compact' },
  { id: 'analysis', label: 'Analysis' },
]

interface PresetToggleProps {
  preset: ViewPreset
  onPresetChange: (p: ViewPreset) => void
}

// UIX-03: control unified onto the SegmentedToggle primitive (same options/
// semantics). Desktop-only behaviour (hidden sm:block) preserved.
export function PresetToggle({ preset, onPresetChange }: PresetToggleProps) {
  return (
    <div className="hidden sm:block">
      <SegmentedToggle
        options={PRESET_OPTIONS}
        value={preset}
        onChange={(id) => onPresetChange(id as ViewPreset)}
        size="sm"
        ariaLabel="Table view preset"
      />
    </div>
  )
}
