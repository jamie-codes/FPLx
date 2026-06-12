import type { FPLElementRaw } from '@/lib/fpl-adapter'
import type { FPLTeam } from '@/lib/types'

interface PlayerCardProps {
  player: FPLElementRaw
  points: number
  team: FPLTeam
  isCapt: boolean
}

// FPL CDN shirt URLs — same source as the official FPL game pitch view.
// Outfield: shirt_{team.code}-66.png  GK: shirt_{team.code}_1-66.png
function shirtUrl(teamCode: number, isGk: boolean): string {
  return isGk
    ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}_1-66.png`
    : `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}-66.png`
}

export function PlayerCard({ player, points, team, isCapt }: PlayerCardProps) {
  const priceLabel = `£${(player.now_cost / 10).toFixed(1)}m`
  const isGk = player.element_type === 1
  const shirt = shirtUrl(team.code, isGk)

  // UIX-04: card chrome tokenized (captaincy yellow → warning, per the LineupTab
  // captain-badge precedent; points blue → accent). The green pitch behind the
  // cards is the sanctioned exception — see PerfectGWPitch.tsx.
  return (
    <div className="relative flex flex-col items-center">
      {isCapt && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-warning text-surface-1 text-[9px] font-bold px-1.5 py-0.5 rounded z-10">
          CAPT
        </span>
      )}
      <div
        className={`relative rounded px-2 py-1.5 text-center min-w-[68px] bg-surface-1 ${
          isCapt
            ? 'border-2 border-warning'
            : 'border border-line'
        }`}
      >
        {/* Club shirt — FPL CDN, 33×45px matches the standard -66 sprite */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shirt}
          alt={`${team.short_name} kit`}
          width={33}
          height={45}
          className="mx-auto mb-1 object-contain"
        />
        <div className="flex items-center justify-between mb-0.5">
          <span className="bg-surface-2 text-ink-muted text-[9px] font-bold px-1 rounded">
            {team.short_name}
          </span>
          <span className="text-ink-muted text-[9px]">{priceLabel}</span>
        </div>
        <p className={`text-xs font-semibold truncate max-w-[64px] ${isCapt ? 'text-warning' : 'text-ink'}`}>
          {player.web_name}
        </p>
        <p className={`text-sm font-bold mt-0.5 ${isCapt ? 'text-warning' : 'text-accent'}`}>
          {points}
        </p>
      </div>
    </div>
  )
}
