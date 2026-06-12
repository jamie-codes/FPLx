// MIN-02: RiskChip — compact risk indicator for fixture-difficulty rotation risk
// and FPL availability risk.
// UIX-04: stays bespoke, internals retokenized per ruling 3 severity mapping —
// high/out→negative, medium/doubt→warning (two-tier distinction preserved).
// Renders nothing when both signals are low/unknown (no visual noise for clean players).
// Used by MinsRiskBadge, OpportunityCostTable, and WildcardBuilderTab.

type DifficultyRotationRisk = 'low' | 'medium' | 'high' | 'unknown'
type AvailabilityRisk = 'out' | 'doubt' | 'fit' | 'unknown'

export interface RiskChipProps {
  /** Fixture-difficulty rotation risk. 'high'/'medium' show a chip; 'low'/'unknown' → nothing. */
  difficultyRotationRisk?: DifficultyRotationRisk
  /** FPL availability. 'out'/'doubt' show a chip; 'fit'/'unknown' → nothing. */
  availabilityRisk?: AvailabilityRisk
}

export function RiskChip({ difficultyRotationRisk, availabilityRisk }: RiskChipProps) {
  const showRotation = difficultyRotationRisk === 'high' || difficultyRotationRisk === 'medium'
  const showAvailability = availabilityRisk === 'out' || availabilityRisk === 'doubt'

  if (!showRotation && !showAvailability) return null

  return (
    <div className="inline-flex flex-col gap-0.5 items-start">
      {showRotation && (
        <span
          className={`inline-block text-xs font-normal rounded px-2 py-1 ${
            difficultyRotationRisk === 'high'
              ? 'text-negative bg-negative-soft'
              : 'text-warning bg-warning-soft'
          }`}
          title={`Rotation risk: ${difficultyRotationRisk!.toUpperCase()} — fewer minutes expected in this fixture type`}
        >
          {difficultyRotationRisk === 'high' ? '↻ HIGH' : '↻ MED'}
        </span>
      )}
      {showAvailability && (
        <span
          className={`inline-block text-xs font-normal rounded px-2 py-1 ${
            availabilityRisk === 'out'
              ? 'text-negative bg-negative-soft'
              : 'text-warning bg-warning-soft'
          }`}
          title={
            availabilityRisk === 'out'
              ? 'Availability: OUT — player is unavailable'
              : 'Availability: DOUBT — player has a fitness concern'
          }
        >
          {availabilityRisk === 'out' ? '✕ OUT' : '⚠ DOUBT'}
        </span>
      )}
    </div>
  )
}
