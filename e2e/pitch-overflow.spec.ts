import { test, expect } from '@playwright/test'

/**
 * PITCH-01 acceptance for the redesigned lineup pitch: it must fit a 390px
 * viewport with five defenders in one row, keep the tile above its legibility
 * floor, and honour prefers-reduced-motion.
 *
 * mobile-overflow.spec.ts cannot cover this — it visits ?t=lineup with no team
 * id, so it only ever renders the empty state and never the pitch. This spec
 * stubs the two API routes LineupTab reads so the real pitch renders, then
 * measures the pitch subtree rather than the body, so the pre-existing
 * shell-level overflow (506px at every tab, unrelated to this component) does
 * not mask a regression here.
 */

const TEAM_ID = '537955'

function player(id: number, elementType: 1 | 2 | 3 | 4, name: string) {
  return {
    id, code: 100000 + id, web_name: name, team: 1, team_short_name: 'MUN', team_code: 1,
    element_type: elementType, now_cost: 50, selected_by_percent: '5.0', form: '3.0',
    status: 'a', minutes: 900, starts: 10, total_points: 50, goals_scored: 1, assists: 1,
    expected_goals: 1, expected_assists: 1, defensive_contribution: null,
    clearances_blocks_interceptions: null, direct_freekicks_order: null, penalties_order: null,
    corners_and_indirect_freekicks_order: null, penalties_text: '', direct_freekicks_text: '',
    corners_and_indirect_freekicks_text: '', news: '', cost_change_event: 0, cost_change_start: 0,
    understat_id: null, xg_per90: 0.3, xa_per90: 0.2, minutes_per90: 88, form_pts_per90: 3,
    pts_last3gw: 9, pts_last5gw: 15, pts_gw_count: 5,
    fixtures: [{
      opponent_team: 'LIV', is_home: true, event_id: 1, difficulty_score: 0.7,
      difficulty_tier: 'hard', attacking_difficulty: 0.7, defensive_difficulty: 0.7,
    }],
    xPts_1gw: 4.5, xPts_3gw: 13, xPts_5gw: 22, xmins: 85, start_prob: 0.9, mins_risk: 'nailed',
  }
}

// 2 GK, 5 DEF, 5 MID, 3 FWD. Long names on the defenders so the five-across row
// is measured under the worst realistic truncation pressure.
const PLAYERS = [
  player(1, 1, 'Verbruggen'), player(2, 1, 'Kinsky'),
  player(3, 2, 'Mykolenko'), player(4, 2, 'Calafiori'), player(5, 2, 'De Cuyper'),
  player(6, 2, 'Van de Ven'), player(7, 2, 'Aina'),
  player(8, 3, 'B.Fernandes'), player(9, 3, 'Semenyo'), player(10, 3, 'Mbeumo'),
  player(11, 3, 'Gibbs-White'), player(12, 3, 'Rogers'),
  player(13, 4, 'Haaland'), player(14, 4, 'Thiago'), player(15, 4, 'Igor Jesus'),
]

test.use({ viewport: { width: 390, height: 900 } })

test.describe('PITCH-01 pitch fits a 390px viewport', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/players', r => r.fulfill({ json: PLAYERS }))
    await page.route(`**/api/squad/**`, r => r.fulfill({
      json: {
        active_chip: null,
        picks: PLAYERS.map((p, i) => ({
          element: p.id, position: i + 1, multiplier: 1,
          is_captain: false, is_vice_captain: false,
        })),
        entry_history: { event: 1, bank: 0, event_transfers: 0, event_transfers_cost: 0, value: 1000 },
      },
    }))
    await page.addInitScript(id => localStorage.setItem('fpl_team_id', id), TEAM_ID)
  })

  test('five defenders fit one row with no horizontal overflow', async ({ page }) => {
    await page.goto('/?t=lineup')
    await page.getByTestId('pitch').waitFor({ timeout: 20_000 })
    // Force the widest legal back line.
    await page.getByTestId('formation-5-3-2').click()
    await expect(page.locator('[data-testid="pitch-row-def"] [data-testid^="pitch-card-body-"]'))
      .toHaveCount(5)

    const box = await page.evaluate(() => {
      const pitch = document.querySelector('[data-testid="pitch"]') as HTMLElement
      const row = document.querySelector('[data-testid="pitch-row-def"]') as HTMLElement
      return {
        pitchScroll: pitch.scrollWidth, pitchClient: pitch.clientWidth,
        rowScroll: row.scrollWidth, rowClient: row.clientWidth,
      }
    })
    expect(box.pitchScroll, 'pitch scrolls horizontally').toBeLessThanOrEqual(box.pitchClient)
    expect(box.rowScroll, 'five-defender row overflows its pitch').toBeLessThanOrEqual(box.rowClient)
  })

  test('the kit tile holds the 62px legibility floor with five across', async ({ page }) => {
    // Brief §2: below 62px the name plate truncates past usefulness. Asserted on
    // the tile rather than the card, since the card is the flex item and the
    // tile is what carries the image and sets the plate's width.
    await page.goto('/?t=lineup')
    await page.getByTestId('pitch').waitFor({ timeout: 20_000 })
    await page.getByTestId('formation-5-3-2').click()
    await expect(page.locator('[data-testid="pitch-row-def"] [data-testid^="pitch-card-body-"]'))
      .toHaveCount(5)
    const widths = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid="pitch-row-def"] [data-testid^="pitch-card-kit-"]'))
        .map(el => Math.round(el.getBoundingClientRect().width)))
    expect(widths).toHaveLength(5)
    for (const w of widths) expect(w).toBeGreaterThanOrEqual(62)
  })

  test('prefers-reduced-motion collapses the lift and the legal-target pulse', async ({ page }) => {
    // Acceptance: the global rule in globals.css must reach the pitch's two
    // motions — `transition-transform` on the lift and `animate-pulse` on a
    // legal drop target. The armed card's static -translate-y is a state
    // indicator, not motion, and correctly survives.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/?t=lineup')
    await page.getByTestId('pitch').waitFor({ timeout: 20_000 })
    const r = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.className = 'animate-pulse transition-transform duration-150'
      document.body.appendChild(probe)
      const cs = getComputedStyle(probe)
      const out = {
        matches: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        anim: parseFloat(cs.animationDuration),
        trans: parseFloat(cs.transitionDuration),
      }
      probe.remove()
      return out
    })
    expect(r.matches).toBe(true)
    expect(r.anim).toBeLessThan(0.05)
    expect(r.trans).toBeLessThan(0.05)
  })

  test('bench tray is two columns and does not overflow', async ({ page }) => {
    await page.goto('/?t=lineup')
    await page.getByTestId('pitch-row-bench').waitFor({ timeout: 20_000 })
    const box = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="pitch-row-bench"]') as HTMLElement
      return { scroll: t.scrollWidth, client: t.clientWidth, cols: getComputedStyle(t).gridTemplateColumns.split(' ').length }
    })
    expect(box.cols).toBe(2)
    expect(box.scroll).toBeLessThanOrEqual(box.client)
  })
})
