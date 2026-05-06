// Phase 62 (MC-03 D-04): GET /api/gw-average — returns the most recent non-zero
// average_score from the gw_review_gw{N}.json cache files (Research §Pitfall 3).
//
// Research §Pitfall 3: `events[next].average_entry_score` is 0 pre-deadline — the FPL API
// only populates average_entry_score for finished GWs. This route reads from the
// already-settled gw_review_gw{N}.json files (written by pipeline/run.py PGW-02) to
// get the most recent non-zero GW average. Falls back to { gw: null, average_score: null }
// when no settled GW file exists (e.g. fresh checkout or pre-season).
//
// Security (T-62-06): No user input reaches readFile. The gw counter is hard-coded
// in the range 1..38 (full FPL season). No path traversal surface.
import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'   // Re-read filesystem on every request (no static generation)
export const revalidate = 1800           // 30-min Next.js cache TTL — matches /api/players policy

interface GwReview {
  gw: number | null
  average_score?: number
  [key: string]: unknown
}

export async function GET() {
  // Search GWs 38 → 1 (full FPL season range); stop at first file with a settled
  // (non-null gw, non-zero average_score) entry.
  const cacheDir = join(process.cwd(), 'pipeline', 'cache')

  for (let gw = 38; gw >= 1; gw--) {
    try {
      const raw = await readFile(join(cacheDir, `gw_review_gw${gw}.json`), 'utf-8')
      const data = JSON.parse(raw) as GwReview
      if (
        data.gw !== null &&
        typeof data.average_score === 'number' &&
        data.average_score > 0
      ) {
        return NextResponse.json({ gw: data.gw, average_score: data.average_score })
      }
    } catch {
      // File missing or parse error — try next GW number (expected in dev environment)
      continue
    }
  }

  // Fallback: no settled GW data available (seed state, pre-season, or empty cache)
  return NextResponse.json({ gw: null, average_score: null })
}
