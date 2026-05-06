// Phase 64 (SENS-02): FragilityNote — inline ⚠ + amber text indicator.
// Sources of truth:
//   - .planning/phases/064-sensitivity-analysis/064-UI-SPEC.md §Component Specification
//   - .planning/phases/064-sensitivity-analysis/064-CONTEXT.md §decisions D-01, D-12
// NO filled pill — distinct from DangerousToFadeBadge / McLabel / SeverityBadge MEDIUM.

interface FragilityNoteProps {
  reasons: string[]
}

export function FragilityNote({ reasons }: FragilityNoteProps) {
  if (reasons.length === 0) return null
  return (
    <div
      className="text-xs text-amber-600 dark:text-amber-400"
      data-testid="fragility-note"
    >
      <span aria-hidden="true">⚠ </span>
      {`no longer recommended if: ${reasons.join(', ')}`}
    </div>
  )
}
