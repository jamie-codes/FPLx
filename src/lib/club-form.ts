import type { ClubForm, ClubFormFixture, DifficultyTier } from '@/lib/types'

// Phase 75 HEAT-07: lifted from inner scope so FixtureHeatMap can import.
// Tier classification uses FPL-difficulty-scale (fplToAttDiff 0–1).
// attDiff <= 0.4 → easy (FPL 1–2), attDiff >= 0.6 → hard (FPL 4–5), else medium.
/** Finished games needed before a fixture-swing baseline means anything. */
export const MIN_PAST_FIXTURES = 2

export function tier(diff: number): DifficultyTier {
  if (diff <= 0.4) return 'easy'
  if (diff >= 0.6) return 'hard'
  return 'medium'
}

/** Planner (2026-08-29): per-team ease/count over an explicit GW window.
 *
 * ease = sum(1 - difficulty) / windowIds.size — "easy-fixture volume per GW
 * slot": blank GWs drag the score toward 0 and DGWs boost it, which is what a
 * wildcard/bench-boost planner actually ranks by (a team with one easy game
 * and seven blanks is NOT the best run). ease is null when the team has no
 * upcoming fixtures in the window. Single source of truth for the heat map's
 * Ease column and its Best-run sort.
 */
export function windowEaseStats(
  fixtures: ClubFormFixture[],
  windowIds: ReadonlySet<number>,
  key: 'attacking_difficulty' | 'defensive_difficulty',
): { ease: number | null; count: number } {
  let sum = 0
  let count = 0
  for (const f of fixtures) {
    if (!windowIds.has(f.event_id)) continue
    sum += 1 - f[key]
    count++
  }
  if (count === 0 || windowIds.size === 0) return { ease: null, count: 0 }
  return { ease: sum / windowIds.size, count }
}

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
  team_h_difficulty: number
  team_a_difficulty: number
  event: number | null
  finished: boolean
}

interface RawTeam {
  id: number
  name: string
  short_name: string
}

interface RawEvent {
  id: number
  is_current: boolean
  finished: boolean
}

interface RawBootstrap {
  teams: RawTeam[]
  events?: RawEvent[]
}

export function computeClubForm(bootstrap: RawBootstrap, fixtures: RawFixture[]): ClubForm[] {
  const WINDOW = 5
  const LOOKAHEAD = 32

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
  // NOT inverted — high goals scored = HIGH difficulty for opponent's defenders
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

  // FPL official difficulty ratings (1=easy, 5=hard) normalised to 0–1 attacking_difficulty.
  // This replaces the rolling xGA formula which was too noisy over short windows.
  const fplToAttDiff = (fplDiff: number) => (fplDiff - 1) / 4

  for (const fix of upcoming) {
    const hList = teamUpcoming.get(fix.team_h)
    if (hList && hList.length < LOOKAHEAD) {
      const opp = teams.get(fix.team_a)
      const attDiff = fplToAttDiff(fix.team_h_difficulty)
      hList.push({
        opponent_team: opp?.short_name ?? String(fix.team_a),
        is_home: true,
        event_id: fix.event!,
        difficulty_score: attDiff,
        difficulty_tier: tier(attDiff),
        attacking_difficulty: attDiff,
        defensive_difficulty: defScore(fix.team_a),
      })
    }
    const aList = teamUpcoming.get(fix.team_a)
    if (aList && aList.length < LOOKAHEAD) {
      const opp = teams.get(fix.team_h)
      const attDiff = fplToAttDiff(fix.team_a_difficulty)
      aList.push({
        opponent_team: opp?.short_name ?? String(fix.team_h),
        is_home: false,
        event_id: fix.event!,
        difficulty_score: attDiff,
        difficulty_tier: tier(attDiff),
        attacking_difficulty: attDiff,
        defensive_difficulty: defScore(fix.team_h),
      })
    }
  }

  // Phase 111 FIX-01: Derive current GW from events (is_current flag; fallback to last finished).
  const currentGw: number | null =
    bootstrap.events?.find(e => e.is_current)?.id ??
    bootstrap.events?.filter(e => e.finished).sort((a, b) => a.id - b.id).slice(-1)[0]?.id ??
    null

  // Phase 111 FIX-01: Build current_gw_played — finished fixtures from active GW per team.
  const teamPlayedCurrentGw = new Map<number, ClubFormFixture[]>()
  for (const t of teams.keys()) teamPlayedCurrentGw.set(t, [])

  if (currentGw !== null) {
    const currentGwFinished = finished.filter(f => f.event === currentGw)
    for (const fix of currentGwFinished) {
      const hList = teamPlayedCurrentGw.get(fix.team_h)
      if (hList) {
        const opp = teams.get(fix.team_a)
        const attDiff = fplToAttDiff(fix.team_h_difficulty)
        hList.push({
          opponent_team: opp?.short_name ?? String(fix.team_a),
          is_home: true,
          event_id: fix.event!,
          difficulty_score: attDiff,
          difficulty_tier: tier(attDiff),
          attacking_difficulty: attDiff,
          defensive_difficulty: defScore(fix.team_a),
        })
      }
      const aList = teamPlayedCurrentGw.get(fix.team_a)
      if (aList) {
        const opp = teams.get(fix.team_h)
        const attDiff = fplToAttDiff(fix.team_a_difficulty)
        aList.push({
          opponent_team: opp?.short_name ?? String(fix.team_h),
          is_home: false,
          event_id: fix.event!,
          difficulty_score: attDiff,
          difficulty_tier: tier(attDiff),
          attacking_difficulty: attDiff,
          defensive_difficulty: defScore(fix.team_h),
        })
      }
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
    const upcomingFx = teamUpcoming.get(tId) ?? []
    const attacking_ease_1gw = meanEase(upcomingFx, 1, 'attacking_difficulty')
    const attacking_ease_3gw = meanEase(upcomingFx, 3, 'attacking_difficulty')
    const attacking_ease_5gw = meanEase(upcomingFx, 5, 'attacking_difficulty')

    // Phase 47 SWG-01..SWG-03 (D-03/D-04): past ease from most recent 3 finished fixtures.
    // Build ClubFormFixture-compatible objects from RawFixture for the meanEase() helper.
    const finishedFx = (teamFinished.get(tId) ?? []).slice(-3).map(f => ({
      opponent_team: '',
      is_home: f.team_h === tId,
      event_id: f.event ?? 0,
      difficulty_score: 0,
      difficulty_tier: 'medium' as const,
      attacking_difficulty: fplToAttDiff(f.team_h === tId ? f.team_h_difficulty : f.team_a_difficulty),
      defensive_difficulty: 0,
    }))
    // meanEase returns null only when no fixtures have a numeric attacking_difficulty.
    // fplToAttDiff always produces a number, so null here is only possible if finishedFx
    // is built from an external source with missing values. Swing fields null-guard downstream.
    // SWING-02 (2026-09-02): the baseline needs at least MIN_PAST_FIXTURES
    // finished games, not exactly three. Requiring three meant every swing was
    // null until GW4 and the Fixture Swing Detector showed nothing at all —
    // reported as "doesn't work" while Newcastle's fixtures were visibly
    // improving. Two games is a thin baseline but it is a real one, and
    // meanEase averages however many are present (up to three).
    const past_ease_3gw = finishedFx.length >= MIN_PAST_FIXTURES
      ? meanEase(finishedFx, 3, 'attacking_difficulty')
      : null

    result.push({
      team_id: tId,
      team_name: t.name,
      team_short_name: t.short_name,
      wins, draws, losses,
      goals_scored: gs,
      goals_conceded: gc,
      upcoming_fixtures: upcomingFx,
      current_gw_played: teamPlayedCurrentGw.get(tId) ?? [],   // Phase 111 FIX-01
      // Phase 27 FIX-01 — per-team ease aggregates (null when window has zero fixtures — BGW)
      attacking_ease_1gw,
      attacking_ease_3gw,
      attacking_ease_5gw,
      defensive_ease_1gw: meanEase(upcomingFx, 1, 'defensive_difficulty'),
      defensive_ease_3gw: meanEase(upcomingFx, 3, 'defensive_difficulty'),
      defensive_ease_5gw: meanEase(upcomingFx, 5, 'defensive_difficulty'),
      // Phase 47 SWG-01..SWG-03 (D-03/D-04/D-05): fixture swing fields
      past_ease_3gw,
      swing_1gw: attacking_ease_1gw != null && past_ease_3gw != null ? attacking_ease_1gw - past_ease_3gw : null,
      swing_3gw: attacking_ease_3gw != null && past_ease_3gw != null ? attacking_ease_3gw - past_ease_3gw : null,
      swing_5gw: attacking_ease_5gw != null && past_ease_3gw != null ? attacking_ease_5gw - past_ease_3gw : null,
    })
  }
  return result
}
