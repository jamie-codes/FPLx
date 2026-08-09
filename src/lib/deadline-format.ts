// §5: long-range deadline countdown formatter for the sidebar card (with
// seconds) and the mobile GW pill (without). Distinct from DeadlineBanner's
// minute-only formatCountdown, which is left untouched. Day part appears only
// at >= 1 day; below that it is dropped.
export function formatDeadlineCountdown(ms: number, showSeconds: boolean): string {
  const clamped = ms > 0 ? ms : 0
  const totalSec = Math.floor(clamped / 1000)
  const days = Math.floor(totalSec / 86_400)
  const hours = Math.floor((totalSec % 86_400) / 3_600)
  const minutes = Math.floor((totalSec % 3_600) / 60)
  const seconds = totalSec % 60
  const p = (n: number) => String(n).padStart(2, '0')
  const hms = showSeconds ? `${p(hours)}:${p(minutes)}:${p(seconds)}` : `${p(hours)}:${p(minutes)}`
  return days >= 1 ? `${days}d ${hms}` : hms
}
