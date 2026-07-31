'use client'

// Redesign Phase 3 (Cockpit card 3): compact captaincy — top-3 by xPts via the
// shared EO-candidate engine (max_xpts mode), each with next fixture, an xPts
// bar, and haul probability. Top pick ringed in accent. The full multi-mode
// ranking lives in CaptainPicksPanel; this is the at-a-glance version.
import { useMemo } from 'react'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { computeEOCandidates } from '@/lib/eo-candidates'
import { getTeamColour } from '@/lib/team-colours'

export function CockpitCaptaincyCard() {
  const { data: players } = usePlayers()
  const candidates = useMemo(
    () => (players?.length ? computeEOCandidates(players, 'max_xpts', 3) : []),
    [players],
  )
  if (candidates.length === 0) return null
  const maxXpts = candidates[0].xPts_1gw || 1

  return (
    <section className="bg-surface-1 border border-line rounded-lg">
      <header className="flex items-center justify-between px-4 pt-4">
        <h3 className="text-h4 font-semibold text-ink">Captaincy</h3>
        <span className="text-data text-ink-muted">haul = 10+ pts</span>
      </header>
      <ul className="p-4 space-y-1.5">
        {candidates.map((c, i) => {
          const col = getTeamColour(c.team_short_name)
          const fx = c.fixtures?.length ? [...c.fixtures].sort((a, b) => a.event_id - b.event_id)[0] : undefined
          const opp = fx ? `${fx.is_home ? 'vs' : 'at'} ${fx.opponent_team} (${fx.is_home ? 'H' : 'A'})` : ''
          const haul = c.haul_prob != null ? Math.round(c.haul_prob * 100) : null
          const barPct = Math.max(0, Math.min(100, (c.xPts_1gw / maxXpts) * 100))
          return (
            <li
              key={c.id}
              className={`flex items-center gap-3 rounded-md px-2 py-1.5 border ${i === 0 ? 'border-accent bg-surface-2' : 'border-transparent'}`}
            >
              <span
                className="text-[10px] font-semibold w-9 text-center px-1 py-0.5 rounded-full shrink-0 tabular"
                style={{ background: col.primary, color: col.text }}>
                {c.team_short_name}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-body font-semibold text-ink truncate">{c.web_name}</span>
                  <span className="text-data text-ink-muted truncate">{opp}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1 flex-1 rounded bg-surface-2 overflow-hidden">
                    <div className="h-full bg-accent rounded" style={{ width: `${barPct}%` }} />
                  </div>
                  {haul != null && <span className="text-data text-ink-muted tabular shrink-0">haul {haul}%</span>}
                </div>
              </div>
              <span className="text-h3 font-semibold text-ink tabular shrink-0">{c.xPts_1gw.toFixed(1)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
