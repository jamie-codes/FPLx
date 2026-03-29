import type { ClubForm, ClubFormFixture, DifficultyTier } from '@/lib/types'

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
    })
  }
  return result
}
