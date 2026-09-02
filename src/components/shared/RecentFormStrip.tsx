// LAST5-01: a player's last five appearances, one chip per match.
//
// pts_last5gw already existed, but a sum is not a form read: 4/4/4/4/4 and
// 0/0/0/0/20 both total 20 and they are not the same player to own. The strip
// shows the shape, plus who it was against and whether they actually played —
// a blank away at a top side reads very differently from a blank at home.
import type { RecentGw } from '@/lib/types'

/** Points buckets. A haul earns the strongest treatment, a blank the softest;
 *  a match the player did not appear in is greyed out rather than shown as a
 *  zero return, because it isn't one. */
function toneFor(g: RecentGw): string {
  if (g.min === 0) return 'bg-surface-2 text-ink-muted'
  if (g.pts >= 10) return 'bg-positive-soft text-positive ring-1 ring-positive'
  if (g.pts >= 6) return 'bg-positive-soft text-positive'
  if (g.pts >= 3) return 'bg-surface-2 text-ink'
  return 'bg-negative-soft text-negative'
}

function labelFor(g: RecentGw): string {
  const opp = g.opp ?? '?'
  const venue = g.home === null ? '' : g.home ? ' (H)' : ' (A)'
  const played = g.min === 0 ? 'did not play' : `${g.min} mins`
  return `GW${g.gw} v ${opp}${venue} — ${g.pts} pts, ${played}`
}

export function RecentFormStrip({ recentGws }: { recentGws?: RecentGw[] | null }) {
  // No history at all (pre-season, a new signing, an artifact written before
  // this field shipped) — say so rather than render an empty row.
  if (!recentGws || recentGws.length === 0) {
    return <span className="text-xs text-ink-muted italic">No games yet</span>
  }

  return (
    <div className="flex flex-wrap gap-1" data-testid="recent-form-strip">
      {recentGws.map((g, i) => (
        <span
          key={`${g.gw}-${i}`}
          title={labelFor(g)}
          className={`flex min-w-[2.4rem] flex-col items-center rounded px-1 py-0.5 leading-tight ${toneFor(g)}`}
        >
          <span className="text-xs font-semibold tabular-nums">{g.pts}</span>
          {/* FPL fixture-list convention: opponent uppercase at home,
              lowercase away. The title attribute spells it out. */}
          <span className="text-[0.6rem] opacity-80">
            {g.home === false ? (g.opp ?? '?').toLowerCase() : (g.opp ?? '?')}
          </span>
        </span>
      ))}
    </div>
  )
}
