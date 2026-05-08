'use client'

// Phase 50 (OCS-01..OCS-05): OpportunityCostTable — renders pre-computed OCSRow[]
// as a <table> with one row per option (Roll / 1 FT / 1 FT (Hit) / 2 FT).
// Pure presentation: no hooks, no fetch. Driven by TransferPanel ocsRows + ocsHorizon.
// Visual contract locked by .planning/phases/050-transfer-opportunity-cost-simulator/050-UI-SPEC.md.

import type { OCSRow, OCSRowKind } from '@/lib/opportunity-cost'
import type { OptimiserHorizon } from '@/lib/types'
import { RotationRiskBadge } from '@/components/shared/RotationRiskBadge'

interface OpportunityCostTableProps {
  rows: OCSRow[]
  horizon: OptimiserHorizon
}

interface BadgeConfig {
  bg: string
  text: string
  label: string
  title: string
}

const BADGE_BY_KIND: Record<OCSRowKind, BadgeConfig> = {
  roll: {
    bg: 'bg-zinc-100 dark:bg-zinc-700',
    text: 'text-zinc-700 dark:text-zinc-300',
    label: 'Baseline',
    title: 'Roll your free transfer — no points spent and no transfer made.',
  },
  'single-free': {
    bg: 'bg-green-100 dark:bg-green-900',
    text: 'text-green-700 dark:text-green-300',
    label: 'Free',
    title: 'Uses a free transfer — no points cost.',
  },
  'single-hit': {
    bg: 'bg-red-100 dark:bg-red-900',
    text: 'text-red-700 dark:text-red-300',
    label: 'Hit',
    title: 'This transfer costs a -4pt hit deducted from your score.',
  },
  'combo-free': {
    bg: 'bg-green-100 dark:bg-green-900',
    text: 'text-green-700 dark:text-green-300',
    label: 'Free',
    title: 'Uses both free transfers — no points cost.',
  },
  'combo-hit': {
    bg: 'bg-red-100 dark:bg-red-900',
    text: 'text-red-700 dark:text-red-300',
    label: 'Hit',
    title: 'This combination costs a -4pt hit deducted from your score.',
  },
  'combo-hit-8': {
    bg: 'bg-red-100 dark:bg-red-900',
    text: 'text-red-700 dark:text-red-300',
    label: 'Hit',
    title: 'This combination costs a −8pt hit (two simultaneous hits) deducted from your score.',
  },
}

const MARGINAL_BADGE: BadgeConfig = {
  bg: 'bg-amber-100 dark:bg-amber-900',
  text: 'text-amber-800 dark:text-amber-200',
  label: 'Marginal — verify',
  title: '2-FT gain is within 1.0 xPts of break-even — confirm before actioning.',
}

function badgeFor(row: OCSRow): BadgeConfig {
  if ((row.kind === 'combo-free' || row.kind === 'combo-hit') && row.isMarginal === true)
    return MARGINAL_BADGE
  return BADGE_BY_KIND[row.kind]
}

function formatXPts(row: OCSRow): string {
  if (row.kind === 'roll') return '0.0'
  const sign = row.xPtsGainNet >= 0 ? '+' : ''
  return `${sign}${row.xPtsGainNet.toFixed(1)} xPts`
}

function formatBreakEven(row: OCSRow): string {
  if (row.breakEvenGws === null || row.breakEvenGws === undefined) return '—'
  return `${row.breakEvenGws} GWs`
}

function PlayerMoveCell({ row }: { row: OCSRow }) {
  if (row.kind === 'roll' || !row.transfers || row.transfers.length === 0) {
    return <span className="text-zinc-400 dark:text-zinc-500">—</span>
  }
  return (
    <div className="space-y-0.5">
      {row.transfers.map((t, i) => (
        <div key={i} className="flex flex-wrap items-center gap-x-2 text-sm text-zinc-900 dark:text-zinc-100">
          <span className="text-zinc-500 dark:text-zinc-400 text-xs">Sell</span>
          <span className="font-medium">{t.sell.web_name}</span>
          <span className="text-zinc-500 dark:text-zinc-400">→</span>
          <span className="text-zinc-500 dark:text-zinc-400 text-xs">Buy</span>
          <span className="font-medium">{t.buy.web_name}</span>
          <RotationRiskBadge rotationRisk={t.buy.rotation_risk ?? false} />
        </div>
      ))}
    </div>
  )
}

export function OpportunityCostTable({ rows, horizon }: OpportunityCostTableProps) {
  const onlyRoll = rows.length === 1 && rows[0]?.kind === 'roll'

  return (
    <div className="space-y-2" data-testid="opportunity-cost-table">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
            <th className="text-left py-2 pl-2 font-semibold w-[20%]">Option</th>
            <th className="text-left py-2 font-semibold w-[35%]">Player Move</th>
            <th className="text-right py-2 font-semibold w-[20%]">xPts Gain ({horizon} GW{horizon === 1 ? '' : 's'})</th>
            <th className="text-right py-2 font-semibold w-[15%] hidden sm:table-cell">Break-even</th>
            <th className="text-right py-2 pr-2 font-semibold w-[10%]">Label</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const badge = badgeFor(row)
            const isDisabled = !row.isAffordable
            return (
              <tr
                key={`${row.kind}-${i}`}
                aria-disabled={isDisabled || undefined}
                className={`border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50${isDisabled ? ' opacity-50' : ''}`}
                data-testid={`ocs-row-${row.kind}`}
              >
                <td className="py-2 pl-2 align-top text-zinc-900 dark:text-zinc-100 font-medium">
                  {row.label}
                </td>
                <td className="py-2 align-top">
                  <PlayerMoveCell row={row} />
                </td>
                <td className="py-2 text-right align-top text-zinc-900 dark:text-zinc-100">
                  <div className={isDisabled ? 'line-through text-zinc-400 dark:text-zinc-600' : ''}>
                    {formatXPts(row)}
                  </div>
                  {row.cost > 0 && (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">−{row.cost}pt hit</div>
                  )}
                  {row.kind !== 'roll' && (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      Bank: {row.bankAfter >= 0
                        ? `£${(row.bankAfter / 10).toFixed(1)}m`
                        : `−£${(Math.abs(row.bankAfter) / 10).toFixed(1)}m`}
                    </div>
                  )}
                </td>
                <td className="py-2 text-right align-top text-zinc-700 dark:text-zinc-300 hidden sm:table-cell">
                  {formatBreakEven(row)}
                </td>
                <td className="py-2 pr-2 text-right align-top">
                  <span
                    className={`inline-block text-xs font-medium ${badge.text} ${badge.bg} rounded px-2 py-1`}
                    title={badge.title}
                  >
                    {badge.label}
                  </span>
                  {row.disabledReason && (
                    <div className="text-xs text-red-600 dark:text-red-400 mt-1">{row.disabledReason}</div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {onlyRoll && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-1">
          No transfer improvements found for this horizon. Consider rolling your free transfer.
        </p>
      )}
    </div>
  )
}
