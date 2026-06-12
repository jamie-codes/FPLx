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

  // Rest of eligible players: apply search filter and sort by xPts_1gw desc
  const otherPlayers = eligiblePlayers
    .filter(p => p.id !== suggestedPlayerId)
    .filter(p =>
      search.trim() === '' || p.web_name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (b.xPts_1gw ?? 0) - (a.xPts_1gw ?? 0))

  const handlePick = (playerId: number) => {
    onPick(playerId)
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      className="rounded-lg bg-surface-1 p-4 max-w-md w-full max-h-[70vh] flex flex-col border border-line shadow-lg backdrop:bg-ink/40"
    >
      <div className="flex flex-col flex-1 min-h-0 gap-3">
        {/* Heading */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">
            {positionLabel} — Select Player
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-ink-muted hover:text-ink cursor-pointer active:scale-95 transition-transform"
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
          className="w-full px-3 py-2 text-sm border border-line rounded-md min-h-[44px] bg-surface-1 text-ink"
          style={{ fontSize: '16px' }}
        />

        {/* Player list */}
        <div className="overflow-y-auto flex-1 divide-y divide-line">
          {/* Suggested player pinned at top */}
          {suggestedPlayer !== null && (
            <button
              type="button"
              key={`suggested-${suggestedPlayer.id}`}
              onClick={() => handlePick(suggestedPlayer.id)}
              className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 bg-violet-soft hover:bg-violet/20 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium text-violet shrink-0">
                  Suggested
                </span>
                <span className="text-sm font-medium text-ink truncate">
                  {suggestedPlayer.web_name}
                </span>
                <span className="text-xs text-ink-muted shrink-0">
                  {suggestedPlayer.team_short_name}
                </span>
              </div>
              <span className="text-sm font-medium text-ink shrink-0">
                {(suggestedPlayer.xPts_1gw ?? 0).toFixed(1)} pts
              </span>
            </button>
          )}

          {/* Remaining players sorted by xPts_1gw */}
          {otherPlayers.map(player => (
            <button
              type="button"
              key={player.id}
              onClick={() => handlePick(player.id)}
              className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-surface-2 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm text-ink truncate">
                  {player.web_name}
                </span>
                <span className="text-xs text-ink-muted shrink-0">
                  {player.team_short_name}
                </span>
              </div>
              <span className="text-sm text-ink shrink-0">
                {(player.xPts_1gw ?? 0).toFixed(1)} pts
              </span>
            </button>
          ))}

          {/* Empty state */}
          {suggestedPlayer === null && otherPlayers.length === 0 && (
            <p className="px-3 py-4 text-sm text-ink-muted text-center">
              No players found
            </p>
          )}
        </div>
      </div>
    </dialog>
  )
}
