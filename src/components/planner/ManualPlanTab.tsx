'use client'

// Phase 59 Plan 02: Manual Transfer Planner tab component.
// D-05 persistence: fplx_manual_plan localStorage.
// D-06: two-stage sell→buy picker flow.
// D-13: unauthenticated caveat banner.

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useImmer } from 'use-immer'
import { ChipToggle } from './ChipToggle'
import { PlayerPickerModal } from './PlayerPickerModal'
import { SquadSnapshotRow } from './SquadSnapshotRow'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useSquad } from '@/lib/hooks/useSquad'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { computeAllGemScores } from '@/lib/gem-score'
import {
  freshPlan,
  truncateOrExtendSteps,
  deriveStepStates,
  computeManualPlanSummary,
  loadManualPlan,
  persistManualPlan,
} from '@/lib/manual-plan'
import type { ManualPlan, ManualStep, ManualTransfer, DerivedStep } from '@/lib/manual-plan'
import type { PlannerHorizon, PlannerChip, ScoredPlayer } from '@/lib/types'

// ---------------------------------------------------------------------------
// ManualPlanTab
// ---------------------------------------------------------------------------

interface ManualPlanTabProps {
  submittedId: string | null
  horizon: PlannerHorizon
}

export function ManualPlanTab({ submittedId, horizon }: ManualPlanTabProps) {
  // Team ID local input state for no-squad branch
  const [teamIdInput, setTeamIdInput] = useState<string>(() => submittedId ?? '')

  // Auth + data hooks (mirror PlannerTab pattern)
  const { isAuthenticated } = useAuthStatus()
  const { data: playersData } = usePlayers()
  const { data: squadData } = useSquad(submittedId)
  const { data: myTeamData } = useMyTeam(isAuthenticated)

  // Scored players + player map
  const scoredPlayers = useMemo(
    () => computeAllGemScores(playersData ?? []),
    [playersData]
  )
  const playerMap = useMemo(
    () => new Map(scoredPlayers.map((p) => [p.id, p])),
    [scoredPlayers]
  )

  // Derive starting GW (same as PlannerTab lines 46-49)
  const startingGw = useMemo(() => {
    const ids = scoredPlayers.flatMap((p) => p.fixtures.map((f) => f.event_id))
    return ids.length > 0 ? Math.min(...ids) : null
  }, [scoredPlayers])

  // Hybrid squad data — prefer authenticated, fall back to public (D-12/D-13)
  const picks = myTeamData?.picks ?? squadData?.picks ?? null
  const bankBalance =
    myTeamData?.entry_history?.bank ?? squadData?.entry_history?.bank ?? 0

  // Sell prices: exact when authenticated (D-12); undefined = use now_cost (D-13)
  const sellPrices = myTeamData?.picks
    ? Object.fromEntries(myTeamData.picks.map((p) => [p.element, p.selling_price]))
    : undefined

  // initialFTState — mirrors PlannerTab lines 63-70 verbatim
  const initialFTState = useMemo(() => {
    if (!isAuthenticated || !myTeamData) return { available: 1 as 1 | 2, banked: 0 as 0 | 1 }
    const chip = squadData?.active_chip
    if (chip === 'wildcard' || chip === 'freehit') return { available: 1 as 1 | 2, banked: 0 as 0 | 1 }
    const available: 1 | 2 = myTeamData.entry_history.event_transfers === 0 ? 2 : 1
    const banked: 0 | 1 = available === 2 ? 1 : 0
    return { available, banked }
  }, [isAuthenticated, myTeamData, squadData])

  // Sell price map for deriveStepStates (Map<number, number>)
  const sellPriceMap = useMemo(
    () =>
      sellPrices
        ? new Map(Object.entries(sellPrices).map(([k, v]) => [Number(k), v]))
        : undefined,
    [sellPrices]
  )

  // ---------------------------------------------------------------------------
  // Plan state (Immer + lazy initialiser from localStorage)
  // ---------------------------------------------------------------------------

  const [plan, updatePlan] = useImmer<ManualPlan>(() => {
    const restored = loadManualPlan()
    if (restored) return restored
    return freshPlan(horizon, 0)
  })

  // When startingGw resolves, rewrite placeholder gw=0 step numbers
  useEffect(() => {
    if (startingGw === null) return
    updatePlan((draft) => {
      if (draft.steps.some((s) => s.gw === 0 || s.gw < startingGw)) {
        draft.steps.forEach((s, i) => {
          s.gw = startingGw + i
        })
      }
    })
  }, [startingGw, updatePlan])

  // D-07: sync persisted plan horizon to the section-level prop. page.tsx owns the
  // active horizon; plan.horizon is a downstream mirror so reloads preserve it.
  useEffect(() => {
    if (plan.horizon === horizon) return
    updatePlan((draft) => {
      draft.horizon = horizon
      draft.steps = truncateOrExtendSteps(draft.steps, horizon, startingGw ?? draft.steps[0]?.gw ?? 0)
    })
  }, [horizon, startingGw, plan.horizon, updatePlan])

  // Persistence effect (D-05, MTP-08) — fires on every plan mutation
  useEffect(() => {
    persistManualPlan(plan)
  }, [plan])

  // ---------------------------------------------------------------------------
  // Open accordion set (session-only, NOT persisted)
  // ---------------------------------------------------------------------------

  const [openSet, setOpenSet] = useState<Set<number>>(() => new Set())

  // ---------------------------------------------------------------------------
  // Two-stage picker state: sell → buy
  // ---------------------------------------------------------------------------

  const [pickerState, setPickerState] = useState<{
    stepIndex: number
    stage: 'sell' | 'buy'
    pendingSellId: number | null
    sellPosition: number | null
  } | null>(null)

  // ---------------------------------------------------------------------------
  // Derived data (memoised)
  // ---------------------------------------------------------------------------

  const derived = useMemo(() => {
    if (!picks || !playerMap.size) return null
    return deriveStepStates({
      initialPicks: picks,
      initialFT: initialFTState,
      initialBank: bankBalance,
      sellPrices: sellPriceMap,
      playerMap,
      plan,
    })
  }, [picks, playerMap, initialFTState, bankBalance, sellPriceMap, plan])

  const summary = useMemo(() => {
    if (!derived) return null
    return computeManualPlanSummary(derived, playerMap)
  }, [derived, playerMap])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleHorizonChange = useCallback(
    (newHorizon: PlannerHorizon) => {
      updatePlan((draft) => {
        draft.horizon = newHorizon
        draft.steps = truncateOrExtendSteps(draft.steps, newHorizon, startingGw ?? draft.steps[0]?.gw ?? 0)
      })
    },
    [startingGw, updatePlan]
  )

  const handleReset = useCallback(() => {
    if (typeof window === 'undefined') return
    const ok = window.confirm('Clear all transfers from your manual plan?')
    if (!ok) return
    updatePlan(() => freshPlan(plan.horizon, startingGw ?? 0))
    // clearManualPlan() is unnecessary — persistManualPlan effect overwrites storage
    // on every plan change, including this reset.
  }, [plan.horizon, startingGw, updatePlan])

  const handleChipToggle = useCallback(
    (stepIndex: number, chip: PlannerChip) => {
      updatePlan((draft) => {
        const cur = draft.steps[stepIndex].chip
        draft.steps[stepIndex].chip = cur === chip ? null : chip
      })
    },
    [updatePlan]
  )

  const handleAddTransferClick = useCallback((stepIndex: number) => {
    setPickerState({ stepIndex, stage: 'sell', pendingSellId: null, sellPosition: null })
  }, [])

  const handlePickSell = useCallback(
    (sellId: number) => {
      const sellPlayer = playerMap.get(sellId)
      if (!sellPlayer || !pickerState) return
      setPickerState({
        stepIndex: pickerState.stepIndex,
        stage: 'buy',
        pendingSellId: sellId,
        sellPosition: sellPlayer.element_type,
      })
    },
    [playerMap, pickerState]
  )

  const handlePickBuy = useCallback(
    (buyId: number) => {
      if (!pickerState || pickerState.pendingSellId === null) return
      const stepIndex = pickerState.stepIndex
      const sellId = pickerState.pendingSellId
      updatePlan((draft) => {
        draft.steps[stepIndex].transfers.push({ sellId, buyId })
      })
      setPickerState(null)
    },
    [pickerState, updatePlan]
  )

  const handleClosePicker = useCallback(() => setPickerState(null), [])

  const handleRemoveTransfer = useCallback(
    (stepIndex: number, transferIndex: number) => {
      updatePlan((draft) => {
        draft.steps[stepIndex].transfers.splice(transferIndex, 1)
      })
    },
    [updatePlan]
  )

  const handleAccordionToggle = useCallback((stepIndex: number) => {
    setOpenSet((prev) => {
      const next = new Set(prev)
      if (next.has(stepIndex)) next.delete(stepIndex)
      else next.add(stepIndex)
      return next
    })
  }, [])

  // ---------------------------------------------------------------------------
  // No-squad submit handler
  // ---------------------------------------------------------------------------

  const handleLoadSquad = useCallback(() => {
    const trimmed = teamIdInput.trim()
    if (!/^\d+$/.test(trimmed)) return
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem('fpl_team_id', trimmed) } catch {}
      window.location.reload()
    }
  }, [teamIdInput])

  // ---------------------------------------------------------------------------
  // Render guard order
  // ---------------------------------------------------------------------------

  // 1. Loading branch: scoredPlayers empty AND a team ID was submitted
  if (scoredPlayers.length === 0 && submittedId) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      </section>
    )
  }

  // 2. No-squad branch: no picks available
  if (picks === null) {
    return (
      <section className="space-y-6">
        <header>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Load your squad first
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Enter your FPL Team ID to build a manual transfer plan with live bank balance, FT tracking, and break-even per hit.
          </p>
        </header>
        <form
          onSubmit={(e) => { e.preventDefault(); handleLoadSquad() }}
          className="flex flex-col sm:flex-row gap-2 sm:items-end"
        >
          <div className="flex flex-col gap-1">
            <label
              htmlFor="manualPlanTeamId"
              className="text-sm text-zinc-600 dark:text-zinc-400"
            >
              FPL Team ID
            </label>
            <input
              id="manualPlanTeamId"
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              value={teamIdInput}
              onChange={(e) => setTeamIdInput(e.target.value)}
              placeholder="e.g. 1234567"
              className="border border-zinc-300 dark:border-zinc-600 rounded px-3 py-1.5 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-400 w-full sm:w-40"
            />
          </div>
          <button
            type="submit"
            className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold rounded min-h-[44px] px-3 py-2 text-sm cursor-pointer"
          >
            Load Squad
          </button>
        </form>
      </section>
    )
  }

  // 3. Squad-loaded branch
  return (
    <section className="space-y-4">
      {/* Caveat banner — D-13: shown only when unauthenticated (T-59-06 mitigation) */}
      {!isAuthenticated && picks !== null && (
        <div className="rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 mb-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Sell prices are approximate — log in to FPL for exact selling prices.
          </p>
        </div>
      )}

      {/* Top controls row — horizon now lives in page.tsx (D-07); only Reset Plan stays here */}
      <div className="flex items-center justify-end gap-4 mb-4">
        <button
          onClick={handleReset}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline-offset-2 hover:underline cursor-pointer"
        >
          Reset Plan
        </button>
      </div>

      {/* Summary header band */}
      <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 mb-4">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          {/* Hits */}
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Hits</span>
            <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {summary?.totalHits ?? 0}
            </span>
          </div>
          {/* Hit cost */}
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Hit cost</span>
            <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {summary && summary.totalHitCostPts !== 0
                ? `−${Math.abs(summary.totalHitCostPts)} pts`
                : '0 pts'}
            </span>
          </div>
          {/* Avg break-even */}
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Avg break-even</span>
            <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {!summary || summary.avgBreakEvenGws === null
                ? '—'
                : summary.avgBreakEvenGws === Infinity
                ? '∞'
                : `${summary.avgBreakEvenGws.toFixed(1)} GWs`}
            </span>
          </div>
        </div>
      </div>

      {/* GW step list */}
      {derived &&
        plan.steps.map((step, i) => (
          <GwStepCard
            key={i}
            stepIndex={i}
            step={step}
            derivedStep={derived[i]}
            playerMap={playerMap}
            isOpen={openSet.has(i)}
            onAccordionToggle={() => handleAccordionToggle(i)}
            onChipToggle={(chip) => handleChipToggle(i, chip)}
            onAddTransferClick={() => handleAddTransferClick(i)}
            onRemoveTransfer={(idx) => handleRemoveTransfer(i, idx)}
          />
        ))}

      {/* Sell stage: custom inline list (PlayerPickerModal cannot show squad) */}
      {pickerState?.stage === 'sell' && (() => {
        const stepIdx = pickerState.stepIndex
        // Squad entering this step
        const squadEntering =
          stepIdx === 0
            ? picks.map((p) => p.element)
            : derived?.[stepIdx - 1]?.squadAfter ?? picks.map((p) => p.element)

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Select player to sell"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          >
            <div data-testid="sell-stage-picker" className="rounded-lg bg-white dark:bg-zinc-900 p-4 max-w-sm w-full max-h-[70vh] flex flex-col border border-zinc-200 dark:border-zinc-700 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Select player to sell
                </h2>
                <button
                  type="button"
                  onClick={handleClosePicker}
                  className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="overflow-y-auto flex-1 divide-y divide-zinc-100 dark:divide-zinc-800">
                {squadEntering.map((playerId) => {
                  const player = playerMap.get(playerId)
                  if (!player) {
                    return (
                      <div key={playerId} className="w-full px-3 py-2 text-sm text-zinc-400 italic">
                        Unknown player (ID {playerId})
                      </div>
                    )
                  }
                  return (
                    <button
                      key={playerId}
                      type="button"
                      onClick={() => handlePickSell(playerId)}
                      className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {player.web_name}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                          {player.team_short_name}
                        </span>
                      </div>
                      <span className="text-sm text-zinc-700 dark:text-zinc-300 shrink-0">
                        £{((player.now_cost ?? 0) / 10).toFixed(1)}m
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Buy stage: PlayerPickerModal with budget-aware pre-filtered pool (D-06, MTP-02) */}
      {pickerState?.stage === 'buy' &&
        pickerState.sellPosition !== null &&
        pickerState.pendingSellId !== null &&
        (() => {
          const stepIdx = pickerState.stepIndex
          // Squad entering the step (post all prior steps' transfers)
          const stepBefore =
            stepIdx === 0
              ? new Set(picks.map((p) => p.element))
              : new Set(derived?.[stepIdx - 1]?.squadAfter ?? [])
          // Post-sell squad excludes the sold player
          const squadIds = new Set<number>(stepBefore)
          squadIds.delete(pickerState.pendingSellId)

          // === Budget-aware filter (D-06, MTP-02) ===
          // bankBeforeStep: derived[stepIndex - 1].bankAfter for stepIndex > 0; bankBalance for stepIndex 0.
          const bankBeforeStep =
            stepIdx === 0
              ? bankBalance
              : (derived?.[stepIdx - 1]?.bankAfter ?? bankBalance)
          // sellPriceTenths: prefer sellPriceMap (authenticated) → now_cost fallback (unauthenticated)
          const sellPriceTenths =
            sellPriceMap?.get(pickerState.pendingSellId) ??
            playerMap.get(pickerState.pendingSellId)?.now_cost ??
            0
          const bankAfterSell = bankBeforeStep + sellPriceTenths
          // Filter: only players whose now_cost ≤ bankAfterSell are passed to modal
          const affordablePlayers = scoredPlayers.filter((p) => p.now_cost <= bankAfterSell)

          return (
            <PlayerPickerModal
              open={true}
              position={pickerState.sellPosition}
              squadIds={squadIds}
              suggestedPlayerId={-1}
              scoredPlayers={affordablePlayers}
              onPick={handlePickBuy}
              onClose={handleClosePicker}
            />
          )
        })()}
    </section>
  )
}

// ---------------------------------------------------------------------------
// GwStepCard — private subcomponent
// ---------------------------------------------------------------------------

interface GwStepCardProps {
  stepIndex: number
  step: ManualStep
  derivedStep: DerivedStep
  playerMap: Map<number, ScoredPlayer>
  isOpen: boolean
  onAccordionToggle: () => void
  onChipToggle: (chip: PlannerChip) => void
  onAddTransferClick: () => void
  onRemoveTransfer: (transferIndex: number) => void
}

function computeFtLabel(step: ManualStep, derivedStep: DerivedStep): string {
  if (step.chip === 'wildcard') return 'WC active'
  if (step.chip === 'freehit') return 'FH active'
  if (step.transfers.length > derivedStep.freeTransfersAvailable) return 'Used (Hit)'
  const remaining = derivedStep.freeTransfersAvailable - step.transfers.length
  if (remaining >= 2) return '2 free'
  if (remaining === 1) return '1 free'
  return '0 free'  // all FTs consumed, no hit (transfers.length === freeTransfersAvailable)
}

function GwStepCard({
  step,
  derivedStep,
  playerMap,
  isOpen,
  onAccordionToggle,
  onChipToggle,
  onAddTransferClick,
  onRemoveTransfer,
}: GwStepCardProps) {
  const isWcOrFh = step.chip === 'wildcard' || step.chip === 'freehit'

  // Bank display
  const bankValueTenths = derivedStep.bankAfter
  const bankColorClass =
    bankValueTenths < 0
      ? 'text-red-700 dark:text-red-300 font-semibold'
      : 'text-zinc-900 dark:text-zinc-100 font-medium'
  const bankDisplay = `£${(bankValueTenths / 10).toFixed(1)}m`

  const ftLabelText = computeFtLabel(step, derivedStep)

  // Per-transfer: compute isHit + breakEvenLabel
  const transferData = step.transfers.map((t, idx) => {
    const hit = !isWcOrFh && idx >= derivedStep.freeTransfersAvailable
    const xBuy = playerMap.get(t.buyId)?.xPts_1gw ?? 0
    const xSell = playerMap.get(t.sellId)?.xPts_1gw ?? 0
    const delta = xBuy - xSell
    let breakEvenLabel: string | null = null
    if (hit) {
      breakEvenLabel = delta > 0 ? `${(4 / delta).toFixed(1)} GWs` : '∞'
    }
    return { transfer: t, isHit: hit, breakEvenLabel }
  })

  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden mb-3">
      {/* Step header row */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-700 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            GW {step.gw}
          </span>
        </div>
        <ChipToggle gw={step.gw} activeChip={step.chip} onToggle={onChipToggle} />
        <button
          aria-expanded={isOpen}
          onClick={onAccordionToggle}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer min-h-[44px] px-2"
        >
          {isOpen ? '▲ Hide squad' : '▼ Show squad'}
        </button>
      </div>

      {/* Transfer rows */}
      {transferData.map(({ transfer, isHit, breakEvenLabel }, idx) => (
        <TransferRow
          key={idx}
          transfer={transfer}
          isHit={isHit}
          breakEvenLabel={breakEvenLabel}
          playerMap={playerMap}
          onRemove={() => onRemoveTransfer(idx)}
        />
      ))}

      {/* + Add Transfer button row */}
      <div className="px-4 py-3">
        <button
          onClick={onAddTransferClick}
          className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded px-3 py-2 min-h-[44px] border border-dashed border-zinc-300 dark:border-zinc-600 cursor-pointer"
        >
          + Add Transfer
        </button>
      </div>

      {/* Step footer: bank + FT */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t border-zinc-100 dark:border-zinc-700 text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">
          Bank: <span className={bankColorClass}>{bankDisplay}</span>
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">FT: {ftLabelText}</span>
      </div>

      {/* Accordion expanded body (D-10) */}
      {isOpen && (
        <SquadSnapshotRow
          squadAfter={derivedStep.squadAfter}
          positionsAfter={derivedStep.positionsAfter}
          transfersIn={step.transfers.map((t) => t.buyId)}
          chip={step.chip}
          playerMap={playerMap}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TransferRow — private subcomponent (T-59-08: no dangerouslySetInnerHTML)
// ---------------------------------------------------------------------------

interface TransferRowProps {
  transfer: ManualTransfer
  isHit: boolean
  breakEvenLabel: string | null
  playerMap: Map<number, ScoredPlayer>
  onRemove: () => void
}

function TransferRow({ transfer, isHit, breakEvenLabel, playerMap, onRemove }: TransferRowProps) {
  const sell = playerMap.get(transfer.sellId)
  const buy = playerMap.get(transfer.buyId)

  const badgeClass = isHit
    ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
  const badgeLabel = isHit ? 'Hit −4 pts' : 'Free'

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 border-b border-zinc-100 dark:border-zinc-700">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">Sell</span>
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {sell?.web_name ?? '…'}
      </span>
      <span className="text-zinc-400 dark:text-zinc-500">→</span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">Buy</span>
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {buy?.web_name ?? '…'}
      </span>

      {/* Free or Hit badge */}
      <span className={`inline-block text-xs font-medium ${badgeClass} rounded px-2 py-1`}>
        {badgeLabel}
      </span>

      {/* Break-even (only if Hit) */}
      {isHit && breakEvenLabel !== null && (
        <span
          className="text-xs text-zinc-500 dark:text-zinc-400"
          title={breakEvenLabel === '∞' ? 'No break-even — incoming player projects equal or fewer xPts than outgoing.' : undefined}
        >
          Break-even: {breakEvenLabel}
        </span>
      )}

      {/* Spacer + Remove button */}
      <span className="ml-auto" />
      <button
        onClick={onRemove}
        aria-label="Remove transfer"
        className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer text-base min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        ✕
      </button>
    </div>
  )
}
