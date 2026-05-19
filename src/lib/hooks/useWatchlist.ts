// Phase 127 WATCH-01: Transfer Target Watchlist — localStorage-backed hook.
// D-09: storage shape is JSON.stringify(number[]) — a plain array of player element IDs.
// No timestamps, no metadata. This shape is LOCKED per CONTEXT.md D-09.
// D-10: state lives at page.tsx level; this hook is called once there and props flow down.
import { useState, useCallback } from 'react'

const STORAGE_KEY = 'fplx_watchlist'

function loadWatchlist(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'number') : []
  } catch {
    return []
  }
}

export function useWatchlist() {
  const [watchlistIds, setWatchlistIds] = useState<number[]>(() => loadWatchlist())

  const toggleWatchlist = useCallback((id: number) => {
    setWatchlistIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  return { watchlistIds, toggleWatchlist }
}
