import type { TCCandidate } from '@/lib/chip-strategy-engine'

// UIX-04 ruling 3: start-risk dots are result semantics → positive/warning/negative tokens
const RISK_CLASSES: Record<TCCandidate['start_risk'], string> = {
  low: 'bg-positive',
  medium: 'bg-warning',
  high: 'bg-negative',
}

interface Props {
  candidates: TCCandidate[]
}

export function TCDetailPanel({ candidates }: Props) {
  if (candidates.length === 0) {
    return (
      <div className="px-1 py-2 text-xs text-ink-muted">
        No player data available
      </div>
    )
  }

  const rows = candidates.slice(0, 5)

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-ink-muted border-b border-line">
            <th className="text-left py-1 pr-2 font-medium">Player</th>
            <th className="text-left py-1 pr-2 font-medium">Fixture</th>
            <th className="text-right py-1 pr-2 font-medium">TC xPts</th>
            <th className="text-right py-1 font-medium">Rating</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(c => (
            <tr
              key={c.player.id}
              data-testid="tc-candidate-row"
              className="border-b border-line last:border-0"
            >
              <td className="py-1.5 pr-2">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${RISK_CLASSES[c.start_risk]}`}
                    data-risk={c.start_risk}
                    title={`Start risk: ${c.start_risk}`}
                  />
                  <span className="font-medium text-ink truncate max-w-[80px]">
                    {c.player.web_name}
                  </span>
                </span>
              </td>
              <td className="py-1.5 pr-2 text-ink-muted">
                <span className="flex items-center gap-1 flex-wrap">
                  {c.fixture_label}
                  {c.is_dgw && (
                    <span className="inline-block px-1 py-0.5 text-[10px] font-semibold rounded bg-warning-soft text-warning">
                      2×
                    </span>
                  )}
                </span>
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums text-ink">
                {c.tc_xpts.toFixed(1)}
              </td>
              <td className="py-1.5 text-right tabular-nums font-semibold text-ink">
                {c.tc_rating.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
