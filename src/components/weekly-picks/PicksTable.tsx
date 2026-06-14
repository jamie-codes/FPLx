'use client'
// PICK-01: one ranked picks table. Rank-ordered by definition — no sorting UI.
// UIX-03 Task 3: chrome → ui/Table primitives (local TABLE_CLS family deleted),
// identity column → PlayerCell sm (pos/team move into its meta line),
// status ⚠ → Chip warning. Haul column/colSpan + ExpandedPanel preserved exactly.
// PICK-02: PickExplain mounted below component bars + MCDistributionBar.
import { Fragment, useState } from 'react'
import type { MergedPlayer } from '@/lib/types'
import { xptsFor, nextEventsFixtures, type PicksHorizon } from '@/lib/picks'
import { explainPick } from '@/lib/explain-pick'
import { DifferentialBadge } from '@/components/gem-table/DifferentialBadge'
import { MCDistributionBar } from '@/components/mc/MCDistributionBar'
import { FixtureBadges } from '@/components/fixtures/FixtureBadges'
import { TableShell, Th, Td, TABLE_CLS, TR_CLS } from '@/components/ui/Table'
import { PlayerCell } from '@/components/ui/PlayerCell'
import { Chip } from '@/components/ui/Chip'
import { PickExplain } from './PickExplain'

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
              <span className="w-20 text-ink-muted">{label}</span>
              <div className="h-2 rounded bg-accent" style={{ width: `${(v / max) * 120}px` }} />
              <span>{v.toFixed(2)}</span>
            </div>
          ))}
          <div className="text-ink-muted">per-GW components</div>
        </div>
      )}
      {p.haul_prob != null && p.p10_pts != null && p.p90_pts != null && (
        <MCDistributionBar blankProb={p.blank_prob ?? 0} haulProb={p.haul_prob} p10Pts={p.p10_pts} p90Pts={p.p90_pts} />
      )}
      {/* PICK-02: deterministic why/risk explanation — annotation only, no ranking change */}
      <PickExplain explanation={explainPick(p)} />
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
    <div className="flex-1 min-w-[300px]">
      <h3 className="text-sm font-semibold uppercase tracking-wide mb-2">{title}</h3>
      <TableShell>
        <table className={TABLE_CLS}>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Player</Th>
              <Th>{horizon === '1gw' ? 'Fixture' : 'Fixtures'}</Th>
              <Th className="text-right">xPts</Th>
              {horizon === '1gw' && <Th className="text-right">Haul</Th>}
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <Fragment key={p.id}>
                <tr className={`${TR_CLS} cursor-pointer`} onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                  <Td>{i + 1}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5">
                      <PlayerCell
                        size="sm"
                        webName={p.web_name}
                        code={p.code}
                        teamCode={p.team_code}
                        pos={POS_LABEL[p.element_type]}
                        teamShort={p.team_short_name}
                      />
                      {STATUS_WARN[p.status] && (
                        <Chip intent="warning" size="sm" title={STATUS_WARN[p.status]}>⚠</Chip>
                      )}
                    </span>
                  </Td>
                  <Td><FixtureBadges fixtures={nextEventsFixtures(p.fixtures ?? [], nEvents)} /></Td>
                  <Td className="text-right font-semibold">{xptsFor(p, horizon).toFixed(1)}</Td>
                  {horizon === '1gw' && (
                    <Td className="text-right">
                      {p.haul_prob != null ? `${Math.round(p.haul_prob * 100)}%` : '—'}
                    </Td>
                  )}
                  <Td>
                    <DifferentialBadge flag={p.differential_flag} ownership={Number(p.selected_by_percent)} />
                  </Td>
                </tr>
                {expandedId === p.id && (
                  <tr className="bg-accent-soft">
                    <td colSpan={horizon === '1gw' ? 6 : 5} className="px-3 py-2"><ExpandedPanel p={p} /></td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </TableShell>
    </div>
  )
}
