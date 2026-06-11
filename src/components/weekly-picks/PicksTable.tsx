'use client'
// PICK-01: one ranked picks table. Rank-ordered by definition — no sorting UI.
// Chrome constants are local copies per PATTERNS.md convention.
import { Fragment, useState } from 'react'
import type { MergedPlayer } from '@/lib/types'
import { xptsFor, nextEventsFixtures, type PicksHorizon } from '@/lib/picks'
import { DifferentialBadge } from '@/components/gem-table/DifferentialBadge'
import { MCDistributionBar } from '@/components/mc/MCDistributionBar'
import { FixtureBadges } from '@/components/fixtures/FixtureBadges'

const TABLE_CLS = 'w-full text-sm border-collapse'
const TH_CLS = 'text-left font-semibold text-zinc-600 dark:text-zinc-400 pb-1 border-b border-zinc-200 dark:border-zinc-700'
const TR_CLS = 'even:bg-zinc-50 dark:even:bg-zinc-800/50 cursor-pointer hover:bg-blue-50 dark:hover:bg-zinc-700'
const TD_CLS = 'py-1 px-1'
const POS_LABEL: Record<number, string> = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' }
const STATUS_WARN: Record<string, string> = { d: 'Doubtful', i: 'Injured', s: 'Suspended', n: 'Not available' }

const COMPONENT_LABELS: [key: string, label: string][] = [
  ['goal_pts', 'Goals'], ['assist_pts', 'Assists'], ['cs_pts', 'Clean sheet'],
  ['bonus_pts', 'Bonus'], ['appearance_pts', 'Appearance'], ['save_pts', 'Saves'],
  ['defcon', 'DefCon'],
]

function ExpandedPanel({ p }: { p: MergedPlayer }) {
  const comps = p.xPts_components_1gw
  const entries = comps
    ? COMPONENT_LABELS.map(([k, label]) => [label, (comps as Record<string, number | undefined>)[k]] as const)
        .filter((e): e is readonly [string, number] => typeof e[1] === 'number' && e[1] > 0)
    : []
  const max = Math.max(...entries.map(([, v]) => v), 0.001)
  return (
    <div className="space-y-2 text-xs">
      {entries.length > 0 && (
        <div className="space-y-0.5">
          {entries.map(([label, v]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-20 text-zinc-500 dark:text-zinc-400">{label}</span>
              <div className="h-2 rounded bg-blue-400 dark:bg-blue-600" style={{ width: `${(v / max) * 120}px` }} />
              <span>{v.toFixed(2)}</span>
            </div>
          ))}
          <div className="text-zinc-400 dark:text-zinc-500">per-GW components</div>
        </div>
      )}
      {p.haul_prob != null && p.p10_pts != null && p.p90_pts != null && (
        <MCDistributionBar blankProb={p.blank_prob ?? 0} haulProb={p.haul_prob} p10Pts={p.p10_pts} p90Pts={p.p90_pts} />
      )}
    </div>
  )
}

export function PicksTable({ title, players, horizon }: {
  title: string
  players: MergedPlayer[]
  horizon: PicksHorizon
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const nEvents = horizon === '1gw' ? 1 : 3

  return (
    <div className="flex-1 min-w-[300px] rounded border border-zinc-200 dark:border-zinc-700 p-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">{title}</h3>
      <table className={TABLE_CLS}>
        <thead>
          <tr>
            <th className={TH_CLS}>#</th>
            <th className={TH_CLS}>Player</th>
            <th className={TH_CLS}>{horizon === '1gw' ? 'Fixture' : 'Fixtures'}</th>
            <th className={`${TH_CLS} text-right`}>xPts</th>
            {horizon === '1gw' && <th className={`${TH_CLS} text-right`}>Haul</th>}
            <th className={TH_CLS}></th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <Fragment key={p.id}>
              <tr className={TR_CLS} onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                <td className={TD_CLS}>{i + 1}</td>
                <td className={TD_CLS}>
                  <span className="font-medium">{p.web_name}</span>{' '}
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {POS_LABEL[p.element_type]} {p.team_short_name}
                  </span>
                  {STATUS_WARN[p.status] && <span title={STATUS_WARN[p.status]}> ⚠</span>}
                </td>
                <td className={TD_CLS}><FixtureBadges fixtures={nextEventsFixtures(p.fixtures ?? [], nEvents)} /></td>
                <td className={`${TD_CLS} text-right font-semibold`}>{xptsFor(p, horizon).toFixed(1)}</td>
                {horizon === '1gw' && (
                  <td className={`${TD_CLS} text-right`}>
                    {p.haul_prob != null ? `${Math.round(p.haul_prob * 100)}%` : '—'}
                  </td>
                )}
                <td className={TD_CLS}>
                  <DifferentialBadge flag={p.differential_flag} ownership={Number(p.selected_by_percent)} />
                </td>
              </tr>
              {expandedId === p.id && (
                <tr className="bg-blue-50 dark:bg-blue-950">
                  <td colSpan={horizon === '1gw' ? 6 : 5} className="px-3 py-2"><ExpandedPanel p={p} /></td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
