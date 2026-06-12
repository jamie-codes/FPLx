'use client'
// UIX-01 primitive: team shirt icon. Explicit dimensions (zero CLS);
// renders nothing if the asset 404s — callers never see a broken image.
import Image from 'next/image'
import { useState } from 'react'

const KIT = (teamCode: number) =>
  `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}-110.webp`

export function KitIcon({ teamCode, size = 24 }: { teamCode: number; size?: number }) {
  const [errored, setErrored] = useState(false)
  if (errored) return null
  return (
    <Image
      src={KIT(teamCode)}
      alt=""
      aria-hidden
      width={size}
      height={Math.round(size * 1.33)}
      className="shrink-0 object-contain"
      onError={() => setErrored(true)}
      unoptimized
    />
  )
}
