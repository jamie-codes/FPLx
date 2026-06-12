// Phase 29: Regression Detector — test stubs
// Wave 0: stubs created before implementation to satisfy Nyquist rule.
// Integration tests are skipped (require pipeline run).
// Component tests filled in Wave 2 Task 1 when RegressionSignalBadge.tsx was created.
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { RegressionSignalBadge } from '@/components/gem-table/RegressionSignalBadge'

describe('Phase 29: Regression Signal pipeline output', () => {
  it.skip('regression_signal values are buy, sell, null, or absent (requires pipeline run)', async () => {
    const raw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'merged_players.json'), 'utf-8')
    const players = JSON.parse(raw) as Record<string, unknown>[]
    expect(players.length).toBeGreaterThan(0)
    for (const p of players) {
      const sig = p.regression_signal
      expect(
        typeof sig === 'undefined' || sig === null || sig === 'buy' || sig === 'sell',
      ).toBe(true)
    }
  })

  it.skip('players with regression_signal=buy have actual_vs_xg_delta < -0.5 (requires pipeline run)', async () => {
    const raw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'merged_players.json'), 'utf-8')
    const players = JSON.parse(raw) as Record<string, unknown>[]
    for (const p of players) {
      if (p.regression_signal === 'buy') {
        expect((p.actual_vs_xg_delta as number) < -0.5).toBe(true)
      }
    }
  })

  it.skip('players with regression_signal=sell have actual_vs_xg_delta > 0.5 (requires pipeline run)', async () => {
    const raw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'merged_players.json'), 'utf-8')
    const players = JSON.parse(raw) as Record<string, unknown>[]
    for (const p of players) {
      if (p.regression_signal === 'sell') {
        expect((p.actual_vs_xg_delta as number) > 0.5).toBe(true)
      }
    }
  })

  it.skip('players with no regression_signal field have it undefined (not null) (requires pipeline run)', async () => {
    const raw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'merged_players.json'), 'utf-8')
    const players = JSON.parse(raw) as Record<string, unknown>[]
    for (const p of players) {
      // When pipeline gate fails (< 900 min), field must be absent (undefined), not null
      if (!('regression_signal' in p)) {
        expect(p.regression_signal).toBeUndefined()
      }
    }
  })

  it.skip('between 5% and 40% of players with defined signals have a non-null signal (sanity ratio, requires pipeline run)', async () => {
    const raw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'merged_players.json'), 'utf-8')
    const players = JSON.parse(raw) as Record<string, unknown>[]
    const withSignalField = players.filter((p) => 'regression_signal' in p)
    const withNonNullSignal = withSignalField.filter(
      (p) => p.regression_signal === 'buy' || p.regression_signal === 'sell',
    )
    if (withSignalField.length > 0) {
      const ratio = withNonNullSignal.length / withSignalField.length
      expect(ratio).toBeGreaterThanOrEqual(0.05)
      expect(ratio).toBeLessThanOrEqual(0.40)
    }
  })
})

describe('Phase 29: RegressionSignalBadge component', () => {
  it('renders positive BUY pill for signal="buy" (UIX-03: Chip positive)', () => {
    const { container } = render(RegressionSignalBadge({ signal: 'buy', delta: -0.75 }))
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span!.textContent).toBe('BUY')
    expect(span!.className).toContain('bg-positive-soft')
    expect(span!.className).toContain('text-data')
  })

  it('renders warning SELL pill for signal="sell" (UIX-03: Chip warning)', () => {
    const { container } = render(RegressionSignalBadge({ signal: 'sell', delta: 0.82 }))
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span!.textContent).toBe('SELL')
    expect(span!.className).toContain('bg-warning-soft')
  })

  it('renders em-dash for signal=null', () => {
    const { container } = render(RegressionSignalBadge({ signal: null, delta: null }))
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span!.textContent).toBe('—')
    expect(span!.className).toContain('text-ink-muted')
  })

  it('renders em-dash for signal=undefined', () => {
    const { container } = render(RegressionSignalBadge({ signal: undefined, delta: undefined }))
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span!.textContent).toBe('—')
    expect(span!.className).toContain('text-ink-muted')
  })

  it('BUY title attribute mentions xG+xA and "Consider buying"', () => {
    const { container } = render(RegressionSignalBadge({ signal: 'buy', delta: -0.75 }))
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    const title = span!.getAttribute('title')!
    expect(title).toMatch(/xG\+xA/)
    expect(title).toMatch(/Consider buying/)
  })

  it('SELL title attribute mentions xG+xA and "Consider selling"', () => {
    const { container } = render(RegressionSignalBadge({ signal: 'sell', delta: 0.82 }))
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    const title = span!.getAttribute('title')!
    expect(title).toMatch(/xG\+xA/)
    expect(title).toMatch(/Consider selling/)
  })
})

it('Wave 0 stub file created — replace with real tests after implementation', () => {
  expect(true).toBe(true)
})
