'use client'

import { useState } from 'react'
import { ClubFormViewToggle } from './ClubFormViewToggle'
import type { ClubFormView } from './ClubFormViewToggle'
import { FixtureEaseRankingPanel } from './FixtureEaseRankingPanel'
import { FixtureSwingDetector } from './FixtureSwingDetector'
import { ClubFormTable } from './ClubFormTable'
import { FixtureHeatMap } from './FixtureHeatMap'

interface ClubFormTabProps {
  submittedId?: string | null
}

export function ClubFormTab({ submittedId }: ClubFormTabProps) {
  const [view, setView] = useState<ClubFormView>('form')
  return (
    <section className="space-y-4">
      <ClubFormViewToggle view={view} onViewChange={setView} />
      {view === 'form' ? (
        <>
          <FixtureEaseRankingPanel />
          <FixtureSwingDetector />
          <ClubFormTable />
        </>
      ) : (
        <FixtureHeatMap submittedId={submittedId} />
      )}
    </section>
  )
}
