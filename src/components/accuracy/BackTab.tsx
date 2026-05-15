'use client'

// Phase 96 BACK-01: captain regret backtester sub-tab.
// Phase 113 BACK-02: Captain | Transfer pill toggle + TransferRegretView.
// Sources of truth:
//   .planning/phases/96-captain-decision-backtester/96-CONTEXT.md (D-05..D-11, SC-5)
//   .planning/phases/96-captain-decision-backtester/096-UI-SPEC.md (Component Inventory + Copywriting Contract)
//   .planning/phases/96-captain-decision-backtester/096-PATTERNS.md (§BackTab.tsx)
//   .planning/phases/113-transfer-regret-backtester-v1-20/113-UI-SPEC.md (Component Inventory §1-6 + Copywriting Contract)
import { useMemo, useState } from 'react'
import type * as React from 'react'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { useDecisionHistory } from '@/lib/hooks/useDecisionHistory'
import { useSeasonAnalytics } from '@/lib/hooks/useSeasonAnalytics'
import { computeSeasonSummary, computeTransferSeasonSummary } from '@/lib/regret'
import type { ChipRoiEntry, HitTrackingEntry, RegretEntry, TransferRegretEntry } from '@/lib/types'

// Locked table-chrome classes — duplicated from AccuracyTab.tsx lines 101–104
// (PATTERNS.md §BackTab.tsx requires local copies, not re-exports).
const TH_CLS = 'text-left font-semibold text-zinc-600 dark:text-zinc-400 pb-1 border-b border-zinc-200 dark:border-zinc-700'
const TR_CLS = 'even:bg-zinc-50 dark:even:bg-zinc-800/50'
const TD_CLS = 'py-1 px-2'
const TABLE_CLS = 'w-full text-sm border-collapse'

// Bar fill colours — UI-SPEC §3 Regret Bar Chart.
const REGRET_RED = '#ef4444'
const REGRET_GREEN = '#22c55e'
const REGRET_GREY = 'rgba(161,161,170,0.5)'

// UI-SPEC chip-name display mapping — Wildcard excluded (D-04)
const CHIP_DISPLAY_NAME: Record<'bboost' | '3xc' | 'freehit', string> = {
  bboost: 'Bench Boost',
  '3xc': 'Triple Captain',
  freehit: 'Free Hit',
}

function regretFill(regret: number | null): string {
  if (regret === null) return REGRET_GREY
  if (regret > 0) return REGRET_RED
  if (regret < 0) return REGRET_GREEN
  return REGRET_GREY
}

// Phase 113 BACK-02: transfer regret bar fill — mirrors regretFill with delta semantics.
function transferRegretFill(delta: number | null): string {
  if (delta === null) return REGRET_GREY
  if (delta > 0) return REGRET_RED    // engine better → red
  if (delta < 0) return REGRET_GREEN  // user better → green
  return REGRET_GREY
}

function RegretTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || !payload.length) return null
  const p = payload[0].payload as RegretEntry
  const userPtsLabel =
    p.userCaptainPts !== null ? `${p.userCaptainPts * 2}pts` : '—'
  const modelPtsLabel =
    p.modelCeilingPts !== null ? `${p.modelCeilingPts * 2}pts` : '—'
  const regretLabel =
    p.regret === null
      ? '—'
      : p.regret > 0
        ? `+${p.regret}pts`
        : `${p.regret}pts`
  const regretCls =
    p.regret === null
      ? 'text-zinc-500 dark:text-zinc-400'
      : p.regret > 0
        ? 'text-red-600 dark:text-red-400'
        : p.regret < 0
          ? 'text-green-600 dark:text-green-400'
          : 'text-zinc-500 dark:text-zinc-400'
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">GW{p.gw}</p>
      <p className="text-zinc-700 dark:text-zinc-300">
        Your captain: {p.userCaptainName ?? 'Log in to see'} ({userPtsLabel})
      </p>
      <p className="text-zinc-700 dark:text-zinc-300">
        Model pick: {p.modelCeilingName ?? 'No snapshot'} ({modelPtsLabel})
      </p>
      <p className={regretCls}>Regret: {regretLabel}</p>
    </div>
  )
}

// Phase 113 BACK-02: TransferRegretTooltip — mirrors RegretTooltip for transfer entries.
function TransferRegretTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || !payload.length) return null
  const e = payload[0].payload as TransferRegretEntry
  const engineLabel = !e.hasSnapshot || !e.engineSell || !e.engineBuy
    ? 'No snapshot'
    : `Sell ${e.engineSell.join(' + ')} buy ${e.engineBuy.join(' + ')}`
  const userLabel = e.isHold
    ? 'Held'
    : (!e.userSell || !e.userBuy)
      ? '—'
      : `Sell ${e.userSell.join(' + ')} buy ${e.userBuy.join(' + ')}`
  const deltaLabel =
    e.delta === null ? '—'
    : e.delta > 0 ? `+${e.delta}pts`
    : `${e.delta}pts`
  const deltaCls =
    e.delta === null ? 'text-zinc-500 dark:text-zinc-400'
    : e.delta > 0 ? 'text-red-600 dark:text-red-400'
    : e.delta < 0 ? 'text-green-600 dark:text-green-400'
    : 'text-zinc-500 dark:text-zinc-400'
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">GW{e.gw}</p>
      <p className="text-zinc-700 dark:text-zinc-300">Engine: {engineLabel}</p>
      <p className="text-zinc-700 dark:text-zinc-300">You: {userLabel}</p>
      <p className={deltaCls}>Delta: {deltaLabel}</p>
    </div>
  )
}

function RegretCell({ regret }: { regret: number | null }) {
  if (regret === null) {
    return <td className={`${TD_CLS} text-right text-zinc-400 dark:text-zinc-500`}>—</td>
  }
  if (regret > 0) {
    return (
      <td className={`${TD_CLS} text-right text-red-600 dark:text-red-400`}>
        +{regret}pts (model better)
      </td>
    )
  }
  if (regret < 0) {
    return (
      <td className={`${TD_CLS} text-right text-green-600 dark:text-green-400`}>
        {/* The negative sign comes from the value itself */}
        {regret}pts (you beat it)
      </td>
    )
  }
  return (
    <td className={`${TD_CLS} text-right text-zinc-500 dark:text-zinc-400`}>0pts (tied)</td>
  )
}

function UserCaptainCell({ entry }: { entry: RegretEntry }) {
  if (entry.userCaptainName === null || entry.userCaptainPts === null) {
    return (
      <td className={`${TD_CLS} italic text-zinc-400 dark:text-zinc-500`}>Log in to see</td>
    )
  }
  return (
    <td className={TD_CLS}>
      {entry.userCaptainName} ({entry.userCaptainPts * 2}pts)
    </td>
  )
}

function ModelPickCell({ entry }: { entry: RegretEntry }) {
  if (!entry.hasSnapshot || entry.modelCeilingName === null || entry.modelCeilingPts === null) {
    return (
      <td className={`${TD_CLS} italic text-zinc-400 dark:text-zinc-500`}>No model snapshot</td>
    )
  }
  return (
    <td className={TD_CLS}>
      {entry.modelCeilingName} ({entry.modelCeilingPts * 2}pts)
    </td>
  )
}

function SeasonSummaryHeader({ entries }: { entries: RegretEntry[] }) {
  const summary = useMemo(() => computeSeasonSummary(entries), [entries])
  const totalCls =
    summary.totalRegret > 0
      ? 'text-red-600 dark:text-red-400'
      : summary.totalRegret < 0
        ? 'text-green-600 dark:text-green-400'
        : 'text-zinc-600 dark:text-zinc-400'
  const totalLabel =
    summary.totalRegret > 0
      ? `+${summary.totalRegret}pts`
      : summary.totalRegret < 0
        ? `${summary.totalRegret}pts`
        : `0pts`
  return (
    <div className="mb-4 space-y-1">
      <p className={`text-xl font-semibold ${totalCls}`}>
        Total captain regret: {totalLabel} across {summary.gwsWithData} GWs
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <span className="text-red-600 dark:text-red-400">Model better: {summary.modelBetter} GWs</span>
        {' | '}
        <span className="text-green-600 dark:text-green-400">You won: {summary.userWon} GWs</span>
        {' | '}
        <span className="text-zinc-500 dark:text-zinc-400">Tied: {summary.tied} GWs</span>
      </p>
      {summary.captainHitRate !== null && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Captain hit rate:{' '}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {summary.captainHits}/{summary.gwsWithData} GWs ({Math.round(summary.captainHitRate * 100)}%)
          </span>
        </p>
      )}
    </div>
  )
}

function formatSignedPts(value: number): string {
  if (value > 0) return `+${value}pts`
  return `${value}pts`  // includes 0 → "0pts" and negatives like "-4pts"
}

function deltaColorClass(delta: number): string {
  if (delta > 0) return 'text-green-600 dark:text-green-400'
  if (delta < 0) return 'text-red-600 dark:text-red-400'
  return 'text-zinc-500 dark:text-zinc-400'
}

function ChipRoiSection({ entries }: { entries: ChipRoiEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 py-2">
        No chips played yet this season.
      </p>
    )
  }
  return (
    <ul className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-1">
      {entries.map((c) => {
        const displayName = CHIP_DISPLAY_NAME[c.chipName]
        const avgInt = Math.round(c.seasonAvgPoints)
        return (
          <li
            key={`${c.chipName}-${c.event}`}
            className="flex items-baseline justify-between gap-4 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
          >
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              {displayName} GW{c.event}
            </span>
            <span className={`text-sm font-semibold ${deltaColorClass(c.delta)}`}>
              {c.gwPoints}pts vs {avgInt}pt avg → {formatSignedPts(Math.round(c.delta))}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function HitTrackingSection({ entries }: { entries: HitTrackingEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 py-2">
        No transfer hits taken this season.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className={TABLE_CLS}>
        <thead>
          <tr>
            <th className={`${TH_CLS} w-12`}>GW</th>
            <th className={TH_CLS}>Transfer</th>
            <th className={`${TH_CLS} text-right`}>Net pts</th>
            <th className={`${TH_CLS} text-center w-12`}>Result</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((h, i) => {
            const netColor =
              h.netPts === null
                ? 'text-zinc-400 dark:text-zinc-500'
                : h.netPts > 0
                  ? 'text-green-600 dark:text-green-400'
                  : h.netPts < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-zinc-500 dark:text-zinc-400'
            const resultText = h.brokeEven === null ? '—' : h.brokeEven ? '✓' : '✗'
            const resultColor =
              h.brokeEven === null
                ? 'text-zinc-400 dark:text-zinc-500'
                : h.brokeEven
                  ? 'text-green-600 dark:text-green-400 font-semibold'
                  : 'text-red-600 dark:text-red-400 font-semibold'
            const resultLabel =
              h.brokeEven === null
                ? 'broke-even data unavailable'
                : h.brokeEven
                  ? 'broke even'
                  : 'did not break even'
            return (
              <tr key={`${h.event}-${h.elementIn}-${h.elementOut}-${i}`} className={TR_CLS}>
                <td className={TD_CLS}>GW{h.event}</td>
                <td className={TD_CLS}>
                  {h.elementInName ?? 'Unknown'} ← {h.elementOutName ?? 'Unknown'}
                </td>
                <td className={`${TD_CLS} text-right ${netColor}`}>
                  {h.netPts === null ? '—' : formatSignedPts(h.netPts)}
                </td>
                <td className={`${TD_CLS} text-center ${resultColor}`} aria-label={resultLabel}>
                  {resultText}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RegretChart({ entries }: { entries: RegretEntry[] }) {
  return (
    <div
      aria-label="Captain regret per gameweek"
      className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-3 relative mb-4"
    >
      <ResponsiveContainer width="100%" height={288}>
        <BarChart data={entries}>
          <XAxis
            dataKey="gw"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => `GW${v}`}
            tick={{ fontSize: 12, fill: 'currentColor' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => (v >= 0 ? `+${v}` : `${v}`)}
            tick={{ fontSize: 12, fill: 'currentColor' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <ReferenceLine y={0} stroke="rgba(161,161,170,0.5)" strokeWidth={1} />
          <Tooltip content={RegretTooltip} />
          <Bar dataKey="regret" isAnimationActive={false}>
            {entries.map((e, i) => (
              <Cell key={`cell-${i}`} fill={regretFill(e.regret)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Phase 113 BACK-02: Transfer Season Summary Header (UI-SPEC §3)
function TransferSeasonSummaryHeader({ entries }: { entries: TransferRegretEntry[] }) {
  const summary = useMemo(() => computeTransferSeasonSummary(entries), [entries])
  const totalCls =
    summary.totalDelta > 0
      ? 'text-red-600 dark:text-red-400'
      : summary.totalDelta < 0
        ? 'text-green-600 dark:text-green-400'
        : 'text-zinc-600 dark:text-zinc-400'
  return (
    <div className="mb-4 space-y-1">
      <p className={`text-xl font-semibold ${totalCls}`}>
        Total transfer regret: {summary.totalDelta}pts across {summary.gwsWithData} GWs
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Engine better:{' '}
        <span className="text-red-600 dark:text-red-400">{summary.engineBetter}</span>
        {' | '}
        You better:{' '}
        <span className="text-green-600 dark:text-green-400">{summary.userBetter}</span>
        {' | '}
        Tied:{' '}
        <span className="text-zinc-500 dark:text-zinc-400">{summary.tied}</span>
      </p>
    </div>
  )
}

// Phase 113 BACK-02: Transfer Regret Bar Chart (UI-SPEC §4)
function TransferRegretChart({ entries }: { entries: TransferRegretEntry[] }) {
  return (
    <div
      aria-label="Transfer regret per gameweek"
      className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-3 relative mb-4"
    >
      <ResponsiveContainer width="100%" height={288}>
        <BarChart data={entries}>
          <XAxis
            dataKey="gw"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => `GW${v}`}
            tick={{ fontSize: 12, fill: 'currentColor' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => (v >= 0 ? `+${v}` : `${v}`)}
            tick={{ fontSize: 12, fill: 'currentColor' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <ReferenceLine y={0} stroke="rgba(161,161,170,0.5)" strokeWidth={1} />
          <Tooltip content={TransferRegretTooltip} />
          <Bar dataKey="delta" isAnimationActive={false}>
            {entries.map((e, i) => (
              <Cell key={`cell-${i}`} fill={transferRegretFill(e.delta)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Phase 113 BACK-02: format transfer player cell (Engine or You column).
// Handles 1-FT and 2-FT (compressed "Sell X buy Y + Sell A buy B" per D-07/UI-SPEC §5).
function formatTransferCell(
  sell: string[] | null,
  buy: string[] | null,
  sellPts: number[] | null,
  buyPts: number[] | null,
): string {
  if (!sell || !buy || !sellPts || !buyPts) return '—'
  // Build per-leg strings then join
  const legs = sell.map((s, i) => {
    const b = buy[i] ?? '?'
    const sp = sellPts[i] !== undefined ? `${sellPts[i]}pts` : '?pts'
    const bp = buyPts[i] !== undefined ? `${buyPts[i]}pts` : '?pts'
    return `Sell ${s} (${sp}) buy ${b} (${bp})`
  })
  return legs.join(' + ')
}

// Phase 113 BACK-02: TransferRegretView — full transfer view (UI-SPEC §2)
function TransferRegretView({ entries }: { entries: TransferRegretEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
        No transfer history yet — data accumulates each GW after this version is deployed.
      </p>
    )
  }

  // Sort by GW ascending (UI-SPEC §5: no sort controls, always ascending)
  const sorted = [...entries].sort((a, b) => a.gw - b.gw)

  return (
    <>
      <TransferSeasonSummaryHeader entries={entries} />
      <TransferRegretChart entries={sorted} />
      <div className="overflow-x-auto">
        <table className={TABLE_CLS}>
          <thead>
            <tr>
              <th className={`${TH_CLS} w-12`}>GW</th>
              <th className={TH_CLS}>Engine</th>
              <th className={TH_CLS}>You</th>
              <th className={`${TH_CLS} text-right`}>Delta</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => {
              // Engine cell
              let engineCell: React.ReactNode
              if (!e.hasSnapshot) {
                engineCell = (
                  <td className={`${TD_CLS} italic text-zinc-400 dark:text-zinc-500`}>
                    No model snapshot
                  </td>
                )
              } else {
                engineCell = (
                  <td className={TD_CLS}>
                    {formatTransferCell(e.engineSell, e.engineBuy, e.engineSellPts, e.engineBuyPts)}
                  </td>
                )
              }

              // You cell
              let youCell: React.ReactNode
              if (e.isHold) {
                youCell = <td className={TD_CLS}>Held — no transfer</td>
              } else {
                youCell = (
                  <td className={TD_CLS}>
                    {formatTransferCell(e.userSell, e.userBuy, e.userSellPts, e.userBuyPts)}
                  </td>
                )
              }

              // Delta cell (UI-SPEC §5 copywriting contract)
              let deltaCell: React.ReactNode
              if (e.delta === null) {
                deltaCell = (
                  <td className={`${TD_CLS} text-right text-zinc-400 dark:text-zinc-500`}>
                    {/* U+2014 EM DASH */}
                    —
                  </td>
                )
              } else if (e.delta > 0) {
                deltaCell = (
                  <td className={`${TD_CLS} text-right`}>
                    <span className="text-red-600 dark:text-red-400">
                      +{e.delta}pts (engine better)
                    </span>
                  </td>
                )
              } else if (e.delta < 0) {
                deltaCell = (
                  <td className={`${TD_CLS} text-right`}>
                    <span className="text-green-600 dark:text-green-400">
                      {/* U+2212 MINUS SIGN — UI-SPEC copy contract (NOT ASCII hyphen) */}
                      −{Math.abs(e.delta)}pts (good hold)
                    </span>
                  </td>
                )
              } else {
                deltaCell = (
                  <td className={`${TD_CLS} text-right text-zinc-500 dark:text-zinc-400`}>
                    0pts (tied)
                  </td>
                )
              }

              return (
                <tr key={e.gw} className={TR_CLS}>
                  <td className={TD_CLS}>GW{e.gw}</td>
                  {engineCell}
                  {youCell}
                  {deltaCell}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function BackTab({ teamId }: { teamId: string | null }) {
  // Phase 113 BACK-02: D-08 — pill toggle state MUST be before all early returns (Rules of Hooks).
  const [view, setView] = useState<'captain' | 'transfer'>('captain')

  const { data, isLoading, error } = useDecisionHistory(teamId)
  const {
    data: seasonData,
    isLoading: seasonLoading,
    error: seasonError,
  } = useSeasonAnalytics(teamId)

  if (isLoading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
        Loading captain history…
      </p>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400 py-4">
        Failed to load captain history. Check your connection and refresh.
      </p>
    )
  }

  if (!data || data.entries.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
        No captain history yet — data accumulates each GW after this version is deployed.
        Log in to see your actual captain picks.
      </p>
    )
  }

  const { entries } = data

  // HIST-02 + HIST-03 inline render path (single shared loading/error/auth-guard).
  let seasonSections: React.ReactNode = null
  if (teamId === null) {
    seasonSections = (
      <div className="rounded border border-zinc-200 dark:border-zinc-700 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Load your squad to see chip ROI and hit tracking.
      </div>
    )
  } else if (seasonLoading) {
    seasonSections = (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
        Loading season analytics…
      </p>
    )
  } else if (seasonError) {
    seasonSections = (
      <p className="text-sm text-red-600 dark:text-red-400 py-2">
        Failed to load season analytics. Check your connection and refresh.
      </p>
    )
  } else if (seasonData) {
    seasonSections = (
      <>
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Chip ROI
          </h2>
          <ChipRoiSection entries={seasonData.chipRoi} />
        </section>
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Hit Break-Even Tracking
          </h2>
          <HitTrackingSection entries={seasonData.hitTracking} />
        </section>
      </>
    )
  }

  return (
    <div>
      {/* Phase 113 BACK-02 D-08: pill toggle is first visual element (UI-SPEC §1) */}
      <div
        role="group"
        aria-label="Backtester view"
        className="flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600 mb-4"
      >
        {(['captain', 'transfer'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={`px-3 py-2 sm:py-1 text-sm font-medium transition-all cursor-pointer active:scale-95 min-h-[44px] ${
              view === v
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
            }`}
          >
            {v === 'captain' ? 'Captain' : 'Transfer'}
          </button>
        ))}
      </div>

      {view === 'captain' && (
        <>
          <SeasonSummaryHeader entries={entries} />
          <RegretChart entries={entries} />
          <div className="overflow-x-auto">
            <table className={TABLE_CLS}>
              <thead>
                <tr>
                  <th className={`${TH_CLS} w-12`}>GW</th>
                  <th className={TH_CLS}>Your captain</th>
                  <th className={TH_CLS}>Model pick</th>
                  <th className={`${TH_CLS} text-right`}>Regret</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.gw} className={TR_CLS}>
                    <td className={TD_CLS}>GW{e.gw}</td>
                    <UserCaptainCell entry={e} />
                    <ModelPickCell entry={e} />
                    <RegretCell regret={e.regret} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {seasonSections}
        </>
      )}

      {view === 'transfer' && (
        <TransferRegretView entries={data.transferEntries ?? []} />
      )}
    </div>
  )
}
