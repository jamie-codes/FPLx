import { createColumnHelper } from '@tanstack/react-table'
import type { ScoredPlayer } from '@/lib/types'
import { FixtureBadges } from '@/components/fixtures/FixtureBadges'
import { MinsRiskBadge } from '@/components/shared/MinsRiskBadge'

const col = createColumnHelper<ScoredPlayer>()

// Position code to label map
const POS_LABEL: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

// Format score as 0-100 integer for display
const fmtScore = (v: number) => (v * 100).toFixed(0)
const fmtScoreNull = (v: number | null) => (v === null ? '\u2014' : (v * 100).toFixed(0))
const fmtDec2 = (v: number | null) => (v === null ? '\u2014' : v.toFixed(2))

// Column header with hover tooltip
const H = (label: string, tip: string) => () => <span title={tip} className="cursor-help">{label}</span>

export const columns = [
  col.accessor('web_name', { header: 'Player', enableSorting: true }),
  col.accessor('team_short_name', { header: 'Team', enableSorting: false }),
  col.accessor('element_type', {
    header: H('Pos', 'Position: GK / DEF / MID / FWD'),
    filterFn: 'equals',
    enableSorting: false,
    cell: (info) => POS_LABEL[info.getValue()] ?? '?',
  }),
  col.accessor('now_cost', {
    header: H('Price', 'Current FPL price (£m)'),
    cell: (info) => `${(info.getValue() / 10).toFixed(1)}`,
  }),
  col.accessor('gem_score', {
    header: H('Gem', 'Composite Gem score (0–100): weighted blend of FDR, form, xG/90, xA/90, differential ownership, minutes reliability, and set-piece role'),
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('fdr_score', {
    header: H('FDR', 'Fixture Difficulty Rating score (0–100): higher = easier upcoming fixtures'),
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('form_score', {
    header: H('Form', 'Form score (0–100): normalised points-per-90 over the last 5 gameweeks'),
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('xg_per90', {
    header: H('xG/90', 'Expected goals per 90 minutes (Understat). Blank = no Understat data (promoted-team or new players)'),
    cell: (info) => fmtDec2(info.getValue()),
  }),
  col.accessor('xa_per90', {
    header: H('xA/90', 'Expected assists per 90 minutes (Understat). Blank = no Understat data (promoted-team or new players)'),
    cell: (info) => fmtDec2(info.getValue()),
  }),
  col.accessor('xg_score', {
    header: H('xG Sc', 'xG score (0–100): normalised xG/90 relative to all players. Blank = no Understat data'),
    cell: (info) => fmtScoreNull(info.getValue()),
  }),
  col.accessor('xa_score', {
    header: H('xA Sc', 'xA score (0–100): normalised xA/90 relative to all players. Blank = no Understat data'),
    cell: (info) => fmtScoreNull(info.getValue()),
  }),
  col.accessor('ownership_score', {
    header: H('Own', 'Differential score (0–100): higher = less owned = more differential value'),
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('minutes_score', {
    header: H('Min', 'Minutes reliability score (0–100): based on expected minutes per GW'),
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('set_piece_score', {
    header: H('SP', 'Set piece score (0–100): accounts for penalty, free-kick, and corner taker roles'),
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('selected_by_percent', {
    header: H('Own%', 'FPL ownership percentage — how many managers own this player'),
  }),
  col.accessor('status', {
    header: H('Status', 'Player availability: blank = available, D = doubtful, I = injured, S = suspended, N = unavailable'),
    enableSorting: false,
    cell: (info) => info.getValue() === 'a' ? '' : info.getValue().toUpperCase(),
  }),
  col.display({
    id: 'mins_risk',
    header: H('Risk', 'Minutes risk: Nailed (>85% start prob) · Likely (65–85%) · Rotation (40–65%) · Bench risk (<40%)'),
    enableSorting: false,
    cell: ({ row }) => <MinsRiskBadge minsRisk={row.original.mins_risk} />,
  }),
  col.accessor('proj_pts_1gw', {
    header: H('Proj Pts', 'Projected FPL points next gameweek (FPL expected points × availability). Blank GW or no fixture = 0'),
    cell: (info) => (info.getValue() ?? 0).toFixed(1),
    enableSorting: true,
  }),
  col.accessor('proj_pts_3gw', {
    header: H('Proj Pts (3)', 'Projected FPL points across next 3 gameweeks (points-per-game × start probability, DGW-aware)'),
    cell: (info) => (info.getValue() ?? 0).toFixed(1),
    enableSorting: true,
  }),
  col.accessor('proj_pts_5gw', {
    header: H('Proj Pts (5)', 'Projected FPL points across next 5 gameweeks (points-per-game × start probability, DGW-aware)'),
    cell: (info) => (info.getValue() ?? 0).toFixed(1),
    enableSorting: true,
  }),
  col.display({
    id: 'trend',
    header: H('Trend', 'Price trend: this GW change (↑/↓) and season-to-date change'),
    cell: ({ row }) => {
      const ev = row.original.cost_change_event ?? 0
      const st = row.original.cost_change_start ?? 0
      const seasonAmt = (Math.abs(st) / 10).toFixed(1)
      const seasonSign = st > 0 ? '+' : st < 0 ? '-' : ''
      const seasonText = st !== 0 ? `${seasonSign}${seasonAmt}m season` : ''

      if (ev > 0) return (
        <div>
          <span className="text-green-600">↑ {(ev / 10).toFixed(1)}m</span>
          {seasonText && <span className="block text-[10px] text-zinc-400">{seasonText}</span>}
        </div>
      )
      if (ev < 0) return (
        <div>
          <span className="text-red-600">↓ {(Math.abs(ev) / 10).toFixed(1)}m</span>
          {seasonText && <span className="block text-[10px] text-zinc-400">{seasonText}</span>}
        </div>
      )
      return (
        <div>
          <span className="text-zinc-400">—</span>
          {seasonText && <span className="block text-[10px] text-zinc-400">{seasonText}</span>}
        </div>
      )
    },
  }),
  col.display({
    id: 'fixtures',
    header: 'Next 5',
    cell: ({ row }) => <FixtureBadges fixtures={row.original.fixtures.slice(0, 5)} />,
    enableSorting: false,
  }),
]
