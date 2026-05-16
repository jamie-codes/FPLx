'use client'

// Phase 60 Plan 02: Route Tree tab component (TRT-01..TRT-07).
// Composes the Plan 01 pure engine + reused Phase 59 patterns (ManualPlanTab analog).
// Bridge to Manual Plan via persistManualPlan (D-08, D-09).

import { useState, useMemo, useCallback, useEffect, Fragment } from 'react'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useSquad } from '@/lib/hooks/useSquad'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { computeAllGemScores } from '@/lib/gem-score'
import { buildTransferRouteTree } from '@/lib/transfer-route-tree'
import { persistManualPlan, loadManualPlan } from '@/lib/manual-plan'
import type { ManualPlan } from '@/lib/manual-plan'
import type { PlannerHorizon, PlannerChip } from '@/lib/types'
import { ChipToggle } from './ChipToggle'

// ---------------------------------------------------------------------------
// RouteTreeTab
// ---------------------------------------------------------------------------

interface RouteTreeTabProps {
  submittedId: string | null
  horizon: PlannerHorizon
  onSwitchSubTab: (tab: 'manual-plan') => void
}

export function RouteTreeTab({ submittedId, horizon, onSwitchSubTab }: RouteTreeTabProps) {
  // Team ID local input state for no-squad branch
  const [teamIdInput, setTeamIdInput] = useState<string>(() => submittedId ?? '')

  // D-07: horizon is a prop from page.tsx — no local state. TRT-07 recomputation via useMemo dependency.

  // Expand/confirm state
  const [expandedPaths, setExpandedPaths] = useState<Set<number>>(() => new Set())
  const [confirmingLoadIndex, setConfirmingLoadIndex] = useState<number | null>(null)

  // Auth + data hooks (mirror ManualPlanTab lines 42–91 pattern)
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

  // Derive starting GW (same as ManualPlanTab lines 58–62)
  const startingGw = useMemo(() => {
    const ids = scoredPlayers.flatMap((p) => p.fixtures.map((f) => f.event_id))
    return ids.length > 0 ? Math.min(...ids) : null
  }, [scoredPlayers])

  // Hybrid squad data — prefer authenticated, fall back to public (D-12/D-13)
  const picks = myTeamData?.picks ?? squadData?.picks ?? null
  const bankBalance =
    myTeamData?.entry_history?.bank ?? squadData?.entry_history?.bank ?? 0

  // Sell prices: exact when authenticated; undefined = use now_cost
  const sellPrices = myTeamData?.picks
    ? Object.fromEntries(myTeamData.picks.map((p) => [p.element, p.selling_price]))
    : undefined

  // initialFTState — mirrors ManualPlanTab lines 75–82 verbatim
  const initialFTState = useMemo(() => {
    if (!isAuthenticated || !myTeamData) return { available: 1 as 1 | 2, banked: 0 as 0 | 1 }
    const chip = squadData?.active_chip
    if (chip === 'wildcard' || chip === 'freehit') return { available: 1 as 1 | 2, banked: 0 as 0 | 1 }
    const available: 1 | 2 = myTeamData.entry_history.event_transfers === 0 ? 2 : 1
    const banked: 0 | 1 = available === 2 ? 1 : 0
    return { available, banked }
  }, [isAuthenticated, myTeamData, squadData])

  // Sell price map (Map<number, number>)
  const sellPriceMap = useMemo(
    () =>
      sellPrices
        ? new Map(Object.entries(sellPrices).map(([k, v]) => [Number(k), v]))
        : undefined,
    [sellPrices]
  )

  const chipMode: PlannerChip = null

  // ---------------------------------------------------------------------------
  // Engine memoization (TRT-07: recomputes when horizon changes)
  // ---------------------------------------------------------------------------

  const tree = useMemo(() => {
    if (!picks || startingGw === null || playerMap.size === 0) return null
    return buildTransferRouteTree({
      picks,
      players: scoredPlayers,
      horizon,
      initialFT: initialFTState,
      initialBank: bankBalance,
      sellPrices: sellPriceMap,
      chipMode,
      startingGw,
    })
  }, [picks, scoredPlayers, horizon, initialFTState, bankBalance, sellPriceMap, chipMode, startingGw, playerMap])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  // D-07: reset expanded state when the section-level horizon prop changes
  useEffect(() => {
    setExpandedPaths(new Set())
    setConfirmingLoadIndex(null)
  }, [horizon])

  const toggleExpand = useCallback((i: number) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }, [])

  // Bridge handlers — D-08/D-09 (TRT-05)
  // handleConfirmLoad declared before handleClickLoad to avoid temporal dead zone
  const handleConfirmLoad = useCallback((i: number) => {
    if (!tree) return
    const path = tree.paths[i]
    const bridge: ManualPlan = {
      version: 1,
      horizon,
      steps: path.nodes.map(n => ({
        gw: n.gw,
        chip: null,                // D-09: chip = null per step
        transfers: n.transfers,
      })),
    }
    persistManualPlan(bridge)
    setConfirmingLoadIndex(null)
    onSwitchSubTab('manual-plan')  // D-09: parent flips activeSubTab; ManualPlanTab re-mounts and reads bridge from localStorage
  }, [tree, horizon, onSwitchSubTab])

  const handleClickLoad = useCallback((i: number) => {
    if (!tree) return
    const existing = loadManualPlan()
    const hasTransfers = existing?.steps.some(s => s.transfers.length > 0) ?? false
    if (hasTransfers) {
      setConfirmingLoadIndex(i)
    } else {
      handleConfirmLoad(i)  // silent overwrite per D-08
    }
  }, [tree, handleConfirmLoad])

  const handleCancelLoad = useCallback(() => {
    setConfirmingLoadIndex(null)
  }, [])

  // No-squad submit handler — copy verbatim from ManualPlanTab lines 246–253
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
      <section data-testid="route-tree-tab">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Computing routes…</p>
      </section>
    )
  }

  // 2. No-squad branch: no picks available
  if (picks === null) {
    return (
      <section data-testid="route-tree-tab" className="space-y-6">
        <header>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Load your squad first</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Enter your FPL Team ID to generate transfer route options for your squad.
          </p>
        </header>
        <form
          onSubmit={(e) => { e.preventDefault(); handleLoadSquad() }}
          className="flex flex-col sm:flex-row gap-2 sm:items-end"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="routeTreeTeamId" className="text-sm text-zinc-600 dark:text-zinc-400">FPL Team ID</label>
            <input
              id="routeTreeTeamId"
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
    <section data-testid="route-tree-tab" className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Route Tree</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Compare 2–3 transfer routes built greedily from your weakest squad players.
        </p>
      </header>

      <div>
        <ChipToggle
          gw={startingGw ?? 1}
          activeChip={null}
          onToggle={() => {}}
          disabled={true}
        />
      </div>

      {/* Caveat banner — shown only when unauthenticated (MTP-07 mirror) */}
      {!isAuthenticated && picks !== null && (
        <div className="rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 mb-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Sell prices are approximate — log in to FPL for exact selling prices.
          </p>
        </div>
      )}

      {/* Empty-tree fallback */}
      {tree && tree.paths.length === 0 && (
        <div
          className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-6 text-center"
          data-testid="route-tree-empty"
        >
          <p className="text-sm text-zinc-700 dark:text-zinc-300">No transfer routes found for the current horizon and chip mode.</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Try a different horizon or clear the active chip.</p>
        </div>
      )}

      {/* Summary table */}
      {tree && tree.paths.length > 0 && (
        <div className="overflow-x-auto" data-testid="route-tree-table-wrapper">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th scope="col" className="px-3 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide text-left">Path</th>
                <th scope="col" className="px-3 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide text-left">Hits</th>
                <th scope="col" className="px-3 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide text-left">Hit cost</th>
                <th scope="col" className="px-3 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide text-left">Net xPts</th>
                <th scope="col" className="px-3 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide text-left">Chips</th>
                <th scope="col" className="px-3 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {tree.paths.map((path, i) => {
                const isRecommended = i === tree.recommendedPathIndex
                const pathLabel = `Path ${String.fromCharCode(65 + i)}`  // A, B, C
                const isExpanded = expandedPaths.has(i)
                const isConfirming = confirmingLoadIndex === i
                return (
                  <Fragment key={`path-${i}`}>
                    <tr
                      data-testid={`path-row-${i}`}
                      data-recommended={isRecommended ? 'true' : 'false'}
                      className={isRecommended
                        ? 'ring-2 ring-offset-0 ring-inset ring-green-700 dark:ring-green-300 bg-zinc-50 dark:bg-zinc-800'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700'}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleExpand(i)}
                            aria-label={isExpanded ? `Hide GW-by-GW breakdown for ${pathLabel}` : `Show GW-by-GW breakdown for ${pathLabel}`}
                            data-testid={`path-expand-${i}`}
                            className="text-zinc-500 dark:text-zinc-400 text-xs hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer min-h-[44px] px-1"
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                          <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{pathLabel}</span>
                          {isRecommended && (
                            <span className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs font-semibold rounded px-2 py-1">Recommended</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{path.totalHits ?? 0}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {path.totalHitCostPts === 0
                          ? '0 pts'
                          : <span className="text-red-700 dark:text-red-300">{`−${Math.abs(path.totalHitCostPts)} pts`}</span>}
                      </td>
                      <td className="px-3 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100" data-testid={`path-net-xpts-${i}`}>
                        {path.netXpts >= 0 ? `+${path.netXpts.toFixed(1)}` : `−${Math.abs(path.netXpts).toFixed(1)}`}
                      </td>
                      <td className="px-3 py-2">
                        {path.chipsConsumed.length === 0
                          ? <span className="text-zinc-500 dark:text-zinc-400 text-xs">All preserved</span>
                          : <span className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs font-semibold rounded px-2 py-1">
                              {path.chipsConsumed.map(c => c === 'wildcard' ? 'WC' : c === 'freehit' ? 'FH' : c === 'bboost' ? 'BB' : c === '3xc' ? 'TC' : '').filter(Boolean).join(', ')}
                            </span>}
                      </td>
                      <td className="px-3 py-2">
                        {isConfirming ? (
                          <div className="flex items-center gap-2" data-testid={`path-confirm-${i}`}>
                            <span className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Replace current plan?</span>
                            <button
                              type="button"
                              onClick={() => handleConfirmLoad(i)}
                              data-testid={`path-confirm-yes-${i}`}
                              className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold rounded min-h-[44px] px-3 py-2 text-sm cursor-pointer"
                            >
                              Yes, replace
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelLoad}
                              data-testid={`path-confirm-cancel-${i}`}
                              className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline-offset-2 hover:underline cursor-pointer min-h-[44px] px-2"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleClickLoad(i)}
                            data-testid={`path-load-${i}`}
                            className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold rounded min-h-[44px] px-3 py-2 text-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer whitespace-nowrap"
                          >
                            Load into Manual Planner
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr data-testid={`path-breakdown-${i}`}>
                        <td colSpan={6} className="bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-100 dark:border-zinc-700 px-3 py-3">
                          <div className="overflow-x-auto">
                            <table className="text-xs w-full">
                              <thead>
                                <tr className="text-zinc-500 dark:text-zinc-400">
                                  <th className="text-left px-2 py-1">GW</th>
                                  <th className="text-left px-2 py-1">Sell</th>
                                  <th className="text-left px-2 py-1">Buy</th>
                                  <th className="text-left px-2 py-1">FT bank</th>
                                  <th className="text-left px-2 py-1">Free / Hit</th>
                                  <th className="text-left px-2 py-1">xPts contribution</th>
                                </tr>
                              </thead>
                              <tbody>
                                {path.nodes.map((node, ni) => {
                                  if (node.transfers.length === 0) {
                                    // Hold step — em-dashes
                                    return (
                                      <tr key={ni} data-testid={`breakdown-row-${i}-${ni}`}>
                                        <td className="px-2 py-1 text-zinc-900 dark:text-zinc-100">{node.gw}</td>
                                        <td className="px-2 py-1 text-zinc-500 dark:text-zinc-400">—</td>
                                        <td className="px-2 py-1 text-zinc-500 dark:text-zinc-400">—</td>
                                        <td className="px-2 py-1 text-zinc-900 dark:text-zinc-100">{node.ftBefore.available}</td>
                                        <td className="px-2 py-1 text-zinc-500 dark:text-zinc-400">—</td>
                                        <td className="px-2 py-1 text-zinc-900 dark:text-zinc-100">{node.xPtsContribution >= 0 ? `+${node.xPtsContribution.toFixed(1)}` : `−${Math.abs(node.xPtsContribution).toFixed(1)}`}</td>
                                      </tr>
                                    )
                                  }
                                  // Transfer rows — one per leg
                                  return node.transfers.map((t, ti) => {
                                    const sellPlayer = playerMap.get(t.sellId)
                                    const buyPlayer = playerMap.get(t.buyId)
                                    const isHit = node.hitCost !== 0  // always false per D-01 / Plan 01 contract
                                    return (
                                      <tr key={`${ni}-${ti}`} data-testid={`breakdown-row-${i}-${ni}-${ti}`}>
                                        <td className="px-2 py-1 text-zinc-900 dark:text-zinc-100">{ti === 0 ? node.gw : ''}</td>
                                        <td className="px-2 py-1 font-medium text-zinc-900 dark:text-zinc-100">{sellPlayer?.web_name ?? `#${t.sellId}`}</td>
                                        <td className="px-2 py-1 font-medium text-zinc-900 dark:text-zinc-100">{buyPlayer?.web_name ?? `#${t.buyId}`}</td>
                                        <td className="px-2 py-1 text-zinc-900 dark:text-zinc-100">{ti === 0 ? node.ftBefore.available : ''}</td>
                                        <td className="px-2 py-1">
                                          {ti === 0 && (
                                            <span className={isHit
                                              ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-xs font-semibold rounded px-2 py-1'
                                              : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs font-semibold rounded px-2 py-1'}>
                                              {isHit ? `Hit −4 pts` : 'Free'}
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-2 py-1 text-zinc-900 dark:text-zinc-100">
                                          {ti === 0 ? (node.xPtsContribution >= 0 ? `+${node.xPtsContribution.toFixed(1)}` : `−${Math.abs(node.xPtsContribution).toFixed(1)}`) : ''}
                                        </td>
                                      </tr>
                                    )
                                  })
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
