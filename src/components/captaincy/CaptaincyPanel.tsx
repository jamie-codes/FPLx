'use client'

import type { CaptaincyCandidate } from '@/lib/captaincy-engine'
import { MinsRiskBadge } from '@/components/shared/MinsRiskBadge'

interface CaptainTypeBadgeConfig {
  bg: string
  text: string
  label: string
  title: string
}

const TYPE_MAP: Record<'safe' | 'upside', CaptainTypeBadgeConfig> = {
  safe: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    label: 'Safe',
    title: 'Safe pick: nailed starter with consistent high floor',
  },
  upside: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
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
    <div className="rounded border border-zinc-200 p-4 space-y-3">
      <h2 className="text-base font-semibold text-zinc-900 mb-3">Captaincy Picks — GW {nextGw}</h2>
      <div className="space-y-2">
        {candidates.map((c, i) => (
          <div
            key={c.player.id}
            className="rounded border border-zinc-100 bg-zinc-50 px-3 py-2 flex items-center gap-3"
          >
            <span className="text-sm text-zinc-400 w-4 shrink-0">{i + 1}</span>
            <span className="text-sm font-medium text-zinc-900 flex-1">{c.player.web_name}</span>
            <span className="text-sm text-zinc-500">{c.player.team_short_name}</span>
            <span className="text-sm text-zinc-700 whitespace-nowrap">
              {c.projected_captain_pts.toFixed(1)} pts (C)
            </span>
            <CaptainTypeBadge type={c.captain_type} />
            <MinsRiskBadge minsRisk={c.player.mins_risk} />
          </div>
        ))}
      </div>
    </div>
  )
}
