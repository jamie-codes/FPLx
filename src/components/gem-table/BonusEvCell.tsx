interface BonusEvCellProps {
  value: number | null | undefined
  source: 'learned_calibrated' | 'learned_uncalibrated' | 'prior' | null | undefined
}

export function BonusEvCell({ value, source }: BonusEvCellProps) {
  if (value == null) return <span className="text-ink-muted">—</span>
  const muted = source === 'prior'
  return (
    <span className={muted ? 'text-ink-muted' : 'text-ink'}>
      {value.toFixed(2)}
    </span>
  )
}
