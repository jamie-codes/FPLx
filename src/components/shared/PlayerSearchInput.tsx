'use client'

// Phase 94 (WHY-01): shared autocomplete search input used by RejectionSearchCallout
// (TransferPanel — text-sm) and ComparisonSearch (GemTable row-expand — text-xs).
//
// Sources of truth:
//   - .planning/phases/94-rejection-explainer-enhancements/94-UI-SPEC.md §WHY-01-A + §WHY-01-B
//   - .planning/phases/94-rejection-explainer-enhancements/94-PATTERNS.md §PlayerSearchInput
//   - .planning/phases/94-rejection-explainer-enhancements/94-CONTEXT.md §D-09 (autocomplete scope: scoredPlayers, web_name match)
import { useState, useMemo, useEffect, useRef } from 'react'
import type { ScoredPlayer } from '@/lib/types'

export interface PlayerSearchInputProps {
  players: ScoredPlayer[]
  onSelect: (player: ScoredPlayer | null) => void
  placeholder?: string
  /** text-sm (TransferPanel default) vs text-xs (GemTable row-expand) */
  inputClassName?: string
  'aria-label'?: string
}

const DEBOUNCE_MS = 150
const MIN_QUERY_LEN = 2
const MAX_SUGGESTIONS = 6

export function PlayerSearchInput(props: PlayerSearchInputProps) {
  const { players, onSelect, placeholder, inputClassName } = props
  const ariaLabel = props['aria-label'] ?? placeholder ?? 'Search player'

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Inline debounce — no useDebounce hook in project (verified via grep).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const suggestions = useMemo(() => {
    if (debouncedQuery.length < MIN_QUERY_LEN) return []
    const q = debouncedQuery.toLowerCase()
    return players
      .filter(p => p.web_name.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS)
  }, [players, debouncedQuery])

  const showNoResults = open && debouncedQuery.length >= MIN_QUERY_LEN && suggestions.length === 0

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder ?? 'Search player name…'}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setTimeout(() => setOpen(false), 100) }}
        aria-label={ariaLabel}
        className={`w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${inputClassName ?? 'text-sm'}`}
        style={{ fontSize: '16px' }}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 shadow-sm">
          {suggestions.map(p => (
            <button
              type="button"
              key={p.id}
              onMouseDown={() => { onSelect(p); setQuery(p.web_name); setOpen(false) }}
              className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
            >
              <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{p.web_name}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">{p.team_short_name}</span>
            </button>
          ))}
        </div>
      )}
      {showNoResults && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          No players found matching &lsquo;{debouncedQuery}&rsquo;
        </p>
      )}
    </div>
  )
}
