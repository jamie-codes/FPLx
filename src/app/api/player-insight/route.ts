import Anthropic from '@anthropic-ai/sdk'
import { list, put } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'
import { passesGuardrail } from '@/lib/prose-guardrail'

// Phase 105 NLP-02: Per-player LLM insight route.
// Runtime: Node.js ONLY — never Edge (@anthropic-ai/sdk SSE parsing fails on Edge).
// Trigger: on-demand POST only — never auto-fired, never streaming.
// Cost guard: ANTHROPIC_API_KEY server-side only; 503 if absent.

// Pitfall 1 (CRITICAL): Hobby plan default function timeout is 10s.
// Hobby max is 60s. 30s is a comfortable budget for haiku-4-5 with one retry.
export const maxDuration = 30

// Read USE_BLOB at request time (not module load time) so tests can override per-test.
function isUseBlob(): boolean {
  return process.env.USE_BLOB?.toLowerCase() === 'true'
}

// Zod schema for POST body validation
const PostBodySchema = z.object({
  gw: z.number().int().positive(),
  player: z.object({
    id: z.number().int().positive(),
    web_name: z.string().min(1).max(64),
    element_type: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    haul_prob: z.number().min(0).max(1).optional(),
    blank_prob: z.number().min(0).max(1).optional(),
    p10_pts: z.number().optional(),
    p90_pts: z.number().optional(),
  }),
  rejection_reasons: z.array(z.string()).max(10),
  fragility: z.object({
    tier: z.enum(['robust', 'fragile', 'knife_edge']),
    reasons: z.array(z.string()).max(10),
  }),
  lifecycle_label: z.string().max(64).optional(),
})

type PostBody = z.infer<typeof PostBodySchema>

// Position code to readable label
const POSITION_LABELS: Record<number, string> = {
  1: 'GK',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function readPlayerCorpus(): Promise<string[]> {
  let data: string
  if (isUseBlob()) {
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

function buildXmlContext(body: PostBody): string {
  const { player, rejection_reasons, fragility, lifecycle_label } = body
  const pos = POSITION_LABELS[player.element_type] ?? 'UNK'

  const mcAttr = [
    player.haul_prob !== undefined ? ` haul_prob="${player.haul_prob}"` : '',
    player.blank_prob !== undefined ? ` blank_prob="${player.blank_prob}"` : '',
    player.p10_pts !== undefined ? ` p10_pts="${player.p10_pts}"` : '',
    player.p90_pts !== undefined ? ` p90_pts="${player.p90_pts}"` : '',
  ].join('')

  const fragReasons = fragility.reasons
    .map(r => `      <reason>${xmlEscape(r)}</reason>`)
    .join('\n')
  const rejReasons = rejection_reasons
    .map(r => `      <reason>${xmlEscape(r)}</reason>`)
    .join('\n')

  return [
    '<player',
    ` name="${xmlEscape(player.web_name)}"`,
    ` position="${pos}"`,
    lifecycle_label ? ` lifecycle="${xmlEscape(lifecycle_label)}"` : '',
    '>',
    mcAttr ? `\n  <mc${mcAttr}/>` : '',
    `\n  <fragility tier="${fragility.tier}">`,
    fragReasons ? `\n${fragReasons}\n  ` : '',
    `</fragility>`,
    `\n  <reasons>`,
    rejReasons ? `\n${rejReasons}\n  ` : '',
    `</reasons>`,
    '\n</player>',
  ].join('')
}

function buildSystemPrompt(strict: boolean, playerWebName: string): string {
  const base =
    `You are an FPL analyst. Explain qualitatively whether this player is worth targeting this GW. ` +
    `Reference form, fixture, rotation risk, and haul/blank outlook. ` +
    `2–3 sentences. Do not include statistics or numeric values. ` +
    `Refer to the player by the exact name in <player name=…>.`
  if (strict) {
    return (
      base +
      `\n\nSTRICT MODE: You may mention ONLY this exact player name: ${JSON.stringify(playerWebName)}. ` +
      `Do not reference any other player by name.`
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
  const allowed = [body.player.web_name]
  const client = new Anthropic({ apiKey })
  const xmlContext = buildXmlContext(body)
  const userMsg =
    `${xmlContext}\n\nProvide a 2–3 sentence qualitative insight for this player.`

  for (let attempt = 0; attempt < 2; attempt++) {
    const system = buildSystemPrompt(attempt === 1, body.player.web_name)
    let prose = ''
    try {
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
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
      const responseBody = {
        prose,
        player_id: body.player.id,
        gw: body.gw,
        generated_at: new Date().toISOString(),
      }

      // Two-tier cache write: Vercel Blob (fire-and-forget — never fail the response)
      if (isUseBlob()) {
        const blobKey = `player_insights/gw${body.gw}/element_${body.player.id}.json`
        void Promise.resolve(
          put(blobKey, JSON.stringify(responseBody), {
            addRandomSuffix: false,
            allowOverwrite: true,
            access: 'public',
          }),
        ).catch(() => {
          // Cache write failure must never block the response (D-09)
        })
      }

      return Response.json(responseBody, { status: 200 })
    }
  }

  return Response.json({ error: 'Guardrail failed' }, { status: 422 })
}
