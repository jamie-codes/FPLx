'use client'
// UIX-02: pure presentational squad strip — XI rows with ONE badge chip each
// (precedence already resolved by home-logic.badgeFor) + accent C on the
// optimised captain, bench as a muted mini-row. No hooks, no engines.
import type { MergedPlayer } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { PlayerCell } from '@/components/ui/PlayerCell'
import { formatBank, type PlayerBadge } from './home-logic'

const POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

export interface SquadRow {
  player: MergedPlayer
  badge: PlayerBadge
  isCaptain: boolean
}

export function SquadStrip({ xi, bench }: { xi: SquadRow[]; bench: MergedPlayer[] }) {
  if (xi.length === 0) return null
  return (
    <Card title="My Squad">
      <ul className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2" data-testid="squad-xi">
        {xi.map(({ player, badge, isCaptain }) => (
          <li
            key={player.id}
            data-testid={`squad-row-${player.id}`}
            className="flex items-center justify-between gap-3 border-b border-line py-1.5 last:border-0 md:[&:nth-last-child(2)]:border-0"
          >
            <PlayerCell
              code={player.code}
              webName={player.web_name}
              teamCode={player.team_code}
              teamShort={player.team_short_name}
              pos={POS[player.element_type]}
              price={formatBank(player.now_cost)}
            />
            <span className="flex shrink-0 items-center gap-1.5">
              {isCaptain && (
                <Chip intent="accent" size="sm" title="Optimised captain">
                  C
                </Chip>
              )}
              <Chip intent={badge.intent} size="sm">
                {badge.text}
              </Chip>
            </span>
          </li>
        ))}
      </ul>
      {bench.length > 0 && (
        <div
          className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3 opacity-70"
          data-testid="squad-bench"
        >
          <span className="text-data font-medium uppercase tracking-wide text-ink-muted">Bench</span>
          {bench.map((p) => (
            <PlayerCell
              key={p.id}
              size="sm"
              code={p.code}
              webName={p.web_name}
              teamCode={p.team_code}
              teamShort={p.team_short_name}
            />
          ))}
        </div>
      )}
    </Card>
  )
}
