'use client'
// Phase 58 ML-02 (D-03, D-04, D-06): ranked rival summary table with selected-row highlight.
// Source: .planning/phases/058-mini-league-rival-tracker/058-UI-SPEC.md §Rival Summary Table Columns
import type { RivalEntry } from '@/lib/types'

interface RivalSummaryTableProps {
  rivals: RivalEntry[]
  selectedRivalId: number | null
  onSelect: (entryId: number) => void
  /** Map of FPL element ID → web_name. Used to render captain pick post-deadline. */
  playerNameById: Map<number, string>
}

const TH_CLS = 'text-left font-semibold text-zinc-600 dark:text-zinc-400 pb-1 border-b border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm'
const TD_CLS = 'py-2 text-sm'

function rankGapDisplay(gap: number): { text: string; cls: string } {
  // UI-SPEC sign convention: user ahead = positive (green); rival ahead = negative (red).
  // RivalEntry.rankGap = rival.rank - userRank → negative when user is BETTER ranked.
  // Flip sign for display so "+N green" reads "user ahead".
  const display = -gap
  if (display > 0) return { text: `+${display}`, cls: 'text-green-600 dark:text-green-400' }
  if (display < 0) return { text: `−${Math.abs(display)}`, cls: 'text-red-600 dark:text-red-400' }
  return { text: '0', cls: 'text-zinc-500 dark:text-zinc-400' }
}

export function RivalSummaryTable({
  rivals, selectedRivalId, onSelect, playerNameById,
}: RivalSummaryTableProps) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className={TH_CLS}>Rank</th>
          <th className={TH_CLS}>Manager Name</th>
          <th className={TH_CLS}>Rank Gap</th>
          <th className={`${TH_CLS} hidden sm:table-cell`}>Captain</th>
          <th className={`${TH_CLS} hidden sm:table-cell`}>Chips Remaining</th>
        </tr>
      </thead>
      <tbody>
        {rivals.map(r => {
          const isSelected = r.entryId === selectedRivalId
          const rowCls = isSelected
            ? 'cursor-pointer bg-zinc-100 dark:bg-zinc-800'
            : 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
          const captainName = r.captainPlayerId !== null
            ? (playerNameById.get(r.captainPlayerId) ?? '—')
            : '—'
          const chipsLabel = r.chipsRemaining.length === 0
            ? 'None remaining'
            : r.chipsRemaining.join(', ')
          const gap = rankGapDisplay(r.rankGap)
          return (
            <tr
              key={r.entryId}
              className={rowCls}
              onClick={() => onSelect(r.entryId)}
              data-testid={`rival-row-${r.entryId}`}
              aria-selected={isSelected}
            >
              <td className={TD_CLS}>{r.rank}</td>
              <td className={`${TD_CLS} truncate max-w-[12rem]`}>{r.playerName}</td>
              <td className={`${TD_CLS} ${gap.cls}`}>{gap.text}</td>
              <td className={`${TD_CLS} hidden sm:table-cell`}>{captainName}</td>
              <td className={`${TD_CLS} hidden sm:table-cell`}>{chipsLabel}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
