'use client'

import { useState, useMemo } from 'react'
import { useProseSummary } from '@/lib/hooks/useProseSummary'
import { useProseRefresh } from '@/lib/hooks/useProseRefresh'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
import type { ProseSummary, ProseRefreshPayload } from '@/lib/types'

interface Props {
  payload: ProseRefreshPayload | null
}

export function ProseSummaryBlock({ payload }: Props) {
  const { data: globalProse } = useProseSummary()
  const refresh = useProseRefresh()
  const [override, setOverride] = useState<ProseSummary | null>(null)
  const [guardrailFailed, setGuardrailFailed] = useState(false)

  // D-03: override replaces; D-04: override is component state, lost on unmount
  // D-13: guardrailFailed forces hide even when globalProse is loaded
  const displayed: ProseSummary | null = guardrailFailed ? null : (override ?? globalProse ?? null)

  // Staleness computation — D-01..D-04: relative time footer, amber when >= 20h old.
  // Date.now() is called directly per D-04; vi.spyOn(Date, 'now') controls time in tests.
  const { hasValidGenAt, isStale } = useMemo(() => {
    const genAt = displayed?.generated_at ?? ''
    const genAtMs = new Date(genAt).getTime()
    const valid = !!genAt && Number.isFinite(genAtMs)
    // eslint-disable-next-line react-hooks/purity
    const minutesAgo = valid ? Math.floor((Date.now() - genAtMs) / 60000) : 0
    return { hasValidGenAt: valid, isStale: valid && minutesAgo >= 20 * 60 }
  }, [displayed?.generated_at])

  // D-13: silently hide when no prose available (404 or guardrail rejection)
  if (!displayed) return null

  const handleRefresh = () => {
    if (!payload) return
    refresh.mutate(payload, {
      onSuccess: (data) => setOverride(data),
      onError: (e) => {
        if (e.message === 'GUARDRAIL_FAILED') {
          setOverride(null)
          setGuardrailFailed(true)
        }
      },
    })
  }

  return (
    <div
      className="rounded border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900 mt-4"
      role="region"
      aria-label="AI Summary"
      data-testid="prose-summary-block"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          AI Summary
        </h2>
        <button
          type="button"
          aria-label="Refresh AI summary"
          title="Regenerate summary using your current squad"
          disabled={refresh.isPending || !payload}
          onClick={handleRefresh}
          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-40"
        >
          {refresh.isPending ? '⏳' : '↻'}
        </button>
      </div>
      <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-3 leading-relaxed">
        {displayed.prose}
      </p>
      {hasValidGenAt ? (
        <p className={`text-xs mt-2 ${isStale ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
          Updated {formatRelativeTime(displayed.generated_at)} · GW{displayed.gw}
        </p>
      ) : (
        <p className="text-xs mt-2 text-zinc-400 dark:text-zinc-500">
          Updated GW{displayed.gw}
        </p>
      )}
    </div>
  )
}
