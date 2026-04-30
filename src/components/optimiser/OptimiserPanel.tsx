'use client'

// Phase 44: OptimiserPanel — comparison table UI (Plan 01)
// Replaces the Phase 43 pitch rendering block with a position-grouped comparison table.
// HeadlineRow shows Formation / Changes / xPts gain. ComparisonTable renders desktop <table>
// and MobileComparisonCards renders mobile card stack. All non-pitch states from Phase 43 preserved.
import { useState, useMemo, Fragment } from 'react'
import { useSquad } from '@/lib/hooks/useSquad'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { GwToggle } from '@/components/gem-table/GwToggle'
import { optimiseLineup } from '@/lib/optimise-lineup'
import type { OptimiserHorizon, MergedPlayer } from '@/lib/types'

interface OptimiserPanelProps {
  // teamId is the SUBMITTED team id (page.tsx passes `submittedId ?? ''`). Empty string means
  // user has not yet submitted a team id — show empty state.
  teamId: string
}

// Position codes (mirrors src/lib/optimise-lineup.ts internals)
const GK = 1
const DEF = 2
const MID = 3
const FWD = 4

// Field name lookup for horizon-aware xPts display (matches HORIZON_FIELD in the engine)
const HORIZON_FIELD: Record<OptimiserHorizon, 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw'> = {
  1: 'xPts_1gw',
  3: 'xPts_3gw',
  5: 'xPts_5gw',
}

// Per-row data shape produced by pairSection()
type ComparisonRowData = {
  currentId: number
  optimisedId: number
  isChanged: boolean
  isBench: boolean
  isPromoted: boolean   // only meaningful when isChanged && isBench
  delta: number         // 0 when isBench OR !isChanged
}

// Pair current lineup slots with optimised slots within a position section.
// XI sections: sort both sides by xPts desc and pair index-for-index.
// Bench section: caller passes currentIds already sorted by SquadPick.position asc (12→15).
function pairSection(
  currentIds: number[],
  optimisedIds: number[],
  playerMap: Map<number, MergedPlayer>,
  horizonField: 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw',
  isBench: boolean,
  optimisedStarterIds: Set<number>,
): ComparisonRowData[] {
  const score = (id: number) => (playerMap.get(id)?.[horizonField] as number | undefined) ?? 0
  // XI sections sort by xPts desc on BOTH sides; bench preserves index order (caller sorts current bench by position).
  const sortedCurrent = isBench ? [...currentIds] : [...currentIds].sort((a, b) => score(b) - score(a))
  const sortedOptimised = isBench ? [...optimisedIds] : [...optimisedIds].sort((a, b) => score(b) - score(a))
  return sortedCurrent.map((currentId, i) => {
    // Guard: formation changes can produce different section lengths; treat missing slot as same player (no change).
    const optimisedId = sortedOptimised[i] ?? currentId
    const isChanged = currentId !== optimisedId
    const rawDelta = isChanged && !isBench ? score(optimisedId) - score(currentId) : 0
    const delta = Math.max(0, rawDelta)
    // isPromoted: the current bench player has been moved into the optimised XI (currentId in starters).
    // The bench slot is now occupied by someone else (a demoted XI player).
    const isPromoted = isBench && isChanged && optimisedStarterIds.has(currentId)
    return { currentId, optimisedId, isChanged, isBench, isPromoted, delta }
  })
}

// Headline row: Formation / Changes / xPts gain summary above the comparison table.
function HeadlineRow({
  formation,
  changeCount,
  xPtsGain,
}: {
  formation: string
  changeCount: number
  xPtsGain: number
}) {
  return (
    <div
      className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 py-2 flex-wrap"
      data-testid="headline-row"
    >
      <span><span className="font-semibold">Formation:</span> {formation}</span>
      <span className="text-zinc-400">│</span>
      <span><span className="font-semibold">Changes:</span> {changeCount} {changeCount === 1 ? 'player' : 'players'}</span>
      <span className="text-zinc-400">│</span>
      <span className="font-semibold text-green-600 dark:text-green-400">+{xPtsGain.toFixed(1)} xPts gain</span>
    </div>
  )
}

// Desktop comparison table: position-grouped <table> with section header rows and data rows.
function ComparisonTable({
  rows,
  playerMap,
  horizonField,
}: {
  rows: { section: 'GK' | 'DEF' | 'MID' | 'FWD' | 'Bench'; items: ComparisonRowData[] }[]
  playerMap: Map<number, MergedPlayer>
  horizonField: 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw'
}) {
  return (
    <table className="w-full text-sm border-collapse" data-testid="comparison-table">
      <thead>
        <tr className="text-xs text-zinc-500 dark:text-zinc-400">
          <th className="text-left py-1 pl-2 font-semibold w-[38%]">Current</th>
          <th className="text-right py-1 w-[10%]">xPts</th>
          <th className="text-center py-1 w-[4%]">→</th>
          <th className="text-left py-1 w-[38%]">Optimised</th>
          <th className="text-right py-1 pr-2 w-[10%]"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ section, items }) => (
          <Fragment key={section}>
            <tr>
              <td
                colSpan={5}
                className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400 pt-3 pb-1 pl-2 bg-zinc-50 dark:bg-zinc-800/40"
                data-testid={`section-header-${section.toLowerCase()}`}
              >
                {section}
              </td>
            </tr>
            {items.map((row, i) => {
              const cur = playerMap.get(row.currentId)
              const opt = playerMap.get(row.optimisedId)
              const curXPts = (cur?.[horizonField] as number | undefined) ?? 0
              const baseRowCls = 'border-b border-zinc-100 dark:border-zinc-800'
              const changedRowCls = row.isChanged
                ? `${baseRowCls} border-l-2 border-l-green-500${row.isBench ? ' opacity-80' : ''}`
                : baseRowCls
              return (
                <tr
                  key={`${section}-${i}`}
                  className={changedRowCls}
                  {...(row.isChanged ? { 'data-testid': 'comparison-row-changed' } : {})}
                >
                  <td className="py-1.5 pl-2 text-zinc-700 dark:text-zinc-300">{cur?.web_name ?? ''}</td>
                  <td className="text-right text-zinc-500 dark:text-zinc-400 text-xs">{curXPts.toFixed(1)}</td>
                  <td className="text-center text-zinc-400">→</td>
                  <td className={`py-1.5 ${row.isChanged && !row.isBench ? 'text-green-700 dark:text-green-400 font-semibold' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {opt?.web_name ?? ''}
                  </td>
                  <td className="text-right pr-2">
                    {!row.isChanged ? null : row.isBench ? (
                      row.isPromoted ? (
                        <span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950 rounded px-1 py-0.5" data-testid="badge-promoted">Promoted</span>
                      ) : (
                        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded px-1 py-0.5" data-testid="badge-dropped">Dropped</span>
                      )
                    ) : (
                      <span className="text-xs font-semibold text-green-400 bg-green-950 rounded px-1 py-0.5" data-testid="delta-pill">+{row.delta.toFixed(1)} xPts</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}

// Mobile card stack: vertically stacked cards for < sm viewports. Same data as ComparisonTable.
// Section headers use no data-testid (desktop table section headers already satisfy test assertions).
function MobileComparisonCards({
  rows,
  playerMap,
  horizonField,
}: {
  rows: { section: 'GK' | 'DEF' | 'MID' | 'FWD' | 'Bench'; items: ComparisonRowData[] }[]
  playerMap: Map<number, MergedPlayer>
  horizonField: 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw'
}) {
  return (
    <>
      {rows.map(({ section, items }) => (
        <Fragment key={section}>
          <div className="text-[10px] font-semibold uppercase text-zinc-500 dark:text-zinc-400 pt-3 pb-0.5 bg-zinc-50 dark:bg-zinc-800/40 px-1">
            {section}
          </div>
          {items.map((row, i) => {
            const cur = playerMap.get(row.currentId)
            const opt = playerMap.get(row.optimisedId)
            const curXPts = (cur?.[horizonField] as number | undefined) ?? 0
            const optXPts = (opt?.[horizonField] as number | undefined) ?? 0
            return (
              <div
                key={`${section}-mobile-${i}`}
                className={`py-2 border-b border-zinc-100 dark:border-zinc-800${row.isChanged ? ' border-l-2 border-l-green-500 pl-2' : ' opacity-60'}`}
                {...(row.isChanged ? { 'data-testid': 'comparison-row-changed' } : {})}
              >
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{cur?.web_name ?? ''}</div>
                <div className="text-[10px] text-zinc-400 mb-1">{curXPts.toFixed(1)} xPts</div>
                <div className="text-xs text-zinc-300 dark:text-zinc-500 mb-0.5">→</div>
                <div className={`text-xs ${row.isChanged && !row.isBench ? 'text-green-700 dark:text-green-400 font-semibold' : 'text-zinc-500 dark:text-zinc-400'}`}>{opt?.web_name ?? ''}</div>
                <div className="text-[10px] text-zinc-400">{optXPts.toFixed(1)} xPts</div>
                {row.isChanged && !row.isBench && (
                  <div className="text-[10px] mt-1">
                    <span className="text-xs font-semibold text-green-400 bg-green-950 rounded px-1 py-0.5" data-testid="delta-pill">+{row.delta.toFixed(1)} xPts</span>
                  </div>
                )}
                {row.isChanged && row.isBench && (
                  <div className="text-[10px] mt-1">
                    {row.isPromoted ? (
                      <span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950 rounded px-1 py-0.5" data-testid="badge-promoted">Promoted</span>
                    ) : (
                      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded px-1 py-0.5" data-testid="badge-dropped">Dropped</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </Fragment>
      ))}
    </>
  )
}

export function OptimiserPanel({ teamId }: OptimiserPanelProps) {
  const [horizon, setHorizon] = useState<OptimiserHorizon>(1)

  // teamId is the submitted id from page.tsx. Pass null to useSquad when empty so the query is disabled.
  const submittedId = teamId.trim() === '' ? null : teamId.trim()
  const { data: squadData, isLoading: squadLoading, error: squadError } = useSquad(submittedId)
  const { data: playersData, isLoading: playersLoading } = usePlayers()

  const isLoading = squadLoading || playersLoading
  const horizonField = HORIZON_FIELD[horizon]

  // Build playerMap and the optimised lineup (memoised so toggling horizon recomputes O(1,365)).
  const { playerMap, lineup, eligibleCount, totalPlayersInSquad } = useMemo(() => {
    if (!squadData || !playersData) {
      return { playerMap: new Map<number, MergedPlayer>(), lineup: null, eligibleCount: 0, totalPlayersInSquad: 0 }
    }
    const map = new Map<number, MergedPlayer>(playersData.map(p => [p.id, p]))
    // BGW-eligible count: same logic as the engine (Pitfall 1 — undefined != BGW; only === 0 excludes).
    const eligible = squadData.picks.filter(pick => {
      const p = map.get(pick.element)
      if (!p) return false
      return p.xPts_1gw !== 0
    }).length
    const result = optimiseLineup(squadData.picks, playersData, horizon)
    return { playerMap: map, lineup: result, eligibleCount: eligible, totalPlayersInSquad: squadData.picks.length }
  }, [squadData, playersData, horizon])

  // Empty state: no team id submitted
  if (submittedId === null) {
    return (
      <section className="mt-6 space-y-3" data-testid="optimiser-panel">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Optimised Lineup</h2>
        <div className="rounded border border-zinc-200 dark:border-zinc-700 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Enter your FPL Team ID to see your optimised lineup.
        </div>
      </section>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <section className="mt-6 space-y-3" data-testid="optimiser-panel">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Optimised Lineup</h2>
        <div className="rounded border border-zinc-200 dark:border-zinc-700 p-4 text-sm text-zinc-500 dark:text-zinc-400">
          Loading squad...
        </div>
      </section>
    )
  }

  // Error state (squad fetch failed)
  if (squadError) {
    const errorMessage = squadError instanceof Error && squadError.message
      ? squadError.message
      : 'Unable to load squad data. Please try again.'
    return (
      <section className="mt-6 space-y-3" data-testid="optimiser-panel">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Optimised Lineup</h2>
        <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
          {errorMessage}
        </div>
      </section>
    )
  }

  // No squad data despite loaded (shouldn't happen post-loading, but defensive)
  if (!squadData || !playersData) {
    return (
      <section className="mt-6 space-y-3" data-testid="optimiser-panel">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Optimised Lineup</h2>
        <div className="rounded border border-zinc-200 dark:border-zinc-700 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Load your squad using the Transfers tab, then return here to see your optimised lineup.
        </div>
      </section>
    )
  }

  // BGW critical state: too few eligible starters — engine returned null
  if (lineup === null) {
    return (
      <section className="mt-6 space-y-3" data-testid="optimiser-panel">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Optimised Lineup</h2>
        {eligibleCount < 11 ? (
          <div
            className="rounded border border-amber-400 bg-amber-50 dark:bg-amber-950 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
            data-testid="bgw-banner-critical"
          >
            <span className="font-semibold">Warning:</span>{' '}
            fewer than 11 eligible starters — only {eligibleCount} of your {totalPlayersInSquad} players have a fixture this gameweek. Optimised lineup may include bench players.
          </div>
        ) : (
          <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
            Unable to optimise lineup. Please try again.
          </div>
        )}
      </section>
    )
  }

  // Lineup is non-null: build comparison table data

  // Optimised XI groupings by element type
  const starterGks = lineup.starters.filter((id: number) => playerMap.get(id)?.element_type === GK)
  const starterDefs = lineup.starters.filter((id: number) => playerMap.get(id)?.element_type === DEF)
  const starterMids = lineup.starters.filter((id: number) => playerMap.get(id)?.element_type === MID)
  const starterFwds = lineup.starters.filter((id: number) => playerMap.get(id)?.element_type === FWD)

  // Current XI and bench from SquadPick.position (D-05)
  const currentXIIds = squadData.picks
    .filter(p => p.position <= 11)
    .map(p => p.element)
  const currentBenchSorted = [...squadData.picks]
    .filter(p => p.position >= 12)
    .sort((a, b) => a.position - b.position)  // 12,13,14,15
    .map(p => p.element)

  // Derive current XI players per position type
  const currentByType = (et: number) =>
    currentXIIds.filter(id => playerMap.get(id)?.element_type === et)

  const optimisedStarterSet = new Set<number>(lineup.starters)

  const sectionsRows: { section: 'GK' | 'DEF' | 'MID' | 'FWD' | 'Bench'; items: ComparisonRowData[] }[] = [
    { section: 'GK', items: pairSection(currentByType(GK), starterGks, playerMap, horizonField, false, optimisedStarterSet) },
    { section: 'DEF', items: pairSection(currentByType(DEF), starterDefs, playerMap, horizonField, false, optimisedStarterSet) },
    { section: 'MID', items: pairSection(currentByType(MID), starterMids, playerMap, horizonField, false, optimisedStarterSet) },
    { section: 'FWD', items: pairSection(currentByType(FWD), starterFwds, playerMap, horizonField, false, optimisedStarterSet) },
    { section: 'Bench', items: pairSection(currentBenchSorted, lineup.bench, playerMap, horizonField, true, optimisedStarterSet) },
  ]

  // D-07: changeCount and xPtsGain EXCLUDE bench.
  // Use set-difference to count actual player swaps (not pairSection row diffs which may overcount
  // due to xPts-desc sort reshuffling pairs within the same position group).
  const currentXISet = new Set<number>(currentXIIds)
  const changeCount = lineup.starters.filter(id => !currentXISet.has(id)).length
  // xPtsGain: sum of added starters' xPts minus removed starters' xPts (net real gain).
  const addedStarters = lineup.starters.filter(id => !currentXISet.has(id))
  const removedStarters = currentXIIds.filter(id => !optimisedStarterSet.has(id))
  const xPtsGain = Math.max(0,
    addedStarters.reduce((s, id) => s + ((playerMap.get(id)?.[horizonField] as number | undefined) ?? 0), 0) -
    removedStarters.reduce((s, id) => s + ((playerMap.get(id)?.[horizonField] as number | undefined) ?? 0), 0)
  )

  return (
    <section className="mt-6 space-y-3" data-testid="optimiser-panel">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Optimised Lineup</h2>

      {/* BGW soft warning: some BGW exclusions but still >= 11 eligible — engine returned a lineup but show a notice */}
      {eligibleCount < totalPlayersInSquad && eligibleCount >= 11 && (
        <div
          className="rounded border border-amber-400 bg-amber-50 dark:bg-amber-950 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
          data-testid="bgw-banner-soft"
        >
          <span className="font-semibold">Blank gameweek warning:</span>{' '}
          only {eligibleCount} of your {totalPlayersInSquad} players have a fixture this gameweek.
        </div>
      )}

      {/* Horizon selector row — right-aligned only (formation moved to headline row) */}
      <div className="flex items-center justify-end">
        <GwToggle value={horizon} onChange={setHorizon} />
      </div>

      {/* Headline row: Formation / Changes / xPts gain */}
      <HeadlineRow formation={lineup.formation} changeCount={changeCount} xPtsGain={xPtsGain} />

      {/* Desktop comparison table */}
      <div className="hidden sm:block">
        <ComparisonTable rows={sectionsRows} playerMap={playerMap} horizonField={horizonField} />
      </div>

      {/* Mobile card stack */}
      <div className="sm:hidden">
        <MobileComparisonCards rows={sectionsRows} playerMap={playerMap} horizonField={horizonField} />
      </div>
    </section>
  )
}
