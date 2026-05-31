// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { BBDetailPanel } from './BBDetailPanel'
import type { BBReadiness } from '@/lib/chip-strategy-engine'

function makeReadiness(overrides: Partial<BBReadiness> = {}): BBReadiness {
  return {
    score: 65,
    bench_xpts: 9.6,
    bench_xpts_score: 80,
    avg_start_prob: 0.85,
    start_prob_score: 85,
    doublers: 1,
    doublers_score: 25,
    ...overrides,
  }
}

describe('BBDetailPanel', () => {
  it('renders the score badge with correct value', () => {
    render(<BBDetailPanel readiness={makeReadiness({ score: 72 })} />)
    expect(screen.getByText('72 / 100')).toBeInTheDocument()
  })

  it('renders three component bars with labels', () => {
    render(<BBDetailPanel readiness={makeReadiness()} />)
    expect(screen.getByText('Bench xPts')).toBeInTheDocument()
    expect(screen.getByText('Start Prob')).toBeInTheDocument()
    expect(screen.getByText('Doublers')).toBeInTheDocument()
  })

  it('renders bench xPts value label', () => {
    render(<BBDetailPanel readiness={makeReadiness({ bench_xpts: 9.6 })} />)
    expect(screen.getByText('9.6 pts')).toBeInTheDocument()
  })

  it('renders avg start prob as percentage', () => {
    render(<BBDetailPanel readiness={makeReadiness({ avg_start_prob: 0.85 })} />)
    expect(screen.getByText('85% avg')).toBeInTheDocument()
  })

  it('renders doublers count', () => {
    render(<BBDetailPanel readiness={makeReadiness({ doublers: 2 })} />)
    expect(screen.getByText('2 of 4')).toBeInTheDocument()
  })

  it('renders hitCostLabel when provided', () => {
    render(<BBDetailPanel readiness={makeReadiness()} hitCostLabel="−4pt hit needed" />)
    expect(screen.getByText('−4pt hit needed')).toBeInTheDocument()
  })

  it('does not render hit cost section when hitCostLabel is absent', () => {
    render(<BBDetailPanel readiness={makeReadiness()} />)
    expect(screen.queryByText(/hit needed/i)).not.toBeInTheDocument()
  })

  it('shows no-squad message when score is 0', () => {
    render(<BBDetailPanel readiness={makeReadiness({ score: 0, bench_xpts: 0, bench_xpts_score: 0, avg_start_prob: 0, start_prob_score: 0 })} />)
    expect(screen.getByText(/load your squad/i)).toBeInTheDocument()
  })
})
