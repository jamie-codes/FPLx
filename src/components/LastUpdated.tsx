'use client'

import { useEffect, useState } from 'react'
import { useLastUpdated } from '@/lib/hooks/useLastUpdated'
import { formatRelativeTime } from '@/lib/formatRelativeTime'

/** Pure render function for testing (DAT-02). Receives a pre-formatted label
 *  so all Date logic stays in the connected component. */
export function LastUpdatedDisplay({ relativeTime, stale }: { relativeTime: string; stale: boolean }) {
  if (!stale) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-surface-2 text-ink-muted">
        <span aria-hidden="true">●</span>
        Updated {relativeTime}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-warning-soft text-warning">
      <span aria-hidden="true">⚠</span>
      Updated {relativeTime}
    </span>
  )
}

/** Connected version: fetches last-updated data, formats it as relative time,
 *  and re-formats every 30s so the label stays fresh within a session (FRE-03). */
export function LastUpdated() {
  const { data } = useLastUpdated()
  const [relativeTime, setRelativeTime] = useState<string>(
    () => (data?.last_updated ? formatRelativeTime(data.last_updated) : '')
  )

  useEffect(() => {
    if (!data?.last_updated) return
    setRelativeTime(formatRelativeTime(data.last_updated))
    const id = setInterval(() => {
      setRelativeTime(formatRelativeTime(data.last_updated))
    }, 30_000)
    return () => clearInterval(id)
  }, [data?.last_updated])

  if (!data) return null
  return <LastUpdatedDisplay relativeTime={relativeTime} stale={data.stale} />
}
