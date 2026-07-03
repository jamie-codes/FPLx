'use client'

// Product-audit 2026-07 merge: Perfect GW is a retrospective of the same
// settled gameweek that GW Review covers — it lives here as a section now,
// not a separate Research tab.
import { useState } from 'react'
import { GwReviewTab } from './GwReviewTab'
import { PerfectGWTab } from '@/components/perfect-gw/PerfectGWTab'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'

type Section = 'review' | 'perfect'

export function ReviewHub({ teamId, settledGws }: {
  teamId: string
  settledGws: number[]
}) {
  const [section, setSection] = useState<Section>('review')
  return (
    <div className="space-y-4" data-testid="review-hub">
      <SegmentedToggle
        ariaLabel="Review view"
        size="sm"
        options={[
          { id: 'review', label: 'GW Review' },
          { id: 'perfect', label: 'Perfect XI' },
        ]}
        value={section}
        onChange={(id) => setSection(id as Section)}
      />
      {section === 'review' && <GwReviewTab teamId={teamId} settledGws={settledGws} />}
      {section === 'perfect' && <PerfectGWTab />}
    </div>
  )
}
