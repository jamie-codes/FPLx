'use client'
// Phase 58 ML-03..ML-07 (D-07, D-08, D-09, D-10, D-11): five-stack rival differential intelligence panel.
// Source: .planning/phases/058-mini-league-rival-tracker/058-UI-SPEC.md §Component Inventory + §Copywriting Contract
import type { MergedPlayer, PositionCode, RivalEntry, TransferSuggestion } from '@/lib/types'
import {
  computeShared,
  computeUserAdvantage,
  computeRivalThreats,
  computeBlockingMoves,
  computeCaptainEdge,
} from '@/lib/rival-intel'

interface RivalDetailPanelProps {
  rival: RivalEntry | null
  userPickIds: Set<number>
  playerById: Map<number, MergedPlayer>
  posMedians: Map<PositionCode, number>
  userCaptainCandidate: MergedPlayer | null
  transferSuggestions: TransferSuggestion[]
}

const SECTION_CLS = 'space-y-2'
const HEADING_CLS = 'text-base font-semibold text-zinc-900 dark:text-zinc-100'
const CHIP_LIST_CLS = 'flex flex-wrap gap-2'
const CHIP_BASE = 'rounded border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 flex flex-wrap items-center gap-x-2 gap-y-1'
const CHIP_NAME_CLS = 'text-sm font-medium text-zinc-900 dark:text-zinc-100'
const CHIP_XPTS_CLS = 'text-xs text-zinc-500 dark:text-zinc-400'
const EMPTY_CLS = 'text-sm text-zinc-500 dark:text-zinc-400'

function PlayerChip({ player }: { player: MergedPlayer }) {
  const x = player.xPts_1gw
  return (
    <span className={CHIP_BASE}>
      <span className={CHIP_NAME_CLS}>{player.web_name}</span>
      {x !== undefined && <span className={CHIP_XPTS_CLS}>{x.toFixed(1)} xPts</span>}
    </span>
  )
}

function CaptainEdge({
  rival, userCaptainCandidate, playerById,
}: { rival: RivalEntry; userCaptainCandidate: MergedPlayer | null; playerById: Map<number, MergedPlayer> }) {
  // Pre-deadline: rival.captainPlayerId is null → render em-dash with tooltip.
  if (rival.captainPlayerId === null) {
    return (
      <span
        className={EMPTY_CLS}
        title="Captain picks are only available after the GW deadline."
      >
        {'—'}
      </span>
    )
  }
  const rivalCaptain = playerById.get(rival.captainPlayerId) ?? null
  const edge = computeCaptainEdge(userCaptainCandidate, rivalCaptain)
  if (edge === null) {
    return (
      <span className={EMPTY_CLS} title="Captain edge unavailable — load your squad to compute.">
        {'—'}
      </span>
    )
  }
  const rounded = Number(edge.toFixed(1))
  const sign = rounded >= 0 ? '+' : '−'
  const abs = Math.abs(rounded).toFixed(1)
  const cls = rounded >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
  return (
    <span className={`text-sm font-medium ${cls}`}>
      Captain edge: {sign}{abs} xPts vs {rival.playerName}
    </span>
  )
}

export function RivalDetailPanel({
  rival, userPickIds, playerById, posMedians, userCaptainCandidate, transferSuggestions,
}: RivalDetailPanelProps) {
  if (rival === null) {
    return (
      <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
        <p className={EMPTY_CLS}>Select a rival from the table to see differential analysis.</p>
      </div>
    )
  }

  const rivalIds = new Set(rival.picks.map(p => p.element))
  const sharedIds = computeShared(userPickIds, rivalIds)
  const advantageIds = computeUserAdvantage(userPickIds, rivalIds)
  const threats = computeRivalThreats(rivalIds, userPickIds, playerById, posMedians)
  const blocking = computeBlockingMoves(transferSuggestions, rivalIds, posMedians)

  const sharedPlayers = sharedIds.map(id => playerById.get(id)).filter((p): p is MergedPlayer => !!p)
  const advantagePlayers = advantageIds.map(id => playerById.get(id)).filter((p): p is MergedPlayer => !!p)

  // For blocking suggestions, surface the qualifying buy player(s) (singles → 1 chip; combos → 1-2 chips per suggestion).
  // We dedupe by buy.id across all suggestions so the same player only renders once.
  const blockingBuyIds = new Set<number>()
  const blockingPlayers: MergedPlayer[] = []
  for (const s of blocking) {
    const buys = s.kind === 'single' ? [s.buy] : [s.transfers[0].buy, s.transfers[1].buy]
    for (const buy of buys) {
      if (rivalIds.has(buy.id)) continue
      const x = buy.xPts_1gw
      if (x === undefined) continue
      const median = posMedians.get(buy.element_type) ?? 0
      if (x <= median) continue
      if (blockingBuyIds.has(buy.id)) continue
      blockingBuyIds.add(buy.id)
      blockingPlayers.push(buy)
    }
  }

  return (
    <div className="space-y-6 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
      <section className={SECTION_CLS}>
        <h3 className={HEADING_CLS}>Captain Edge</h3>
        <CaptainEdge rival={rival} userCaptainCandidate={userCaptainCandidate} playerById={playerById} />
      </section>

      <section className={SECTION_CLS}>
        <h3 className={HEADING_CLS}>Shared with {rival.playerName}</h3>
        {sharedPlayers.length === 0 ? (
          <span className={EMPTY_CLS}>{'—'}</span>
        ) : (
          <div className={CHIP_LIST_CLS}>
            {sharedPlayers.map(p => <PlayerChip key={p.id} player={p} />)}
          </div>
        )}
      </section>

      <section className={SECTION_CLS}>
        <h3 className={HEADING_CLS}>Your Advantage</h3>
        {advantagePlayers.length === 0 ? (
          <span className={EMPTY_CLS}>{'—'}</span>
        ) : (
          <div className={CHIP_LIST_CLS}>
            {advantagePlayers.map(p => <PlayerChip key={p.id} player={p} />)}
          </div>
        )}
      </section>

      <section className={SECTION_CLS}>
        <h3 className={HEADING_CLS}>Rival Threats</h3>
        {threats.length === 0 ? (
          <span className={EMPTY_CLS}>{rival.playerName} has no high-xPts threats this GW.</span>
        ) : (
          <div className={CHIP_LIST_CLS}>
            {threats.map(p => <PlayerChip key={p.id} player={p} />)}
          </div>
        )}
      </section>

      <section className={SECTION_CLS}>
        <h3 className={HEADING_CLS}>Blocking Transfers</h3>
        {blockingPlayers.length === 0 ? (
          <span className={EMPTY_CLS}>No blocking transfer opportunities identified.</span>
        ) : (
          <div className={CHIP_LIST_CLS}>
            {blockingPlayers.map(p => <PlayerChip key={p.id} player={p} />)}
          </div>
        )}
      </section>
    </div>
  )
}
