'use client'

import { useMemo } from 'react'
import { useSquad } from '@/lib/hooks/useSquad'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useClubForm } from '@/lib/hooks/useClubForm'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { useChipHistory, type ChipHistoryEntry } from '@/lib/hooks/useChipHistory'
import { useAccuracy } from '@/lib/hooks/useAccuracy'
import { computeAllGemScores } from '@/lib/gem-score'
import { computeCaptaincyCandidates, type CaptaincyCandidate } from '@/lib/captaincy-engine'
import { computeLifecycleLabels, type LifecycleLabel } from '@/lib/lifecycle-label'
import { computeOpportunityCostRows, type OCSRow } from '@/lib/opportunity-cost'
import { suggestTransfers } from '@/lib/suggest-transfers'
import {
  buildClubFormMap,
  computeBBScore,
  computeTCScore,
  computeFHResult,
  type GWEaseScore,
  type FHResult,
} from '@/lib/chip-strategy-engine'
import { fixtureCountForGw } from '@/lib/planning-engine'
import { computeDecisionSeverity, type SeverityLevel } from '@/lib/decision-severity'
import type { ClubForm, TransferSuggestion, ProseRefreshPayload } from '@/lib/types'
import { OpportunityCostTable } from '@/components/transfers/OpportunityCostTable'
import { LifecycleLabelBadge } from '@/components/shared/LifecycleLabelBadge'
import { MinsRiskBadge } from '@/components/shared/MinsRiskBadge'
import { CHIP_LABELS } from '@/components/planner/plan-helpers'
import { ProseSummaryBlock } from './ProseSummaryBlock'
import { CalibrationHealthIndicator } from './CalibrationHealthIndicator'

// ---- Private helpers ----

const TYPE_MAP: Record<'safe' | 'upside', { bg: string; text: string; label: string; title: string }> = {
  safe: {
    bg: 'bg-blue-100 dark:bg-blue-900',
    text: 'text-blue-800 dark:text-blue-200',
    label: 'Safe',
    title: 'Safe pick: nailed starter with consistent high floor',
  },
  upside: {
    bg: 'bg-amber-100 dark:bg-amber-900',
    text: 'text-amber-800 dark:text-amber-200',
    label: 'Upside',
    title: 'Upside pick: differential or high ceiling — higher variance',
  },
}

function CaptainTypeBadge({ type }: { type: 'safe' | 'upside' }) {
  const cfg = TYPE_MAP[type]
  return (
    <span
      className={`inline-block text-xs font-normal ${cfg.text} ${cfg.bg} rounded px-2 py-1`}
      title={cfg.title}
    >
      {cfg.label}
    </span>
  )
}

const SEVERITY_CONFIG: Record<SeverityLevel, { bg: string; text: string; title: string }> = {
  HIGH: {
    bg: 'bg-red-100 dark:bg-red-900',
    text: 'text-red-700 dark:text-red-300',
    title: 'High priority — act on this',
  },
  MEDIUM: {
    bg: 'bg-amber-100 dark:bg-amber-900',
    text: 'text-amber-800 dark:text-amber-200',
    title: 'Medium priority',
  },
  LOW: {
    bg: 'bg-zinc-100 dark:bg-zinc-700',
    text: 'text-zinc-700 dark:text-zinc-300',
    title: 'Low priority',
  },
}

function SeverityBadge({ level, title }: { level: SeverityLevel; title?: string }) {
  const cfg = SEVERITY_CONFIG[level]
  return (
    <span
      className={`inline-block text-xs font-semibold ${cfg.text} ${cfg.bg} rounded px-2 py-1`}
      title={title ?? cfg.title}
    >
      {level}
    </span>
  )
}

// Copied from ChipStrategyPanel.tsx (module-private there — must re-declare here).
function easeFill(ease: number, isBGW: boolean | undefined): string {
  if (isBGW) return 'bg-zinc-200 dark:bg-zinc-700'
  if (ease >= 0.75) return 'bg-green-500'
  if (ease >= 0.55) return 'bg-green-300 dark:bg-green-700'
  if (ease >= 0.40) return 'bg-amber-300 dark:bg-amber-600'
  if (ease >= 0.25) return 'bg-red-300 dark:bg-red-700'
  return 'bg-red-500'
}

function EaseCellBar({ chip, scores }: { chip: 'bboost' | '3xc' | 'freehit'; scores: GWEaseScore[] }) {
  const ariaLabel =
    `${CHIP_LABELS[chip]} ease across next 5 GWs: ` +
    scores.map(s => (s.isBGW ? `GW${s.gw} blank` : `GW${s.gw} ease ${(s.ease * 100).toFixed(0)}%`)).join(', ')
  return (
    <div className="flex gap-1" role="img" aria-label={ariaLabel}>
      {scores.map(cell => {
        const fill = easeFill(cell.ease, cell.isBGW)
        const ring = cell.isBest ? ' ring-2 ring-offset-1 ring-green-700 dark:ring-green-300' : ''
        return (
          <div
            key={cell.gw}
            className={`w-6 h-3 rounded-sm ${fill}${ring}`}
            title={cell.isBGW ? `GW${cell.gw}: blank` : `GW${cell.gw}: ease ${(cell.ease * 100).toFixed(0)}%`}
            data-testid={`ease-cell-${chip}-${cell.gw}`}
          />
        )
      })}
    </div>
  )
}

function NoSquadPlaceholder() {
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900 flex items-center justify-center min-h-[120px]">
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
        Load your squad to see transfer and risk recommendations.
      </p>
    </div>
  )
}

// ---- Props ----

interface DecisionSummaryTabProps {
  teamId: string
  onTeamIdChange: (id: string) => void
  submittedId: string | null
  onSubmit: () => void
}

// ---- Risk label constants ----

const RISK_LABELS: ReadonlySet<LifecycleLabel> = new Set([
  'sell',
  'sell_soon',
  'minutes_trap',
  'fixture_trap',
] as LifecycleLabel[])

const URGENCY_ORDER: Record<LifecycleLabel, number> = {
  sell: 0,
  minutes_trap: 1,
  sell_soon: 2,
  fixture_trap: 3,
  buy_next_week: 99,
  hold_one_more: 99,
  hold: 99,
}

// ---- Component ----

export function DecisionSummaryTab({
  teamId,
  onTeamIdChange,
  submittedId,
  onSubmit,
}: DecisionSummaryTabProps) {
  // Hooks — order matches TransferPanel for query-cache reuse
  const { data: squadData, isLoading: squadLoading, error: squadError } = useSquad(submittedId)
  const { data: playersData, isLoading: playersLoading } = usePlayers()
  const { data: clubFormData } = useClubForm()
  const { isAuthenticated } = useAuthStatus()
  const { data: myTeamData } = useMyTeam(isAuthenticated && !!submittedId)

  const isValidTeamId = !!submittedId && /^\d+$/.test(submittedId)
  const { data: chipHistory } = useChipHistory(isValidTeamId ? submittedId : null)

  // Phase 103 CAL-02: pull calibration data for the health indicator below the 4-card grid.
  // useAccuracy is already in the query cache (AccuracyTab uses it); zero additional fetch.
  const { data: accuracyData } = useAccuracy()

  // Derivations
  const scoredPlayers = useMemo(() => computeAllGemScores(playersData ?? []), [playersData])

  const clubFormMap = useMemo<Map<number, ClubForm>>(() => {
    if (!clubFormData) return new Map()
    return new Map(clubFormData.map(cf => [cf.team_id, cf]))
  }, [clubFormData])

  const clubFormMapForChips = useMemo(() => buildClubFormMap(clubFormData ?? []), [clubFormData])

  // Captaincy — squad-aware preferred; pool fallback when !squadData
  const captaincyCandidates = useMemo<CaptaincyCandidate[]>(() => {
    if (scoredPlayers.length === 0) return []
    if (!squadData) {
      // No-squad fallback: derive top-3 from player pool (WDS-04 / CONTEXT.md D-16)
      return scoredPlayers
        .filter(p => (p.xPts_1gw ?? 0) > 0 && p.element_type !== 1)
        .sort((a, b) => (b.xPts_1gw ?? 0) - (a.xPts_1gw ?? 0))
        .slice(0, 3)
        .map<CaptaincyCandidate>(p => ({
          player: p,
          projected_captain_pts: (p.xPts_1gw ?? 0) * 2,
          captain_type: p.mins_risk === 'nailed' ? 'safe' : 'upside',
        }))
    }
    return computeCaptaincyCandidates(squadData.picks, scoredPlayers, 3)
  }, [squadData, scoredPlayers])

  const lifecycleLabels = useMemo(() => {
    if (!squadData || scoredPlayers.length === 0) return new Map<number, LifecycleLabel>()
    return computeLifecycleLabels(squadData.picks, scoredPlayers, clubFormMap)
  }, [squadData, scoredPlayers, clubFormMap])

  // derivedFtCount — verbatim from TransferPanel.tsx lines 87-92
  const derivedFtCount: 1 | 2 = useMemo(() => {
    if (!isAuthenticated || !myTeamData) return 1
    const chip = squadData?.active_chip
    if (chip === 'wildcard' || chip === 'freehit') return 1
    return myTeamData.entry_history.event_transfers === 0 ? 2 : 1
  }, [isAuthenticated, myTeamData, squadData])

  const exactSellPrices = useMemo<Map<number, number>>(() => {
    if (!myTeamData) return new Map()
    return new Map(myTeamData.picks.map(p => [p.element, p.selling_price]))
  }, [myTeamData])

  const ocsSuggestions: TransferSuggestion[] = useMemo(() => {
    if (!squadData || scoredPlayers.length === 0) return []
    return suggestTransfers({
      currentPicks: squadData.picks,
      players: scoredPlayers,
      horizon: 1, // PINNED per CONTEXT.md D-06
      ftCount: derivedFtCount,
      bank: squadData.entry_history.bank,
      sellPrices: exactSellPrices,
    })
  }, [squadData, scoredPlayers, derivedFtCount, exactSellPrices])

  const ocsRows: OCSRow[] = useMemo(
    () => computeOpportunityCostRows(ocsSuggestions, derivedFtCount, squadData?.entry_history.bank ?? 0),
    [ocsSuggestions, derivedFtCount, squadData],
  )

  // nextGw — squad-aware preferred, pool-aware fallback (PATTERNS.md §nextGw derivation)
  const nextGw =
    (squadData ? squadData.entry_history.event + 1 : null) ??
    scoredPlayers[0]?.fixtures[0]?.event_id ??
    0

  // DGW/BGW detection per CONTEXT.md D-18
  const isDGW = useMemo(() => {
    if (!nextGw || scoredPlayers.length === 0) return false
    return scoredPlayers.some(p => fixtureCountForGw(p, nextGw) >= 2)
  }, [scoredPlayers, nextGw])

  const isBGW = useMemo(() => {
    if (!nextGw || scoredPlayers.length === 0) return false
    const teamsWithFx = new Set(
      scoredPlayers.filter(p => fixtureCountForGw(p, nextGw) > 0).map(p => p.team),
    )
    return teamsWithFx.size <= 14 // 20 PL teams; <=14 means >=6 blank
  }, [scoredPlayers, nextGw])

  // Chip engine derivations — mirrors ChipStrategyPanel.tsx lines 230-253
  const benchPicks = useMemo(() => (squadData?.picks ?? []).filter(p => p.position >= 12), [squadData])
  const currentSquadIds = useMemo(
    () => (squadData ? squadData.picks.map(p => p.element) : undefined),
    [squadData],
  )
  const startingGw = scoredPlayers[0]?.fixtures[0]?.event_id ?? null

  const bbScores = useMemo(
    () => computeBBScore(benchPicks, scoredPlayers, clubFormMapForChips, startingGw ?? 0),
    [benchPicks, scoredPlayers, clubFormMapForChips, startingGw],
  )
  const tcScores = useMemo(
    () => computeTCScore(scoredPlayers, clubFormMapForChips, startingGw ?? 0),
    [scoredPlayers, clubFormMapForChips, startingGw],
  )
  const fhResult: FHResult = useMemo(
    () =>
      computeFHResult(
        scoredPlayers,
        clubFormMapForChips,
        squadData?.entry_history.bank ?? 0,
        exactSellPrices.size === 0 ? undefined : Object.fromEntries(exactSellPrices),
        currentSquadIds,
        startingGw ?? undefined,
      ),
    [scoredPlayers, clubFormMapForChips, squadData, exactSellPrices, currentSquadIds, startingGw],
  )

  const usedChips = useMemo(
    () => new Map((chipHistory ?? []).map((c: ChipHistoryEntry) => [c.name, c.event])),
    [chipHistory],
  )

  // Risk rows — starting XI only (D-14), urgency-sorted
  const riskRows = useMemo(() => {
    if (!squadData) return [] as Array<{ player: typeof scoredPlayers[number]; label: LifecycleLabel }>
    const playerById = new Map(scoredPlayers.map(p => [p.id, p]))
    return squadData.picks
      .filter(pick => pick.position < 12)
      .map(pick => ({ pick, label: lifecycleLabels.get(pick.element) ?? null }))
      .filter((r): r is { pick: typeof r.pick; label: LifecycleLabel } => r.label !== null && RISK_LABELS.has(r.label))
      .sort((a, b) => URGENCY_ORDER[a.label] - URGENCY_ORDER[b.label])
      .map(({ pick, label }) => ({ player: playerById.get(pick.element)!, label }))
      .filter(r => !!r.player)
  }, [squadData, lifecycleLabels, scoredPlayers])

  // Severity inputs
  const riskLabelArr = useMemo(() => riskRows.map(r => r.label), [riskRows])

  // Phase 67 NLP-02 — payload for squad-aware Refresh
  // Built from existing component state — no recomputation per CONTEXT.md D-05
  const proseRefreshPayload: ProseRefreshPayload | null = useMemo(() => {
    if (!submittedId) return null

    const captains = captaincyCandidates.slice(0, 3).map(c => ({
      name: c.player.web_name,
      team: c.player.team_short_name ?? String(c.player.team),
      xPts_1gw: c.player.xPts_1gw ?? null,
    }))

    // Top OCS suggestion row (first row with actual transfer data — row 0 is always Roll)
    const topRow = ocsRows.find(r => r.transfers && r.transfers.length > 0)
    const transfer = topRow?.transfers?.[0]
      ? {
          sell: topRow.transfers[0].sell.web_name,
          buy: topRow.transfers[0].buy.web_name,
          delta: topRow.xPtsGain,
        }
      : null

    // Chip: inline derivation (avoids hoisting bestGwForChip out of render body)
    const CHIP_CODES_LOCAL: Array<'bboost' | '3xc' | 'freehit'> = ['bboost', '3xc', 'freehit']
    const unusedLocal = CHIP_CODES_LOCAL.filter(code => !usedChips.has(code))
    let chipCode: 'bboost' | '3xc' | 'freehit' | 'wildcard' | null = null
    let chipBestGw: number | null = null
    for (const code of unusedLocal) {
      let best: number | null = null
      if (code === 'freehit') {
        best = fhResult.bestGw > 0 ? fhResult.bestGw : null
      } else if (code === 'bboost') {
        best = bbScores.find(s => s.isBest)?.gw ?? null
      } else if (code === '3xc') {
        best = tcScores.find(s => s.isBest)?.gw ?? null
      }
      if (best === nextGw) {
        chipCode = code
        chipBestGw = best
        break
      }
    }

    const risks = riskRows.map(r => ({
      name: r.player.web_name,
      label: r.label,
    }))

    return {
      gw: nextGw,
      captains,
      transfer,
      chip: { code: chipCode, bestGw: chipBestGw },
      risks,
    }
  }, [submittedId, captaincyCandidates, ocsRows, usedChips, bbScores, tcScores, fhResult, nextGw, riskRows])

  // hasAvailableChip: wildcard excluded (timing-driven chips only — see Plan 01 comment)
  const hasAvailableChip =
    !usedChips.has('bboost') || !usedChips.has('3xc') || !usedChips.has('freehit')

  const hasRecommendedChip = useMemo(() => {
    const bbBest = bbScores.find(s => s.isBest)?.gw
    const tcBest = tcScores.find(s => s.isBest)?.gw
    const fhBest = fhResult.bestGw > 0 ? fhResult.bestGw : null
    return [bbBest, tcBest, fhBest].some(g => g !== undefined && g !== null && g === nextGw)
  }, [bbScores, tcScores, fhResult, nextGw])

  const severity = useMemo(
    () =>
      computeDecisionSeverity({
        candidates: captaincyCandidates,
        riskLabels: riskLabelArr,
        isDGW,
        isBGW,
        hasAvailableChip,
        hasRecommendedChip,
      }),
    [captaincyCandidates, riskLabelArr, isDGW, isBGW, hasAvailableChip, hasRecommendedChip],
  )

  // ---- Loading / error guards ----
  if (playersLoading || (squadLoading && !!submittedId)) {
    return (
      <section
        aria-label="Weekly Decision Summary"
        className="space-y-4 p-4 max-w-4xl mx-auto"
        data-testid="decision-summary-tab"
      >
        <div
          className="rounded border border-zinc-200 dark:border-zinc-700 p-4 text-sm text-zinc-500 dark:text-zinc-400"
          aria-live="polite"
        >
          Loading decision data…
        </div>
      </section>
    )
  }
  if (squadError && submittedId) {
    return (
      <section
        aria-label="Weekly Decision Summary"
        className="space-y-4 p-4 max-w-4xl mx-auto"
        data-testid="decision-summary-tab"
      >
        <div
          className="rounded border border-red-300 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300"
          aria-live="polite"
        >
          {squadError instanceof Error ? squadError.message : String(squadError)}
        </div>
      </section>
    )
  }

  // ---- Chip rows — unused only ----
  const CHIP_CODES: Array<'bboost' | '3xc' | 'freehit'> = ['bboost', '3xc', 'freehit']
  const unusedChipCodes = CHIP_CODES.filter(code => !usedChips.has(code))

  function scoresForChip(code: 'bboost' | '3xc' | 'freehit'): GWEaseScore[] {
    if (code === 'bboost') return bbScores
    if (code === '3xc') return tcScores
    return fhResult.scores
  }

  function bestGwForChip(code: 'bboost' | '3xc' | 'freehit'): number | null {
    if (code === 'freehit') return fhResult.bestGw > 0 ? fhResult.bestGw : null
    return scoresForChip(code).find(s => s.isBest)?.gw ?? null
  }

  // ---- Render ----
  return (
    <section
      aria-label="Weekly Decision Summary"
      className="space-y-4 p-4 max-w-4xl mx-auto"
      data-testid="decision-summary-tab"
    >
      {/* Load Squad form — same form as TransferPanel so user can load squad from this tab */}
      <div className="rounded border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Load Your Squad</h2>
        <form
          onSubmit={e => {
            e.preventDefault()
            onSubmit()
          }}
          className="flex flex-col sm:flex-row gap-2 sm:items-end"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="dst-teamId" className="text-sm text-zinc-600 dark:text-zinc-400">
              FPL Team ID
            </label>
            <input
              id="dst-teamId"
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              value={teamId}
              onChange={e => onTeamIdChange(e.target.value)}
              placeholder="e.g. 1234567"
              className="border border-zinc-300 dark:border-zinc-600 rounded px-3 py-1.5 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-400 w-full sm:w-40"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors cursor-pointer active:scale-95 transition-transform w-full sm:w-auto"
          >
            Load Squad
          </button>
        </form>

          {isAuthenticated && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            FPL account connected — exact sell prices will be used.
          </p>
        )}
      </div>

      {/* Four-card grid: 1 col mobile, 2-col desktop (row-major priority order) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Card 1: Captain Pick */}
        <div
          className="rounded border border-zinc-200 dark:border-zinc-700 p-4 space-y-3 bg-white dark:bg-zinc-900"
          role="region"
          aria-label="Captain Pick"
          data-testid="captain-card"
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Captain Pick — GW {nextGw}
            </h2>
            <SeverityBadge level={severity.captain} />
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">1 GW</p>
          <div className="space-y-2">
            {captaincyCandidates.slice(0, 3).map((c, i) => (
              <div
                key={c.player.id}
                className="rounded border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
              >
                {/* Rank + player name */}
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-zinc-400 w-4 shrink-0">{i + 1}</span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 sm:flex-1">
                    {c.player.web_name}
                  </span>
                </div>
                {/* Team + fixture row */}
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="text-xs">{c.player.team_short_name}</span>
                  {c.player.fixtures.length > 0 &&
                    (() => {
                      const nextGwId = c.player.fixtures[0].event_id
                      const nextGwFixtures = c.player.fixtures.filter(f => f.event_id === nextGwId)
                      return (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                          {nextGwFixtures.length >= 2 && (
                            <span className="font-semibold text-violet-700 dark:text-violet-400 mr-1">
                              DGW
                            </span>
                          )}
                          {nextGwFixtures.map((f, j) => (
                            <span key={j}>
                              {j > 0 && <span className="mx-0.5 text-zinc-400">/</span>}
                              {f.is_home ? 'vs' : '@'} {f.opponent_team}
                            </span>
                          ))}
                        </span>
                      )
                    })()}
                </div>
                {/* Projected pts */}
                <span className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                  {(isNaN(c.projected_captain_pts) ? 0 : c.projected_captain_pts).toFixed(1)} pts (C)
                </span>
                {/* Badges */}
                <div className="flex items-center gap-1.5">
                  <CaptainTypeBadge type={c.captain_type} />
                  <MinsRiskBadge minsRisk={c.player.mins_risk} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Transfer Options or NoSquadPlaceholder */}
        {squadData ? (
          <div
            className="rounded border border-zinc-200 dark:border-zinc-700 p-4 space-y-3 bg-white dark:bg-zinc-900"
            role="region"
            aria-label="Transfer Options"
            data-testid="transfer-card"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Transfer Options — 1 GW
              </h2>
              <SeverityBadge level={severity.transfer} />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
              {isAuthenticated && myTeamData
                ? `Using ${derivedFtCount} free transfer${derivedFtCount > 1 ? 's' : ''} · detected from your team`
                : 'Using 1 free transfer (default)'}
            </p>
            <OpportunityCostTable rows={ocsRows} horizon={1} />
          </div>
        ) : (
          <NoSquadPlaceholder />
        )}

        {/* Card 3: Chip Timing */}
        <div
          className="rounded border border-zinc-200 dark:border-zinc-700 p-4 space-y-3 bg-white dark:bg-zinc-900"
          role="region"
          aria-label="Chip Timing"
          data-testid="chip-card"
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Chip Timing</h2>
            <SeverityBadge level={severity.chip} />
          </div>
          {isDGW && (
            <span
              className="inline-block text-xs font-semibold bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 rounded px-2 py-1 mb-2"
              data-testid="chip-dgw-badge"
              title="Double gameweek detected — consider chip play"
            >
              DGW upcoming
            </span>
          )}
          {isBGW && (
            <span
              className="inline-block text-xs font-semibold bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded px-2 py-1 mb-2"
              data-testid="chip-bgw-badge"
              title="Blank gameweek detected — consider chip play"
            >
              BGW upcoming
            </span>
          )}
          {unusedChipCodes.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">All chips have been played.</p>
          ) : (
            <ul className="space-y-1">
              {unusedChipCodes.map(code => {
                const best = bestGwForChip(code)
                const scores = scoresForChip(code)
                return (
                  <li
                    key={code}
                    className="flex items-center gap-2 text-sm min-h-[44px]"
                    data-testid={`chip-row-${code}`}
                  >
                    <span className="inline-block text-xs font-normal rounded px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 w-24">
                      {CHIP_LABELS[code]}
                    </span>
                    {best !== null ? (
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        Best: GW{best}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
                    )}
                    <EaseCellBar chip={code} scores={scores} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Card 4: Risk Flags or NoSquadPlaceholder */}
        {squadData ? (
          <div
            className="rounded border border-zinc-200 dark:border-zinc-700 p-4 space-y-3 bg-white dark:bg-zinc-900"
            role="region"
            aria-label="Risk Flags"
            data-testid="risk-card"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Risk Flags</h2>
              <SeverityBadge level={severity.risk} />
            </div>
            {riskRows.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No urgent risk signals for your squad this week.
              </p>
            ) : (
              riskRows.map(({ player, label }) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {player.web_name}
                  </span>
                  <LifecycleLabelBadge label={label} />
                </div>
              ))
            )}
          </div>
        ) : (
          <NoSquadPlaceholder />
        )}
      </div>

      {/* Phase 103 CAL-02: one-line calibration health summary. Renders nothing when
          accuracy data is loading, calibration is absent, or aggregate buckets are empty. */}
      {accuracyData && <CalibrationHealthIndicator data={accuracyData} />}

      {/* Phase 67 NLP-02 — LLM prose summary with squad-aware Refresh (Plan 03) */}
      <ProseSummaryBlock payload={proseRefreshPayload} />
    </section>
  )
}
