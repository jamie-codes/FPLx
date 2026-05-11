'use client'

// Phase 94 WHY-01-B: GemTable row-scoped head-to-head comparison search.
// Lives inside the existing row-expand panel (D-10).
//
// Output semantics (post-SC-4 revision): computeHeadToHead returns Y's rejection
// reasons that X does NOT share — i.e. the predicates where Y was penalised by
// computeRejection but X was not. Rendered as "X beats Y because Y was penalised
// for: [reason1] [reason2]..." in a <ul>. Empty result -> zero-predicate copy.
//
// State persistence: this component is rendered per-row inside the
// row.getIsExpanded() IIFE, so its state resets naturally on row collapse —
// no external state lifting required.
//
// Sources of truth:
//   - .planning/ROADMAP.md §Phase 94 SC-4 (composition mandate)
//   - .planning/phases/94-rejection-explainer-enhancements/94-CONTEXT.md §decisions D-10 D-11 D-12
//   - .planning/phases/94-rejection-explainer-enhancements/94-UI-SPEC.md §WHY-01-B
//   - .planning/phases/94-rejection-explainer-enhancements/94-01-SUMMARY.md (revised signature)
import { useState, useMemo } from 'react'
import type { ScoredPlayer } from '@/lib/types'
import { computeHeadToHead } from '@/lib/explain'
import { PlayerSearchInput } from '@/components/shared/PlayerSearchInput'

interface ComparisonSearchProps {
  rowPlayer: ScoredPlayer
  allPlayers: ScoredPlayer[]
}

export function ComparisonSearch({ rowPlayer, allPlayers }: ComparisonSearchProps) {
  const [compPlayer, setCompPlayer] = useState<ScoredPlayer | null>(null)

  // Exclude self from autocomplete — user cannot compare a player to itself.
  const candidates = useMemo(
    () => allPlayers.filter(p => p.id !== rowPlayer.id),
    [allPlayers, rowPlayer.id],
  )

  // computeHeadToHead composes two computeRejection calls (SC-4) and returns
  // Y's rejection reasons that X does not share. allPlayers is required so the
  // inner xPts ranking is correct. lifecycleLabels intentionally omitted (D-05 —
  // GemTable has no clubFormMap/squadData; lifecycle reasons silent for both x and y).
  const reasonsYHasButXLacks = useMemo(() => {
    if (!compPlayer) return null
    return computeHeadToHead(rowPlayer, compPlayer, allPlayers)
  }, [rowPlayer, compPlayer, allPlayers])

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Compare with…</p>
      <PlayerSearchInput
        players={candidates}
        onSelect={setCompPlayer}
        placeholder="Search player name…"
        inputClassName="text-xs"
        aria-label="Search comparison player"
      />
      {reasonsYHasButXLacks !== null && compPlayer && (
        <div className="space-y-0.5">
          {reasonsYHasButXLacks.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No predicates where {rowPlayer.web_name} ranks above {compPlayer.web_name}.
            </p>
          ) : (
            <>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {rowPlayer.web_name} beats {compPlayer.web_name} because {compPlayer.web_name} was penalised for:
              </p>
              <ul className="space-y-0.5 ml-4 list-disc">
                {reasonsYHasButXLacks.map((reason, i) => (
                  <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400">{reason}</li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            aria-label="Clear comparison"
            onClick={() => setCompPlayer(null)}
            className="text-xs text-zinc-400 dark:text-zinc-500 cursor-pointer"
          >
            {'×'} clear
          </button>
        </div>
      )}
    </div>
  )
}
