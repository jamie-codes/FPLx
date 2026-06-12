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
  /** 0.0 = hardest fixture run, 1.0 = easiest. */
  ease: number
}

export function EaseBar({ ease }: Props) {
  const clamped = Math.max(0, Math.min(1, ease))
  const tier = tierFromEase(clamped)
  const pct = (clamped * 100).toFixed(0)
  return (
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
}
