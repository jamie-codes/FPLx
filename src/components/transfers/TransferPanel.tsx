'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSquad } from '@/lib/hooks/useSquad'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { computeAllGemScores } from '@/lib/gem-score'
import { computeTransferSuggestions, type ChipState, type SingleTransfer } from '@/lib/transfer-engine'
import { useClubForm } from '@/lib/hooks/useClubForm'
import { computeLifecycleLabels } from '@/lib/lifecycle-label'
import type { ClubForm, ScoredPlayer } from '@/lib/types'
import { computeCaptaincyCandidates } from '@/lib/captaincy-engine'
import { SquadView } from '@/components/squad/SquadView'
import { MinsRiskBadge } from '@/components/shared/MinsRiskBadge'
import { computeFragility } from '@/lib/sensitivity'
import { FragilityNote } from '@/components/shared/FragilityNote'
import { computeVerdicts } from '@/lib/recommend'
import { HighOwnershipCallout, type HighOwnershipEntry } from '@/components/transfers/HighOwnershipCallout'
import { CaptaincyPanel } from '@/components/captaincy/CaptaincyPanel'
import { AuthModal } from '@/components/transfers/AuthModal'
import { computeAuthExpiryState } from '@/lib/auth-expiry'
import { suggestTransfers } from '@/lib/suggest-transfers'
import { computeOpportunityCostRows } from '@/lib/opportunity-cost'
import type { OCSRow } from '@/lib/opportunity-cost'
import type { OptimiserHorizon, TransferSuggestion } from '@/lib/types'
import { FtToggle } from '@/components/optimiser/FtToggle'
import { GwToggle } from '@/components/gem-table/GwToggle'
import { OpportunityCostTable } from '@/components/transfers/OpportunityCostTable'

// Phase 43 D-11: teamId / submittedId / onSubmit lifted to page.tsx so OptimiserPanel
// can receive teamId via props and share the useSquad cache. freeTransfers + isModalOpen
// remain local — they are not used by OptimiserPanel.
interface TransferPanelProps {
  teamId: string
  onTeamIdChange: (id: string) => void
  submittedId: string | null
  onSubmit: () => void
}

export function TransferPanel({ teamId, onTeamIdChange, submittedId, onSubmit }: TransferPanelProps) {
  const [freeTransfers, setFreeTransfers] = useState<number>(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [ocsHorizon, setOcsHorizon] = useState<OptimiserHorizon>(1)
  const [ocsFtCount, setOcsFtCount] = useState<1 | 2>(1)

  const { data: squadData, isLoading: squadLoading, error: squadError } = useSquad(submittedId)
  const { data: playersData, isLoading: playersLoading } = usePlayers()
  const { data: clubFormData } = useClubForm()
  const { isAuthenticated, expiresAt, setAuthenticated, clearAuthenticated } = useAuthStatus()
  const { data: myTeamData } = useMyTeam(isAuthenticated && !!submittedId)

  const expiryState = computeAuthExpiryState(expiresAt, Math.floor(Date.now() / 1000))

  const scoredPlayers = useMemo(
    () => computeAllGemScores(playersData ?? []),
    [playersData],
  )

  const transferResult = useMemo(() => {
    if (!squadData || scoredPlayers.length === 0) return null
    return computeTransferSuggestions(
      squadData.picks,
      scoredPlayers,
      squadData.entry_history.bank,
      freeTransfers,
      squadData.active_chip as ChipState,
    )
  }, [squadData, scoredPlayers, freeTransfers])

  const clubFormMap = useMemo(() => {
    if (!clubFormData) return new Map<number, ClubForm>()
    return new Map(clubFormData.map(cf => [cf.team_id, cf]))
  }, [clubFormData])

  const lifecycleLabels = useMemo(() => {
    if (!squadData || scoredPlayers.length === 0) return new Map()
    return computeLifecycleLabels(squadData.picks, scoredPlayers, clubFormMap)
  }, [squadData, scoredPlayers, clubFormMap])

  const captaincyCandidates = useMemo(() => {
    if (!squadData || scoredPlayers.length === 0) return []
    return computeCaptaincyCandidates(squadData.picks, scoredPlayers)
  }, [squadData, scoredPlayers])

  // Phase 65 WHY-03 (D-10): verdicts threaded down to SquadView for rejection-reason derivation.
  const verdicts = useMemo(() => {
    if (!squadData || scoredPlayers.length === 0) return new Map()
    return computeVerdicts(squadData.picks, scoredPlayers)
  }, [squadData, scoredPlayers])

  const exactSellPrices = useMemo(() => {
    if (!myTeamData) return new Map<number, number>()
    return new Map(myTeamData.picks.map(p => [p.element, p.selling_price]))
  }, [myTeamData])

  const derivedFtCount: 1 | 2 = useMemo(() => {
    if (!isAuthenticated || !myTeamData) return 1
    const chip = squadData?.active_chip
    if (chip === 'wildcard' || chip === 'freehit') return 1
    return myTeamData.entry_history.event_transfers === 0 ? 2 : 1
  }, [isAuthenticated, myTeamData, squadData])

  useEffect(() => {
    setOcsFtCount(derivedFtCount)
  }, [derivedFtCount])

  const ocsSuggestions: TransferSuggestion[] = useMemo(() => {
    if (!squadData || scoredPlayers.length === 0) return []
    return suggestTransfers({
      currentPicks: squadData.picks,
      players: scoredPlayers,
      horizon: ocsHorizon,
      ftCount: ocsFtCount,
      bank: squadData.entry_history.bank,
      sellPrices: exactSellPrices,
    })
  }, [squadData, scoredPlayers, ocsHorizon, ocsFtCount, exactSellPrices])

  const ocsRows: OCSRow[] = useMemo(
    () => computeOpportunityCostRows(ocsSuggestions, ocsFtCount),
    [ocsSuggestions, ocsFtCount],
  )

  // Phase 65 WHY-02 (D-11..D-14): top-3 high-ownership players absent from OCS suggestions.
  // Filter: selected_by_percent > 20 (parseFloat per Pitfall 2) AND id not in suggestedBuyIds.
  // Sort desc by selected_by_percent, cap at 3 (D-13).
  const highOwnershipAbsent: HighOwnershipEntry[] = useMemo(() => {
    if (!squadData || scoredPlayers.length === 0) return []
    const squadIds = new Set(squadData.picks.map(p => p.element))
    // CR-02: derive in-squad status from starters only (position < 12) so bench players
    // are not treated as in-squad — bench players would have inSquad=true but squadRank=undefined
    // (absent from startingXiByPos), producing the misleading "ranked #?" copy in HighOwnershipCallout.
    const startingIds = new Set(squadData.picks.filter(p => p.position < 12).map(p => p.element))
    const suggestedBuyIds = new Set(
      ocsSuggestions.flatMap(s =>
        s.kind === 'single' ? [s.buy.id] : s.transfers.map(t => t.buy.id)
      )
    )
    const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

    // Pre-compute starting-XI ranks within each position for in-squad copy variant
    // (RESEARCH Open Q2: "rank within your squad" = starters only at that position).
    const startingXiByPos = new Map<number, ScoredPlayer[]>()
    for (const pick of squadData.picks) {
      if (pick.position >= 12) continue   // exclude bench
      const player = scoredPlayers.find(p => p.id === pick.element)
      if (!player) continue
      const list = startingXiByPos.get(player.element_type) ?? []
      list.push(player)
      startingXiByPos.set(player.element_type, list)
    }
    for (const list of startingXiByPos.values()) {
      list.sort((a, b) => (b.xPts_1gw ?? 0) - (a.xPts_1gw ?? 0))
    }

    return scoredPlayers
      .filter(p => { const v = parseFloat(p.selected_by_percent); return !isNaN(v) && v > 20 }) // Pitfall 2
      .filter(p => !suggestedBuyIds.has(p.id))                        // absence detection (Pattern 4 / Pitfall 6)
      .sort((a, b) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent))
      .slice(0, 3)                                                    // D-13 cap at 3
      .map<HighOwnershipEntry>(p => {
        const inSquad = startingIds.has(p.id)
        const posCode = POSITION_LABELS[p.element_type] ?? '??'
        let squadRank: number | undefined
        if (inSquad) {
          const list = startingXiByPos.get(p.element_type) ?? []
          const idx = list.findIndex(x => x.id === p.id)
          squadRank = idx === -1 ? undefined : idx + 1
        }
        return { player: p, inSquad, squadRank, posCode }
      })
  }, [squadData, scoredPlayers, ocsSuggestions])

  const effectiveEntryHistory = (isAuthenticated && myTeamData)
    ? myTeamData.entry_history
    : squadData?.entry_history

  const nextGw = squadData ? squadData.entry_history.event + 1 : 0

  const openModal = useCallback(() => setIsModalOpen(true), [])
  const closeModal = useCallback(() => setIsModalOpen(false), [])
  const handleAuthSuccess = useCallback(() => {
    setAuthenticated()
    setIsModalOpen(false)
  }, [setAuthenticated])

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    clearAuthenticated()
  }, [clearAuthenticated])

  const isLoading = squadLoading || playersLoading

  return (
    <div className="max-w-7xl space-y-4">
      {/* Team ID input + auth */}
      <div className="rounded border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Load Your Squad</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit() }} className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor="teamId" className="text-sm text-zinc-600 dark:text-zinc-400">
              FPL Team ID
            </label>
            <input
              id="teamId"
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              value={teamId}
              onChange={e => onTeamIdChange(e.target.value)}
              placeholder="e.g. 1234567"
              className="border border-zinc-300 dark:border-zinc-600 rounded px-3 py-1.5 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-400 w-full sm:w-40"
            />
          </div>

          {/* Free transfers selector */}
          <div className="flex flex-col gap-1">
            <label htmlFor="freeTransfers" className="text-sm text-zinc-600 dark:text-zinc-400">
              Free transfers:{' '}
              <span
                className="text-zinc-400 cursor-help underline underline-offset-2 decoration-dotted"
                title="Enter your available free transfers (check FPL app)"
              >
                ?
              </span>
            </label>
            <input
              id="freeTransfers"
              type="number"
              min={1}
              max={5}
              value={freeTransfers}
              onChange={e => setFreeTransfers(Math.max(1, Math.min(5, Number(e.target.value))))}
              className="border border-zinc-300 dark:border-zinc-600 rounded px-3 py-1.5 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-400 w-full sm:w-20"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors cursor-pointer active:scale-95 transition-transform w-full sm:w-auto"
          >
            Load Squad
          </button>
        </form>

        {/* Auth — available immediately, independent of squad loading */}
        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2">
          {!isAuthenticated ? (
            <button
              onClick={openModal}
              className="text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2 cursor-pointer active:scale-95 transition-transform"
            >
              Connect FPL account for exact prices &rarr;
            </button>
          ) : (
            <div className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-3 flex-wrap">
              {expiryState === 'normal' && (
                <span>
                  FPL connected
                  {expiresAt && (
                    <span className="text-zinc-400 ml-1">
                      &bull; valid until{' '}
                      {new Date(expiresAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </span>
              )}
              {expiryState === 'expiring-soon' && (
                <span className="text-amber-600 dark:text-amber-400">
                  Expires soon &mdash; valid until{' '}
                  {expiresAt && new Date(expiresAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {expiryState === 'expired' && (
                <button
                  onClick={openModal}
                  className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 underline underline-offset-2 cursor-pointer active:scale-95 transition-transform"
                >
                  Token expired &mdash; reconnect &rarr;
                </button>
              )}
              <button
                onClick={handleLogout}
                className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
              >
                Disconnect
              </button>
            </div>
          )}

          <AuthModal
            open={isModalOpen}
            onClose={closeModal}
            onSuccess={handleAuthSuccess}
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && submittedId && (
        <div className="rounded border border-zinc-200 dark:border-zinc-700 p-4 text-sm text-zinc-500 dark:text-zinc-400">
          Loading squad...
        </div>
      )}

      {/* Error state */}
      {squadError && (
        <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
          {squadError instanceof Error ? squadError.message : String(squadError)}
        </div>
      )}

      {/* Squad and suggestions (only when data is loaded) */}
      {squadData && scoredPlayers.length > 0 && (
        <>
          {/* Squad display */}
          <div className="rounded border border-zinc-200 dark:border-zinc-700 p-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Your Squad</h2>

            <SquadView
              picks={squadData.picks}
              allPlayers={scoredPlayers}
              entryHistory={effectiveEntryHistory ?? squadData.entry_history}
              labels={lifecycleLabels}
              exactSellPrices={exactSellPrices}
              isAuthenticated={isAuthenticated}
              verdicts={verdicts}
              captaincyCandidates={captaincyCandidates}
            />
          </div>

          {/* Captaincy picks */}
          {captaincyCandidates.length > 0 && (
            <CaptaincyPanel candidates={captaincyCandidates} nextGw={nextGw} />
          )}

          {/* Chip warning */}
          {transferResult?.type === 'CHIP_WARNING' && transferResult.chip === 'freehit' && (
            <div className="rounded border border-amber-400 bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-800 dark:text-amber-200">
              <span className="font-semibold">Free Hit active</span> — your squad is temporary this
              gameweek. Transfer suggestions are paused.
            </div>
          )}

          {transferResult?.type === 'CHIP_WARNING' && transferResult.chip === 'wildcard' && (
            <div className="rounded border border-blue-400 bg-blue-50 dark:bg-blue-950 p-4 text-sm text-blue-800 dark:text-blue-200">
              <span className="font-semibold">Wildcard active</span> — unlimited transfers
              available.
            </div>
          )}

          {/* Save recommendation */}
          {transferResult?.type === 'SAVE' && (
            <div className="rounded border border-green-400 bg-green-50 dark:bg-green-950 p-4 text-sm text-green-800 dark:text-green-200">
              No transfer improves your squad Gem rating. Save your transfer and bank it for next
              week.
            </div>
          )}

          {/* Phase 65 WHY-02: callout above OCS section (D-11) — visible only when entries non-empty. */}
          <HighOwnershipCallout entries={highOwnershipAbsent} />

          {/* OCS section */}
          <div className="rounded border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Transfer Opportunity Cost
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <FtToggle value={ocsFtCount} onChange={setOcsFtCount} />
                <GwToggle value={ocsHorizon} onChange={setOcsHorizon} />
              </div>
            </div>
            {isAuthenticated && myTeamData && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                Detected from your FPL team — override if needed.
              </p>
            )}
            <OpportunityCostTable rows={ocsRows} horizon={ocsHorizon} />
          </div>

          {/* Transfer suggestions */}
          {transferResult?.type === 'SUGGESTIONS' && transferResult.suggestions && (
            <div className="rounded border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Suggested Transfers</h2>

              <div className="space-y-2">
                {transferResult.suggestions
                  .slice(0, freeTransfers * 3)
                  .map((s: SingleTransfer, i: number) => (
                    <div
                      key={i}
                      className="rounded border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 space-y-0.5"
                    >
                      {/* Row 1: players + badges */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-900 dark:text-zinc-100">
                        <span>Sell</span>
                        <span className="font-medium">{s.sell.web_name}</span>
                        <MinsRiskBadge minsRisk={s.sell.mins_risk} mins60Prob={s.sell.mins_60_prob} />
                        <span className="text-zinc-500 dark:text-zinc-400">({s.sell.gem_score.toFixed(2)})</span>
                        {/* GW price trend — decision-relevant, always visible */}
                        {(s.sell.cost_change_event ?? 0) > 0 && (
                          <span className="text-green-600 text-xs">↑{((s.sell.cost_change_event ?? 0) / 10).toFixed(1)}</span>
                        )}
                        {(s.sell.cost_change_event ?? 0) < 0 && (
                          <span className="text-red-600 text-xs">↓{(Math.abs(s.sell.cost_change_event ?? 0) / 10).toFixed(1)}</span>
                        )}
                        {/* Season price trend — hide on mobile */}
                        {(s.sell.cost_change_start ?? 0) !== 0 && (
                          <span className="hidden sm:inline text-zinc-400 text-[10px]">({(s.sell.cost_change_start ?? 0) > 0 ? '+' : '-'}{(Math.abs(s.sell.cost_change_start ?? 0) / 10).toFixed(1)}m season)</span>
                        )}
                        <span>&rarr;</span>
                        <span>Buy</span>
                        <span className="font-medium">{s.buy.web_name}</span>
                        <span className="text-zinc-500 dark:text-zinc-400">({s.buy.gem_score.toFixed(2)})</span>
                        {/* GW price trend — decision-relevant, always visible */}
                        {(s.buy.cost_change_event ?? 0) > 0 && (
                          <span className="text-green-600 text-xs">↑{((s.buy.cost_change_event ?? 0) / 10).toFixed(1)}</span>
                        )}
                        {(s.buy.cost_change_event ?? 0) < 0 && (
                          <span className="text-red-600 text-xs">↓{(Math.abs(s.buy.cost_change_event ?? 0) / 10).toFixed(1)}</span>
                        )}
                        {/* Season price trend — hide on mobile */}
                        {(s.buy.cost_change_start ?? 0) !== 0 && (
                          <span className="hidden sm:inline text-zinc-400 text-[10px]">({(s.buy.cost_change_start ?? 0) > 0 ? '+' : '-'}{(Math.abs(s.buy.cost_change_start ?? 0) / 10).toFixed(1)}m season)</span>
                        )}
                      </div>
                      {/* Row 2: stats */}
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Gem improvement:{' '}
                        <span className="text-zinc-700 dark:text-zinc-300">+{s.gem_delta.toFixed(2)}</span>
                        {' '}| Cost:{' '}
                        <span className="text-zinc-700 dark:text-zinc-300">
                          £{s.approx_cost.toFixed(1)}m
                        </span>{' '}
                        <span className="text-zinc-400 dark:text-zinc-500">(approx)</span>
                        {' '}| xPts (1 GW):{' '}
                        <span className="text-zinc-700 dark:text-zinc-300">{(s.sell.xPts_1gw ?? 0).toFixed(1)}</span>
                        {' '}&rarr;{' '}
                        <span className="text-zinc-700 dark:text-zinc-300">{(s.buy.xPts_1gw ?? 0).toFixed(1)}</span>
                      </div>
                      {/* Row 3: budget badge */}
                      <div>
                        {s.budget_sufficient ? (
                          <span className="inline-block text-xs font-medium text-green-700 dark:text-green-200 bg-green-100 dark:bg-green-900 rounded px-1.5 py-0.5">
                            Affordable
                          </span>
                        ) : (
                          <span className="inline-block text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900 rounded px-1.5 py-0.5">
                            Over budget
                          </span>
                        )}
                      </div>
                      {/* Row 4: fragility note (Phase 64 SENS-01/02) */}
                      {(() => {
                        const xPtsGain = (s.buy.xPts_1gw ?? 0) - (s.sell.xPts_1gw ?? 0)
                        const { fragile, reasons } = computeFragility(s.buy, true, xPtsGain)
                        return fragile ? <FragilityNote reasons={reasons} /> : null
                      })()}
                    </div>
                  ))}
              </div>

              {/* 2-transfer combo */}
              {transferResult.two_transfer_combo && (
                <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">2-Transfer Combo</h3>
                  {transferResult.two_transfer_combo.map((s: SingleTransfer, i: number) => (
                    <div
                      key={i}
                      className="rounded border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 space-y-0.5"
                    >
                      {/* Row 1: players + badges */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-900 dark:text-zinc-100">
                        <span>Sell</span>
                        <span className="font-medium">{s.sell.web_name}</span>
                        <MinsRiskBadge minsRisk={s.sell.mins_risk} mins60Prob={s.sell.mins_60_prob} />
                        <span className="text-zinc-500 dark:text-zinc-400">({s.sell.gem_score.toFixed(2)})</span>
                        {/* GW price trend — decision-relevant, always visible */}
                        {(s.sell.cost_change_event ?? 0) > 0 && (
                          <span className="text-green-600 text-xs">↑{((s.sell.cost_change_event ?? 0) / 10).toFixed(1)}</span>
                        )}
                        {(s.sell.cost_change_event ?? 0) < 0 && (
                          <span className="text-red-600 text-xs">↓{(Math.abs(s.sell.cost_change_event ?? 0) / 10).toFixed(1)}</span>
                        )}
                        {/* Season price trend — hide on mobile */}
                        {(s.sell.cost_change_start ?? 0) !== 0 && (
                          <span className="hidden sm:inline text-zinc-400 text-[10px]">({(s.sell.cost_change_start ?? 0) > 0 ? '+' : '-'}{(Math.abs(s.sell.cost_change_start ?? 0) / 10).toFixed(1)}m season)</span>
                        )}
                        <span>&rarr;</span>
                        <span>Buy</span>
                        <span className="font-medium">{s.buy.web_name}</span>
                        <span className="text-zinc-500 dark:text-zinc-400">({s.buy.gem_score.toFixed(2)})</span>
                        {/* GW price trend — decision-relevant, always visible */}
                        {(s.buy.cost_change_event ?? 0) > 0 && (
                          <span className="text-green-600 text-xs">↑{((s.buy.cost_change_event ?? 0) / 10).toFixed(1)}</span>
                        )}
                        {(s.buy.cost_change_event ?? 0) < 0 && (
                          <span className="text-red-600 text-xs">↓{(Math.abs(s.buy.cost_change_event ?? 0) / 10).toFixed(1)}</span>
                        )}
                        {/* Season price trend — hide on mobile */}
                        {(s.buy.cost_change_start ?? 0) !== 0 && (
                          <span className="hidden sm:inline text-zinc-400 text-[10px]">({(s.buy.cost_change_start ?? 0) > 0 ? '+' : '-'}{(Math.abs(s.buy.cost_change_start ?? 0) / 10).toFixed(1)}m season)</span>
                        )}
                      </div>
                      {/* Row 2: stats */}
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Gem improvement:{' '}
                        <span className="text-zinc-700 dark:text-zinc-300">+{s.gem_delta.toFixed(2)}</span>
                        {' '}| Cost:{' '}
                        <span className="text-zinc-700 dark:text-zinc-300">
                          £{s.approx_cost.toFixed(1)}m
                        </span>{' '}
                        <span className="text-zinc-400 dark:text-zinc-500">(approx)</span>
                        {' '}| xPts (1 GW):{' '}
                        <span className="text-zinc-700 dark:text-zinc-300">{(s.sell.xPts_1gw ?? 0).toFixed(1)}</span>
                        {' '}&rarr;{' '}
                        <span className="text-zinc-700 dark:text-zinc-300">{(s.buy.xPts_1gw ?? 0).toFixed(1)}</span>
                      </div>
                      {/* Fragility note (Phase 64 SENS-01/02) — combo cards have no Row 3 budget badge */}
                      {(() => {
                        const xPtsGain = (s.buy.xPts_1gw ?? 0) - (s.sell.xPts_1gw ?? 0)
                        const { fragile, reasons } = computeFragility(s.buy, true, xPtsGain)
                        return fragile ? <FragilityNote reasons={reasons} /> : null
                      })()}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-1">
                Prices are approximate (based on current market price, not your actual sell price).
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
