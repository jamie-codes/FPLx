'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSquad } from '@/lib/hooks/useSquad'
import { deriveFreeTransfers } from '@/lib/free-transfers'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { useLineupNews } from '@/lib/hooks/useLineupNews'
import { computeAllGemScores } from '@/lib/gem-score'
// transfer-engine import removed in Phase 74 D-02
import { useClubForm } from '@/lib/hooks/useClubForm'
import { computeLifecycleLabels } from '@/lib/lifecycle-label'
import type { ClubForm, ScoredPlayer } from '@/lib/types'
import { computeCaptaincyCandidates } from '@/lib/captaincy-engine'
import { SquadView } from '@/components/squad/SquadView'
// Phase 74 D-02: shared-component imports removed with legacy section
import { computeVerdicts } from '@/lib/recommend'
import { HighOwnershipCallout, type HighOwnershipEntry } from '@/components/transfers/HighOwnershipCallout'
import { RejectionSearchCallout } from '@/components/transfers/RejectionSearchCallout'
import { CaptaincyPanel } from '@/components/captaincy/CaptaincyPanel'
import { AuthModal } from '@/components/transfers/AuthModal'
import { computeAuthExpiryState } from '@/lib/auth-expiry'
import { suggestTransfers } from '@/lib/suggest-transfers'
import { computeOpportunityCostRows } from '@/lib/opportunity-cost'
import type { OCSRow } from '@/lib/opportunity-cost'
import type { OptimiserHorizon, TransferSuggestion } from '@/lib/types'
// Phase 74 D-03: import of OCS-header toggle removed — engine uses derivedFtCount directly (toggle file preserved in OptimiserPanel)
import { GwToggle } from '@/components/gem-table/GwToggle'
import { OpportunityCostTable } from '@/components/transfers/OpportunityCostTable'
import { capByPosition } from '@/lib/cap-transfer-suggestions'
import { useTransferNews } from '@/lib/hooks/useTransferNews'
import { buildConfirmedSigningMap } from '@/lib/buildConfirmedSigningMap'

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
  // Phase 101 GWT-01: target GW for per-GW xPts re-ranking. null = horizon mode.
  const [targetGw, setTargetGw] = useState<number | null>(null)
  // Phase 74 D-08: manual ft-count state removed — derivedFtCount used directly
  const [manualBank, setManualBank] = useState<number>(0)

  const { data: squadData, isLoading: squadLoading, error: squadError } = useSquad(submittedId)
  const { data: playersData, isLoading: playersLoading } = usePlayers()
  const { data: clubFormData } = useClubForm()
  const { isAuthenticated, expiresAt, setAuthenticated, clearAuthenticated } = useAuthStatus()
  const { data: myTeamData } = useMyTeam(isAuthenticated && !!submittedId)
  const { data: lineupNewsMap } = useLineupNews()
  // Phase 125 WIN-02 (D-14..D-16): confirmed signing lookup for OpportunityCostTable buy candidates.
  const { data: transferNewsFeed } = useTransferNews()
  const confirmedSigningMap = useMemo(
    () => buildConfirmedSigningMap(transferNewsFeed?.articles ?? []),
    [transferNewsFeed]
  )

  const expiryState = computeAuthExpiryState(expiresAt, Math.floor(Date.now() / 1000))

  const scoredPlayers = useMemo(
    () => computeAllGemScores(playersData ?? []),
    [playersData],
  )

  // Phase 101 GWT-01: distinct event_id values across all players' fixtures, sorted ascending.
  // WR-01: filter to future GWs only (event_id > currentGw) to avoid past GWs in dropdown.
  const availableGws: number[] = useMemo(() => {
    const currentGw = squadData?.entry_history.event ?? 0
    const ids = new Set<number>()
    for (const p of scoredPlayers) {
      for (const f of p.fixtures) {
        if (f.event_id > currentGw) ids.add(f.event_id)
      }
    }
    return Array.from(ids).sort((a, b) => a - b)
  }, [scoredPlayers, squadData])

  // Phase 74 D-02: legacy transfer-suggestion memo removed

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
    // CR-02 (gap-closure 074-05): unauthenticated path now reads the manual freeTransfers input.
    // Authenticated path still derives from FPL myTeamData / chip state.
    if (!isAuthenticated || !myTeamData) {
      return (freeTransfers >= 2 ? 2 : 1) as 1 | 2
    }
    return deriveFreeTransfers(myTeamData, squadData?.active_chip)
  }, [isAuthenticated, myTeamData, squadData, freeTransfers])

  // Pre-fill manualBank from FPL when authenticated. DO NOT include manualBank in deps (Pitfall 5)
  // — that would loop on user edits.
  useEffect(() => {
    if (isAuthenticated && myTeamData) {
      setManualBank(myTeamData.entry_history.bank / 10)
    }
  }, [isAuthenticated, myTeamData])

  // Phase 112 TFR-02 (D-05, D-06): wrap suggestTransfers output in capByPosition(3) to limit
  // buy candidates to the top 3 per element_type bucket. Engine file is NOT modified (D-05).
  // ocsSuggestions is the capped list; ocsTotalsByPosition carries pre-cap counts for footnote (D-07).
  // highOwnershipAbsent continues to use ocsSuggestions (now the capped list — desired behavior: the
  // user sees what we actually surface, so the HO callout pivots on the capped output).
  const { ocsSuggestions, ocsTotalsByPosition } = useMemo<{ ocsSuggestions: TransferSuggestion[]; ocsTotalsByPosition: Map<number, number> }>(() => {
    if (!squadData || scoredPlayers.length === 0) return { ocsSuggestions: [], ocsTotalsByPosition: new Map() }
    // FIX-02 (Phase 111 D-08): position lock is enforced inside suggestTransfers — engine guarantees sell.element_type === buy.element_type per leg. Do NOT pre-filter players by position; the engine builds top-30-per-position pools internally.
    const raw = suggestTransfers({
      currentPicks: squadData.picks,
      players: scoredPlayers,
      horizon: ocsHorizon,
      ftCount: derivedFtCount,
      bank: Math.round(manualBank * 10),
      sellPrices: exactSellPrices,
      targetGw: targetGw ?? undefined,
    })
    const { suggestions, totalsByPosition } = capByPosition(raw, 3)
    return { ocsSuggestions: suggestions, ocsTotalsByPosition: totalsByPosition }
  }, [squadData, scoredPlayers, ocsHorizon, derivedFtCount, manualBank, exactSellPrices, targetGw])

  const ocsRows: OCSRow[] = useMemo(
    () => computeOpportunityCostRows(ocsSuggestions, derivedFtCount, Math.round(manualBank * 10)),
    [ocsSuggestions, derivedFtCount, manualBank],
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
      <div className="rounded border border-line p-4 space-y-3">
        <h2 className="text-base font-semibold text-ink">Load Your Squad</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit() }} className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor="teamId" className="text-sm text-ink-muted">
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
              className="border border-line rounded-md min-h-[44px] px-3 py-1.5 text-base sm:text-sm text-ink bg-surface-1 w-full sm:w-40"
            />
          </div>

          {/* Free transfers selector */}
          <div className="flex flex-col gap-1">
            <label htmlFor="freeTransfers" className="text-sm text-ink-muted">
              Free transfers:{' '}
              <span
                className="text-ink-muted cursor-help underline underline-offset-2 decoration-dotted"
                title="Enter your available free transfers (check FPL app)"
              >
                ?
              </span>
            </label>
            <input
              id="freeTransfers"
              type="number"
              min={1}
              max={2}
              value={freeTransfers}
              onChange={e => setFreeTransfers(Math.max(1, Math.min(2, Number(e.target.value))))}
              className="border border-line rounded-md min-h-[44px] px-3 py-1.5 text-base sm:text-sm text-ink bg-surface-1 w-full sm:w-20"
            />
          </div>

          {/* Bank balance input — TFX-05, D-09..D-12 */}
          <div className="flex flex-col gap-1">
            <label htmlFor="bankBalance" className="text-sm text-ink-muted">
              Bank balance
              <span title="Your available transfer budget in £m. Pre-filled from FPL when connected."
                    className="text-ink-muted cursor-help underline underline-offset-2 decoration-dotted ml-1">
                ?
              </span>
            </label>
            <div className="relative flex items-center">
              <input
                id="bankBalance"
                type="number"
                min={0}
                max={20}
                step={0.1}
                value={manualBank}
                onChange={e => setManualBank(Math.max(0, Number(e.target.value)))}
                placeholder="0.0"
                className="border border-line rounded-md min-h-[44px] px-3 py-1.5 pr-10 text-base sm:text-sm text-ink bg-surface-1 w-full sm:w-28"
              />
              <span className="absolute right-3 text-xs text-ink-muted pointer-events-none">
                £m
              </span>
            </div>
            {isAuthenticated && myTeamData && (
              <p className="text-xs text-ink-muted italic">From your FPL account — override if needed.</p>
            )}
          </div>

          <button
            type="submit"
            className="px-4 py-1.5 min-h-[44px] bg-ink text-surface-1 text-sm font-medium rounded hover:opacity-90 transition cursor-pointer active:scale-95 w-full sm:w-auto"
          >
            Load Squad
          </button>
        </form>

        {/* Auth — available immediately, independent of squad loading */}
        <div className="border-t border-line pt-2">
          {!isAuthenticated ? (
            <button
              onClick={openModal}
              className="text-sm text-accent hover:text-accent-hover underline underline-offset-2 cursor-pointer active:scale-95 transition-transform"
            >
              Connect FPL account for exact prices &rarr;
            </button>
          ) : (
            <div className="text-sm text-ink-muted flex items-center gap-3 flex-wrap">
              {expiryState === 'normal' && (
                <span>
                  FPL connected
                  {expiresAt && (
                    <span className="text-ink-muted ml-1">
                      &bull; valid until{' '}
                      {new Date(expiresAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </span>
              )}
              {expiryState === 'expiring-soon' && (
                <span className="text-warning">
                  Expires soon &mdash; valid until{' '}
                  {expiresAt && new Date(expiresAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {expiryState === 'expired' && (
                <button
                  onClick={openModal}
                  className="text-warning hover:opacity-80 underline underline-offset-2 cursor-pointer active:scale-95 transition-transform"
                >
                  Token expired &mdash; reconnect &rarr;
                </button>
              )}
              <button
                onClick={handleLogout}
                className="text-accent hover:text-accent-hover underline underline-offset-2"
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
        <div className="rounded border border-line p-4 text-sm text-ink-muted">
          Loading squad...
        </div>
      )}

      {/* Error state */}
      {squadError && (
        <div className="rounded border border-negative/40 bg-negative-soft p-4 text-sm text-negative">
          {squadError instanceof Error ? squadError.message : String(squadError)}
        </div>
      )}

      {/* Phase 94 WHY-01-A: always-visible rejection search — renders pre-squad-load (D-07).
          lifecycleLabels is the existing useMemo: returns new Map() when squad not loaded,
          so lifecycle reasons silently do not fire (D-05). */}
      {scoredPlayers.length > 0 && (
        <RejectionSearchCallout
          players={scoredPlayers}
          lifecycleLabels={lifecycleLabels}
        />
      )}

      {/* Squad and suggestions (only when data is loaded) */}
      {squadData && scoredPlayers.length > 0 && (
        <>
          {/* Squad display */}
          <div className="rounded border border-line p-4">
            <h2 className="text-base font-semibold text-ink mb-3">Your Squad</h2>

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

          {/* Phase 65 WHY-02: callout above OCS section (D-11) — visible only when entries non-empty. */}
          <HighOwnershipCallout entries={highOwnershipAbsent} />

          {/* OCS section */}
          <div className="rounded border border-line p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-ink">
                Transfer Opportunity Cost
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                {/* Phase 74 D-03: OCS header toggle removed — engine uses derivedFtCount directly */}
                <GwToggle value={ocsHorizon} onChange={setOcsHorizon} disabled={!!targetGw} />
                {/* Phase 101 GWT-01: Target GW dropdown (D-01, D-02, D-03) */}
                <select
                  aria-label="Target gameweek"
                  value={targetGw ?? ''}
                  onChange={e => setTargetGw(e.target.value ? Number(e.target.value) : null)}
                  className="border border-line rounded-md min-h-[44px] text-sm text-ink bg-surface-1 px-2 py-1"
                >
                  <option value="">Target GW</option>
                  {availableGws.map(gw => (
                    <option key={gw} value={gw}>GW{gw}</option>
                  ))}
                </select>
              </div>
            </div>
            {isAuthenticated && myTeamData && (
              <p className="text-xs text-ink-muted italic">
                Detected from your FPL team — override if needed.
              </p>
            )}
            {/* Phase 101 GWT-01: ranked-by sub-label when GWT mode active (D-05 + UI-SPEC §GWT Active Mode Sub-Label) */}
            {targetGw !== null && (
              <p className="text-xs text-ink-muted italic">
                Ranked by GW{targetGw} xPts
              </p>
            )}
            <OpportunityCostTable
              rows={ocsRows}
              horizon={ocsHorizon}
              targetGw={targetGw ?? undefined}
              gw={nextGw}
              allPlayers={scoredPlayers}
              lifecycleLabels={lifecycleLabels}
              lineupNewsMap={lineupNewsMap}
              totalsByPosition={ocsTotalsByPosition}
              confirmedSigningMap={confirmedSigningMap}
            />
          </div>

          {/* Phase 74 D-02: legacy section removed */}
        </>
      )}
    </div>
  )
}
