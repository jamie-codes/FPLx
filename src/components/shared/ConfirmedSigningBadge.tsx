// Phase 125 WIN-02: ConfirmedSigningBadge — inline positive-signal pill.
// Shown in GemTable expanded rows and OpportunityCostTable buy-cell cluster
// when a player has a confirmed_signing article in the transfer news feed.
//
// Sources of truth:
//   .planning/phases/125-summer-window-tracker/125-CONTEXT.md §D-10..D-16
//
// UIX-03 badge policy: → Chip positive. Rendered as a Chip-equivalent token span
// (not a <Chip> delegate) because the data-testid + single-span contract
// (ConfirmedSigningBadge.test.tsx) can't be expressed through the Chip API.
// Classes mirror Chip intent="positive" size="sm" exactly.

interface ConfirmedSigningBadgeProps {
  /** Native tooltip text. Format: "<headline> · <source>" per D-15. */
  tooltipText?: string
}

export function ConfirmedSigningBadge({ tooltipText }: ConfirmedSigningBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border whitespace-nowrap bg-positive-soft text-positive border-positive/40 text-data px-2 py-0.5"
      title={tooltipText}
      data-testid="confirmed-signing-badge"
    >
      Confirmed Signing
    </span>
  )
}
