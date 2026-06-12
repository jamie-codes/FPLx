import { PlayerCard } from './PlayerCard'
import { BudgetBanner } from './BudgetBanner'
import type { PerfectXIResult } from '@/lib/perfect-gw/computePerfectXI'
import type { FPLElementRaw } from '@/lib/fpl-adapter'
import type { FPLTeam } from '@/lib/types'

interface PerfectGWPitchProps {
  result: PerfectXIResult
  teams: FPLTeam[]
  livePoints: Record<number, number>
}

/**
 * Parse a formation string "D-M-F" (e.g. "4-4-2") into slot counts.
 * Returns [defCount, midCount, fwdCount]. GK is always 1.
 */
function parseFormation(formation: string): [number, number, number] {
  const parts = formation.split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) {
    console.warn(`PerfectGWPitch: invalid formation string "${formation}", falling back to 4-4-2`)
    return [4, 4, 2]
  }
  return [parts[0], parts[1], parts[2]]
}

/**
 * Split the XI array (ordered [GK, ...DEFs, ...MIDs, ...FWDs]) into
 * row groups for rendering.
 */
function splitIntoRows(xi: FPLElementRaw[], formation: string): FPLElementRaw[][] {
  const [defCount, midCount, fwdCount] = parseFormation(formation)
  const gk   = xi.slice(0, 1)
  const defs = xi.slice(1, 1 + defCount)
  const mids = xi.slice(1 + defCount, 1 + defCount + midCount)
  const fwds = xi.slice(1 + defCount + midCount, 1 + defCount + midCount + fwdCount)
  // Render attack at top, keeper at bottom
  return [fwds, mids, defs, gk]
}

export function PerfectGWPitch({ result, teams, livePoints }: PerfectGWPitchProps) {
  const teamMap = new Map(teams.map(t => [t.id, t]))
  const rows = splitIntoRows(result.xi, result.formation)

  return (
    <div className="space-y-3">
      <BudgetBanner
        squadCost={result.squadCost}
        overBudget={result.overBudget}
        overBudgetBy={result.overBudgetBy}
      />

      {/* Pitch */}
      {/* UIX-04 sanctioned exception: representational pitch visual — the green
          gradient + white/20 line overlays depict a football pitch and stay
          theme-independent by design (spec ruling 2). */}
      <div className="relative rounded-lg overflow-hidden bg-gradient-to-b from-green-800 to-green-700 p-3">
        {/* Pitch markings */}
        <div className="absolute inset-3 border border-white/20 rounded pointer-events-none" />
        <div className="absolute left-3 right-3 top-1/2 border-t border-white/15 pointer-events-none" />

        <div className="relative space-y-3 py-2">
          {rows.map((rowPlayers, rowIdx) => (
            <div key={rowIdx} className="flex justify-center gap-2 flex-wrap">
              {rowPlayers.map(player => {
                const team = teamMap.get(player.team) ?? {
                  id: player.team, name: '?', short_name: '?', code: 0,
                }
                return (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    points={livePoints[player.id] ?? 0}
                    team={team}
                    isCapt={player.id === result.captain.id}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer: formation + total */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-ink-muted">
          {result.formation} · £{(result.squadCost / 10).toFixed(1)}m
        </span>
        <span className="text-lg font-bold text-ink">{result.totalPts}</span>
      </div>
    </div>
  )
}
