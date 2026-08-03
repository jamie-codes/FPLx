'use client'

// Planner outlook: horizontal per-GW captain strip ("model's best route"),
// from bestCaptainPerGw over the generated plan. Renders nothing without a plan.
import type { MergedPlayer, PlanStep } from '@/lib/types'
import { bestCaptainPerGw } from '@/lib/captain-plan'
import { getTeamColour } from '@/lib/team-colours'

export function CaptainPlanStrip({ steps, playerMap }: {
  steps: PlanStep[]
  playerMap: Map<number, MergedPlayer>
}) {
  const entries = bestCaptainPerGw(steps, playerMap)
  if (entries.length === 0) return null

  return (
    <section className="rounded border border-line p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-ink">Captain plan</h2>
        <span className="text-data text-ink-muted">model&apos;s best route</span>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {entries.map((e) => {
          const c = getTeamColour(e.team)
          return (
            <div key={e.gw} className="shrink-0 w-28 rounded border border-line bg-surface-2 p-2 text-center">
              <div className="text-data text-ink-muted">GW{e.gw}</div>
              <div className="flex items-center justify-center mt-1">
                <span
                  className="text-[10px] font-semibold px-1 py-0.5 rounded-full tabular"
                  style={{ background: c.primary, color: c.text }}>
                  {e.team}
                </span>
              </div>
              <div className="text-body font-semibold text-ink truncate mt-0.5">{e.name}</div>
              <div className="text-data text-ink-muted truncate">{e.opponent}</div>
              <div className="text-body font-semibold text-accent tabular mt-0.5">{e.xpts.toFixed(1)}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
