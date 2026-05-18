'use client'

// Phase 57 (EO-01..EO-04): ranked top-5 captain candidates with 4-mode toggle.
// Replaces the prior 2-card Ceiling+EO-Adjusted panel per CONTEXT.md D-01.
// Mode state is local (D-04 default; EO-04 mandates no global lift).
// Sort engine: src/lib/eo-candidates.ts — DO NOT inline sort logic here.
import { useState, useMemo } from 'react'
import { useCaptainPicks } from '@/lib/hooks/useCaptainPicks'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { computeEOCandidates, type EOMode } from '@/lib/eo-candidates'
import { computeMCLabels, type MCLabel } from '@/lib/mc-labels'
import type { MergedPlayer } from '@/lib/types'
import { computeFragility } from '@/lib/sensitivity'
import { FragilityBadge } from '@/components/shared/FragilityBadge'
import { NewsBanner } from '@/components/news/NewsBanner'
import { useLineupNews } from '@/lib/hooks/useLineupNews'
import { StatusLabelBadge } from '@/components/shared/StatusLabelBadge'

interface CaptainPicksPanelProps {
  submittedId?: string | null
}

const EO_MODES: { value: EOMode; label: string; testId: string }[] = [
  { value: 'max_xpts',                label: 'Max xPts',     testId: 'eo-toggle-max-xpts' },
  { value: 'protect_rank',            label: 'Protect Rank', testId: 'eo-toggle-protect-rank' },
  { value: 'chase_rank',              label: 'Chase Rank',   testId: 'eo-toggle-chase-rank' },
  { value: 'differential_aggressive', label: 'Differential', testId: 'eo-toggle-differential' },
]

const EO_TOOLTIP = 'Approximate effective ownership based on FPL selected_by_percent data.'
const DANGEROUS_TOOLTIP = 'Owned by over 30% of managers — fading this captain risks rank loss if they haul.'

function EOModeToggle({ value, onChange }: { value: EOMode; onChange: (v: EOMode) => void }) {
  return (
    <div className="flex items-center gap-2" data-testid="eo-mode-toggle">
      <div
        role="group"
        aria-label="Captain ranking mode"
        className="inline-flex flex-wrap rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700"
      >
        {EO_MODES.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={
              `min-h-[44px] px-3 text-xs font-semibold transition-colors ` +
              (value === opt.value
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700')
            }
            data-testid={opt.testId}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function DangerousToFadeBadge() {
  return (
    <span
      className="inline-block text-xs font-normal text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900 rounded px-2 py-1"
      title={DANGEROUS_TOOLTIP}
    >
      Dangerous to fade
    </span>
  )
}

// Phase 62 MC-04: McLabel badge — same amber token as DangerousToFadeBadge (D-17).
function McLabel({ label, value }: { label: string; value: string }) {
  return (
    <span
      data-testid="mc-label-badge"
      className="inline-block text-xs font-normal text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900 rounded px-2 py-1"
    >
      {label} — {value}
    </span>
  )
}

function CandidateRow({
  candidate,
  rank,
  mode,
  isAuthenticated,
  myTeamPickIds,
  mcLabel,
}: {
  candidate: MergedPlayer
  rank: number
  mode: EOMode
  isAuthenticated: boolean
  myTeamPickIds: Set<number>
  mcLabel?: MCLabel | null
}) {
  const { data: lineupNewsMap } = useLineupNews()
  const statusLabel = lineupNewsMap?.get(candidate.id)?.status_label

  const rawEo = parseFloat(candidate.selected_by_percent)
  const eoPercent = Number.isFinite(rawEo) ? Math.round(rawEo) : 0
  const showDangerBadge =
    mode === 'protect_rank' &&
    isAuthenticated &&
    myTeamPickIds.size > 0 &&
    (Number.isFinite(rawEo) ? rawEo : 0) > 30 &&
    !myTeamPickIds.has(candidate.id)

  const nextGwFixtures = (() => {
    if (candidate.fixtures.length === 0) return []
    const nextGwId = candidate.fixtures[0].event_id
    return candidate.fixtures.filter(f => f.event_id === nextGwId)
  })()

  return (
    <div
      data-testid="eo-candidate-row"
      className="rounded border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
    >
      <div className="flex items-center gap-1.5 sm:flex-1 flex-wrap">
        <span className="text-sm text-zinc-400 w-4 shrink-0">{rank}</span>
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{candidate.web_name}</span>
        <span
          className="text-sm text-zinc-500 dark:text-zinc-400"
          title={EO_TOOLTIP}
          data-testid="eo-percent"
        >
          ~{eoPercent}%
        </span>
        {showDangerBadge && <DangerousToFadeBadge />}
        {mcLabel && <McLabel label={mcLabel.label} value={mcLabel.value} />}
        {/* Phase 119 UI-01 (D-07): StatusLabelBadge after McLabel, before NewsBanner — structured signal first */}
        <StatusLabelBadge statusLabel={statusLabel} />
        {/* Phase 115 NEWS-02 (D-04): inline news banner for captain candidate */}
        <NewsBanner
          news={candidate.news ?? ''}
          news_added={candidate.news_added}
          chance_of_playing_next_round={candidate.chance_of_playing_next_round}
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="text-xs">{candidate.team_short_name}</span>
        {nextGwFixtures.length > 0 && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
            {nextGwFixtures.length >= 2 && (
              <span className="font-semibold text-violet-700 dark:text-violet-400 mr-1">DGW</span>
            )}
            {nextGwFixtures.map((f, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-0.5 text-zinc-400">/</span>}
                {f.is_home ? 'vs' : '@'} {f.opponent_team}
              </span>
            ))}
          </span>
        )}
      </div>
      <span className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
        {((candidate.xPts_1gw ?? 0) * 2).toFixed(1)} pts (C)
      </span>
      {candidate.p10_pts !== undefined && candidate.p90_pts !== undefined && (
        <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
          {' · '}{candidate.p10_pts.toFixed(1)}{'–'}{candidate.p90_pts.toFixed(1)}
        </span>
      )}
      {/* Fragility badge (Phase 93 SENS-01) — tristate; captain path skips cost perturbation (D-04) */}
      {(() => {
        const { tier, reasons } = computeFragility(candidate, false)
        return tier !== 'robust' ? <FragilityBadge tier={tier} reasons={reasons} /> : null
      })()}
    </div>
  )
}

export function CaptainPicksPanel({ submittedId }: CaptainPicksPanelProps = {}) {
  const [mode, setMode] = useState<EOMode>('max_xpts')
  const { data: playersData, isLoading, error } = usePlayers()
  const { data: captainData } = useCaptainPicks()
  const { isAuthenticated } = useAuthStatus()
  const { data: myTeamData } = useMyTeam(isAuthenticated && !!submittedId)

  const myTeamPickIds = useMemo(() => {
    if (!isAuthenticated || !myTeamData) return new Set<number>()
    return new Set(myTeamData.picks.map(p => p.element))
  }, [isAuthenticated, myTeamData])

  const eoCandidates = useMemo(() => {
    if (!playersData) return []
    return computeEOCandidates(playersData, mode, 5)
  }, [playersData, mode])

  // Phase 62 MC-04 — TC callout (CONTEXT.md D-18): single highest-haul_prob candidate.
  const tcCandidate = useMemo<MergedPlayer | null>(() => {
    if (!eoCandidates.some(c => c.haul_prob !== undefined)) return null
    return eoCandidates.reduce<MergedPlayer | null>(
      (best, c) => (c.haul_prob ?? -Infinity) > (best?.haul_prob ?? -Infinity) ? c : best,
      null,
    )
  }, [eoCandidates])

  // Phase 62 MC-04 — MC label cascade (CONTEXT.md D-16/D-17).
  const mcLabels = useMemo(() => computeMCLabels(eoCandidates), [eoCandidates])
  const mcLabelMap = useMemo(
    () => new Map(mcLabels.map(l => [l.playerId, l] as const)),
    [mcLabels],
  )

  if (isLoading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
        Loading captain picks…
      </p>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400 py-4">
        Failed to load captain picks. Check the pipeline output and refresh.
      </p>
    )
  }

  const gameweek = captainData?.gameweek ?? null

  return (
    <section className="mt-6 space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Captain Picks — GW {gameweek ?? '—'}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Re-rank candidates by mode. Differential filters to at or above median xPts only.
        </p>
      </div>
      <EOModeToggle value={mode} onChange={setMode} />
      {tcCandidate && (
        <div
          data-testid="tc-callout"
          className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2"
        >
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-semibold">TC:</span>{' '}
            {tcCandidate.web_name} — {Math.round((tcCandidate.haul_prob ?? 0) * 100)}% P(haul)
          </p>
        </div>
      )}
      {eoCandidates.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4">
          {mode === 'differential_aggressive'
            ? 'No differential captains pass the median xPts floor this GW.'
            : `No captain candidates available for GW ${gameweek ?? '—'}.`}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {eoCandidates.map((c, i) => (
            <CandidateRow
              key={c.id}
              candidate={c}
              rank={i + 1}
              mode={mode}
              isAuthenticated={isAuthenticated}
              myTeamPickIds={myTeamPickIds}
              mcLabel={mcLabelMap.get(c.id) ?? null}
            />
          ))}
        </div>
      )}
    </section>
  )
}
