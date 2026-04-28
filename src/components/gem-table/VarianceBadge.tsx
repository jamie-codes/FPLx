// Phase 28 XPTS-02 D-07/D-08 — inline variance badge for xPts cells.
// Mirrors src/components/shared/MinsRiskBadge.tsx envelope (text-xs font-normal rounded px-2 py-1).
// Native `title` tooltip is the project pattern (no Radix / no custom Tooltip primitive).

export function VarianceBadge({ ceiling }: { ceiling: boolean | undefined }) {
  if (ceiling === undefined || ceiling === null) return null
  if (ceiling) {
    return (
      <span
        className="ml-1 inline-block text-xs font-normal rounded px-2 py-1 bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200"
        title="High ceiling: this player's points are highly variable (top-tercile σ across all players). Good captain pick when chasing rank in a mini-league."
      >
        ⬆
      </span>
    )
  }
  return (
    <span
      className="ml-1 inline-block text-xs font-normal rounded px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
      title="Consistent: this player's points are stable GW-to-GW (below top-tercile σ). Safe floor pick when protecting rank."
    >
      =
    </span>
  )
}
