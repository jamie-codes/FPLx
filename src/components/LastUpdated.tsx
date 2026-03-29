'use client'

import { useLastUpdated } from '@/lib/hooks/useLastUpdated'

/** Pure render function for testing (DAT-02) */
export function LastUpdatedDisplay({ timestamp, stale }: { timestamp: string; stale: boolean }) {
  const d = new Date(timestamp)
  const label = d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })

  return (
    <p className={`text-xs mt-1 ${stale ? 'text-amber-600' : 'text-zinc-400'}`}>
      Data as of {label}{stale ? ' (stale)' : ''}
    </p>
  )
}

/** Connected version that fetches data via hook */
export function LastUpdated() {
  const { data } = useLastUpdated()
  if (!data) return null

  return <LastUpdatedDisplay timestamp={data.last_updated} stale={data.stale} />
}
