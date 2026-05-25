import { z } from 'zod'
import type { PushNotificationPayload, PushNotificationType } from '@/lib/types'

const CANNED_PAYLOADS: Record<PushNotificationType, PushNotificationPayload> = {
  price: {
    type: 'price',
    title: 'Price change alert',
    body: 'Mohamed Salah projected to rise £0.2m',
    icon: '/favicon.ico',
    data: { url: '/' },
  },
  injury: {
    type: 'injury',
    title: 'Injury alert',
    body: 'Mohamed Salah: Doubtful (knock)',
    icon: '/favicon.ico',
    data: { url: '/' },
  },
  deadline: {
    type: 'deadline',
    title: 'FPL deadline reminder',
    body: 'GW30 deadline in 24h',
    icon: '/favicon.ico',
    data: { url: '/' },
    hours_until: 24,
  },
  captain: {
    type: 'captain',
    title: 'Captain update',
    body: 'Mohamed Salah is now the top captain pick for GW30',
    icon: '/favicon.ico',
    data: { url: '/' },
  },
}

const TestSendBodySchema = z.object({
  type: z.enum(['price', 'injury', 'deadline', 'captain']),
})

export async function POST(request: Request): Promise<Response> {
  // Production gate FIRST (T-134-01)
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // Bearer auth
  const authHeader = request.headers.get('authorization')
  const expected = `Bearer ${process.env.PUSH_TEST_SECRET}`
  if (!authHeader || authHeader !== expected) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Parse body
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body', detail: 'malformed JSON' }, { status: 400 })
  }

  const parsed = TestSendBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body', detail: parsed.error.message }, { status: 400 })
  }

  const payload = CANNED_PAYLOADS[parsed.data.type]
  const sendUrl = new URL('/api/push/send', request.url)

  const upstream = await fetch(sendUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
