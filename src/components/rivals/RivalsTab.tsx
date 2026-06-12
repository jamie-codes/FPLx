'use client'
// Phase 58 ML-01..ML-08 (D-02, D-09, D-12): Rivals sub-tab container.
//
// Sources of truth:
//   - .planning/phases/058-mini-league-rival-tracker/058-CONTEXT.md
//   - .planning/phases/058-mini-league-rival-tracker/058-UI-SPEC.md
//   - .planning/phases/058-mini-league-rival-tracker/058-RESEARCH.md §Pattern 4 (localStorage),
//     §Common Pitfalls 4-6 (gating on playersData, suggestTransfers fallback, captain enrichment)
//
// Layout: League ID input form → progress note (loading) → summary table → detail panel.
import { useState, useMemo, useCallback } from 'react'
import { useRivals } from '@/lib/hooks/useRivals'
import { useSquad } from '@/lib/hooks/useSquad'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { computePositionMedians } from '@/lib/rival-intel'
import { suggestTransfers } from '@/lib/suggest-transfers'
import { computeEOCandidates } from '@/lib/eo-candidates'
import { RivalSummaryTable } from './RivalSummaryTable'
import { RivalDetailPanel } from './RivalDetailPanel'
import type { MergedPlayer } from '@/lib/types'

interface RivalsTabProps {
  /** Optional — when present:
   *  (1) used to fetch the user's own squad (for shared/advantage computations and squad-driven suggestTransfers),
   *  (2) passed through to useRivals so the hook can derive userRank from the standings response and
   *      compute rankGap correctly for each rival (ML-02). */
  submittedId: string | null
}

const LEAGUE_ID_KEY = 'fplx_mini_league_id'

export function RivalsTab({ submittedId }: RivalsTabProps) {
  // Mirrors page.tsx team-id pattern (RESEARCH §Pattern 4).
  const [leagueId, setLeagueId] = useState<string>(() => {
    try { return localStorage.getItem(LEAGUE_ID_KEY) ?? '' } catch { return '' }
  })
  const [submittedLeagueId, setSubmittedLeagueId] = useState<string | null>(() => {
    try { return localStorage.getItem(LEAGUE_ID_KEY) } catch { return null }
  })
  const [selectedRivalId, setSelectedRivalId] = useState<number | null>(null)

  const trimmed = leagueId.trim()
  const isValidLeagueId = /^\d+$/.test(trimmed)
  const showInvalid = trimmed.length > 0 && !isValidLeagueId

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!isValidLeagueId) return
    setSubmittedLeagueId(trimmed)
    try { localStorage.setItem(LEAGUE_ID_KEY, trimmed) } catch {}
    setSelectedRivalId(null)
  }, [isValidLeagueId, trimmed])

  // ML-02: pass submittedId through as userTeamId; useRivals does the standings lookup and
  // computes each rival's rankGap = rival.rank - userRank. No hardcoded null fallback —
  // when submittedId is null, useRivals returns rankGap=0 for all rivals (graceful default).
  const { data: rivalsData, isLoading: rivalsLoading, error: rivalsError } =
    useRivals(submittedLeagueId, submittedId)

  const { data: squadData } = useSquad(submittedId)
  const { data: playersData, isLoading: playersLoading } = usePlayers()

  const playerById = useMemo<Map<number, MergedPlayer>>(() => {
    if (!playersData) return new Map()
    return new Map(playersData.map(p => [p.id, p]))
  }, [playersData])

  const playerNameById = useMemo<Map<number, string>>(() => {
    if (!playersData) return new Map()
    return new Map(playersData.map(p => [p.id, p.web_name]))
  }, [playersData])

  const posMedians = useMemo(() => computePositionMedians(playersData ?? []), [playersData])

  const userPickIds = useMemo<Set<number>>(() => {
    if (!squadData) return new Set()
    return new Set(squadData.picks.map(p => p.element))
  }, [squadData])

  // suggestTransfers — D-09: invoke once, horizon=1, ftCount=1, empty sellPrices map (graceful fallback).
  // RESEARCH §Pitfall 5: when unauthenticated, sellValueFor falls back to now_cost.
  const transferSuggestions = useMemo(() => {
    if (!squadData || !playersData) return []
    // FIX-02 (Phase 111 D-08): position lock is enforced inside suggestTransfers — engine guarantees sell.element_type === buy.element_type per leg. Do NOT pre-filter players by position; the engine builds top-30-per-position pools internally.
    return suggestTransfers({
      currentPicks: squadData.picks,
      players: playersData,
      horizon: 1,
      ftCount: 1,
      bank: squadData.entry_history.bank,
      sellPrices: new Map(),
    })
  }, [squadData, playersData])

  // WR-01: prefer the actual captain from the user's squad when available.
  // Fall back to the global best-xPts candidate (assumption A2) only when squad is unavailable.
  const userCaptainCandidate = useMemo<MergedPlayer | null>(() => {
    if (squadData && playersData) {
      const capPick = squadData.picks.find(p => p.multiplier === 2 || p.is_captain)
      if (capPick) return playerById.get(capPick.element) ?? null
    }
    if (!playersData) return null
    const top = computeEOCandidates(playersData, 'max_xpts', 1)
    return top[0] ?? null
  }, [squadData, playersData, playerById])

  const selectedRival = useMemo(() => {
    if (!rivalsData || selectedRivalId === null) return null
    return rivalsData.rivals.find(r => r.entryId === selectedRivalId) ?? null
  }, [rivalsData, selectedRivalId])

  // Initial state — no league ID submitted yet.
  if (submittedLeagueId === null) {
    return (
      <div className="space-y-6">
        <header>
          <h2 className="text-lg font-semibold text-ink">Track your mini-league rivals</h2>
          <p className="text-sm text-ink-muted mt-1">
            Enter your mini-league ID to see rival squads, differential picks, and captain edge estimates.
          </p>
        </header>
        <LeagueIdForm
          leagueId={leagueId}
          onLeagueIdChange={setLeagueId}
          onSubmit={handleSubmit}
          disabled={!isValidLeagueId}
          showInvalid={showInvalid}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <LeagueIdForm
        leagueId={leagueId}
        onLeagueIdChange={setLeagueId}
        onSubmit={handleSubmit}
        disabled={!isValidLeagueId}
        showInvalid={showInvalid}
      />

      {rivalsLoading && (
        <p className="text-sm text-ink-muted">
          Loading rivals…
        </p>
      )}

      {rivalsError && (
        <p className="text-sm text-negative">
          Failed to load rivals. Check your league ID and try again.
        </p>
      )}

      {rivalsData && (
        <>
          {rivalsData.leagueTruncated && (
            <p className="text-sm text-ink-muted">
              Showing first 20 rivals. Large leagues are capped at 20.
            </p>
          )}
          {playersLoading ? (
            <p className="text-sm text-ink-muted">Loading…</p>
          ) : (
            <>
              <RivalSummaryTable
                rivals={rivalsData.rivals}
                selectedRivalId={selectedRivalId}
                onSelect={setSelectedRivalId}
                playerNameById={playerNameById}
              />
              <RivalDetailPanel
                rival={selectedRival}
                userPickIds={userPickIds}
                playerById={playerById}
                posMedians={posMedians}
                userCaptainCandidate={userCaptainCandidate}
                transferSuggestions={transferSuggestions}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

interface LeagueIdFormProps {
  leagueId: string
  onLeagueIdChange: (v: string) => void
  onSubmit: (e?: React.FormEvent) => void
  disabled: boolean
  showInvalid: boolean
}

function LeagueIdForm({ leagueId, onLeagueIdChange, onSubmit, disabled, showInvalid }: LeagueIdFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-1">
      <label className="block text-sm font-medium text-ink" htmlFor="league-id-input">
        Mini-League ID
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id="league-id-input"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 12345"
          value={leagueId}
          onChange={e => onLeagueIdChange(e.target.value)}
          className="border border-line bg-surface-1 text-ink rounded-md min-h-[44px] px-3 py-2 text-base sm:text-sm w-full sm:w-40"
        />
        <button
          type="submit"
          disabled={disabled}
          className="bg-ink text-surface-1 font-medium rounded-md min-h-[48px] px-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Load Rivals
        </button>
      </div>
      {showInvalid && (
        <p className="text-xs text-negative">Please enter a numeric league ID.</p>
      )}
    </form>
  )
}
