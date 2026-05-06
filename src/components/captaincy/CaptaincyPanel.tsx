'use client'

import type { CaptaincyCandidate } from '@/lib/captaincy-engine'
import { MinsRiskBadge } from '@/components/shared/MinsRiskBadge'
import { PlayerAvatar } from '@/components/shared/PlayerAvatar'
import { TeamBadge } from '@/components/shared/TeamBadge'

interface CaptainTypeBadgeConfig {
  bg: string
  text: string
  label: string
  title: string
}

const TYPE_MAP: Record<'safe' | 'upside', CaptainTypeBadgeConfig> = {
  safe: {
    bg: 'bg-blue-100 dark:bg-blue-900',
    text: 'text-blue-800 dark:text-blue-200',
    label: 'Safe',
    title: 'Safe pick: nailed starter with consistent high floor',
  },
  upside: {
    bg: 'bg-amber-100 dark:bg-amber-900',
    text: 'text-amber-800 dark:text-amber-200',
    label: 'Upside',
    title: 'Upside pick: differential or high ceiling — higher variance',
  },
}

function CaptainTypeBadge({ type }: { type: 'safe' | 'upside' }) {
  const config = TYPE_MAP[type]
  return (
    <span
      className={`inline-block text-xs font-normal ${config.text} ${config.bg} rounded px-2 py-1`}
      title={config.title}
    >
      {config.label}
    </span>
  )
}

interface CaptaincyPanelProps {
  candidates: CaptaincyCandidate[]  // pre-sorted, top 5
  nextGw: number
}

export function CaptaincyPanel({ candidates, nextGw }: CaptaincyPanelProps) {
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Captaincy Picks — GW {nextGw}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-2">
        {candidates.map((c, i) => (
          <div
            key={c.player.id}
            className="rounded border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
          >
            {/* Rank + avatar + player name row */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400 w-4 shrink-0">{i + 1}</span>
              <PlayerAvatar code={c.player.code} webName={c.player.web_name} teamShortName={c.player.team_short_name} width={32} height={40} />
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 sm:flex-1">{c.player.web_name}</span>
            </div>
            {/* Team badge + fixture row */}
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-1">
                <TeamBadge shortName={c.player.team_short_name} size={14} />
                <span className="text-xs">{c.player.team_short_name}</span>
              </div>
              {c.player.fixtures.length > 0 && (() => {
                const nextGwId = c.player.fixtures[0].event_id
                const nextGwFixtures = c.player.fixtures.filter(f => f.event_id === nextGwId)
                return (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                    {nextGwFixtures.length >= 2 && <span className="font-semibold text-violet-700 dark:text-violet-400 mr-1">DGW</span>}
                    {nextGwFixtures.map((f, i) => (
                      <span key={i}>
                        {i > 0 && <span className="mx-0.5 text-zinc-400">/</span>}
                        {f.is_home ? 'vs' : '@'} {f.opponent_team}
                      </span>
                    ))}
                  </span>
                )
              })()}
            </div>
            {/* Projected pts */}
            <span className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
              {(isNaN(c.projected_captain_pts) ? 0 : c.projected_captain_pts).toFixed(1)} pts (C)
            </span>
            {/* Badges row */}
            <div className="flex items-center gap-1.5">
              <CaptainTypeBadge type={c.captain_type} />
              <MinsRiskBadge minsRisk={c.player.mins_risk} mins60Prob={c.player.mins_60_prob} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
