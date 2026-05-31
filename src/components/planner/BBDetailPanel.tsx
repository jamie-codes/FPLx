import type { BBReadiness } from '@/lib/chip-strategy-engine'

interface Props {
  readiness: BBReadiness
  hitCostLabel?: string
}

function ScoreBar({ value, label, valueLabel }: { value: number; label: string; valueLabel: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className="h-1.5 rounded-full bg-blue-500 dark:bg-blue-400"
          style={{ width: `${Math.min(100, Math.round(value))}%` }}
        />
      </div>
      <span className="w-14 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{valueLabel}</span>
    </div>
  )
}

function scoreBadgeClass(score: number): string {
  if (score >= 80) return 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
  if (score >= 50) return 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
  return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30'
}

export function BBDetailPanel({ readiness, hitCostLabel }: Props) {
  if (readiness.score === 0 && readiness.bench_xpts === 0) {
    return (
      <div className="px-1 py-2 text-xs text-zinc-400 dark:text-zinc-500">
        Load your squad to see BB readiness
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-2.5">
      {/* Score badge */}
      <div className="flex items-center gap-2">
        <span
          className={`text-xl font-bold tabular-nums px-2 py-0.5 rounded ${scoreBadgeClass(readiness.score)}`}
        >
          {readiness.score} / 100
        </span>
      </div>

      {/* Component bars */}
      <div className="space-y-1.5">
        <ScoreBar
          value={readiness.bench_xpts_score}
          label="Bench xPts"
          valueLabel={`${readiness.bench_xpts.toFixed(1)} pts`}
        />
        <ScoreBar
          value={readiness.start_prob_score}
          label="Start Prob"
          valueLabel={`${Math.round(readiness.avg_start_prob * 100)}% avg`}
        />
        <ScoreBar
          value={readiness.doublers_score}
          label="Doublers"
          valueLabel={`${readiness.doublers} of 4`}
        />
      </div>

      {/* Hit cost label */}
      {hitCostLabel && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{hitCostLabel}</p>
      )}
    </div>
  )
}
