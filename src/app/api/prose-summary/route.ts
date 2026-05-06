import Anthropic from '@anthropic-ai/sdk'
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'
import { passesGuardrail } from '@/lib/prose-guardrail'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

// Pitfall 1 (CRITICAL): Hobby plan default function timeout is 10s.
// Hobby max is 60s. 30s is a comfortable budget for haiku-4-5 with one retry.
export const maxDuration = 30

// ---- Existing GET handler from Plan 02 (preserved verbatim) ----

export async function GET() {
  try {
    let data: string

    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'weekly_summary.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'Summary not available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      if (!res.ok) {
        return Response.json(
          { error: `Blob fetch failed: ${res.status}` },
          { status: 502 }
        )
      }
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'weekly_summary.json')
      try {
        data = await readFile(cachePath, 'utf-8')
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code
        if (code === 'ENOENT') {
          return Response.json({ error: 'Summary not available' }, { status: 404 })
        }
        throw err
      }
    }

    const parsed = JSON.parse(data)
    return Response.json(parsed, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  } catch {
    return Response.json({ error: 'Failed to load summary' }, { status: 500 })
  }
}

// ---- New POST handler (Phase 67 NLP-02 squad-aware refresh) ----

const PostBodySchema = z.object({
  gw: z.number().int().positive(),
  captains: z
    .array(
      z.object({
        name: z.string().min(1).max(64),
        team: z.string().min(2).max(8),
        xPts_1gw: z.number().nullable(),
      }),
    )
    .min(1)
    .max(5),
  transfer: z
    .object({
      sell: z.string().min(1).max(64),
      buy: z.string().min(1).max(64),
      delta: z.number(),
    })
    .nullable(),
  chip: z.object({
    code: z.enum(['bboost', '3xc', 'freehit', 'wildcard']).nullable(),
    bestGw: z.number().nullable(),
  }),
  risks: z
    .array(
      z.object({
        name: z.string().min(1).max(64),
        label: z.string().min(1).max(32),
      }),
    )
    .max(11),
})

type PostBody = z.infer<typeof PostBodySchema>

async function readPlayerCorpus(): Promise<string[]> {
  let data: string
  if (USE_BLOB) {
    const { blobs } = await list({ prefix: 'merged_players.json', limit: 1 })
    if (!blobs.length) return []
    const res = await fetch(blobs[0].url)
    if (!res.ok) return []
    data = await res.text()
  } else {
    const cachePath = join(process.cwd(), 'pipeline', 'cache', 'merged_players.json')
    try {
      data = await readFile(cachePath, 'utf-8')
    } catch {
      return []
    }
  }
  try {
    const players = JSON.parse(data) as Array<{ web_name?: string }>
    return players.map(p => p.web_name).filter((n): n is string => !!n)
  } catch {
    return []
  }
}

function collectAllowedNames(body: PostBody): string[] {
  const out: string[] = []
  for (const c of body.captains) out.push(c.name)
  if (body.transfer) {
    out.push(body.transfer.sell)
    out.push(body.transfer.buy)
  }
  for (const r of body.risks) out.push(r.name)
  return out
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildUserPrompt(body: PostBody): string {
  const cap = body.captains
    .map(c => `  <player name="${xmlEscape(c.name)}" team="${xmlEscape(c.team)}" />`)
    .join('\n')
  const transferTag = body.transfer
    ? `<transfer sell="${xmlEscape(body.transfer.sell)}" buy="${xmlEscape(body.transfer.buy)}" />`
    : ''
  const chipTag = body.chip.code
    ? `<chip code="${body.chip.code}" bestGw="${body.chip.bestGw ?? ''}" />`
    : ''
  const risks = body.risks
    .map(r => `  <player name="${xmlEscape(r.name)}" label="${xmlEscape(r.label)}" />`)
    .join('\n')
  return (
    '<input>\n' +
    `<captains>\n${cap}\n</captains>\n` +
    (transferTag ? `${transferTag}\n` : '') +
    (chipTag ? `${chipTag}\n` : '') +
    (risks ? `<risks>\n${risks}\n</risks>\n` : '') +
    '</input>\n\n' +
    "Write a concise 4-5 sentence summary of this manager's top decisions this gameweek. " +
    'Reference only players inside <input>. Quote their names verbatim. ' +
    'Refer to players qualitatively — do not include statistics, projected points, or numeric values.'
  )
}

function buildSystemPrompt(strict: boolean, allowedDisplay: string[]): string {
  const base =
    "You are an FPL analyst. Write a concise 4-5 sentence summary of this " +
    "manager's gameweek decisions, using only the data provided in the " +
    '<input> XML block. Quote player names exactly as they appear. Do not ' +
    'mention any player not in the input. Refer to players qualitatively.'
  if (strict) {
    return (
      base +
      `\n\nSTRICT MODE: You may mention only these exact player names: ${JSON.stringify(allowedDisplay.sort())}.`
    )
  }
  return base
}

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body', detail: 'malformed JSON' }, { status: 400 })
  }

  const parsed = PostBodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request body', detail: parsed.error.message },
      { status: 400 },
    )
  }
  const body = parsed.data

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const corpus = await readPlayerCorpus()
  const allowed = collectAllowedNames(body)
  const client = new Anthropic({ apiKey })
  const userMsg = buildUserPrompt(body)

  for (let attempt = 0; attempt < 2; attempt++) {
    const system = buildSystemPrompt(attempt === 1, allowed)
    let prose = ''
    try {
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        system,
        messages: [{ role: 'user', content: userMsg }],
      })
      const block = msg.content[0]
      prose = block && block.type === 'text' ? block.text : ''
    } catch {
      return Response.json({ error: 'LLM error', detail: 'upstream call failed' }, { status: 502 })
    }

    if (!prose.trim()) continue

    if (passesGuardrail(prose, allowed, corpus)) {
      return Response.json(
        {
          prose,
          gw: body.gw,
          generated_at: new Date().toISOString(),
        },
        { status: 200 },
      )
    }
  }

  return Response.json({ error: 'Guardrail failed' }, { status: 422 })
}
