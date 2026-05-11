'use client'

// Wave 0 stub — renders nothing. Real implementation in 095-02-PLAN.md (Wave 1).
import type { SetPieceChanges } from '@/lib/types'

interface SetPieceLeagueTableProps {
  changes: SetPieceChanges
}

export function SetPieceLeagueTable({ changes: _changes }: SetPieceLeagueTableProps) {
  return <div data-testid="set-piece-league-table-stub" />
}
