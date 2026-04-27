'use client'

import { useSetPieces } from '@/lib/hooks/useSetPieces'
import type { SetPieceTaker } from '@/lib/types'
import { SetPieceChangeAlert } from './SetPieceChangeAlert'

function TakerRow({ label, taker }: { label: string; taker: SetPieceTaker }) {
  const name = taker.name || '\u2014'
  return (
    <p className="text-sm">
      {label}: {name}
      {taker.changed && (
        <span
          className="ml-2 text-xs font-normal rounded px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
          title="Taker order changed since last pipeline run"
        >
          Changed
        </span>
      )}
    </p>
  )
}

export function SetPieceTakerPanel() {
  const { data, isLoading, error } = useSetPieces()

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Set-Piece Takers</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Penalty, direct free kick, and corner takers per Premier League team. Sourced from FPL bootstrap-static.
        </p>
      </div>

      {isLoading && (
        <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">Loading set-piece data...</p>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 py-4">
          Failed to load set-piece data. Check the pipeline output and refresh.
        </p>
      )}

      {data && data.teams.length === 0 && (
        <div>
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No set-piece data</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Set-piece taker data is not yet available. Run the pipeline to populate this panel.
          </p>
        </div>
      )}

      {data && data.teams.length > 0 && (
        <>
          <SetPieceChangeAlert changeCount={data.change_count} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.teams.map((team) => (
              <div
                key={team.team_id}
                className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3"
              >
                <p className="text-sm font-semibold mb-1">{team.team_short_name}</p>
                <TakerRow label="Penalties" taker={team.penalty_taker} />
                <TakerRow label="Direct FK" taker={team.fk_taker} />
                <TakerRow label="Corners" taker={team.corner_taker} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
