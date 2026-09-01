'use client'

import { useState } from 'react'
import { playerImageUrl } from '@/lib/fpl-images'
import { getTeamColour } from '@/lib/team-colours'
import { TeamBadge } from '@/components/shared/TeamBadge'

interface PlayerAvatarProps {
  code: number | undefined
  webName: string
  teamShortName: string
  width?: number
  height?: number
  className?: string
  /** PHOTO-01: fresher api-football headshot; falls back to the PL CDN. */
  photoUrl?: string | null
}

export function PlayerAvatar({
  code,
  webName,
  teamShortName,
  width = 55,
  height = 70,
  className = '',
  photoUrl,
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

  // PHOTO-01: the club badge is overlaid on the headshot because photos can
  // lag a transfer by a season or more — the badge is always current, so the
  // player's actual club is unambiguous even when the kit in the photo isn't.
  const badgeSize = Math.max(Math.round(width * 0.38), 14)
  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width, height }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={playerImageUrl(code, photoUrl)}
        alt={webName}
        title={webName}
        width={width}
        height={height}
        className="inline-block object-cover object-top rounded w-full h-full"
        onError={() => setError(true)}
      />
      <span
        className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface-1 p-[1px] leading-none shadow-sm"
        aria-hidden
      >
        <TeamBadge shortName={teamShortName} size={badgeSize} />
      </span>
    </span>
  )
}
