'use client'
// NEWS-01 (2026-09-02): transfer and squad news, promoted out of Pre-Season.
//
// Pre-Season bundled three things: a next-season planner (genuinely off-season)
// and two news surfaces — the window feed and confirmed transfers — which stay
// relevant all year: who is being sold or loaned, who has moved club, who is
// unavailable. Hiding Pre-Season for the season took those with it, so they
// live here in Research instead. Pre-Season keeps the planner and stays hidden.
import { useState } from 'react'
import { SummerWindowTab } from '@/components/news/SummerWindowTab'
import { ConfirmedTransfersTab } from '@/components/transfers-confirmed/ConfirmedTransfersTab'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'

type Section = 'window' | 'confirmed'

export function TransferNewsTab() {
  const [section, setSection] = useState<Section>('confirmed')

  return (
    <div className="space-y-4" data-testid="transfer-news-tab">
      <SegmentedToggle
        ariaLabel="News section"
        options={[
          { id: 'confirmed', label: 'Confirmed moves' },
          { id: 'window', label: 'Window feed' },
        ]}
        value={section}
        onChange={(id) => setSection(id as Section)}
      />
      {section === 'confirmed' && (
        <ConfirmedTransfersTab onOpenWindow={() => setSection('window')} />
      )}
      {section === 'window' && <SummerWindowTab />}
    </div>
  )
}
