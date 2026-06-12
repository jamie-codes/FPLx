interface BudgetBannerProps {
  squadCost: number     // FPL units (tenths of £m)
  overBudget: boolean
  overBudgetBy: number  // FPL units; 0 when not over
}

export function BudgetBanner({ squadCost, overBudget, overBudgetBy }: BudgetBannerProps) {
  const totalLabel = `£${(squadCost / 10).toFixed(1)}m`
  const overLabel  = `£${(overBudgetBy / 10).toFixed(1)}m over standard budget`

  // UIX-04 ruling 3: budget validity semantics — over→warning, within→positive.
  if (overBudget) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-warning-soft border border-warning/40 text-sm">
        <span className="text-warning font-medium">
          Perfect XI costs {totalLabel} — {overLabel}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-positive-soft border border-positive/40 text-sm">
      <span className="text-positive font-medium">
        {totalLabel} — within budget
      </span>
    </div>
  )
}
