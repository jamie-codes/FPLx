'use client'
// UIX-02: Home command centre — a thin composition layer over existing pure
// engines (spec anti-goal: NO new computation, no tables, no prose; one
// headline per concern, then route). Orchestrates hooks + useMemo engine calls
// and switches between the three designed states:
//   1. no FPL ID  — header + connect card + pool-fallback captain + Picks link
//   2. loaded     — header Stats, squad strip, three action cards, risk chip
//   3. off-season — quiet hero (deadline null OR isOffSeason) + optional strip
import { useMemo } from 'react'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useSquad } from '@/lib/hooks/useSquad'
import { useClubForm } from '@/lib/hooks/useClubForm'
import { useNextDeadline } from '@/lib/hooks/useNextDeadline'
import { computeAllGemScores } from '@/lib/gem-score'
import { computeVerdicts } from '@/lib/recommend'
import { computeLifecycleLabels, type LifecycleLabel } from '@/lib/lifecycle-label'
import { computeCaptaincyCandidates, type CaptaincyCandidate } from '@/lib/captaincy-engine'
import { suggestTransfers } from '@/lib/suggest-transfers'
import { computeOpportunityCostRows } from '@/lib/opportunity-cost'
import { optimiseLineup } from '@/lib/optimise-lineup'
import { isOffSeason } from '@/lib/picks'
import { computeUrgency, formatCountdown } from '@/components/DeadlineBanner'
import type { ClubForm, MergedPlayer } from '@/lib/types'
import type { ToolId } from '@/lib/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Stat, type StatIntent } from '@/components/ui/Stat'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { SquadStrip, type SquadRow } from './SquadStrip'
import { ActionCards } from './ActionCards'
import { badgeFor, riskCount, formatBank, transferHeadline, xiProjectedPts } from './home-logic'

const URGENCY_INTENT: Record<ReturnType<typeof computeUrgency>, StatIntent> = {
  neutral: 'neutral',
  amber: 'warning',
  red: 'negative',
}

interface HomeTabProps {
  teamId: string
  onTeamIdChange: (id: string) => void
  submittedId: string | null
  onSubmit: () => void
  selectTool: (tool: ToolId) => void
}

export function HomeTab({ teamId, onTeamIdChange, submittedId, onSubmit, selectTool }: HomeTabProps) {
  // ---- Hooks (all cache-warm — TopBar/other tabs share these queryKeys) ----
  const { data: playersData, isLoading: playersLoading } = usePlayers()
  const { data: deadline } = useNextDeadline()
  const { data: clubFormData } = useClubForm()
  // useSquad error → squadData stays undefined → strip/cards omit silently (spec:
  // the squad endpoint may 404 off-season; no error banner on Home).
  const { data: squadData, isLoading: squadLoading } = useSquad(submittedId)

  // ---- Engine derivations (pure, memoised — composition only) ----
  const scored = useMemo(() => computeAllGemScores(playersData ?? []), [playersData])

  const clubFormMap = useMemo<Map<number, ClubForm>>(
    () => new Map((clubFormData ?? []).map((cf) => [cf.team_id, cf])),
    [clubFormData],
  )

  const verdicts = useMemo(
    () => (squadData && scored.length > 0 ? computeVerdicts(squadData.picks, scored) : new Map()),
    [squadData, scored],
  )

  const labels = useMemo<Map<number, LifecycleLabel>>(
    () =>
      squadData && scored.length > 0
        ? computeLifecycleLabels(squadData.picks, scored, clubFormMap)
        : new Map(),
    [squadData, scored, clubFormMap],
  )

  // optimiseLineup returns null with <11 eligible starters (BGW / off-season) — guarded below.
  const lineup = useMemo(
    () => (squadData && scored.length > 0 ? optimiseLineup(squadData.picks, scored, 1) : null),
    [squadData, scored],
  )

  // Transfer headline: horizon 1 / ftCount 1 pinned (Decision pins the same; auth
  // FT detection and exact sell prices are Transfers-tab depth, not Home's).
  const suggestions = useMemo(
    () =>
      squadData && scored.length > 0
        ? suggestTransfers({
            currentPicks: squadData.picks,
            players: scored,
            horizon: 1,
            ftCount: 1,
            bank: squadData.entry_history.bank,
          })
        : [],
    [squadData, scored],
  )

  const transfer = useMemo(() => {
    if (!squadData) return undefined
    const rows = computeOpportunityCostRows(suggestions, 1, squadData.entry_history.bank)
    return transferHeadline(rows) ?? undefined
  }, [suggestions, squadData])

  // Captaincy — squad-aware preferred; pool fallback mirrors DecisionSummaryTab
  // (WDS-04 / CONTEXT.md D-16): top outfield by ceiling (xPts_90th_1gw ?? xPts_1gw) — VAR-01.
  const captainCandidate = useMemo<CaptaincyCandidate | undefined>(() => {
    if (scored.length === 0) return undefined
    if (squadData) return computeCaptaincyCandidates(squadData.picks, scored, 5)[0]
    const top = scored
      .filter((p) => (p.xPts_1gw ?? 0) > 0 && p.element_type !== 1)
      .sort((a, b) => (b.xPts_90th_1gw ?? b.xPts_1gw ?? 0) - (a.xPts_90th_1gw ?? a.xPts_1gw ?? 0))[0]
    if (!top) return undefined
    return {
      player: top,
      projected_captain_pts: (top.xPts_1gw ?? 0) * 2,
      ceiling_pts: top.xPts_90th_1gw ?? (top.xPts_1gw ?? 0),
      captain_type: top.mins_risk === 'nailed' ? 'safe' : 'upside',
    }
  }, [squadData, scored])

  const { xiRows, bench } = useMemo(() => {
    const xi: SquadRow[] = []
    const benchPlayers: MergedPlayer[] = []
    if (!squadData || scored.length === 0) return { xiRows: xi, bench: benchPlayers }
    const byId = new Map(scored.map((p) => [p.id, p]))
    for (const pick of [...squadData.picks].sort((a, b) => a.position - b.position)) {
      const player = byId.get(pick.element)
      if (!player) continue
      if (pick.position <= 11) {
        xi.push({
          player,
          badge: badgeFor(verdicts.get(pick.element), labels.get(pick.element)),
          isCaptain: lineup?.captainId === pick.element,
        })
      } else {
        benchPlayers.push(player)
      }
    }
    return { xiRows: xi, bench: benchPlayers }
  }, [squadData, scored, verdicts, labels, lineup])

  const riskN = useMemo(() => riskCount(labels), [labels])

  // ---- Loading (players, or squad with an ID submitted) ----
  if (playersLoading || (!!submittedId && squadLoading)) {
    return (
      <div className="space-y-4" data-testid="home-loading">
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="h-[28rem]" />
        <Skeleton className="h-36" />
      </div>
    )
  }

  // ---- State 3: off-season (deadline explicitly null OR every xPts <= 0) ----
  const offSeason =
    deadline === null || (playersData != null && playersData.length > 0 && isOffSeason(playersData))
  if (offSeason) {
    return (
      <div className="space-y-4" data-testid="home-offseason">
        <Card>
          <EmptyState
            title="The 2026/27 season hasn't started"
            hint="Deadlines, transfers and lineup calls return with GW1. The research suite is live all summer."
          />
          <div className="flex flex-wrap items-center justify-center gap-3 pb-6">
            <Button variant="primary" onClick={() => selectTool('picks')}>
              Weekly Picks
            </Button>
            <Button variant="secondary" onClick={() => selectTool('gems')}>
              Research
            </Button>
          </div>
        </Card>
        {/* Squad strip still renders when the squad API has data; omitted silently otherwise. */}
        <SquadStrip xi={xiRows} bench={bench} />
      </div>
    )
  }

  // ---- Header stats (shared by states 1 and 2) ----
  const deadlineMs = deadline ? new Date(deadline.deadline_time).getTime() - Date.now() : NaN
  const countdown = Number.isFinite(deadlineMs) && deadlineMs > 0 ? formatCountdown(deadlineMs) : null
  const header = (
    <div className="flex flex-wrap items-start gap-x-10 gap-y-3" data-testid="home-header">
      {deadline && <Stat label="Gameweek" value={`GW ${deadline.id}`} />}
      {deadline && countdown && (
        <Stat label="Deadline" value={countdown} intent={URGENCY_INTENT[computeUrgency(deadlineMs)]} />
      )}
      {squadData && (
        <Stat
          label="Bank"
          value={formatBank(squadData.entry_history.bank)}
          sub={`${squadData.entry_history.event_transfers} FT used`}
        />
      )}
    </div>
  )

  // ---- State 1: no squad (no ID submitted, or squad fetch failed silently) ----
  if (!squadData) {
    return (
      <div className="space-y-4" data-testid="home-connect">
        {header}
        <Card
          title="Connect your FPL team"
          subtitle="Paste your team ID to light up squad verdicts, a transfer headline and your best lineup.">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onSubmit()
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="home-team-id" className="sr-only">
              FPL Team ID
            </label>
            <input
              id="home-team-id"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={teamId}
              onChange={(e) => onTeamIdChange(e.target.value)}
              placeholder="e.g. 1234567"
              className="min-h-[44px] w-full rounded-md border border-line bg-surface-1 px-3 text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent sm:w-44"
            />
            <Button variant="primary" type="submit">
              Load Squad
            </Button>
          </form>
          <div className="-ml-3 mt-2">
            <Button variant="ghost" size="sm" onClick={() => selectTool('picks')}>
              → Weekly Picks
            </Button>
          </div>
        </Card>
        <ActionCards
          captain={
            captainCandidate
              ? {
                  name: captainCandidate.player.web_name,
                  team: captainCandidate.player.team_short_name ?? String(captainCandidate.player.team),
                  projectedPts: captainCandidate.projected_captain_pts,
                  captainType: captainCandidate.captain_type,
                }
              : undefined
          }
          onGo={selectTool}
        />
      </div>
    )
  }

  // ---- State 2: squad loaded — the full command centre ----
  return (
    <div className="space-y-4" data-testid="home-tab">
      {header}
      <SquadStrip xi={xiRows} bench={bench} />
      <ActionCards
        captain={
          captainCandidate
            ? {
                name: captainCandidate.player.web_name,
                team: captainCandidate.player.team_short_name ?? String(captainCandidate.player.team),
                projectedPts: isNaN(captainCandidate.projected_captain_pts)
                  ? 0
                  : captainCandidate.projected_captain_pts,
                captainType: captainCandidate.captain_type,
              }
            : undefined
        }
        transfer={transfer}
        lineup={
          lineup
            ? {
                formation: lineup.formation,
                xiXpts: xiProjectedPts(lineup.starters, lineup.captainId, scored),
              }
            : undefined
        }
        onGo={selectTool}
      />
      {riskN > 0 && (
        <button
          type="button"
          data-testid="risk-flag-chip"
          onClick={() => selectTool('cockpit')}
          className="inline-flex min-h-[44px] items-center self-start"
          aria-label={`${riskN} player${riskN === 1 ? '' : 's'} flagged — open the Cockpit`}>
          <Chip intent="warning" size="md">
            {riskN} player{riskN === 1 ? '' : 's'} flagged → Cockpit
          </Chip>
        </button>
      )}
    </div>
  )
}
