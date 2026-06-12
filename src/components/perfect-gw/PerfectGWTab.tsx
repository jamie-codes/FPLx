'use client'

import { useState } from 'react'
import { useBootstrap }    from '@/lib/hooks/useBootstrap'
import { useLiveGwPoints } from '@/lib/hooks/useLiveGwPoints'
import { computePerfectXI } from '@/lib/perfect-gw/computePerfectXI'
import { PerfectGWPitch }   from './PerfectGWPitch'
import { TopScorersTable }  from './TopScorersTable'

type InnerTab = 'pitch' | 'top-scorers'

export function PerfectGWTab() {
  const { data: bootstrap, isLoading: bsLoading, isError: bsError } = useBootstrap()
  const [selectedGw, setSelectedGw]   = useState<number | null>(null)
  const [activeTab, setActiveTab]      = useState<InnerTab>('pitch')

  // All settled GWs in ascending order
  const settledGws: number[] = bootstrap?.events
    .filter(e => e.finished && e.data_checked)
    .map(e => e.id) ?? []

  // Default: latest settled GW
  const effectiveGw = selectedGw ?? (settledGws.length > 0 ? settledGws[settledGws.length - 1] : null)

  const { data: livePoints, isLoading: ptLoading, isError: ptError } = useLiveGwPoints(effectiveGw)

  // ─── Loading / error guards ────────────────────────────────────────────────

  if (bsLoading || ptLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-ink-muted text-sm">Loading…</p>
      </div>
    )
  }

  // No settled GWs yet (e.g. start of season or all GWs in progress)
  if (!bsError && !ptError && bootstrap && effectiveGw === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-ink-muted text-sm">No completed gameweeks yet.</p>
      </div>
    )
  }

  if (bsError || ptError || !bootstrap || !livePoints || effectiveGw === null) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-negative text-sm">Error loading Perfect GW data.</p>
      </div>
    )
  }

  // GW settled guard
  const gwEvent = bootstrap.events.find(e => e.id === effectiveGw)
  if (!gwEvent?.finished || !gwEvent?.data_checked) {
    return (
      <div className="py-16 text-center">
        <p className="text-ink-muted text-sm">
          GW in progress — results available after all matches complete.
        </p>
      </div>
    )
  }

  const result = computePerfectXI(bootstrap.elements, livePoints)

  // ─── GW selector helpers ───────────────────────────────────────────────────

  const currentIdx = settledGws.indexOf(effectiveGw)
  const canGoPrev  = currentIdx > 0
  const canGoNext  = currentIdx < settledGws.length - 1

  function goPrev() {
    if (canGoPrev) setSelectedGw(settledGws[currentIdx - 1])
  }
  function goNext() {
    if (canGoNext) setSelectedGw(settledGws[currentIdx + 1])
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* GW selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={goPrev}
          disabled={!canGoPrev}
          aria-label="Previous gameweek"
          className="px-3 py-1.5 rounded text-sm font-medium text-ink-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {canGoPrev ? `◀ GW ${settledGws[currentIdx - 1]}` : '◀'}
        </button>
        <span className="font-semibold text-ink">
          GW {effectiveGw} — Perfect XI
        </span>
        <button
          onClick={goNext}
          disabled={!canGoNext}
          aria-label="Next gameweek"
          className="px-3 py-1.5 rounded text-sm font-medium text-ink-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {canGoNext ? `GW ${settledGws[currentIdx + 1]} ▶` : '▶'}
        </button>
      </div>

      {/* Inner tabs */}
      <div role="tablist" className="flex gap-2 border-b border-line">
        <button
          role="tab"
          onClick={() => setActiveTab('pitch')}
          aria-selected={activeTab === 'pitch'}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'pitch'
              ? 'border-ink text-ink'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          ⚽ Perfect XI
        </button>
        <button
          role="tab"
          onClick={() => setActiveTab('top-scorers')}
          aria-selected={activeTab === 'top-scorers'}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'top-scorers'
              ? 'border-ink text-ink'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          📊 Top Scorers
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'pitch' && (
        <PerfectGWPitch result={result} teams={bootstrap.teams} livePoints={livePoints} />
      )}
      {activeTab === 'top-scorers' && (
        <TopScorersTable players={bootstrap.elements} livePoints={livePoints} teams={bootstrap.teams} />
      )}
    </div>
  )
}
