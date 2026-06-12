'use client'
// UIX-01 signature component: headshot + name + team badge + meta. Zero-CLS:
// explicit dimensions; skeleton until load; initials avatar on photo error.
import Image from 'next/image'
import { useState } from 'react'

const PHOTO = (code: number) =>
  `https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`
const BADGE = (teamCode: number) =>
  `https://resources.premierleague.com/premierleague/badges/70/t${teamCode}.png`

function initials(name: string): string {
  return name.split(/[\s.-]+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '').join('')
}

export function PlayerCell({ code, webName, teamCode, teamShort, pos, price, size = 'md' }: {
  code?: number | null
  webName: string
  teamCode?: number | null
  teamShort?: string
  pos?: string
  price?: string
  size?: 'sm' | 'md'
}) {
  const [photoErr, setPhotoErr] = useState(false)
  const [badgeErr, setBadgeErr] = useState(false)
  const img = size === 'md' ? { w: 30, h: 38 } : { w: 24, h: 30 }
  const meta = [pos, teamShort, price].filter(Boolean).join(' · ')
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      {code && !photoErr ? (
        <Image src={PHOTO(code)} alt="" width={img.w} height={img.h}
          className="rounded-md bg-surface-2 object-cover shrink-0"
          onError={() => setPhotoErr(true)} unoptimized />
      ) : (
        <span style={{ width: img.w, height: img.h }} aria-hidden
          className="rounded-md bg-surface-2 text-ink-muted text-data font-medium
                     inline-flex items-center justify-center shrink-0">
          {initials(webName)}
        </span>
      )}
      <span className="min-w-0 leading-tight">
        <span className="flex items-center gap-1.5">
          <span className="text-body font-semibold text-ink truncate">{webName}</span>
          {teamCode && !badgeErr && (
            <Image src={BADGE(teamCode)} alt={teamShort ?? ''} width={14} height={14}
              className="shrink-0" onError={() => setBadgeErr(true)} unoptimized />
          )}
        </span>
        {meta && <span className="block text-data text-ink-muted truncate">{meta}</span>}
      </span>
    </span>
  )
}
