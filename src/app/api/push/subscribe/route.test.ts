// @vitest-environment node
// Phase 134 (PUSH-01): /api/push/subscribe route contract tests

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@vercel/blob', () => ({ put: vi.fn(), list: vi.fn(), del: vi.fn() }))

describe('POST /api/push/subscribe', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('PUSH-01: stores subscription with sent_reminders initialised', async () => {
    const { put } = await import('@vercel/blob')
    vi.mocked(put).mockResolvedValue({
      url: 'https://blob.url',
      pathname: 'push_subscription.json',
      contentType: 'application/json',
      contentDisposition: '',
      downloadUrl: '',
    } as any)
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint: 'https://example.push/abc', keys: { p256dh: 'p', auth: 'a' } }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(vi.mocked(put)).toHaveBeenCalledOnce()
    const putArg = vi.mocked(put).mock.calls[0]
    expect(putArg[0]).toBe('push_subscription.json')
    const storedStr = putArg[1] as string
    expect(storedStr).toContain('"sent_reminders"')
    expect(storedStr).toContain('"fired_24h":false')
    expect(putArg[2]).toMatchObject({ allowOverwrite: true, contentType: 'application/json' })
  })

  it('PUSH-01: returns 400 on malformed JSON', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/push/subscribe', {
      method: 'POST',
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.detail).toBe('malformed JSON')
  })

  it('PUSH-01: returns 400 when keys.p256dh missing', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint: 'https://example.push/abc', keys: { auth: 'a' } }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(typeof body.detail).toBe('string')
    expect(body.detail.length).toBeGreaterThan(0)
  })
})

describe('DELETE /api/push/subscribe', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('PUSH-01: removes stored subscription via blob.del and returns 204', async () => {
    const { list, del } = await import('@vercel/blob')
    vi.mocked(list).mockResolvedValue({
      blobs: [
        {
          url: 'https://blob.url/push_subscription.json',
          pathname: 'push_subscription.json',
          size: 0,
          uploadedAt: new Date(),
          downloadUrl: '',
          etag: 'test-etag',
        },
      ],
      cursor: undefined,
      hasMore: false,
    })
    vi.mocked(del).mockResolvedValue(undefined as any)
    const { DELETE } = await import('./route')
    const req = new Request('http://localhost/api/push/subscribe', { method: 'DELETE' })
    const res = await DELETE(req)
    expect(res.status).toBe(204)
    expect(vi.mocked(del)).toHaveBeenCalledWith('https://blob.url/push_subscription.json')
  })

  it('PUSH-01: returns 204 idempotent when no subscription stored', async () => {
    const { list, del } = await import('@vercel/blob')
    vi.mocked(list).mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false })
    const { DELETE } = await import('./route')
    const req = new Request('http://localhost/api/push/subscribe', { method: 'DELETE' })
    const res = await DELETE(req)
    expect(res.status).toBe(204)
    expect(vi.mocked(del)).not.toHaveBeenCalled()
  })

  it('PUSH-01: DELETE returns 500 when blob list throws', async () => {
    const { list } = await import('@vercel/blob')
    vi.mocked(list).mockRejectedValue(new Error('boom'))
    const { DELETE } = await import('./route')
    const req = new Request('http://localhost/api/push/subscribe', { method: 'DELETE' })
    const res = await DELETE(req)
    expect(res.status).toBe(500)
  })
})
