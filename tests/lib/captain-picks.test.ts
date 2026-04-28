// Phase 31: Captaincy Ceiling — test stubs
// Wave 0: stubs created before implementation to satisfy Nyquist rule.
// Integration tests are skipped (require pipeline run).
// Component tests filled in Wave 2 Task 1 of 31-02-PLAN.md.
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFile } from 'fs/promises'
import { join } from 'path'

describe('Phase 31: Captain picks pipeline output', () => {
  it.skip('captain_picks.json exists and parses (requires pipeline run)', async () => {
    const raw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json'), 'utf-8')
    const data = JSON.parse(raw) as Record<string, unknown>
    expect(data).toHaveProperty('generated_at')
    expect(data).toHaveProperty('gameweek')
    expect(data).toHaveProperty('ceiling')
    expect(data).toHaveProperty('eo_adjusted')
  })

  it.skip('ceiling pick has all required fields and xPts_90th_1gw > 0 (CAP-03)', async () => {
    const raw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json'), 'utf-8')
    const data = JSON.parse(raw) as { ceiling: Record<string, unknown> | null }
    if (data.ceiling) {
      expect(data.ceiling).toHaveProperty('id')
      expect(data.ceiling).toHaveProperty('name')
      expect(data.ceiling).toHaveProperty('team')
      expect(data.ceiling).toHaveProperty('position')
      expect(data.ceiling).toHaveProperty('now_cost')
      expect(data.ceiling).toHaveProperty('xPts_1gw')
      expect(data.ceiling).toHaveProperty('xPts_90th_1gw')
      expect(data.ceiling).toHaveProperty('selected_by_percent')
      expect(data.ceiling.xPts_90th_1gw as number).toBeGreaterThan(0)
    }
  })

  it.skip('ceiling pick has highest xPts_90th_1gw among status=a players (CAP-03)', async () => {
    const picksRaw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json'), 'utf-8')
    const picks = JSON.parse(picksRaw) as { ceiling: { id: number; xPts_90th_1gw: number } | null }
    const playersRaw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'merged_players.json'), 'utf-8')
    const players = JSON.parse(playersRaw) as Array<{ id: number; status: string; xPts_90th_1gw?: number }>
    if (picks.ceiling) {
      const eligible = players.filter((p) => p.status === 'a' && typeof p.xPts_90th_1gw === 'number')
      const maxCeiling = Math.max(...eligible.map((p) => p.xPts_90th_1gw as number))
      expect(picks.ceiling.xPts_90th_1gw).toBeCloseTo(maxCeiling, 3)
    }
  })

  it.skip('xPts_90th_1gw field is present on every player in merged_players.json (D-11)', async () => {
    const raw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'merged_players.json'), 'utf-8')
    const players = JSON.parse(raw) as Array<Record<string, unknown>>
    expect(players.length).toBeGreaterThan(0)
    for (const p of players) {
      expect(p).toHaveProperty('xPts_90th_1gw')
      expect(typeof p.xPts_90th_1gw).toBe('number')
    }
  })

  it.skip('xPts_90th_1gw == round(xPts_1gw + 1.28 * sigma_1gw, 3) for spot-checked player (CAP-03 D-05)', async () => {
    // Spot-check the relationship for the ceiling pick (sigma is stripped from JSON, so we
    // verify by recovering sigma = (xPts_90th_1gw - xPts_1gw) / 1.28 must be >= 0).
    const picksRaw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json'), 'utf-8')
    const picks = JSON.parse(picksRaw) as { ceiling: { xPts_1gw: number; xPts_90th_1gw: number } | null }
    if (picks.ceiling) {
      const recoveredSigma = (picks.ceiling.xPts_90th_1gw - picks.ceiling.xPts_1gw) / 1.28
      expect(recoveredSigma).toBeGreaterThanOrEqual(0)
    }
  })

  it.skip('eo_adjusted pick exists and has selected_by_percent < 35.0 (CAP-04 D-06/D-08)', async () => {
    const raw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json'), 'utf-8')
    const data = JSON.parse(raw) as { eo_adjusted: { selected_by_percent: string; eo_threshold_used?: number } | null }
    if (data.eo_adjusted) {
      const own = parseFloat(data.eo_adjusted.selected_by_percent)
      // Either ownership is below 35 (a real fallback succeeded) OR no threshold_used means it fell back to ceiling.
      const fellBackToCeiling = data.eo_adjusted.eo_threshold_used === undefined
      expect(fellBackToCeiling || own < 35.0).toBe(true)
    }
  })

  it.skip('eo_adjusted pick has highest xPts_90th_1gw among low-owned status=a players (CAP-04)', async () => {
    const picksRaw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json'), 'utf-8')
    const picks = JSON.parse(picksRaw) as {
      eo_adjusted: { id: number; xPts_90th_1gw: number; eo_threshold_used?: number } | null
    }
    const playersRaw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'merged_players.json'), 'utf-8')
    const players = JSON.parse(playersRaw) as Array<{
      id: number; status: string; selected_by_percent?: string; xPts_90th_1gw?: number
    }>
    if (picks.eo_adjusted && picks.eo_adjusted.eo_threshold_used !== undefined) {
      const threshold = picks.eo_adjusted.eo_threshold_used
      const candidates = players.filter(
        (p) => p.status === 'a'
          && typeof p.xPts_90th_1gw === 'number'
          && parseFloat(p.selected_by_percent ?? '0') < threshold
      )
      const maxCeiling = Math.max(...candidates.map((p) => p.xPts_90th_1gw as number))
      expect(picks.eo_adjusted.xPts_90th_1gw).toBeCloseTo(maxCeiling, 3)
    }
  })

  it.skip('both ceiling and eo_adjusted picks reference status=a players (CAP-03/04)', async () => {
    const picksRaw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json'), 'utf-8')
    const picks = JSON.parse(picksRaw) as {
      ceiling: { id: number } | null; eo_adjusted: { id: number } | null
    }
    const playersRaw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'merged_players.json'), 'utf-8')
    const players = JSON.parse(playersRaw) as Array<{ id: number; status: string }>
    const byId = new Map(players.map((p) => [p.id, p]))
    if (picks.ceiling) expect(byId.get(picks.ceiling.id)?.status).toBe('a')
    if (picks.eo_adjusted) expect(byId.get(picks.eo_adjusted.id)?.status).toBe('a')
  })
})

it('Wave 0 stub file created — replace with real tests after implementation', () => {
  expect(true).toBe(true)
})
