import { put, list, del } from '@vercel/blob'
import { z } from 'zod'
import type { PushSubscriptionRecord } from '@/lib/types'

// Phase 134 (PUSH-01): /api/push/subscribe route
// POST: store web push subscription
// DELETE: remove web push subscription

const SubscribeBodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
})

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body', detail: 'malformed JSON' }, { status: 400 })
  }

  const parsed = SubscribeBodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request body', detail: parsed.error.message },
      { status: 400 },
    )
  }
  const body = parsed.data

  const subscriptionRecord: PushSubscriptionRecord = {
    endpoint: body.endpoint,
    keys: body.keys,
    sent_reminders: { gw: 0, fired_24h: false, fired_2h: false },
  }

  try {
    await put('push_subscription.json', JSON.stringify(subscriptionRecord), {
      addRandomSuffix: false,
      allowOverwrite: true,
      access: 'public',
      contentType: 'application/json',
    })
    return Response.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('[push/subscribe] storage error', err)
    return Response.json({ error: 'Storage error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { blobs } = await list({ prefix: 'push_subscription.json', limit: 1 })
    for (const b of blobs) {
      await del(b.url)
    }
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error('[push/subscribe] delete error', err)
    return Response.json({ error: 'Storage error' }, { status: 500 })
  }
}
