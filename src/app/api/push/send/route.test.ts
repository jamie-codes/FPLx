// @vitest-environment node
// Phase 134 (PUSH-02..PUSH-05): /api/push/send route dispatch tests

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@vercel/blob', () => ({ list: vi.fn(), del: vi.fn() }))
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}))

const MOCK_BLOB_URL = 'https://blob.url/push_subscription.json'
const MOCK_SUBSCRIPTION = {
  endpoint: 'https://example.push/abc',
  keys: { p256dh: 'p', auth: 'a' },
  sent_reminders: { gw: 0, fired_24h: false, fired_2h: false },
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'BTest_PublicKey_BTest_PublicKey_BTest_PublicKey_BTest_PublicKey_BT'
  process.env.VAPID_PRIVATE_KEY = 'Test_PrivateKey_Test_PrivateKey_Test'
})

async function setupHappyPath() {
  const { list } = await import('@vercel/blob')
  const webpush = (await import('web-push')).default
  vi.mocked(list).mockResolvedValue({
    blobs: [{ url: MOCK_BLOB_URL, pathname: 'push_subscription.json', size: 0, uploadedAt: new Date(), downloadUrl: '', etag: 'test' }],
    cursor: undefined,
    hasMore: false,
  })
  vi.mocked(webpush.sendNotification).mockResolvedValue({ statusCode: 201, body: '', headers: {} } as any)
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(MOCK_SUBSCRIPTION), { status: 200 }),
  )
}

describe('POST /api/push/send', () => {
  it("PUSH-02: dispatches via web-push when type='price'", async () => {
    await setupHappyPath()
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'price', title: 'Price alert', body: 'Salah rising' }))
    expect(res.status).toBe(200)
    const webpush = (await import('web-push')).default
    expect(vi.mocked(webpush.sendNotification)).toHaveBeenCalledOnce()
    const payloadStr = vi.mocked(webpush.sendNotification).mock.calls[0][1] as string
    expect(payloadStr).toContain('"type":"price"')
  })

  it("PUSH-03: dispatches via web-push when type='injury'", async () => {
    await setupHappyPath()
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'injury', title: 'Injury alert', body: 'Salah doubtful' }))
    expect(res.status).toBe(200)
    const webpush = (await import('web-push')).default
    expect(vi.mocked(webpush.sendNotification)).toHaveBeenCalledOnce()
    const payloadStr = vi.mocked(webpush.sendNotification).mock.calls[0][1] as string
    expect(payloadStr).toContain('"type":"injury"')
  })

  it('PUSH-04: dispatches with hours_until=24 when type=deadline', async () => {
    await setupHappyPath()
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'deadline', title: 'Deadline', body: 'GW38 in 24h', hours_until: 24 }))
    expect(res.status).toBe(200)
    const webpush = (await import('web-push')).default
    const payloadStr = vi.mocked(webpush.sendNotification).mock.calls[0][1] as string
    expect(payloadStr).toContain('"hours_until":24')
  })

  it('PUSH-04: dispatches with hours_until=2 when type=deadline', async () => {
    await setupHappyPath()
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'deadline', title: 'Deadline', body: 'GW38 in 2h', hours_until: 2 }))
    expect(res.status).toBe(200)
    const webpush = (await import('web-push')).default
    const payloadStr = vi.mocked(webpush.sendNotification).mock.calls[0][1] as string
    expect(payloadStr).toContain('"hours_until":2')
  })

  it("PUSH-05: dispatches via web-push when type='captain'", async () => {
    await setupHappyPath()
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'captain', title: 'Captain update', body: 'Salah recommended' }))
    expect(res.status).toBe(200)
    const webpush = (await import('web-push')).default
    const payloadStr = vi.mocked(webpush.sendNotification).mock.calls[0][1] as string
    expect(payloadStr).toContain('"type":"captain"')
  })

  it('returns 404 when no subscription stored in Blob', async () => {
    const { list } = await import('@vercel/blob')
    vi.mocked(list).mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false })
    const webpush = (await import('web-push')).default
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'price', title: 'Alert', body: 'Body' }))
    expect(res.status).toBe(404)
    expect(vi.mocked(webpush.sendNotification)).not.toHaveBeenCalled()
  })

  it('returns 410 and calls del when sendNotification throws 410', async () => {
    const { list, del } = await import('@vercel/blob')
    const webpush = (await import('web-push')).default
    vi.mocked(list).mockResolvedValue({
      blobs: [{ url: MOCK_BLOB_URL, pathname: 'push_subscription.json', size: 0, uploadedAt: new Date(), downloadUrl: '', etag: 'test' }],
      cursor: undefined,
      hasMore: false,
    })
    vi.mocked(webpush.sendNotification).mockRejectedValue({ statusCode: 410, body: 'Gone' })
    vi.mocked(del).mockResolvedValue(undefined as any)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_SUBSCRIPTION), { status: 200 }),
    )
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'price', title: 'Alert', body: 'Body' }))
    expect(res.status).toBe(410)
    expect(vi.mocked(del)).toHaveBeenCalledWith(MOCK_BLOB_URL)
  })

  it('returns 502 when sendNotification throws a non-410 error', async () => {
    const { list } = await import('@vercel/blob')
    const webpush = (await import('web-push')).default
    vi.mocked(list).mockResolvedValue({
      blobs: [{ url: MOCK_BLOB_URL, pathname: 'push_subscription.json', size: 0, uploadedAt: new Date(), downloadUrl: '', etag: 'test' }],
      cursor: undefined,
      hasMore: false,
    })
    vi.mocked(webpush.sendNotification).mockRejectedValue({ statusCode: 500, body: 'Error' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_SUBSCRIPTION), { status: 200 }),
    )
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'price', title: 'Alert', body: 'Body' }))
    expect(res.status).toBe(502)
  })

  it('returns 503 when VAPID_PRIVATE_KEY is missing', async () => {
    delete process.env.VAPID_PRIVATE_KEY
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'price', title: 'Alert', body: 'Body' }))
    expect(res.status).toBe(503)
  })

  it('returns 400 on malformed JSON body', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/push/send', { method: 'POST', body: 'not-json' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.detail).toBe('malformed JSON')
  })

  it("returns 400 when type='other' (not in enum)", async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'other', title: 'Alert', body: 'Body' }))
    expect(res.status).toBe(400)
  })
})
