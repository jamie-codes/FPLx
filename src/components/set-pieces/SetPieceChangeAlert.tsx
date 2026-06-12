'use client'
// UIX-03 Task 4: retokenized — amber palette → warning tokens.
export function SetPieceChangeAlert({ changeCount }: { changeCount: number }) {
  if (changeCount === 0) return null
  return (
    <div className="rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm text-warning mb-4">
      <span className="font-semibold">Set-piece changes detected</span>
      {' — '}{changeCount} taker order change(s) since the last pipeline run. Updated rows are marked below.
    </div>
  )
}
