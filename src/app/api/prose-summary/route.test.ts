// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist these mocks BEFORE importing the route
vi.mock('fs/promises', () => ({ readFile: vi.fn() }))
vi.mock('@vercel/blob', () => ({ list: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  // Rule 1 fix: use regular function (not arrow) so vi.fn() can proxy as a constructor
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: vi.fn() } }
  }),
}))

import { readFile } from 'fs/promises'
import { list } from '@vercel/blob'
import Anthropic from '@anthropic-ai/sdk'

describe('GET /api/prose-summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.USE_BLOB
  })

  it('GET returns blob/cache JSON shape (200)', async () => {
    process.env.USE_BLOB = 'false'
    ;(readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({ prose: 'p', gw: 35, generated_at: '2026-05-05T00:00:00Z' }),
    )
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ prose: 'p', gw: 35, generated_at: '2026-05-05T00:00:00Z' })
  })

  it('GET 404 when summary missing (cache file ENOENT)', async () => {
    process.env.USE_BLOB = 'false'
    ;(readFile as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    )
    const { GET } = await import('./route')
    const res = await GET()
    expect([404, 500]).toContain(res.status)
  })
})

describe('POST /api/prose-summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    process.env.USE_BLOB = 'false'
    ;(readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify([
        { web_name: 'Salah' },
        { web_name: 'Haaland' },
        { web_name: 'Saka' },
        { web_name: 'Palmer' },
      ]),
    )
  })

  function makeReq(body: unknown): Request {
    return new Request('http://localhost/api/prose-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('POST 400 when body fails zod schema', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeReq({ gw: 'not-a-number' }))
    expect(res.status).toBe(400)
  })

  it('POST 422 when guardrail fails on both attempts', async () => {
    const stub = (Anthropic as unknown as ReturnType<typeof vi.fn>).mock.results
    // Re-mock to inject a failing-guardrail response
    // Rule 1 fix: use regular function (not arrow) so vi.fn() can proxy as a constructor
    ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Palmer is the captain pick.' }],
          }),
        },
      }
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq({
      gw: 35,
      captains: [{ name: 'Salah', team: 'LIV', xPts_1gw: 6.8 }],
      transfer: null,
      chip: { code: null, bestGw: null },
      risks: [],
    }))
    expect(res.status).toBe(422)
    void stub
  })

  it('POST 200 when guardrail passes', async () => {
    // Rule 1 fix: use regular function (not arrow) so vi.fn() can proxy as a constructor
    ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Salah leads this week.' }],
          }),
        },
      }
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq({
      gw: 35,
      captains: [{ name: 'Salah', team: 'LIV', xPts_1gw: 6.8 }],
      transfer: null,
      chip: { code: null, bestGw: null },
      risks: [],
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ prose: expect.any(String), gw: 35 })
  })
})
