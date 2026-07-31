'use client'

// Redesign Phase 3 (Cockpit card 5): Gem watch — 4 tiles of the user's
// watchlisted gems (ranked by gem score), falling back to the top gems overall
// when the watchlist is empty. pickGemTiles is pure + unit-tested. Gem number
// matches the table's fmtScore ((score * 100).toFixed(0)); inlined here to avoid
// pulling the TanStack-heavy columns module into the cockpit chunk.
import { useMemo } from 'react'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { computeAllGemScores } from '@/lib/gem-score'
import { getTeamColour } from '@/lib/team-colours'
import type { ToolId } from '@/lib/navigation'

type ScoredPlayer = ReturnType<typeof computeAllGemScores>[number]

export function pickGemTiles(scored: ScoredPlayer[], watchlistIds: number[]): ScoredPlayer[] {
  const byGem = (a: ScoredPlayer, b: ScoredPlayer) => b.gem_score - a.gem_score
  const watchSet = new Set(watchlistIds)
  const watched = scored.filter((p) => watchSet.has(p.id)).sort(byGem)
  const pool = watched.length > 0 ? watched : [...scored].sort(byGem)
  return pool.slice(0, 4)
}

const fmtGem = (v: number) => (v * 100).toFixed(0)

export function GemWatchCard({ watchlistIds, selectTool }: {
  watchlistIds: number[]
  selectTool: (t: ToolId) => void
}) {
  const { data: players } = usePlayers()
  const tiles = useMemo(
    () => (players?.length ? pickGemTiles(computeAllGemScores(players), watchlistIds) : []),
    [players, watchlistIds],
  )
  if (tiles.length === 0) return null
  const fromWatchlist = watchlistIds.length > 0 && tiles.some((t) => watchlistIds.includes(t.id))

  return (
    <section className="bg-surface-1 border border-line rounded-lg">
      <header className="flex items-center justify-between px-4 pt-4">
        <h3 className="text-h4 font-semibold text-ink">{fromWatchlist ? 'Gem watch' : 'Top gems'}</h3>
        <button
          type="button"
          onClick={() => selectTool('gems')}
          className="text-data font-medium text-accent hover:underline">
          Open Gem Ratings →
        </button>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
        {tiles.map((p) => {
          const c = getTeamColour(p.team_short_name)
          return (
            <div key={p.id} className="rounded border border-line bg-surface-2 p-3 space-y-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 tabular"
                  style={{ background: c.primary, color: c.text }}>
                  {p.team_short_name}
                </span>
                <span className="font-semibold text-ink truncate text-body">{p.web_name}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-h3 font-semibold text-accent tabular">{fmtGem(p.gem_score)}</span>
                <span className="text-data text-ink-muted">gem</span>
              </div>
              <div className="text-data text-ink-muted tabular">
                £{(p.now_cost / 10).toFixed(1)}m · {p.selected_by_percent}% own
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
