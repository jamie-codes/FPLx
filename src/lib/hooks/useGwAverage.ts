'use client'
// Phase 62 (MC-03 D-04): useGwAverage — pulls the most recent non-zero FPL GW average score.
// Used by RankSimTab as the baseline for the beat-the-average heuristic (D-03).
// Returns { gw, average_score } — both null when no settled GW data is available.
// Research §Pitfall 3: average_score is 0 pre-deadline for the upcoming GW; this route
// reads from already-settled gw_review_gw{N}.json files (written by pipeline/run.py PGW-02).
import { useQuery } from '@tanstack/react-query'

export interface GwAverageData {
  gw: number | null
  average_score: number | null
}

async function fetchGwAverage(): Promise<GwAverageData> {
  const res = await fetch('/api/gw-average')
  if (!res.ok) throw new Error(`GW average fetch failed: ${res.status}`)
  return res.json()
}

export function useGwAverage() {
  return useQuery<GwAverageData>({
    queryKey: ['gw-average'],
    queryFn: fetchGwAverage,
    staleTime: 1000 * 60 * 30,   // 30-min staleTime — matches /api/gw-average revalidate
  })
}
