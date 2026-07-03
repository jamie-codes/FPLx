'use client'

// Product-audit 2026-07 merge: the off-season is ONE job — get ready for GW1.
// Rumours (Summer Window), confirmed deals and the pre-season squad planner
// live here as sections, replacing three top-level tabs.
import { useState } from 'react'
import { NextSeasonPlannerTab } from './NextSeasonPlannerTab'
import { SummerWindowTab } from '@/components/news/SummerWindowTab'
import { ConfirmedTransfersTab } from '@/components/transfers-confirmed/ConfirmedTransfersTab'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'

type Section = 'planner' | 'window' | 'confirmed'

export function PreSeasonTab() {
  const [section, setSection] = useState<Section>('planner')
  return (
    <div className="space-y-4" data-testid="pre-season-tab">
      <SegmentedToggle
        ariaLabel="Pre-season view"
        size="sm"
        options={[
          { id: 'planner', label: 'Squad Planner' },
          { id: 'window', label: 'Summer Window' },
          { id: 'confirmed', label: 'Confirmed Deals' },
        ]}
        value={section}
        onChange={(id) => setSection(id as Section)}
      />
      {section === 'planner' && <NextSeasonPlannerTab />}
      {section === 'window' && <SummerWindowTab />}
      {section === 'confirmed' && (
        <ConfirmedTransfersTab onOpenWindow={() => setSection('window')} />
      )}
    </div>
  )
}
