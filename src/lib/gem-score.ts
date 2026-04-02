import type { MergedPlayer, ScoredPlayer } from '@/lib/types'

interface DimensionStats {
  fdr: { min: number; max: number }
  form: { min: number; max: number }
  xg: { min: number; max: number }
  xa: { min: number; max: number }
  ownership: { min: number; max: number }
  minutes: { min: number; max: number }
  setpiece: { min: number; max: number }
}

function minMax(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 }
  let min = values[0]
  let max = values[0]
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  return { min, max }
}

function normalise(value: number, stats: { min: number; max: number }): number {
  if (stats.max === stats.min) return 0.5
  const raw = (value - stats.min) / (stats.max - stats.min)
  return Math.min(1, Math.max(0, raw))
}

function setpieceRank(p: MergedPlayer): number {
  const isPenaltyTaker = p.penalties_order === 1
  const isFreekickTaker = p.direct_freekicks_order === 1
  const isCornerTaker = p.corners_and_indirect_freekicks_order === 1
  const isSecondary = [p.penalties_order, p.direct_freekicks_order, p.corners_and_indirect_freekicks_order]
    .some(o => o !== null && o === 2)

  if (isPenaltyTaker || isFreekickTaker || isCornerTaker) return 2
  if (isSecondary) return 1
  return 0
}

function avgDifficulty(player: MergedPlayer): number {
  if (player.fixtures.length === 0) return 0.5
  return player.fixtures.reduce((s, f) => s + f.difficulty_score, 0) / player.fixtures.length
}

export function computeAllGemScores(players: MergedPlayer[]): ScoredPlayer[] {
  // Pass 1: compute raw values and collect stats
  const rawFdr = players.map(p => 1.0 - avgDifficulty(p))
  const rawForm = players.map(p => p.form_pts_per90)
  const rawXg = players.filter(p => p.xg_per90 !== null).map(p => p.xg_per90 as number)
  const rawXa = players.filter(p => p.xa_per90 !== null).map(p => p.xa_per90 as number)
  const rawOwnership = players.map(p => 1.0 - parseFloat(p.selected_by_percent) / 100)
  const rawMinutes = players.map(p => p.minutes_per90)
  const rawSetpiece = players.map(p => setpieceRank(p))

  const stats: DimensionStats = {
    fdr: minMax(rawFdr),
    form: minMax(rawForm),
    xg: minMax(rawXg),
    xa: minMax(rawXa),
    ownership: minMax(rawOwnership),
    minutes: minMax(rawMinutes),
    setpiece: minMax(rawSetpiece),
  }

  // Pass 2: score each player
  return players.map((player) => {
    const dims: number[] = []

    const fdrRaw = 1.0 - avgDifficulty(player)
    const fdr_score = normalise(fdrRaw, stats.fdr)
    dims.push(fdr_score)

    const form_score = normalise(player.form_pts_per90, stats.form)
    dims.push(form_score)

    // DQ-01: xg_per90/xa_per90 are now always numeric (proxy from goals/assists when Understat missing)
    // Keep null guard for safety but it should never trigger after pipeline changes
    let xg_score: number | null = null
    if (player.xg_per90 !== null && player.xg_per90 !== undefined) {
      xg_score = normalise(player.xg_per90, stats.xg)
      dims.push(xg_score)
    }

    let xa_score: number | null = null
    if (player.xa_per90 !== null && player.xa_per90 !== undefined) {
      xa_score = normalise(player.xa_per90, stats.xa)
      dims.push(xa_score)
    }

    const ownershipRaw = 1.0 - parseFloat(player.selected_by_percent) / 100
    const ownership_score = normalise(ownershipRaw, stats.ownership)
    dims.push(ownership_score)

    const minutes_score = normalise(player.minutes_per90, stats.minutes)
    dims.push(minutes_score)

    const spRank = setpieceRank(player)
    const set_piece_score = normalise(spRank, stats.setpiece)
    dims.push(set_piece_score)

    const gem_score = dims.reduce((s, d) => s + d, 0) / dims.length

    return {
      ...player,
      gem_score,
      fdr_score,
      form_score,
      xg_score,
      xa_score,
      ownership_score,
      minutes_score,
      set_piece_score,
    }
  })
}
