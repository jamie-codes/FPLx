'use client'

// Phase 127 WATCH-01, WATCH-02, WATCH-04: WatchlistTab — Plan section Watchlist sub-tab.
// D-11: calls three stale-cached hooks (usePlayers, useLineupNews, usePreSeasonSquad) plus
//       useTransferNews for ConfirmedSigningBadge (WATCH-02) — no extra API calls on tab switch.
// D-09: departed detection via set-difference against /api/players response.
// D-12: squad-overlap dot from data?.squad?.starters + data?.squad?.bench.
// D-13: 48h amber border via useLineupNews whole-map gate (see implementation note below).

import { useMemo } from 'react'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useLineupNews } from '@/lib/hooks/useLineupNews'
import { usePreSeasonSquad } from '@/lib/hooks/usePreSeasonSquad'
import { useTransferNews } from '@/lib/hooks/useTransferNews'
import { buildConfirmedSigningMap } from '@/lib/buildConfirmedSigningMap'
import { WatchlistPlayerCard } from './WatchlistPlayerCard'
import type { MergedPlayer, PreSeasonSquad, LineupNewsPlayer } from '@/lib/types'

export interface WatchlistTabProps {
  watchlistIds: number[]
  toggleWatchlist: (id: number) => void
}

// D-13 (48h amber border) is implemented via the whole-map 48h gate in
// lineupNewsSelect (useLineupNews.ts), per RESEARCH.md Pitfall 4. The
// LineupNewsPlayer type does not carry a per-player `news_added` field;
// the closest data point is the file-level `scraped_at`. When the file is
// >48h stale, lineupNewsSelect returns undefined and the amber border is
// suppressed for all players — the intended D-13 behaviour.
function hasNewsFor(id: number, map: Map<number, LineupNewsPlayer> | undefined): boolean {
  if (map === undefined) return false
  const entry = map.get(id)
  return entry !== undefined && entry.news_headline != null
}

// extractSquad: handles both the legacy PreSeasonSquad | null shape (pre-Plan-04)
// and the new PreSeasonSquadResponse envelope shape (post-Plan-04).
// DELETE-IN-PLAN-04: once usePreSeasonSquad.ts is updated to use PreSeasonSquadResponse,
// this helper becomes a no-op and should be removed in favour of direct data?.squad access.
function extractSquad(data: unknown): PreSeasonSquad | null {
  if (data === null || data === undefined) return null
  if (typeof data === 'object' && 'squad' in (data as object)) {
    return (data as { squad: PreSeasonSquad | null }).squad
  }
  return data as PreSeasonSquad
}

export function WatchlistTab({ watchlistIds, toggleWatchlist }: WatchlistTabProps) {
  // WATCH: unpin-from-card — each card's ✕ calls toggleWatchlist(id) to remove it.
  const { data: playersData, isLoading, isError } = usePlayers()
  const { data: lineupNewsMap } = useLineupNews()
  const { data: squadData } = usePreSeasonSquad()
  const { data: transferNewsFeed } = useTransferNews()

  // All memos MUST be called unconditionally (rules-of-hooks) before any guard returns.

  // Confirmed signing map (WATCH-02): mirrors GemTable.tsx lines 158-161
  const confirmedSigningMap = useMemo(
    () => buildConfirmedSigningMap(transferNewsFeed?.articles ?? []),
    [transferNewsFeed]
  )

  // Build player map for enrichment and departed detection
  const playerMap = useMemo(
    () => new Map<number, MergedPlayer>((playersData ?? []).map(p => [p.id, p])),
    [playersData]
  )

  // Departed detection: ID in watchlist but not in /api/players response
  const departedIds = useMemo(
    () => new Set(watchlistIds.filter(id => !playerMap.has(id))),
    [watchlistIds, playerMap]
  )

  // Squad overlap set (D-12): starters + bench IDs, graceful if squad null
  const squadIds = useMemo(() => {
    const squad = extractSquad(squadData)
    if (!squad) return new Set<number>()
    return new Set([...squad.starters, ...squad.bench].map(p => p.id))
  }, [squadData])

  // Sort: GK(1)→DEF(2)→MID(3)→FWD(4), then alphabetical by web_name within position
  // Departed cards rendered at the end.
  const sortedPresentPlayers = useMemo(() => {
    return watchlistIds
      .filter(id => playerMap.has(id))
      .map(id => playerMap.get(id)!)
      .sort((a, b) => {
        if (a.element_type !== b.element_type) return a.element_type - b.element_type
        return a.web_name.localeCompare(b.web_name)
      })
  }, [watchlistIds, playerMap])

  const sortedDepartedIds = useMemo(
    () => Array.from(departedIds),
    [departedIds]
  )

  // Loading guard
  if (isLoading) {
    return (
      <section className="mt-4 space-y-4">
        <div
          className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          aria-busy="true"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface-2 rounded animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  // Error guard
  if (isError) {
    return (
      <div className="rounded border border-line bg-surface-1 p-4">
        <p className="text-sm text-ink font-medium">Failed to load player data.</p>
        <p className="text-xs text-ink-muted mt-1">Refresh to try again.</p>
      </div>
    )
  }

  // Empty guard
  if (watchlistIds.length === 0) {
    return (
      <p className="text-sm text-ink-muted py-4">
        No players pinned yet. Tap ⭐ on any player in Gem Ratings to add them here.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {sortedPresentPlayers.map(player => (
        <WatchlistPlayerCard
          key={player.id}
          player={player}
          departed={false}
          hasNews={hasNewsFor(player.id, lineupNewsMap)}
          inSquad={squadIds.has(player.id)}
          confirmedSigningTooltip={confirmedSigningMap.get(player.id)}
          onUnpin={() => toggleWatchlist(player.id)}
        />
      ))}
      {sortedDepartedIds.map(id => (
        <WatchlistPlayerCard
          key={id}
          player={{ id }}
          departed={true}
          hasNews={false}
          inSquad={false}
          onUnpin={() => toggleWatchlist(id)}
        />
      ))}
    </div>
  )
}
