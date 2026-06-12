// Phase 28 XPTS-02 D-07/D-08 — inline variance badge for xPts cells.
// UIX-03: thin wrapper delegating to the Chip primitive per the badge policy
// (⬆ ceiling → violet, = consistent → neutral). Call sites stay stable.
// Native `title` tooltip is the project pattern (no Radix / no custom Tooltip primitive).
import { Chip } from '@/components/ui/Chip'

export function VarianceBadge({ ceiling }: { ceiling: boolean | undefined }) {
  if (ceiling === undefined || ceiling === null) return null
  if (ceiling) {
    return (
      <span className="ml-1">
        <Chip
          intent="violet"
          size="sm"
          title="High ceiling: this player's points are highly variable (top-tercile σ across all players). Good captain pick when chasing rank in a mini-league."
        >
          ⬆
        </Chip>
      </span>
    )
  }
  return (
    <span className="ml-1">
      <Chip
        intent="neutral"
        size="sm"
        title="Consistent: this player's points are stable GW-to-GW (below top-tercile σ). Safe floor pick when protecting rank."
      >
        =
      </Chip>
    </span>
  )
}
