'use client'

import { useState } from 'react'
import { playerImageUrl } from '@/lib/fpl-images'
import { getTeamColour } from '@/lib/team-colours'

interface PlayerAvatarProps {
  code: number | undefined
  webName: string
  teamShortName: string
  width?: number
  height?: number
  className?: string
}

export function PlayerAvatar({
  code,
  webName,
  teamShortName,
  width = 55,
  height = 70,
  className = '',
}: PlayerAvatarProps) {
  const [error, setError] = useState(false)
  const colour = getTeamColour(teamShortName)

  const initials = webName
    .split(/[\s\-']/)
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (!code || error) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded font-bold shrink-0 ${className}`}
        style={{
          width,
          height,
          background: `linear-gradient(160deg, ${colour.primary} 0%, ${colour.secondary} 100%)`,
          color: colour.text,
          fontSize: Math.max(Math.floor(width * 0.32), 10),
        }}
        title={webName}
      >
        {initials}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={playerImageUrl(code)}
      alt={webName}
      title={webName}
      width={width}
      height={height}
      className={`inline-block object-cover object-top rounded shrink-0 ${className}`}
      onError={() => setError(true)}
    />
  )
}
