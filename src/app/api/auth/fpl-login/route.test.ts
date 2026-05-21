// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

describe('POST /api/auth/fpl-login — Phase 130 AUTH-05 ENDPOINT_GONE stub', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
  })

  it('Test 1: POST with valid credentials body returns status 200', async () => {
    const req = new NextRequest('http://localhost/api/auth/fpl-login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('Test 2: POST with valid credentials body returns ENDPOINT_GONE body', async () => {
    const req = new NextRequest('http://localhost/api/auth/fpl-login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()
    expect(body).toEqual({ ok: false, code: 'ENDPOINT_GONE' })
  })

  it('Test 3: POST with empty body returns status 200 and ENDPOINT_GONE body', async () => {
    const req = new NextRequest('http://localhost/api/auth/fpl-login', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: false, code: 'ENDPOINT_GONE' })
  })

  it('Test 4: POST with malformed body returns status 200 and ENDPOINT_GONE body', async () => {
    const req = new NextRequest('http://localhost/api/auth/fpl-login', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: false, code: 'ENDPOINT_GONE' })
  })

  it('Test 5: handler does NOT invoke fetch (no proxy attempt to users.premierleague.com)', async () => {
    const req = new NextRequest('http://localhost/api/auth/fpl-login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(req)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
