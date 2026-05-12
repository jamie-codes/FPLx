'use client'

// Phase 96 BACK-01: captain regret backtester sub-tab.
// Sources of truth:
//   .planning/phases/96-captain-decision-backtester/96-CONTEXT.md (D-05..D-11, SC-5)
//   .planning/phases/96-captain-decision-backtester/096-UI-SPEC.md (Component Inventory + Copywriting Contract)
//   .planning/phases/96-captain-decision-backtester/096-PATTERNS.md (§BackTab.tsx)
import { useMemo } from 'react'
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
import { computeSeasonSummary } from '@/lib/regret'
import type { ChipRoiEntry, HitTrackingEntry, RegretEntry } from '@/lib/types'

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

export function BackTab({ teamId }: { teamId: string | null }) {
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
    </div>
  )
}
