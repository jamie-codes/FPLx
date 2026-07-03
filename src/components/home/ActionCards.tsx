'use client'
// UIX-02: the three do-this-week cards. Anti-goal enforced here by shape:
// one headline + one support line + one deep-link per card — no tables, no prose.
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export interface CaptainCardData {
  name: string
  team: string
  projectedPts: number // already doubled (projected_captain_pts)
  captainType: 'safe' | 'upside'
}

export interface TransferCardData {
  sellName: string
  buyName: string
  gain: number
  costLabel: string
}

export interface LineupCardData {
  formation: string
  xiXpts: number
}

// 'decision' folded into 'cockpit' (product-audit 2026-07)
export type ActionTool = 'cockpit' | 'transfers' | 'lineup'

function ActionCard({
  title,
  headline,
  support,
  go,
  onGo,
}: {
  title: string
  headline: React.ReactNode
  support: React.ReactNode
  go: { label: string; tool: ActionTool }
  onGo: (tool: ActionTool) => void
}) {
  return (
    <Card>
      <div className="flex h-full flex-col gap-1.5">
        <span className="text-data font-medium uppercase tracking-wide text-ink-muted">{title}</span>
        <span className="text-h4 font-semibold text-ink">{headline}</span>
        <span className="text-data text-ink-muted tabular">{support}</span>
        <div className="mt-auto pt-2 -ml-3 self-start">
          <Button variant="ghost" size="sm" onClick={() => onGo(go.tool)}>
            → {go.label}
          </Button>
        </div>
      </div>
    </Card>
  )
}

export function ActionCards({
  captain,
  transfer,
  lineup,
  onGo,
}: {
  captain?: CaptainCardData
  transfer?: TransferCardData
  lineup?: LineupCardData
  onGo: (tool: ActionTool) => void
}) {
  if (!captain && !transfer && !lineup) return null
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="action-cards">
      {captain && (
        <ActionCard
          title="Captain"
          headline={captain.name}
          support={`${captain.team} · ${captain.projectedPts.toFixed(1)} pts as (C) · ${
            captain.captainType === 'safe' ? 'safe pick' : 'upside pick'
          }`}
          go={{ label: 'Cockpit', tool: 'cockpit' }}
          onGo={onGo}
        />
      )}
      {transfer && (
        <ActionCard
          title="Transfer"
          headline={`${transfer.sellName} ➜ ${transfer.buyName}`}
          support={`+${transfer.gain.toFixed(1)} xPts · ${transfer.costLabel}`}
          go={{ label: 'Transfers', tool: 'transfers' }}
          onGo={onGo}
        />
      )}
      {lineup && (
        <ActionCard
          title="Lineup"
          headline={lineup.formation}
          support={`${lineup.xiXpts.toFixed(1)} projected XI pts`}
          go={{ label: 'Lineup', tool: 'lineup' }}
          onGo={onGo}
        />
      )}
    </div>
  )
}
