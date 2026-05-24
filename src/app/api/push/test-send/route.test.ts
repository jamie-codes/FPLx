// @vitest-environment node
// Phase 134 (PUSH-02..PUSH-05): /api/push/test-send dev-only contract tests

import { describe, it, expect, vi, beforeEach } from 'vitest'

const VALID_TOKEN = 'test-secret-value'

function makeRequest(body: unknown, token?: string): Request {
  return new Request('http://localhost/api/push/test-send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token !== undefined ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/push/test-send — production gate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.PUSH_TEST_SECRET = VALID_TOKEN
    vi.stubEnv('NODE_ENV', 'production')
  })

  it('T-134-01: returns 404 when NODE_ENV === production', async () => {
    const { POST } = await import('./route')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const res = await POST(makeRequest({ type: 'price' }, VALID_TOKEN))
    expect(res.status).toBe(404)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('POST /api/push/test-send — auth', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.PUSH_TEST_SECRET = VALID_TOKEN
    vi.stubEnv('NODE_ENV', 'test')
  })

  it('returns 403 without Authorization header', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'price' }))
    expect(res.status).toBe(403)
  })

  it('returns 403 when Bearer token does not match PUSH_TEST_SECRET', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'price' }, 'wrong-token'))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/push/test-send — canned dispatch', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.PUSH_TEST_SECRET = VALID_TOKEN
    vi.stubEnv('NODE_ENV', 'test')
  })

  it("PUSH-02: forwards canned price payload to /api/push/send", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'price' }, VALID_TOKEN))
    expect(res.status).toBe(200)
    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(String(fetchCall[0])).toContain('/api/push/send')
    const sentBody = JSON.parse(fetchCall[1]?.body as string)
    expect(sentBody.type).toBe('price')
    expect(sentBody.title).toBe('Price change alert')
  })

  it("PUSH-03: forwards canned injury payload to /api/push/send", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'injury' }, VALID_TOKEN))
    expect(res.status).toBe(200)
    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
    const sentBody = JSON.parse(fetchCall[1]?.body as string)
    expect(sentBody.type).toBe('injury')
  })

  it("PUSH-04: forwards canned deadline payload with hours_until=24", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'deadline' }, VALID_TOKEN))
    expect(res.status).toBe(200)
    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
    const sentBody = JSON.parse(fetchCall[1]?.body as string)
    expect(sentBody.type).toBe('deadline')
    expect(sentBody.hours_until).toBe(24)
  })

  it("PUSH-05: forwards canned captain payload to /api/push/send", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'captain' }, VALID_TOKEN))
    expect(res.status).toBe(200)
    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
    const sentBody = JSON.parse(fetchCall[1]?.body as string)
    expect(sentBody.type).toBe('captain')
  })
})

describe('POST /api/push/test-send — input validation', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.PUSH_TEST_SECRET = VALID_TOKEN
    vi.stubEnv('NODE_ENV', 'test')
  })

  it('returns 400 on malformed JSON body', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/push/test-send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.detail).toBe('malformed JSON')
  })

  it('returns 400 when type is not in enum', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ type: 'invalid-type' }, VALID_TOKEN))
    expect(res.status).toBe(400)
  })
})
