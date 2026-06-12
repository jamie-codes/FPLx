'use client'

import { useMemo, useState } from 'react'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useSquad } from '@/lib/hooks/useSquad'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { buildAnchoredSquad } from '@/lib/anchored-squad'
import { PlayerSearchInput } from '@/components/shared/PlayerSearchInput'
import { CHIP_DEFAULT_BUDGET_TENTHS } from '@/lib/chip-modes'
import type { PlannerHorizon, OptimiserHorizon, ScoredPlayer, MergedPlayer } from '@/lib/types'
import { RiskChip } from '@/components/shared/RiskChip'
import type { AnchoredSquadResult } from '@/lib/anchored-squad'

interface WildcardBuilderTabProps {
  submittedId: string | null
  horizon: PlannerHorizon
}

// Map PlannerHorizon (1|2|3|4|5) to OptimiserHorizon (1|3|5).
function toOptimiserHorizon(h: PlannerHorizon): OptimiserHorizon {
  if (h <= 1) return 1
  if (h <= 3) return 3
  return 5
}

function formatPounds(tenths: number): string {
  return `£${(tenths / 10).toFixed(1)}m`
}

// ---------------------------------------------------------------------------
// StructurePanel
// ---------------------------------------------------------------------------

interface StructurePanelProps {
  label: string
  selected: MergedPlayer[]
  onAdd: (p: ScoredPlayer) => void
  onRemove: (id: number) => void
  result: AnchoredSquadResult | null
  allPlayers: MergedPlayer[]
  searchKey: number
}

const POS_LABEL: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

function StructurePanel({
  label, selected, onAdd, onRemove, result, allPlayers, searchKey,
}: StructurePanelProps) {
  const selectedIds = new Set(selected.map(p => p.id))
  // Filter out already-selected players from the search pool.
  const searchPool = allPlayers.filter(p => !selectedIds.has(p.id))

  const positionGroups = result
    ? ([1, 2, 3, 4] as const).map(pos => ({
        label: POS_LABEL[pos],
        players: result.squad.filter(p => p.element_type === pos),
      }))
    : []

  return (
    <div className="rounded border border-line p-4 space-y-3">
      <h2 className="text-base font-semibold text-ink">
        {label}
        {result && (
          <span className="ml-2 text-xs font-normal text-ink-muted">
            {result.formation}
          </span>
        )}
      </h2>

      {/* Anchor badges */}
      <div className="space-y-1.5">
        {selected.map(p => (
          <div
            key={p.id}
            className="flex items-center gap-2 rounded bg-accent-soft border border-accent/40 px-2 py-1"
          >
            <span className="text-xs font-medium text-accent flex-1 truncate">
              📌 {p.web_name}
            </span>
            <button
              type="button"
              aria-label={`Remove ${p.web_name}`}
              onClick={() => onRemove(p.id)}
              className="text-accent/60 hover:text-accent text-sm leading-none"
            >
              ✕
            </button>
          </div>
        ))}
        {selected.length < 3 && (
          <PlayerSearchInput
            key={searchKey}
            players={searchPool as unknown as ScoredPlayer[]}
            onSelect={p => { if (p) onAdd(p) }}
            placeholder="+ Add anchor player…"
          />
        )}
      </div>

      {/* Conflict callouts */}
      {result?.anchorConflicts.map(c => (
        <p
          key={c.playerId}
          className="text-xs text-warning bg-warning-soft border border-warning/40 rounded px-2 py-1"
        >
          Player {c.playerId} skipped — {c.reason.replace(/_/g, ' ')}
        </p>
      ))}

      {/* Null result */}
      {result === null && (
        <p className="text-sm text-warning">
          Could not build a valid squad — try removing an anchor or checking budget.
        </p>
      )}

      {/* Squad display */}
      {result && (
        <div className="space-y-2 pt-1">
          {positionGroups.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-0.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.players.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`text-xs truncate ${selectedIds.has(p.id) ? 'font-semibold text-accent' : 'text-ink'}`}>
                        {p.web_name}
                        {selectedIds.has(p.id) && <span className="ml-1 text-[9px]">📌</span>}
                      </span>
                      <RiskChip
                        difficultyRotationRisk={p.difficulty_rotation_risk}
                        availabilityRisk={p.availability_risk}
                      />
                    </div>
                    <span className="text-xs text-ink-muted shrink-0">
                      {p.xPts.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {/* UIX-04 ruling 3: budget validity → positive/negative tokens */}
          <p className={`text-xs pt-1 ${result.budgetRemaining < 0 ? 'text-negative' : 'text-positive'}`}>
            {formatPounds(result.budgetRemaining)} remaining
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ComparisonTable
// ---------------------------------------------------------------------------

function ComparisonTable({
  resultA,
  resultB,
}: {
  resultA: AnchoredSquadResult
  resultB: AnchoredSquadResult
}) {
  type Row = { label: string; a: string; b: string; aWins: boolean | null }
  const numericRows: Row[] = [
    {
      label: 'xPts next GW',
      a: resultA.xPts1gw.toFixed(1),
      b: resultB.xPts1gw.toFixed(1),
      aWins:
        resultA.xPts1gw === resultB.xPts1gw
          ? null
          : resultA.xPts1gw > resultB.xPts1gw,
    },
    {
      label: 'xPts next 3 GWs',
      a: resultA.xPts3gw.toFixed(1),
      b: resultB.xPts3gw.toFixed(1),
      aWins:
        resultA.xPts3gw === resultB.xPts3gw
          ? null
          : resultA.xPts3gw > resultB.xPts3gw,
    },
    {
      label: 'xPts next 5 GWs',
      a: resultA.xPts5gw.toFixed(1),
      b: resultB.xPts5gw.toFixed(1),
      aWins:
        resultA.xPts5gw === resultB.xPts5gw
          ? null
          : resultA.xPts5gw > resultB.xPts5gw,
    },
    {
      label: 'Budget remaining',
      a: formatPounds(resultA.budgetRemaining),
      b: formatPounds(resultB.budgetRemaining),
      aWins:
        resultA.budgetRemaining === resultB.budgetRemaining
          ? null
          : resultA.budgetRemaining > resultB.budgetRemaining,
    },
  ]

  const TH = 'text-left text-xs font-semibold text-ink-muted pb-1 border-b border-line'
  const TD = 'py-1 px-2 text-sm'
  // UIX-04 ruling 3: winning-cell highlight → positive-soft token
  const WIN = 'bg-positive-soft'

  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold text-ink mb-3">
        Comparison
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className={TH}>Metric</th>
              <th className={`${TH} text-right`}>Structure A</th>
              <th className={`${TH} text-right`}>Structure B</th>
            </tr>
          </thead>
          <tbody>
            {numericRows.map(row => (
              <tr key={row.label}>
                <td className={`${TD} text-ink`}>{row.label}</td>
                <td className={`${TD} text-right ${row.aWins === true ? WIN : ''}`}>
                  {row.a}
                </td>
                <td className={`${TD} text-right ${row.aWins === false ? WIN : ''}`}>
                  {row.b}
                </td>
              </tr>
            ))}
            <tr>
              <td className={`${TD} text-ink`}>Captain options</td>
              <td className={`${TD} text-right text-ink-muted`}>
                {resultA.captainCandidates.map(c => c.web_name).join(', ')}
              </td>
              <td className={`${TD} text-right text-ink-muted`}>
                {resultB.captainCandidates.map(c => c.web_name).join(', ')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// WildcardBuilderTab
// ---------------------------------------------------------------------------

export function WildcardBuilderTab({ submittedId, horizon }: WildcardBuilderTabProps) {
  const [selectedA, setSelectedA] = useState<ScoredPlayer[]>([])
  const [selectedB, setSelectedB] = useState<ScoredPlayer[]>([])
  // searchKey forces PlayerSearchInput to remount (reset its query) after each anchor add.
  const [searchKeyA, setSearchKeyA] = useState(0)
  const [searchKeyB, setSearchKeyB] = useState(0)

  const { isAuthenticated } = useAuthStatus()
  const { data: playersData, isLoading: playersLoading, error: playersError } = usePlayers()
  const { data: squadData } = useSquad(submittedId)
  const { data: myTeamData } = useMyTeam(isAuthenticated && !!submittedId)

  const playerMap = useMemo(
    () => new Map((playersData ?? []).map(p => [p.id, p])),
    [playersData],
  )

  const exactSellPrices = useMemo(() => {
    if (!myTeamData) return new Map<number, number>()
    return new Map<number, number>(
      myTeamData.picks.map((p: { element: number; selling_price: number }) => [
        p.element,
        p.selling_price,
      ]),
    )
  }, [myTeamData])

  const budget = useMemo(() => {
    // D-11: Auth budget = sell prices + bank; unauth = CHIP_DEFAULT_BUDGET_TENTHS (£100m)
    let b = CHIP_DEFAULT_BUDGET_TENTHS
    if (squadData && myTeamData) {
      const sellSum = squadData.picks.reduce(
        (s: number, pick: { element: number }) =>
          s + (exactSellPrices.get(pick.element) ?? (playerMap.get(pick.element)?.now_cost ?? 0)),
        0,
      )
      b = sellSum + squadData.entry_history.bank
    }
    return b
  }, [squadData, myTeamData, exactSellPrices, playerMap])

  const effectiveHorizon = toOptimiserHorizon(horizon)

  const resultA = useMemo(
    () =>
      playersData
        ? buildAnchoredSquad(selectedA.map(p => p.id), playersData, budget, effectiveHorizon)
        : null,
    [selectedA, playersData, budget, effectiveHorizon],
  )

  const resultB = useMemo(
    () =>
      playersData
        ? buildAnchoredSquad(selectedB.map(p => p.id), playersData, budget, effectiveHorizon)
        : null,
    [selectedB, playersData, budget, effectiveHorizon],
  )

  if (playersLoading) {
    return (
      <p className="text-sm text-ink-muted text-center py-8">
        Loading player data…
      </p>
    )
  }
  if (playersError) {
    return (
      <p className="text-sm text-negative py-4">
        Failed to load player data. Check your connection and refresh.
      </p>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <StructurePanel
          label="Structure A"
          selected={selectedA}
          onAdd={p => {
            setSelectedA(prev => prev.length < 3 ? [...prev, p] : prev)
            setSearchKeyA(k => k + 1)
          }}
          onRemove={id => setSelectedA(prev => prev.filter(p => p.id !== id))}
          result={resultA}
          allPlayers={playersData ?? []}
          searchKey={searchKeyA}
        />
        <StructurePanel
          label="Structure B"
          selected={selectedB}
          onAdd={p => {
            setSelectedB(prev => prev.length < 3 ? [...prev, p] : prev)
            setSearchKeyB(k => k + 1)
          }}
          onRemove={id => setSelectedB(prev => prev.filter(p => p.id !== id))}
          result={resultB}
          allPlayers={playersData ?? []}
          searchKey={searchKeyB}
        />
      </div>
      {resultA !== null && resultB !== null && (
        <ComparisonTable resultA={resultA} resultB={resultB} />
      )}
    </div>
  )
}
