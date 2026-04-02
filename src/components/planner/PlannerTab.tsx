'use client'

import { useState, useMemo } from 'react'
import { HorizonSelector } from './HorizonSelector'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useSquad } from '@/lib/hooks/useSquad'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { computeAllGemScores } from '@/lib/gem-score'
import { generatePlan } from '@/lib/planning-engine'
import type { PlanResult, FTState, PlannerHorizon } from '@/lib/types'

export function PlannerTab() {
  const [horizon, setHorizon] = useState<PlannerHorizon>(3)
  const [planResult, setPlanResult] = useState<PlanResult | null>(null)

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

  // Convert MergedPlayer[] → ScoredPlayer[] (same pattern as GemTable)
  const scoredPlayers = useMemo(
    () => computeAllGemScores(playersData ?? []),
    [playersData]
  )

  // Derive starting GW from the first upcoming fixture across scored players
  const startingGw = scoredPlayers[0]?.fixtures[0]?.event_id ?? null

  // Hybrid squad data (per D-04): prefer authenticated my-team, fall back to public squad
  const picks = myTeamData?.picks ?? squadData?.picks ?? null
  const bankBalance =
    myTeamData?.entry_history?.bank ?? squadData?.entry_history?.bank ?? 0
  const sellPrices = myTeamData?.picks
    ? Object.fromEntries(myTeamData.picks.map(p => [p.element, p.selling_price]))
    : undefined

  // Conservative default FT state when exact count is unknown
  const initialFTState: FTState = { available: 1, banked: 0 }

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
    setPlanResult(result)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
          Planning Horizon
        </h2>
        <HorizonSelector value={horizon} onChange={setHorizon} />
      </div>
      <button
        disabled={!canGenerate}
        onClick={handleGeneratePlan}
        className={`px-4 py-2 rounded text-sm font-medium ${
          canGenerate
            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 cursor-pointer'
            : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 opacity-40 cursor-not-allowed'
        }`}
      >
        Generate Plan
      </button>
      {planResult && (
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Plan generated: {planResult.steps.length} gameweek(s) starting GW{planResult.startingGw}
        </div>
      )}
    </div>
  )
}
