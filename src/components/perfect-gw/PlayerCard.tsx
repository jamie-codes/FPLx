import type { FPLElementRaw } from '@/lib/fpl-adapter'
import type { FPLTeam } from '@/lib/types'

interface PlayerCardProps {
  player: FPLElementRaw
  points: number
  team: FPLTeam
  isCapt: boolean
}

export function PlayerCard({ player, points, team, isCapt }: PlayerCardProps) {
  const priceLabel = `£${(player.now_cost / 10).toFixed(1)}m`

  return (
    <div className="relative flex flex-col items-center">
      {isCapt && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-[9px] font-bold px-1.5 py-0.5 rounded z-10">
          CAPT
        </span>
      )}
      <div
        className={`relative rounded px-2 py-1.5 text-center min-w-[68px] bg-zinc-900 dark:bg-zinc-800 ${
          isCapt
            ? 'border-2 border-yellow-400'
            : 'border border-zinc-600 dark:border-zinc-500'
        }`}
      >
        <div className="flex items-center justify-between mb-0.5">
          <span className="bg-zinc-700 text-zinc-200 text-[9px] font-bold px-1 rounded">
            {team.short_name}
          </span>
          <span className="text-zinc-400 text-[9px]">{priceLabel}</span>
        </div>
        <p className={`text-xs font-semibold truncate max-w-[64px] ${isCapt ? 'text-yellow-300' : 'text-white'}`}>
          {player.web_name}
        </p>
        <p className={`text-sm font-bold mt-0.5 ${isCapt ? 'text-yellow-300' : 'text-blue-400'}`}>
          {points}
        </p>
      </div>
    </div>
  )
}
