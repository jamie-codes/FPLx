'use client'

import React, { useMemo, useState } from 'react'
import {
  buildClubFormMap,
  computeBBScore,
  computeTCScore,
  computeFHResult,
  type GWEaseScore,
  type FHResult,
  type FHSquadPlayer,
} from '@/lib/chip-strategy-engine'
import { useChipHistory, type ChipHistoryEntry } from '@/lib/hooks/useChipHistory'
import { CHIP_LABELS } from './plan-helpers'
import type { ScoredPlayer, ClubForm } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

type ChipCode = 'bboost' | '3xc' | 'freehit'

const POS_LABEL: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

function easeFill(ease: number, isBGW: boolean | undefined): string {
  if (isBGW) return 'bg-zinc-200 dark:bg-zinc-700'
  if (ease >= 0.75) return 'bg-green-500'
  if (ease >= 0.55) return 'bg-green-300 dark:bg-green-700'
  if (ease >= 0.40) return 'bg-amber-300 dark:bg-amber-600'
  if (ease >= 0.25) return 'bg-red-300 dark:bg-red-700'
  return 'bg-red-500'
}

interface ChipStrategyPanelProps {
  teamId: string | null
  scoredPlayers: ScoredPlayer[]
  clubForm: ClubForm[] | undefined
  picks: SquadPick[] | null
  bankBalance: number
  sellPrices?: Record<number, number>
  startingGw: number | null
}

interface EaseCellBarProps {
  chip: ChipCode
  scores: GWEaseScore[]
  ariaLabelPrefix: string
  forceMuted?: boolean // used-chip rows: render all cells as zinc, no ring
}

function EaseCellBar({ chip, scores, ariaLabelPrefix, forceMuted }: EaseCellBarProps) {
  const ariaLabel = `${ariaLabelPrefix}: ` + scores.map(s =>
    s.isBGW ? `GW${s.gw} blank` : `GW${s.gw} ease ${(s.ease * 100).toFixed(0)}%`
  ).join(', ')
  return (
    <div className="flex gap-1" role="img" aria-label={ariaLabel}>
      {scores.map(cell => {
        const fill = forceMuted ? 'bg-zinc-200 dark:bg-zinc-700' : easeFill(cell.ease, cell.isBGW)
        const ring = !forceMuted && cell.isBest ? ' ring-2 ring-offset-1 ring-green-700 dark:ring-green-300' : ''
        return (
          <div
            key={cell.gw}
            className={`w-6 h-3 rounded-sm ${fill}${ring}`}
            title={cell.isBGW ? `GW${cell.gw}: blank` : `GW${cell.gw}: ease ${(cell.ease * 100).toFixed(0)}%`}
            data-testid={`ease-cell-${chip}-${cell.gw}`}
            data-best={cell.isBest === true}
            data-bgw={cell.isBGW === true}
          />
        )
      })}
    </div>
  )
}

interface ChipRowProps {
  chip: ChipCode
  scores: GWEaseScore[]
  usedAtGw?: number
}

function ChipRow({ chip, scores, usedAtGw }: ChipRowProps) {
  const isUsed = usedAtGw !== undefined
  const bestGw = scores.find(s => s.isBest)?.gw
  const badgeClasses = isUsed
    ? 'inline-block text-xs font-normal rounded px-2 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 w-24'
    : 'inline-block text-xs font-normal rounded px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 w-24'
  return (
    <li
      className={`flex items-center gap-2 text-sm min-h-[44px]${isUsed ? ' opacity-40' : ''}`}
      data-testid={`chip-row-${chip}`}
      {...(isUsed ? { 'aria-disabled': true } : {})}
    >
      <span className={badgeClasses}>{CHIP_LABELS[chip]}</span>
      {isUsed ? (
        <span className="text-xs text-zinc-400 dark:text-zinc-500">Used GW{usedAtGw}</span>
      ) : bestGw !== undefined ? (
        <span className="text-sm text-zinc-700 dark:text-zinc-300">Best: GW{bestGw}</span>
      ) : (
        <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
      )}
      <EaseCellBar
        chip={chip}
        scores={scores}
        ariaLabelPrefix={`${CHIP_LABELS[chip]} ease across next 5 GWs`}
        forceMuted={isUsed}
      />
    </li>
  )
}

interface FHChipRowProps {
  scores: GWEaseScore[]
  bestGw: number | null
  suggestedSquad: FHSquadPlayer[]
  usedAtGw?: number
}

function FHChipRow({ scores, bestGw, suggestedSquad, usedAtGw }: FHChipRowProps) {
  const [fhExpanded, setFhExpanded] = useState(false)
  const isUsed = usedAtGw !== undefined

  if (isUsed) {
    const badgeClasses = 'inline-block text-xs font-normal rounded px-2 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 w-24'
    return (
      <li
        className="flex items-center gap-2 text-sm min-h-[44px] opacity-40"
        data-testid="chip-row-freehit"
        aria-disabled={true}
      >
        <span className={badgeClasses}>{CHIP_LABELS['freehit']}</span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">Used GW{usedAtGw}</span>
        <EaseCellBar
          chip="freehit"
          scores={scores}
          ariaLabelPrefix="Free Hit ease across next 5 GWs"
          forceMuted={true}
        />
      </li>
    )
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.key === ' ') e.preventDefault()
      setFhExpanded(prev => !prev)
    }
  }

  const badgeClasses = 'inline-block text-xs font-normal rounded px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 w-24'

  return (
    <React.Fragment>
      <li
        role="button"
        tabIndex={0}
        aria-expanded={fhExpanded}
        onClick={() => setFhExpanded(prev => !prev)}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-2 text-sm min-h-[44px] cursor-pointer"
        data-testid="chip-row-freehit"
      >
        <span className={badgeClasses}>{CHIP_LABELS['freehit']}</span>
        {bestGw !== null ? (
          <span className="text-sm text-zinc-700 dark:text-zinc-300">Best: GW{bestGw} — click for squad</span>
        ) : (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
        )}
        <EaseCellBar
          chip="freehit"
          scores={scores}
          ariaLabelPrefix="Free Hit ease across next 5 GWs"
          forceMuted={false}
        />
        <span
          aria-hidden="true"
          className="ml-auto text-zinc-400 dark:text-zinc-500 w-4 h-4"
          title={fhExpanded ? 'Hide suggested squad' : 'Show suggested Free Hit squad'}
        >
          {fhExpanded ? '▴' : '▾'}
        </span>
      </li>
      {fhExpanded && (
        <li className="pl-8 bg-zinc-50 dark:bg-zinc-800 rounded list-none mt-1 mb-2" data-testid="fh-expanded">
          <FHSquadTable squad={suggestedSquad} gw={bestGw ?? 0} />
        </li>
      )}
    </React.Fragment>
  )
}

function FHSquadTable({ squad, gw }: { squad: FHSquadPlayer[]; gw: number }) {
  if (squad.length === 0) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400 py-1">
        No squad suggestion available — run the pipeline first.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto" data-testid="fh-squad-table">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
            <th className="py-1 pr-3 text-left w-28">Player</th>
            <th className="py-1 pr-3 text-left w-8">Pos</th>
            <th className="py-1 pr-3 text-right w-10">xPts</th>
            <th className="py-1 pr-3 text-right w-12">Ease GW{gw}</th>
            <th className="py-1 pr-3 text-right w-10">£</th>
          </tr>
        </thead>
        <tbody>
          {squad.map(p => (
            <tr key={p.id} data-testid={`fh-squad-row-${p.id}`}>
              <td className="py-1 pr-3 font-semibold truncate max-w-[7rem]">{p.web_name}</td>
              <td className="py-1 pr-3">{POS_LABEL[p.element_type] ?? ''}</td>
              <td className="py-1 pr-3 text-right">{p.xPts_1gw.toFixed(1)}</td>
              <td className="py-1 pr-3 text-right">{(p.ease * 100).toFixed(0)}%</td>
              <td className="py-1 pr-3 text-right">{(p.now_cost / 10).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ChipStrategyPanel({
  teamId, scoredPlayers, clubForm, picks, bankBalance, sellPrices, startingGw,
}: ChipStrategyPanelProps) {
  const isValidTeamId = !!teamId && /^\d+$/.test(teamId)
  const { data: chipHistory, isLoading, error } = useChipHistory(isValidTeamId ? teamId : null)

  const clubFormMap = useMemo(() => buildClubFormMap(clubForm ?? []), [clubForm])
  const benchPicks = useMemo(() => (picks ?? []).filter(p => p.position >= 12), [picks])
  const currentSquadIds = useMemo(() => (picks ?? []).map(p => p.element), [picks])

  const bbScores = useMemo(
    () => computeBBScore(benchPicks, scoredPlayers, clubFormMap, startingGw ?? 0),
    [benchPicks, scoredPlayers, clubFormMap, startingGw],
  )
  const tcScores = useMemo(
    () => computeTCScore(scoredPlayers, clubFormMap, startingGw ?? 0),
    [scoredPlayers, clubFormMap, startingGw],
  )
  const fhResult: FHResult = useMemo(
    () => computeFHResult(scoredPlayers, clubFormMap, bankBalance, sellPrices, currentSquadIds, startingGw ?? undefined),
    [scoredPlayers, clubFormMap, bankBalance, sellPrices, currentSquadIds, startingGw],
  )

  const usedChips = useMemo(
    () => new Map((chipHistory ?? []).map((c: ChipHistoryEntry) => [c.name, c.event])),
    [chipHistory],
  )

  if (!isValidTeamId) {
    return (
      <section aria-label="Chip Strategy" className="mt-6 space-y-3" data-testid="chip-strategy-panel">
        <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4">
          Enter your FPL Team ID to see chip recommendations.
        </p>
      </section>
    )
  }
  if (isLoading) {
    return (
      <section aria-label="Chip Strategy" className="mt-6 space-y-3" data-testid="chip-strategy-panel">
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
          Loading chip strategy…
        </p>
      </section>
    )
  }
  if (error) {
    return (
      <section aria-label="Chip Strategy" className="mt-6 space-y-3" data-testid="chip-strategy-panel">
        <p className="text-sm text-red-600 dark:text-red-400 py-4">
          Failed to load chip strategy. Check squad data and refresh.
        </p>
      </section>
    )
  }

  return (
    <section aria-label="Chip Strategy" className="mt-6 space-y-3" data-testid="chip-strategy-panel">
      <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Chip Strategy</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Best upcoming gameweek to play each remaining chip.
          </p>
        </div>
        <ul className="space-y-1">
          <ChipRow chip="bboost" scores={bbScores} usedAtGw={usedChips.get('bboost')} />
          <ChipRow chip="3xc" scores={tcScores} usedAtGw={usedChips.get('3xc')} />
          <FHChipRow
            scores={fhResult.scores}
            bestGw={fhResult.bestGw || null}
            suggestedSquad={fhResult.suggestedSquad}
            usedAtGw={usedChips.get('freehit')}
          />
        </ul>
      </div>
    </section>
  )
}
