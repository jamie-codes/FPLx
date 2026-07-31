'use client'

// TRF-02: the exp14-validated transfer policy running on YOUR squad.
// Sell prices come from the authenticated my-team endpoint when available
// (half-profit rule); otherwise now_cost. FT count is user-set (FPL banks up
// to 5); hits cost -4 and must clear the validated gain bar.
import { useMemo, useState } from 'react'
import { useSquad } from '@/lib/hooks/useSquad'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import {
  mergedToCandidates, picksToSquadCandidates, suggestValidatedTransfers,
} from '@/lib/validated-transfer-advisor'
import { explainPick } from '@/lib/explain-pick'
import { getTeamColour } from '@/lib/team-colours'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { ArrowRight } from 'lucide-react'
import type { MergedPlayer } from '@/lib/types'

const POS = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' } as const

function Monogram({ team }: { team?: string }) {
  if (!team) return null
  const c = getTeamColour(team)
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 tabular"
      style={{ background: c.primary, color: c.text }}>
      {team}
    </span>
  )
}

export function UserTransferAdviceCard({ submittedId }: { submittedId: string | null }) {
  const { data: squadData, isLoading: squadLoading } = useSquad(submittedId)
  const { data: playersData, isLoading: playersLoading } = usePlayers()
  const { isAuthenticated } = useAuthStatus()
  const { data: myTeam } = useMyTeam(isAuthenticated && !!submittedId)
  const [ft, setFt] = useState<'1' | '2'>('1')

  const advice = useMemo(() => {
    if (!squadData?.picks?.length || !playersData?.length) return null
    const sellPrices = myTeam?.picks
      ? new Map(myTeam.picks.map(p => [p.element, p.selling_price]))
      : undefined
    const squad = picksToSquadCandidates(squadData.picks, playersData, sellPrices)
    const pool = mergedToCandidates(playersData)
    const bank = squadData.entry_history?.bank ?? 0
    const budget = squad.reduce((s, p) => s + p.cost, 0) + bank
    return suggestValidatedTransfers(squad, pool, {
      freeTransfers: Number(ft), budget,
    })
  }, [squadData, playersData, myTeam, ft])

  const playerMap = useMemo(
    () => new Map<number, MergedPlayer>((playersData ?? []).map((p) => [p.id, p])),
    [playersData],
  )

  const loading = squadLoading || playersLoading

  return (
    <Card
      title="Transfers"
      subtitle="your squad · validated policy (exp14)"
      action={
        <div className="flex items-center gap-2">
          <SegmentedToggle
            ariaLabel="Free transfers available"
            size="sm"
            options={[{ id: '1', label: '1 FT' }, { id: '2', label: '2 FT' }]}
            value={ft}
            onChange={(id) => setFt(id as '1' | '2')}
          />
          {advice && !advice.hold && (
            <Chip intent={advice.netGain > 0 ? 'positive' : 'warning'}>
              net {advice.netGain > 0 ? '+' : ''}{advice.netGain.toFixed(1)} xPts
            </Chip>
          )}
        </div>
      }
    >
      {!submittedId && (
        <EmptyState
          title="No team loaded"
          hint="Enter your team ID in the decision summary below — advice runs on your actual 15."
        />
      )}
      {submittedId && loading && <Skeleton className="h-24" />}
      {submittedId && !loading && advice?.hold && (
        <p className="text-body text-ink-muted" data-testid="user-hold-message">
          No move clears the gain bar this week — bank the transfer.
        </p>
      )}
      {submittedId && !loading && advice && !advice.hold && (
        <ul className="space-y-2" data-testid="user-advice-moves">
          {advice.moves.map((m, i) => {
            const inP = playerMap.get(m.in.id)
            const outP = playerMap.get(m.out.id)
            const ex = inP ? explainPick(inP) : { reasons: [], risks: [] }
            const isTop = i === 0
            return (
              <li
                key={m.out.id}
                className={`rounded-md border px-3 py-2 ${isTop ? 'border-accent bg-surface-2' : 'border-line bg-surface-1'}`}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`text-data font-semibold tabular w-4 text-center shrink-0 ${isTop ? 'text-accent' : 'text-ink-muted'}`}>
                    {i + 1}
                  </span>
                  <Monogram team={outP?.team_short_name} />
                  <span className="text-body text-ink-muted line-through">{m.out.name}</span>
                  <ArrowRight size={14} className="text-ink-muted shrink-0" aria-hidden />
                  <Monogram team={inP?.team_short_name} />
                  <span className="text-body font-semibold text-ink">{m.in.name}</span>
                  {inP && (
                    <span className="text-data text-ink-muted tabular">
                      £{(inP.now_cost / 10).toFixed(1)}m · {POS[m.out.elementType]}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1.5">
                    {!m.out.available && (
                      <Chip intent="negative" size="sm" title={m.reason}>forced</Chip>
                    )}
                    {m.hit && <Chip intent="warning" size="sm">-4 hit</Chip>}
                    <span className={`text-body font-semibold tabular ${m.gain > 0 ? 'text-positive' : 'text-ink-muted'}`}>
                      +{m.gain.toFixed(1)}
                    </span>
                  </span>
                </div>
                {(ex.reasons.length > 0 || ex.risks.length > 0) && (
                  <div className="mt-1.5 flex flex-wrap gap-1 pl-6">
                    {ex.reasons.slice(0, 3).map((r) => (
                      <Chip key={r} intent="positive" size="sm">{r}</Chip>
                    ))}
                    {ex.risks.slice(0, 2).map((r) => (
                      <Chip key={r} intent="warning" size="sm">{r}</Chip>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {submittedId && !loading && advice && (
        <p className="mt-3 text-data text-ink-muted">
          {advice.nFreeUsed} free{advice.nHits > 0 ? ` + ${advice.nHits} hit` : ''} ·
          sell prices {myTeam?.picks ? 'from your account' : 'approximated by now_cost (sign in for exact)'} ·
          policy validated on 2025/26 (+136 pts vs hold).
        </p>
      )}
    </Card>
  )
}
