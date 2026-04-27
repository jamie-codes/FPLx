'use client'

export function SetPieceChangeAlert({ changeCount }: { changeCount: number }) {
  if (changeCount === 0) return null
  return (
    <div className="rounded border border-amber-400 bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-800 dark:text-amber-200 mb-4">
      <span className="font-semibold">Set-piece changes detected</span>
      {' \u2014 '}{changeCount} taker order change(s) since the last pipeline run. Updated rows are marked below.
    </div>
  )
}
