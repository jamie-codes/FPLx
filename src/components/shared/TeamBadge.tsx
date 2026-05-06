'use client'

import { useState } from 'react'
import { getTeamBadgeCode, getTeamColour } from '@/lib/team-colours'
import { teamBadgeUrl } from '@/lib/fpl-images'

interface TeamBadgeProps {
  shortName: string
  size?: number
  className?: string
}

export function TeamBadge({ shortName, size = 20, className = '' }: TeamBadgeProps) {
  const [error, setError] = useState(false)
  const code = getTeamBadgeCode(shortName)
  const colour = getTeamColour(shortName)

  if (!code || error) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-sm font-bold shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          background: colour.primary,
          color: colour.text,
          fontSize: Math.max(Math.floor(size * 0.36), 7),
        }}
        title={shortName}
      >
        {shortName.slice(0, 2)}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={teamBadgeUrl(code)}
      alt={shortName}
      title={shortName}
      width={size}
      height={size}
      className={`inline-block object-contain shrink-0 ${className}`}
      onError={() => setError(true)}
    />
  )
}
