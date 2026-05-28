interface BonusEvCellProps {
  value: number | null | undefined
  source: 'learned' | 'flat_default' | null | undefined
}

export function BonusEvCell({ value, source }: BonusEvCellProps) {
  if (value == null) return <span className="text-zinc-400">—</span>
  const muted = source === 'flat_default'
  return (
    <span className={muted ? 'text-zinc-500' : 'text-zinc-100'}>
      {value.toFixed(2)}
    </span>
  )
}
