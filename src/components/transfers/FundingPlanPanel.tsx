'use client'
// FUND-01 (2026-09-02): plan a funded rebuild — which players to sell and
// which bench slots to downgrade to fodder, within the free transfers banked.
//
// Distinct from the transfer suggestions above it: those hunt for value
// UPGRADES, this frees CASH for a planned rebuild (e.g. exiting a club whose
// fixtures turn) and prices each downgrade in projected points given up.
import { useMemo, useState } from 'react'
import { computeFundingPlan } from '@/lib/funding-plan'
import { MAX_BANKED_FREE_TRANSFERS } from '@/lib/free-transfers'
import type { MergedPlayer } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

interface Props {
  picks: SquadPick[]
  players: MergedPlayer[]
  sellPrices?: Map<number, number>
  bank: number
  freeTransfers: number
  /** Earliest selectable gameweek (defaults the rebuild GW). */
  gwOptions: number[]
}

const money = (tenths: number) => `£${(tenths / 10).toFixed(1)}m`

export function FundingPlanPanel({
  picks, players, sellPrices, bank, freeTransfers, gwOptions,
}: Props) {
  const [startGw, setStartGw] = useState<number | null>(null)
  const [horizon, setHorizon] = useState(3)
  const [ft, setFt] = useState(freeTransfers)
  const [forceSellTeam, setForceSellTeam] = useState<number | null>(null)

  const byId = useMemo(() => new Map(players.map(p => [p.id, p])), [players])
  const squad = useMemo(
    () => picks.map(pk => byId.get(pk.element)).filter((p): p is MergedPlayer => !!p),
    [picks, byId],
  )
  const teamsInSquad = useMemo(() => {
    const seen = new Map<number, string>()
    for (const p of squad) seen.set(p.team, p.team_short_name ?? String(p.team))
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [squad])

  const effectiveGw = startGw ?? gwOptions[0] ?? null

  // Bench picks are the natural downgrade pool — they score least, so they
  // cost least to cheapen.
  const benchIds = useMemo(
    () => picks.filter(pk => pk.position >= 12).map(pk => pk.element),
    [picks],
  )

  const plan = useMemo(() => {
    if (effectiveGw === null || squad.length === 0) return null
    return computeFundingPlan({
      picks, players, sellPrices, bank, freeTransfers: ft,
      startGw: effectiveGw, horizon,
      forceSellIds: forceSellTeam === null
        ? []
        : squad.filter(p => p.team === forceSellTeam).map(p => p.id),
      downgradeCandidateIds: benchIds,
    })
  }, [picks, players, sellPrices, bank, ft, effectiveGw, horizon,
      forceSellTeam, benchIds, squad])

  if (effectiveGw === null) return null

  return (
    <section className="mt-6 rounded border border-line p-4" data-testid="funding-plan">
      <h2 className="text-base font-semibold text-ink">Fund a rebuild</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Sells and bench downgrades that free cash for your XI, priced in the
        points they give up.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Rebuild in</span>
          <select
            aria-label="Rebuild gameweek"
            value={effectiveGw}
            onChange={e => setStartGw(Number(e.target.value))}
            className="min-h-[44px] rounded border border-line bg-surface-1 px-2 text-sm text-ink sm:min-h-0 sm:py-1">
            {gwOptions.map(gw => <option key={gw} value={gw}>GW{gw}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Free transfers</span>
          <input
            aria-label="Free transfers available"
            type="number" min={0} max={MAX_BANKED_FREE_TRANSFERS} value={ft}
            onChange={e => setFt(Math.max(0, Math.min(MAX_BANKED_FREE_TRANSFERS, Number(e.target.value))))}
            className="min-h-[44px] w-20 rounded border border-line bg-surface-1 px-2 text-sm text-ink sm:min-h-0 sm:py-1" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Horizon</span>
          <select
            aria-label="Funding horizon"
            value={horizon}
            onChange={e => setHorizon(Number(e.target.value))}
            className="min-h-[44px] rounded border border-line bg-surface-1 px-2 text-sm text-ink sm:min-h-0 sm:py-1">
            {[1, 2, 3, 4, 5].map(h => <option key={h} value={h}>{h} GW</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted" title="Sell everyone from this club regardless of value — e.g. a club whose fixtures turn">
            Sell all from
          </span>
          <select
            aria-label="Force sell club"
            value={forceSellTeam ?? ''}
            onChange={e => setForceSellTeam(e.target.value === '' ? null : Number(e.target.value))}
            className="min-h-[44px] rounded border border-line bg-surface-1 px-2 text-sm text-ink sm:min-h-0 sm:py-1">
            <option value="">No club</option>
            {teamsInSquad.map(([id, short]) => (
              <option key={id} value={id}>{short}</option>
            ))}
          </select>
        </label>
      </div>

      {plan && plan.moves.length === 0 && (
        <p className="mt-4 text-sm text-ink-muted">
          No downgrade frees cash without costing more than it is worth. Try a
          later gameweek, or pick a club to sell.
        </p>
      )}

      {plan && plan.moves.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-ink-muted">
                  <th className="px-2 py-1 font-medium">Out</th>
                  <th className="px-2 py-1 font-medium">In</th>
                  <th className="px-2 py-1 text-right font-medium">Frees</th>
                  <th className="px-2 py-1 text-right font-medium" title="Projected points given up across the horizon">
                    xPts cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {plan.moves.map(m => (
                  <tr key={m.sell.id} className="border-b border-line last:border-0">
                    <td className="px-2 py-1 text-ink">
                      {m.sell.web_name}
                      {m.forced && (
                        <span className="ml-1 text-data text-ink-muted">(club exit)</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-ink">{m.buy.web_name}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-positive">
                      {money(m.cashFreed)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-ink-muted">
                      −{m.xPtsCost.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="text-ink">
              Budget after: <strong>{money(plan.budgetAfter)}</strong>
            </span>
            <span className="text-ink-muted">
              Frees {money(plan.cashFreed)} for −{plan.xPtsCost.toFixed(1)} xPts
            </span>
            <span className={plan.hits > 0 ? 'text-negative' : 'text-ink-muted'}>
              {plan.transfersUsed} transfer{plan.transfersUsed === 1 ? '' : 's'}
              {plan.hits > 0 ? ` · ${plan.hits} hit${plan.hits === 1 ? '' : 's'} (−${plan.pointsCost} pts)` : ' · no hits'}
            </span>
          </div>
        </>
      )}
    </section>
  )
}
