'use client'

// Phase 46 (CHIP-01..CHIP-02): ChipSquadView — position-grouped squad display for WC/FH modes.
// Locked by 46-CONTEXT.md D-16, D-17, D-18, D-19.
import { Fragment } from 'react'
import type { ChipSquadResult, ChipSquadPlayer } from '@/lib/types'

interface ChipSquadViewProps {
  result: ChipSquadResult
  chipMode: 'wildcard' | 'free-hit'
}

const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
const POSITION_ORDER = [1, 2, 3, 4]

export function ChipSquadView({ result, chipMode }: ChipSquadViewProps) {
  const { squad, bestXI, formation, budgetUsed } = result
  const bestXISet = new Set(bestXI)
  const isWildcard = chipMode === 'wildcard'

  // Separate squad into XI and bench
  const xiPlayers = squad.filter(p => bestXISet.has(p.id))
  const benchPlayers = squad.filter(p => !bestXISet.has(p.id))

  // Position-grouped XI sections
  const xiByPosition: Record<number, ChipSquadPlayer[]> = { 1: [], 2: [], 3: [], 4: [] }
  for (const p of xiPlayers) xiByPosition[p.element_type]?.push(p)

  // Bench: GK first, then by xPts desc (mirrors OPT-04 ordering from optimiseLineup)
  const benchSorted = [
    ...benchPlayers.filter(p => p.element_type === 1),
    ...benchPlayers.filter(p => p.element_type !== 1).sort((a, b) => b.xPts - a.xPts),
  ]

  const budgetDisplayM = (budgetUsed / 10).toFixed(1)
  const chipLabel = isWildcard ? 'Wildcard' : 'Free Hit (this GW only)'

  return (
    <div data-testid="chip-squad-view" className="space-y-2">
      {/* Headline row (D-17) */}
      <div
        data-testid="chip-squad-headline"
        className="flex flex-wrap items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 py-2"
      >
        <span className="font-semibold">{chipLabel}</span>
        <span className="text-zinc-400">│</span>
        <span><span className="font-semibold">Formation:</span> {formation}</span>
        <span className="text-zinc-400">│</span>
        <span><span className="font-semibold">Budget used:</span> £{budgetDisplayM}m</span>
      </div>

      {/* FH reversion notice (D-18) — amber, italic */}
      {!isWildcard && (
        <p
          data-testid="fh-reversion-notice"
          className="text-xs italic text-amber-600 dark:text-amber-500"
        >
          This squad is optimised for this GW only. Your actual squad reverts after the gameweek ends.
        </p>
      )}

      {/* Position-grouped XI rows */}
      {POSITION_ORDER.map(pos => {
        const group = xiByPosition[pos] ?? []
        if (group.length === 0) return null
        return (
          <Fragment key={pos}>
            <div className="text-[10px] font-semibold uppercase text-zinc-500 dark:text-zinc-400 pt-2 pb-0.5 bg-zinc-50 dark:bg-zinc-800/40 px-1">
              {POSITION_LABELS[pos]}
            </div>
            {group.map(p => (
              <div
                key={p.id}
                data-xi="true"
                className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800 border-l-2 border-green-500 pl-2 text-sm"
              >
                <span className="text-zinc-700 dark:text-zinc-300 font-semibold">{p.web_name}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  £{(p.now_cost / 10).toFixed(1)}m
                  <span className="ml-2 text-green-600 dark:text-green-400">+{p.xPts.toFixed(1)} xPts</span>
                </span>
              </div>
            ))}
          </Fragment>
        )
      })}

      {/* Bench section */}
      <div className="text-[10px] font-semibold uppercase text-zinc-500 dark:text-zinc-400 pt-2 pb-0.5 bg-zinc-50 dark:bg-zinc-800/40 px-1">
        Bench
      </div>
      {benchSorted.map(p => (
        <div
          key={p.id}
          data-xi="false"
          className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800 opacity-60 pl-2 text-sm"
        >
          <span className="text-zinc-700 dark:text-zinc-300">{p.web_name}</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            £{(p.now_cost / 10).toFixed(1)}m
            <span className="ml-2">+{p.xPts.toFixed(1)} xPts</span>
          </span>
        </div>
      ))}
    </div>
  )
}
