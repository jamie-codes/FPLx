'use client'

// Phase 105 NLP-02: PlayerInsightSection — on-demand LLM insight UI.
// Renders in GemTable expand row (bottom, after ComparisonSearch) and
// TransferPanel PlayerMoveCell (buy-candidate rows only, after FragilityBadge).
//
// Critical invariant: NEVER call mutate from useEffect — cost-explosion risk.
// (50 visible GemTable rows × 900 tokens × 4 sessions/day × 180 days ≈ USD 16-32/season from one bug.)

import { useState } from 'react'
import { usePlayerInsight, readCachedInsight } from '@/lib/hooks/usePlayerInsight'
import type { MergedPlayer } from '@/lib/types'
import type { FragilityTier } from '@/lib/sensitivity'
import type { PlayerInsightResponse } from '@/lib/types'

export interface PlayerInsightSectionProps {
  player: Pick<MergedPlayer, 'id' | 'web_name' | 'element_type' | 'haul_prob' | 'blank_prob' | 'p10_pts' | 'p90_pts'>
  gw: number
  rejectionReasons: string[]
  fragility: { tier: FragilityTier; reasons: string[] }
  lifecycleLabel?: string
}

/**
 * PlayerInsightSection renders an "AI ✨ Insight" section with:
 * - A "Get AI insight" button (idle state, no cache hit)
 * - A "Generating…" disabled button (loading state)
 * - A prose block + "Refresh insight" button (after success or cache hit)
 * - "AI unavailable — try again" inline text (hard error)
 * - Guardrail fallback: header + rejectionReasons list (GUARDRAIL_FAILED)
 */
export function PlayerInsightSection({
  player,
  gw,
  rejectionReasons,
  fragility,
  lifecycleLabel,
}: PlayerInsightSectionProps) {
  // Cache-hit initialiser: check localStorage on mount (synchronous — safe for SSR since
  // localStorage access only runs client-side after hydration).
  const [insight, setInsight] = useState<PlayerInsightResponse | null>(() => {
    try {
      return readCachedInsight(player.id, gw)
    } catch {
      return null
    }
  })
  const [guardrailFailed, setGuardrailFailed] = useState(false)

  const { mutate, isPending, isError, error } = usePlayerInsight(player.id, gw)

  function handleGetInsight() {
    setGuardrailFailed(false)
    mutate(
      {
        gw,
        player: {
          id: player.id,
          web_name: player.web_name,
          element_type: player.element_type,
          haul_prob: player.haul_prob,
          blank_prob: player.blank_prob,
          p10_pts: player.p10_pts,
          p90_pts: player.p90_pts,
        },
        rejection_reasons: rejectionReasons,
        fragility,
        lifecycle_label: lifecycleLabel,
      },
      {
        onSuccess: (data) => {
          setInsight(data)
        },
        onError: (err) => {
          if (err.message === 'GUARDRAIL_FAILED') {
            setGuardrailFailed(true)
          }
        },
      },
    )
  }

  // Hard error (not guardrail) — show inline error message
  const isHardError = isError && error?.message !== 'GUARDRAIL_FAILED'

  return (
    <div className="mt-2 pt-2 border-t border-line">
      {/* Prose display: shown when insight is loaded (from cache or button click) */}
      {insight !== null && (
        <>
          <p className="text-xs text-ink-muted mb-1">AI ✨ Insight</p>
          <p className="text-sm text-ink leading-relaxed">{insight.prose}</p>
        </>
      )}

      {/* Guardrail fallback: structured rejection reasons with disclaimer */}
      {guardrailFailed && insight === null && (
        <div>
          <p className="text-xs text-ink-muted mb-1">
            AI insight unavailable — showing analysis:
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {rejectionReasons.map((reason, i) => (
              <li key={i} className="text-xs text-ink-muted">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hard error message */}
      {isHardError && (
        <p className="text-xs text-ink-muted">AI unavailable — try again</p>
      )}

      {/* Button: idle / loading / refresh */}
      <button
        type="button"
        disabled={isPending}
        onClick={handleGetInsight}
        className={[
          'mt-1 text-xs px-2 py-0.5 rounded cursor-pointer',
          'text-ink-muted',
          'bg-surface-2',
          'hover:bg-surface-2/80',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        ].join(' ')}
      >
        {isPending ? 'Generating…' : insight !== null ? 'Refresh insight' : 'Get AI insight'}
      </button>
    </div>
  )
}
