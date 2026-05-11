'use client'

import { aggregateSetPieceLeague, formatScore } from '@/lib/setPieceLeague'
import { useTeamBadge } from '@/lib/hooks/useTeamBadge'
import type { SetPieceChanges } from '@/lib/types'

interface SetPieceLeagueTableProps {
  changes: SetPieceChanges
}

function TeamCrest({ shortName, size = 20 }: { shortName: string; size?: number }) {
  const { src, onError, showFallback, fallbackColour, initial } = useTeamBadge(shortName)
  if (showFallback || !src) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center rounded text-[10px] font-semibold text-white"
        style={{ width: size, height: size, backgroundColor: fallbackColour }}
      >
        {initial}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" aria-hidden="true" width={size} height={size} className="object-contain" onError={onError} />
  )
}

export function SetPieceLeagueTable({ changes }: SetPieceLeagueTableProps) {
  const { ranked, insufficient } = aggregateSetPieceLeague(changes)

  return (
    <div className="space-y-6">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-zinc-500 dark:text-zinc-400 text-right pr-2 w-8 py-2 text-xs sm:text-sm font-semibold border-b border-zinc-200 dark:border-zinc-700">
              #
            </th>
            <th className="text-left py-2 text-xs sm:text-sm font-semibold border-b border-zinc-200 dark:border-zinc-700">
              Team
            </th>
            <th
              className="text-right pr-2 sm:pr-4 py-2 text-xs sm:text-sm font-semibold border-b border-zinc-200 dark:border-zinc-700"
              title="Composite delivery quality — mean of available corner and free-kick danger scores, per 100 deliveries"
            >
              Score
            </th>
            <th className="text-right pr-2 sm:pr-4 py-2 text-xs sm:text-sm font-semibold border-b border-zinc-200 dark:border-zinc-700 hidden sm:table-cell">
              Corner
            </th>
            <th className="text-right pr-2 sm:pr-4 py-2 text-xs sm:text-sm font-semibold border-b border-zinc-200 dark:border-zinc-700 hidden sm:table-cell">
              FK
            </th>
            <th
              className="text-right py-2 text-xs sm:text-sm font-semibold border-b border-zinc-200 dark:border-zinc-700 hidden md:table-cell"
              title="Combined corner + FK delivery sample (shots assisted by this team's primary set-piece takers)"
            >
              n
            </th>
            <th className="text-left pl-2 py-2 text-xs sm:text-sm font-semibold border-b border-zinc-200 dark:border-zinc-700 hidden lg:table-cell">
              Corner taker
            </th>
          </tr>
        </thead>
        <tbody>
          {ranked.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="text-center text-zinc-500 dark:text-zinc-400 py-4 text-sm"
              >
                No teams have sufficient set-piece delivery data yet. Check back after more gameweeks.
              </td>
            </tr>
          ) : (
            ranked.map((row, i) => (
              <tr key={row.team_id} className="border-b border-zinc-200 dark:border-zinc-700">
                <td className="text-right pr-2 py-2 text-zinc-500 dark:text-zinc-400 tabular-nums text-xs">
                  {i + 1}
                </td>
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <TeamCrest shortName={row.team_short_name} size={20} />
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">{row.team_short_name}</span>
                  </span>
                </td>
                <td className="text-right tabular-nums pr-2 sm:pr-4 py-2">
                  {formatScore(row.composite)}
                </td>
                <td className="text-right tabular-nums pr-2 sm:pr-4 py-2 hidden sm:table-cell">
                  {formatScore(row.corner_score)}
                </td>
                <td className="text-right tabular-nums pr-2 sm:pr-4 py-2 hidden sm:table-cell">
                  {formatScore(row.fk_score)}
                </td>
                <td className="text-right text-zinc-500 dark:text-zinc-400 text-xs tabular-nums py-2 hidden md:table-cell">
                  {row.sample_n > 0 ? row.sample_n : '—'}
                </td>
                <td className="text-zinc-700 dark:text-zinc-300 truncate max-w-[10rem] pl-2 py-2 hidden lg:table-cell">
                  {row.primary_taker_name}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {insufficient.length > 0 && (
        <section className="rounded bg-zinc-50 dark:bg-zinc-900/50 p-4">
          <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Insufficient Data</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            Teams without enough corner and free-kick deliveries to score yet. Will appear above once enough deliveries have accumulated.
          </p>
          <ul className="space-y-1 text-sm">
            {insufficient.map((row) => (
              <li key={row.team_id} className="flex items-center gap-2">
                <TeamCrest shortName={row.team_short_name} size={20} />
                <span className="font-mono text-zinc-700 dark:text-zinc-300">{row.team_short_name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
