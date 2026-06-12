'use client'
// UIX-01 primitive: team shirt icon. Explicit dimensions (zero CLS); if the
// asset 404s it swaps to a size-locked neutral placeholder — same box, so
// nothing reflows and callers never see a broken image.
import Image from 'next/image'
import { useState } from 'react'

const KIT = (teamCode: number) =>
  `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}-110.webp`

export function KitIcon({ teamCode, size = 24 }: { teamCode: number; size?: number }) {
  const [errored, setErrored] = useState(false)
  const width = size
  const height = Math.round(size * 1.33)
  if (errored) {
    return (
      <span
        aria-hidden
        style={{ width, height }}
        className="shrink-0 inline-block rounded bg-surface-2"
      />
    )
  }
  return (
    <Image
      src={KIT(teamCode)}
      alt=""
      aria-hidden
      width={width}
      height={height}
      className="shrink-0 object-contain"
      onError={() => setErrored(true)}
      unoptimized
    />
  )
}
