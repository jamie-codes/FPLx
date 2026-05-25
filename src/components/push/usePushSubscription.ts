'use client'

import { useState, useCallback } from 'react'

export type PushPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0))).buffer as ArrayBuffer
}

export function usePushSubscription(): {
  status: PushPermissionStatus
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
  isLoading: boolean
} {
  const [status, setStatus] = useState<PushPermissionStatus>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    return Notification.permission as PushPermissionStatus
  })
  const [isLoading, setIsLoading] = useState(false)

  const subscribe = useCallback(async () => {
    setIsLoading(true)
    try {
      if (Notification.permission === 'denied') {
        setStatus('denied')
        setIsLoading(false)
        return
      }
      if (Notification.permission !== 'granted') {
        const result = await Notification.requestPermission()
        if (result !== 'granted') {
          setStatus('denied')
          setIsLoading(false)
          return
        }
      }
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        ),
      })
      const subJson = sub.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subJson),
      })
      setStatus('granted')
    } catch (err) {
      console.warn('[push] subscribe failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setIsLoading(true)
    try {
      await fetch('/api/push/subscribe', { method: 'DELETE' })
      setStatus('default')
    } catch (err) {
      console.warn('[push] unsubscribe failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { status, subscribe, unsubscribe, isLoading }
}
