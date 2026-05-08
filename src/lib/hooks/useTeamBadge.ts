'use client'
// Phase 81 (SHD-03 D-06, D-07, D-08, D-09): single source of truth for crest URL,
// load-error state, and fallback styling at all SHD placement sites.
//
// Sources of truth:
//   - .planning/phases/81-team-shields-visual-identity/81-CONTEXT.md §decisions D-06..D-09
//   - .planning/phases/81-team-shields-visual-identity/81-RESEARCH.md §Pattern: Hook Implementation
import { useState, useCallback } from 'react'
import { teamBadgeUrl } from '@/lib/fpl-images'
import { TEAM_BADGE_CODE, getTeamColour } from '@/lib/team-colours'

interface UseTeamBadgeResult {
  src: string | null
  onError: () => void
  showFallback: boolean
  fallbackColour: string
  initial: string
}

export function useTeamBadge(shortName: string): UseTeamBadgeResult {
  const [imgError, setImgError] = useState(false)
  const code = TEAM_BADGE_CODE[shortName]
  const src = code !== undefined ? teamBadgeUrl(code) : null
  return {
    src,
    onError: useCallback(() => setImgError(true), []),
    showFallback: src === null || imgError,
    fallbackColour: getTeamColour(shortName).primary,
    initial: shortName[0] ?? '?',
  }
}
