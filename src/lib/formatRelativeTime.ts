/**
 * Formats an ISO timestamp as a human-readable relative time string.
 *
 * Bands (per CONTEXT.md D-01):
 *   < 1 min   -> "just now"
 *   1-59 min  -> "X min ago"
 *   1-47 hr   -> "X hour ago" / "X hours ago"
 *   2+ days   -> "X day ago" / "X days ago"
 *
 * @param isoTimestamp - ISO 8601 string (e.g. "2026-04-29T10:00:00Z")
 * @param nowMs        - Current time in milliseconds (defaults to Date.now(); injectable for tests)
 * @returns relative time label
 */
export function formatRelativeTime(isoTimestamp: string, nowMs: number = Date.now()): string {
  const diffMs = nowMs - new Date(isoTimestamp).getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} min ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 48) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}
