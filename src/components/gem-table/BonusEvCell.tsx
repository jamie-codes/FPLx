interface BonusEvCellProps {
  value: number | null | undefined
  source: 'learned_calibrated' | 'learned_uncalibrated' | 'prior' | null | undefined
}

export function BonusEvCell({ value, source }: BonusEvCellProps) {
  if (value == null) return <span className="text-zinc-400">—</span>
  const muted = source === 'prior'
  return (
    <span className={muted ? 'text-zinc-500' : 'text-zinc-100'}>
      {value.toFixed(2)}
    </span>
  )
}
