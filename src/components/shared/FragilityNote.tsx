// Phase 64 (SENS-02): FragilityNote — inline ⚠ + amber text indicator.
// Sources of truth:
//   - .planning/phases/064-sensitivity-analysis/064-UI-SPEC.md §Component Specification
//   - .planning/phases/064-sensitivity-analysis/064-CONTEXT.md §decisions D-01, D-12
// NO filled pill — distinct from DangerousToFadeBadge / McLabel / SeverityBadge MEDIUM.

interface FragilityNoteProps {
  reasons: string[]
}

export function FragilityNote(_props: FragilityNoteProps) {
  // STUB — implementation comes in Task 2 (GREEN)
  return null
}
