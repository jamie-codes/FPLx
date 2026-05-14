// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Hoisted module mocks BEFORE any dynamic import of the route under test
vi.mock('fs/promises', () => ({ readFile: vi.fn() }))
vi.mock('@vercel/blob', () => ({ list: vi.fn(), put: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  // Rule 1 fix: use regular function (not arrow) so vi.fn() can proxy as a constructor
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: vi.fn() } }
  }),
}))

import { list, put } from '@vercel/blob'
import Anthropic from '@anthropic-ai/sdk'

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/player-insight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  gw: 35,
  player: {
    id: 100,
    web_name: 'Salah',
    element_type: 3 as const,
    haul_prob: 0.42,
    blank_prob: 0.18,
    p10_pts: 2.1,
    p90_pts: 12.8,
  },
  rejection_reasons: ['xPts 4.2 < threshold 4.7'],
  fragility: { tier: 'robust' as const, reasons: [] },
  lifecycle_label: 'in form',
}

describe('POST /api/player-insight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-key'
    process.env.USE_BLOB = 'true'
    ;(list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      blobs: [{ url: 'http://blob/merged_players.json' }],
    })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([{ web_name: 'Salah' }, { web_name: 'Haaland' }])),
    } as Response)
  })

  it('POST 400 when body fails zod schema', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeReq({ gw: 'not-a-number' }))
    expect(res.status).toBe(400)
  })

  it('503 when ANTHROPIC_API_KEY missing', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const { POST } = await import('./route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(503)
  })

  it('502 when Anthropic SDK throws', async () => {
    ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        messages: {
          create: vi.fn().mockRejectedValue(new Error('SDK error')),
        },
      }
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(502)
  })

  it('422 when both guardrail attempts fail', async () => {
    // Both attempts return prose mentioning names other than the allowed player
    ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Haaland is the best pick this week over Salah.' }],
            usage: { input_tokens: 50, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          }),
        },
      }
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(422)
  })

  it('retries with strict prompt after first guardrail fail', async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Haaland beats Salah this week.' }],
        usage: { input_tokens: 50, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Salah looks strong this gameweek.' }],
        usage: { input_tokens: 50, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      })
    ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return { messages: { create } }
    })
    const { POST } = await import('./route')
    await POST(makeReq(validBody))
    expect(create).toHaveBeenCalledTimes(2)
    // Second call should have a different (stricter) system prompt
    const firstSystemPrompt = create.mock.calls[0][0].system
    const secondSystemPrompt = create.mock.calls[1][0].system
    expect(firstSystemPrompt).not.toEqual(secondSystemPrompt)
  })

  it('200 with prose on guardrail pass', async () => {
    ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Salah looks strong this week.' }],
            usage: { input_tokens: 50, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          }),
        },
      }
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      prose: expect.any(String),
      player_id: 100,
      gw: 35,
      generated_at: expect.any(String),
    })
  })

  it('passes system as TextBlockParam[] with cache_control ephemeral on attempt 0', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Salah looks strong this week.' }],
      usage: { input_tokens: 50, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    })
    ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return { messages: { create } }
    })
    const { POST } = await import('./route')
    await POST(makeReq(validBody))
    const systemParam = create.mock.calls[0][0].system
    expect(Array.isArray(systemParam)).toBe(true)
    expect(systemParam).toHaveLength(1)
    expect(systemParam[0]).toMatchObject({
      type: 'text',
      cache_control: { type: 'ephemeral' },
    })
    expect(systemParam[0].text).toContain('FPL analyst')
  })

  it('put called with allowOverwrite true', async () => {
    ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Salah looks strong this week.' }],
            usage: { input_tokens: 50, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          }),
        },
      }
    })
    const { POST } = await import('./route')
    await POST(makeReq(validBody))
    const putOptions = (put as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[2]
    expect(putOptions).toMatchObject({
      addRandomSuffix: false,
      allowOverwrite: true,
      access: 'public',
    })
  })

  it('writes blob with key player_insights/gw35/element_100.json', async () => {
    ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Salah looks strong this week.' }],
            usage: { input_tokens: 50, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          }),
        },
      }
    })
    const { POST } = await import('./route')
    await POST(makeReq(validBody))
    const putKey = (put as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    expect(putKey).toBe('player_insights/gw35/element_100.json')
  })

  it('does NOT call put when USE_BLOB=false', async () => {
    process.env.USE_BLOB = 'false'
    ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Salah looks strong this week.' }],
            usage: { input_tokens: 50, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          }),
        },
      }
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(200)
    expect(put).not.toHaveBeenCalled()
  })

  it('cache write failure does NOT fail the response', async () => {
    ;(put as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Blob write failed'))
    ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Salah looks strong this week.' }],
            usage: { input_tokens: 50, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          }),
        },
      }
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(200)
  })

  it('does not use Edge runtime and sets maxDuration = 30', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/player-insight/route.ts'), 'utf-8')
    expect(src).not.toMatch(/runtime\s*=\s*['"]edge['"]/)
    expect(src).toMatch(/export\s+const\s+maxDuration\s*=\s*30/)
  })

  it('200 with cached prose when Blob entry exists (cache hit, no Anthropic call)', async () => {
    process.env.USE_BLOB = 'true'
    // First list call: corpus read (from beforeEach default)
    // Second list call: cache read — returns a matching blob entry
    ;(list as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ blobs: [{ url: 'http://blob/merged_players.json' }] })
      .mockResolvedValueOnce({ blobs: [{ url: 'http://blob/cache/element_100.json', pathname: 'player_insights/gw35/element_100.json' }] })
    // First fetch call: corpus URL (from beforeEach default)
    // Second fetch call: cache URL — returns the pre-generated insight
    const cachedBody = { prose: 'Cached Salah insight from batch.', player_id: 100, gw: 35, generated_at: '2026-05-14T10:00:00.000Z' }
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(JSON.stringify([{ web_name: 'Salah' }])) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(cachedBody) } as unknown as Response)
    const { POST } = await import('./route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(cachedBody)
    // The Anthropic constructor must NOT have been called (zero Claude spend on cache hit)
    expect(Anthropic as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(0)
    // Cache read was requested for the correct prefix
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ prefix: 'player_insights/gw35/element_100.json' }))
  })

  it('falls through to Anthropic generation when Blob cache misses', async () => {
    process.env.USE_BLOB = 'true'
    // First list call: corpus read; Second list call: cache lookup returns empty (cache miss)
    ;(list as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ blobs: [{ url: 'http://blob/merged_players.json' }] })
      .mockResolvedValueOnce({ blobs: [] })
    // Corpus fetch succeeds normally
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([{ web_name: 'Salah' }])),
    } as unknown as Response)
    // Anthropic SDK returns a valid guardrail-passing response
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Salah looks strong this week.' }],
      usage: { input_tokens: 50, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    })
    ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return { messages: { create } }
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.prose).toBe('Salah looks strong this week.')
    // Anthropic constructor was called (fell through to generation)
    expect(Anthropic as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1)
  })

  it('does NOT attempt Blob cache read when USE_BLOB=false', async () => {
    process.env.USE_BLOB = 'false'
    // Anthropic returns a valid response
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Salah looks strong this week.' }],
      usage: { input_tokens: 50, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    })
    ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return { messages: { create } }
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(200)
    // list must be called ZERO times (corpus read also skipped in USE_BLOB=false mode)
    expect(list).toHaveBeenCalledTimes(0)
  })

  it('falls through to Anthropic generation when cache Blob fetch throws', async () => {
    process.env.USE_BLOB = 'true'
    // First list call: corpus read; Second list call: cache lookup returns a blob
    ;(list as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ blobs: [{ url: 'http://blob/merged_players.json' }] })
      .mockResolvedValueOnce({ blobs: [{ url: 'http://blob/cache/broken.json' }] })
    // First fetch: corpus succeeds; Second fetch: cache URL throws (network error)
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(JSON.stringify([{ web_name: 'Salah' }])) } as unknown as Response)
      .mockRejectedValueOnce(new Error('network error'))
    // Anthropic SDK returns a valid guardrail-passing response
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Salah looks strong this week.' }],
      usage: { input_tokens: 50, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    })
    ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return { messages: { create } }
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(validBody))
    // Must return 200 (no exception escaped POST)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.prose).toBe('Salah looks strong this week.')
    // Anthropic constructor was called (fell through after cache error)
    expect(Anthropic as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1)
  })
})
