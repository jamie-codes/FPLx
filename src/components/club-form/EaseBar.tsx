'use client'

import type { DifficultyTier } from '@/lib/types'

// Phase 27 — local TIER_BG palette. Background-only variants of FixtureBadges' TIER_COLOURS.
// Kept local (not shared) to avoid scope creep — see 27-RESEARCH.md §"Don't Hand-Roll" item on TIER palette.
// UIX-04 ruling 1: ease tiers are data - solid intent fills (easy->positive,
// medium->warning, hard->negative) on a surface-2 track.
const TIER_BG: Record<DifficultyTier, string> = {
  easy:   'bg-positive',
  medium: 'bg-warning',
  hard:   'bg-negative',
}

function tierFromEase(ease: number): DifficultyTier {
  if (ease >= 0.66) return 'easy'
  if (ease <= 0.33) return 'hard'
  return 'medium'
}

interface Props {
  /** 0.0 = hardest fixture run, 1.0 = easiest. Values outside [0,1] are clamped. */
  ease: number
  /** Render the clamped percentage as text beside the bar (aria-hidden — the
   * bar's own aria-label already announces it; review 2026-08-29). */
  showLabel?: boolean
}

export function EaseBar({ ease, showLabel = false }: Props) {
  const clamped = Math.max(0, Math.min(1, ease))
  const tier = tierFromEase(clamped)
  const pct = (clamped * 100).toFixed(0)
  const bar = (
    <div
      className="flex-1 h-3 bg-surface-2 rounded overflow-hidden"
      role="img"
      aria-label={`Ease ${pct}%`}
      data-testid="ease-bar"
      data-tier={tier}
    >
      <div
        className={`h-full ${TIER_BG[tier]}`}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
  if (!showLabel) return bar
  return (
    <span className="flex flex-1 items-center gap-1.5">
      {bar}
      <span aria-hidden className="text-xs font-mono tabular-nums text-ink-muted w-6 text-right">
        {pct}
      </span>
    </span>
  )
}
