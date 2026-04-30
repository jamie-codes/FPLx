'use client'

import { useMemo, useState } from 'react'
import { useAccuracy } from '@/lib/hooks/useAccuracy'
import type { AccuracyBacktest, AccuracyHaulter } from '@/lib/types'

// Tier thresholds + colour classes — reused verbatim from InsightsTab (TIER_CLASSES locked by 33-UI-SPEC).
const TIER_CLASSES = {
  HIGH:   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  LOW:    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
} as const
type Tier = keyof typeof TIER_CLASSES

function getHitRateTier(rate: number): Tier {
  if (rate >= 0.50) return 'HIGH'
  if (rate >= 0.30) return 'MEDIUM'
  return 'LOW'
}

function HitRateBadge({ rate }: { rate: number }) {
  const tier = getHitRateTier(rate)
  return (
    <span className={`inline-block text-xs rounded px-2 py-0.5 ${TIER_CLASSES[tier]}`}>
      {(rate * 100).toFixed(1)}%
    </span>
  )
}

function FlaggedCell({ flagged }: { flagged: boolean }) {
  return flagged
    ? <span className="text-green-600 dark:text-green-400" aria-label="Flagged: yes">✓</span>
    : <span className="text-zinc-400 dark:text-zinc-500" aria-label="Flagged: no">✗</span>
}

function DeltaCell({ delta }: { delta: number }) {
  const formatted = delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)
  const cls = delta < 0
    ? 'text-red-600 dark:text-red-400'
    : delta > 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-zinc-500'
  return <span className={cls}>{formatted}</span>
}

// Locked table chrome classes (UI-SPEC).
const TH_CLS = 'text-left font-semibold text-zinc-600 dark:text-zinc-400 pb-1 border-b border-zinc-200 dark:border-zinc-700'
const TR_CLS = 'even:bg-zinc-50 dark:even:bg-zinc-800/50'
const TD_CLS = 'py-1'
const TABLE_CLS = 'w-full text-sm border-collapse'

function GwSummaryTable({ data }: { data: AccuracyBacktest }) {
  const rows = data.summary.gws
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">GW Accuracy Summary</h2>
      <table className={TABLE_CLS}>
        <thead>
          <tr>
            <th scope="col" className={TH_CLS}>GW</th>
            <th scope="col" className={TH_CLS}>Haulers</th>
            <th scope="col" className={TH_CLS}>xPts Flagged</th>
            <th scope="col" className={TH_CLS}>xPts Hit Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.gw} className={TR_CLS}>
              <td className={TD_CLS}>GW{r.gw}</td>
              <td className={TD_CLS}>{r.haulter_count}</td>
              <td className={TD_CLS}>{r.xpts_flagged}</td>
              <td className={TD_CLS}><HitRateBadge rate={r.xpts_hit_rate} /></td>
            </tr>
          ))}
          <tr className="font-semibold bg-zinc-50 dark:bg-zinc-800">
            <td className={TD_CLS}>Overall</td>
            <td className={TD_CLS}>—</td>
            <td className={TD_CLS}>—</td>
            <td className={TD_CLS}><HitRateBadge rate={data.summary.xpts_hit_rate} /></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function HaulterList({ data }: { data: AccuracyBacktest }) {
  const sorted = useMemo(() => {
    return [...data.haulters].sort((a, b) => b.gw - a.gw || b.actual_pts - a.actual_pts)
  }, [data.haulters])

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Correctly Flagged Haulers</h2>
      <table className={TABLE_CLS}>
        <thead>
          <tr>
            <th scope="col" className={TH_CLS}>Player</th>
            <th scope="col" className={TH_CLS}>GW</th>
            <th scope="col" className={TH_CLS}>Actual Pts</th>
            <th scope="col" className={TH_CLS}>xPts Pred</th>
            <th scope="col" className={TH_CLS} title="Player's rank by xPts prediction in this GW (lower = higher predicted score)">xPts Rank</th>
            <th scope="col" className={TH_CLS} title="Model predicted this player would score 10+ points in this GW">xPts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((h: AccuracyHaulter) => (
            <tr key={`${h.gw}-${h.player_id}`} className={TR_CLS}>
              <td className={TD_CLS}>{h.player_name}</td>
              <td className={TD_CLS}>GW{h.gw}</td>
              <td className={TD_CLS}>{h.actual_pts}</td>
              <td className={TD_CLS}>{h.xpts_predicted.toFixed(1)}</td>
              <td className={TD_CLS}>{h.xpts_rank}</td>
              <td className={TD_CLS}><FlaggedCell flagged={h.xpts_flagged} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type DeltaRow = {
  player_name: string
  team: string
  gw: number
  actual_pts: number
  xpts_predicted: number
  xpts_delta: number
}

type SortKey = 'player_name' | 'gw' | 'actual_pts' | 'xpts_predicted' | 'xpts_delta'
type SortDir = 'asc' | 'desc'

function PlayerDeltaTable({ data }: { data: AccuracyBacktest }) {
  const [sortKey, setSortKey] = useState<SortKey>('xpts_delta')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const flat = useMemo<DeltaRow[]>(() => {
    const out: DeltaRow[] = []
    for (const p of data.players) {
      for (const g of p.gws) {
        out.push({
          player_name: p.player_name,
          team: p.team,
          gw: g.gw,
          actual_pts: g.actual_pts,
          xpts_predicted: g.xpts_predicted,
          xpts_delta: g.xpts_delta,
        })
      }
    }
    return out
  }, [data.players])

  const sorted = useMemo(() => {
    const copy = [...flat]
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      let cmp: number
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [flat, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function sortableHeaderCls(key: SortKey) {
    const active = sortKey === key
    const colour = active ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'
    return `text-left font-semibold pb-1 border-b border-zinc-200 dark:border-zinc-700 cursor-pointer ${colour}`
  }

  function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    if (sortKey !== key) return 'none'
    return sortDir === 'asc' ? 'ascending' : 'descending'
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Player Prediction Errors</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
        Sorted by biggest xPts over-prediction (most negative delta first). Click any column header to re-sort.
      </p>
      <table className={TABLE_CLS}>
        <thead>
          <tr>
            <th scope="col" className={sortableHeaderCls('player_name')} aria-sort={ariaSort('player_name')} onClick={() => handleSort('player_name')}>Player</th>
            <th scope="col" className={TH_CLS}>Team</th>
            <th scope="col" className={sortableHeaderCls('gw')} aria-sort={ariaSort('gw')} onClick={() => handleSort('gw')}>GW</th>
            <th scope="col" className={sortableHeaderCls('actual_pts')} aria-sort={ariaSort('actual_pts')} onClick={() => handleSort('actual_pts')}>Actual Pts</th>
            <th scope="col" className={sortableHeaderCls('xpts_predicted')} aria-sort={ariaSort('xpts_predicted')} onClick={() => handleSort('xpts_predicted')}>xPts Pred</th>
            <th scope="col" className={sortableHeaderCls('xpts_delta')} aria-sort={ariaSort('xpts_delta')} onClick={() => handleSort('xpts_delta')}>xPts Δ</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={`${r.player_name}-${r.gw}-${i}`} className={TR_CLS}>
              <td className={TD_CLS}>{r.player_name}</td>
              <td className={TD_CLS}>{r.team}</td>
              <td className={TD_CLS}>GW{r.gw}</td>
              <td className={TD_CLS}>{'​'}{r.actual_pts}{'​'}</td>
              <td className={TD_CLS}>{r.xpts_predicted.toFixed(1)}</td>
              <td className={TD_CLS}><DeltaCell delta={r.xpts_delta} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AccuracyTab() {
  const { data, isLoading, error } = useAccuracy()

  if (isLoading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
        Loading accuracy data…
      </p>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400 py-4">
        Failed to load accuracy data. Run the pipeline and refresh.
      </p>
    )
  }

  if (!data) {
    return (
      <section className="mt-6 space-y-2" aria-label="Accuracy not available">
        <h2 className="text-lg font-semibold">No accuracy data yet</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Run the pipeline to generate backtest data.
        </p>
      </section>
    )
  }

  return (
    <section className="mt-6 space-y-8" aria-label="Projection accuracy">
      <GwSummaryTable data={data} />
      <HaulterList data={data} />
      <PlayerDeltaTable data={data} />
    </section>
  )
}
