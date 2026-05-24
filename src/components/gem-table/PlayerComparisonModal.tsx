'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import type { ScoredPlayer } from '@/lib/types'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { computeAllGemScores } from '@/lib/gem-score'
import { FixtureBadges } from '@/components/fixtures/FixtureBadges'
import { MinsRiskBadge } from '@/components/shared/MinsRiskBadge'
import { VarianceBadge } from '@/components/gem-table/VarianceBadge'
import { RegressionSignalBadge } from '@/components/gem-table/RegressionSignalBadge'
import { DifferentialBadge } from '@/components/gem-table/DifferentialBadge'
import { fmtScore, fmtScoreNull } from '@/components/gem-table/columns'
import { PlayerAvatar } from '@/components/shared/PlayerAvatar'
import { TeamBadge } from '@/components/shared/TeamBadge'

interface PlayerComparisonModalProps {
  open: boolean
  playerA: ScoredPlayer
  onClose: () => void
}

export function PlayerComparisonModal({ open, playerA, onClose }: PlayerComparisonModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [playerB, setPlayerB] = useState<ScoredPlayer | null>(null)

  // 1. Open/close with double-open guard (D-07; pitfall 4)
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) { if (!el.open) el.showModal() }
    else { if (el.open) el.close() }
  }, [open])

  // 2. Auto-focus search 50 ms after open
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => { searchRef.current?.focus() }, 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  // 3. Reset state when modal closes (search AND playerB)
  useEffect(() => {
    if (!open) { setSearch(''); setPlayerB(null) }
  }, [open])

  // 4. Sync onClose when native Escape fires
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const handleClose = () => onClose()
    el.addEventListener('close', handleClose)
    return () => el.removeEventListener('close', handleClose)
  }, [onClose])

  // 5. Backdrop click dismiss
  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose()
  }

  // Internal data fetch (D-A2 — TanStack Query dedup)
  const { data } = usePlayers()
  const scoredPlayers = useMemo(() => computeAllGemScores(data ?? []), [data])

  const filteredPlayers = useMemo(() =>
    scoredPlayers.filter(p =>
      p.id !== playerA.id &&
      (search.trim() === '' || p.web_name.toLowerCase().includes(search.toLowerCase()))
    ),
    [scoredPlayers, playerA.id, search]
  )

  // Helper renderers

  const renderPlaceholder = () => (
    <div className="flex items-center justify-center h-full min-h-[120px] rounded border border-dashed border-zinc-300 dark:border-zinc-600 text-sm text-zinc-400 dark:text-zinc-500">
      Search for a player to compare
    </div>
  )

  const renderXptsSection = (pA: ScoredPlayer, pB: ScoredPlayer | null) => (
    <div className="col-span-full flex flex-col gap-1 text-sm">
      {/* Player name headers */}
      <div className="grid grid-cols-3 gap-2 mb-1">
        <div />
        <div className="flex items-center gap-2 min-w-0">
          <PlayerAvatar code={pA.code} webName={pA.web_name} teamShortName={pA.team_short_name} width={40} height={50} className="rounded" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{pA.web_name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <TeamBadge shortName={pA.team_short_name} size={13} />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{pA.team_short_name}</span>
            </div>
          </div>
        </div>
        {pB ? (
          <div className="flex items-center gap-2 min-w-0">
            <PlayerAvatar code={pB.code} webName={pB.web_name} teamShortName={pB.team_short_name} width={40} height={50} className="rounded" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{pB.web_name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <TeamBadge shortName={pB.team_short_name} size={13} />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{pB.team_short_name}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[20px] text-xs text-zinc-400 dark:text-zinc-500 italic">—</div>
        )}
      </div>
      {/* Row: 1 GW */}
      <div className="grid grid-cols-3 gap-2">
        <span className="text-zinc-500 dark:text-zinc-400 text-xs">1 GW</span>
        <span>{pA.xPts_1gw?.toFixed(1) ?? '—'}<VarianceBadge ceiling={pA.xPts_ceiling_1gw} /></span>
        {pB ? <span>{pB.xPts_1gw?.toFixed(1) ?? '—'}<VarianceBadge ceiling={pB.xPts_ceiling_1gw} /></span> : <span className="text-zinc-400">—</span>}
      </div>
      {/* Row: 3 GW */}
      <div className="grid grid-cols-3 gap-2">
        <span className="text-zinc-500 dark:text-zinc-400 text-xs">3 GW</span>
        <span>{pA.xPts_3gw?.toFixed(1) ?? '—'}</span>
        {pB ? <span>{pB.xPts_3gw?.toFixed(1) ?? '—'}</span> : <span className="text-zinc-400">—</span>}
      </div>
      {/* Row: 5 GW */}
      <div className="grid grid-cols-3 gap-2">
        <span className="text-zinc-500 dark:text-zinc-400 text-xs">5 GW</span>
        <span>{pA.xPts_5gw?.toFixed(1) ?? '—'}</span>
        {pB ? <span>{pB.xPts_5gw?.toFixed(1) ?? '—'}</span> : <span className="text-zinc-400">—</span>}
      </div>
      {/* Row: Ceiling */}
      <div className="grid grid-cols-3 gap-2">
        <span className="text-zinc-500 dark:text-zinc-400 text-xs">Ceiling (90th)</span>
        <span>{pA.xPts_90th_1gw?.toFixed(1) ?? '—'}</span>
        {pB ? <span>{pB.xPts_90th_1gw?.toFixed(1) ?? '—'}</span> : <span className="text-zinc-400">—</span>}
      </div>
    </div>
  )

  const renderGemColumn = (p: ScoredPlayer) => (
    <div className="flex flex-col gap-1 text-sm">
      {([
        ['Gem',       fmtScore(p.gem_score)],
        ['FDR',       fmtScore(p.fdr_score)],
        ['Form',      fmtScore(p.form_score)],
        ['xG',        fmtScoreNull(p.xg_score)],
        ['xA',        fmtScoreNull(p.xa_score)],
        ['Ownership', fmtScore(p.ownership_score)],
        ['Minutes',   fmtScore(p.minutes_score)],
        ['Set Piece', fmtScore(p.set_piece_score)],
      ] as const).map(([label, value]) => (
        <div key={label} className="flex justify-between">
          <span className="text-zinc-500 dark:text-zinc-400 text-xs">{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  )

  const renderSignalsColumn = (p: ScoredPlayer) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-zinc-500 dark:text-zinc-400 text-xs w-20 shrink-0">Signal</span>
        <RegressionSignalBadge signal={p.regression_signal} delta={p.actual_vs_xg_delta} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-zinc-500 dark:text-zinc-400 text-xs w-20 shrink-0">Flag</span>
        <DifferentialBadge flag={p.differential_flag} ownership={parseFloat(p.selected_by_percent ?? '0')} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-zinc-500 dark:text-zinc-400 text-xs w-20 shrink-0">Minutes</span>
        <MinsRiskBadge minsRisk={p.mins_risk} />
      </div>
    </div>
  )

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      className="hidden open:flex flex-col rounded-lg bg-white dark:bg-zinc-900 p-4 max-w-2xl w-full max-h-[85vh] border border-zinc-200 dark:border-zinc-700 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Compare Players</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer active:scale-95 transition-transform"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Search */}
      <input
        ref={searchRef}
        type="text"
        placeholder="Search for a player…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 mb-3"
        style={{ fontSize: '16px' }}
      />

      {/* Search results — only when search is non-empty AND playerB unset */}
      {search.trim() !== '' && playerB === null && (
        <div className="overflow-y-auto max-h-40 divide-y divide-zinc-100 dark:divide-zinc-800 mb-3 border border-zinc-200 dark:border-zinc-700 rounded">
          {filteredPlayers.map(p => (
            <button
              type="button"
              key={p.id}
              onClick={() => { setPlayerB(p); setSearch('') }}
              className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{p.web_name}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">{p.team_short_name}</span>
              </div>
            </button>
          ))}
          {filteredPlayers.length === 0 && (
            <p className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400 text-center">No players found</p>
          )}
        </div>
      )}

      {/* Body — scrollable; four sections in a 2-col grid */}
      <div className="overflow-y-auto flex-1 min-h-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Section: xPts Projection */}
          <h3 className="col-span-full text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide border-b border-zinc-200 dark:border-zinc-700 pb-1 mb-2">xPts Projection</h3>
          {renderXptsSection(playerA, playerB)}

          {/* Section: Gem Scores */}
          <h3 className="col-span-full text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide border-b border-zinc-200 dark:border-zinc-700 pb-1 mb-2 mt-3">Gem Scores</h3>
          {renderGemColumn(playerA)}
          {playerB ? renderGemColumn(playerB) : renderPlaceholder()}

          {/* Section: Next Fixtures */}
          <h3 className="col-span-full text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide border-b border-zinc-200 dark:border-zinc-700 pb-1 mb-2 mt-3">Next Fixtures</h3>
          <div className="text-sm"><FixtureBadges fixtures={playerA.fixtures.slice(0, 5)} /></div>
          {playerB ? <div className="text-sm"><FixtureBadges fixtures={playerB.fixtures.slice(0, 5)} /></div> : renderPlaceholder()}

          {/* Section: Signals */}
          <h3 className="col-span-full text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide border-b border-zinc-200 dark:border-zinc-700 pb-1 mb-2 mt-3">Signals</h3>
          {renderSignalsColumn(playerA)}
          {playerB ? renderSignalsColumn(playerB) : renderPlaceholder()}
        </div>
      </div>
    </dialog>
  )
}
