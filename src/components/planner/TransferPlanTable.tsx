'use client'

import { Fragment, useMemo, useState } from 'react'
import { ChipToggle } from './ChipToggle'
import { SquadSnapshotRow } from './SquadSnapshotRow'
import { computePlanValue, formatGain } from './plan-helpers'
import { fixtureCountForGw } from '@/lib/planning-engine'
import type { PlanResult, ScoredPlayer, PlannerChip } from '@/lib/types'

interface TransferPlanTableProps {
  planResult: PlanResult
  scoredPlayers: ScoredPlayer[]
  onChipToggle: (stepIndex: number, chip: PlannerChip) => void
}

export function TransferPlanTable({ planResult, scoredPlayers, onChipToggle }: TransferPlanTableProps) {
  const playerMap = useMemo(
    () => new Map(scoredPlayers.map((p) => [p.id, p])),
    [scoredPlayers]
  )

  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set())
  function toggleStep(i: number) {
    setOpenSteps(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const totalNetGain = computePlanValue(planResult.steps)

  return (
    <div className="space-y-4">
      {/* Plan value headline */}
      <p aria-live="polite" className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Plan value: {formatGain(totalNetGain)}
      </p>

      {/* Transfer table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th scope="col" className="px-2 py-2 sm:px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400 text-left">GW</th>
            <th scope="col" className="hidden sm:table-cell px-2 py-2 sm:px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400 text-left">Chip</th>
            <th scope="col" className="px-2 py-2 sm:px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400 text-left">Out</th>
            <th scope="col" className="px-2 py-2 sm:px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400 text-left">In</th>
            <th scope="col" className="px-2 py-2 sm:px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400 text-left">Hit</th>
            <th scope="col" className="px-2 py-2 sm:px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400 text-left">Gain</th>
          </tr>
        </thead>
        <tbody>
          {planResult.steps.map((step, i) => {
            const hasTransfer = step.transfersIn.length > 0

            // DGW/BGW detection using first buy player
            let isDgw = false
            let isBgw = false
            if (hasTransfer) {
              const buyPlayer = playerMap.get(step.transfersIn[0])
              if (buyPlayer) {
                const count = fixtureCountForGw(buyPlayer, step.gw)
                if (count >= 2) isDgw = true
                else if (count === 0) isBgw = true
              }
            } else if (step.unconfirmedFixtures) {
              isBgw = true
            }

            // Gain cell content
            let gainContent: React.ReactNode
            if (!hasTransfer) {
              gainContent = <span className="text-zinc-400 dark:text-zinc-500">&mdash;</span>
            } else {
              const gain = step.scoredTransfers[0]?.netGain ?? 0
              if (step.unconfirmedFixtures) {
                gainContent = (
                  <span className="italic text-zinc-400 dark:text-zinc-500">
                    {formatGain(gain)}
                    <abbr title="Fixtures not yet confirmed for this gameweek">*</abbr>
                  </span>
                )
              } else {
                gainContent = formatGain(gain)
              }
            }

            return (
              <Fragment key={`step-${i}`}>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  {/* GW cell */}
                  <td className="px-2 py-2 sm:px-4 text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                    <button
                      onClick={() => toggleStep(i)}
                      className="inline-flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-400"
                      aria-expanded={openSteps.has(i)}
                      aria-label={`${openSteps.has(i) ? 'Collapse' : 'Expand'} squad for GW${step.gw}`}
                    >
                      <span className="text-xs">{openSteps.has(i) ? '\u25BC' : '\u25B6'}</span>
                      <span>GW{step.gw}</span>
                    </button>
                    {isDgw && (
                      <span
                        className="ml-1 text-xs font-semibold text-violet-700 dark:text-violet-400"
                        aria-label="Double gameweek"
                      >
                        DGW
                      </span>
                    )}
                    {isBgw && (
                      <span
                        className="ml-1 text-xs font-semibold text-amber-600 dark:text-amber-400"
                        aria-label="Blank gameweek"
                      >
                        BGW
                      </span>
                    )}
                  </td>

                  {/* Chip cell — desktop only */}
                  <td className="hidden sm:table-cell px-2 py-2 sm:px-4">
                    <ChipToggle
                      gw={step.gw}
                      activeChip={step.chip}
                      onToggle={(chip) => onChipToggle(i, chip)}
                    />
                  </td>

                  {/* Out / In cells */}
                  {hasTransfer ? (
                    <>
                      <td className="px-2 py-2 sm:px-4 text-zinc-700 dark:text-zinc-300">
                        {playerMap.get(step.transfersOut[0])?.web_name ?? '\u2014'}
                      </td>
                      <td className="px-2 py-2 sm:px-4 text-zinc-700 dark:text-zinc-300">
                        {playerMap.get(step.transfersIn[0])?.web_name ?? '\u2014'}
                      </td>
                    </>
                  ) : (
                    <td colSpan={2} className="px-2 py-2 sm:px-4">
                      <span className="text-zinc-400 dark:text-zinc-500">Hold</span>
                      <span className="block text-xs text-zinc-400 dark:text-zinc-500">No profitable transfer this gameweek</span>
                    </td>
                  )}

                  {/* Hit cell */}
                  <td
                    className={`px-2 py-2 sm:px-4 ${
                      step.hitCost < 0 ? 'text-red-700 dark:text-red-300' : 'text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {step.hitCost === 0 ? '0' : `${step.hitCost} pts`}
                  </td>

                  {/* Gain cell */}
                  <td className="px-2 py-2 sm:px-4 text-zinc-700 dark:text-zinc-300">
                    {gainContent}
                  </td>
                </tr>

                {/* Mobile chip row */}
                <tr key={`chip-mobile-${i}`} className="sm:hidden border-b border-zinc-200 dark:border-zinc-700">
                  <td colSpan={6} className="px-2 py-2 sm:px-4">
                    <ChipToggle
                      gw={step.gw}
                      activeChip={step.chip}
                      onToggle={(chip) => onChipToggle(i, chip)}
                    />
                  </td>
                </tr>

                {/* Squad snapshot accordion row */}
                {openSteps.has(i) && (
                  <tr>
                    <td colSpan={6} className="px-0 py-0">
                      <SquadSnapshotRow
                        squadAfter={step.squadAfter}
                        positionsAfter={step.positionsAfter}
                        transfersIn={step.transfersIn}
                        chip={step.chip}
                        playerMap={playerMap}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
