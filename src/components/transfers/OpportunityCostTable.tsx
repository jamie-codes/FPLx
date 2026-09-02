'use client'

// Phase 50 (OCS-01..OCS-05): OpportunityCostTable — renders pre-computed OCSRow[]
// as a <table> with one row per option (Roll / 1 FT / 1 FT (Hit) / 2 FT).
// Pure presentation: no hooks, no fetch. Driven by TransferPanel ocsRows + ocsHorizon.
// Visual contract locked by .planning/phases/050-transfer-opportunity-cost-simulator/050-UI-SPEC.md.

import type { OCSRow, OCSRowKind } from '@/lib/opportunity-cost'
import type { OptimiserHorizon, ScoredPlayer, LineupNewsPlayer } from '@/lib/types'
import type { LifecycleLabel } from '@/lib/lifecycle-label'
import { RotationRiskBadge } from '@/components/shared/RotationRiskBadge'
import { NewsBanner } from '@/components/news/NewsBanner'
import { computeFragility } from '@/lib/sensitivity'
import { FragilityBadge } from '@/components/shared/FragilityBadge'
import { computeRejection } from '@/lib/explain'
import { PlayerInsightSection } from '@/components/shared/PlayerInsightSection'
import { StatusLabelBadge } from '@/components/shared/StatusLabelBadge'
import { MinsRiskBadge } from '@/components/shared/MinsRiskBadge'
import { ConfirmedSigningBadge } from '@/components/shared/ConfirmedSigningBadge'
import { computeHoldLabel } from '@/lib/gw-xpts'

interface OpportunityCostTableProps {
  rows: OCSRow[]
  horizon: OptimiserHorizon
  targetGw?: number   // Phase 101 GWT-01: when set, column header switches to "xPts Gain (GW{N})"
  gw: number          // Phase 105 NLP-02: required for PlayerInsightSection cache key
  // Phase 104 WHY-01 (D-08): sell-side rejection reasons computed per-leg in PlayerMoveCell.
  allPlayers: ScoredPlayer[]
  lifecycleLabels: Map<number, LifecycleLabel>
  // Phase 112 TFR-02 (D-07): pre-cap totals per element_type for truncation footnote.
  // Optional for backward-compat — when absent, no footnotes render.
  totalsByPosition?: Map<number, number>
  // Phase 119 UI-02 (D-09): optional — backward-compat. When absent or player not in map, no StatusLabelBadge renders.
  lineupNewsMap?: Map<number, LineupNewsPlayer>
  // Phase 125 WIN-02 (D-14..D-16): optional — confirmed signing badge for buy candidates.
  // Map of element_id → tooltip text ("<headline> · <source>"). When absent, no badge renders.
  confirmedSigningMap?: Map<number, string>
}

interface BadgeConfig {
  bg: string
  text: string
  label: string
  title: string
}

// Phase 112 TFR-02: position labels for truncation footnote data-testid and text.
const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

// UIX-04 ruling 3: hit/free semantics — free→positive, hit→negative,
// marginal→warning, roll baseline→neutral. Never flattened to accent.
const BADGE_BY_KIND: Record<OCSRowKind, BadgeConfig> = {
  roll: {
    bg: 'bg-surface-2',
    text: 'text-ink-muted',
    label: 'Baseline',
    title: 'Roll your free transfer — no points spent and no transfer made.',
  },
  // OCS-06: plans of 3+ transfers, for managers with rolled free transfers.
  'multi-free': {
    bg: 'bg-positive-soft',
    text: 'text-positive',
    label: 'Free',
    title: 'Uses the free transfers you have banked — no points cost.',
  },
  'multi-hit': {
    bg: 'bg-negative-soft',
    text: 'text-negative',
    label: 'Hit',
    title: 'More transfers than you have banked — each extra one costs -4pts.',
  },
  'single-free': {
    bg: 'bg-positive-soft',
    text: 'text-positive',
    label: 'Free',
    title: 'Uses a free transfer — no points cost.',
  },
  'single-hit': {
    bg: 'bg-negative-soft',
    text: 'text-negative',
    label: 'Hit',
    title: 'This transfer costs a -4pt hit deducted from your score.',
  },
  'combo-free': {
    bg: 'bg-positive-soft',
    text: 'text-positive',
    label: 'Free',
    title: 'Uses both free transfers — no points cost.',
  },
  'combo-hit': {
    bg: 'bg-negative-soft',
    text: 'text-negative',
    label: 'Hit',
    title: 'This combination costs a -4pt hit deducted from your score.',
  },
  'combo-hit-8': {
    bg: 'bg-negative-soft',
    text: 'text-negative',
    label: 'Hit',
    title: 'This combination costs a −8pt hit (two simultaneous hits) deducted from your score.',
  },
}

const MARGINAL_BADGE: BadgeConfig = {
  bg: 'bg-warning-soft',
  text: 'text-warning',
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

function PlayerMoveCell({
  row,
  gw,
  allPlayers,
  lifecycleLabels,
  lineupNewsMap,
  confirmedSigningMap,
  targetGw,
}: {
  row: OCSRow
  gw: number
  allPlayers: ScoredPlayer[]
  lifecycleLabels: Map<number, LifecycleLabel>
  lineupNewsMap?: Map<number, LineupNewsPlayer>
  confirmedSigningMap?: Map<number, string>
  targetGw?: number
}) {
  if (row.kind === 'roll' || !row.transfers || row.transfers.length === 0) {
    return <span className="text-ink-muted">—</span>
  }
  return (
    <div className="space-y-0.5">
      {row.transfers.map((t, i) => {
        // Phase 93 SENS-01 (D-11): per-leg fragility for the BUY candidate (transfer path).
        const { tier, reasons } = computeFragility(t.buy, true, row.xPtsGainNet)
        // Phase 104 WHY-01 (D-04, D-05, D-07): per-leg rejection reasons for the SELL candidate.
        // computeRejection degrades gracefully when lifecycleLabels is new Map() (D-09).
        const { reasons: sellReasons } = computeRejection(t.sell as unknown as ScoredPlayer, allPlayers, lifecycleLabels)
        const sellReasonsCapped = sellReasons.slice(0, 4)
        return (
          <div key={i}>
            <div className="flex flex-wrap items-center gap-x-2 text-sm text-ink">
              <span className="text-ink-muted text-xs">Sell</span>
              <span className="font-medium">{t.sell.web_name}</span>
              <span className="text-ink-muted">→</span>
              <span className="text-ink-muted text-xs">Buy</span>
              <span className="font-medium">{t.buy.web_name}</span>
              <RotationRiskBadge rotationRisk={t.buy.rotation_risk ?? false} />
              {/* Phase 119 UI-02: StatusLabelBadge for buy candidate (D-09): after RotationRiskBadge, before NewsBanner */}
              <StatusLabelBadge statusLabel={lineupNewsMap?.get(t.buy.id)?.status_label} />
              {/* Phase 122 POL-04: MinsRiskBadge for buy candidate — minutes confidence signal */}
              <MinsRiskBadge
                minsRisk={t.buy.mins_risk}
                difficultyRotationRisk={t.buy.difficulty_rotation_risk}
                availabilityRisk={t.buy.availability_risk}
              />
              {/* Phase 125 WIN-02 (D-14, D-15, D-16): Confirmed Signing badge for buy candidate only */}
              {confirmedSigningMap?.has(t.buy.id) && (
                <ConfirmedSigningBadge tooltipText={confirmedSigningMap.get(t.buy.id)} />
              )}
              {/* GWT-01: hold horizon label — "GW{N}+" / "GW{N} mainly" / "GW{N} only" */}
              {targetGw !== undefined && (() => {
                const holdLabel = computeHoldLabel(t.buy, targetGw)
                if (!holdLabel) return null
                const isPlus = holdLabel.endsWith('+')
                const isOnly = holdLabel.endsWith('only')
                return (
                  <span
                    data-testid={`hold-label-${t.buy.id}`}
                    className={`text-xs font-medium rounded px-1.5 py-0.5 ${
                      isPlus
                        ? 'bg-positive-soft text-positive'
                        : isOnly
                        ? 'bg-surface-2 text-ink-muted'
                        : 'bg-warning-soft text-warning'
                    }`}
                  >
                    {holdLabel}
                  </span>
                )
              })()}
              {/* Phase 88 SCRAPER-01: news banner for buy candidate (D-07) */}
              <NewsBanner
                news={t.buy.news ?? ''}
                news_added={t.buy.news_added}
                chance_of_playing_next_round={t.buy.chance_of_playing_next_round}
              />
            </div>
            {/* Phase 104 WHY-01 (D-02, D-03, D-05): always-visible inline sell-side rejection reasons. */}
            {sellReasonsCapped.length > 0 && (
              <div className="space-y-1 mt-1" data-testid="sell-rejection-reasons">
                {sellReasonsCapped.map((reason, ri) => (
                  <p key={ri} className="text-xs text-ink-muted">
                    {reason}
                  </p>
                ))}
              </div>
            )}
            {tier !== 'robust' && <FragilityBadge tier={tier} reasons={reasons} />}
            {/* Phase 105 NLP-02 (D-05): AI insight section, appended below FragilityBadge for buy candidate */}
            <PlayerInsightSection
              player={t.buy}
              gw={gw}
              rejectionReasons={sellReasonsCapped}
              fragility={{ tier, reasons }}
              lifecycleLabel={lifecycleLabels.get(t.buy.id) as string | undefined}
            />
          </div>
        )
      })}
    </div>
  )
}

export function OpportunityCostTable({ rows, horizon, targetGw, gw, allPlayers, lifecycleLabels, totalsByPosition, lineupNewsMap, confirmedSigningMap }: OpportunityCostTableProps) {
  const onlyRoll = rows.length === 1 && rows[0]?.kind === 'roll'

  return (
    <div className="space-y-2" data-testid="opportunity-cost-table">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-xs text-ink-muted border-b border-line">
            <th className="text-left py-2 pl-2 font-semibold w-[20%]">Option</th>
            <th className="text-left py-2 font-semibold w-[35%]">Player Move</th>
            <th className="text-right py-2 font-semibold w-[20%]">
              {targetGw !== undefined
                ? `xPts Gain (GW${targetGw})`
                : `xPts Gain (Next ${horizon} GW${horizon === 1 ? '' : 's'})`}
            </th>
            <th className="text-right py-2 font-semibold w-[15%] hidden sm:table-cell">Break-even</th>
            <th className="text-right py-2 pr-2 font-semibold w-[10%]">Label</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const badge = badgeFor(row)
            const isDisabled = !row.isAffordable
            return (
              <tr
                key={row.kind}
                aria-disabled={isDisabled || undefined}
                className={`border-b border-line hover:bg-surface-2${isDisabled ? ' opacity-50' : ''}`}
                data-testid={`ocs-row-${row.kind}`}
              >
                <td className="py-2 pl-2 align-top text-ink font-medium">
                  {row.label}
                </td>
                <td className="py-2 align-top">
                  <PlayerMoveCell row={row} gw={gw} allPlayers={allPlayers} lifecycleLabels={lifecycleLabels} lineupNewsMap={lineupNewsMap} confirmedSigningMap={confirmedSigningMap} targetGw={targetGw} />
                </td>
                <td className="py-2 text-right align-top text-ink">
                  <div className={isDisabled ? 'line-through text-ink-muted' : ''}>
                    {formatXPts(row)}
                  </div>
                  {row.cost > 0 && (
                    <div className="text-xs text-ink-muted">−{row.cost}pt hit</div>
                  )}
                  {row.kind !== 'roll' && (
                    <div className="text-xs text-ink-muted">
                      Bank: {row.bankAfter >= 0
                        ? `£${(row.bankAfter / 10).toFixed(1)}m`
                        : `−£${(Math.abs(row.bankAfter) / 10).toFixed(1)}m`}
                    </div>
                  )}
                </td>
                <td className="py-2 text-right align-top text-ink hidden sm:table-cell">
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
                    <div className="text-xs text-negative mt-1">{row.disabledReason}</div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {/* Phase 112 TFR-02 (D-07): per-position truncation footnotes. Renders one <p> per
          position bucket whose pre-cap total exceeded 3. Silent when totalsByPosition is
          undefined (backward-compat) or all buckets are within the cap. */}
      {totalsByPosition && Array.from(totalsByPosition.entries())
        .sort(([a], [b]) => a - b)
        .filter(([, total]) => total > 3)
        .map(([pos, total]) => (
          <p
            key={`cap-footnote-${pos}`}
            className="text-xs text-ink-muted mt-1"
            data-testid={`cap-footnote-${POSITION_LABELS[pos] ?? pos}`}
          >
            Showing top 3 of {total} {POSITION_LABELS[pos] ?? '??'} suggestions.
          </p>
        ))}
      {onlyRoll && (
        <p className="text-xs text-ink-muted pt-1">
          No transfer improvements found for this horizon. Consider rolling your free transfer.
        </p>
      )}
    </div>
  )
}
