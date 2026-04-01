'use client'

import type { PositionCode } from '@/lib/types'

const POSITIONS: Array<{ label: string; code: PositionCode | null }> = [
  { label: 'All', code: null },
  { label: 'GK', code: 1 },
  { label: 'DEF', code: 2 },
  { label: 'MID', code: 3 },
  { label: 'FWD', code: 4 },
]

interface Props {
  active: PositionCode | null
  onChange: (code: PositionCode | null) => void
}

export function PositionFilter({ active, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {POSITIONS.map(({ label, code }) => (
        <button
          key={label}
          onClick={() => onChange(code)}
          className={`px-3 py-2.5 sm:py-1 rounded text-sm font-medium transition-colors cursor-pointer active:scale-95 transition-transform min-h-[44px] ${
            active === code
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
