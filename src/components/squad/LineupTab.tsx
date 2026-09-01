'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSquad } from '@/lib/hooks/useSquad'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { optimiseLineup } from '@/lib/optimise-lineup'
import { isLegalSwap, applySwap } from '@/lib/lineup-swap'
import type { OptimisedLineup, MergedPlayer } from '@/lib/types'
import { teamKitUrl } from '@/lib/fpl-images'
import { TEAM_BADGE_CODE } from '@/lib/team-colours'
import { useTeamBadge } from '@/lib/hooks/useTeamBadge'
import { countPlayersWithFixture } from '@/lib/blank-gameweek'

// Position codes (mirrors src/lib/optimise-lineup.ts internals)
const GK = 1
const DEF = 2
const MID = 3
const FWD = 4

interface LineupTabProps {
  teamId: string   // submitted id from page.tsx; empty string = no submission
}

// ─── PlayerCard sub-component ───────────────────────────────────────────────

interface PlayerCardProps {
  id: number
  player: MergedPlayer
  isPending: boolean
  isLegalTarget: boolean
  isIncompatible: boolean
  isCaptain: boolean
  isViceCaptain: boolean
  onTap: (id: number) => void
  // Phase 76 OPT-01 — pill callbacks; body tap (onTap) keeps existing swap semantics.
  onSetCaptain: (id: number) => void
  onSetVc: (id: number) => void
  canSetCaptain: boolean   // false when this card is already the captain (disables Set C)
  canSetVc: boolean        // false when this card is already the captain OR VC (disables Set VC)
}

function PlayerCard({
  id, player, isPending, isLegalTarget, isIncompatible, isCaptain, isViceCaptain,
  onTap, onSetCaptain, onSetVc, canSetCaptain, canSetVc,
}: PlayerCardProps) {
  const { onError, showFallback, fallbackColour } = useTeamBadge(player.team_short_name)
  const teamCode = TEAM_BADGE_CODE[player.team_short_name]

  const wrapperCls = 'relative flex flex-col items-stretch w-full max-w-[96px] sm:max-w-[112px] gap-1'
  // bg lives on stateCls (not the base) so the armed warning fill never conflicts
  // with the resting surface fill (Tailwind conflict order is stylesheet order).
  const bodyBaseCls = 'relative flex flex-col items-stretch justify-center min-h-[64px] sm:min-h-[72px] w-full rounded border px-2 py-2 text-left transition-shadow'
  // UIX-04 ruling 3: armed swap state → warning ring; legal target → positive ring
  const stateCls = isPending
    ? 'border-warning bg-warning-soft ring-2 ring-warning ring-offset-1 ring-offset-surface-1'
    : isLegalTarget
    ? 'border-line bg-surface-2 ring-2 ring-positive ring-offset-1 ring-offset-surface-1 cursor-pointer'
    : isIncompatible
    ? 'border-line bg-surface-2 opacity-40 cursor-not-allowed'
    : 'border-line bg-surface-2 cursor-pointer hover:bg-line'
  const pillBase = 'flex-1 px-2 py-1 text-xs min-h-[44px] rounded border bg-surface-1 transition-all duration-150 cursor-pointer'
  const pillIdle = 'border-line text-ink hover:bg-surface-2'
  const pillDisabled = 'border-line text-ink-muted opacity-50 cursor-not-allowed'
  // UI-SPEC LOCKED DECISION (Phase 76): direct-commit pills, no arm state.
  // See UI-SPEC.md §OPT-01 line 202 + §Rejected Patterns line 312.
  return (
    <div className={wrapperCls} data-testid={`pitch-card-${id}`}>
      <button
        type="button"
        // CRITICAL Pitfall 7 (preserved): stopPropagation prevents the pitch background's onClick
        // from firing right after a card click and immediately disarming the pending state.
        onClick={(e) => { e.stopPropagation(); onTap(id) }}
        disabled={isIncompatible}
        data-testid={`pitch-card-body-${id}`}
        data-pending={isPending ? 'true' : undefined}
        data-legal-target={isLegalTarget ? 'true' : undefined}
        className={`${bodyBaseCls} ${stateCls}`}
      >
        {/* Phase 77 OPT-02: kit image + text column in horizontal flex inside body */}
        <div className="flex flex-row items-center gap-2 w-full">
          {showFallback ? (
            <div
              role="img"
              aria-label={`${player.team_short_name} team colour`}
              data-testid={`pitch-card-kit-fallback-${id}`}
              className="w-6 h-6 sm:w-7 sm:h-7 rounded shrink-0"
              style={{ background: fallbackColour }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={teamKitUrl(teamCode!)}
              alt={`${player.team_short_name} kit`}
              width={28}
              height={28}
              data-testid={`pitch-card-kit-${id}`}
              className="w-6 h-6 sm:w-7 sm:h-7 object-contain shrink-0"
              onError={onError}
            />
          )}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-semibold text-ink truncate">
              {player.web_name}
            </span>
            <span className="text-xs font-semibold text-ink">
              {(player.xPts_1gw ?? 0).toFixed(1)}
            </span>
            <span className="text-[10px] text-ink-muted">
              {Math.round((player.start_prob ?? 0) * 100)}%
            </span>
          </div>
        </div>
        {isCaptain && (
          <span className="absolute top-1 right-1 text-xs font-semibold text-warning" data-testid="captain-badge">
            C
          </span>
        )}
        {isViceCaptain && (
          <span className="absolute top-1 right-1 text-xs font-semibold text-ink-muted" data-testid="vc-badge">
            VC
          </span>
        )}
      </button>
      {/* Phase 76 OPT-01: per-card Set C / Set VC pills (siblings of body button to avoid nested <button>) */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSetCaptain(id) }}
          disabled={!canSetCaptain}
          aria-disabled={!canSetCaptain}
          aria-label={canSetCaptain ? `Make ${player.web_name} captain` : 'Captain'}
          data-testid={`set-c-${id}`}
          className={`${pillBase} ${canSetCaptain ? pillIdle : pillDisabled}`}
        >
          Set C
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSetVc(id) }}
          disabled={!canSetVc}
          aria-disabled={!canSetVc}
          aria-label={canSetVc ? `Make ${player.web_name} vice-captain` : (isCaptain ? 'Vice-captain — already captain' : 'Vice-captain')}
          data-testid={`set-vc-${id}`}
          className={`${pillBase} ${canSetVc ? pillIdle : pillDisabled}`}
        >
          Set VC
        </button>
      </div>
    </div>
  )
}

// ─── PitchRow sub-component ─────────────────────────────────────────────────

interface PitchRowProps {
  position: 'GK' | 'DEF' | 'MID' | 'FWD' | 'Bench'
  ids: number[]
  playerMap: Map<number, MergedPlayer>
  pendingStarterId: number | null
  legalBenchIds: Set<number> | null
  onCardTap: (id: number) => void
  effectiveCaptainId: number
  effectiveVcId: number
  onSetCaptain: (id: number) => void
  onSetVc: (id: number) => void
  isBench?: boolean
}

function PitchRow({
  position, ids, playerMap, pendingStarterId, legalBenchIds, onCardTap,
  effectiveCaptainId, effectiveVcId, onSetCaptain, onSetVc, isBench = false,
}: PitchRowProps) {
  return (
    <div className="flex items-stretch gap-2 sm:gap-3" data-testid={`pitch-row-${position.toLowerCase()}`}>
      <div className="text-[10px] font-semibold uppercase text-ink-muted tracking-wide w-10 self-center">
        {position}
      </div>
      <div className="flex-1 flex justify-around gap-2 sm:gap-3">
        {ids.map(id => {
          const player = playerMap.get(id)
          if (!player) return null
          const isPending = id === pendingStarterId
          const isLegalTarget = isBench && legalBenchIds?.has(id) === true
          const isIncompatible = isBench && legalBenchIds !== null && !legalBenchIds.has(id)
          const isCaptain = id === effectiveCaptainId
          const isViceCaptain = id === effectiveVcId
          return (
            <PlayerCard
              key={id}
              id={id}
              player={player}
              isPending={isPending}
              isLegalTarget={isLegalTarget}
              isIncompatible={isIncompatible}
              isCaptain={isCaptain}
              isViceCaptain={isViceCaptain}
              onTap={onCardTap}
              onSetCaptain={onSetCaptain}
              onSetVc={onSetVc}
              canSetCaptain={!isCaptain}
              canSetVc={!isCaptain && !isViceCaptain}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── LineupTab main export ───────────────────────────────────────────────────

export function LineupTab({ teamId }: LineupTabProps) {
  const submittedId = teamId.trim() === '' ? null : teamId.trim()
  const { data: squadData, isLoading: squadLoading, error: squadError } = useSquad(submittedId)
  const { data: playersData, isLoading: playersLoading } = usePlayers()
  const isLoading = squadLoading || playersLoading

  // Compute initial recommendation (memoised — recomputes only when squad or players data changes)
  const { initialLineup, playerMap, eligibleCount, totalPlayersInSquad } = useMemo(() => {
    if (!squadData || !playersData) {
      return {
        initialLineup: null,
        playerMap: new Map<number, MergedPlayer>(),
        eligibleCount: 0,
        totalPlayersInSquad: 0,
      }
    }
    const map = new Map<number, MergedPlayer>(playersData.map(p => [p.id, p]))
    // BGW-02 (2026-09-01): count players with an actual FIXTURE. This used to
    // test `xPts_1gw !== 0`, which is a projection, not a fixture — two squad
    // fillers with no expected minutes made a normal gameweek report "only 13
    // of your 15 players have a fixture".
    const eligible = countPlayersWithFixture(squadData.picks, map)
    const result = optimiseLineup(squadData.picks, playersData, 1)   // horizon=1 per D-02
    return {
      initialLineup: result,
      playerMap: map,
      eligibleCount: eligible,
      totalPlayersInSquad: squadData.picks.length,
    }
  }, [squadData, playersData])

  // Override state: held lineup; starts as initialLineup, mutated by swaps, restored by Reset.
  // Pitfall 6: any data refetch resets overrides — accepted as session-only behaviour per D-08.
  const [lineup, setLineup] = useState<OptimisedLineup | null>(initialLineup)

  // Swap state machine (RESEARCH.md Pattern 5):
  const [pendingStarterId, setPendingStarterId] = useState<number | null>(null)

  // Phase 76 OPT-01: captain/VC override (session-only; cleared by Reset and squad refresh).
  const [captainOverrideId, setCaptainOverrideId] = useState<number | null>(null)
  const [vcOverrideId, setVcOverrideId] = useState<number | null>(null)

  useEffect(() => {
    setLineup(initialLineup)
    setPendingStarterId(null)
    setCaptainOverrideId(null)   // Phase 76 OPT-01: clear override on squad refresh (Pitfall 2)
    setVcOverrideId(null)
  }, [initialLineup])

  function handleStarterTap(id: number) {
    setPendingStarterId(prev => prev === id ? null : id)
  }
  function handleBenchTap(benchId: number) {
    if (pendingStarterId === null || !lineup) return
    // Defence in depth (Pitfall 4): re-check legality even though incompatible cards are disabled.
    if (!isLegalSwap(lineup, pendingStarterId, benchId, playerMap)) return
    setLineup(applySwap(lineup, pendingStarterId, benchId, playerMap))
    setPendingStarterId(null)
  }
  function handleBackgroundTap() {
    setPendingStarterId(null)
  }
  function handleReset() {
    setPendingStarterId(null)
    setLineup(initialLineup)
    setCaptainOverrideId(null)   // Phase 76 OPT-01
    setVcOverrideId(null)
  }

  // Compute legal bench targets when a starter is armed (memoised on pendingStarterId + lineup).
  const legalBenchIds = useMemo(() => {
    if (pendingStarterId === null || !lineup) return null
    const set = new Set<number>()
    for (const benchId of lineup.bench) {
      if (isLegalSwap(lineup, pendingStarterId, benchId, playerMap)) set.add(benchId)
    }
    return set
  }, [pendingStarterId, lineup, playerMap])

  // ───── Render branches ─────

  if (submittedId === null) {
    return (
      <section className="mt-6 space-y-3" data-testid="lineup-tab">
        <h2 className="text-base font-semibold text-ink">Optimised Lineup</h2>
        <div className="rounded border border-line p-6 text-center text-sm text-ink-muted">
          Enter your FPL Team ID on the Transfers tab to see your optimised lineup.
        </div>
      </section>
    )
  }

  if (isLoading) {
    return (
      <section className="mt-6 space-y-3" data-testid="lineup-tab">
        <h2 className="text-base font-semibold text-ink">Optimised Lineup</h2>
        <div className="rounded border border-line p-4 text-sm text-ink-muted">
          Loading squad...
        </div>
      </section>
    )
  }

  if (squadError) {
    const errorMessage = squadError instanceof Error && squadError.message
      ? squadError.message
      : 'Unable to load squad data. Please try again.'
    return (
      <section className="mt-6 space-y-3" data-testid="lineup-tab">
        <h2 className="text-base font-semibold text-ink">Optimised Lineup</h2>
        <div className="rounded border border-negative/40 bg-negative-soft p-4 text-sm text-negative">
          {errorMessage}
        </div>
      </section>
    )
  }

  if (lineup === null) {
    return (
      <section className="mt-6 space-y-3" data-testid="lineup-tab">
        <h2 className="text-base font-semibold text-ink">Optimised Lineup</h2>
        {eligibleCount < 11 ? (
          <div
            className="rounded border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning"
            data-testid="bgw-banner-critical"
          >
            <span className="font-semibold">Warning:</span>{' '}
            fewer than 11 eligible starters — only {eligibleCount} of your {totalPlayersInSquad} players have a fixture this gameweek. Optimised lineup may include bench players.
          </div>
        ) : (
          <div className="rounded border border-negative/40 bg-negative-soft p-4 text-sm text-negative">
            Unable to optimise lineup. Please try again.
          </div>
        )}
      </section>
    )
  }

  // ───── Lineup-rendered branch ─────
  // Group starters by element_type for the pitch rows.
  const starterGks  = lineup.starters.filter(id => playerMap.get(id)?.element_type === GK)
  const starterDefs = lineup.starters.filter(id => playerMap.get(id)?.element_type === DEF)
  const starterMids = lineup.starters.filter(id => playerMap.get(id)?.element_type === MID)
  const starterFwds = lineup.starters.filter(id => playerMap.get(id)?.element_type === FWD)

  // Phase 76 OPT-01: effective captain/VC and the override handlers.
  // Direct-commit pill model per UI-SPEC §OPT-01 (no arm state, no pendingCaptainArmedId).
  const effectiveCaptainId = captainOverrideId ?? lineup.captainId
  const effectiveVcId = vcOverrideId ?? lineup.vcId

  const setCaptain = (id: number) => {
    if (id === effectiveCaptainId) return  // no-op (defence in depth; pill is also disabled)
    // Auto-shuffle: if the new captain was the VC, move VC to the previous captain.
    if (id === effectiveVcId) {
      setVcOverrideId(effectiveCaptainId)
    }
    setCaptainOverrideId(id)
    setPendingStarterId(null)              // mutual exclusion with swap arm
  }

  const setVc = (id: number) => {
    if (id === effectiveCaptainId) return  // disabled but defence in depth
    if (id === effectiveVcId) return       // no-op
    setVcOverrideId(id)
    setPendingStarterId(null)
  }

  // Total xPts: sum of starters' xPts_1gw + captain's xPts_1gw (captain doubles per FPL rules).
  const sumStarterXpts = lineup.starters.reduce((acc, id) => {
    const p = playerMap.get(id)
    return acc + ((p?.xPts_1gw ?? 0))
  }, 0)
  const captainBonus = playerMap.get(effectiveCaptainId)?.xPts_1gw ?? 0
  const totalXPts = sumStarterXpts + captainBonus

  const onCardTap = (id: number) => {
    if (lineup.starters.includes(id)) handleStarterTap(id)
    else if (lineup.bench.includes(id)) handleBenchTap(id)
  }

  return (
    <section className="mt-6 space-y-3" data-testid="lineup-tab">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">Optimised Lineup</h2>
        <button
          type="button"
          onClick={handleReset}
          data-testid="lineup-reset"
          aria-label="Reset to recommended lineup"
          className="bg-ink text-surface-1 font-semibold rounded min-h-[44px] px-3 py-2 text-sm hover:opacity-90 cursor-pointer"
        >
          Reset
        </button>
      </header>

      {eligibleCount < totalPlayersInSquad && eligibleCount >= 11 && (
        <div
          className="rounded border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning"
          data-testid="bgw-banner-soft"
        >
          <span className="font-semibold">Blank gameweek warning:</span>{' '}
          only {eligibleCount} of your {totalPlayersInSquad} players have a fixture this gameweek.
        </div>
      )}

      <div data-testid="lineup-headline-row" className="flex flex-wrap items-center gap-2 text-sm text-ink py-2">
        <span><span className="font-semibold">Formation:</span> {lineup.formation}</span>
        <span className="text-ink-muted">│</span>
        <span><span className="font-semibold">Captain:</span> {playerMap.get(lineup.captainId)?.web_name ?? '—'}</span>
        <span className="text-ink-muted">│</span>
        <span className="font-semibold text-positive">Total xPts: {totalXPts.toFixed(1)}</span>
      </div>

      <div
        className="bg-surface-2/40 rounded border border-line px-2 sm:px-4 py-3 sm:py-4 space-y-2"
        onClick={handleBackgroundTap}
        data-testid="pitch"
      >
        <PitchRow position="GK"  ids={starterGks}  playerMap={playerMap} pendingStarterId={pendingStarterId} legalBenchIds={legalBenchIds} onCardTap={onCardTap} effectiveCaptainId={effectiveCaptainId} effectiveVcId={effectiveVcId} onSetCaptain={setCaptain} onSetVc={setVc} />
        <PitchRow position="DEF" ids={starterDefs} playerMap={playerMap} pendingStarterId={pendingStarterId} legalBenchIds={legalBenchIds} onCardTap={onCardTap} effectiveCaptainId={effectiveCaptainId} effectiveVcId={effectiveVcId} onSetCaptain={setCaptain} onSetVc={setVc} />
        <PitchRow position="MID" ids={starterMids} playerMap={playerMap} pendingStarterId={pendingStarterId} legalBenchIds={legalBenchIds} onCardTap={onCardTap} effectiveCaptainId={effectiveCaptainId} effectiveVcId={effectiveVcId} onSetCaptain={setCaptain} onSetVc={setVc} />
        <PitchRow position="FWD" ids={starterFwds} playerMap={playerMap} pendingStarterId={pendingStarterId} legalBenchIds={legalBenchIds} onCardTap={onCardTap} effectiveCaptainId={effectiveCaptainId} effectiveVcId={effectiveVcId} onSetCaptain={setCaptain} onSetVc={setVc} />
        <div className="border-t border-line mt-4 pt-4">
          <PitchRow position="Bench" ids={lineup.bench} playerMap={playerMap} pendingStarterId={pendingStarterId} legalBenchIds={legalBenchIds} onCardTap={onCardTap} effectiveCaptainId={effectiveCaptainId} effectiveVcId={effectiveVcId} onSetCaptain={setCaptain} onSetVc={setVc} isBench />
        </div>
      </div>

      <p className="text-xs italic text-ink-muted">
        Tap a starter, then tap a bench player to swap. Tap elsewhere to cancel.
      </p>
    </section>
  )
}
