'use client'

import { useState, useMemo } from 'react'
import { useImmer } from 'use-immer'
import { TransferPlanTable } from './TransferPlanTable'
import { ChipStrategyPanel } from './ChipStrategyPanel'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useSquad } from '@/lib/hooks/useSquad'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { useClubForm } from '@/lib/hooks/useClubForm'
import { computeAllGemScores } from '@/lib/gem-score'
import { generatePlan, generatePlanFrom, generateChipStep, ftStateAfterStepIndex, squadPicksFromStep, fixtureCountForGw } from '@/lib/planning-engine'
import { computeNextFTState, computeHitCost } from '@/lib/free-transfer-engine'
import type { PlanResult, FTState, PlannerHorizon, PlannerChip } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

interface PlannerTabProps {
  horizon: PlannerHorizon
}

export function PlannerTab({ horizon }: PlannerTabProps) {
  const [planResult, updatePlanResult] = useImmer<PlanResult | null>(null)

  // Team ID from localStorage (Team-ID-only mode — no auth required)
  const [teamId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('fpl_team_id') : null
  )

  // Auth status — determines whether to attempt authenticated my-team fetch
  const { isAuthenticated } = useAuthStatus()

  // Data hooks
  const { data: playersData } = usePlayers()
  const { data: squadData } = useSquad(teamId)
  const { data: myTeamData } = useMyTeam(isAuthenticated)
  const { data: clubFormData } = useClubForm()

  // Convert MergedPlayer[] → ScoredPlayer[] (same pattern as GemTable)
  const scoredPlayers = useMemo(
    () => computeAllGemScores(playersData ?? []),
    [playersData]
  )

  // Derive starting GW from the minimum fixture event_id across all scored players.
  // Using [0].fixtures[0] is wrong for BGW — that player may have no fixture this GW,
  // making startingGw point to the wrong week (or null, blocking plan generation entirely).
  const startingGw = (() => {
    const ids = scoredPlayers.flatMap(p => p.fixtures.map(f => f.event_id))
    return ids.length > 0 ? Math.min(...ids) : null
  })()

  // Hybrid squad data (per D-04): prefer authenticated my-team, fall back to public squad
  const picks = myTeamData?.picks ?? squadData?.picks ?? null
  const bankBalance =
    myTeamData?.entry_history?.bank ?? squadData?.entry_history?.bank ?? 0
  const sellPrices = myTeamData?.picks
    ? Object.fromEntries(myTeamData.picks.map(p => [p.element, p.selling_price]))
    : undefined

  // Initial FT state — mirrors TransferPanel.derivedFtCount pattern (CONTEXT D-06).
  // Authenticated path: derive from event_transfers (0 → rolled FT → available: 2, banked: 1).
  // Active WC/FH chip GW: planner displays as if 1 FT for the current GW.
  // Unauthenticated or pre-load: safe default { available: 1, banked: 0 }.
  const initialFTState: FTState = useMemo(() => {
    if (!isAuthenticated || !myTeamData) return { available: 1, banked: 0 }
    const chip = squadData?.active_chip
    if (chip === 'wildcard' || chip === 'freehit') return { available: 1, banked: 0 }
    const available: 1 | 2 = myTeamData.entry_history.event_transfers === 0 ? 2 : 1
    const banked: 0 | 1 = available === 2 ? 1 : 0
    return { available, banked }
  }, [isAuthenticated, myTeamData, squadData])

  // Button enabled when squad picks and player scores are both loaded
  const canGenerate =
    picks != null && picks.length > 0 && scoredPlayers.length > 0 && startingGw !== null

  function handleGeneratePlan() {
    if (!picks || !startingGw) return
    const result = generatePlan(
      picks,
      scoredPlayers,
      horizon,
      startingGw,
      initialFTState,
      bankBalance,
      sellPrices,
    )
    updatePlanResult(() => ({
      ...result,
      originalSteps: structuredClone(result.steps),
    }))
  }

  function handleManualEdit(stepIndex: number, newBuyId: number) {
    if (!planResult || !startingGw) return
    const playerMap = new Map(scoredPlayers.map(p => [p.id, p]))

    const step = planResult.steps[stepIndex]

    // Guard: can only manually edit a step that has exactly one transfer
    if (step.transfersIn.length === 0 || step.transfersOut.length === 0) return

    const origBuyId = step.transfersIn[0]
    const oldSellId = step.transfersOut[0]

    // New squadAfter for step X: swap the original buy for the new buy
    const newSquadAfter = step.squadAfter.map(id => id === origBuyId ? newBuyId : id)
    const newPositionsAfter = { ...step.positionsAfter }
    const pos = newPositionsAfter[origBuyId]
    if (pos !== undefined) {
      delete newPositionsAfter[origBuyId]
      newPositionsAfter[newBuyId] = pos
    }

    // Derive bank after step X
    const sellPrice = sellPrices?.[oldSellId] ?? (playerMap.get(oldSellId)?.now_cost ?? 0)
    const newBuyCost = playerMap.get(newBuyId)?.now_cost ?? 0
    let bankBeforeStepX = bankBalance
    for (let i = 0; i < stepIndex; i++) {
      const s = planResult.steps[i]
      if (s.transfersOut.length > 0 && s.transfersIn.length > 0) {
        const sp = sellPrices?.[s.transfersOut[0]] ?? (playerMap.get(s.transfersOut[0])?.now_cost ?? 0)
        const bp = playerMap.get(s.transfersIn[0])?.now_cost ?? 0
        bankBeforeStepX = bankBeforeStepX + sp - bp
      }
    }
    const bankAfterStepX = bankBeforeStepX + sellPrice - newBuyCost

    // FT state after step X
    const ftAfterX = ftStateAfterStepIndex(planResult.steps, stepIndex, initialFTState)

    // Build synthetic picks from new squad state
    const syntheticPicks: SquadPick[] = newSquadAfter.map(id => ({
      element: id,
      position: newPositionsAfter[id],
      multiplier: 1,
      is_captain: false,
      is_vice_captain: false,
    }))

    // Re-run engine from step X+1
    const remainingHorizon = planResult.horizon - (stepIndex + 1)
    const newStepsFromXPlus1 = remainingHorizon > 0
      ? generatePlanFrom(
          syntheticPicks, scoredPlayers, remainingHorizon,
          startingGw + stepIndex + 1, ftAfterX, bankAfterStepX, sellPrices,
        )
      : []

    // Single Immer mutation: update step X + splice in new steps
    updatePlanResult(draft => {
      if (!draft) return
      const draftStep = draft.steps[stepIndex]
      draftStep.transfersIn = [newBuyId]
      draftStep.hitCost = computeHitCost(draftStep.freeTransfersAvailable, 1, null)  // re-derive
      draftStep.squadAfter = newSquadAfter
      draftStep.positionsAfter = newPositionsAfter
      draft.steps.splice(stepIndex + 1, draft.steps.length - stepIndex - 1, ...newStepsFromXPlus1)
      // DO NOT touch draft.originalSteps — readonly, never mutated
    })
  }

  function handleRestoreSuggested(stepIndex: number) {
    if (!planResult) return
    const originalBuyId = planResult.originalSteps[stepIndex]?.transfersIn[0]
    if (originalBuyId === undefined) return
    const currentStep = planResult.steps[stepIndex]
    if (currentStep.transfersOut.length === 0) return  // no sell to restore against
    handleManualEdit(stepIndex, originalBuyId)
  }

  function handleChipToggle(stepIndex: number, chip: PlannerChip) {
    if (!planResult || !startingGw || !picks) return

    const currentStep = planResult.steps[stepIndex]
    const newChip: PlannerChip = currentStep.chip === chip ? null : chip

    // BB / 3xc: no engine re-generation — just compute bonus value and set chip
    if (chip === 'bboost' || chip === '3xc') {
      const playerMap = new Map(scoredPlayers.map(p => [p.id, p]))
      let bonusValue: number | undefined
      if (newChip === 'bboost') {
        bonusValue = Object.entries(currentStep.positionsAfter)
          .filter(([, pos]) => pos >= 12)
          .reduce((sum, [idStr]) => {
            const p = playerMap.get(Number(idStr))
            return sum + (p ? (p.xPts_1gw ?? 0) * fixtureCountForGw(p, currentStep.gw) : 0)
          }, 0)
      } else if (newChip === '3xc') {
        const bestCaptainPts = Object.entries(currentStep.positionsAfter)
          .filter(([, pos]) => pos >= 1 && pos <= 11)
          .reduce((best, [idStr]) => {
            const p = playerMap.get(Number(idStr))
            const pts = p ? (p.xPts_1gw ?? 0) * fixtureCountForGw(p, currentStep.gw) : 0
            return pts > best ? pts : best
          }, 0)
        bonusValue = bestCaptainPts // extra 1× on top of normal 2× captaincy
      }
      updatePlanResult(draft => {
        if (!draft) return
        draft.steps[stepIndex].chip = newChip
        draft.steps[stepIndex].bbValue = bonusValue
      })
      return
    }

    // WC / FH helpers
    const playerMap = new Map(scoredPlayers.map(p => [p.id, p]))

    function getPicksBeforeStep(): SquadPick[] {
      if (stepIndex === 0) return picks!
      return squadPicksFromStep(planResult!.steps[stepIndex - 1])
    }

    function getBankBeforeStep(): number {
      let bank = bankBalance
      for (let i = 0; i < stepIndex; i++) {
        const s = planResult!.steps[i]
        for (let j = 0; j < s.transfersOut.length; j++) {
          const sp = sellPrices?.[s.transfersOut[j]] ?? (playerMap.get(s.transfersOut[j])?.now_cost ?? 0)
          const bp = playerMap.get(s.transfersIn[j])?.now_cost ?? 0
          bank = bank + sp - bp
        }
      }
      return bank
    }

    const ftBeforeStep = stepIndex === 0
      ? initialFTState
      : ftStateAfterStepIndex(planResult.steps, stepIndex - 1, initialFTState)

    if (newChip === 'wildcard' || newChip === 'freehit') {
      const picksBeforeStep = getPicksBeforeStep()
      const bankBeforeStep = getBankBeforeStep()

      const chipResult = generateChipStep(
        picksBeforeStep, scoredPlayers, currentStep.gw, bankBeforeStep, sellPrices,
      )

      const ftAfterChip = computeNextFTState(
        ftBeforeStep.available, chipResult.transfersIn.length, newChip,
      )

      // FH reverts squad for subsequent weeks; WC carries the new squad forward
      const picksForSubseq: SquadPick[] = newChip === 'freehit'
        ? picksBeforeStep
        : chipResult.squadAfter.map(id => ({
            element: id,
            position: chipResult.positionsAfter[id],
            multiplier: 1,
            is_captain: false,
            is_vice_captain: false,
          }))
      const bankForSubseq = newChip === 'freehit' ? bankBeforeStep : chipResult.bankAfter

      const remainingHorizon = planResult.horizon - (stepIndex + 1)
      const newStepsFromNext = remainingHorizon > 0
        ? generatePlanFrom(
            picksForSubseq, scoredPlayers, remainingHorizon,
            startingGw + stepIndex + 1, ftAfterChip, bankForSubseq, sellPrices,
          )
        : []

      updatePlanResult(draft => {
        if (!draft) return
        const s = draft.steps[stepIndex]
        s.chip = newChip
        s.transfersIn = chipResult.transfersIn
        s.transfersOut = chipResult.transfersOut
        s.squadAfter = chipResult.squadAfter
        s.positionsAfter = chipResult.positionsAfter
        s.hitCost = 0
        s.freeTransfersAvailable = ftBeforeStep.available
        s.chipGain = chipResult.chipGain
        s.bbValue = undefined
        draft.steps.splice(stepIndex + 1, draft.steps.length - stepIndex - 1, ...newStepsFromNext)
      })

    } else {
      // Toggling WC/FH off — restore original step and re-score downstream
      const origStep = planResult.originalSteps[stepIndex]
      if (!origStep) return

      const ftAfterRestored = computeNextFTState(
        ftBeforeStep.available, origStep.transfersIn.length, null,
      )
      const bankBeforeStep = getBankBeforeStep()
      let bankAfterRestored = bankBeforeStep
      for (let j = 0; j < origStep.transfersOut.length; j++) {
        const sp = sellPrices?.[origStep.transfersOut[j]] ?? (playerMap.get(origStep.transfersOut[j])?.now_cost ?? 0)
        const bp = playerMap.get(origStep.transfersIn[j])?.now_cost ?? 0
        bankAfterRestored = bankAfterRestored + sp - bp
      }
      const picksAfterRestored: SquadPick[] = origStep.squadAfter.map(id => ({
        element: id,
        position: origStep.positionsAfter[id],
        multiplier: 1,
        is_captain: false,
        is_vice_captain: false,
      }))

      const remainingHorizon = planResult.horizon - (stepIndex + 1)
      const newStepsFromNext = remainingHorizon > 0
        ? generatePlanFrom(
            picksAfterRestored, scoredPlayers, remainingHorizon,
            startingGw + stepIndex + 1, ftAfterRestored, bankAfterRestored, sellPrices,
          )
        : []

      updatePlanResult(draft => {
        if (!draft) return
        const s = draft.steps[stepIndex]
        s.chip = null
        s.transfersIn = origStep.transfersIn
        s.transfersOut = origStep.transfersOut
        s.squadAfter = origStep.squadAfter
        s.positionsAfter = origStep.positionsAfter
        s.hitCost = origStep.hitCost
        s.freeTransfersAvailable = origStep.freeTransfersAvailable
        s.chipGain = undefined
        s.bbValue = undefined
        draft.steps.splice(stepIndex + 1, draft.steps.length - stepIndex - 1, ...newStepsFromNext)
      })
    }
  }

  return (
    <div className="space-y-6">
      <ChipStrategyPanel
        teamId={teamId}
        scoredPlayers={scoredPlayers}
        clubForm={clubFormData}
        picks={picks}
        bankBalance={bankBalance}
        sellPrices={sellPrices}
        startingGw={startingGw}
      />
      <button
        disabled={!canGenerate}
        onClick={handleGeneratePlan}
        className={`px-4 py-2 rounded text-sm font-medium ${
          canGenerate
            ? 'bg-ink text-surface-1 hover:bg-ink/90 cursor-pointer'
            : 'bg-ink text-surface-1 opacity-40 cursor-not-allowed'
        }`}
      >
        Generate Plan
      </button>
      <details className="text-sm text-ink-muted">
        <summary className="cursor-pointer select-none hover:text-ink">
          How do chips work in the planner?
        </summary>
        <ul className="mt-2 ml-4 space-y-1 list-disc">
          <li><span className="font-medium text-ink">Wildcard</span> — re-plans that week with up to 3 free transfers, no hit cost. New squad carries forward.</li>
          <li><span className="font-medium text-ink">Free Hit</span> — same as Wildcard but your squad reverts the following week.</li>
          <li><span className="font-medium text-ink">Bench Boost</span> — shows expected points from your bench players for that week as bonus gain.</li>
          <li><span className="font-medium text-ink">Triple Captain</span> — shows expected extra captain pts (your best XI player&apos;s proj pts, since 3× instead of 2×).</li>
        </ul>
      </details>

      {planResult && (
        <TransferPlanTable
          planResult={planResult}
          scoredPlayers={scoredPlayers}
          onChipToggle={handleChipToggle}
          onManualEdit={handleManualEdit}
          onRestoreSuggested={handleRestoreSuggested}
        />
      )}
    </div>
  )
}
