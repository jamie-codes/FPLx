'use client'

// Product-audit 2026-07 merge: one Prices surface — the daily rise/fall
// predictor and the (seasonal) summer price resets as sections, replacing two
// top-level tabs.
import { useState } from 'react'
import { PriceChangePanel } from './PriceChangePanel'
import { PriceResetTab } from '@/components/price-reset/PriceResetTab'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'

type Section = 'daily' | 'resets'

export function PricesTab() {
  const [section, setSection] = useState<Section>('daily')
  return (
    <div className="space-y-4" data-testid="prices-tab">
      <SegmentedToggle
        ariaLabel="Prices view"
        size="sm"
        options={[
          { id: 'daily', label: 'Daily Changes' },
          { id: 'resets', label: 'Summer Resets' },
        ]}
        value={section}
        onChange={(id) => setSection(id as Section)}
      />
      {section === 'daily' && <PriceChangePanel />}
      {section === 'resets' && <PriceResetTab />}
    </div>
  )
}
