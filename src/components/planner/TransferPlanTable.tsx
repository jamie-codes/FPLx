'use client'

import { Fragment, useMemo, useState } from 'react'
import { ChipToggle } from './ChipToggle'
import { SquadSnapshotRow } from './SquadSnapshotRow'
import { PlayerPickerModal } from './PlayerPickerModal'
import { computePlanValue, formatGain } from './plan-helpers'
import { fixtureCountForGw } from '@/lib/planning-engine'
import type { PlanResult, ScoredPlayer, PlannerChip } from '@/lib/types'

interface TransferPlanTableProps {
  planResult: PlanResult
  scoredPlayers: ScoredPlayer[]
  onChipToggle: (stepIndex: number, chip: PlannerChip) => void
  onManualEdit: (stepIndex: number, newBuyId: number) => void
  onRestoreSuggested: (stepIndex: number) => void
}

export function TransferPlanTable({ planResult, scoredPlayers, onChipToggle, onManualEdit, onRestoreSuggested }: TransferPlanTableProps) {
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

  const [pickerState, setPickerState] = useState<{
    open: boolean
    stepIndex: number
    position: number
    squadIds: Set<number>
    suggestedPlayerId: number
  }>({ open: false, stepIndex: 0, position: 1, squadIds: new Set(), suggestedPlayerId: 0 })

  function openPicker(stepIndex: number) {
    const step = planResult.steps[stepIndex]
    if (step.transfersIn.length === 0) return
    const sellPlayer = playerMap.get(step.transfersOut[0])
    const position = sellPlayer?.element_type ?? 1
    setPickerState({
      open: true,
      stepIndex,
      position,
      squadIds: new Set(step.squadAfter),
      suggestedPlayerId: planResult.originalSteps[stepIndex]?.transfersIn[0] ?? step.transfersIn[0],
    })
  }

  const totalNetGain = computePlanValue(planResult.steps)

  return (
    <div className="space-y-4">
      {/* Plan value headline */}
      <p aria-live="polite" className="text-xl font-semibold text-ink">
        Plan value: {formatGain(totalNetGain)}
      </p>

      {/* Transfer table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="px-2 py-2 sm:px-4 text-sm font-medium text-ink-muted text-left">GW</th>
            <th scope="col" className="hidden sm:table-cell px-2 py-2 sm:px-4 text-sm font-medium text-ink-muted text-left">Chip</th>
            <th scope="col" className="px-2 py-2 sm:px-4 text-sm font-medium text-ink-muted text-left">Out</th>
            <th scope="col" className="px-2 py-2 sm:px-4 text-sm font-medium text-ink-muted text-left">In</th>
            <th scope="col" className="px-2 py-2 sm:px-4 text-sm font-medium text-ink-muted text-left">Hit</th>
            <th scope="col" className="px-2 py-2 sm:px-4 text-sm font-medium text-ink-muted text-left">Gain</th>
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
            if (step.chip === 'bboost') {
              gainContent = (
                <span className="text-positive">
                  Bench: {formatGain(step.bbValue ?? 0)}
                </span>
              )
            } else if (step.chip === '3xc') {
              gainContent = (
                <span className="text-violet">
                  3xC: {formatGain(step.bbValue ?? 0)}
                </span>
              )
            } else if (step.chip === 'wildcard' || step.chip === 'freehit') {
              gainContent = formatGain(step.chipGain ?? 0)
            } else if (!hasTransfer) {
              gainContent = <span className="text-ink-muted">&mdash;</span>
            } else {
              const gain = step.scoredTransfers[0]?.netGain ?? 0
              if (step.unconfirmedFixtures) {
                gainContent = (
                  <span className="italic text-ink-muted">
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
                <tr className="border-b border-line">
                  {/* GW cell */}
                  <td className="px-2 py-2 sm:px-4 text-ink whitespace-nowrap">
                    <button
                      onClick={() => toggleStep(i)}
                      className="inline-flex items-center gap-1 hover:text-ink-muted"
                      aria-expanded={openSteps.has(i)}
                      aria-label={`${openSteps.has(i) ? 'Collapse' : 'Expand'} squad for GW${step.gw}`}
                    >
                      <span className="text-xs">{openSteps.has(i) ? '\u25BC' : '\u25B6'}</span>
                      <span>GW{step.gw}</span>
                    </button>
                    {isDgw && (
                      <span
                        className="ml-1 text-xs font-semibold text-violet"
                        aria-label="Double gameweek"
                      >
                        DGW
                      </span>
                    )}
                    {isBgw && (
                      <span
                        className="ml-1 text-xs font-semibold text-warning"
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
                      <td className="px-2 py-2 sm:px-4 text-ink">
                        {step.transfersOut.map(id => (
                          <div key={id}>{playerMap.get(id)?.web_name ?? '\u2014'}</div>
                        ))}
                      </td>
                      <td className="px-2 py-2 sm:px-4 text-ink">
                        {step.transfersIn.length === 1 ? (
                          <span className="inline-flex items-center gap-1">
                            {playerMap.get(step.transfersIn[0])?.web_name ?? '\u2014'}
                            {planResult.originalSteps[i]?.transfersIn[0] !== undefined &&
                             step.transfersIn[0] !== planResult.originalSteps[i].transfersIn[0] && (
                              <button
                                onClick={() => onRestoreSuggested(i)}
                                className="text-ink-muted hover:text-ink text-xs"
                                aria-label="Restore suggested player"
                                title="Restore suggested"
                              >&#x21A9;</button>
                            )}
                            <button
                              onClick={() => openPicker(i)}
                              className="text-ink-muted hover:text-ink text-xs"
                              aria-label="Edit transfer"
                              title="Edit"
                            >&#x270F;</button>
                          </span>
                        ) : (
                          step.transfersIn.map(id => (
                            <div key={id}>{playerMap.get(id)?.web_name ?? '\u2014'}</div>
                          ))
                        )}
                      </td>
                    </>
                  ) : (
                    <td colSpan={2} className="px-2 py-2 sm:px-4">
                      <span className="text-ink-muted">Hold</span>
                      <span className="block text-xs text-ink-muted">No profitable transfer this gameweek</span>
                    </td>
                  )}

                  {/* Hit cell */}
                  <td
                    className={`px-2 py-2 sm:px-4 ${
                      step.hitCost < 0 ? 'text-negative' : 'text-ink'
                    }`}
                  >
                    {step.hitCost === 0 ? '0' : `${step.hitCost} pts`}
                  </td>

                  {/* Gain cell */}
                  <td className="px-2 py-2 sm:px-4 text-ink">
                    {gainContent}
                  </td>
                </tr>

                {/* Mobile chip row */}
                <tr key={`chip-mobile-${i}`} className="sm:hidden border-b border-line">
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

      <PlayerPickerModal
        open={pickerState.open}
        position={pickerState.position}
        squadIds={pickerState.squadIds}
        suggestedPlayerId={pickerState.suggestedPlayerId}
        scoredPlayers={scoredPlayers}
        onPick={(playerId) => {
          onManualEdit(pickerState.stepIndex, playerId)
          setPickerState(prev => ({ ...prev, open: false }))
        }}
        onClose={() => setPickerState(prev => ({ ...prev, open: false }))}
      />
    </div>
  )
}
