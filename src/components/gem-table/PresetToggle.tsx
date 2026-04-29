'use client'

import type { ViewPreset } from './GwToggle'

const PRESET_LABELS: Record<ViewPreset, string> = {
  default: 'Default',
  compact: 'Compact',
  analysis: 'Analysis',
}

interface PresetToggleProps {
  preset: ViewPreset
  onPresetChange: (p: ViewPreset) => void
}

export function PresetToggle({ preset, onPresetChange }: PresetToggleProps) {
  return (
    <div
      role="group"
      aria-label="Table view preset"
      className="hidden sm:flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600"
    >
      {(['default', 'compact', 'analysis'] as const).map((p) => (
        <button
          key={p}
          onClick={() => onPresetChange(p)}
          aria-pressed={preset === p}
          className={`px-3 py-1 text-sm font-medium transition-all cursor-pointer active:scale-95 min-h-[44px] sm:min-h-0 ${
            preset === p
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
          }`}
        >
          {PRESET_LABELS[p]}
        </button>
      ))}
    </div>
  )
}
