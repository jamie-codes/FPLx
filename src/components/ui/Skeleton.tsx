'use client'
// UIX-01 primitive: shimmer placeholder block (photo / table loading).
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded bg-surface-2 ${className}`} />
}
