'use client'

// Phase 94 WHY-01-A: TransferPanel rejection-search callout.
// Always rendered above the OCS (D-07); callout appears between search and OCS without hiding OCS (D-08).
//
// Sources of truth:
//   - .planning/phases/94-rejection-explainer-enhancements/94-CONTEXT.md §decisions D-07 D-08 D-09
//   - .planning/phases/94-rejection-explainer-enhancements/94-UI-SPEC.md §WHY-01-A
//   - .planning/phases/94-rejection-explainer-enhancements/94-PATTERNS.md §RejectionSearchCallout
import { useState, useMemo } from 'react'
import type { ScoredPlayer } from '@/lib/types'
import type { LifecycleLabel } from '@/lib/lifecycle-label'
import { computeRejection } from '@/lib/explain'
import { PlayerSearchInput } from '@/components/shared/PlayerSearchInput'

const POSITION_CODES_LABEL: Record<number, string> = {
  1: 'GK',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
}

interface RejectionSearchCalloutProps {
  players: ScoredPlayer[]
  /** Empty Map() when squad not loaded (D-05); lifecycle reasons simply do not fire. */
  lifecycleLabels: Map<number, LifecycleLabel>
}

export function RejectionSearchCallout({ players, lifecycleLabels }: RejectionSearchCalloutProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<ScoredPlayer | null>(null)

  const rejection = useMemo(() => {
    if (!selectedPlayer) return null
    return computeRejection(selectedPlayer, players, lifecycleLabels)
  }, [selectedPlayer, players, lifecycleLabels])

  const posCodeLabel = selectedPlayer
    ? (POSITION_CODES_LABEL[selectedPlayer.element_type] ?? '??')
    : ''

  return (
    <div
      data-testid="rejection-search-callout"
      className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 space-y-2"
    >
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        &#8505;&#65039; Why isn&apos;t a player recommended?
      </p>

      <PlayerSearchInput
        players={players}
        onSelect={setSelectedPlayer}
        placeholder="Search player name…"
        inputClassName="text-sm"
        aria-label="Search for a player to explain rejection"
      />

      {rejection && selectedPlayer && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              &#8505;&#65039; Why isn&apos;t {selectedPlayer.web_name} recommended?
            </p>
            <button
              type="button"
              aria-label="Dismiss explanation"
              onClick={() => setSelectedPlayer(null)}
              className="text-xs text-zinc-400 dark:text-zinc-500 cursor-pointer"
            >
              {'×'}
            </button>
          </div>
          {rejection.reasons.length === 0 ? (
            <p className="text-xs text-green-700 dark:text-green-400">
              {`No rejection signals — ranked #${rejection.xPtsRank} at ${posCodeLabel} by xPts (${(selectedPlayer.xPts_1gw ?? 0).toFixed(1)} pts projected)`}
            </p>
          ) : (
            <>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Why not recommended:</p>
              <ul className="space-y-0.5">
                {rejection.reasons.map((line, i) => (
                  <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400">{line}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
