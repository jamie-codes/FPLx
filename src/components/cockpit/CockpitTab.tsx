'use client'

// This Week cockpit (product-audit 2026-07): ONE view answering "what should I
// do this week?", in decision order — deadline, transfers, chips, then the
// full user-squad decision summary (captain / transfers / chips / risk / prose),
// absorbed from the retired `decision` tab. The pipeline advisor cards
// (TRF-01/CHP-01) advise on the model trajectory; DecisionSummaryTab advises
// on YOUR squad — both belong in the same glance. Power tools stay one click
// away.
import { useNextDeadline } from '@/lib/hooks/useNextDeadline'
import { DecisionSummaryTab } from '@/components/squad/DecisionSummaryTab'
import { CockpitVerdictBanner } from './CockpitVerdictBanner'
import { TransferAdviceCard } from './TransferAdviceCard'
import { UserTransferAdviceCard } from './UserTransferAdviceCard'
import { ChipAdviceCard } from './ChipAdviceCard'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { ToolId } from '@/lib/navigation'

function deadlineParts(iso: string): { label: string; countdown: string } {
  const d = new Date(iso)
  const label = d.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
  const ms = d.getTime() - Date.now()
  if (ms <= 0) return { label, countdown: 'passed' }
  const h = Math.floor(ms / 3_600_000)
  const days = Math.floor(h / 24)
  return { label, countdown: days >= 1 ? `${days}d ${h % 24}h` : `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m` }
}

export function CockpitTab({ teamId, onTeamIdChange, submittedId, onSubmit, selectTool }: {
  teamId: string
  onTeamIdChange: (id: string) => void
  submittedId: string | null
  onSubmit: () => void
  selectTool: (tool: ToolId) => void
}) {
  const { data: deadline } = useNextDeadline()
  const dl = deadline ? deadlineParts(deadline.deadline_time) : null

  return (
    <div className="space-y-4">
      {/* Card 1 (redesign Phase 3): one-sentence verdict — transfer + captain + chip */}
      <CockpitVerdictBanner />

      {/* Deadline strip + power-tool links */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3">
          {deadline && dl ? (
            <div className="flex items-baseline gap-2">
              <span className="text-data uppercase tracking-wide text-ink-muted">
                GW{deadline.id} deadline
              </span>
              <span className="text-h3 font-semibold tabular text-ink">{dl.countdown}</span>
              <span className="text-data text-ink-muted">{dl.label}</span>
            </div>
          ) : (
            <span className="text-body text-ink-muted">No upcoming deadline — off-season.</span>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => selectTool('lineup')}>Lineup</Button>
            <Button variant="secondary" size="sm" onClick={() => selectTool('optimiser')}>Optimiser</Button>
            <Button variant="secondary" size="sm" onClick={() => selectTool('planner')}>Planner</Button>
          </div>
        </div>
      </Card>

      {/* Advisors: YOUR squad when a team is loaded (TRF-02), else the model
          trajectory (TRF-01) — plus the chip signals. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {submittedId ? <UserTransferAdviceCard submittedId={submittedId} /> : <TransferAdviceCard />}
        <ChipAdviceCard />
      </div>

      {/* Your squad's decision summary — captain, transfers, chips, risk, prose */}
      <DecisionSummaryTab
        teamId={teamId}
        onTeamIdChange={onTeamIdChange}
        submittedId={submittedId}
        onSubmit={onSubmit}
      />
    </div>
  )
}
