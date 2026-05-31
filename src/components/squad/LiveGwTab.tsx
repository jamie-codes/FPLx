'use client'

import { useMemo } from 'react'
import { useBootstrap } from '@/lib/hooks/useBootstrap'
import { useLiveGw }    from '@/lib/hooks/useLiveGw'
import { usePlayers }   from '@/lib/hooks/usePlayers'
import { computeLiveScore } from '@/lib/live-gw'
import type { LiveXIPlayer } from '@/lib/live-gw'

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatPills({ stats }: { stats: LiveXIPlayer['stats'] }) {
  const items: string[] = []
  if (stats.goals_scored > 0)  items.push(`⚽ ×${stats.goals_scored}`)
  if (stats.assists > 0)       items.push(`🅰 ×${stats.assists}`)
  if (stats.clean_sheets > 0)  items.push('🛡 CS')
  if (stats.saves >= 3)        items.push(`🧤 ${stats.saves}`)
  if (stats.yellow_cards > 0)  items.push('🟨')
  if (stats.red_cards > 0)     items.push('🟥')
  if (items.length === 0) return null
  return (
    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
      {items.join('  ')}
    </p>
  )
}

function CaptainBadge({ player, vcPromoted }: { player: LiveXIPlayer; vcPromoted: boolean }) {
  if (player.is_captain && !vcPromoted) {
    return <span className="text-xs font-bold text-amber-500 ml-1">C×{player.multiplier}</span>
  }
  if (player.is_vice_captain && vcPromoted) {
    return (
      <>
        <span className="text-xs font-bold text-amber-500 ml-1">VC×{player.multiplier}</span>
        <span className="text-xs text-zinc-400 ml-1">(captain didn&apos;t play)</span>
      </>
    )
  }
  return null
}

function PlayerRow({ player, vcPromoted }: { player: LiveXIPlayer; vcPromoted: boolean }) {
  const muted = player.is_subbed_out
  return (
    <li className={`flex items-start justify-between py-2 ${muted ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {player.is_subbed_in && <span className="text-green-500 mr-1">↑</span>}
          {player.player_name}
          <CaptainBadge player={player} vcPromoted={vcPromoted} />
        </p>
        <StatPills stats={player.stats} />
      </div>
      <div className="ml-4 flex-shrink-0 text-right">
        <p className="text-sm font-bold tabular-nums">{player.live_points}</p>
        {player.is_subbed_out && (
          <p className="text-xs text-zinc-400">↓ subbed off</p>
        )}
      </div>
    </li>
  )
}

function SkeletonRow() {
  return (
    <li data-testid="skeleton-row" className="flex items-center justify-between py-2 animate-pulse">
      <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-32" />
      <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-8" />
    </li>
  )
}

function ChipBadge({ chip }: { chip: string | null }) {
  if (!chip) return null
  const labels: Record<string, string> = {
    bboost:  'Bench Boost',
    '3xc':   'Triple Captain',
    freehit: 'Free Hit',
  }
  return (
    <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
      {labels[chip] ?? chip}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface LiveGwTabProps {
  teamId: number | null
}

export function LiveGwTab({ teamId }: LiveGwTabProps) {
  const { data: bootstrap } = useBootstrap()
  const { data: players }   = usePlayers()

  const currentEvent = bootstrap?.events.find(e => e.is_current) ?? null
  const isLive       = currentEvent != null && !currentEvent.finished
  const currentGw    = currentEvent?.id ?? null

  const { liveStats, picksData, isLoading, isError, refetch } = useLiveGw(
    teamId,
    currentGw,
    isLive,
  )

  // Build playerNameMap from bootstrap elements or players
  const playerNameMap = useMemo(() => {
    const m = new Map<number, { web_name: string; team: number }>()
    if (bootstrap) {
      for (const el of bootstrap.elements) {
        m.set(el.id, { web_name: el.web_name, team: el.team })
      }
    }
    if (players) {
      for (const p of players) {
        m.set(p.id, { web_name: p.web_name, team: p.team })
      }
    }
    return m
  }, [bootstrap, players])

  // No team loaded
  if (!teamId) {
    return (
      <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
        <p>Load your squad to see your live score</p>
      </div>
    )
  }

  // No current GW
  if (!currentGw) {
    return (
      <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
        <p>No active gameweek — check back on a matchday</p>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="py-8 text-center space-y-3">
        <p className="text-zinc-500 dark:text-zinc-400">Couldn&apos;t load live data — will retry</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
        >
          Retry
        </button>
      </div>
    )
  }

  // Loading state
  if (isLoading || !liveStats || !picksData) {
    return (
      <div className="space-y-4 mt-4">
        <ul className="divide-y divide-border">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
        </ul>
      </div>
    )
  }

  // Compute live score
  const liveScore = computeLiveScore(
    picksData.picks,
    picksData.automatic_subs,
    picksData.active_chip,
    liveStats,
    playerNameMap,
  )

  return (
    <div className="space-y-4 mt-2">
      {/* Header card */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            GW{currentGw}
          </span>
          {isLive && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              LIVE
            </span>
          )}
          {currentEvent?.finished && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
              Final
            </span>
          )}
          <ChipBadge chip={liveScore.chip} />
        </div>
        <p className="text-4xl font-bold tabular-nums">{liveScore.total_points}</p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          ⚠ Bonus points are provisional
        </p>
      </div>

      {/* Starting XI */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
          Starting XI ({liveScore.xi.length})
        </h3>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
          {liveScore.xi.map(player => (
            <PlayerRow key={player.element} player={player} vcPromoted={liveScore.vc_promoted} />
          ))}
        </ul>
      </section>

      {/* Bench */}
      {liveScore.bench.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
            Bench
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
            {liveScore.bench.map(player => (
              <PlayerRow key={player.element} player={player} vcPromoted={liveScore.vc_promoted} />
            ))}
          </ul>
        </section>
      )}

      {/* Auto-subs log */}
      {liveScore.auto_subs.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
            Auto-subs
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
            {liveScore.auto_subs.map((sub) => (
              <li key={`${sub.player_out}-${sub.player_in}`} className="py-2 text-sm text-zinc-600 dark:text-zinc-400">
                {sub.player_out} ({sub.minutes_played_by_out} min) → {sub.player_in}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
