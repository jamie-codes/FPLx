import { test, expect, type Page } from '@playwright/test'

/**
 * Phase 77 POL-03: 430px mobile overflow audit.
 * Asserts no tool on the home page produces horizontal body scroll at Galaxy S26+ width.
 * Baseline depends on Plan 01: AccuracyTab now has overflow-x-auto wrappers; LineupTab kit images
 * are object-contain w-6 h-6; DecisionSummaryTab captain row uses sm:flex-wrap.
 *
 * Navigation at 430px uses the UIX-01 shell: mobile bottom bar with groups (Home, This Week,
 * Squad, Research, More), MoreSheet for Planning/Model tools, and ?t=<toolId> deep links.
 * Each tool is driven via page.goto('/?t=<toolId>') to avoid fragile UI nav.
 */

type TabSpec = {
  name: string
  toolId: string
  settle: (page: Page) => Promise<void>
}

const TABS: TabSpec[] = [
  {
    // Insights is in the Research group
    name: 'Insights',
    toolId: 'insights',
    settle: async (p) => {
      // InsightsTab always renders <section aria-label="Insights"> as the outermost wrapper
      await p.locator('section[aria-label="Insights"]').waitFor({ timeout: 15_000 })
    },
  },
  {
    // Planner is in the Planning group — renders ChipStrategyPanel
    name: 'Planner',
    toolId: 'planner',
    settle: async (p) => {
      // ChipStrategyPanel always renders (even without squad data), so this is stable
      await p.getByTestId('chip-strategy-panel').waitFor({ timeout: 15_000 })
    },
  },
  {
    // Lineup is in the This Week group. Without a team ID submitted, it renders the empty-state.
    name: 'Lineup',
    toolId: 'lineup',
    settle: async (p) => {
      await p.getByTestId('lineup-tab').waitFor({ timeout: 15_000 })
    },
  },
  {
    // Set Pieces is in the Research group
    name: 'Set Pieces',
    toolId: 'set-pieces',
    settle: async (p) => {
      // SetPieceTakerPanel renders <h2>Set-Piece Takers</h2>
      await p.getByRole('heading', { name: 'Set-Piece Takers' }).waitFor({ timeout: 15_000 })
    },
  },
  {
    // Accuracy is in the Model group
    name: 'Accuracy',
    toolId: 'accuracy',
    settle: async (p) => {
      // AccuracyTab renders a calibration chart or GW rows; fallback to the section container
      await p.locator('[data-testid="calibration-chart"], [data-testid^="gw-row-"]').first().waitFor({ timeout: 15_000 })
    },
  },
  {
    // Rivals is in the My Squad group
    name: 'Rivals',
    toolId: 'rivals',
    settle: async (p) => {
      // RivalsTab renders <h2>Track your mini-league rivals</h2>
      await p.getByRole('heading', { name: 'Track your mini-league rivals' }).waitFor({ timeout: 15_000 })
    },
  },
  {
    // Value Gems is in the Research group
    name: 'Value Gems',
    toolId: 'value-gems',
    settle: async (p) => {
      // ValueGemsTable renders <h1>Value Gems</h1>
      await p.getByRole('heading', { name: 'Value Gems' }).waitFor({ timeout: 15_000 })
    },
  },
]

test.describe('POL-03 — 430px mobile overflow audit', () => {
  for (const tab of TABS) {
    test(`${tab.name} tab does not overflow 430px viewport horizontally`, async ({ page }) => {
      await page.goto(`/?t=${tab.toolId}`)
      await tab.settle(page)
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.body.scrollWidth,
        innerWidth: window.innerWidth,
      }))

      expect(
        overflow.scrollWidth,
        `${tab.name} tab: body.scrollWidth (${overflow.scrollWidth}px) > window.innerWidth (${overflow.innerWidth}px) — horizontal overflow detected at 430px viewport`,
      ).toBeLessThanOrEqual(overflow.innerWidth)
    })
  }
})
