'use client'

// Phase 43: OptimiserPanel — full pitch UI (Plan 03)
// Replaces the Plan 01 stub. Renders the optimised lineup on a green pitch with FPL convention
// (GK at bottom, FWD at top). Calls optimiseLineup() pure engine; reuses GwToggle for horizon.
// All Tailwind classes, copy strings, and layout structure follow 43-UI-SPEC.md.
import { useState, useMemo } from 'react'
import { useSquad } from '@/lib/hooks/useSquad'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { GwToggle } from '@/components/gem-table/GwToggle'
import { optimiseLineup } from '@/lib/optimise-lineup'
import type { OptimiserHorizon, MergedPlayer } from '@/lib/types'

interface OptimiserPanelProps {
  // teamId is the SUBMITTED team id (page.tsx passes `submittedId ?? ''`). Empty string means
  // user has not yet submitted a team id — show empty state.
  teamId: string
}

// Position codes (mirrors src/lib/optimise-lineup.ts internals)
const GK = 1
const DEF = 2
const MID = 3
const FWD = 4

// Field name lookup for horizon-aware xPts display (matches HORIZON_FIELD in the engine)
const HORIZON_FIELD: Record<OptimiserHorizon, 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw'> = {
  1: 'xPts_1gw',
  3: 'xPts_3gw',
  5: 'xPts_5gw',
}

// Renders one player circle (used for both pitch starters and bench slots).
// isCaptain / isVc / isBench affect badge labels and opacity.
function PlayerCircle({
  player,
  horizonField,
  isCaptain = false,
  isVc = false,
  isBench = false,
}: {
  player: MergedPlayer
  horizonField: 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw'
  isCaptain?: boolean
  isVc?: boolean
  isBench?: boolean
}) {
  const xPts = (player[horizonField] as number | undefined) ?? 0
  const truncatedName = player.web_name.slice(0, 7)
  return (
    <div className={`flex flex-col items-center w-16 ${isBench ? 'opacity-75' : ''}`} data-testid={`player-circle-${player.id}`}>
      <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center relative">
        <span className="text-[10px] font-semibold text-zinc-900 dark:text-zinc-100 text-center leading-tight px-0.5 truncate max-w-[44px]">
          {truncatedName}
        </span>
      </div>
      <span className="text-[10px] text-green-300 mt-1">{xPts.toFixed(1)}</span>
      {isCaptain && (
        <span className="text-[10px] font-semibold text-amber-400" data-testid={`captain-badge-${player.id}`}>(C)</span>
      )}
      {isVc && (
        <span className="text-[10px] font-semibold text-zinc-400" data-testid={`vc-badge-${player.id}`}>(VC)</span>
      )}
    </div>
  )
}

export function OptimiserPanel({ teamId }: OptimiserPanelProps) {
  const [horizon, setHorizon] = useState<OptimiserHorizon>(1)

  // teamId is the submitted id from page.tsx. Pass null to useSquad when empty so the query is disabled.
  const submittedId = teamId.trim() === '' ? null : teamId.trim()
  const { data: squadData, isLoading: squadLoading, error: squadError } = useSquad(submittedId)
  const { data: playersData, isLoading: playersLoading } = usePlayers()

  const isLoading = squadLoading || playersLoading
  const horizonField = HORIZON_FIELD[horizon]

  // Build playerMap and the optimised lineup (memoised so toggling horizon recomputes O(1,365)).
  const { playerMap, lineup, eligibleCount, totalPlayersInSquad } = useMemo(() => {
    if (!squadData || !playersData) {
      return { playerMap: new Map<number, MergedPlayer>(), lineup: null, eligibleCount: 0, totalPlayersInSquad: 0 }
    }
    const map = new Map<number, MergedPlayer>(playersData.map(p => [p.id, p]))
    // BGW-eligible count: same logic as the engine (Pitfall 1 — undefined != BGW; only === 0 excludes).
    const eligible = squadData.picks.filter(pick => {
      const p = map.get(pick.element)
      if (!p) return false
      return p.xPts_1gw !== 0
    }).length
    const result = optimiseLineup(squadData.picks, playersData, horizon)
    return { playerMap: map, lineup: result, eligibleCount: eligible, totalPlayersInSquad: squadData.picks.length }
  }, [squadData, playersData, horizon])

  // Empty state: no team id submitted
  if (submittedId === null) {
    return (
      <section className="mt-6 space-y-3" data-testid="optimiser-panel">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Optimised Lineup</h2>
        <div className="rounded border border-zinc-200 dark:border-zinc-700 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Enter your FPL Team ID to see your optimised lineup.
        </div>
      </section>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <section className="mt-6 space-y-3" data-testid="optimiser-panel">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Optimised Lineup</h2>
        <div className="rounded border border-zinc-200 dark:border-zinc-700 p-4 text-sm text-zinc-500 dark:text-zinc-400">
          Loading squad...
        </div>
      </section>
    )
  }

  // Error state (squad fetch failed)
  if (squadError) {
    const errorMessage = squadError instanceof Error && squadError.message
      ? squadError.message
      : 'Unable to load squad data. Please try again.'
    return (
      <section className="mt-6 space-y-3" data-testid="optimiser-panel">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Optimised Lineup</h2>
        <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
          {errorMessage}
        </div>
      </section>
    )
  }

  // No squad data despite loaded (shouldn't happen post-loading, but defensive)
  if (!squadData || !playersData) {
    return (
      <section className="mt-6 space-y-3" data-testid="optimiser-panel">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Optimised Lineup</h2>
        <div className="rounded border border-zinc-200 dark:border-zinc-700 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Load your squad using the Transfers tab, then return here to see your optimised lineup.
        </div>
      </section>
    )
  }

  // BGW critical state: too few eligible starters — engine returned null
  if (lineup === null) {
    return (
      <section className="mt-6 space-y-3" data-testid="optimiser-panel">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Optimised Lineup</h2>
        {eligibleCount < 11 ? (
          <div
            className="rounded border border-amber-400 bg-amber-50 dark:bg-amber-950 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
            data-testid="bgw-banner-critical"
          >
            <span className="font-semibold">Warning:</span>{' '}
            fewer than 11 eligible starters — only {eligibleCount} of your {totalPlayersInSquad} players have a fixture this gameweek. Optimised lineup may include bench players.
          </div>
        ) : (
          <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
            Unable to optimise lineup. Please try again.
          </div>
        )}
      </section>
    )
  }

  // Lineup is non-null: render formation/horizon row + pitch + bench
  const starterGks = lineup.starters.filter((id: number) => playerMap.get(id)?.element_type === GK)
  const starterDefs = lineup.starters.filter((id: number) => playerMap.get(id)?.element_type === DEF)
  const starterMids = lineup.starters.filter((id: number) => playerMap.get(id)?.element_type === MID)
  const starterFwds = lineup.starters.filter((id: number) => playerMap.get(id)?.element_type === FWD)

  // Bench: bench[0] is the GK; bench[1..3] are outfield in xPts desc (already ordered by engine).
  const benchGkPlayer = playerMap.get(lineup.bench[0])!
  const benchOutfieldPlayers = lineup.bench.slice(1).map((id: number) => playerMap.get(id)!).filter(Boolean)

  return (
    <section className="mt-6 space-y-3" data-testid="optimiser-panel">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Optimised Lineup</h2>

      {/* BGW soft warning: some BGW exclusions but still >= 11 eligible — engine returned a lineup but show a notice */}
      {eligibleCount < totalPlayersInSquad && eligibleCount >= 11 && (
        <div
          className="rounded border border-amber-400 bg-amber-50 dark:bg-amber-950 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
          data-testid="bgw-banner-soft"
        >
          <span className="font-semibold">Blank gameweek warning:</span>{' '}
          only {eligibleCount} of your {totalPlayersInSquad} players have a fixture this gameweek.
        </div>
      )}

      {/* Formation label + horizon toggle row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" data-testid="formation-label">
          Formation: {lineup.formation}
        </span>
        <GwToggle value={horizon} onChange={setHorizon} />
      </div>

      {/* Pitch — green background, FWD top, GK bottom (FPL convention) */}
      <div className="relative rounded-lg overflow-hidden bg-green-950 p-4 min-h-[480px]" data-testid="pitch">
        {/* FWD row */}
        <div className="flex justify-center gap-3 mb-3">
          {starterFwds.map((id: number) => {
            const p = playerMap.get(id)!
            return (
              <PlayerCircle
                key={id}
                player={p}
                horizonField={horizonField}
                isCaptain={lineup.captainId === id}
                isVc={lineup.vcId === id}
              />
            )
          })}
        </div>
        {/* MID row */}
        <div className="flex justify-center gap-3 mb-3">
          {starterMids.map((id: number) => {
            const p = playerMap.get(id)!
            return (
              <PlayerCircle
                key={id}
                player={p}
                horizonField={horizonField}
                isCaptain={lineup.captainId === id}
                isVc={lineup.vcId === id}
              />
            )
          })}
        </div>
        {/* DEF row */}
        <div className="flex justify-center gap-3 mb-3">
          {starterDefs.map((id: number) => {
            const p = playerMap.get(id)!
            return (
              <PlayerCircle
                key={id}
                player={p}
                horizonField={horizonField}
                isCaptain={lineup.captainId === id}
                isVc={lineup.vcId === id}
              />
            )
          })}
        </div>
        {/* GK row */}
        <div className="flex justify-center gap-3 mb-3">
          {starterGks.map((id: number) => {
            const p = playerMap.get(id)!
            return (
              <PlayerCircle
                key={id}
                player={p}
                horizonField={horizonField}
                isCaptain={lineup.captainId === id}
                isVc={lineup.vcId === id}
              />
            )
          })}
        </div>

        {/* Bench row */}
        <div className="mt-3 pt-3 border-t border-green-900" data-testid="bench-row">
          <p className="text-xs font-semibold text-green-400 mb-2">Bench</p>
          <div className="flex justify-center gap-3 items-stretch">
            {/* Bench GK slot — slot 0, visually labelled */}
            <div className="flex flex-col items-center" data-testid="bench-gk-slot">
              <span className="text-[10px] text-green-500 mb-1">GK</span>
              <PlayerCircle player={benchGkPlayer} horizonField={horizonField} isBench />
            </div>
            {/* 1px vertical divider between GK and outfield bench */}
            <div className="w-px bg-green-900 self-stretch mx-1" data-testid="bench-divider" />
            {/* Outfield bench slots 1-3 in xPts desc (engine ordering) */}
            {benchOutfieldPlayers.map(p => (
              <div className="flex flex-col items-center" key={p.id} data-testid={`bench-outfield-${p.id}`}>
                <span className="text-[10px] text-green-500 mb-1">&nbsp;</span>
                <PlayerCircle player={p} horizonField={horizonField} isBench />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
