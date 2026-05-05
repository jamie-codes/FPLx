'use client'

import { useMutation } from '@tanstack/react-query'
import type { ProseSummary, ProseRefreshPayload } from '../types'

async function postRefresh(payload: ProseRefreshPayload): Promise<ProseSummary> {
  const res = await fetch('/api/prose-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (res.status === 422) {
    // D-13 sentinel: silently hide the prose block
    throw new Error('GUARDRAIL_FAILED')
  }
  if (!res.ok) {
    throw new Error(`Refresh failed: ${res.status}`)
  }
  return res.json()
}

export function useProseRefresh() {
  return useMutation<ProseSummary, Error, ProseRefreshPayload>({
    mutationFn: postRefresh,
  })
}
