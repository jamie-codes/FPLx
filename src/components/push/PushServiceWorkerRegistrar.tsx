'use client'

import { useEffect } from 'react'

export function PushServiceWorkerRegistrar(): null {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return // guard: serviceWorker in navigator
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[push] SW registration failed:', err)
    })
  }, [])
  return null
}
