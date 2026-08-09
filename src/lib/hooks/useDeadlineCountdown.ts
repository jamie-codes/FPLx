import { useEffect, useState } from 'react'
import { useNextDeadline } from './useNextDeadline'

// §5: ticks the next-deadline countdown once per second, returning raw
// { id, ms }. Formatting lives in formatDeadlineCountdown; consumers render.
// Returns null when data is missing, deadline_time is unparseable, or id is null.
export function useDeadlineCountdown(): { id: number; ms: number } | null {
  const { data } = useNextDeadline()
  const id = data?.id ?? null
  const deadlineTime = data?.deadline_time ?? null

  const [ms, setMs] = useState<number>(() =>
    deadlineTime ? new Date(deadlineTime).getTime() - Date.now() : NaN,
  )

  useEffect(() => {
    if (!deadlineTime) return
    const tick = () => setMs(new Date(deadlineTime).getTime() - Date.now())
    tick()
    const intervalId = setInterval(tick, 1000)
    return () => clearInterval(intervalId)
  }, [deadlineTime])

  if (id === null || deadlineTime === null) return null
  if (Number.isNaN(ms)) return null
  return { id, ms }
}
