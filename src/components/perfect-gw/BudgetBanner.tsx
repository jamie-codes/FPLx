interface BudgetBannerProps {
  squadCost: number     // FPL units (tenths of £m)
  overBudget: boolean
  overBudgetBy: number  // FPL units; 0 when not over
}

export function BudgetBanner({ squadCost, overBudget, overBudgetBy }: BudgetBannerProps) {
  const totalLabel = `£${(squadCost / 10).toFixed(1)}m`
  const overLabel  = `£${(overBudgetBy / 10).toFixed(1)}m over standard budget`

  if (overBudget) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 text-sm">
        <span className="text-amber-700 dark:text-amber-300 font-medium">
          Perfect XI costs {totalLabel} — {overLabel}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-sm">
      <span className="text-green-700 dark:text-green-300 font-medium">
        {totalLabel} — within budget
      </span>
    </div>
  )
}
