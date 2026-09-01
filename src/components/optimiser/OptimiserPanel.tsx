'use client'

// Phase 44: OptimiserPanel — comparison table UI (Plan 01)
// Replaces the Phase 43 pitch rendering block with a position-grouped comparison table.
// HeadlineRow shows Formation / Changes / xPts gain. ComparisonTable renders desktop <table>
// and MobileComparisonCards renders mobile card stack. All non-pitch states from Phase 43 preserved.
import { useState, useMemo, Fragment } from 'react'
import { useSquad } from '@/lib/hooks/useSquad'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { GwToggle } from '@/components/gem-table/GwToggle'
import { optimiseLineup, HORIZON_FIELD } from '@/lib/optimise-lineup'
import type { OptimiserHorizon, MergedPlayer, TransferSuggestion } from '@/lib/types'
import { suggestTransfers } from '@/lib/suggest-transfers'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { FtToggle } from './FtToggle'
import type { ChipMode, ChipSquadResult } from '@/lib/types'
import { buildOptimalSquad, computeBenchBoostXPts, CHIP_DEFAULT_BUDGET_TENTHS } from '@/lib/chip-modes'
import { ChipModeToggle } from './ChipModeToggle'
import { ChipSquadView } from './ChipSquadView'
import { capByPosition } from '@/lib/cap-transfer-suggestions'
import { countPlayersWithFixture } from '@/lib/blank-gameweek'
import { TableShell, Th, Td } from '@/components/ui/Table'

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
    const optimisedId = i < sortedOptimised.length ? sortedOptimised[i] : currentId
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
      className="flex items-center gap-2 text-sm text-ink py-2 flex-wrap"
      data-testid="headline-row"
    >
      <span><span className="font-semibold">Formation:</span> {formation}</span>
      <span className="text-ink-muted">│</span>
      <span><span className="font-semibold">Changes:</span> {changeCount} {changeCount === 1 ? 'player' : 'players'}</span>
      <span className="text-ink-muted">│</span>
      <span className="font-semibold text-positive">+{xPtsGain.toFixed(1)} xPts gain</span>
    </div>
  )
}

// Desktop comparison table: position-grouped <table> with section header rows and data rows.
function ComparisonTable({
  rows,
  playerMap,
  horizonField,
  isBenchBoost = false,
}: {
  rows: { section: 'GK' | 'DEF' | 'MID' | 'FWD' | 'Bench'; items: ComparisonRowData[] }[]
  playerMap: Map<number, MergedPlayer>
  horizonField: 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw'
  isBenchBoost?: boolean
}) {
  // UIX-04: plain table chrome unified onto TableShell/Th/Td primitives.
  return (
    <TableShell>
    <table className="w-full text-sm border-collapse" data-testid="comparison-table">
      <thead>
        <tr className="text-xs">
          <Th className="w-[38%]">Current</Th>
          <Th className="text-right w-[10%]">xPts</Th>
          <Th className="text-center w-[4%]">→</Th>
          <Th className="w-[38%]">Optimised</Th>
          <Th className="text-right w-[10%]"></Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ section, items }) => (
          <Fragment key={section}>
            <tr>
              <td
                colSpan={5}
                className="text-xs font-semibold uppercase text-ink-muted pt-3 pb-1 pl-2 bg-surface-2"
                data-testid={`section-header-${section.toLowerCase()}`}
              >
                {section}
              </td>
            </tr>
            {items.map((row, i) => {
              const cur = playerMap.get(row.currentId)
              const opt = playerMap.get(row.optimisedId)
              const curXPts = (cur?.[horizonField] as number | undefined) ?? 0
              const baseRowCls = 'border-b border-line'
              const changedRowCls = row.isChanged
                ? `${baseRowCls} border-l-2 border-l-positive${row.isBench && !isBenchBoost ? ' opacity-80' : ''}`
                : baseRowCls
              return (
                <tr
                  key={`${section}-${i}`}
                  className={changedRowCls}
                  {...(row.isChanged ? { 'data-testid': 'comparison-row-changed' } : {})}
                >
                  <Td className="text-ink">{cur?.web_name ?? ''}</Td>
                  <Td className="text-right text-ink-muted text-xs">{curXPts.toFixed(1)}</Td>
                  <Td className="text-center text-ink-muted">→</Td>
                  <Td className={row.isChanged && !row.isBench ? 'text-positive font-semibold' : 'text-ink'}>
                    {opt?.web_name ?? ''}
                  </Td>
                  <Td className="text-right">
                    {!row.isChanged ? null : row.isBench ? (
                      row.isPromoted ? (
                        <span className="text-xs font-semibold text-positive bg-positive-soft rounded px-1 py-0.5" data-testid="badge-promoted">Promoted</span>
                      ) : (
                        <span className="text-xs font-semibold text-ink-muted bg-surface-2 rounded px-1 py-0.5" data-testid="badge-dropped">Dropped</span>
                      )
                    ) : (
                      <span className="text-xs font-semibold text-positive bg-positive-soft rounded px-1 py-0.5" data-testid="delta-pill">+{row.delta.toFixed(1)} xPts</span>
                    )}
                  </Td>
                </tr>
              )
            })}
          </Fragment>
        ))}
      </tbody>
    </table>
    </TableShell>
  )
}

// Mobile card stack: vertically stacked cards for < sm viewports. Same data as ComparisonTable.
// Section headers use no data-testid (desktop table section headers already satisfy test assertions).
function MobileComparisonCards({
  rows,
  playerMap,
  horizonField,
  isBenchBoost = false,
}: {
  rows: { section: 'GK' | 'DEF' | 'MID' | 'FWD' | 'Bench'; items: ComparisonRowData[] }[]
  playerMap: Map<number, MergedPlayer>
  horizonField: 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw'
  isBenchBoost?: boolean
}) {
  return (
    <>
      {rows.map(({ section, items }) => (
        <Fragment key={section}>
          <div className="text-[10px] font-semibold uppercase text-ink-muted pt-3 pb-0.5 bg-surface-2 px-1">
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
                className={`py-2 border-b border-line${row.isChanged ? ' border-l-2 border-l-positive pl-2' : (row.isBench && !isBenchBoost ? ' opacity-60' : '')}`}
                {...(row.isChanged ? { 'data-testid': 'comparison-row-changed' } : {})}
              >
                <div className="text-xs text-ink-muted">{cur?.web_name ?? ''}</div>
                <div className="text-[10px] text-ink-muted mb-1">{curXPts.toFixed(1)} xPts</div>
                <div className="text-xs text-ink-muted mb-0.5">→</div>
                <div className={`text-xs ${row.isChanged && !row.isBench ? 'text-positive font-semibold' : 'text-ink-muted'}`}>{opt?.web_name ?? ''}</div>
                <div className="text-[10px] text-ink-muted">{optXPts.toFixed(1)} xPts</div>
                {row.isChanged && !row.isBench && (
                  <div className="text-[10px] mt-1">
                    <span className="text-xs font-semibold text-positive bg-positive-soft rounded px-1 py-0.5" data-testid="delta-pill">+{row.delta.toFixed(1)} xPts</span>
                  </div>
                )}
                {row.isChanged && row.isBench && (
                  <div className="text-[10px] mt-1">
                    {row.isPromoted ? (
                      <span className="text-xs font-semibold text-positive bg-positive-soft rounded px-1 py-0.5" data-testid="badge-promoted">Promoted</span>
                    ) : (
                      <span className="text-xs font-semibold text-ink-muted bg-surface-2 rounded px-1 py-0.5" data-testid="badge-dropped">Dropped</span>
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

// Position labels for transfer suggestion footnotes (TFR-02 D-07)
const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

export function OptimiserPanel({ teamId }: OptimiserPanelProps) {
  const [horizon, setHorizon] = useState<OptimiserHorizon>(1)
  const [ftCount, setFtCount] = useState<1 | 2>(1)  // D-02: default is 1 FT
  const [chipMode, setChipMode] = useState<ChipMode>('none')  // D-04: resets on page reload
  const [hasRun, setHasRun] = useState(false)  // OPT-01: gate lineup compute behind button click

  // teamId is the submitted id from page.tsx. Pass null to useSquad when empty so the query is disabled.
  const submittedId = teamId.trim() === '' ? null : teamId.trim()
  const { data: squadData, isLoading: squadLoading, error: squadError } = useSquad(submittedId)
  const { data: playersData, isLoading: playersLoading } = usePlayers()
  const { isAuthenticated } = useAuthStatus()
  const { data: myTeamData } = useMyTeam(isAuthenticated && submittedId !== null)

  const isLoading = squadLoading || playersLoading
  const horizonField = HORIZON_FIELD[horizon]

  // Build playerMap and the optimised lineup (memoised so toggling horizon recomputes O(1,365)).
  // OPT-01 (D-03): short-circuits to null when hasRun === false — no engine call until button clicked.
  const { playerMap, lineup, eligibleCount, totalPlayersInSquad } = useMemo(() => {
    if (!hasRun) {
      return { playerMap: new Map<number, MergedPlayer>(), lineup: null, eligibleCount: 0, totalPlayersInSquad: 0 }
    }
    if (!squadData || !playersData) {
      return { playerMap: new Map<number, MergedPlayer>(), lineup: null, eligibleCount: 0, totalPlayersInSquad: 0 }
    }
    const map = new Map<number, MergedPlayer>(playersData.map(p => [p.id, p]))
    // BGW-02 (2026-09-01): count players with an actual FIXTURE, not a non-zero
    // projection — see src/lib/blank-gameweek.ts.
    const eligible = countPlayersWithFixture(squadData.picks, map)
    const result = optimiseLineup(squadData.picks, playersData, horizon)
    return { playerMap: map, lineup: result, eligibleCount: eligible, totalPlayersInSquad: squadData.picks.length }
  }, [hasRun, squadData, playersData, horizon])

  // selling_price map from useMyTeam (authenticated path D-09). Empty Map when unauthenticated
  // → suggestTransfers falls back to now_cost (D-11). Mirrors TransferPanel.tsx pattern.
  const exactSellPrices = useMemo(() => {
    if (!myTeamData) return new Map<number, number>()
    return new Map<number, number>(myTeamData.picks.map(p => [p.element, p.selling_price]))
  }, [myTeamData])

  // Phase 45 (TFR-01..TFR-03) + Phase 112 (TFR-02): rank transfer suggestions for the current horizon + ftCount,
  // capped at 3 per element_type bucket (D-05, D-06). Returns empty arrays when not ready.
  const { transferSuggestions, transferTotalsByPosition } = useMemo<{
    transferSuggestions: TransferSuggestion[]
    transferTotalsByPosition: Map<number, number>
  }>(() => {
    if (!squadData || !playersData || !lineup) {
      return { transferSuggestions: [] as TransferSuggestion[], transferTotalsByPosition: new Map<number, number>() }
    }
    // FIX-02 (Phase 111 D-08): position lock is enforced inside suggestTransfers — engine guarantees sell.element_type === buy.element_type per leg. Do NOT pre-filter players by position; the engine builds top-30-per-position pools internally.
    const raw = suggestTransfers({
      currentPicks: squadData.picks,
      players: playersData,
      horizon,
      ftCount,
      bank: squadData.entry_history.bank,
      sellPrices: exactSellPrices,
    })
    const { suggestions, totalsByPosition } = capByPosition(raw, 3)
    return { transferSuggestions: suggestions, transferTotalsByPosition: totalsByPosition }
  }, [squadData, playersData, lineup, horizon, ftCount, exactSellPrices])

  // Phase 46 (CHIP-01, CHIP-02): chip squad for WC/FH modes. null when chip not active or < 15 eligible.
  const chipSquad: ChipSquadResult | null = useMemo(() => {
    if (chipMode !== 'wildcard' && chipMode !== 'free-hit') return null
    if (!playersData) return null
    // D-08 (Pitfall 2): Free Hit ALWAYS uses horizon: 1 regardless of user's selected horizon
    const effectiveHorizon = chipMode === 'free-hit' ? 1 : horizon
    // D-11: Auth budget = sell prices + bank; unauth = CHIP_DEFAULT_BUDGET_TENTHS (£100m)
    let budget = CHIP_DEFAULT_BUDGET_TENTHS
    if (squadData && myTeamData) {
      const sellPricesSum = squadData.picks.reduce((s, pick) => {
        return s + (exactSellPrices.get(pick.element) ?? (playerMap.get(pick.element)?.now_cost ?? 0))
      }, 0)
      budget = sellPricesSum + squadData.entry_history.bank
    }
    return buildOptimalSquad({ players: playersData, budget, horizon: effectiveHorizon })
  }, [chipMode, playersData, squadData, myTeamData, horizon, exactSellPrices, playerMap])

  // Empty state: no team id submitted
  if (submittedId === null) {
    return (
      <section className="mt-6 space-y-3" data-testid="optimiser-panel">
        <h2 className="text-base font-semibold text-ink">Optimised Lineup</h2>
        <div className="rounded border border-line p-6 text-center text-sm text-ink-muted">
          Enter your FPL Team ID to see your optimised lineup.
        </div>
      </section>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <section className="mt-6 space-y-3" data-testid="optimiser-panel">
        <h2 className="text-base font-semibold text-ink">Optimised Lineup</h2>
        <div className="rounded border border-line p-4 text-sm text-ink-muted">
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
        <h2 className="text-base font-semibold text-ink">Optimised Lineup</h2>
        <div className="rounded border border-negative/40 bg-negative-soft p-4 text-sm text-negative">
          {errorMessage}
        </div>
      </section>
    )
  }

  // No squad data despite loaded (shouldn't happen post-loading, but defensive)
  if (!squadData || !playersData) {
    return (
      <section className="mt-6 space-y-3" data-testid="optimiser-panel">
        <h2 className="text-base font-semibold text-ink">Optimised Lineup</h2>
        <div className="rounded border border-line p-6 text-center text-sm text-ink-muted">
          Load your squad using the Transfers tab, then return here to see your optimised lineup.
        </div>
      </section>
    )
  }

  // OPT-01: ready-state — squad is loaded but user hasn't clicked "Optimise Lineup" yet.
  // Controls remain visible above the placeholder per D-01.
  if (!hasRun) {
    return (
      <section className="mt-6 space-y-3" data-testid="optimiser-panel">
        <h2 className="text-base font-semibold text-ink">Optimised Lineup</h2>

        {/* Horizon selector row */}
        <div className="flex items-center justify-end">
          <GwToggle value={horizon} onChange={setHorizon} disabled={chipMode === 'free-hit'} />
        </div>

        {/* Chip mode toggle (D-01) — always visible */}
        <ChipModeToggle value={chipMode} onChange={setChipMode} />

        {/* Ready-state placeholder card (D-02) */}
        <div
          className="rounded border border-line p-6 text-center space-y-3"
          data-testid="optimiser-ready-state"
        >
          <p className="text-sm text-ink-muted">
            Configure settings above, then click to calculate the best lineup for your horizon.
          </p>
          <button
            type="button"
            className="bg-ink text-surface-1 text-sm font-medium rounded min-h-[44px] px-4 py-2 hover:opacity-90 cursor-pointer"
            data-testid="optimise-button"
            onClick={() => setHasRun(true)}
          >
            Optimise Lineup
          </button>
        </div>
      </section>
    )
  }

  // BGW critical state: too few eligible starters — engine returned null
  if (lineup === null) {
    return (
      <section className="mt-6 space-y-3" data-testid="optimiser-panel">
        <h2 className="text-base font-semibold text-ink">Optimised Lineup</h2>
        {eligibleCount < 11 ? (
          <div
            className="rounded border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning"
            data-testid="bgw-banner-critical"
          >
            <span className="font-semibold">Warning:</span>{' '}
            fewer than 11 eligible starters — only {eligibleCount} of your {totalPlayersInSquad} players have a fixture this gameweek. Optimised lineup may include bench players.
          </div>
        ) : (
          <div className="rounded border border-negative/40 bg-negative-soft p-4 text-sm text-negative">
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

  // WR-02: compute once so BB headline uses the same value for both Bench xPts and Total displays.
  const bbBenchXPts = chipMode === 'bench-boost'
    ? computeBenchBoostXPts(lineup.bench, playersData, horizon)
    : 0

  return (
    <section className="mt-6 space-y-3" data-testid="optimiser-panel">
      <h2 className="text-base font-semibold text-ink">Optimised Lineup</h2>

      {/* BGW soft warning: some BGW exclusions but still >= 11 eligible — engine returned a lineup but show a notice */}
      {eligibleCount < totalPlayersInSquad && eligibleCount >= 11 && (
        <div
          className="rounded border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning"
          data-testid="bgw-banner-soft"
        >
          <span className="font-semibold">Blank gameweek warning:</span>{' '}
          only {eligibleCount} of your {totalPlayersInSquad} players have a fixture this gameweek.
        </div>
      )}

      {/* Horizon selector row — disabled when FH active (D-08) */}
      <div className="flex items-center justify-end">
        <GwToggle value={horizon} onChange={setHorizon} disabled={chipMode === 'free-hit'} />
      </div>

      {/* Chip mode toggle (D-01) — always visible when squad loaded */}
      <ChipModeToggle value={chipMode} onChange={setChipMode} />

      {/* WC / FH: ChipSquadView replaces comparison table (D-03) */}
      {(chipMode === 'wildcard' || chipMode === 'free-hit') ? (
        chipSquad === null ? (
          <div
            className="rounded border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning"
            data-testid="chip-squad-null-banner"
          >
            <span className="font-semibold">Unable to build optimal squad:</span>{' '}
            fewer than 15 eligible players available in the player pool.
          </div>
        ) : (
          <ChipSquadView result={chipSquad} chipMode={chipMode as 'wildcard' | 'free-hit'} />
        )
      ) : (
        <>
          {/* None / BB: existing comparison table with optional BB modifications */}

          {/* BB headline (D-13) — replaces HeadlineRow when BB active */}
          {chipMode === 'bench-boost' ? (
            <div
              className="flex items-center gap-2 text-sm text-ink py-2 flex-wrap"
              data-testid="bb-headline-row"
            >
              <span className="font-semibold">Bench Boost</span>
              <span className="text-ink-muted">│</span>
              <span>
                <span className="font-semibold">Bench xPts:</span>{' '}
                {bbBenchXPts.toFixed(1)}
              </span>
              <span className="text-ink-muted">│</span>
              <span>
                <span className="font-semibold">Start xPts:</span>{' '}
                {lineup.starters.reduce((s, id) => s + ((playerMap.get(id)?.[horizonField] as number | undefined) ?? 0), 0).toFixed(1)}
              </span>
              <span className="text-ink-muted">│</span>
              <span className="font-semibold text-positive">
                Total: {(
                  bbBenchXPts +
                  lineup.starters.reduce((s, id) => s + ((playerMap.get(id)?.[horizonField] as number | undefined) ?? 0), 0)
                ).toFixed(1)}
              </span>
            </div>
          ) : (
            <HeadlineRow formation={lineup.formation} changeCount={changeCount} xPtsGain={xPtsGain} />
          )}

          {/* BB notice (D-15) */}
          {chipMode === 'bench-boost' && (
            <p
              className="text-xs text-ink-muted italic"
              data-testid="bb-notice"
            >
              All 15 players score points — bench contributions included above.
            </p>
          )}

          {/* BENCH-01 / D-11 (Phase 55): bench order is decorative under Bench Boost — inform the user. */}
          {chipMode === 'bench-boost' && (
            <p
              className="text-xs text-ink-muted italic"
              data-testid="bb-bench-order-note"
            >
              Bench order doesn&apos;t affect score with Bench Boost active
            </p>
          )}

          {/* Desktop comparison table — pass isBenchBoost for bench opacity (D-14, Pitfall 6) */}
          <div className="hidden sm:block">
            <ComparisonTable
              rows={sectionsRows}
              playerMap={playerMap}
              horizonField={horizonField}
              isBenchBoost={chipMode === 'bench-boost'}
            />
          </div>

          {/* Mobile card stack */}
          <div className="sm:hidden">
            <MobileComparisonCards
              rows={sectionsRows}
              playerMap={playerMap}
              horizonField={horizonField}
              isBenchBoost={chipMode === 'bench-boost'}
            />
          </div>
        </>
      )}

      {/* Transfer Suggestions: hidden when WC/FH active (chips rebuild entire squad) (D-02, D-03) */}
      {chipMode !== 'wildcard' && chipMode !== 'free-hit' && (
        <section
          className="pt-4 space-y-3 border-t border-line"
          data-testid="transfer-suggestions-section"
        >
          <h3 className="text-sm font-semibold text-ink">
            Transfer Suggestions
          </h3>
          {/* FT toggle: visible only when None or BB active (D-02, Pitfall 3) */}
          <FtToggle value={ftCount} onChange={setFtCount} />
          {transferSuggestions.length === 0 ? (
            <div
              className="rounded border border-line bg-surface-2 px-3 py-3 text-sm text-ink-muted text-center"
              data-testid="suggestions-empty-state"
            >
              Your current squad is already optimal for this horizon.
            </div>
          ) : (
            <div className="space-y-1">
              {/* TFR-02: Group by element_type and render per-position footnote when truncated (D-07) */}
              {(() => {
                // Build position groups preserving cross-bucket xPtsGain-desc order from capByPosition
                const grouped = new Map<number, TransferSuggestion[]>()
                for (const sug of transferSuggestions) {
                  const pos = sug.kind === 'single' ? sug.buy.element_type : sug.transfers[0].buy.element_type
                  const bucket = grouped.get(pos) ?? []
                  bucket.push(sug)
                  grouped.set(pos, bucket)
                }
                return Array.from(grouped.entries()).map(([pos, rows]) => (
                  <Fragment key={`group-${pos}`}>
                    {rows.map((sug, idx) => {
                      const isCombo = sug.kind === 'combo'
                      const isHit = sug.cost === 4
                      const variantAttr: 'free' | 'hit' | 'combo' = isCombo ? 'combo' : (isHit ? 'hit' : 'free')
                      const costPillClass = isHit
                        ? 'text-xs font-semibold text-warning bg-warning-soft border border-warning/40 rounded px-1 py-0.5'
                        : 'text-xs font-semibold text-positive bg-positive-soft rounded px-1 py-0.5'
                      const costPillTestId = isHit ? 'cost-pill-hit' : 'cost-pill-free'
                      const costPillCopy = isHit ? '-4pts' : 'FREE'

                      if (sug.kind === 'single') {
                        return (
                          <div
                            key={`sug-${pos}-${idx}`}
                            className="border-b border-line py-1.5"
                            data-testid="suggestion-row"
                            data-variant={variantAttr}
                          >
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                              <span className="text-ink-muted">Out:</span>
                              <span className="text-ink">{sug.sell.web_name}</span>
                              <span className="text-ink-muted">→</span>
                              <span className="text-ink-muted">In:</span>
                              <span className="text-positive">{sug.buy.web_name}</span>
                              <span className="text-ink-muted">│</span>
                              <span className={costPillClass} data-testid={costPillTestId}>{costPillCopy}</span>
                              <span className="text-ink-muted">│</span>
                              <span className="font-semibold text-positive">+{sug.xPtsGain.toFixed(1)} xPts</span>
                            </div>
                            {sug.breakEvenGws !== null && (
                              <div
                                className="text-xs text-ink-muted mt-0.5 ml-0 sm:ml-[3.25rem]"
                                data-testid="break-even"
                              >
                                Breaks even in {sug.breakEvenGws} {sug.breakEvenGws === 1 ? 'GW' : 'GWs'}
                              </div>
                            )}
                          </div>
                        )
                      }

                      // Combo (2-transfer) variant
                      return (
                        <div
                          key={`sug-${pos}-${idx}`}
                          className="border-b border-line py-2 px-2 bg-surface-2/50 rounded"
                          data-testid="suggestion-row"
                          data-variant="combo"
                        >
                          {sug.transfers.map((t, ti) => (
                            <div key={`t-${ti}`} className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm${ti > 0 ? ' mt-0.5' : ''}`}>
                              <span className="text-ink-muted">Out:</span>
                              <span className="text-ink">{t.sell.web_name}</span>
                              <span className="text-ink-muted">→</span>
                              <span className="text-ink-muted">In:</span>
                              <span className="text-positive">{t.buy.web_name}</span>
                            </div>
                          ))}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm mt-1 pt-1 border-t border-line">
                            <span className={costPillClass} data-testid={costPillTestId}>{costPillCopy}</span>
                            <span className="text-ink-muted">│</span>
                            <span className="font-semibold text-positive">+{sug.xPtsGain.toFixed(1)} xPts</span>
                          </div>
                          {sug.breakEvenGws !== null && (
                            <div
                              className="text-xs text-ink-muted mt-0.5"
                              data-testid="break-even"
                            >
                              Breaks even in {sug.breakEvenGws} {sug.breakEvenGws === 1 ? 'GW' : 'GWs'}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {/* TFR-02 D-07: truncation footnote when pre-cap bucket count > 3 */}
                    {(transferTotalsByPosition.get(pos) ?? 0) > 3 && (
                      <p
                        className="text-xs text-ink-muted mt-1"
                        data-testid={`cap-footnote-${POSITION_LABELS[pos]}`}
                      >
                        Showing top 3 of {transferTotalsByPosition.get(pos)} {POSITION_LABELS[pos]} suggestions.
                      </p>
                    )}
                  </Fragment>
                ))
              })()}
            </div>
          )}
        </section>
      )}
    </section>
  )
}
