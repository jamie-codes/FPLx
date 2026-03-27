import type { NextRequest } from 'next/server'

const FPL_BASE = 'https://fantasy.premierleague.com/api'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ proxy: string[] }> }
) {
  const { proxy } = await params
  const path = proxy.join('/')

  // Forward query string (e.g. ?event=38 for fixtures)
  const url = new URL(request.url)
  const search = url.search

  const upstreamUrl = `${FPL_BASE}/${path}/${search}`

  try {
    const res = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'fplx/1.0',
        'Accept': 'application/json',
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      return Response.json(
        { error: 'FPL API error', status: res.status },
        { status: res.status }
      )
    }

    const data = await res.json()
    return Response.json(data)
  } catch (err) {
    return Response.json(
      { error: 'FPL API unreachable', detail: String(err) },
      { status: 502 }
    )
  }
}
