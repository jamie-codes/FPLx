'use client'

// Product-audit 2026-07 merge: Value Gems is the same /api/players gem scores
// with a cheap/low-owned lens — it lives here as a section of Gem Ratings now,
// not a separate nav entry. All GemTable props pass straight through.
import { useState } from 'react'
import { GemTable } from './GemTable'
import type { ViewPreset } from './GwToggle'
import { ValueGemsTable } from '@/components/value-gems/ValueGemsTable'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import type { ScoredPlayer } from '@/lib/types'

type Section = 'ratings' | 'value'

export function GemsHub({ preset, onPresetChange, onCompare, watchlistIds, toggleWatchlist }: {
  preset: ViewPreset
  onPresetChange: (p: ViewPreset) => void
  onCompare: (player: ScoredPlayer) => void
  watchlistIds: number[]
  toggleWatchlist: (id: number) => void
}) {
  const [section, setSection] = useState<Section>('ratings')
  return (
    <div className="space-y-4" data-testid="gems-hub">
      <SegmentedToggle
        ariaLabel="Gem view"
        size="sm"
        options={[
          { id: 'ratings', label: 'Gem Ratings' },
          { id: 'value', label: 'Value Gems' },
        ]}
        value={section}
        onChange={(id) => setSection(id as Section)}
      />
      {section === 'ratings' && (
        <GemTable
          preset={preset}
          onPresetChange={onPresetChange}
          onCompare={onCompare}
          watchlistIds={watchlistIds}
          toggleWatchlist={toggleWatchlist}
        />
      )}
      {section === 'value' && <ValueGemsTable />}
    </div>
  )
}
