import type { NextRequest } from 'next/server'
import { parseSquadResponse } from '@/lib/squad-adapter'

const FPL_BASE = 'https://fantasy.premierleague.com/api'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params

  // Validate teamId is numeric
  if (!/^\d+$/.test(teamId)) {
    return Response.json({ error: 'Invalid Team ID — must be numeric' }, { status: 400 })
  }

  // Step 1: resolve current GW from bootstrap events
  const bootstrapRes = await fetch(`${FPL_BASE}/bootstrap-static/`, {
    headers: { 'User-Agent': 'fplx/1.0' },
    next: { revalidate: 3600 },
  })
  if (!bootstrapRes.ok) {
    return Response.json({ error: 'Failed to fetch FPL bootstrap' }, { status: 502 })
  }
  const bootstrap = await bootstrapRes.json()
  const currentEvent = bootstrap.events.find(
    (e: { is_current: boolean; is_next: boolean }) => e.is_current
  ) ?? bootstrap.events.find(
    (e: { is_current: boolean; is_next: boolean }) => e.is_next
  )
  if (!currentEvent) {
    return Response.json({ error: 'No active gameweek found — try again when the season is underway' }, { status: 404 })
  }

  // Step 2: fetch picks for current GW
  const picksRes = await fetch(
    `${FPL_BASE}/entry/${teamId}/event/${currentEvent.id}/picks/`,
    { headers: { 'User-Agent': 'fplx/1.0' }, next: { revalidate: 0 } }
  )
  if (!picksRes.ok) {
    return Response.json(
      { error: 'Team not found or picks unavailable', status: picksRes.status },
      { status: picksRes.status }
    )
  }

  const raw = await picksRes.json()
  const parsed = parseSquadResponse(raw)
  if (!parsed.success) {
    return Response.json({ error: 'Unexpected picks response shape', detail: String(parsed.error) }, { status: 502 })
  }

  return Response.json(parsed.data)
}
