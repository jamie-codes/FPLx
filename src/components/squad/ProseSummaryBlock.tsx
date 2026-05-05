'use client'

import { useState } from 'react'
import { useProseSummary } from '@/lib/hooks/useProseSummary'
import { useProseRefresh } from '@/lib/hooks/useProseRefresh'
import type { ProseSummary, ProseRefreshPayload } from '@/lib/types'

interface Props {
  payload: ProseRefreshPayload | null
}

export function ProseSummaryBlock({ payload }: Props) {
  const { data: globalProse } = useProseSummary()
  const refresh = useProseRefresh()
  const [override, setOverride] = useState<ProseSummary | null>(null)

  // D-03: override replaces; D-04: override is component state, lost on unmount
  const displayed: ProseSummary | null = override ?? globalProse ?? null

  // D-13: silently hide when no prose available (404 or guardrail rejection)
  if (!displayed) return null

  const handleRefresh = () => {
    if (!payload) return
    refresh.mutate(payload, {
      onSuccess: (data) => setOverride(data),
      onError: (e) => {
        if (e.message === 'GUARDRAIL_FAILED') setOverride(null)
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
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
        Updated GW{displayed.gw}
      </p>
    </div>
  )
}
