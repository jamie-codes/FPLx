// Phase 125 WIN-02: ConfirmedSigningBadge — inline positive-signal pill.
// Shown in GemTable expanded rows and OpportunityCostTable buy-cell cluster
// when a player has a confirmed_signing article in the transfer news feed.
//
// Sources of truth:
//   .planning/phases/125-summer-window-tracker/125-CONTEXT.md §D-10..D-16

interface ConfirmedSigningBadgeProps {
  /** Native tooltip text. Format: "<headline> · <source>" per D-15. */
  tooltipText?: string
}

export function ConfirmedSigningBadge({ tooltipText }: ConfirmedSigningBadgeProps) {
  return (
    <span
      className="inline-block text-xs font-normal text-green-800 dark:text-green-200 bg-green-100 dark:bg-green-900 rounded px-2 py-1"
      title={tooltipText}
      data-testid="confirmed-signing-badge"
    >
      Confirmed Signing
    </span>
  )
}
