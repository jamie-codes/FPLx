'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSquad } from '@/lib/hooks/useSquad'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { optimiseLineup, FORMATIONS, parseFormation, type Formation } from '@/lib/optimise-lineup'
import { isLegalSwap, applySwap } from '@/lib/lineup-swap'
import type { OptimisedLineup, MergedPlayer } from '@/lib/types'
import { teamKitUrl } from '@/lib/fpl-images'
import { TEAM_BADGE_CODE } from '@/lib/team-colours'
import { useTeamBadge } from '@/lib/hooks/useTeamBadge'
import { countPlayersWithFixture, nextGameweekId } from '@/lib/blank-gameweek'

// Position codes (mirrors src/lib/optimise-lineup.ts internals)
const GK = 1
const DEF = 2
const MID = 3
const FWD = 4

// PITCH-01: below this the card shows an amber start-probability flag. Above it
// the number is noise on every card — it used to be a permanent third text line.
const START_PROB_FLAG_BELOW = 0.85

interface LineupTabProps {
  teamId: string   // submitted id from page.tsx; empty string = no submission
}

// ─── Fixture chip ───────────────────────────────────────────────────────────

/** PITCH-01: bucket the 0-1 difficulty score into the 1-5 FDR ramp.
 *  The brief said to read fixtures from the club-form artifact; MergedPlayer
 *  already carries the same `{opponent_team, is_home, difficulty_score}` shape
 *  (countPlayersWithFixture below reads it), so this needs no second fetch. */
function fdrStep(score: number): 1 | 2 | 3 | 4 | 5 {
  return Math.min(5, Math.max(1, Math.floor(score * 5) + 1)) as 1 | 2 | 3 | 4 | 5
}

const FDR_CLS: Record<number, string> = {
  1: 'bg-fdr-1-bg text-fdr-1-ink',
  2: 'bg-fdr-2-bg text-fdr-2-ink',
  3: 'bg-fdr-3-bg text-fdr-3-ink',
  4: 'bg-fdr-4-bg text-fdr-4-ink',
  5: 'bg-fdr-5-bg text-fdr-5-ink',
}

interface NextFixture { label: string; step: number }

/** Next-gameweek fixture for a player, or null on a blank — the BGW banner
 *  already explains a blank, so the chip simply does not render. */
function nextFixtureOf(player: MergedPlayer, nextGw: number | null): NextFixture | null {
  if (nextGw === null) return null
  const fx = (player.fixtures ?? []).find(f => f.event_id === nextGw)
  if (!fx) return null
  // FPL fixture-list convention: home in caps, away in lower case.
  const opp = fx.is_home ? fx.opponent_team.toUpperCase() : fx.opponent_team.toLowerCase()
  return { label: opp, step: fdrStep(fx.difficulty_score ?? 0.5) }
}

function FixtureChip({ fixture, className = '' }: { fixture: NextFixture | null; className?: string }) {
  if (!fixture) return null
  return (
    <span className={`rounded px-1.5 py-px text-[10px] font-bold tracking-[0.02em] ${FDR_CLS[fixture.step]} ${className}`}>
      {fixture.label}
    </span>
  )
}

// ─── Kit / photo tile ───────────────────────────────────────────────────────

/** The tile shows a player photo when we have one, otherwise the team kit,
 *  otherwise a flat team colour — never one stacked over another.
 *  photo_url is the api-football headshot (PHOTO-01); it is frequently null, so
 *  the kit is chosen up front rather than after a failed request. */
function KitTile({ id, player, size }: { id: number; player: MergedPlayer; size: 'pitch' | 'bench' }) {
  const { onError, showFallback, fallbackColour } = useTeamBadge(player.team_short_name)
  const [photoFailed, setPhotoFailed] = useState(false)
  const teamCode = TEAM_BADGE_CODE[player.team_short_name]
  const usePhoto = Boolean(player.photo_url) && !photoFailed
  const src = usePhoto ? player.photo_url! : teamKitUrl(teamCode!)

  const box = size === 'pitch'
    ? 'w-full max-w-[72px] aspect-[11/13] rounded-t-lg'
    : 'w-[30px] h-[36px] shrink-0 rounded-[5px]'

  if (showFallback) {
    return (
      <div
        role="img"
        aria-label={`${player.team_short_name} team colour`}
        data-testid={`pitch-card-kit-fallback-${id}`}
        className={`${box} shrink-0`}
        style={{ background: fallbackColour }}
      />
    )
  }
  return (
    <div className={`relative ${box} bg-white dark:bg-[#1b201a] overflow-hidden`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={usePhoto ? player.web_name : `${player.team_short_name} kit`}
        data-testid={`pitch-card-kit-${id}`}
        className="w-full h-full object-contain object-bottom"
        // Two-stage fallback: a dead photo drops to the kit, a dead kit drops to
        // the flat team colour. object-bottom keeps heads and shirts at the same
        // height across both, so the swap causes no reflow.
        onError={usePhoto ? () => setPhotoFailed(true) : onError}
      />
    </div>
  )
}

// ─── PlayerCard (starters) ──────────────────────────────────────────────────

interface PlayerCardProps {
  id: number
  player: MergedPlayer
  nextGw: number | null
  isPending: boolean
  isLegalTarget: boolean
  isIncompatible: boolean
  isCaptain: boolean
  isViceCaptain: boolean
  onTap: (id: number) => void
  onSetCaptain: (id: number) => void
  onSetVc: (id: number) => void
  canSetCaptain: boolean
  canSetVc: boolean
  onDragStart: (id: number) => void
  onDragEnd: () => void
  onDropOn: (id: number) => void
}

function PlayerCard({
  id, player, nextGw, isPending, isLegalTarget, isIncompatible, isCaptain, isViceCaptain,
  onTap, onSetCaptain, onSetVc, canSetCaptain, canSetVc, onDragStart, onDragEnd, onDropOn,
}: PlayerCardProps) {
  const fixture = nextFixtureOf(player, nextGw)
  const startProb = player.start_prob ?? 0
  const flagged = startProb < START_PROB_FLAG_BELOW || player.status !== 'a'

  // State styling lives on the button, not a border — a bordered box on grass
  // reads as a table cell, which is the thing this redesign removes.
  const stateCls = isPending
    ? '-translate-y-1 ring-2 ring-warning rounded-lg ring-offset-2 ring-offset-turf'
    : isLegalTarget
    ? 'ring-2 ring-positive rounded-lg ring-offset-2 ring-offset-turf animate-pulse cursor-pointer'
    : isIncompatible
    ? 'opacity-40 cursor-not-allowed'
    : 'hover:-translate-y-0.5 cursor-pointer'

  const pill = 'min-h-[44px] px-2 rounded-md bg-surface-1/95 border border-line text-[11px] font-bold text-ink backdrop-blur-sm shadow disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

  return (
    <div className="relative flex flex-1 min-w-0 max-w-[100px] justify-center" data-testid={`pitch-card-${id}`}>
      <button
        type="button"
        // CRITICAL Pitfall 7 (preserved): stopPropagation prevents the pitch
        // background's onClick from disarming the pending state we just set.
        onClick={(e) => { e.stopPropagation(); onTap(id) }}
        disabled={isIncompatible}
        draggable={!isIncompatible}
        onDragStart={() => onDragStart(id)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => { if (isLegalTarget || isPending) e.preventDefault() }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropOn(id) }}
        data-testid={`pitch-card-body-${id}`}
        data-pending={isPending ? 'true' : undefined}
        data-legal-target={isLegalTarget ? 'true' : undefined}
        className={`relative flex w-full flex-col items-center transition-transform focus-visible:outline-none ${stateCls}`}
      >
        <div className="relative w-full max-w-[72px] shadow-[0_5px_12px_-3px_rgba(0,0,0,0.55)] rounded-t-lg">
          <KitTile id={id} player={player} size="pitch" />
          {isCaptain && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 rounded-full bg-volt text-on-volt text-[10px] font-extrabold grid place-items-center shadow"
              data-testid="captain-badge"
            >
              C
            </span>
          )}
          {isViceCaptain && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 rounded-full bg-surface-1 text-ink border border-line text-[10px] font-extrabold grid place-items-center shadow"
              data-testid="vc-badge"
            >
              VC
            </span>
          )}
          {flagged && (
            <span
              className="absolute top-0.5 left-0.5 rounded bg-warning px-1 text-[9px] font-bold text-surface-1"
              title={`${Math.round(startProb * 100)}% chance of starting`}
            >
              {Math.round(startProb * 100)}%
            </span>
          )}
        </div>
        <div className="w-full max-w-[72px] bg-white/[0.94] dark:bg-[#0c0e0d]/[0.88] backdrop-blur-[4px] px-1 py-[3px] text-center overflow-hidden">
          <span className="block truncate text-data font-bold text-ink">{player.web_name}</span>
        </div>
        <div className="w-full max-w-[72px] rounded-b-md bg-accent text-on-accent px-1 py-[2px] flex items-center justify-center gap-1">
          <span className="text-data font-extrabold tabular">{(player.xPts_1gw ?? 0).toFixed(1)}</span>
          <span className="text-[9px] font-bold tracking-wider opacity-70">XPTS</span>
        </div>
        <FixtureChip fixture={fixture} className="mt-[3px]" />
      </button>

      {/* PITCH-01: the C / VC pills used to sit on all 15 cards — 22 permanent
          buttons around 15 players, which is what made the pitch read as a form.
          They now appear only under the armed card, absolutely positioned so
          they never reserve row height or shift the pitch. */}
      {isPending && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 z-20 mt-1 flex justify-center gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSetCaptain(id) }}
            disabled={!canSetCaptain}
            aria-disabled={!canSetCaptain}
            aria-label={canSetCaptain ? `Make ${player.web_name} captain` : 'Captain'}
            data-testid={`set-c-${id}`}
            className={pill}
          >
            C
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSetVc(id) }}
            disabled={!canSetVc}
            aria-disabled={!canSetVc}
            aria-label={canSetVc ? `Make ${player.web_name} vice-captain` : (isCaptain ? 'Vice-captain — already captain' : 'Vice-captain')}
            data-testid={`set-vc-${id}`}
            className={pill}
          >
            VC
          </button>
        </div>
      )}
    </div>
  )
}

// ─── PitchRow ───────────────────────────────────────────────────────────────

interface PitchRowProps {
  position: 'GK' | 'DEF' | 'MID' | 'FWD'
  ids: number[]
  playerMap: Map<number, MergedPlayer>
  nextGw: number | null
  pendingStarterId: number | null
  onCardTap: (id: number) => void
  effectiveCaptainId: number
  effectiveVcId: number
  onSetCaptain: (id: number) => void
  onSetVc: (id: number) => void
  onDragStart: (id: number) => void
  onDragEnd: () => void
  onDropOn: (id: number) => void
}

function PitchRow({
  position, ids, playerMap, nextGw, pendingStarterId, onCardTap,
  effectiveCaptainId, effectiveVcId, onSetCaptain, onSetVc, onDragStart, onDragEnd, onDropOn,
}: PitchRowProps) {
  // The GK / DEF / MID / FWD label column is gone — the pitch shape says it.
  return (
    <div
      className="flex justify-center items-start gap-3 px-2"
      data-testid={`pitch-row-${position.toLowerCase()}`}
    >
      {ids.map(id => {
        const player = playerMap.get(id)
        if (!player) return null
        return (
          <PlayerCard
            key={id}
            id={id}
            player={player}
            nextGw={nextGw}
            isPending={id === pendingStarterId}
            isLegalTarget={false}
            isIncompatible={false}
            isCaptain={id === effectiveCaptainId}
            isViceCaptain={id === effectiveVcId}
            onTap={onCardTap}
            onSetCaptain={onSetCaptain}
            onSetVc={onSetVc}
            canSetCaptain={id !== effectiveCaptainId}
            canSetVc={id !== effectiveCaptainId && id !== effectiveVcId}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDropOn={onDropOn}
          />
        )
      })}
    </div>
  )
}

// ─── Bench tray ─────────────────────────────────────────────────────────────

interface BenchTrayProps {
  ids: number[]
  playerMap: Map<number, MergedPlayer>
  nextGw: number | null
  legalBenchIds: Set<number> | null
  onCardTap: (id: number) => void
  onDragStart: (id: number) => void
  onDragEnd: () => void
  onDropOn: (id: number) => void
}

function BenchTray({
  ids, playerMap, nextGw, legalBenchIds, onCardTap, onDragStart, onDragEnd, onDropOn,
}: BenchTrayProps) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Bench</span>
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] text-ink-muted">autosub order</span>
      </div>
      {/* Two columns at every width: four would leave the name span ~53px, which
          truncates ordinary names like Mykolenko. */}
      <div className="grid grid-cols-2 gap-2" data-testid="pitch-row-bench">
        {ids.map((id, i) => {
          const player = playerMap.get(id)
          if (!player) return null
          const isLegalTarget = legalBenchIds?.has(id) === true
          const isIncompatible = legalBenchIds !== null && !legalBenchIds.has(id)
          const fixture = nextFixtureOf(player, nextGw)
          const stateCls = isLegalTarget
            ? 'ring-2 ring-positive ring-offset-1 ring-offset-surface-1 animate-pulse cursor-pointer'
            : isIncompatible
            ? 'opacity-40 cursor-not-allowed'
            : 'cursor-pointer hover:bg-surface-2'
          return (
            <div key={id} className="relative" data-testid={`pitch-card-${id}`}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCardTap(id) }}
                disabled={isIncompatible}
                draggable={!isIncompatible}
                onDragStart={() => onDragStart(id)}
                onDragEnd={onDragEnd}
                onDragOver={(e) => { if (isLegalTarget) e.preventDefault() }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropOn(id) }}
                data-testid={`pitch-card-body-${id}`}
                data-legal-target={isLegalTarget ? 'true' : undefined}
                className={`relative flex w-full items-center gap-2 rounded-lg border border-line bg-surface-1 p-2 min-h-[56px] text-left transition-colors ${stateCls}`}
              >
                <span className="absolute top-1 right-1.5 text-[10px] font-bold text-ink-muted tabular">
                  {player.element_type === GK ? 'GK' : i}
                </span>
                <KitTile id={id} player={player} size="bench" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-data font-bold text-ink">{player.web_name}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold tabular text-ink-muted">
                      {(player.xPts_1gw ?? 0).toFixed(1)}
                    </span>
                    <FixtureChip fixture={fixture} />
                    {(player.start_prob ?? 0) < START_PROB_FLAG_BELOW && (
                      <span className="text-[10px] font-bold text-warning">
                        {Math.round((player.start_prob ?? 0) * 100)}%
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </div>
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

  // PITCH-01: null means "the optimiser's own choice".
  const [forcedFormation, setForcedFormation] = useState<Formation | null>(null)

  const {
    initialLineup, optimalLineup, playerMap, eligibleCount, totalPlayersInSquad, nextGw, ownedByPos,
  } = useMemo(() => {
    if (!squadData || !playersData) {
      return {
        initialLineup: null,
        optimalLineup: null,
        playerMap: new Map<number, MergedPlayer>(),
        eligibleCount: 0,
        totalPlayersInSquad: 0,
        nextGw: null as number | null,
        ownedByPos: { [DEF]: 0, [MID]: 0, [FWD]: 0 } as Record<number, number>,
      }
    }
    const map = new Map<number, MergedPlayer>(playersData.map(p => [p.id, p]))
    // BGW-02 (2026-09-01): count players with an actual FIXTURE. This used to
    // test `xPts_1gw !== 0`, which is a projection, not a fixture.
    const eligible = countPlayersWithFixture(squadData.picks, map)
    const optimal = optimiseLineup(squadData.picks, playersData, 1)   // horizon=1 per D-02
    const forced = forcedFormation
      ? optimiseLineup(squadData.picks, playersData, 1, undefined, forcedFormation)
      : null
    // Count owned players per position so unsatisfiable shapes can be disabled
    // in the switcher rather than silently returning no lineup.
    const owned: Record<number, number> = { [DEF]: 0, [MID]: 0, [FWD]: 0 }
    for (const pick of squadData.picks) {
      const p = map.get(pick.element)
      if (p && owned[p.element_type] !== undefined) owned[p.element_type]++
    }
    return {
      initialLineup: forced ?? optimal,
      optimalLineup: optimal,
      playerMap: map,
      eligibleCount: eligible,
      totalPlayersInSquad: squadData.picks.length,
      nextGw: nextGameweekId(playersData),
      ownedByPos: owned,
    }
  }, [squadData, playersData, forcedFormation])

  // Override state: held lineup; starts as initialLineup, mutated by swaps, restored by Reset.
  const [lineup, setLineup] = useState<OptimisedLineup | null>(initialLineup)
  const [pendingStarterId, setPendingStarterId] = useState<number | null>(null)
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
    setForcedFormation(null)     // PITCH-01: Reset returns to the optimiser's choice
    setLineup(initialLineup)
    setCaptainOverrideId(null)
    setVcOverrideId(null)
  }

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
  const starterGks  = lineup.starters.filter(id => playerMap.get(id)?.element_type === GK)
  const starterDefs = lineup.starters.filter(id => playerMap.get(id)?.element_type === DEF)
  const starterMids = lineup.starters.filter(id => playerMap.get(id)?.element_type === MID)
  const starterFwds = lineup.starters.filter(id => playerMap.get(id)?.element_type === FWD)

  const effectiveCaptainId = captainOverrideId ?? lineup.captainId
  const effectiveVcId = vcOverrideId ?? lineup.vcId

  const setCaptain = (id: number) => {
    if (id === effectiveCaptainId) return  // no-op (defence in depth; pill is also disabled)
    // Auto-shuffle: if the new captain was the VC, move VC to the previous captain.
    if (id === effectiveVcId) setVcOverrideId(effectiveCaptainId)
    setCaptainOverrideId(id)
    setPendingStarterId(null)              // mutual exclusion with swap arm
  }
  const setVc = (id: number) => {
    if (id === effectiveCaptainId) return  // disabled but defence in depth
    if (id === effectiveVcId) return       // no-op
    setVcOverrideId(id)
    setPendingStarterId(null)
  }

  const xptsOf = (l: OptimisedLineup, capId: number) =>
    l.starters.reduce((acc, id) => acc + (playerMap.get(id)?.xPts_1gw ?? 0), 0)
    + (playerMap.get(capId)?.xPts_1gw ?? 0)
  const totalXPts = xptsOf(lineup, effectiveCaptainId)
  // Only meaningful once the user has forced a shape — otherwise this IS optimal.
  const optimalXPts = optimalLineup ? xptsOf(optimalLineup, optimalLineup.captainId) : totalXPts
  const xptsDelta = forcedFormation ? totalXPts - optimalXPts : 0

  const derivedFormation = `${starterDefs.length}-${starterMids.length}-${starterFwds.length}`
  const optimalFormation = optimalLineup?.formation ?? derivedFormation

  const onCardTap = (id: number) => {
    if (lineup.starters.includes(id)) handleStarterTap(id)
    else if (lineup.bench.includes(id)) handleBenchTap(id)
  }

  // Drag mirrors the two-tap flow rather than replacing it: dragging a card arms
  // it exactly as a tap would, and dropping runs the same legality check.
  const onDragStart = (id: number) => {
    if (lineup.starters.includes(id)) setPendingStarterId(id)
  }
  const onDragEnd = () => setPendingStarterId(null)
  const onDropOn = (id: number) => {
    if (pendingStarterId === null) return
    if (lineup.bench.includes(id)) handleBenchTap(id)
  }

  /** A shape is unreachable when the squad simply lacks the outfielders for it. */
  const formationDisabled = (f: string): boolean => {
    const parsed = parseFormation(f)
    if (!parsed) return true
    return ownedByPos[DEF] < parsed.def || ownedByPos[MID] < parsed.mid || ownedByPos[FWD] < parsed.fwd
  }

  const rowProps = {
    playerMap, nextGw, pendingStarterId, onCardTap,
    effectiveCaptainId, effectiveVcId,
    onSetCaptain: setCaptain, onSetVc: setVc,
    onDragStart, onDragEnd, onDropOn,
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

      <div data-testid="lineup-headline-row" className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[110px] rounded-xl border border-line bg-surface-1 px-3 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Formation</div>
          <div className="text-h3 font-bold tabular text-ink">{lineup.formation}</div>
        </div>
        <div className="flex-1 min-w-[110px] rounded-xl border border-line bg-surface-1 px-3 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Captain</div>
          <div className="text-h3 font-bold text-ink truncate">
            {playerMap.get(effectiveCaptainId)?.web_name ?? '—'}
          </div>
        </div>
        <div className="flex-1 min-w-[130px] rounded-xl border border-accent-soft bg-accent-soft px-3 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Total xPts</div>
          <div className="text-h3 font-bold tabular text-accent">{totalXPts.toFixed(1)}</div>
          {xptsDelta !== 0 && (
            <div className="text-[11px] text-ink-muted tabular">
              {xptsDelta > 0 ? '+' : '−'}{Math.abs(xptsDelta).toFixed(1)} vs optimal
            </div>
          )}
        </div>
      </div>

      <div role="radiogroup" aria-label="Formation" data-testid="formation-switcher" className="flex flex-wrap gap-1.5">
        {FORMATIONS.map(f => {
          const isActive = forcedFormation === f
          // With no forced shape, outline the one the optimiser landed on.
          const isDerived = !forcedFormation && f === optimalFormation
          const disabled = formationDisabled(f)
          const cls = isActive
            ? 'bg-accent text-on-accent border border-accent'
            : isDerived
            ? 'border border-accent text-accent bg-surface-1'
            : 'border border-line bg-surface-1 text-ink-muted hover:text-ink'
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-disabled={disabled}
              disabled={disabled}
              data-testid={`formation-${f}`}
              onClick={() => setForcedFormation(f)}
              className={`min-h-[44px] px-3 rounded-lg text-[13px] font-bold tabular cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}
            >
              {f}
            </button>
          )
        })}
      </div>

      {/* Pitch surface: turf base, mown stripes, depth vignette, chalk. All
          absolutely-positioned siblings under a relative wrapper; the rows sit
          on top. Chalk is aria-hidden — it is scenery, not content. */}
      <div
        className="relative rounded-2xl overflow-hidden border border-turf-edge shadow-[0_18px_40px_-24px_rgba(0,0,0,0.55)]"
        onClick={handleBackgroundTap}
        data-testid="pitch"
      >
        <div className="absolute inset-0 bg-turf" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(180deg,var(--sp-turf-stripe-a)_0_9.09%,var(--sp-turf-stripe-b)_9.09%_18.18%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(255,255,255,0.10),transparent_55%),radial-gradient(100%_70%_at_50%_100%,rgba(0,0,0,0.28),transparent_60%)]" />
        <div aria-hidden="true" className="absolute inset-[10px] rounded border-2 border-chalk" />
        <div aria-hidden="true" className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[44%] h-[74px] border-2 border-t-0 border-chalk rounded-b" />
        <div aria-hidden="true" className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[20%] h-[34px] border-2 border-t-0 border-chalk rounded-b-[3px]" />
        <div aria-hidden="true" className="absolute -bottom-[88px] left-1/2 -translate-x-1/2 w-[200px] h-[200px] rounded-full border-2 border-chalk" />
        <div aria-hidden="true" className="absolute left-[10px] right-[10px] bottom-[10px] border-t-2 border-chalk" />

        <div className="relative flex flex-col gap-1.5 px-2.5 pt-6 pb-7">
          <PitchRow position="GK"  ids={starterGks}  {...rowProps} />
          <PitchRow position="DEF" ids={starterDefs} {...rowProps} />
          <PitchRow position="MID" ids={starterMids} {...rowProps} />
          <PitchRow position="FWD" ids={starterFwds} {...rowProps} />
        </div>
      </div>

      <BenchTray
        ids={lineup.bench}
        playerMap={playerMap}
        nextGw={nextGw}
        legalBenchIds={legalBenchIds}
        onCardTap={onCardTap}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDropOn={onDropOn}
      />

      <p className="text-xs italic text-ink-muted">
        Tap a starter, then tap a bench player to swap — or drag one onto the other. Tap elsewhere to cancel.
      </p>
    </section>
  )
}
