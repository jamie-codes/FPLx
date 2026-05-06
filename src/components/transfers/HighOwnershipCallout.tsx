'use client'

// Phase 65 (WHY-02): HighOwnershipCallout — informational callout for high-ownership players
// absent from transfer candidates. Display-only; no hooks, no data derivation. Caller (TransferPanel)
// owns the entries derivation in Plan 05.
//
// Sources of truth:
//   - .planning/phases/065-rejection-explainer/065-UI-SPEC.md §WHY-02 + §Copywriting Contract
//   - .planning/phases/065-rejection-explainer/065-CONTEXT.md §decisions D-11 D-12 D-13 D-14
//   - .planning/phases/065-rejection-explainer/065-PATTERNS.md §HighOwnershipCallout component structure
import type { ScoredPlayer } from '@/lib/types'

export interface HighOwnershipEntry {
  player: ScoredPlayer
  inSquad: boolean
  /** Required when inSquad === true (in-squad copy variant interpolates "ranked #N"). */
  squadRank?: number
  /** 'GK' | 'DEF' | 'MID' | 'FWD' — caller derives from element_type. */
  posCode: string
}

interface HighOwnershipCalloutProps {
  entries: HighOwnershipEntry[]
}

export function HighOwnershipCallout({ entries }: HighOwnershipCalloutProps) {
  // D-11: only render when at least one qualifying player exists.
  if (entries.length === 0) return null

  return (
    <div
      data-testid="high-ownership-callout"
      className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 space-y-1"
    >
      {/* D-14: header with ℹ️ prefix (Unicode info symbol U+2139 + variation selector U+FE0F). */}
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        &#8505;&#65039; Why aren&apos;t these players appearing?
      </p>
      {entries.map(entry => {
        const owned = Math.round(parseFloat(entry.player.selected_by_percent))
        return (
          <p key={entry.player.id} className="text-xs text-zinc-600 dark:text-zinc-400">
            <span className="font-medium">{entry.player.web_name}</span>
            {' '}({owned}%):{' '}
            {entry.inSquad
              // D-12 in-squad variant: "Already ranked #N at POS in your squad by xPts — no upgrade needed"
              ? `Already ranked #${entry.squadRank ?? '?'} at ${entry.posCode} in your squad by xPts — no upgrade needed`
              // D-12 not-in-squad variant: "xPts gain vs your POS options is negative — not worth transferring in"
              : `xPts gain vs your ${entry.posCode} options is negative — not worth transferring in`}
          </p>
        )
      })}
    </div>
  )
}
