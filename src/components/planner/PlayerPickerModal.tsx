'use client'

import { useRef, useEffect, useState } from 'react'
import type { ScoredPlayer } from '@/lib/types'

const POSITION_LABELS: Record<number, string> = {
  1: 'GK',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
}

interface PlayerPickerModalProps {
  open: boolean
  position: number              // element_type (1-4) for filtering
  squadIds: Set<number>          // exclude players already in squad
  suggestedPlayerId: number      // pinned at top, highlighted
  scoredPlayers: ScoredPlayer[]  // full player pool
  onPick: (playerId: number) => void
  onClose: () => void
}

export function PlayerPickerModal({
  open,
  position,
  squadIds,
  suggestedPlayerId,
  scoredPlayers,
  onPick,
  onClose,
}: PlayerPickerModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')

  // Control dialog open/close via showModal() / close()
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) {
      if (!el.open) el.showModal()
    } else {
      if (el.open) el.close()
    }
  }, [open])

  // Auto-focus search input when modal opens
  useEffect(() => {
    if (open) {
      // Small delay allows the dialog to become visible before focusing
      const timer = setTimeout(() => {
        searchRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Reset search when modal closes
  useEffect(() => {
    if (!open) {
      setSearch('')
    }
  }, [open])

  // Sync React state when dialog closes natively (Escape key)
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const handleClose = () => onClose()
    el.addEventListener('close', handleClose)
    return () => el.removeEventListener('close', handleClose)
  }, [onClose])

  // Backdrop click to dismiss
  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose()
  }

  // Build player lists
  const positionLabel = POSITION_LABELS[position] ?? 'Player'

  // All players of the right position, excluding current squad members
  const eligiblePlayers = scoredPlayers.filter(
    p => p.element_type === position && !squadIds.has(p.id)
  )

  // Suggested player (always pinned at top, ignores search filter)
  const suggestedPlayer = eligiblePlayers.find(p => p.id === suggestedPlayerId) ?? null

  // Rest of eligible players: apply search filter and sort by proj_pts_1gw desc
  const otherPlayers = eligiblePlayers
    .filter(p => p.id !== suggestedPlayerId)
    .filter(p =>
      search.trim() === '' || p.web_name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => b.proj_pts_1gw - a.proj_pts_1gw)

  const handlePick = (playerId: number) => {
    onPick(playerId)
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      className="rounded-lg bg-white dark:bg-zinc-900 p-4 max-w-md w-full max-h-[70vh] flex flex-col border border-zinc-200 dark:border-zinc-700 shadow-lg"
    >
      <div className="flex flex-col flex-1 min-h-0 gap-3">
        {/* Heading */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {positionLabel} — Select Player
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer active:scale-95 transition-transform"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Search input */}
        <input
          ref={searchRef}
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          style={{ fontSize: '16px' }}
        />

        {/* Player list */}
        <div className="overflow-y-auto flex-1 divide-y divide-zinc-100 dark:divide-zinc-800">
          {/* Suggested player pinned at top */}
          {suggestedPlayer !== null && (
            <button
              type="button"
              key={`suggested-${suggestedPlayer.id}`}
              onClick={() => handlePick(suggestedPlayer.id)}
              className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 bg-violet-50 dark:bg-violet-950/30 hover:bg-violet-100 dark:hover:bg-violet-900/40 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium text-violet-600 dark:text-violet-400 shrink-0">
                  Suggested
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {suggestedPlayer.web_name}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                  {suggestedPlayer.team_short_name}
                </span>
              </div>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 shrink-0">
                {suggestedPlayer.proj_pts_1gw.toFixed(1)} pts
              </span>
            </button>
          )}

          {/* Remaining players sorted by proj_pts_1gw */}
          {otherPlayers.map(player => (
            <button
              type="button"
              key={player.id}
              onClick={() => handlePick(player.id)}
              className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {player.web_name}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                  {player.team_short_name}
                </span>
              </div>
              <span className="text-sm text-zinc-700 dark:text-zinc-300 shrink-0">
                {player.proj_pts_1gw.toFixed(1)} pts
              </span>
            </button>
          ))}

          {/* Empty state */}
          {suggestedPlayer === null && otherPlayers.length === 0 && (
            <p className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400 text-center">
              No players found
            </p>
          )}
        </div>
      </div>
    </dialog>
  )
}
