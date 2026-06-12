/**
 * RotationRiskBadge — Phase 80 GWI-01 (D-15).
 *
 * Renders ⚡ Rotation risk pill when team has a European/cup fixture
 * within 3 days of an upcoming PL fixture (computed in pipeline by
 * _apply_rotation_risk). Returns null when rotationRisk=false.
 *
 * Coexists with MinsRiskBadge — different concept:
 *  - MinsRiskBadge: player-level minutes risk (start probability)
 *  - RotationRiskBadge: team-level fixture-calendar clash (this component)
 *
 * UIX-03 Task 4: collapsed into Chip per the badge policy (→ warning).
 * Kept as a thin wrapper so call sites (set-pieces, transfers) stay stable.
 */
import { Chip } from '@/components/ui/Chip'

export function RotationRiskBadge({ rotationRisk }: { rotationRisk: boolean }) {
  if (!rotationRisk) return null
  return (
    <Chip
      intent="warning"
      size="sm"
      title="Rotation risk: cup/European fixture within 3 days of this PL fixture"
    >
      <span aria-hidden="true">⚡</span> Rotation risk
    </Chip>
  )
}
