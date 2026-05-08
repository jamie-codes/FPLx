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
 */
export function RotationRiskBadge({ rotationRisk }: { rotationRisk: boolean }) {
  if (!rotationRisk) return null
  return (
    <span
      className="inline-block text-xs font-normal bg-warning/10 text-warning border border-warning/30 rounded px-2 py-1"
      title="Rotation risk: cup/European fixture within 3 days of this PL fixture"
    >
      <span aria-hidden="true">⚡</span>{' '}Rotation risk
    </span>
  )
}
