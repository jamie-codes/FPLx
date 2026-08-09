'use client'

// Phase 62 (MC-03): RankSimTab — 4th Plan sub-tab.
// Sources of truth:
//   - .planning/phases/062-mc-rank-simulator-captain-integration/062-CONTEXT.md §decisions D-01..D-15
//   - .planning/phases/062-mc-rank-simulator-captain-integration/062-UI-SPEC.md §RankSimTab
//   - .planning/phases/062-mc-rank-simulator-captain-integration/062-RESEARCH.md §Pattern 3, §Pattern 5, §Common Pitfalls 1/2/4/6/7
// Pitfall 7: bank is NOT a page.tsx prop — read from useSquad/useMyTeam internally.
// Pitfall 1: ComposedChart, NOT AreaChart, when mixing Area + Line.
// Pitfall 2: p10 erase-fill MUST use fill="var(--background)" for dark-mode correctness.
// Pitfall 6: hide={true}, NOT tooltipType="none", on confidence-band Areas (Recharts v3).

import { useState, useMemo } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useSquad } from '@/lib/hooks/useSquad'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { useEntryRank } from '@/lib/hooks/useEntryRank'
import { useGwAverage } from '@/lib/hooks/useGwAverage'
import {
  computeXITrajectory,
  computeXIPerGwStats,
  computeBeatTheAverageProb,
  type ChartPoint,
} from '@/lib/rank-sim'
import type { MergedPlayer } from '@/lib/types'
import { CHART_GRID_STROKE, CHART_GRID_DASH, CHART_TICK } from '@/lib/chart-theme'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RankSimTabProps {
  submittedId: string | null
  horizon: number   // unused for now — fan chart is fixed at 5 GWs (D-06); accepted for API parity
}

// ---------------------------------------------------------------------------
// Custom tooltip (only shows mean / altMean lines — confidence band Areas excluded)
// ---------------------------------------------------------------------------

function CustomTooltip(props: TooltipContentProps) {
  const { active, payload, label } = props
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border border-line bg-surface-1 px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-ink mb-1">{label as string}</p>
      {(payload as unknown as Array<{ dataKey?: string | number; color?: string; value?: number }>)
        .filter((e) => e.dataKey === 'mean' || e.dataKey === 'altMean')
        .map((entry) => (
          <p key={String(entry.dataKey)} style={{ color: entry.color }}>
            {entry.dataKey === 'mean' ? 'Current XI' : 'Alt XI'}: {entry.value?.toFixed(1)} pts
          </p>
        ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRank(rank: number | null | undefined): string {
  if (rank == null) return '—'
  return `#${rank.toLocaleString('en-GB')}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RankSimTab({ submittedId }: RankSimTabProps) {
  const [sellId, setSellId] = useState<number | null>(null)
  const [buyId, setBuyId] = useState<number | null>(null)

  const { isAuthenticated } = useAuthStatus()
  const { data: playersData } = usePlayers()
  const { data: squadData } = useSquad(submittedId)
  const { data: myTeamData } = useMyTeam(isAuthenticated && !!submittedId)
  const rankQuery = useEntryRank(submittedId)
  const { data: gwAvgData } = useGwAverage()

  // Hybrid squad data — prefer authenticated, fall back to public (RouteTreeTab lines 61–63 pattern)
  const picks = myTeamData?.picks ?? squadData?.picks ?? null
  const bankBalance = myTeamData?.entry_history?.bank ?? squadData?.entry_history?.bank ?? 0

  // Sell prices: exact when authenticated; undefined = use now_cost
  const sellPriceMap = useMemo(() => {
    if (!myTeamData?.picks) return undefined
    return new Map(myTeamData.picks.map(p => [p.element, p.selling_price]))
  }, [myTeamData])

  const playerMap = useMemo(
    () => new Map((playersData ?? []).map(p => [p.id, p])),
    [playersData],
  )

  // Starting XI element IDs + captain ID — null when no squad
  const startingXIIds = useMemo<number[]>(() => {
    if (!picks) return []
    return picks.filter(p => p.position <= 11).map(p => p.element)
  }, [picks])

  const captainId = useMemo<number>(() => {
    if (!picks) return -1
    return picks.find(p => p.is_captain)?.element ?? -1
  }, [picks])

  // Current XI trajectory
  const currentTrajectory = useMemo<ChartPoint[]>(() => {
    if (startingXIIds.length === 0 || playerMap.size === 0) {
      // 6 zero points so the chart still mounts cleanly (T-62-14 mitigation)
      return [
        { gw: 'Start', mean: 0, p10: 0, p90: 0 },
        ...[1, 2, 3, 4, 5].map(n => ({ gw: `GW+${n}`, mean: 0, p10: 0, p90: 0 })),
      ]
    }
    return computeXITrajectory(startingXIIds, captainId, playerMap)
  }, [startingXIIds, captainId, playerMap])

  // Alt XI: replace sellId with buyId in startingXIIds.
  // If sellId === captainId, assign new captain = highest xPts_1gw in alt XI (Pitfall 4).
  const altInfo = useMemo(() => {
    if (sellId == null || buyId == null) return null
    const altIds = startingXIIds.map(id => (id === sellId ? buyId : id))
    let altCaptainId = captainId
    let newCaptainName: string | null = null
    if (sellId === captainId) {
      // Find highest-xPts_1gw player in alt XI to be new captain
      const ranked = altIds
        .map(id => playerMap.get(id))
        .filter((p): p is MergedPlayer => !!p)
        .sort((a, b) => (b.xPts_1gw ?? 0) - (a.xPts_1gw ?? 0))
      if (ranked[0]) {
        altCaptainId = ranked[0].id
        newCaptainName = ranked[0].web_name
      }
    }
    const traj = computeXITrajectory(altIds, altCaptainId, playerMap)
    return { traj, newCaptainName }
  }, [sellId, buyId, startingXIIds, captainId, playerMap])

  // Merge altMean into chart data
  const chartData = useMemo<ChartPoint[]>(() => {
    if (!altInfo) return currentTrajectory
    return currentTrajectory.map((pt, i) => ({
      ...pt,
      altMean: altInfo.traj[i]?.mean,
    }))
  }, [currentTrajectory, altInfo])

  // P(rank gain/drop) — computed against current XI cumulative stats at GW+1
  const pStats = useMemo(() => {
    if (startingXIIds.length === 0 || !gwAvgData?.average_score || playerMap.size === 0) {
      return { pGain: null as number | null, pDrop: null as number | null }
    }
    const { gwMean, gwSigma } = computeXIPerGwStats(startingXIIds, captainId, playerMap)
    const threshold = gwAvgData.average_score
    const pGain = computeBeatTheAverageProb(gwMean, gwSigma, threshold)
    return { pGain, pDrop: 1 - pGain }
  }, [startingXIIds, captainId, playerMap, gwAvgData])

  // Sell options = current squad starting XI (D-11)
  const sellOptions = useMemo<MergedPlayer[]>(() => {
    return startingXIIds
      .map(id => playerMap.get(id))
      .filter((p): p is MergedPlayer => !!p)
  }, [startingXIIds, playerMap])

  // Buy options = filtered same-position pool, exclude squad, sorted by xPts_1gw desc, with affordability flag
  const buyOptions = useMemo(() => {
    if (sellId == null) return [] as Array<MergedPlayer & { canAfford: boolean }>
    const sellPlayer = playerMap.get(sellId)
    if (!sellPlayer) return []
    const sellPrice = sellPriceMap?.get(sellId) ?? sellPlayer.now_cost
    const squadIds = new Set(picks?.map(p => p.element) ?? [])
    return (playersData ?? [])
      .filter(p => p.element_type === sellPlayer.element_type && !squadIds.has(p.id))
      .map(p => ({ ...p, canAfford: p.now_cost <= sellPrice + bankBalance }))
      .sort((a, b) => (b.xPts_1gw ?? 0) - (a.xPts_1gw ?? 0))
  }, [sellId, playerMap, sellPriceMap, picks, playersData, bankBalance])

  const handleClearComparison = () => {
    setSellId(null)
    setBuyId(null)
  }

  // ===== RENDER =====

  // 1. No-squad branch (passive — UI-SPEC §Interaction Contracts)
  if (picks === null) {
    return (
      <section data-testid="rank-sim-tab">
        <div className="rounded border border-line bg-surface-2 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-ink">
            Load your squad to run the rank simulator
          </p>
          <p className="text-xs text-ink-muted mt-1">
            Go to the Squad tab and enter your FPL Team ID to get started.
          </p>
        </div>
      </section>
    )
  }

  // 2. Squad-loaded branch
  const altLegendLabel = altInfo?.newCaptainName
    ? `Alt XI (new captain: ${altInfo.newCaptainName})`
    : 'Alt XI (transfer)'

  return (
    <section data-testid="rank-sim-tab" className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-ink">Rank Simulator</h2>
        <p className="text-sm text-ink-muted mt-1">
          Project your squad&apos;s rank trajectory over 5 GWs and compare a one-transfer alternative.
        </p>
      </header>

      {/* 3-column rank header */}
      <div
        data-testid="rank-header"
        className="grid grid-cols-3 gap-4 rounded border border-line bg-surface-2 px-4 py-3"
      >
        <div className="flex flex-col items-center gap-0">
          <span className="text-xs text-ink-muted">Current rank</span>
          <span className="text-base font-semibold text-ink">
            {formatRank(rankQuery.data?.summary_overall_rank)}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0">
          <span className="text-xs text-ink-muted">P(rank gain) ~</span>
          <span className="text-base font-semibold text-positive">
            {pStats.pGain != null ? `${Math.round(pStats.pGain * 100)}%` : '—'}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0">
          <span className="text-xs text-ink-muted">P(rank drop) ~</span>
          <span className="text-base font-semibold text-negative">
            {pStats.pDrop != null ? `${Math.round(pStats.pDrop * 100)}%` : '—'}
          </span>
        </div>
      </div>
      <p className="text-xs text-ink-muted">
        Based on beat-the-average heuristic — not a direct rank model.
      </p>
      {rankQuery.isError && (
        <p className="text-xs text-negative">
          Could not load rank — check your Team ID.
        </p>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 12, height: 2, background: 'currentColor' }} />
          Current XI
        </span>
        {altInfo && (
          <span className="flex items-center gap-1">
            {/* UIX-04 ruling 5: alt-scenario swatch tracks the accent token in both themes */}
            <span style={{ display: 'inline-block', width: 12, height: 2, background: 'var(--color-accent)', borderTop: '2px dashed var(--color-accent)' }} />
            {altLegendLabel}
          </span>
        )}
      </div>

      {/* Fan chart */}
      <div data-testid="rank-sim-chart" className="rounded border border-line bg-surface-2 px-2 py-3">
        <ResponsiveContainer width="100%" height={256}>
          <ComposedChart data={chartData}>
            {/* UIX-04 ruling 5: grid/band strokes built on the muted ink token (theme-aware) */}
            <CartesianGrid strokeDasharray={CHART_GRID_DASH} stroke={CHART_GRID_STROKE} />
            <XAxis dataKey="gw" tick={CHART_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} width={32} />
            <Tooltip content={CustomTooltip} />
            {/* Confidence band — current XI only. Pitfall 1: ComposedChart not AreaChart. */}
            {/* Pitfall 6: hide={true} not tooltipType="none" (v2-only prop). */}
            <Area type="monotone" dataKey="p90" stroke="none" fill="color-mix(in srgb, var(--color-ink-muted) 25%, transparent)" fillOpacity={1} legendType="none" activeDot={false} hide isAnimationActive={false} />
            {/* Pitfall 2: fill="var(--background)" for dark-mode erase-fill correctness. */}
            <Area type="monotone" dataKey="p10" stroke="none" fill="var(--background)" fillOpacity={1} legendType="none" activeDot={false} hide isAnimationActive={false} />
            {/* Current XI mean — solid */}
            <Line type="monotone" dataKey="mean" stroke="currentColor" strokeWidth={2} dot={false} isAnimationActive={false} />
            {/* Alt XI mean — dashed accent, conditional (UIX-04 ruling 5) */}
            {altInfo && (
              <Line type="monotone" dataKey="altMean" stroke="var(--color-accent)" strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Transfer comparison dropdowns */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink">Compare a transfer</p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="flex flex-col gap-1 w-full sm:w-auto">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Sell</span>
            <select
              aria-label="Sell"
              data-testid="rank-sim-sell"
              value={sellId ?? ''}
              onChange={(e) => {
                setSellId(e.target.value ? Number(e.target.value) : null)
                setBuyId(null)
              }}
              className="border border-line rounded-md px-3 py-2 bg-surface-1 text-sm text-ink min-h-[44px] w-full sm:w-auto"
            >
              <option value="">— Select player to sell —</option>
              {sellOptions.map(p => (
                <option key={p.id} value={p.id}>
                  {p.web_name} ({p.team_short_name})
                </option>
              ))}
            </select>
          </label>
          <span className="hidden sm:inline text-ink-muted">→</span>
          <label className="flex flex-col gap-1 w-full sm:w-auto">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Buy</span>
            <select
              aria-label="Buy"
              data-testid="rank-sim-buy"
              value={buyId ?? ''}
              onChange={(e) => setBuyId(e.target.value ? Number(e.target.value) : null)}
              disabled={sellId == null}
              className="border border-line rounded-md px-3 py-2 bg-surface-1 text-sm text-ink min-h-[44px] w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{sellId == null ? '— Select a player to sell first —' : '— Select player to buy —'}</option>
              {buyOptions.map(p => (
                <option key={p.id} value={p.id}>
                  {p.web_name} ({p.team_short_name}){p.canAfford ? '' : " (can't afford)"}
                </option>
              ))}
            </select>
          </label>
          {(sellId != null || buyId != null) && (
            <button
              type="button"
              data-testid="rank-sim-clear"
              onClick={handleClearComparison}
              className="text-xs text-ink-muted hover:text-ink underline-offset-2 hover:underline cursor-pointer"
            >
              Clear comparison
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
