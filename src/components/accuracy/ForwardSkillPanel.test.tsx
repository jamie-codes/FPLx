// @vitest-environment jsdom
// ACC-05: ForwardSkillPanel tests — live state + fallback state
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ForwardSkillPanel } from './ForwardSkillPanel'
import type { HonestMetrics } from '@/lib/types'

// Minimal live honest_metrics fixture (n_gws >= 8)
const liveMetrics: HonestMetrics = {
  top10_mean_pts: 5.66,
  haul_capture_20: 0.194,
  captain_return_rate: 0.60,
  haul_hit_rate: 0.12,
  mid_tier_hit_rate: 0.09,
  captain_hit_rate: 0.54,
  rmse: 3.1415,
  mae: 2.7182,
  spearman: 0.321,
  mode: 'deploy',
  n_gws: 12,
  by_position: {
    GKP: { n: 50, rmse: 1.5, n_haulers: 2 },
    DEF: { n: 120, rmse: 2.1, n_haulers: 8 },
    MID: { n: 200, rmse: 3.2, n_haulers: 15 },
    FWD: { n: 100, rmse: 3.8, n_haulers: 10 },
  },
  per_gw: [
    {
      gw: 1, n_haulers: 5, haul_hits: 2, haul_hit_rate: 0.40,
      top10_mean_pts: 5.5, spearman: 0.32,
      captain_actual: 12, captain_name: 'Salah',
    },
    {
      gw: 2, n_haulers: 3, haul_hits: 1, haul_hit_rate: 0.333,
      top10_mean_pts: 4.8, spearman: 0.28,
      captain_actual: 8, captain_name: 'Haaland',
    },
  ],
}

// Fixture below the gate (n_gws < 8) — triggers fallback
const belowGateMetrics: HonestMetrics = {
  top10_mean_pts: 4.5,
  haul_capture_20: 0.1,
  captain_return_rate: 0.5,
  n_gws: 5,
}

describe('ForwardSkillPanel — live state (n_gws >= 8)', () => {
  it('renders the "Forward Skill" section header', () => {
    const { container } = render(<ForwardSkillPanel honest={liveMetrics} />)
    expect(container.textContent).toContain('Forward Skill')
  })

  it('renders haul-capture Stat as "~1 in N"', () => {
    const { container } = render(<ForwardSkillPanel honest={liveMetrics} />)
    // 0.194 -> ~1 in 5
    expect(container.textContent).toContain('~1 in 5')
  })

  it('renders top-10 mean pts Stat', () => {
    const { container } = render(<ForwardSkillPanel honest={liveMetrics} />)
    expect(container.textContent).toContain('5.7 pts')
  })

  it('renders captain return rate Stat', () => {
    const { container } = render(<ForwardSkillPanel honest={liveMetrics} />)
    expect(container.textContent).toContain('60%')
  })

  it('renders RMSE stat', () => {
    const { container } = render(<ForwardSkillPanel honest={liveMetrics} />)
    // 3.1415 -> "3.142"
    expect(container.textContent).toContain('3.142')
  })

  it('renders Spearman stat', () => {
    const { container } = render(<ForwardSkillPanel honest={liveMetrics} />)
    expect(container.textContent).toContain('0.321')
  })

  it('renders per-GW table with correct rows', () => {
    const { container } = render(<ForwardSkillPanel honest={liveMetrics} />)
    const perGwTable = container.querySelector('[data-testid="forward-skill-per-gw"]')
    expect(perGwTable).not.toBeNull()
    expect(perGwTable!.textContent).toContain('GW1')
    expect(perGwTable!.textContent).toContain('GW2')
    expect(perGwTable!.textContent).toContain('Salah')
    expect(perGwTable!.textContent).toContain('Haaland')
  })

  it('renders by-position table with all four positions', () => {
    const { container } = render(<ForwardSkillPanel honest={liveMetrics} />)
    const byPosTable = container.querySelector('[data-testid="forward-skill-by-position"]')
    expect(byPosTable).not.toBeNull()
    expect(byPosTable!.textContent).toContain('GKP')
    expect(byPosTable!.textContent).toContain('DEF')
    expect(byPosTable!.textContent).toContain('MID')
    expect(byPosTable!.textContent).toContain('FWD')
  })

  it('shows provenance caption with n_gws', () => {
    const { container } = render(<ForwardSkillPanel honest={liveMetrics} />)
    expect(container.textContent).toContain('12 GWs')
    expect(container.textContent).toContain('deploy mode')
  })

  it('does NOT show "switches to live after GW8" caption in live state', () => {
    const { container } = render(<ForwardSkillPanel honest={liveMetrics} />)
    expect(container.textContent).not.toContain('switches to live after GW8')
  })
})

describe('ForwardSkillPanel — fallback state (honest absent or n_gws < 8)', () => {
  it('renders with undefined honest — shows baseline constants', () => {
    const { container } = render(<ForwardSkillPanel honest={undefined} />)
    // Baseline: 0.194 -> "~1 in 5"
    expect(container.textContent).toContain('~1 in 5')
    // Baseline: captain_return_rate 0.60 -> 60%
    expect(container.textContent).toContain('60%')
    // Baseline: top10_mean_pts 5.66 -> "5.7 pts"
    expect(container.textContent).toContain('5.7 pts')
  })

  it('renders with n_gws=5 (below gate) — shows baseline constants', () => {
    const { container } = render(<ForwardSkillPanel honest={belowGateMetrics} />)
    // Still shows baseline values (0.194, not 0.1 from fixture)
    expect(container.textContent).toContain('~1 in 5')
  })

  it('shows "switches to live after GW8" caption in fallback state', () => {
    const { container } = render(<ForwardSkillPanel honest={undefined} />)
    expect(container.textContent).toContain('switches to live after GW8')
  })

  it('hides per-GW table in fallback state', () => {
    const { container } = render(<ForwardSkillPanel honest={undefined} />)
    expect(container.querySelector('[data-testid="forward-skill-per-gw"]')).toBeNull()
  })

  it('shows "Per-gameweek detail appears once the season is underway" in fallback', () => {
    const { container } = render(<ForwardSkillPanel honest={undefined} />)
    expect(container.textContent).toContain('Per-gameweek detail appears once the season is underway')
  })

  it('hides by-position table in fallback state', () => {
    const { container } = render(<ForwardSkillPanel honest={undefined} />)
    expect(container.querySelector('[data-testid="forward-skill-by-position"]')).toBeNull()
  })
})

describe('ForwardSkillPanel — panel position in AccuracyTab', () => {
  it('is importable and renders without crashing when honest is undefined', () => {
    const { container } = render(<ForwardSkillPanel honest={undefined} />)
    expect(container.querySelector('[data-testid="forward-skill-panel"]')).not.toBeNull()
  })
})
