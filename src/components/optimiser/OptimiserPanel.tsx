'use client'

// Phase 43: OptimiserPanel — STUB (Plan 01 Wave 0)
// Full pitch-layout implementation lands in Plan 03. This stub exists so:
//   1. Plan 02 nav wiring can import { OptimiserPanel } and mount it under Squad > Optimiser
//   2. page.test.tsx can mock @/components/optimiser/OptimiserPanel without import errors
//
// DO NOT add features here. Plan 03 replaces this entire file.
interface OptimiserPanelProps {
  teamId: string
}

export function OptimiserPanel(_props: OptimiserPanelProps) {
  return (
    <section
      data-testid="optimiser-panel"
      className="mt-6 space-y-3"
      aria-label="Optimiser panel placeholder"
    >
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Optimised Lineup</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Coming soon — Plan 03 will render the optimised pitch.</p>
    </section>
  )
}
