'use client'

export function getColumnVisibility(horizon: 1 | 3 | 5): Record<string, boolean> {
  return {
    proj_pts_1gw: horizon === 1,
    proj_pts_3gw: horizon === 3,
    proj_pts_5gw: horizon === 5,
  }
}

interface Props {
  value: 1 | 3 | 5
  onChange: (v: 1 | 3 | 5) => void
}

export function GwToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Projected points horizon"
      className="flex rounded overflow-hidden border border-zinc-300"
    >
      {([1, 3, 5] as const).map((gw) => (
        <button
          key={gw}
          onClick={() => onChange(gw)}
          aria-pressed={value === gw}
          className={`px-3 py-1 text-sm font-medium transition-colors ${
            value === gw
              ? 'bg-zinc-900 text-white'
              : 'bg-white text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          {gw} GW
        </button>
      ))}
    </div>
  )
}
