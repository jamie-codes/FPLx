import { list, del } from '@vercel/blob'
import { z } from 'zod'
import webpush from 'web-push'
import type { PushNotificationPayload, PushSubscriptionRecord } from '@/lib/types'

// Phase 134 (PUSH-02..PUSH-05): /api/push/send route dispatch handler.
// Reads stored subscription from Blob and dispatches notification via web-push.

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:user.invalid@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE)
}

const SendBodySchema = z.object({
  type: z.enum(['price', 'injury', 'deadline', 'captain']),
  title: z.string().min(1),
  body: z.string().min(1),
  icon: z.string().optional(),
  data: z.object({ url: z.string() }).optional(),
  hours_until: z.union([z.literal(24), z.literal(2)]).optional(),
})

export async function POST(request: Request): Promise<Response> {
  // 1. Parse JSON body
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body', detail: 'malformed JSON' }, { status: 400 })
  }

  // 2. Zod validate
  const parsed = SendBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body', detail: parsed.error.message }, { status: 400 })
  }
  const body = parsed.data

  // 3. Check VAPID env vars
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return Response.json({ error: 'Service unavailable' }, { status: 503 })
  }

  // 4. Read push subscription from Blob
  let blobs: Array<{ url: string; pathname: string }>
  try {
    const result = await list({ prefix: 'push_subscription.json', limit: 1 })
    blobs = result.blobs
  } catch (err) {
    console.error('[push/send] blob list failed', err)
    return Response.json({ error: 'Storage read error' }, { status: 500 })
  }

  if (blobs.length === 0) {
    return Response.json({ error: 'No subscription' }, { status: 404 })
  }

  // 5. Fetch subscription JSON
  let subscription: PushSubscriptionRecord
  try {
    const fetchRes = await fetch(blobs[0].url)
    subscription = await fetchRes.json() as PushSubscriptionRecord
  } catch (err) {
    console.error('[push/send] blob fetch failed', err)
    return Response.json({ error: 'Storage read error' }, { status: 500 })
  }

  // 6. Build payload
  const payload: PushNotificationPayload = {
    type: body.type,
    title: body.title,
    body: body.body,
    icon: body.icon ?? '/favicon.ico',
    data: body.data ?? { url: '/' },
    ...(body.hours_until !== undefined ? { hours_until: body.hours_until } : {}),
  }

  // 7. Dispatch via web-push
  try {
    const result = await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      JSON.stringify(payload),
    )
    return Response.json({ ok: true, statusCode: result.statusCode ?? 201 }, { status: 200 })
  } catch (err: unknown) {
    const wpErr = err as { statusCode?: number }
    if (wpErr.statusCode === 410) {
      try { await del(blobs[0].url) } catch (delErr) { console.error('[push/send] del stale sub failed', delErr) }
      return Response.json({ error: 'Subscription expired' }, { status: 410 })
    }
    console.error('[push/send] sendNotification failed', err)
    return Response.json({ error: 'Push dispatch failed', detail: String(err) }, { status: 502 })
  }
}
