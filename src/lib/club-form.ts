import type { ClubForm, ClubFormFixture, DifficultyTier } from '@/lib/types'

function meanEase(
  fixtures: ClubFormFixture[],
  n: number,
  key: 'attacking_difficulty' | 'defensive_difficulty'
): number | null {
  const slice = fixtures.slice(0, n)
  const present = slice.filter(f => typeof f[key] === 'number')
  if (present.length === 0) return null
  const meanDifficulty = present.reduce((acc, f) => acc + (f[key] as number), 0) / present.length
  return 1 - meanDifficulty   // invert to ease (1.0 = easiest)
}

interface RawFixture {
  team_h: number
  team_a: number
  team_h_score: number | null
  team_a_score: number | null
  event: number | null
  finished: boolean
}

interface RawTeam {
  id: number
  name: string
  short_name: string
}

interface RawBootstrap {
  teams: RawTeam[]
}

export function computeClubForm(bootstrap: RawBootstrap, fixtures: RawFixture[]): ClubForm[] {
  const WINDOW = 5
  const LOOKAHEAD = 5

  const teams = new Map(bootstrap.teams.map(t => [t.id, t]))

  // 1. Finished fixtures sorted by event ascending
  const finished = fixtures
    .filter(f => f.finished && f.event != null)
    .sort((a, b) => (a.event ?? 0) - (b.event ?? 0))

  // 2. Per-team: collect all finished fixtures (chronological order)
  const teamFinished = new Map<number, RawFixture[]>()
  for (const t of teams.keys()) teamFinished.set(t, [])

  for (const fix of finished) {
    const hList = teamFinished.get(fix.team_h)
    if (hList) hList.push(fix)
    const aList = teamFinished.get(fix.team_a)
    if (aList) aList.push(fix)
  }

  // 3. Compute difficulty scores using rolling goals-conceded avg per team
  const ROLLING = 6
  const teamXga = new Map<number, number>()
  for (const [tId, fxs] of teamFinished) {
    const conceded = fxs.map(f =>
      f.team_h === tId ? (f.team_a_score ?? 0) : (f.team_h_score ?? 0)
    )
    const lastN = conceded.slice(-ROLLING)
    teamXga.set(tId, lastN.length > 0 ? lastN.reduce((a, b) => a + b, 0) / lastN.length : 0)
  }
  const xgaValues = [...teamXga.values()].sort((a, b) => a - b)
  const minXga = xgaValues.length > 0 ? Math.min(...xgaValues) : 0
  const maxXga = xgaValues.length > 0 ? Math.max(...xgaValues) : 1
  const diffScore = (tId: number) => {
    const xga = teamXga.get(tId) ?? 0
    if (maxXga === minXga) return 0.5
    return 1 - (xga - minXga) / (maxXga - minXga)
  }
  // Tier thresholds: bottom third easy (low xga = high score), top third hard
  const n = xgaValues.length
  const easyThreshScore = n >= 3
    ? 1 - ((xgaValues[Math.floor(n * 2 / 3)] ?? maxXga) - minXga) / (maxXga - minXga === 0 ? 1 : maxXga - minXga)
    : 0.33
  const hardThreshScore = n >= 3
    ? 1 - ((xgaValues[Math.floor(n / 3)] ?? minXga) - minXga) / (maxXga - minXga === 0 ? 1 : maxXga - minXga)
    : 0.67
  const tier = (score: number): DifficultyTier => {
    if (score >= hardThreshScore) return 'hard'
    if (score <= easyThreshScore) return 'easy'
    return 'medium'
  }

  // Phase 27 FDR++ — parallel 3-game goals-scored window for defensive_difficulty
  const OFFENSIVE_ROLLING = 3
  const teamGoalsScored = new Map<number, number>()
  for (const [tId, fxs] of teamFinished) {
    const scored = fxs.map(f =>
      f.team_h === tId ? (f.team_h_score ?? 0) : (f.team_a_score ?? 0)
    )
    const lastN = scored.slice(-OFFENSIVE_ROLLING)
    teamGoalsScored.set(tId, lastN.length > 0 ? lastN.reduce((a, b) => a + b, 0) / lastN.length : 0)
  }
  const xgsValues = [...teamGoalsScored.values()].sort((a, b) => a - b)
  const minXgs = xgsValues.length > 0 ? Math.min(...xgsValues) : 0
  const maxXgs = xgsValues.length > 0 ? Math.max(...xgsValues) : 1
  // NOT inverted (unlike diffScore) — high goals scored = HIGH difficulty for opponent's defenders
  const defScore = (tId: number) => {
    const xgs = teamGoalsScored.get(tId) ?? 0
    if (maxXgs === minXgs) return 0.5
    return (xgs - minXgs) / (maxXgs - minXgs)
  }

  // 4. Upcoming fixtures per team
  const upcoming = fixtures
    .filter(f => !f.finished && f.event != null)
    .sort((a, b) => (a.event ?? 0) - (b.event ?? 0))

  const teamUpcoming = new Map<number, ClubFormFixture[]>()
  for (const t of teams.keys()) teamUpcoming.set(t, [])

  for (const fix of upcoming) {
    const hList = teamUpcoming.get(fix.team_h)
    if (hList && hList.length < LOOKAHEAD) {
      const opp = teams.get(fix.team_a)
      const ds = diffScore(fix.team_a)
      hList.push({
        opponent_team: opp?.short_name ?? String(fix.team_a),
        is_home: true,
        event_id: fix.event!,
        difficulty_score: ds,
        difficulty_tier: tier(ds),
        attacking_difficulty: ds,                    // Phase 27 DATA-01 D-01 — same as difficulty_score
        defensive_difficulty: defScore(fix.team_a),  // Phase 27 DATA-01 D-02
      })
    }
    const aList = teamUpcoming.get(fix.team_a)
    if (aList && aList.length < LOOKAHEAD) {
      const opp = teams.get(fix.team_h)
      const ds = diffScore(fix.team_h)
      aList.push({
        opponent_team: opp?.short_name ?? String(fix.team_h),
        is_home: false,
        event_id: fix.event!,
        difficulty_score: ds,
        difficulty_tier: tier(ds),
        attacking_difficulty: ds,
        defensive_difficulty: defScore(fix.team_h),
      })
    }
  }

  // 5. Aggregate form stats from last WINDOW finished fixtures per team
  const result: ClubForm[] = []
  for (const [tId, t] of teams) {
    const last5 = (teamFinished.get(tId) ?? []).slice(-WINDOW)
    let wins = 0, draws = 0, losses = 0, gs = 0, gc = 0
    for (const fix of last5) {
      const isHome = fix.team_h === tId
      const scored = isHome ? (fix.team_h_score ?? 0) : (fix.team_a_score ?? 0)
      const conceded = isHome ? (fix.team_a_score ?? 0) : (fix.team_h_score ?? 0)
      gs += scored
      gc += conceded
      if (scored > conceded) wins++
      else if (scored === conceded) draws++
      else losses++
    }
    result.push({
      team_id: tId,
      team_name: t.name,
      team_short_name: t.short_name,
      wins, draws, losses,
      goals_scored: gs,
      goals_conceded: gc,
      upcoming_fixtures: teamUpcoming.get(tId) ?? [],
      // Phase 27 FIX-01 — per-team ease aggregates (null when window has zero fixtures — BGW)
      attacking_ease_1gw: meanEase(teamUpcoming.get(tId) ?? [], 1, 'attacking_difficulty'),
      attacking_ease_3gw: meanEase(teamUpcoming.get(tId) ?? [], 3, 'attacking_difficulty'),
      attacking_ease_5gw: meanEase(teamUpcoming.get(tId) ?? [], 5, 'attacking_difficulty'),
      defensive_ease_1gw: meanEase(teamUpcoming.get(tId) ?? [], 1, 'defensive_difficulty'),
      defensive_ease_3gw: meanEase(teamUpcoming.get(tId) ?? [], 3, 'defensive_difficulty'),
      defensive_ease_5gw: meanEase(teamUpcoming.get(tId) ?? [], 5, 'defensive_difficulty'),
    })
  }
  return result
}
